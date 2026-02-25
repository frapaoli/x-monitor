import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from config import settings
from models.account import MonitoredAccount
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


class ScraperService:
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

        # Runtime status tracking
        self.is_running = False
        self.last_run_at: datetime | None = None
        self.last_run_duration: float | None = None
        self.last_accounts_checked: int | None = None
        self.last_posts_found: int | None = None
        self.last_error: str | None = None

    async def poll_account(self, account: MonitoredAccount, session: AsyncSession | None = None) -> list[RawPost]:
        try:
            if not account.x_user_id:
                logger.info(f"Account @{account.username} has no x_user_id, attempting to resolve...")
                user_id, display_name, profile_image_url = await self.resolve_user_id(account.username)
                if not user_id:
                    logger.warning(f"Could not resolve x_user_id for @{account.username}, skipping")
                    return []
                account.x_user_id = user_id
                if display_name:
                    account.display_name = display_name
                if profile_image_url:
                    account.profile_image_url = profile_image_url
                if session:
                    acc = await session.get(MonitoredAccount, account.id)
                    if acc:
                        acc.x_user_id = user_id
                        if display_name:
                            acc.display_name = display_name
                        if profile_image_url:
                            acc.profile_image_url = profile_image_url
                logger.info(f"Resolved @{account.username} → user_id={user_id}")

            tweets = await self.x_api.get_user_tweets(
                user_id=account.x_user_id,
                max_results=20,
                since_id=account.last_post_id,
            )

            new_posts = []
            for tweet in tweets:
                media_urls = [m.url for m in tweet.media if m.url]

                # Map referenced_type to post_type
                ref = tweet.referenced_type
                if ref == "retweeted":
                    post_type = "retweet"
                elif ref == "quoted":
                    post_type = "quote"
                elif ref == "replied_to":
                    post_type = "reply"
                else:
                    post_type = "tweet"

                new_posts.append(RawPost(
                    external_id=tweet.id,
                    text=tweet.text,
                    media_urls=media_urls,
                    post_type=post_type,
                    posted_at=tweet.created_at,
                    username=account.username,
                ))

            return new_posts
        except XAPIError as e:
            logger.error(f"X API error polling @{account.username}: {e}")
            self.last_error = str(e)
            return []
        except Exception as e:
            logger.error(f"Failed to poll @{account.username}: {e}")
            return []

    SEARCH_BATCH_SIZE = 20  # max accounts per advanced-search query

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

    async def poll_all_accounts(self) -> list[RawPost]:
        if self.is_running:
            logger.warning("Poll cycle already in progress, skipping")
            return []

        if not self.x_api.is_configured:
            logger.warning("TwitterAPI.io API key not configured, skipping poll cycle")
            self.last_error = "TwitterAPI.io API key not configured"
            return []

        self.is_running = True
        self.last_error = None
        start_time = datetime.now(timezone.utc)
        all_new_posts: list[RawPost] = []
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

                # Build username → account lookup
                by_username: dict[str, MonitoredAccount] = {
                    a.username.lower(): a for a in accounts
                }
                usernames = list(by_username.keys())

                # Use the minimum last_post_id for server-side since_id filtering
                since_ids = [int(a.last_post_id) for a in accounts if a.last_post_id]
                min_since_id = str(min(since_ids)) if since_ids else None

                # Batch advanced-search across all accounts
                all_tweets: list[XTweet] = []
                for i in range(0, len(usernames), self.SEARCH_BATCH_SIZE):
                    batch = usernames[i : i + self.SEARCH_BATCH_SIZE]
                    try:
                        tweets = await self.x_api.search_tweets_by_users(
                            batch, since_id=min_since_id,
                        )
                        all_tweets.extend(tweets)
                    except XAPIError as e:
                        logger.error(f"Advanced search failed (batch {i // self.SEARCH_BATCH_SIZE + 1}): {e}")
                        self.last_error = str(e)
                        errors += 1

                # Backfill x_user_id and profile_image_url from search results (free — no extra API call)
                for tweet in all_tweets:
                    acct = by_username.get(tweet.author_username)
                    if acct:
                        if not acct.x_user_id and tweet.author_id:
                            acct.x_user_id = tweet.author_id
                            logger.info(f"Backfilled x_user_id for @{acct.username} → {tweet.author_id}")
                        if not acct.profile_image_url and tweet.author_profile_image_url:
                            acct.profile_image_url = tweet.author_profile_image_url
                            logger.info(f"Backfilled profile_image_url for @{acct.username}")

                # Process per-account: filter by each account's own last_post_id
                for account in accounts:
                    account_tweets = [
                        t for t in all_tweets
                        if t.author_username == account.username.lower()
                        and t.referenced_type not in ("replied_to", "retweeted")
                    ]

                    # Client-side per-account since_id filter
                    if account.last_post_id:
                        last_id = int(account.last_post_id)
                        account_tweets = [
                            t for t in account_tweets if int(t.id) > last_id
                        ]

                    raw_posts = [
                        self._tweet_to_raw(t, account.username)
                        for t in account_tweets
                    ]

                    try:
                        saved = await self.save_new_posts(raw_posts, account)
                        all_new_posts.extend(saved)
                        accounts_checked += 1
                    except Exception as e:
                        logger.error(f"Error saving posts for @{account.username}: {e}")
                        errors += 1

                await session.commit()

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
        pending_llm_post_ids: list[str] = []

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
                if newest_id is None or int(raw.external_id) > int(newest_id):
                    newest_id = raw.external_id

                saved.append(raw)
                pending_llm_post_ids.append(str(post.id))

            # Update account tracking
            account_in_session = await session.get(MonitoredAccount, account.id)
            if account_in_session:
                if newest_id:
                    account_in_session.last_post_id = newest_id
                account_in_session.last_checked_at = datetime.now(timezone.utc)

            await session.commit()

        # Trigger LLM generation AFTER commit so the rows are visible to other sessions
        for post_id in pending_llm_post_ids:
            asyncio.create_task(self.llm_service.generate_replies(post_id))

        return saved

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
