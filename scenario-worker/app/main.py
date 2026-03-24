"""
Isolated scenario-worker process.

Each container handles exactly one game session.
The backend proxies WebSocket frames here via the orchestrator-registered URL.

WebSocket: ws://worker:8765/ws/game
REST:      GET /health
"""
from __future__ import annotations
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.logic import begin_simulation, process_choice, session_summary
from app.redis_state import get_state, set_state

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [worker] %(levelname)s %(message)s")

_engine: AsyncEngine | None = None
_redis: Redis | None = None


def _get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    return _engine


def _get_session_factory():
    return sessionmaker(_get_engine(), class_=AsyncSession, expire_on_commit=False)


async def _get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis


async def _load_scenario() -> dict[str, Any] | None:
    """Load scenario_structure from DB for this worker's SCENARIO_ID."""
    try:
        # Import models inline to avoid circular issues in isolated worker
        from sqlalchemy import text
        async with _get_session_factory()() as db:
            result = await db.execute(
                text("SELECT scenario_structure FROM scenarios WHERE id = :sid"),
                {"sid": settings.SCENARIO_ID},
            )
            row = result.fetchone()
            if row:
                return row[0]
    except Exception as exc:
        log.error("failed to load scenario %d: %s", settings.SCENARIO_ID, exc)
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("worker starting session=%s scenario=%d", settings.SESSION_ID, settings.SCENARIO_ID)
    yield
    global _redis, _engine
    if _redis:
        await _redis.aclose()
        _redis = None
    if _engine:
        await _engine.dispose()
        _engine = None
    log.info("worker stopped session=%s", settings.SESSION_ID)


app = FastAPI(title=f"Dwell Worker [{settings.SESSION_ID[:8]}]", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "session_id": settings.SESSION_ID, "scenario_id": settings.SCENARIO_ID}


@app.websocket("/ws/game")
async def game_ws(ws: WebSocket):
    await ws.accept()
    redis = await _get_redis()
    session_id = settings.SESSION_ID

    structure = await _load_scenario()
    if not structure:
        await ws.send_text(json.dumps({"type": "error", "message": "Scenario not found"}))
        await ws.close()
        return

    decision_tree: list[dict] = structure.get("decisionTree", [])
    state = await get_state(redis, session_id)
    if not state:
        await ws.send_text(json.dumps({"type": "error", "message": "Session state not found"}))
        await ws.close()
        return

    await ws.send_text(json.dumps({"type": "connected", "session_id": session_id, "state": state}, default=str))

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({"type": "error", "message": "Invalid JSON"}))
                continue

            msg_type = msg.get("type", "")

            if msg_type == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))

            elif msg_type == "request_state":
                cur = await get_state(redis, session_id)
                await ws.send_text(json.dumps({"type": "state_sync", "state": cur}, default=str))

            elif msg_type == "begin":
                try:
                    cur = await get_state(redis, session_id)
                    new_state = begin_simulation(cur)
                    await set_state(redis, session_id, new_state)
                    await ws.send_text(json.dumps({"type": "state_sync", "state": new_state}, default=str))
                except Exception as exc:
                    await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))

            elif msg_type == "make_choice":
                stage_id = msg.get("stage_id", "")
                option_index = int(msg.get("option_index", -1))
                decided_by = msg.get("decided_by", "Player")
                try:
                    cur = await get_state(redis, session_id)
                    new_state, choice_result = process_choice(cur, decision_tree, stage_id, option_index)
                    choice_result["decided_by"] = decided_by
                    await set_state(redis, session_id, new_state)
                    await ws.send_text(json.dumps(choice_result, default=str))
                    if choice_result.get("game_over"):
                        summary = session_summary(new_state)
                        await ws.send_text(json.dumps({"type": "game_end", "summary": summary, "state": new_state}, default=str))
                    else:
                        await ws.send_text(json.dumps({"type": "state_sync", "state": new_state}, default=str))
                except Exception as exc:
                    await ws.send_text(json.dumps({"type": "error", "message": str(exc)}))

            elif msg_type == "save_exit":
                cur = await get_state(redis, session_id)
                if cur:
                    cur["saved_at"] = datetime.now(timezone.utc).isoformat()
                    await set_state(redis, session_id, cur)
                await ws.send_text(json.dumps({"type": "session_saved"}))

    except WebSocketDisconnect:
        log.info("client disconnected session=%s", session_id)
