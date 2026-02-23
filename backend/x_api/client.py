import logging
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


@dataclass
class XTweet:
    id: str
    text: str
    created_at: datetime
    media: list[XMedia] = field(default_factory=list)
    referenced_type: str | None = None  # "retweeted", "quoted", "replied_to"


class XAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"X API error {status_code}: {message}")


class XAPIClient:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._http = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=30.0,
        )

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _headers(self) -> dict[str, str]:
        return {"X-API-Key": self.api_key}

    async def get_user_by_username(self, username: str) -> XUser:
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

        return XUser(id=str(data["id"]), username=data["userName"], name=data["name"])

    async def get_user_tweets(
        self,
        user_id: str,
        max_results: int = 20,
        since_id: str | None = None,
    ) -> list[XTweet]:
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
            tweet_id = str(t["id"])

            # Tweets come newest-first; stop once we see an ID <= since_id
            if since_id_int is not None and int(tweet_id) <= since_id_int:
                break

            # Determine referenced type
            ref_type = None
            if t.get("isReply"):
                ref_type = "replied_to"
            elif t.get("retweeted_tweet"):
                ref_type = "retweeted"
            elif t.get("quoted_tweet"):
                ref_type = "quoted"

            # Extract media from extendedEntities
            tweet_media: list[XMedia] = []
            for m in (t.get("extendedEntities", {}) or {}).get("media", []):
                url = m.get("media_url_https", "")
                if url:
                    tweet_media.append(XMedia(url=url, type=m.get("type", "photo")))

            # Parse Twitter's legacy date format: "Mon Feb 17 15:30:00 +0000 2025"
            created_at = datetime.strptime(t["createdAt"], "%a %b %d %H:%M:%S %z %Y")

            tweets.append(XTweet(
                id=tweet_id,
                text=t.get("text", ""),
                created_at=created_at,
                media=tweet_media,
                referenced_type=ref_type,
            ))

        return tweets[:max_results]

    async def close(self):
        await self._http.aclose()
