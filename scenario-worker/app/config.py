from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    SESSION_ID:  str = ""
    SCENARIO_ID: int = 0
    DATABASE_URL: str = "postgresql+asyncpg://dwell:dwell@db:5432/dwell"
    REDIS_URL:    str = "redis://redis:6379/0"
    WORKER_PORT:  int = 8765
    STARTUP_TIMEOUT: int = 30
    model_config = SettingsConfigDict(extra="ignore")


settings = WorkerSettings()
