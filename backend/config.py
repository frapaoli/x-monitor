from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://xmonitor:xmonitor@localhost:5432/xmonitor"
    openrouter_api_key: str = ""
    polling_interval_minutes: int = 30
    twscrape_accounts: str = ""
    llm_model: str = "anthropic/claude-sonnet-4-20250514"
    replies_per_post: int = 10
    media_dir: str = "/app/data/media"
    static_dir: str = "/app/static"

    class Config:
        env_file = ".env"


settings = Settings()
