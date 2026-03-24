import secrets as _secrets
from functools import cached_property
from pydantic_settings import BaseSettings, SettingsConfigDict

_SENTINEL = "CHANGE_ME_IN_PRODUCTION_USE_SECRETS_TOKEN_HEX_32"


def _auto_secret() -> str:
    """Return a secure random key — used when .env still has the placeholder."""
    return _secrets.token_hex(32)


class Settings(BaseSettings):
    DATABASE_URL: str      = "postgresql+asyncpg://dwell:dwell@db:5432/dwell"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://dwell:dwell@db:5432/dwell"
    REDIS_URL: str         = "redis://redis:6379/0"
    REDIS_PASSWORD: str    = ""          # optional — leave empty to disable auth
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

    @cached_property
    def effective_secret_key(self) -> str:
        """Return a stable signing key for the lifetime of this process.

        cached_property stores the result in the instance __dict__ on first
        access, so _auto_secret() is called exactly once — not once per
        jwt.encode / jwt.decode call.  Without caching, every call would
        produce a different random key, making all JWTs immediately invalid.
        """
        if self.SECRET_KEY == _SENTINEL or not self.SECRET_KEY.strip():
            return _auto_secret()
        return self.SECRET_KEY

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
