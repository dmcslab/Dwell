"""Pydantic v2 schemas."""
from __future__ import annotations
from datetime import datetime
from typing import Any
from pydantic import BaseModel, EmailStr, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    username: str
    email: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str


# ── Scenario ──────────────────────────────────────────────────────────────────

class ScenarioCreate(BaseModel):
    name: str = Field(max_length=200)
    description: str = ""
    initial_prompt: str
    difficulty_level: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    max_attempts: int = Field(default=3, ge=1, le=10)
    scenario_structure: dict[str, Any] | Any = {}


class ScenarioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    initial_prompt: str | None = None
    difficulty_level: str | None = None
    max_attempts: int | None = None
    scenario_structure: dict[str, Any] | None = None


class ScenarioOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    description: str
    difficulty_level: str
    max_attempts: int
    created_at: datetime


class ScenarioOutFull(ScenarioOut):
    initial_prompt: str
    scenario_structure: dict[str, Any]


# ── Game Session ──────────────────────────────────────────────────────────────

class GameSessionOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    session_id: str
    scenario_id: int
    team_name: str | None
    current_state: dict[str, Any]
    attempts_remaining: int
    is_active: bool
    participants: list[Any]
    saved_at: datetime | None
    created_at: datetime
