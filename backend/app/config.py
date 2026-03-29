from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "MindLift API"
    environment: str = "development"
    debug: bool = False

    # Database
    database_url: str = (
        "postgresql+asyncpg://mindlift:mindlift_secret@localhost:5432/mindlift_db"
    )

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    # JWT
    secret_key: str = "insecure-dev-secret-change-in-production-min-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # Email (placeholder — wire to a real provider in production)
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    emails_from_email: str = "noreply@mindlift.app"

    # App URLs (used in emails and deep links)
    app_base_url: str = "http://localhost:8081"
    dashboard_base_url: str = "http://localhost:3000"

    # AWS
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = "mindlift-exports"

    # Push notifications — APNs (iOS)
    apns_key_id: str = ""  # 10-char Key ID from Apple Developer portal
    apns_team_id: str = ""  # 10-char Team ID
    apns_bundle_id: str = "app.mindlift"
    apns_auth_key_pem: str = ""  # Contents of the .p8 private key file (ES256)
    apns_use_sandbox: bool = True  # False in production

    # Push notifications — FCM (Android)
    fcm_server_key: str = ""  # Firebase Cloud Messaging server key

    # AI chat
    anthropic_api_key: str = ""  # Set ANTHROPIC_API_KEY in env

    # CORS
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:8081"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
