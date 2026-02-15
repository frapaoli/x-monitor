"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-02-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "monitored_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("x_user_id", sa.String(100), nullable=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_post_id", sa.String(100), nullable=True),
    )

    op.create_table(
        "posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("monitored_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("external_post_id", sa.String(100), unique=True, nullable=False),
        sa.Column("post_url", sa.Text(), nullable=False),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("has_media", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("media_urls", postgresql.JSONB(), nullable=True),
        sa.Column("media_local_paths", postgresql.JSONB(), nullable=True),
        sa.Column("post_type", sa.String(20), nullable=False, server_default=sa.text("'tweet'")),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("llm_status", sa.String(20), nullable=False, server_default=sa.text("'pending'")),
    )
    op.create_index("ix_posts_account_posted", "posts", ["account_id", "posted_at"])
    op.create_index("ix_posts_unread", "posts", ["is_read"], postgresql_where=sa.text("is_read = FALSE"))
    op.create_index("ix_posts_llm_status", "posts", ["llm_status"])

    op.create_table(
        "generated_replies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reply_text", sa.Text(), nullable=False),
        sa.Column("reply_index", sa.Integer(), nullable=False),
        sa.Column("model_used", sa.String(100), nullable=False),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("was_used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_replies_post_id", "generated_replies", ["post_id"])

    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
    )

    # Seed default settings
    op.execute(
        """
        INSERT INTO app_settings (key, value) VALUES
        ('polling_interval_minutes', '30'),
        ('openrouter_model', '"anthropic/claude-sonnet-4-20250514"'),
        ('system_prompt', '"You are a knowledgeable and engaging social media user. Generate reply suggestions that are thoughtful, concise, and varied in tone. Some replies should agree, some should offer a different perspective, and some should add new insights. Keep all replies under 280 characters."'),
        ('replies_per_post', '10')
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_table("generated_replies")
    op.drop_table("posts")
    op.drop_table("monitored_accounts")
