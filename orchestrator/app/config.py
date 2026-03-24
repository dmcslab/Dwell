from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    WORKER_IMAGE: str = "dwell_scenario_worker:latest"
    DOCKER_NETWORK: str = "dwell_net"
    WORKER_PORT: int = 8765
    MAX_WORKERS: int = 50
    WORKER_IDLE_TIMEOUT: int = 3600
    CLEANUP_INTERVAL: int = 60
    WORKER_NANO_CPUS: int = 500_000_000
    WORKER_MEM_LIMIT: str = "128m"
    WORKER_DATABASE_URL: str = "postgresql+asyncpg://dwell:dwell@db:5432/dwell"
    WORKER_REDIS_URL: str = "redis://redis:6379/0"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
