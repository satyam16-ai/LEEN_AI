"""board sessions and events (doubts migrated)

Moves every whiteboard doubt into a board session with one "turn" event, then
drops whiteboard_doubts. Downgrade rebuilds whiteboard_doubts from each
session's first turn; later turns (follow-ups) are lost on downgrade.

Revision ID: 0005_board_sessions
Revises: 0004_llm_calls
Create Date: 2026-10-18
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0005_board_sessions"
down_revision = "0004_llm_calls"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "board_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "student_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(16), nullable=False, server_default="doubt"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("subject", sa.String(60), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="streaming"),
        sa.Column("protocol_v", sa.SmallInteger(), nullable=False, server_default="2"),
        sa.Column("model", sa.String(40), nullable=True),
        sa.Column("cache_key", sa.String(64), nullable=True),
        sa.Column("error", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_board_sessions_student_id", "board_sessions", ["student_id"])
    op.create_index("ix_board_sessions_cache_key", "board_sessions", ["cache_key"])
    op.create_table(
        "board_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("board_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False, server_default="turn"),
        sa.Column(
            "payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "seq", name="uq_board_event_seq"),
    )
    op.create_index("ix_board_events_session_id", "board_events", ["session_id"])

    op.execute(
        """
        INSERT INTO board_sessions (id, student_id, kind, title, subject, status, protocol_v,
                                    model, error, created_at, updated_at, completed_at)
        SELECT id, student_id, 'doubt', question, subject, status, 1,
               model, error, created_at, COALESCE(completed_at, created_at), completed_at
        FROM whiteboard_doubts
        """
    )
    op.execute(
        """
        INSERT INTO board_events (id, session_id, seq, kind, payload, created_at)
        SELECT gen_random_uuid()::text, id, 1, 'turn',
               jsonb_build_object('question', question, 'mode', 'ask', 'actions', actions,
                                  'status', status, 'error', error, 'cached', false),
               created_at
        FROM whiteboard_doubts
        """
    )
    op.drop_index("ix_whiteboard_doubts_student_id", table_name="whiteboard_doubts")
    op.drop_table("whiteboard_doubts")


def downgrade() -> None:
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
    op.execute(
        """
        INSERT INTO whiteboard_doubts (id, student_id, question, subject, status, actions,
                                       error, model, created_at, completed_at)
        SELECT s.id, s.student_id, s.title, s.subject, s.status,
               COALESCE(e.payload -> 'actions', '[]'::jsonb),
               s.error, s.model, s.created_at, s.completed_at
        FROM board_sessions s
        LEFT JOIN board_events e ON e.session_id = s.id AND e.seq = 1
        WHERE s.kind = 'doubt'
        """
    )
    op.drop_index("ix_board_events_session_id", table_name="board_events")
    op.drop_table("board_events")
    op.drop_index("ix_board_sessions_cache_key", table_name="board_sessions")
    op.drop_index("ix_board_sessions_student_id", table_name="board_sessions")
    op.drop_table("board_sessions")
