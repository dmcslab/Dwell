"""JWT access tokens + opaque refresh tokens stored in Redis."""
from __future__ import annotations
import secrets
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from redis.asyncio import Redis
from app.config import settings

_RT_PREFIX = "refresh:"
_RT_TTL = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86_400


def create_access_token(user_id: int, is_admin: bool) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": "admin" if is_admin else "player", "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(64)


async def store_refresh_token(redis: Redis, token: str, user_id: int) -> None:
    await redis.setex(f"{_RT_PREFIX}{token}", _RT_TTL, str(user_id))


async def consume_refresh_token(redis: Redis, token: str) -> int | None:
    key = f"{_RT_PREFIX}{token}"
    val = await redis.getdel(key)
    return int(val) if val else None


async def revoke_refresh_token(redis: Redis, token: str) -> None:
    await redis.delete(f"{_RT_PREFIX}{token}")
