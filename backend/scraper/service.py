import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
import twscrape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import settings
from models.account import MonitoredAccount
from models.post import Post
from models.settings import AppSetting

logger = logging.getLogger(__name__)


@dataclass
class RawPost:
    external_id: str
    text: str | None
    media_urls: list[str] = field(default_factory=list)
    post_type: str = "tweet"
    posted_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    username: str = ""


class ScraperService:
    def __init__(
        self,
        twscrape_api: twscrape.API,
        db_session_factory: async_sessionmaker[AsyncSession],
        llm_service,
        http_client: httpx.AsyncClient,
    ):
        self.api = twscrape_api
        self.db_session_factory = db_session_factory
        self.llm_service = llm_service
        self.http_client = http_client

        # Runtime status tracking
        self.is_running = False
        self.last_run_at: datetime | None = None
        self.last_run_duration: float | None = None
        self.last_accounts_checked: int | None = None
        self.last_posts_found: int | None = None

    async def poll_account(self, account: MonitoredAccount) -> list[RawPost]:
        try:
            if not account.x_user_id:
                logger.warning(f"Account @{account.username} has no x_user_id, skipping")
                return []

            user_id = int(account.x_user_id)
            tweets = []
            async for tweet in self.api.user_tweets(user_id, limit=20):
                tweets.append(tweet)

            new_posts = []
            for tweet in tweets:
                tweet_id = str(tweet.id)
                if account.last_post_id and tweet_id <= account.last_post_id:
                    continue

                media_urls = []
                if tweet.media and hasattr(tweet.media, "photos"):
                    for photo in tweet.media.photos:
                        if hasattr(photo, "url"):
                            media_urls.append(photo.url)

                # Determine post type
                post_type = "tweet"
                if hasattr(tweet, "retweetedTweet") and tweet.retweetedTweet:
                    post_type = "retweet"
                elif hasattr(tweet, "quotedTweet") and tweet.quotedTweet:
                    post_type = "quote"
                elif hasattr(tweet, "inReplyToTweetId") and tweet.inReplyToTweetId:
                    post_type = "reply"

                posted_at = tweet.date if hasattr(tweet, "date") and tweet.date else datetime.now(timezone.utc)

                new_posts.append(RawPost(
                    external_id=tweet_id,
                    text=tweet.rawContent if hasattr(tweet, "rawContent") else str(tweet),
                    media_urls=media_urls,
                    post_type=post_type,
                    posted_at=posted_at,
                    username=account.username,
                ))

            return new_posts
        except Exception as e:
            logger.error(f"Failed to poll @{account.username}: {e}")
            return []

    async def poll_all_accounts(self) -> list[RawPost]:
        if self.is_running:
            logger.warning("Poll cycle already in progress, skipping")
            return []

        self.is_running = True
        start_time = datetime.now(timezone.utc)
        all_new_posts = []
        accounts_checked = 0
        errors = 0

        try:
            async with self.db_session_factory() as session:
                result = await session.execute(
                    select(MonitoredAccount).where(MonitoredAccount.is_active == True)
                )
                accounts = result.scalars().all()

            if not accounts:
                logger.info("No active accounts to poll")
                return []

            # Get polling interval for stagger calculation
            async with self.db_session_factory() as session:
                interval_result = await session.execute(
                    select(AppSetting).where(AppSetting.key == "polling_interval_minutes")
                )
                interval_setting = interval_result.scalar_one_or_none()
                interval_minutes = int(interval_setting.value) if interval_setting else settings.polling_interval_minutes

            polling_interval_seconds = interval_minutes * 60
            delay = (polling_interval_seconds * 0.8) / len(accounts)

            for account in accounts:
                try:
                    new_posts = await self.poll_account(account)
                    saved = await self.save_new_posts(new_posts, account)
                    all_new_posts.extend(saved)
                    accounts_checked += 1
                except Exception as e:
                    logger.error(f"Error processing @{account.username}: {e}")
                    errors += 1

                await asyncio.sleep(delay)

        except Exception as e:
            logger.error(f"Poll cycle failed: {e}")
        finally:
            self.is_running = False
            self.last_run_at = datetime.now(timezone.utc)
            self.last_run_duration = (datetime.now(timezone.utc) - start_time).total_seconds()
            self.last_accounts_checked = accounts_checked
            self.last_posts_found = len(all_new_posts)

        logger.info(
            f"Poll cycle complete: checked {accounts_checked}/{accounts_checked + errors} accounts, "
            f"found {len(all_new_posts)} new posts, {errors} errors"
        )
        return all_new_posts

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

    async def save_new_posts(self, raw_posts: list[RawPost], account: MonitoredAccount) -> list[RawPost]:
        saved = []
        newest_id = account.last_post_id

        async with self.db_session_factory() as session:
            for raw in raw_posts:
                # Deduplication check
                existing = await session.execute(
                    select(Post).where(Post.external_post_id == raw.external_id)
                )
                if existing.scalar_one_or_none() is not None:
                    continue

                # Download media if present
                media_local_paths = None
                if raw.media_urls:
                    media_local_paths = await self.download_media(raw.media_urls, raw.external_id)

                post = Post(
                    account_id=account.id,
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

                # Track newest post for updating last_post_id
                if newest_id is None or raw.external_id > newest_id:
                    newest_id = raw.external_id

                saved.append(raw)

                # Trigger LLM generation in background
                asyncio.create_task(self.llm_service.generate_replies(str(post.id)))

            # Update account tracking
            account_in_session = await session.get(MonitoredAccount, account.id)
            if account_in_session:
                if newest_id:
                    account_in_session.last_post_id = newest_id
                account_in_session.last_checked_at = datetime.now(timezone.utc)

            await session.commit()

        return saved

    async def resolve_user_id(self, username: str) -> tuple[str | None, str | None]:
        """Resolve a username to a numeric X user ID and display name."""
        try:
            user = await self.api.user_by_login(username)
            if user:
                return str(user.id), user.displayname
        except Exception as e:
            logger.error(f"Failed to resolve user @{username}: {e}")
        return None, None
