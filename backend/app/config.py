from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://cyber:cyber@db:5432/cyberrans"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://cyber:cyber@db:5432/cyberrans"
    REDIS_URL: str = "redis://redis:6379/0"
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    APP_ENV: str = "development"
    SESSION_SAVE_TTL: int = 86_400
    APP_BASE_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173"
    ORCHESTRATOR_URL: str = "http://orchestrator:9000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()
