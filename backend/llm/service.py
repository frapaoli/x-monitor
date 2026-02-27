import asyncio
import base64
import logging
from pathlib import Path

import httpx
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from models.post import Post
from models.reply import GeneratedReply
from models.settings import AppSetting

logger = logging.getLogger(__name__)


class GeneratedRepliesOutput(BaseModel):
    replies: list[str]


class LLMService:
    def __init__(self, api_key: str, http_client: httpx.AsyncClient, db_session_factory: async_sessionmaker[AsyncSession]):
        self.api_key = api_key
        self.http_client = http_client
        self.db_session_factory = db_session_factory

    async def _get_setting(self, session: AsyncSession, key: str, default=None):
        result = await session.execute(select(AppSetting).where(AppSetting.key == key))
        setting = result.scalar_one_or_none()
        if setting is None:
            return default
        return setting.value

    async def generate_replies(self, post_id: str, suggestion: str | None = None) -> None:
        async with self.db_session_factory() as session:
            result = await session.execute(
                select(Post).options(selectinload(Post.account)).where(Post.id == post_id)
            )
            post = result.scalar_one_or_none()
            if post is None:
                logger.error(f"Post {post_id} not found for reply generation")
                return

            try:
                post.llm_status = "processing"
                await session.commit()

                messages = await self._build_prompt(session, post, suggestion)
                model = await self._get_setting(session, "openrouter_model", "anthropic/claude-sonnet-4-20250514")
                if isinstance(model, str):
                    model_str = model
                else:
                    model_str = str(model)

                json_schema = {
                    "name": "generated_replies",
                    "strict": True,
                    "schema": {
                        "type": "object",
                        "properties": {
                            "replies": {
                                "type": "array",
                                "items": {"type": "string"},
                            }
                        },
                        "required": ["replies"],
                        "additionalProperties": False,
                    },
                }

                payload = {
                    "model": model_str,
                    "messages": messages,
                    "temperature": 0.8,
                    "max_tokens": 2000,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": json_schema,
                    },
                }

                response_data = await self._call_openrouter_with_retries(payload)
                content = response_data["choices"][0]["message"]["content"]
                parsed = GeneratedRepliesOutput.model_validate_json(content)
                reply_texts = parsed.replies

                # Delete any existing replies for this post (in case of regeneration)
                await session.execute(delete(GeneratedReply).where(GeneratedReply.post_id == post.id))

                for idx, text in enumerate(reply_texts, start=1):
                    reply = GeneratedReply(
                        post_id=post.id,
                        reply_text=text,
                        reply_index=idx,
                        model_used=model_str,
                    )
                    session.add(reply)

                post.llm_status = "completed"
                await session.commit()
                logger.info(f"Generated {len(reply_texts)} replies for post {post.id}", extra={"post_id": str(post.id), "model": model_str})

            except Exception as e:
                logger.error(f"Failed to generate replies for post {post.id}: {e}")
                async with self.db_session_factory() as err_session:
                    result = await err_session.execute(select(Post).where(Post.id == post_id))
                    err_post = result.scalar_one_or_none()
                    if err_post:
                        err_post.llm_status = "failed"
                        await err_session.commit()

    async def _build_prompt(self, session: AsyncSession, post: Post, suggestion: str | None = None) -> list[dict]:
        default_prompt = (
            "You are a knowledgeable and engaging social media user.\n\n"
            "Your interests span across the following fields - and not only these:\n"
            "- Software engineering\n"
            "- Backend & Frontend development\n"
            "- Startups, Tech founders & Indie hackers\n"
            "- AI (Artificial Intelligence), in particular NLP (Natural Language Processing) and RAG (Retrieval Augmented Generation)\n"
            "- Marketing & Product-market-fit validation\n\n"
            "# OBJECTIVE\n\n"
            "Given a post published by a user on X (Twitter), your goal is to write 10 different replies to that post.\n\n"
            "# REPLIES STYLE\n\n"
            "- Write as a human being would - do NOT sound like a bot.\n"
            '- Type characters that humans normally would use on their phone (e.g., use " instead of \u201c; use en-dash instead of em-dash; don\'t use bold and italic text formatting).\n'
            "- Write the various replies to the post using different writing styles, tones, verbosity levels, endings (closed vs open ended), purpose (affirmative and supportive vs providing new perspectives and insights), etc."
        )
        system_prompt = await self._get_setting(session, "system_prompt", default_prompt)
        if isinstance(system_prompt, str):
            system_prompt_str = system_prompt
        else:
            system_prompt_str = str(system_prompt)

        account = post.account
        username = account.username if account else "unknown"

        user_text = (
            f"Here is the X post from @{username}:\n\n"
            f"```\n{post.text_content or '(no text)'}\n```"
        )

        if suggestion:
            user_text += f"\n\nSuggestion/hint for the replies: {suggestion}"

        messages = [{"role": "system", "content": system_prompt_str}]

        # User message with post text
        messages.append({"role": "user", "content": user_text})

        # Separate user message for images if present
        if post.has_media and post.media_local_paths:
            image_blocks: list[dict] = []
            for path in post.media_local_paths:
                b64 = await self._encode_image_as_base64(path)
                if b64:
                    image_blocks.append({
                        "type": "image_url",
                        "image_url": {"url": b64},
                    })
            if image_blocks:
                messages.append({"role": "user", "content": image_blocks})

        return messages

    async def _encode_image_as_base64(self, file_path: str) -> str | None:
        try:
            path = Path(file_path)
            if not path.exists():
                logger.warning(f"Image file not found: {file_path}")
                return None
            data = path.read_bytes()
            suffix = path.suffix.lower().lstrip(".")
            mime_map = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif", "webp": "webp"}
            mime = mime_map.get(suffix, "jpeg")
            return f"data:image/{mime};base64,{base64.b64encode(data).decode()}"
        except Exception as e:
            logger.error(f"Failed to encode image {file_path}: {e}")
            return None

    async def _call_openrouter_with_retries(self, payload: dict, max_retries: int = 3) -> dict:
        for attempt in range(max_retries):
            try:
                response = await self.http_client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=60.0,
                )
                if response.status_code == 200:
                    return response.json()
                elif response.status_code in (429, 500, 502, 503, 504):
                    wait_time = 2 ** (attempt + 1)
                    logger.warning(f"OpenRouter returned {response.status_code}, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"OpenRouter returned {response.status_code}: {response.text}")
                    raise Exception(f"OpenRouter API error: {response.status_code}")
            except httpx.TimeoutException:
                wait_time = 2 ** (attempt + 1)
                logger.warning(f"OpenRouter request timed out, retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(wait_time)

        raise Exception(f"OpenRouter API failed after {max_retries} retries")
