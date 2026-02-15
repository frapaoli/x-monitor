import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.reply import GeneratedReply
from schemas.reply import ReplyResponse, ReplyUpdate

router = APIRouter()


@router.patch("/{reply_id}", response_model=ReplyResponse)
async def update_reply(
    reply_id: uuid.UUID,
    data: ReplyUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GeneratedReply).where(GeneratedReply.id == reply_id))
    reply = result.scalar_one_or_none()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    if data.is_favorite is not None:
        reply.is_favorite = data.is_favorite
    if data.was_used is not None:
        reply.was_used = data.was_used

    await db.flush()
    return ReplyResponse(
        id=reply.id,
        post_id=reply.post_id,
        reply_text=reply.reply_text,
        reply_index=reply.reply_index,
        model_used=reply.model_used,
        is_favorite=reply.is_favorite,
        was_used=reply.was_used,
        generated_at=reply.generated_at,
    )
