import uuid
from datetime import datetime

from pydantic import BaseModel


class ReplyUpdate(BaseModel):
    is_favorite: bool | None = None
    was_used: bool | None = None


class ReplyResponse(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    reply_text: str
    reply_index: int
    model_used: str
    is_favorite: bool
    was_used: bool
    generated_at: datetime

    model_config = {"from_attributes": True}
