"""FastAPI application factory."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import close_redis
from app.routers.auth import router as auth_router
from app.routers.scenarios import router as scenarios_router
from app.routers.game import router as game_router
from app.routers.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


app = FastAPI(
    title="Cyber-Rans",
    description="Cybersecurity IR Training Platform — scenario-based analyst simulations",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,      prefix="/api/v1")
app.include_router(scenarios_router, prefix="/api/v1")
app.include_router(game_router,      prefix="/api/v1")
app.include_router(admin_router,     prefix="/api/v1")


@app.get("/health", tags=["infra"])
async def health():
    return {"status": "ok"}
