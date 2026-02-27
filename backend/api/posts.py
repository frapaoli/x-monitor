import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.post import Post
from models.reply import GeneratedReply
from schemas.post import GenerateRequest, PostListResponse, PostResponse
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


@router.get("", response_model=PostListResponse)
async def list_posts(
    page: int = 1,
    per_page: int = 20,
    account_ids: str | None = Query(default=None, description="Comma-separated account UUIDs"),
    batch_id: str | None = Query(default=None, description="Filter by retrieval batch ID"),
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

    if batch_id:
        try:
            bid = uuid.UUID(batch_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid batch_id UUID")
        query = query.where(Post.batch_id == bid)
        count_query = count_query.where(Post.batch_id == bid)

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

    return _post_to_response(post)


@router.post("/{post_id}/regenerate", response_model=PostResponse)
async def regenerate_replies(post_id: uuid.UUID, body: GenerateRequest | None = None, db: AsyncSession = Depends(get_db)):
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
    post.llm_status = "processing"
    post.replies = []
    await db.flush()

    # Trigger LLM generation
    suggestion = body.suggestion if body else None
    from app_state import app_state
    if app_state.get("llm_service"):
        asyncio.create_task(app_state["llm_service"].generate_replies(str(post.id), suggestion=suggestion))

    return _post_to_response(post)
