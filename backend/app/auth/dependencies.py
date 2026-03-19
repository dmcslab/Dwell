"""FastAPI injectable auth dependencies."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth.jwt import decode_access_token
from app.database import get_db
from app.models.models import User

_bearer = HTTPBearer(auto_error=False)
_401 = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
_403_inactive = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive account")
_403_admin = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer), db: AsyncSession = Depends(get_db)) -> User:
    if not credentials:
        raise _401
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _401
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise _401
    return user


async def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_active:
        raise _403_inactive
    return user


async def require_admin(user: User = Depends(get_current_active_user)) -> User:
    if not user.is_admin:
        raise _403_admin
    return user


async def require_player(user: User = Depends(get_current_active_user)) -> User:
    return user
