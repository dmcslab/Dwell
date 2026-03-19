"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_active_user
from app.auth.jwt import consume_refresh_token, create_access_token, generate_refresh_token, revoke_refresh_token, store_refresh_token
from app.database import get_db, get_redis
from app.models.models import User
from app.schemas.schemas import MessageResponse, RefreshRequest, TokenResponse, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash(p: str) -> str:
    return _pwd.hash(p)


def _verify(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def _tokens(user: User) -> tuple[str, str]:
    return create_access_token(user.id, user.is_admin), generate_refresh_token()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)) -> TokenResponse:
    user = User(username=body.username, email=body.email, hashed_password=_hash(body.password), is_admin=False)
    db.add(user)
    try:
        await db.flush()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already registered")
    access, refresh = _tokens(user)
    await store_refresh_token(redis, refresh, user.id)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)) -> TokenResponse:
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not _verify(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    access, refresh = _tokens(user)
    await store_refresh_token(redis, refresh, user.id)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest, db: AsyncSession = Depends(get_db), redis: Redis = Depends(get_redis)) -> TokenResponse:
    user_id = await consume_refresh_token(redis, body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    access, new_refresh = _tokens(user)
    await store_refresh_token(redis, new_refresh, user.id)
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", response_model=MessageResponse)
async def logout(body: RefreshRequest, redis: Redis = Depends(get_redis)) -> MessageResponse:
    await revoke_refresh_token(redis, body.refresh_token)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_active_user)) -> UserOut:
    return UserOut.model_validate(user)
