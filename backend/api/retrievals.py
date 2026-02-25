import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app_state import app_state
from database import get_db
from models.account import MonitoredAccount
from models.batch import RetrievalBatch, retrieval_batch_accounts
from models.post import Post
from schemas.post import PostResponse
from schemas.reply import ReplyResponse
from schemas.retrieval import (
    RetrievalAccountInfo,
    RetrievalCreate,
    RetrievalDefaultsResponse,
    RetrievalDetailResponse,
    RetrievalListResponse,
    RetrievalResponse,
)

router = APIRouter()


def _batch_to_response(batch: RetrievalBatch, post_count: int = 0) -> RetrievalResponse:
    accounts = [
        RetrievalAccountInfo(
            id=a.id,
            username=a.username,
            display_name=a.display_name,
            profile_image_url=a.profile_image_url,
        )
        for a in (batch.accounts or [])
    ]
    return RetrievalResponse(
        id=batch.id,
        created_at=batch.created_at,
        since_dt=batch.since_dt,
        until_dt=batch.until_dt,
        status=batch.status,
        error_message=batch.error_message,
        accounts=accounts,
        post_count=post_count,
    )


def _post_to_response(post: Post) -> PostResponse:
    replies = []
    if post.replies:
        replies = [
            ReplyResponse(
                id=r.id,
                post_id=r.post_id,
                reply_text=r.reply_text,
                reply_index=r.reply_index,
                model_used=r.model_used,
                is_favorite=r.is_favorite,
                was_used=r.was_used,
                generated_at=r.generated_at,
            )
            for r in sorted(post.replies, key=lambda r: r.reply_index)
        ]

    return PostResponse(
        id=post.id,
        account_id=post.account_id,
        batch_id=post.batch_id,
        account_username=post.account.username if post.account else "",
        account_display_name=post.account.display_name if post.account else None,
        account_profile_image_url=post.account.profile_image_url if post.account else None,
        external_post_id=post.external_post_id,
        post_url=post.post_url,
        text_content=post.text_content,
        has_media=post.has_media,
        media_urls=post.media_urls,
        media_local_paths=post.media_local_paths,
        post_type=post.post_type,
        posted_at=post.posted_at,
        scraped_at=post.scraped_at,
        llm_status=post.llm_status,
        replies=replies,
    )


@router.get("/defaults", response_model=RetrievalDefaultsResponse)
async def get_retrieval_defaults(db: AsyncSession = Depends(get_db)):
    """Return default since (latest until_dt from past batches, or now-24h) and until (now)."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(RetrievalBatch.until_dt)
        .where(RetrievalBatch.status == "completed", RetrievalBatch.until_dt.isnot(None))
        .order_by(RetrievalBatch.until_dt.desc())
        .limit(1)
    )
    latest_until = result.scalar_one_or_none()

    since_dt = latest_until if latest_until else now - timedelta(hours=24)
    return RetrievalDefaultsResponse(since_dt=since_dt, until_dt=now)


@router.post("", response_model=RetrievalResponse, status_code=201)
async def create_retrieval(data: RetrievalCreate, db: AsyncSession = Depends(get_db)):
    if not data.account_ids:
        raise HTTPException(status_code=422, detail="At least one account must be selected")

    # Validate accounts exist
    result = await db.execute(
        select(MonitoredAccount).where(MonitoredAccount.id.in_(data.account_ids))
    )
    accounts = result.scalars().all()
    if not accounts:
        raise HTTPException(status_code=404, detail="No valid accounts found")

    batch = RetrievalBatch(
        since_dt=data.since_dt,
        until_dt=data.until_dt,
        status="running",
    )
    db.add(batch)
    await db.flush()

    # Insert junction rows
    for account in accounts:
        await db.execute(
            retrieval_batch_accounts.insert().values(batch_id=batch.id, account_id=account.id)
        )
    await db.flush()

    # Launch retrieval as background task
    retrieval_service = app_state.get("retrieval_service")
    if retrieval_service:
        asyncio.create_task(retrieval_service.run_retrieval(str(batch.id)))

    # Build response manually (avoid lazy-load on batch.accounts in async context)
    account_infos = [
        RetrievalAccountInfo(
            id=a.id, username=a.username, display_name=a.display_name, profile_image_url=a.profile_image_url,
        )
        for a in accounts
    ]
    return RetrievalResponse(
        id=batch.id,
        created_at=batch.created_at,
        since_dt=batch.since_dt,
        until_dt=batch.until_dt,
        status=batch.status,
        error_message=batch.error_message,
        accounts=account_infos,
        post_count=0,
    )


@router.get("", response_model=RetrievalListResponse)
async def list_retrievals(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(select(func.count(RetrievalBatch.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(RetrievalBatch)
        .options(selectinload(RetrievalBatch.accounts))
        .order_by(RetrievalBatch.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    batches = result.scalars().unique().all()

    # Get post counts for each batch
    responses = []
    for batch in batches:
        count_res = await db.execute(
            select(func.count(Post.id)).where(Post.batch_id == batch.id)
        )
        post_count = count_res.scalar() or 0
        responses.append(_batch_to_response(batch, post_count))

    return RetrievalListResponse(retrievals=responses, total=total, page=page, per_page=per_page)


@router.get("/{batch_id}", response_model=RetrievalDetailResponse)
async def get_retrieval(batch_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RetrievalBatch)
        .options(
            selectinload(RetrievalBatch.accounts),
            selectinload(RetrievalBatch.posts).selectinload(Post.replies),
            selectinload(RetrievalBatch.posts).selectinload(Post.account),
        )
        .where(RetrievalBatch.id == batch_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Retrieval batch not found")

    accounts = [
        RetrievalAccountInfo(
            id=a.id,
            username=a.username,
            display_name=a.display_name,
            profile_image_url=a.profile_image_url,
        )
        for a in (batch.accounts or [])
    ]

    posts = [_post_to_response(p) for p in sorted(batch.posts, key=lambda p: p.posted_at, reverse=True)]

    return RetrievalDetailResponse(
        id=batch.id,
        created_at=batch.created_at,
        since_dt=batch.since_dt,
        until_dt=batch.until_dt,
        status=batch.status,
        error_message=batch.error_message,
        accounts=accounts,
        post_count=len(posts),
        posts=posts,
    )
