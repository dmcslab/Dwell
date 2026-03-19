"""In-process WebSocket connection registry."""
from __future__ import annotations
import json
from typing import Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, WebSocket]] = {}

    def connect(self, session_id: str, client_id: str, ws: WebSocket) -> None:
        self._sessions.setdefault(session_id, {})[client_id] = ws

    def disconnect(self, session_id: str, client_id: str) -> None:
        if session_id in self._sessions:
            self._sessions[session_id].pop(client_id, None)
            if not self._sessions[session_id]:
                del self._sessions[session_id]

    def client_ids(self, session_id: str) -> list[str]:
        return list(self._sessions.get(session_id, {}).keys())

    async def send_personal(self, session_id: str, client_id: str, data: dict[str, Any]) -> None:
        ws = self._sessions.get(session_id, {}).get(client_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                pass

    async def broadcast(self, session_id: str, data: dict[str, Any], exclude_client: str | None = None) -> None:
        for cid, ws in list(self._sessions.get(session_id, {}).items()):
            if cid == exclude_client:
                continue
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                pass

    async def broadcast_all(self, session_id: str, data: dict[str, Any]) -> None:
        await self.broadcast(session_id, data)

    async def broadcast_presence(self, session_id: str, online_ids: list[str]) -> None:
        await self.broadcast_all(session_id, {"type": "presence_update", "online_client_ids": online_ids})


manager = ConnectionManager()
