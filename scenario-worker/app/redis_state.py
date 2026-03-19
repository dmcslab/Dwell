"""Minimal Redis session helpers for isolated worker process."""
from __future__ import annotations
import json
from typing import Any
from redis.asyncio import Redis

_SESSION_KEY = "game:session:{sid}"
SESSION_TTL  = 86_400


async def get_state(redis: Redis, session_id: str) -> dict[str, Any] | None:
    raw = await redis.get(_SESSION_KEY.format(sid=session_id))
    return json.loads(raw) if raw else None


async def set_state(redis: Redis, session_id: str, state: dict[str, Any]) -> None:
    await redis.setex(
        _SESSION_KEY.format(sid=session_id),
        SESSION_TTL,
        json.dumps(state, default=str),
    )
