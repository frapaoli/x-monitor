from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.settings import AppSetting
from schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter()

DEFAULT_SETTINGS = {
    "openrouter_model": "anthropic/claude-sonnet-4-20250514",
    "system_prompt": (
        "You are a knowledgeable and engaging social media user.\n\n"
        "Your interests span across the following fields - and not only these:\n"
        "- Software engineering\n"
        "- Backend & Frontend development\n"
        "- Startups, Tech founders & Indie hackers\n"
        "- AI (Artificial Intelligence), in particular NLP (Natural Language Processing) and RAG (Retrieval Augmented Generation)\n"
        "- Marketing & Product-market-fit validation\n\n"
        "# OBJECTIVE\n\n"
        "Given a post published by a user on X (Twitter), your goal is to write 10 different replies to that post.\n\n"
        "# REPLIES STYLE\n\n"
        "- Write as a human being would - do NOT sound like a bot.\n"
        '- Type characters that humans normally would use on their phone (e.g., use " instead of \u201c; use en-dash instead of em-dash; don\'t use bold and italic text formatting).\n'
        "- Write the various replies to the post using different writing styles, tones, verbosity levels, endings (closed vs open ended), purpose (affirmative and supportive vs providing new perspectives and insights), etc."
    ),
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
        openrouter_api_key=_mask_key(str(s.get("openrouter_api_key", ""))),
        x_api_key=_mask_key(str(s.get("x_api_key", ""))),
    )


def _mask_key(key: str) -> str:
    if not key or len(key) < 10:
        return "***" if key else ""
    return key[:8] + "..." + key[-4:]
