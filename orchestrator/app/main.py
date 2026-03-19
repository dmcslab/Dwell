"""Orchestrator FastAPI service — manages scenario-worker container lifecycle."""
from __future__ import annotations
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import docker.errors
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from redis.asyncio import Redis
from app.config import settings
from app.docker_manager import (
    container_running, launch_worker, list_worker_containers,
    stop_worker, wait_for_worker_ready, worker_ws_url,
)
from app.worker_registry import (
    all_session_ids, count_live, dequeue, deregister, enqueue,
    get_container_id, get_last_ping, get_worker_url, queue_length,
    register, touch,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")
log = logging.getLogger(__name__)

_redis: Redis | None = None


async def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis


async def _do_launch(redis: Redis, session_id: str, scenario_id: int) -> dict:
    container_id = await launch_worker(session_id, scenario_id)
    ready = await wait_for_worker_ready(session_id, timeout=20.0)
    if not ready:
        await stop_worker(session_id)
        raise RuntimeError(f"Worker not ready (session={session_id})")
    ws_url = worker_ws_url(session_id)
    await register(redis, session_id, container_id, ws_url)
    return {"session_id": session_id, "container_id": container_id, "worker_ws_url": ws_url, "status": "running"}


async def _cleanup_loop() -> None:
    log.info("cleanup loop started interval=%ds idle_timeout=%ds", settings.CLEANUP_INTERVAL, settings.WORKER_IDLE_TIMEOUT)
    while True:
        await asyncio.sleep(settings.CLEANUP_INTERVAL)
        try:
            redis = await get_redis()
            for sid in await all_session_ids(redis):
                try:
                    if not await container_running(sid):
                        await deregister(redis, sid)
                        continue
                    last = await get_last_ping(redis, sid)
                    if last:
                        idle = (datetime.now(timezone.utc) - datetime.fromisoformat(last)).total_seconds()
                        if idle > settings.WORKER_IDLE_TIMEOUT:
                            await stop_worker(sid)
                            await deregister(redis, sid)
                except Exception as exc:
                    log.error("cleanup error sid=%s: %s", sid, exc)
        except Exception as exc:
            log.error("cleanup loop: %s", exc)


async def _drain_loop() -> None:
    while True:
        await asyncio.sleep(5)
        try:
            redis = await get_redis()
            live = await count_live(redis)
            pending = await queue_length(redis)
            while live < settings.MAX_WORKERS and pending > 0:
                item = await dequeue(redis)
                if not item:
                    break
                try:
                    await _do_launch(redis, item["session_id"], item["scenario_id"])
                    live += 1; pending -= 1
                except Exception as exc:
                    log.error("drain launch failed: %s", exc)
        except Exception as exc:
            log.error("drain loop: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    t1 = asyncio.create_task(_cleanup_loop())
    t2 = asyncio.create_task(_drain_loop())
    yield
    t1.cancel(); t2.cancel()
    global _redis
    if _redis:
        await _redis.aclose(); _redis = None


app = FastAPI(title="Cyber-Rans Orchestrator", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class LaunchRequest(BaseModel):
    session_id:  str = Field(...)
    scenario_id: int = Field(...)


class LaunchResponse(BaseModel):
    session_id:    str
    container_id:  str
    worker_ws_url: str
    status:        str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "orchestrator"}


@app.get("/metrics")
async def metrics():
    redis = await get_redis()
    return {"live_workers": await count_live(redis), "max_workers": settings.MAX_WORKERS,
            "queued_launches": await queue_length(redis), "containers": await list_worker_containers()}


@app.post("/workers/launch", response_model=LaunchResponse, status_code=status.HTTP_201_CREATED)
async def launch_endpoint(body: LaunchRequest) -> LaunchResponse:
    redis = await get_redis()
    existing = await get_worker_url(redis, body.session_id)
    if existing and await container_running(body.session_id):
        cid = await get_container_id(redis, body.session_id) or "unknown"
        return LaunchResponse(session_id=body.session_id, container_id=cid, worker_ws_url=existing, status="running")
    live = await count_live(redis)
    if live >= settings.MAX_WORKERS:
        await enqueue(redis, {"session_id": body.session_id, "scenario_id": body.scenario_id})
        return LaunchResponse(session_id=body.session_id, container_id="", worker_ws_url="", status="queued")
    try:
        result = await _do_launch(redis, body.session_id, body.scenario_id)
    except docker.errors.ImageNotFound:
        raise HTTPException(status_code=500, detail=f"Worker image '{settings.WORKER_IMAGE}' not found")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to launch worker: {exc}")
    return LaunchResponse(**result)


@app.delete("/workers/{session_id}")
async def stop_endpoint(session_id: str):
    redis = await get_redis()
    stopped = await stop_worker(session_id)
    await deregister(redis, session_id)
    return {"session_id": session_id, "stopped": stopped}


@app.get("/workers/{session_id}")
async def worker_status(session_id: str):
    redis = await get_redis()
    return {"session_id": session_id, "container_id": await get_container_id(redis, session_id),
            "worker_ws_url": await get_worker_url(redis, session_id),
            "running": await container_running(session_id), "last_ping": await get_last_ping(redis, session_id)}


@app.get("/workers")
async def list_workers():
    redis = await get_redis()
    return {"live": await count_live(redis), "queued": await queue_length(redis),
            "containers": await list_worker_containers()}


@app.post("/workers/{session_id}/touch")
async def touch_worker(session_id: str):
    redis = await get_redis()
    await touch(redis, session_id)
    return {"session_id": session_id, "ok": True}
