import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.twitterapi.io"


@dataclass
class XMedia:
    url: str
    type: str  # "photo", "video", "animated_gif"


@dataclass
class XUser:
    id: str
    username: str
    name: str
    profile_image_url: str | None = None


@dataclass
class XTweet:
    id: str
    text: str
    created_at: datetime
    media: list[XMedia] = field(default_factory=list)
    referenced_type: str | None = None  # "retweeted", "quoted", "replied_to"
    author_username: str = ""
    author_id: str = ""
    author_profile_image_url: str | None = None


class XAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"X API error {status_code}: {message}")


MIN_REQUEST_INTERVAL = 6.0  # seconds between requests (free tier: 1 req / 5s)


class XAPIClient:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._http = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=30.0,
        )
        self._last_request_at: float = 0.0

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _rate_limit(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < MIN_REQUEST_INTERVAL:
            await asyncio.sleep(MIN_REQUEST_INTERVAL - elapsed)
        self._last_request_at = time.monotonic()

    def _headers(self) -> dict[str, str]:
        return {"X-API-Key": self.api_key}

    async def get_user_by_username(self, username: str) -> XUser:
        await self._rate_limit()
        resp = await self._http.get(
            "/twitter/user/info",
            headers=self._headers(),
            params={"userName": username},
        )
        if resp.status_code != 200:
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            detail = body.get("message", body.get("error", resp.text[:200]))
            raise XAPIError(resp.status_code, detail)

        body = resp.json()
        data = body.get("data")
        if not data:
            raise XAPIError(404, "User not found")

        # Get higher-res avatar by replacing _normal suffix (48×48 → 200×200)
        raw_pic = data.get("profilePicture") or ""
        profile_pic = raw_pic.replace("_normal.", "_200x200.") if raw_pic else None

        return XUser(
            id=str(data["id"]),
            username=data["userName"],
            name=data["name"],
            profile_image_url=profile_pic,
        )

    async def get_user_tweets(
        self,
        user_id: str,
        max_results: int = 20,
        since_id: str | None = None,
    ) -> list[XTweet]:
        await self._rate_limit()
        resp = await self._http.get(
            "/twitter/user/last_tweets",
            headers=self._headers(),
            params={"userId": user_id},
        )
        if resp.status_code != 200:
            body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            detail = body.get("message", body.get("error", resp.text[:200]))
            raise XAPIError(resp.status_code, detail)

        payload = resp.json()
        tweets_data = payload.get("tweets", [])
        if not tweets_data:
            return []

        since_id_int = int(since_id) if since_id else None

        tweets: list[XTweet] = []
        for t in tweets_data:
            tweet_id = int(t["id"])

            # Tweets come newest-first; stop once we see an ID <= since_id
            if since_id_int is not None and tweet_id <= since_id_int:
                break

            tweets.append(self._parse_tweet(t))

        return tweets[:max_results]

    def _parse_tweet(self, t: dict, author_username: str = "", author_id: str = "", author_profile_image_url: str | None = None) -> XTweet:
        """Parse a tweet dict (shared between last_tweets and advanced_search)."""
        ref_type = None
        if t.get("isReply"):
            ref_type = "replied_to"
        elif t.get("retweeted_tweet"):
            ref_type = "retweeted"
        elif t.get("quoted_tweet"):
            ref_type = "quoted"

        tweet_media: list[XMedia] = []
        for m in (t.get("extendedEntities", {}) or {}).get("media", []):
            url = m.get("media_url_https", "")
            if url:
                tweet_media.append(XMedia(url=url, type=m.get("type", "photo")))

        created_at = datetime.strptime(t["createdAt"], "%a %b %d %H:%M:%S %z %Y")

        return XTweet(
            id=str(t["id"]),
            text=t.get("text", ""),
            created_at=created_at,
            media=tweet_media,
            referenced_type=ref_type,
            author_username=author_username,
            author_id=author_id,
            author_profile_image_url=author_profile_image_url,
        )

    async def search_tweets_by_users(
        self,
        usernames: list[str],
        since_id: str | None = None,
        since: str | None = None,
        max_pages: int = 5,
    ) -> list[XTweet]:
        """Batch-fetch recent tweets from multiple users via advanced search.

        Uses `from:user1 OR from:user2 ... since_id:X` so the server
        only returns new tweets — much cheaper than one call per user.
        `since` accepts Twitter date format e.g. "2026-02-23_11:00:00_UTC".
        """
        from_clauses = " OR ".join(f"from:{u}" for u in usernames)
        query = f"({from_clauses}) -filter:replies -filter:retweets"
        if since_id:
            query += f" since_id:{since_id}"
        elif since:
            query += f" since:{since}"

        all_tweets: list[XTweet] = []
        cursor = ""
        pages_fetched = 0

        for _ in range(max_pages):
            await self._rate_limit()
            params: dict[str, str] = {
                "query": query,
                "queryType": "Latest",
            }
            if cursor:
                params["cursor"] = cursor

            resp = await self._http.get(
                "/twitter/tweet/advanced_search",
                headers=self._headers(),
                params=params,
            )
            if resp.status_code != 200:
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                detail = body.get("message", body.get("error", resp.text[:200]))
                raise XAPIError(resp.status_code, detail)

            payload = resp.json()
            tweets_data = payload.get("tweets", [])

            for t in tweets_data:
                author = t.get("author", {})
                tweet = self._parse_tweet(
                    t,
                    author_username=author.get("userName", "").lower(),
                    author_id=str(author.get("id", "")),
                    author_profile_image_url=(author.get("profilePicture") or "").replace("_normal.", "_200x200.") or None,
                )
                all_tweets.append(tweet)

            pages_fetched += 1

            if not payload.get("has_next_page") or not payload.get("next_cursor"):
                break
            cursor = payload["next_cursor"]

        logger.info(
            f"Advanced search: {len(all_tweets)} tweets in {pages_fetched} page(s) "
            f"for {len(usernames)} user(s)"
        )
        return all_tweets

    async def close(self):
        await self._http.aclose()
