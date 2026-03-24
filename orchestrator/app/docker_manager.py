"""docker-py wrapper for scenario-worker container lifecycle."""
from __future__ import annotations
import asyncio
import logging
from functools import lru_cache
import docker
import docker.errors
from docker.models.containers import Container
from app.config import settings

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _client() -> docker.DockerClient:
    return docker.from_env()


def container_name(session_id: str) -> str:
    return f"dwell_worker_{session_id[:12]}"


def worker_ws_url(session_id: str) -> str:
    return f"ws://{container_name(session_id)}:{settings.WORKER_PORT}/ws/game"


async def launch_worker(session_id: str, scenario_id: int) -> str:
    loop = asyncio.get_event_loop()
    container: Container = await loop.run_in_executor(None, _run_container, session_id, scenario_id)
    short_id = container.id[:12]
    log.info("launched worker session=%s container=%s", session_id, short_id)
    return short_id


def _run_container(session_id: str, scenario_id: int) -> Container:
    return _client().containers.run(
        image=settings.WORKER_IMAGE,
        name=container_name(session_id),
        detach=True,
        remove=True,
        network=settings.DOCKER_NETWORK,
        environment={
            "SESSION_ID":   session_id,
            "SCENARIO_ID":  str(scenario_id),
            "DATABASE_URL": settings.WORKER_DATABASE_URL,
            "REDIS_URL":    settings.WORKER_REDIS_URL,
            "WORKER_PORT":  str(settings.WORKER_PORT),
        },
        nano_cpus=settings.WORKER_NANO_CPUS,
        mem_limit=settings.WORKER_MEM_LIMIT,
        labels={"dwell.role": "worker", "dwell.session_id": session_id},
    )


async def stop_worker(session_id: str, *, timeout: int = 5) -> bool:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _stop_container, container_name(session_id), timeout)


def _stop_container(name: str, timeout: int) -> bool:
    try:
        _client().containers.get(name).stop(timeout=timeout)
        return True
    except docker.errors.NotFound:
        return False
    except Exception as exc:
        log.error("stop error name=%s: %s", name, exc)
        return False


async def container_running(session_id: str) -> bool:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _is_running, container_name(session_id))


def _is_running(name: str) -> bool:
    try:
        return _client().containers.get(name).status in ("running", "starting")
    except docker.errors.NotFound:
        return False


async def list_worker_containers() -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _list_workers)


def _list_workers() -> list[dict]:
    try:
        containers = _client().containers.list(filters={"label": "dwell.role=worker"})
        return [{"container_id": c.id[:12], "name": c.name, "status": c.status,
                 "session_id": c.labels.get("dwell.session_id", "unknown")} for c in containers]
    except Exception as exc:
        log.error("list_workers error: %s", exc)
        return []


async def wait_for_worker_ready(session_id: str, *, timeout: float = 20.0, poll_interval: float = 0.5) -> bool:
    import httpx
    url = f"http://{container_name(session_id)}:{settings.WORKER_PORT}/health"
    deadline = asyncio.get_event_loop().time() + timeout
    async with httpx.AsyncClient(timeout=2.0) as client:
        while asyncio.get_event_loop().time() < deadline:
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    return True
            except Exception:
                pass
            await asyncio.sleep(poll_interval)
    log.warning("worker not ready in %.1fs session=%s", timeout, session_id)
    return False
