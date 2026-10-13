"""whiteboard doubts

Revision ID: 0003_whiteboard_doubts
Revises: 0002_profiles_and_classes
Create Date: 2026-10-13
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0003_whiteboard_doubts"
down_revision = "0002_profiles_and_classes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whiteboard_doubts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "student_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("question", sa.String(500), nullable=False),
        sa.Column("subject", sa.String(60), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="streaming"),
        sa.Column(
            "actions",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("error", sa.String(300), nullable=True),
        sa.Column("model", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_whiteboard_doubts_student_id", "whiteboard_doubts", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_whiteboard_doubts_student_id", table_name="whiteboard_doubts")
    op.drop_table("whiteboard_doubts")
