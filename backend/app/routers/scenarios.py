"""Scenario CRUD endpoints (admin write, authenticated read)."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import get_current_active_user, require_admin
from app.database import get_db
from app.models.models import GameSession, Scenario, User
from app.schemas.schemas import MessageResponse, ScenarioCreate, ScenarioOut, ScenarioOutFull, ScenarioUpdate

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.get("", response_model=list[ScenarioOut])
async def list_scenarios(
    difficulty: str | None = Query(None, pattern="^(easy|medium|hard)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_active_user),
) -> list[ScenarioOut]:
    q = select(Scenario).offset(skip).limit(limit).order_by(Scenario.id)
    if difficulty:
        q = q.where(Scenario.difficulty_level == difficulty)
    result = await db.execute(q)
    return [ScenarioOut.model_validate(s) for s in result.scalars().all()]


@router.get("/{scenario_id}", response_model=ScenarioOutFull)
async def get_scenario(scenario_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)) -> ScenarioOutFull:
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    if not current_user.is_admin:
        sr = await db.execute(select(GameSession).where(GameSession.scenario_id == scenario_id, GameSession.is_active == True))  # noqa
        if not sr.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active session for this scenario")
    return ScenarioOutFull.model_validate(scenario)


@router.post("", response_model=ScenarioOutFull, status_code=status.HTTP_201_CREATED)
async def create_scenario(body: ScenarioCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)) -> ScenarioOutFull:
    structure = body.scenario_structure.model_dump() if hasattr(body.scenario_structure, "model_dump") else body.scenario_structure
    s = Scenario(name=body.name, description=body.description, initial_prompt=body.initial_prompt, difficulty_level=body.difficulty_level, max_attempts=body.max_attempts, scenario_structure=structure, created_by=admin.id)
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return ScenarioOutFull.model_validate(s)


@router.put("/{scenario_id}", response_model=ScenarioOutFull)
async def update_scenario(scenario_id: int, body: ScenarioCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)) -> ScenarioOutFull:
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    structure = body.scenario_structure.model_dump() if hasattr(body.scenario_structure, "model_dump") else body.scenario_structure
    s.name = body.name; s.description = body.description; s.initial_prompt = body.initial_prompt
    s.difficulty_level = body.difficulty_level; s.max_attempts = body.max_attempts; s.scenario_structure = structure
    await db.flush(); await db.refresh(s)
    return ScenarioOutFull.model_validate(s)


@router.patch("/{scenario_id}", response_model=ScenarioOutFull)
async def patch_scenario(scenario_id: int, body: ScenarioUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)) -> ScenarioOutFull:
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "scenario_structure" and hasattr(value, "model_dump"):
            value = value.model_dump()
        setattr(s, field, value)
    await db.flush(); await db.refresh(s)
    return ScenarioOutFull.model_validate(s)


@router.delete("/{scenario_id}", response_model=MessageResponse)
async def delete_scenario(scenario_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)) -> MessageResponse:
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    count_result = await db.execute(select(func.count()).where(GameSession.scenario_id == scenario_id, GameSession.is_active == True))  # noqa
    if count_result.scalar_one() > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot delete: active sessions exist")
    await db.delete(s)
    return MessageResponse(message=f"Scenario '{s.name}' deleted")
