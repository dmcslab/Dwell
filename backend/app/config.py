import logging
import secrets as _secrets
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger(__name__)

_SENTINEL = "CHANGE_ME_IN_PRODUCTION_USE_SECRETS_TOKEN_HEX_32"


class Settings(BaseSettings):
    DATABASE_URL: str      = "postgresql+asyncpg://dwell:dwell@db:5432/dwell"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://dwell:dwell@db:5432/dwell"
    REDIS_URL: str         = "redis://redis:6379/0"
    SECRET_KEY: str        = _SENTINEL
    ALGORITHM: str         = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int   = 7
    APP_ENV: str           = "development"
    SESSION_SAVE_TTL: int  = 86_400
    # Share links are derived from the request Origin header at runtime,
    # so this is only a fallback and never needs manual configuration.
    APP_BASE_URL: str      = "http://localhost:5173"
    # "*" allows all origins — safe because the Vite proxy is the only
    # public-facing port and it forwards /api/* internally.
    ALLOWED_ORIGINS: str   = "*"
    ORCHESTRATOR_URL: str  = "http://orchestrator:9000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def effective_secret_key(self) -> str:
        """Return the stable module-level signing key.

        Why not cached_property?
        Pydantic v2 BaseSettings models are frozen (model_config forbids
        arbitrary attribute assignment).  cached_property works by writing its
        result into the instance __dict__ on first access — which Pydantic
        silently blocks.  The consequence is that every call to
        settings.effective_secret_key re-runs the property body and, when
        SECRET_KEY is the sentinel, generates a *new* random secret each time.
        That makes every JWT immediately invalid after the first one is issued.

        The fix: compute the key exactly once at module load into the
        module-level constant _RESOLVED_SECRET_KEY and delegate to it here.
        """
        return _RESOLVED_SECRET_KEY

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()

# ── Compute the signing key exactly once, at import time ─────────────────────
# All calls to settings.effective_secret_key in this process return this same
# value, guaranteeing JWT encode and decode always use an identical key.
def _resolve_secret_key() -> str:
    raw = settings.SECRET_KEY
    if raw == _SENTINEL or not raw.strip():
        key = _secrets.token_hex(32)
        log.warning(
            "SECRET_KEY is set to the default placeholder. "
            "A random key has been generated for this process — all sessions "
            "will be invalidated on restart. "
            "Set a permanent SECRET_KEY in backend/.env to avoid this."
        )
        return key
    return raw


_RESOLVED_SECRET_KEY: str = _resolve_secret_key()
