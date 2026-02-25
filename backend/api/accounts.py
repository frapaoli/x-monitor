import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.account import MonitoredAccount
from models.post import Post
from schemas.account import (
    AccountBulkCreate,
    AccountBulkResponse,
    AccountCreate,
    AccountListResponse,
    AccountResponse,
    AccountUpdate,
    BulkCreateResult,
)

router = APIRouter()


def _account_to_response(account: MonitoredAccount, post_count: int = 0) -> AccountResponse:
    return AccountResponse(
        id=account.id,
        username=account.username,
        display_name=account.display_name,
        x_user_id=account.x_user_id,
        profile_image_url=account.profile_image_url,
        added_at=account.added_at,
        is_active=account.is_active,
        post_count=post_count,
    )


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    page: int = 1,
    per_page: int = 50,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(MonitoredAccount)
    count_query = select(func.count(MonitoredAccount.id))

    if is_active is not None:
        query = query.where(MonitoredAccount.is_active == is_active)
        count_query = count_query.where(MonitoredAccount.is_active == is_active)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(MonitoredAccount.added_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    accounts = result.scalars().all()

    # Get post counts
    responses = []
    for account in accounts:
        count_result = await db.execute(
            select(func.count(Post.id)).where(Post.account_id == account.id)
        )
        post_count = count_result.scalar() or 0
        responses.append(_account_to_response(account, post_count))

    return AccountListResponse(accounts=responses, total=total, page=page, per_page=per_page)


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    data: AccountCreate,
    db: AsyncSession = Depends(get_db),
):
    username = data.username.lstrip("@").lower()

    # Check if already exists
    existing = await db.execute(
        select(MonitoredAccount).where(MonitoredAccount.username == username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Account @{username} is already being monitored")

    # Resolve user ID via X API
    from app_state import app_state
    x_user_id = None
    display_name = None
    profile_image_url = None
    if app_state.get("retrieval_service"):
        x_user_id, display_name, profile_image_url = await app_state["retrieval_service"].resolve_user_id(username)

    account = MonitoredAccount(
        username=username,
        display_name=display_name,
        x_user_id=x_user_id,
        profile_image_url=profile_image_url,
    )
    db.add(account)
    await db.flush()
    return _account_to_response(account)


@router.post("/bulk", response_model=AccountBulkResponse)
async def bulk_create_accounts(
    data: AccountBulkCreate,
    db: AsyncSession = Depends(get_db),
):
    results = []
    for username_raw in data.usernames:
        username = username_raw.strip().lstrip("@").lower()
        if not username:
            continue

        try:
            existing = await db.execute(
                select(MonitoredAccount).where(MonitoredAccount.username == username)
            )
            if existing.scalar_one_or_none():
                results.append(BulkCreateResult(username=username, success=False, error="Already monitored"))
                continue

            from app_state import app_state
            x_user_id = None
            display_name = None
            profile_image_url = None
            if app_state.get("retrieval_service"):
                x_user_id, display_name, profile_image_url = await app_state["retrieval_service"].resolve_user_id(username)

            account = MonitoredAccount(username=username, display_name=display_name, x_user_id=x_user_id, profile_image_url=profile_image_url)
            db.add(account)
            await db.flush()
            results.append(BulkCreateResult(
                username=username, success=True, account=_account_to_response(account)
            ))
        except Exception as e:
            results.append(BulkCreateResult(username=username, success=False, error=str(e)))

    return AccountBulkResponse(results=results)


@router.delete("/{account_id}", status_code=204)
async def delete_account(account_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MonitoredAccount).where(MonitoredAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: uuid.UUID,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MonitoredAccount).where(MonitoredAccount.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if data.is_active is not None:
        account.is_active = data.is_active

    await db.flush()
    return _account_to_response(account)
