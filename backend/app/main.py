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
    title="Dwell",
    description="Cybersecurity IR Training Platform — scenario-based analyst simulations",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: support wildcard "*" for open deployments or specific URLs
_raw = settings.ALLOWED_ORIGINS.strip()
if _raw == "*":
    _cors_origins = ["*"]
    _cors_creds   = False  # credentials can't be used with wildcard
else:
    _origins = [o.strip() for o in _raw.split(",") if o.strip()]
    _all: list[str] = []
    for o in _origins:
        _all.append(o)
        if o.startswith("http://"):
            _all.append(o.replace("http://", "https://", 1))
        elif o.startswith("https://"):
            _all.append(o.replace("https://", "http://", 1))
    _cors_origins = _all
    _cors_creds   = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_creds,
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
