import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AccountCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)


class AccountBulkCreate(BaseModel):
    usernames: list[str]


class AccountUpdate(BaseModel):
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None
    x_user_id: str | None
    added_at: datetime
    is_active: bool
    last_checked_at: datetime | None
    last_post_id: str | None
    post_count: int = 0

    model_config = {"from_attributes": True}


class AccountListResponse(BaseModel):
    accounts: list[AccountResponse]
    total: int
    page: int
    per_page: int


class BulkCreateResult(BaseModel):
    username: str
    success: bool
    error: str | None = None
    account: AccountResponse | None = None


class AccountBulkResponse(BaseModel):
    results: list[BulkCreateResult]
