"""Player-facing game engine with role-based team support.

REST:
  GET  /game/scenarios             -> list scenarios (public)
  GET  /game/scenarios/{id}        -> full scenario
  POST /game/start/{scenario_id}   -> create session
  GET  /game/join/{session_id}     -> session info
  POST /game/join/{session_id}     -> register participant

WebSocket:
  WS   /game/play/{session_id}?name=...

WS message types (client -> server):
  ping / request_state / save_exit
  begin
  assign_role   { role }
  make_choice   { stage_id, option_index }   -- ir_lead or solo only
  suggest_choice { stage_id, option_index }  -- network / endpoint
  use_hint
"""
from __future__ import annotations
import json, logging, uuid as _uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionFactory, get_redis
from app.game.connection_manager import manager as ws_manager
from app.game.logic import (
    assign_role, begin_simulation, build_initial_state, can_submit,
    is_spectator, process_choice, remove_spectator, session_summary,
    suggest_choice, use_hint,
)
from app.game.redis_state import (
    acquire_lock, add_participant, add_spectator_to_state,
    deregister_active_session, get_state, register_active_session,
    release_lock, remove_participant, remove_spectator_from_state, set_state,
)
from app.models.models import GameSession, Scenario

log = logging.getLogger(__name__)
router = APIRouter(prefix="/game", tags=["game"])


# ── Pydantic ──────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    team_name:   str = Field(default="",       max_length=100)
    player_name: str = Field(default="Player", max_length=64)


class JoinRequest(BaseModel):
    player_name: str = Field(default="Player", max_length=64)


# ── Scenario read (public) ────────────────────────────────────────────────────

@router.get("/scenarios")
async def list_game_scenarios():
    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Scenario).order_by(Scenario.id))
        scenarios = result.scalars().all()
    return [{"id": s.id, "name": s.name, "description": s.description,
             "difficulty_level": s.difficulty_level, "max_attempts": s.max_attempts} for s in scenarios]


@router.get("/scenarios/{scenario_id}")
async def get_game_scenario(scenario_id: int):
    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
        s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"id": s.id, "name": s.name, "description": s.description,
            "difficulty_level": s.difficulty_level, "max_attempts": s.max_attempts,
            "initial_prompt": s.initial_prompt, "scenario_structure": s.scenario_structure}


# ── Session start ─────────────────────────────────────────────────────────────

@router.post("/start/{scenario_id}")
async def start_session(scenario_id: int, body: StartRequest):
    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
        scenario = result.scalar_one_or_none()
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")

        session_id    = str(_uuid.uuid4())
        structure     = scenario.scenario_structure or {}
        decision_tree = structure.get("decisionTree", [])
        initial_state = build_initial_state(session_id, scenario_id, decision_tree, scenario.max_attempts)
        initial_state["participants"] = [{"name": body.player_name, "client_id": "host",
                                          "joined_at": datetime.now(timezone.utc).isoformat()}]

        gs = GameSession(session_id=session_id, scenario_id=scenario_id,
                         team_name=body.team_name or None, current_state=initial_state,
                         attempts_remaining=scenario.max_attempts)
        db.add(gs)
        await db.flush()

    redis = await get_redis()
    await set_state(redis, session_id, initial_state)
    await register_active_session(redis, session_id, scenario_id, scenario.name)

    share_link = f"{settings.APP_BASE_URL}/#/join/{session_id}"
    return {"session_id": session_id, "share_link": share_link, "scenario_id": scenario_id,
            "team_name": body.team_name, "state": initial_state}


# ── Join endpoints ────────────────────────────────────────────────────────────

@router.get("/join/{session_id}")
async def get_join_info(session_id: str):
    redis = await get_redis()
    state = await get_state(redis, session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "scenario_id": state.get("scenario_id"),
            "phase": state.get("phase"), "participants": state.get("participants", []),
            "roles": state.get("roles", {}), "role_names": state.get("role_names", {})}


@router.post("/join/{session_id}")
async def join_session(session_id: str, body: JoinRequest):
    redis = await get_redis()
    state = await get_state(redis, session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "player_name": body.player_name,
            "state": state, "participants": state.get("participants", [])}


# ── WebSocket game loop ───────────────────────────────────────────────────────

