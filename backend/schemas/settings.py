from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    openrouter_model: str | None = None
    system_prompt: str | None = None
    openrouter_api_key: str | None = None
    x_api_key: str | None = None


class SettingsResponse(BaseModel):
    openrouter_model: str
    system_prompt: str
    openrouter_api_key: str = ""
    x_api_key: str = ""
