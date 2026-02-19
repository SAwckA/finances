from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения из переменных окружения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    debug: bool = False
    sqlalchemy_echo: bool = False
    secret_key: str = "change-me-in-production"

    postgres_user: str = "finances"
    postgres_password: str = "finances_secret"
    postgres_db: str = "finances"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    frontend_base_url: str = "http://localhost:3000"
    cors_allow_origins: str = "http://localhost:3000,http://192.168.1.135:3000"
    google_oauth_state_expire_seconds: int = 600
    auth_exchange_code_ttl_seconds: int = 90
    exchange_rate_job_timezone: str = "UTC"
    exchange_http_timeout_seconds: int = 15
    ecb_hist_rates_url: str = (
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml"
    )
    cbr_dailyinfo_base_url: str = "https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx"

    @property
    def database_url(self) -> str:
        """URL для подключения к PostgreSQL через asyncpg."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins(self) -> list[str]:
        """Список разрешенных origins для CORS."""
        return [
            origin.strip()
            for origin in self.cors_allow_origins.split(",")
            if origin.strip()
        ]


settings = Settings()
