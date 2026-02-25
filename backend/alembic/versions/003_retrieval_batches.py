"""Add retrieval batches, remove scheduled polling columns

Revision ID: 003
Revises: 002
Create Date: 2026-02-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Delete existing posts/replies data (paradigm shift — old flat feed no longer applies)
    op.execute("DELETE FROM generated_replies")
    op.execute("DELETE FROM posts")

    # Create retrieval_batches table
    op.create_table(
        "retrieval_batches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("since_dt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("until_dt", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column("error_message", sa.Text(), nullable=True),
    )

    # Create junction table
    op.create_table(
        "retrieval_batch_accounts",
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("retrieval_batches.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("monitored_accounts.id", ondelete="CASCADE"), primary_key=True),
    )

    # Alter posts table — add batch_id
    op.add_column("posts", sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("retrieval_batches.id", ondelete="CASCADE"), nullable=True))
    op.create_index("ix_posts_batch_id", "posts", ["batch_id"])

    # Drop is_read, is_archived columns and old index
    op.drop_index("ix_posts_unread", table_name="posts")
    op.drop_column("posts", "is_read")
    op.drop_column("posts", "is_archived")

    # Remove unique constraint on external_post_id (inline unique=True → PostgreSQL names it {table}_{col}_key)
    op.drop_constraint("posts_external_post_id_key", "posts", type_="unique")

    # Alter monitored_accounts — drop polling-related columns
    op.drop_column("monitored_accounts", "last_checked_at")
    op.drop_column("monitored_accounts", "last_post_id")

    # Delete polling_interval_minutes from app_settings
    op.execute("DELETE FROM app_settings WHERE key = 'polling_interval_minutes'")


def downgrade() -> None:
    # Re-add polling columns to monitored_accounts
    op.add_column("monitored_accounts", sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("monitored_accounts", sa.Column("last_post_id", sa.String(100), nullable=True))

    # Re-add is_read, is_archived to posts
    op.add_column("posts", sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("posts", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.create_index("ix_posts_unread", "posts", ["is_read"], postgresql_where=sa.text("is_read = FALSE"))

    # Re-add unique constraint
    op.create_unique_constraint("posts_external_post_id_key", "posts", ["external_post_id"])

    # Drop batch_id from posts
    op.drop_index("ix_posts_batch_id", table_name="posts")
    op.drop_column("posts", "batch_id")

    # Drop junction and batches tables
    op.drop_table("retrieval_batch_accounts")
    op.drop_table("retrieval_batches")
