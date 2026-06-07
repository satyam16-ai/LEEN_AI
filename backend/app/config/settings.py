# =============================================================================
# Application Settings — Pydantic Settings
# =============================================================================

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "AI Personal Teacher System"
    app_env: str = "development"
    app_port: int = 8000
    debug: bool = False

    # Database
    database_url: str = "postgresql://leen:leen_dev_password@localhost:5432/leen_ai"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    # API
    api_v1_prefix: str = "/api/v1"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


settings = Settings()
