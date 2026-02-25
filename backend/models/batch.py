import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# Many-to-many junction table
retrieval_batch_accounts = Table(
    "retrieval_batch_accounts",
    Base.metadata,
    Column("batch_id", UUID(as_uuid=True), ForeignKey("retrieval_batches.id", ondelete="CASCADE"), primary_key=True),
    Column("account_id", UUID(as_uuid=True), ForeignKey("monitored_accounts.id", ondelete="CASCADE"), primary_key=True),
)


class RetrievalBatch(Base):
    __tablename__ = "retrieval_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    since_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    until_dt: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    accounts = relationship("MonitoredAccount", secondary=retrieval_batch_accounts)
    posts = relationship("Post", back_populates="batch", cascade="all, delete-orphan")
