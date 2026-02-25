import uuid
from datetime import datetime

from pydantic import BaseModel

from schemas.reply import ReplyResponse


class PostUpdate(BaseModel):
    is_read: bool | None = None
    is_archived: bool | None = None


class PostResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
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
    is_read: bool
    is_archived: bool
    llm_status: str
    replies: list[ReplyResponse] = []

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    posts: list[PostResponse]
    total: int
    page: int
    per_page: int


class BulkPostUpdate(BaseModel):
    post_ids: list[uuid.UUID]
    is_read: bool | None = None
    is_archived: bool | None = None


class BulkPostUpdateResponse(BaseModel):
    updated_count: int


class UnreadCountResponse(BaseModel):
    count: int
