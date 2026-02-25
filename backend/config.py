from pathlib import Path
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings

# Look for .env in project root (parent of backend/)
_env_file = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # DB components — password gets URL-encoded automatically
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "xmonitor"
    db_user: str = "xmonitor"
    db_password: str = "xmonitor"

    # Constructed from components (or can be overridden explicitly)
    database_url: str = ""

    openrouter_api_key: str = ""
    x_api_key: str = ""
    llm_model: str = "anthropic/claude-sonnet-4-20250514"
    replies_per_post: int = 10
    media_dir: str = "/app/data/media"
    static_dir: str = "/app/static"

    @model_validator(mode="after")
    def build_database_url(self):
        if not self.database_url:
            encoded_pw = quote_plus(self.db_password)
            self.database_url = (
                f"postgresql+asyncpg://{self.db_user}:{encoded_pw}"
                f"@{self.db_host}:{self.db_port}/{self.db_name}"
            )
        return self

    class Config:
        env_file = str(_env_file) if _env_file.exists() else ".env"
        extra = "ignore"


settings = Settings()
