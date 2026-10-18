# =============================================================================
# Application Settings — Pydantic Settings
# =============================================================================

from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEV_SECRET_KEY = "dev-insecure-secret-change-me-before-deploying"


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
    db_echo: bool = False

    # Media (user uploads, served at /media)
    media_root: str = "media"
    max_avatar_bytes: int = 2 * 1024 * 1024

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    # API
    api_v1_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    frontend_url: str = "http://localhost:8081"

    # Auth
    secret_key: str = DEV_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    refresh_token_session_ttl_hours: int = 24
    refresh_reuse_grace_seconds: int = 30
    password_reset_ttl_minutes: int = 30
    cookie_secure: bool = False
    link_code_ttl_hours: int = 48
    rate_limit_enabled: bool = True

    # Email
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False
    email_from: str = "LEEN AI <no-reply@leen.ai>"

    # AI whiteboard tutor (Claude Code bridge on the host, see infrastructure/claude-bridge)
    llm_provider: str = "claude_bridge"
    claude_bridge_url: str = "http://host.docker.internal:8765"
    claude_bridge_token: str = "dev-bridge-token"
    whiteboard_model: str = "sonnet"
    whiteboard_effort: str = "low"
    whiteboard_timeout_seconds: int = 180
    whiteboard_max_actions: int = 150
    # Serve an identical doubt (same question and student profile) from an earlier board.
    board_cache_enabled: bool = True

    # Narration: neural text-to-speech (Microsoft Edge voices via edge-tts; needs internet)
    tts_enabled: bool = True
    tts_cache_ttl_seconds: int = 7 * 24 * 3600

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def _require_production_secrets(self):
        if self.app_env == "production":
            if self.secret_key == DEV_SECRET_KEY or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be set to a random value of 32+ characters")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
        return self

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def auth_cookie_path(self) -> str:
        return f"{self.api_v1_prefix}/auth"


settings = Settings()
