from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    polling_interval_minutes: int | None = None
    openrouter_model: str | None = None
    system_prompt: str | None = None
    replies_per_post: int | None = None
    openrouter_api_key: str | None = None
    x_api_key: str | None = None


class SettingsResponse(BaseModel):
    polling_interval_minutes: int
    openrouter_model: str
    system_prompt: str
    replies_per_post: int
    openrouter_api_key: str = ""
    x_api_key: str = ""


class ScraperStatusResponse(BaseModel):
    is_running: bool
    last_run_at: str | None
    last_run_duration_seconds: float | None
    accounts_checked: int | None
    posts_found: int | None
    next_run_at: str | None
    status_message: str | None = None
