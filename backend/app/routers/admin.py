"""
Admin dashboard API — requires admin role on all endpoints.

Tabs served:
  GET  /admin/sessions          — live active sessions from Redis
  GET  /admin/stats             — platform stats from DB
  GET  /admin/users             — list all users
  PUT  /admin/users/{id}        — update user (is_admin, is_active)
  DELETE /admin/users/{id}      — delete user (cannot delete self)
  PUT  /admin/users/{id}/password — reset password (admin sets new one)
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_admin
from app.database import get_db, get_redis
from app.game.redis_state import list_active_sessions
from app.models.models import GameSession, Scenario, User

router = APIRouter(prefix="/admin", tags=["admin"])
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class UserUpdate(BaseModel):
    is_admin:  bool | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8)


class UserOut(BaseModel):
    model_config = {"from_attributes": True}
    id:         int
    username:   str
    email:      str
    is_admin:   bool
    is_active:  bool
    created_at: datetime


# ── Live sessions ─────────────────────────────────────────────────────────────

@router.get("/sessions")
async def get_active_sessions(
    _: User = Depends(require_admin),
) -> list[dict[str, Any]]:
    """Return all sessions currently alive in Redis."""
    redis = await get_redis()
    sessions = await list_active_sessions(redis)
    return sessions


# ── Platform stats ────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    db:  AsyncSession = Depends(get_db),
    _:   User         = Depends(require_admin),
) -> dict[str, Any]:
    """Aggregate platform statistics."""

    # Total sessions
    total_sessions = (await db.execute(
        select(func.count()).select_from(GameSession)
    )).scalar_one()

    # Completed vs failed
    completed = (await db.execute(
        select(func.count()).select_from(GameSession)
        .where(GameSession.current_state["outcome"].astext == "complete")
    )).scalar_one()

    failed = (await db.execute(
        select(func.count()).select_from(GameSession)
        .where(GameSession.current_state["outcome"].astext == "failed")
    )).scalar_one()

    # Sessions per difficulty
    diff_rows = (await db.execute(
        select(Scenario.difficulty_level, func.count(GameSession.id))
        .join(GameSession, GameSession.scenario_id == Scenario.id)
        .group_by(Scenario.difficulty_level)
    )).all()
    sessions_by_difficulty = {row[0]: row[1] for row in diff_rows}

    # Top scenarios by play count
    top_scenarios = (await db.execute(
        select(Scenario.name, Scenario.difficulty_level, func.count(GameSession.id).label("plays"))
        .join(GameSession, GameSession.scenario_id == Scenario.id)
        .group_by(Scenario.id, Scenario.name, Scenario.difficulty_level)
        .order_by(func.count(GameSession.id).desc())
        .limit(10)
    )).all()

    # Most-failed stages — extracted from JSONB decision_history
    # Each decision_history entry: [{stage_id, is_correct, ...}, ...]
    # We query sessions where outcome = failed, pull the last wrong stage
    failed_sessions = (await db.execute(
        select(GameSession.current_state)
        .where(GameSession.current_state["outcome"].astext == "failed")
        .limit(500)
    )).scalars().all()

    stage_fail_counts: dict[str, int] = {}
    for state in failed_sessions:
        if not isinstance(state, dict):
            continue
        history = state.get("decision_history", [])
        for record in history:
            if not record.get("is_correct", True):
                sid = record.get("stage_id", "unknown")
                stage_fail_counts[sid] = stage_fail_counts.get(sid, 0) + 1

    most_failed = sorted(stage_fail_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # Total users
    total_users = (await db.execute(
        select(func.count()).select_from(User)
    )).scalar_one()

    # Total scenarios
    total_scenarios = (await db.execute(
        select(func.count()).select_from(Scenario)
    )).scalar_one()

    completion_rate = round((completed / total_sessions * 100), 1) if total_sessions > 0 else 0.0

    return {
        "sessions": {
            "total":            total_sessions,
            "completed":        completed,
            "failed":           failed,
            "in_progress":      max(0, total_sessions - completed - failed),
            "completion_rate":  completion_rate,
        },
        "by_difficulty":   sessions_by_difficulty,
        "top_scenarios":   [{"name": r[0], "difficulty": r[1], "plays": r[2]} for r in top_scenarios],
        "most_failed_stages": [{"stage_id": s, "fail_count": c} for s, c in most_failed],
        "totals": {
            "users":     total_users,
            "scenarios": total_scenarios,
        },
    }


# ── User management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _:  User         = Depends(require_admin),
) -> list[UserOut]:
    result = await db.execute(select(User).order_by(User.id))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db:  AsyncSession = Depends(get_db),
    _:   User         = Depends(require_admin),
) -> UserOut:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    body:    UserUpdate,
    db:      AsyncSession = Depends(get_db),
    admin:   User         = Depends(require_admin),
) -> UserOut:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent admin from demoting themselves
    if user.id == admin.id and body.is_admin is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin privileges",
        )

    if body.is_admin  is not None: user.is_admin  = body.is_admin
    if body.is_active is not None: user.is_active = body.is_active
    await db.flush()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/users/{user_id}/password")
async def reset_user_password(
    user_id: int,
    body:    PasswordReset,
    db:      AsyncSession = Depends(get_db),
    _:       User         = Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = _pwd.hash(body.new_password)
    await db.flush()
    return {"message": f"Password reset for user '{user.username}'"}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db:      AsyncSession = Depends(get_db),
    admin:   User         = Depends(require_admin),
) -> dict[str, str]:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    username = user.username
    await db.delete(user)
    return {"message": f"User '{username}' deleted"}


# ── Create user ───────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email:    str = Field(min_length=3)
    password: str = Field(min_length=8)
    is_admin: bool = False


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    body:  UserCreate,
    db:    AsyncSession = Depends(get_db),
    _:     User         = Depends(require_admin),
) -> UserOut:
    """Create a new user account from the admin dashboard."""
    from sqlalchemy.exc import IntegrityError
    existing = (await db.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already in use")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=_pwd.hash(body.password),
        is_admin=body.is_admin,
        is_active=True,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Username or email already in use")
    await db.refresh(user)
    return UserOut.model_validate(user)


# ── Reset all stats ───────────────────────────────────────────────────────────

@router.post("/reset-stats")
async def reset_all_stats(
    db:    AsyncSession = Depends(get_db),
    admin: User         = Depends(require_admin),
) -> dict[str, str]:
    """
    Wipe all game session records from the DB and flush all active sessions
    from Redis. Scenarios and user accounts are NOT affected.
    """
    redis = await get_redis()

    # Delete all game sessions from DB
    await db.execute(text("DELETE FROM game_sessions"))

    # Flush active-session keys from Redis (scan for our prefix)
    cursor = 0
    deleted = 0
    while True:
        cursor, keys = await redis.scan(cursor, match="session:*", count=200)
        if keys:
            await redis.delete(*keys)
            deleted += len(keys)
        # Also clear the active-sessions index set
        cursor2, idx_keys = await redis.scan(0, match="active_sessions*", count=50)
        if idx_keys:
            await redis.delete(*idx_keys)
        if cursor == 0:
            break

    return {
        "message": f"All game sessions deleted. {deleted} Redis keys cleared.",
        "reset_by": admin.username,
    }
