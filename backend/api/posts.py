import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.account import MonitoredAccount
from models.post import Post
from models.reply import GeneratedReply
from schemas.post import BulkPostUpdate, BulkPostUpdateResponse, PostListResponse, PostResponse, PostUpdate, UnreadCountResponse
from schemas.reply import ReplyResponse

router = APIRouter()


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
        account_username=post.account.username if post.account else "",
        account_display_name=post.account.display_name if post.account else None,
        external_post_id=post.external_post_id,
        post_url=post.post_url,
        text_content=post.text_content,
        has_media=post.has_media,
        media_urls=post.media_urls,
        media_local_paths=post.media_local_paths,
        post_type=post.post_type,
        posted_at=post.posted_at,
        scraped_at=post.scraped_at,
        is_read=post.is_read,
        is_archived=post.is_archived,
        llm_status=post.llm_status,
        replies=replies,
    )


@router.get("", response_model=PostListResponse)
async def list_posts(
    page: int = 1,
    per_page: int = 20,
    account_ids: str | None = Query(default=None, description="Comma-separated account UUIDs"),
    is_read: bool | None = None,
    is_archived: bool | None = Query(default=False),
    post_type: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Post)
        .options(selectinload(Post.replies), selectinload(Post.account))
    )
    count_query = select(func.count(Post.id))

    if account_ids:
        try:
            id_list = [uuid.UUID(aid.strip()) for aid in account_ids.split(",") if aid.strip()]
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid UUID in account_ids")
        if id_list:
            query = query.where(Post.account_id.in_(id_list))
            count_query = count_query.where(Post.account_id.in_(id_list))

    if is_read is not None:
        query = query.where(Post.is_read == is_read)
        count_query = count_query.where(Post.is_read == is_read)

    if is_archived is not None:
        query = query.where(Post.is_archived == is_archived)
        count_query = count_query.where(Post.is_archived == is_archived)

    if post_type is not None:
        query = query.where(Post.post_type == post_type)
        count_query = count_query.where(Post.post_type == post_type)

    if search:
        query = query.where(Post.text_content.ilike(f"%{search}%"))
        count_query = count_query.where(Post.text_content.ilike(f"%{search}%"))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(Post.posted_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    posts = result.scalars().unique().all()

    return PostListResponse(
        posts=[_post_to_response(p) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count(Post.id)).where(Post.is_read == False, Post.is_archived == False)
    )
    count = result.scalar() or 0
    return UnreadCountResponse(count=count)


@router.patch("/bulk", response_model=BulkPostUpdateResponse)
async def bulk_update_posts(
    data: BulkPostUpdate,
    db: AsyncSession = Depends(get_db),
):
    if not data.post_ids:
        raise HTTPException(status_code=422, detail="post_ids must not be empty")
    if len(data.post_ids) > 100:
        raise HTTPException(status_code=422, detail="Maximum 100 post IDs per request")
    if data.is_read is None and data.is_archived is None:
        raise HTTPException(status_code=422, detail="At least one update field required")

    values = {}
    if data.is_read is not None:
        values["is_read"] = data.is_read
    if data.is_archived is not None:
        values["is_archived"] = data.is_archived

    result = await db.execute(
        update(Post).where(Post.id.in_(data.post_ids)).values(**values)
    )
    await db.flush()
    return BulkPostUpdateResponse(updated_count=result.rowcount)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.replies), selectinload(Post.account))
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Auto-mark as read
    if not post.is_read:
        post.is_read = True

    return _post_to_response(post)


@router.patch("/{post_id}", response_model=PostResponse)
async def update_post(
    post_id: uuid.UUID,
    data: PostUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.replies), selectinload(Post.account))
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if data.is_read is not None:
        post.is_read = data.is_read
    if data.is_archived is not None:
        post.is_archived = data.is_archived

    await db.flush()
    return _post_to_response(post)


@router.post("/{post_id}/regenerate", response_model=PostResponse)
async def regenerate_replies(post_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.replies), selectinload(Post.account))
        .where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Delete existing replies
    from sqlalchemy import delete as sa_delete
    await db.execute(sa_delete(GeneratedReply).where(GeneratedReply.post_id == post.id))
    post.llm_status = "pending"
    post.replies = []
    await db.flush()

    # Trigger LLM generation
    from app_state import app_state
    if app_state.get("llm_service"):
        asyncio.create_task(app_state["llm_service"].generate_replies(str(post.id)))

    return _post_to_response(post)
