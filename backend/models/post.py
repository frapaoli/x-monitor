import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        Index("ix_posts_account_posted", "account_id", "posted_at"),
        Index("ix_posts_unread", "is_read", postgresql_where="is_read = FALSE"),
        Index("ix_posts_llm_status", "llm_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("monitored_accounts.id", ondelete="CASCADE"), nullable=False
    )
    external_post_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    post_url: Mapped[str] = mapped_column(Text, nullable=False)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_media: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    media_urls: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    media_local_paths: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    post_type: Mapped[str] = mapped_column(String(20), nullable=False, default="tweet")
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    llm_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    account = relationship("MonitoredAccount", back_populates="posts")
    replies = relationship("GeneratedReply", back_populates="post", cascade="all, delete-orphan")