@router.websocket("/play/{session_id}")
async def websocket_game(ws: WebSocket, session_id: str, name: str = Query(default="Player")):
    await ws.accept()
    client_id = str(_uuid.uuid4())[:8]
    redis     = await get_redis()

    state = await get_state(redis, session_id)
    if not state:
        await ws.send_text(json.dumps({"type": "error", "message": "Session not found"}))
        await ws.close(); return

    async with AsyncSessionFactory() as db:
        result = await db.execute(select(Scenario).where(Scenario.id == state.get("scenario_id", 0)))
        scenario = result.scalar_one_or_none()
    if not scenario:
        await ws.send_text(json.dumps({"type": "error", "message": "Scenario not found"}))
        await ws.close(); return

    decision_tree = (scenario.scenario_structure or {}).get("decisionTree", [])
    ws_manager.connect(session_id, client_id, ws)
    await add_participant(redis, session_id, name, client_id)
    state = await get_state(redis, session_id)

    await ws_manager.send_personal(session_id, client_id, {
        "type": "connected", "client_id": client_id, "session_id": session_id,
        "state": state,
        "scenario": {"id": scenario.id, "name": scenario.name,
                     "description": scenario.description,
                     "difficulty_level": scenario.difficulty_level,
                     "max_attempts": scenario.max_attempts,
                     "initial_prompt": scenario.initial_prompt,
                     "scenario_structure": scenario.scenario_structure},
    })
    await ws_manager.broadcast(session_id,
        {"type": "member_joined", "name": name, "client_id": client_id}, exclude_client=client_id)
    await ws_manager.broadcast_presence(session_id, ws_manager.client_ids(session_id))

    try:
        while True:
            try:
                raw = await ws.receive_text()
            except (WebSocketDisconnect, RuntimeError):
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type", "")

            # ── ping ──────────────────────────────────────────────────────────
            if msg_type == "ping":
                await ws_manager.send_personal(session_id, client_id, {"type": "pong"})

            # ── request_state ─────────────────────────────────────────────────
            elif msg_type == "request_state":
                cur = await get_state(redis, session_id)
                await ws_manager.send_personal(session_id, client_id, {"type": "state_sync", "state": cur})

            # ── assign_role ───────────────────────────────────────────────────
            elif msg_type == "assign_role":
                role = msg.get("role", "")
                locked = await acquire_lock(redis, session_id)
                if not locked:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Action in progress"})
                    continue
                try:
                    cur = await get_state(redis, session_id)
                    new_state = assign_role(cur, client_id, role, name)
                    await set_state(redis, session_id, new_state)
                    await ws_manager.broadcast_all(session_id, {
                        "type": "role_assigned", "client_id": client_id,
                        "name": name, "role": role,
                        "roles": new_state["roles"], "role_names": new_state["role_names"],
                    })
                except Exception as exc:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": str(exc)})
                finally:
                    await release_lock(redis, session_id)

            # ── begin ─────────────────────────────────────────────────────────
            elif msg_type == "begin":
                locked = await acquire_lock(redis, session_id)
                if not locked:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Action in progress"})
                    continue
                try:
                    cur = await get_state(redis, session_id)
                    new_state = begin_simulation(cur)
                    await set_state(redis, session_id, new_state)
                    await ws_manager.broadcast_all(session_id, {"type": "state_sync", "state": new_state})
                except Exception as exc:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": str(exc)})
                finally:
                    await release_lock(redis, session_id)

            # ── suggest_choice ────────────────────────────────────────────────
            elif msg_type == "suggest_choice":
                stage_id     = msg.get("stage_id", "")
                option_index = int(msg.get("option_index", -1))
                locked = await acquire_lock(redis, session_id)
                if not locked:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Action in progress"})
                    continue
                try:
                    cur = await get_state(redis, session_id)
                    new_state, suggestion_event = suggest_choice(cur, decision_tree, client_id, stage_id, option_index, name)
                    await set_state(redis, session_id, new_state)
                    await ws_manager.broadcast_all(session_id, suggestion_event)
                except Exception as exc:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": str(exc)})
                finally:
                    await release_lock(redis, session_id)

            # ── make_choice ───────────────────────────────────────────────────
            elif msg_type == "make_choice":
                stage_id     = msg.get("stage_id", "")
                option_index = int(msg.get("option_index", -1))
                locked = await acquire_lock(redis, session_id)
                if not locked:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Action in progress"})
                    continue
                try:
                    cur = await get_state(redis, session_id)
                    if not can_submit(cur, client_id):
                        await ws_manager.send_personal(session_id, client_id,
                            {"type": "error", "message": "Only the IR Lead can submit the final decision"})
                        continue
                    new_state, choice_result = process_choice(cur, decision_tree, stage_id, option_index)
                    choice_result["decided_by"] = name
                    choice_result["decided_by_role"] = cur.get("roles", {}).get(client_id, "solo")
                    await set_state(redis, session_id, new_state)
                    await ws_manager.broadcast_all(session_id, choice_result)
                    if choice_result.get("game_over"):
                        summary = session_summary(new_state)
                        await ws_manager.broadcast_all(session_id, {"type": "game_end", "summary": summary, "state": new_state})
                        await deregister_active_session(redis, session_id)
                    else:
                        await ws_manager.broadcast_all(session_id, {"type": "state_sync", "state": new_state})
                except Exception as exc:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": str(exc)})
                finally:
                    await release_lock(redis, session_id)

            # ── use_hint ──────────────────────────────────────────────────────
            elif msg_type == "use_hint":
                locked = await acquire_lock(redis, session_id)
                if not locked:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Action in progress"})
                    continue
                try:
                    cur = await get_state(redis, session_id)
                    new_state, hint_event = use_hint(cur, client_id, scenario.scenario_structure or {})
                    await set_state(redis, session_id, new_state)
                    await ws_manager.send_personal(session_id, client_id, hint_event)
                    await ws_manager.broadcast(session_id,
                        {"type": "hint_used", "name": name, "role": cur.get("roles", {}).get(client_id, "solo")},
                        exclude_client=client_id)
                except Exception as exc:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": str(exc)})
                finally:
                    await release_lock(redis, session_id)


            # ── join_as_spectator ─────────────────────────────────────────────────
            elif msg_type == "join_as_spectator":
                locked = await acquire_lock(redis, session_id)
                if not locked:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Action in progress"})
                    continue
                try:
                    cur = await get_state(redis, session_id)
                    if not cur:
                        await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": "Session expired"})
                        continue
                    await add_spectator_to_state(redis, session_id, name, client_id)
                    cur = await get_state(redis, session_id)
                    spectators = cur.get("spectators", {})
                    await ws_manager.send_personal(session_id, client_id, {
                        "type": "spectator_joined_ack",
                        "client_id": client_id,
                        "session_id": session_id,
                        "state": cur,
                        "scenario": {
                            "id": scenario.id, "name": scenario.name,
                            "initial_prompt": scenario.initial_prompt,
                            "scenario_structure": scenario.scenario_structure,
                        },
                    })
                    await ws_manager.broadcast(session_id, {
                        "type": "spectator_joined",
                        "client_id": client_id, "name": name,
                        "spectators": spectators,
                    }, exclude_client=client_id)
                except Exception as exc:
                    await ws_manager.send_personal(session_id, client_id, {"type": "error", "message": str(exc)})
                finally:
                    await release_lock(redis, session_id)

            # ── save_exit ─────────────────────────────────────────────────────
            elif msg_type == "save_exit":
                cur = await get_state(redis, session_id)
                if cur:
                    cur["saved_at"] = datetime.now(timezone.utc).isoformat()
                    await set_state(redis, session_id, cur)
                await ws_manager.send_personal(session_id, client_id, {"type": "session_saved"})

    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        ws_manager.disconnect(session_id, client_id)
        # Determine whether this client was a spectator or player before removing
        cur = await get_state(redis, session_id)
        was_spectator = cur and is_spectator(cur, client_id)
        await remove_participant(redis, session_id, client_id)
        if was_spectator:
            await remove_spectator_from_state(redis, session_id, client_id)
            updated = await get_state(redis, session_id)
            spectators = updated.get("spectators", {}) if updated else {}
            await ws_manager.broadcast(session_id, {
                "type": "spectator_left",
                "client_id": client_id, "name": name,
                "spectators": spectators,
            }, exclude_client=client_id)
        else:
            online = ws_manager.client_ids(session_id)
            await ws_manager.broadcast(session_id,
                {"type": "member_left", "name": name, "client_id": client_id}, exclude_client=client_id)
            if online:
                await ws_manager.broadcast_presence(session_id, online)
