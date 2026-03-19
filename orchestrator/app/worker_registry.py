"""Redis-backed registry of running scenario-worker containers.

Key schema:
  worker:url:{session_id}         → internal WS URL       TTL: 2h
  worker:container:{session_id}   → short container ID    TTL: 2h
  worker:last_ping:{session_id}   → ISO last-active ts    TTL: 2h
  worker:count                    → live worker counter
  worker:queue                    → pending launch list
"""
from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Any
from redis.asyncio import Redis

_WS_KEY  = "worker:url:{sid}"
_CTR_KEY = "worker:container:{sid}"
_PNG_KEY = "worker:last_ping:{sid}"
_CNT_KEY = "worker:count"
_QUE_KEY = "worker:queue"
_TTL     = 7_200


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def register(redis: Redis, session_id: str, container_id: str, worker_ws_url: str) -> None:
    pipe = redis.pipeline()
    pipe.setex(_WS_KEY.format(sid=session_id),  _TTL, worker_ws_url)
    pipe.setex(_CTR_KEY.format(sid=session_id), _TTL, container_id)
    pipe.setex(_PNG_KEY.format(sid=session_id), _TTL, _now())
    pipe.incr(_CNT_KEY)
    await pipe.execute()


async def deregister(redis: Redis, session_id: str) -> None:
    pipe = redis.pipeline()
    pipe.delete(_WS_KEY.format(sid=session_id))
    pipe.delete(_CTR_KEY.format(sid=session_id))
    pipe.delete(_PNG_KEY.format(sid=session_id))
    pipe.decr(_CNT_KEY)
    await pipe.execute()
    count = await redis.get(_CNT_KEY)
    if count and int(count) < 0:
        await redis.set(_CNT_KEY, 0)


async def touch(redis: Redis, session_id: str) -> None:
    await redis.setex(_PNG_KEY.format(sid=session_id), _TTL, _now())


async def get_worker_url(redis: Redis, session_id: str) -> str | None:
    return await redis.get(_WS_KEY.format(sid=session_id))


async def get_container_id(redis: Redis, session_id: str) -> str | None:
    return await redis.get(_CTR_KEY.format(sid=session_id))


async def get_last_ping(redis: Redis, session_id: str) -> str | None:
    return await redis.get(_PNG_KEY.format(sid=session_id))


async def count_live(redis: Redis) -> int:
    val = await redis.get(_CNT_KEY)
    return int(val) if val else 0


async def enqueue(redis: Redis, payload: dict[str, Any]) -> int:
    return await redis.rpush(_QUE_KEY, json.dumps(payload))


async def dequeue(redis: Redis) -> dict[str, Any] | None:
    raw = await redis.lpop(_QUE_KEY)
    return json.loads(raw) if raw else None


async def queue_length(redis: Redis) -> int:
    return await redis.llen(_QUE_KEY)


async def all_session_ids(redis: Redis) -> list[str]:
    pattern = _PNG_KEY.format(sid="*")
    session_ids: list[str] = []
    async for key in redis.scan_iter(match=pattern, count=100):
        raw = key if isinstance(key, str) else key.decode()
        parts = raw.split(":", 2)
        if len(parts) == 3:
            session_ids.append(parts[2])
    return session_ids
