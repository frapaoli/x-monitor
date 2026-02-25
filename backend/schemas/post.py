import uuid
from datetime import datetime

from pydantic import BaseModel

from schemas.reply import ReplyResponse


class PostResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    batch_id: uuid.UUID | None = None
    account_username: str = ""
    account_display_name: str | None = None
    account_profile_image_url: str | None = None
    external_post_id: str
    post_url: str
    text_content: str | None
    has_media: bool
    media_urls: list[str] | None
    media_local_paths: list[str] | None
    post_type: str
    posted_at: datetime
    scraped_at: datetime
    llm_status: str
    replies: list[ReplyResponse] = []

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    posts: list[PostResponse]
    total: int
    page: int
    per_page: int
