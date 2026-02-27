import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import settings
from models.account import MonitoredAccount
from models.batch import RetrievalBatch
from models.post import Post
from x_api.client import XAPIClient, XAPIError, XTweet

logger = logging.getLogger(__name__)


@dataclass
class RawPost:
    external_id: str
    text: str | None
    media_urls: list[str] = field(default_factory=list)
    post_type: str = "tweet"
    posted_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    username: str = ""


class RetrievalService:
    SEARCH_BATCH_SIZE = 20

    def __init__(
        self,
        x_api_client: XAPIClient,
        db_session_factory: async_sessionmaker[AsyncSession],
        llm_service,
        http_client: httpx.AsyncClient,
    ):
        self.x_api = x_api_client
        self.db_session_factory = db_session_factory
        self.llm_service = llm_service
        self.http_client = http_client

    @staticmethod
    def _tweet_to_raw(tweet: XTweet, username: str) -> RawPost:
        media_urls = [m.url for m in tweet.media if m.url]
        ref = tweet.referenced_type
        if ref == "retweeted":
            post_type = "retweet"
        elif ref == "quoted":
            post_type = "quote"
        elif ref == "replied_to":
            post_type = "reply"
        else:
            post_type = "tweet"
        return RawPost(
            external_id=tweet.id,
            text=tweet.text,
            media_urls=media_urls,
            post_type=post_type,
            posted_at=tweet.created_at,
            username=username,
        )

    async def run_retrieval(self, batch_id: str) -> None:
        """Execute a retrieval batch: fetch tweets, create posts, trigger LLM."""
        try:
            async with self.db_session_factory() as session:
                batch = await session.get(RetrievalBatch, batch_id)
                if not batch:
                    logger.error(f"Batch {batch_id} not found")
                    return

                # Eager-load accounts via the junction
                from sqlalchemy.orm import selectinload
                result = await session.execute(
                    select(RetrievalBatch)
                    .options(selectinload(RetrievalBatch.accounts))
                    .where(RetrievalBatch.id == batch_id)
                )
                batch = result.scalar_one()
                accounts = batch.accounts

                if not accounts:
                    batch.status = "completed"
                    batch.error_message = "No accounts selected"
                    await session.commit()
                    return

                if not self.x_api.is_configured:
                    batch.status = "failed"
                    batch.error_message = "TwitterAPI.io API key not configured"
                    await session.commit()
                    return

                # Build username lookup
                by_username: dict[str, MonitoredAccount] = {
                    a.username.lower(): a for a in accounts
                }
                usernames = list(by_username.keys())

                # Format since for the API
                since_str = None
                if batch.since_dt:
                    since_str = batch.since_dt.strftime("%Y-%m-%d_%H:%M:%S_UTC")

                # Fetch tweets in batches
                all_tweets: list[XTweet] = []
                for i in range(0, len(usernames), self.SEARCH_BATCH_SIZE):
                    chunk = usernames[i : i + self.SEARCH_BATCH_SIZE]
                    try:
                        tweets = await self.x_api.search_tweets_by_users(
                            chunk, since=since_str,
                        )
                        all_tweets.extend(tweets)
                    except XAPIError as e:
                        logger.error(f"Advanced search failed (batch {i // self.SEARCH_BATCH_SIZE + 1}): {e}")

                # Client-side until_dt filter
                if batch.until_dt:
                    all_tweets = [t for t in all_tweets if t.created_at <= batch.until_dt]

                # Backfill profile data from search results
                for tweet in all_tweets:
                    acct = by_username.get(tweet.author_username)
                    if acct:
                        if not acct.x_user_id and tweet.author_id:
                            acct.x_user_id = tweet.author_id
                        if not acct.profile_image_url and tweet.author_profile_image_url:
                            acct.profile_image_url = tweet.author_profile_image_url

                # Create Post rows
                post_count = 0
                for tweet in all_tweets:
                    acct = by_username.get(tweet.author_username)
                    if not acct:
                        continue

                    raw = self._tweet_to_raw(tweet, acct.username)

                    # Download media
                    media_local_paths = None
                    if raw.media_urls:
                        media_local_paths = await self.download_media(raw.media_urls, raw.external_id)

                    post = Post(
                        account_id=acct.id,
                        batch_id=batch.id,
                        external_post_id=raw.external_id,
                        post_url=f"https://x.com/{raw.username}/status/{raw.external_id}",
                        text_content=raw.text,
                        has_media=bool(raw.media_urls),
                        media_urls=raw.media_urls if raw.media_urls else None,
                        media_local_paths=media_local_paths if media_local_paths else None,
                        post_type=raw.post_type,
                        posted_at=raw.posted_at,
                        llm_status="pending",
                    )
                    session.add(post)
                    await session.flush()
                    post_count += 1

                batch.status = "completed"
                await session.commit()

            logger.info(f"Retrieval {batch_id} completed: {post_count} posts")

        except Exception as e:
            logger.error(f"Retrieval {batch_id} failed: {e}")
            try:
                async with self.db_session_factory() as session:
                    batch = await session.get(RetrievalBatch, batch_id)
                    if batch:
                        batch.status = "failed"
                        batch.error_message = str(e)
                        await session.commit()
            except Exception:
                logger.error(f"Failed to update batch {batch_id} status")

    async def download_media(self, media_urls: list[str], post_id: str) -> list[str]:
        local_paths = []
        save_dir = os.path.join(settings.media_dir, post_id)
        os.makedirs(save_dir, exist_ok=True)

        for idx, url in enumerate(media_urls):
            try:
                response = await self.http_client.get(url, timeout=30.0)
                if response.status_code == 200:
                    ext = "jpg"
                    content_type = response.headers.get("content-type", "")
                    if "png" in content_type:
                        ext = "png"
                    elif "gif" in content_type:
                        ext = "gif"
                    elif "webp" in content_type:
                        ext = "webp"

                    file_path = os.path.join(save_dir, f"image_{idx + 1}.{ext}")
                    with open(file_path, "wb") as f:
                        f.write(response.content)
                    local_paths.append(file_path)
                else:
                    logger.warning(f"Failed to download media {url}: HTTP {response.status_code}")
            except Exception as e:
                logger.error(f"Failed to download media {url}: {e}")

        return local_paths

    async def resolve_user_id(self, username: str) -> tuple[str | None, str | None, str | None]:
        """Resolve a username to a numeric X user ID, display name, and profile image URL."""
        try:
            user = await self.x_api.get_user_by_username(username)
            return user.id, user.name, user.profile_image_url
        except XAPIError as e:
            logger.error(f"X API error resolving @{username}: {e}")
        except Exception as e:
            logger.error(f"Failed to resolve user @{username}: {e}")
        return None, None, None
