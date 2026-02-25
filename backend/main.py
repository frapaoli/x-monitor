import asyncio
import logging
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from api.accounts import router as accounts_router
from api.posts import router as posts_router
from api.replies import router as replies_router
from api.retrievals import router as retrievals_router
from api.settings import router as settings_router
from app_state import app_state
from config import settings
from database import async_session_factory, engine
from llm.service import LLMService
from models.post import Post
from models.settings import AppSetting
from scraper.service import RetrievalService
from x_api.client import XAPIClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting X Monitor application...")

    # Initialize HTTP client
    http_client = httpx.AsyncClient()
    app_state["http_client"] = http_client

    # Initialize X API client (prefer DB-stored key, fall back to env)
    x_api_key = settings.x_api_key
    try:
        async with async_session_factory() as session:
            result = await session.execute(select(AppSetting).where(AppSetting.key == "x_api_key"))
            row = result.scalar_one_or_none()
            if row and row.value:
                x_api_key = str(row.value)
    except Exception:
        pass

    x_api_client = XAPIClient(api_key=x_api_key)
    app_state["x_api_client"] = x_api_client
    if not x_api_client.is_configured:
        logger.warning("TwitterAPI.io API key not configured — retrieval will be disabled until set via Settings")

    # Get API key (prefer DB setting, fall back to env)
    api_key = settings.openrouter_api_key
    try:
        async with async_session_factory() as session:
            result = await session.execute(select(AppSetting).where(AppSetting.key == "openrouter_api_key"))
            row = result.scalar_one_or_none()
            if row and row.value:
                api_key = str(row.value)
    except Exception:
        pass

    # Initialize services
    llm_service = LLMService(api_key=api_key, http_client=http_client, db_session_factory=async_session_factory)
    app_state["llm_service"] = llm_service

    retrieval_service = RetrievalService(
        x_api_client=x_api_client,
        db_session_factory=async_session_factory,
        llm_service=llm_service,
        http_client=http_client,
    )
    app_state["retrieval_service"] = retrieval_service

    # Recovery: process any pending/stuck posts
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                select(Post).where(Post.llm_status.in_(["pending", "processing"]))
            )
            pending_posts = result.scalars().all()
            if pending_posts:
                logger.info(f"Recovery: found {len(pending_posts)} posts needing LLM generation")
                for post in pending_posts:
                    asyncio.create_task(llm_service.generate_replies(str(post.id)))
    except Exception as e:
        logger.warning(f"Recovery check failed: {e}")

    logger.info("X Monitor started successfully")
    yield

    # Shutdown
    logger.info("Shutting down X Monitor...")
    await x_api_client.close()
    await http_client.aclose()
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(title="X Monitor", lifespan=lifespan)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(accounts_router, prefix="/api/accounts", tags=["accounts"])
app.include_router(posts_router, prefix="/api/posts", tags=["posts"])
app.include_router(replies_router, prefix="/api/replies", tags=["replies"])
app.include_router(retrievals_router, prefix="/api/retrievals", tags=["retrievals"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])


# System endpoints
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "db": "connected"}


# Serve media files
media_dir = settings.media_dir
if os.path.exists(media_dir):
    app.mount("/media", StaticFiles(directory=media_dir), name="media")

# Serve frontend (must be last — catch-all)
static_dir = settings.static_dir
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
