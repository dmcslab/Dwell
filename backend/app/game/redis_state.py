"""Redis session state helpers."""
from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any
from redis.asyncio import Redis

_SESSION_KEY = "game:session:{sid}"
_LOCK_KEY    = "game:lock:{sid}"
SESSION_TTL  = 86_400
LOCK_TTL     = 5


async def get_state(redis: Redis, session_id: str) -> dict[str, Any] | None:
    raw = await redis.get(_SESSION_KEY.format(sid=session_id))
    return json.loads(raw) if raw else None


async def set_state(redis: Redis, session_id: str, state: dict[str, Any]) -> None:
    await redis.setex(_SESSION_KEY.format(sid=session_id), SESSION_TTL, json.dumps(state, default=str))


async def acquire_lock(redis: Redis, session_id: str) -> bool:
    return await redis.set(_LOCK_KEY.format(sid=session_id), "1", nx=True, ex=LOCK_TTL) is not None


async def release_lock(redis: Redis, session_id: str) -> None:
    await redis.delete(_LOCK_KEY.format(sid=session_id))


async def add_participant(redis: Redis, session_id: str, name: str, client_id: str) -> None:
    state = await get_state(redis, session_id)
    if state is None:
        return
    participants = state.get("participants", [])
    if not any(p.get("client_id") == client_id for p in participants):
        participants.append({
            "name": name, "client_id": client_id,
            "joined_at": datetime.now(timezone.utc).isoformat(),
        })
        state["participants"] = participants
        await set_state(redis, session_id, state)


async def remove_participant(redis: Redis, session_id: str, client_id: str) -> None:
    state = await get_state(redis, session_id)
    if state is None:
        return
    from app.game.logic import remove_role
    state["participants"] = [p for p in state.get("participants", []) if p.get("client_id") != client_id]
    state = remove_role(state, client_id)
    await set_state(redis, session_id, state)


async def get_participants_db(redis: Redis, session_id: str) -> list[dict]:
    state = await get_state(redis, session_id)
    return state.get("participants", []) if state else []


# ── Active session index (for admin dashboard) ────────────────────────────────
_ACTIVE_KEY = "admin:active_sessions"


async def register_active_session(redis: Redis, session_id: str, scenario_id: int, scenario_name: str) -> None:
    payload = json.dumps({"session_id": session_id, "scenario_id": scenario_id,
                          "scenario_name": scenario_name, "started_at": datetime.now(timezone.utc).isoformat()})
    await redis.hset(_ACTIVE_KEY, session_id, payload)


async def deregister_active_session(redis: Redis, session_id: str) -> None:
    await redis.hdel(_ACTIVE_KEY, session_id)


async def list_active_sessions(redis: Redis) -> list[dict[str, Any]]:
    raw = await redis.hgetall(_ACTIVE_KEY)
    sessions = []
    for sid, val in raw.items():
        try:
            meta = json.loads(val)
        except Exception:
            continue
        state = await get_state(redis, sid if isinstance(sid, str) else sid.decode())
        if state:
            meta.update({
                "phase": state.get("phase"), "current_stage_id": state.get("current_stage_id"),
                "participants": state.get("participants", []),
                "roles": state.get("roles", {}), "role_names": state.get("role_names", {}),
                "attempts_remaining": state.get("attempts_remaining"),
                "completed_stages": len(state.get("completed_stage_ids", [])),
                "total_stages": None,
            })
            sessions.append(meta)
        else:
            await redis.hdel(_ACTIVE_KEY, sid)
    return sessions


# ── Spectator helpers ─────────────────────────────────────────────────────────

async def add_spectator_to_state(redis: Redis, session_id: str, name: str, client_id: str) -> None:
    state = await get_state(redis, session_id)
    if state is None:
        return
    from app.game.logic import add_spectator
    state = add_spectator(state, client_id, name)
    await set_state(redis, session_id, state)


async def remove_spectator_from_state(redis: Redis, session_id: str, client_id: str) -> None:
    state = await get_state(redis, session_id)
    if state is None:
        return
    from app.game.logic import remove_spectator
    state = remove_spectator(state, client_id)
    await set_state(redis, session_id, state)
