from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.settings import AppSetting
from schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter()

DEFAULT_SETTINGS = {
    "openrouter_model": "anthropic/claude-sonnet-4-20250514",
    "system_prompt": "You are a knowledgeable and engaging social media user. Generate reply suggestions that are thoughtful, concise, and varied in tone.",
    "replies_per_post": 10,
    "openrouter_api_key": "",
    "x_api_key": "",
}


async def _get_all_settings(db: AsyncSession) -> dict:
    result = await db.execute(select(AppSetting))
    settings_rows = result.scalars().all()
    settings_dict = dict(DEFAULT_SETTINGS)
    for row in settings_rows:
        settings_dict[row.key] = row.value
    return settings_dict


@router.get("", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db)):
    s = await _get_all_settings(db)
    return SettingsResponse(
        openrouter_model=str(s["openrouter_model"]),
        system_prompt=str(s["system_prompt"]),
        replies_per_post=int(s["replies_per_post"]),
        openrouter_api_key=_mask_key(str(s.get("openrouter_api_key", ""))),
        x_api_key=_mask_key(str(s.get("x_api_key", ""))),
    )


@router.put("", response_model=SettingsResponse)
async def update_settings(data: SettingsUpdate, db: AsyncSession = Depends(get_db)):
    updates = data.model_dump(exclude_none=True)
    for key, value in updates.items():
        result = await db.execute(select(AppSetting).where(AppSetting.key == key))
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = value
        else:
            db.add(AppSetting(key=key, value=value))

    await db.flush()

    # Update LLM service API key if changed
    if data.openrouter_api_key is not None:
        from app_state import app_state
        llm_service = app_state.get("llm_service")
        if llm_service:
            llm_service.api_key = data.openrouter_api_key

    # Update X API key at runtime if changed
    if data.x_api_key is not None:
        from app_state import app_state
        x_api_client = app_state.get("x_api_client")
        if x_api_client:
            x_api_client.api_key = data.x_api_key

    s = await _get_all_settings(db)
    return SettingsResponse(
        openrouter_model=str(s["openrouter_model"]),
        system_prompt=str(s["system_prompt"]),
        replies_per_post=int(s["replies_per_post"]),
        openrouter_api_key=_mask_key(str(s.get("openrouter_api_key", ""))),
        x_api_key=_mask_key(str(s.get("x_api_key", ""))),
    )


def _mask_key(key: str) -> str:
    if not key or len(key) < 10:
        return "***" if key else ""
    return key[:8] + "..." + key[-4:]
