"""syllabus trees, documents and pgvector chunks

Revision ID: 0006_syllabus_and_pages
Revises: 0005_board_sessions
Create Date: 2026-10-26
"""

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006_syllabus_and_pages"
down_revision = "0005_board_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "syllabus_subjects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "student_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(50), nullable=False),
        sa.Column("subject_key", sa.String(50), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="empty"),
        sa.Column("error", sa.String(300), nullable=True),
        sa.Column("sources", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("student_id", "subject_key", name="uq_syllabus_subject_student_key"),
    )
    op.create_index("ix_syllabus_subjects_student_id", "syllabus_subjects", ["student_id"])

    op.create_table(
        "syllabus_chapters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "subject_id",
            sa.String(36),
            sa.ForeignKey("syllabus_subjects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
    )
    op.create_index("ix_syllabus_chapters_subject_id", "syllabus_chapters", ["subject_id"])

    op.create_table(
        "syllabus_topics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "chapter_id",
            sa.String(36),
            sa.ForeignKey("syllabus_chapters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_syllabus_topics_chapter_id", "syllabus_topics", ["chapter_id"])

    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "student_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(50), nullable=False),
        sa.Column("subject_key", sa.String(50), nullable=False),
        sa.Column(
            "topic_id",
            sa.String(36),
            sa.ForeignKey("syllabus_topics.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("file_name", sa.String(200), nullable=False),
        sa.Column("media_type", sa.String(40), nullable=False),
        sa.Column("pages", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(12), nullable=False, server_default="queued"),
        sa.Column("error", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_documents_student_id", "documents", ["student_id"])

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(384), nullable=False),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index(
        "ix_document_chunks_embedding",
        "document_chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    op.drop_table("document_chunks")
    op.drop_table("documents")
    op.drop_table("syllabus_topics")
    op.drop_table("syllabus_chapters")
    op.drop_table("syllabus_subjects")
