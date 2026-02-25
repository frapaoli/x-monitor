import uuid
from datetime import datetime

from pydantic import BaseModel

from schemas.post import PostResponse


class RetrievalCreate(BaseModel):
    account_ids: list[uuid.UUID]
    since_dt: datetime | None = None
    until_dt: datetime | None = None


class RetrievalAccountInfo(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None = None
    profile_image_url: str | None = None


class RetrievalResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    since_dt: datetime | None
    until_dt: datetime | None
    status: str
    error_message: str | None
    accounts: list[RetrievalAccountInfo] = []
    post_count: int = 0

    model_config = {"from_attributes": True}


class RetrievalDetailResponse(RetrievalResponse):
    posts: list[PostResponse] = []


class RetrievalListResponse(BaseModel):
    retrievals: list[RetrievalResponse]
    total: int
    page: int
    per_page: int


class RetrievalDefaultsResponse(BaseModel):
    since_dt: datetime
    until_dt: datetime
