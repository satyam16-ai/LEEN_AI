"""profiles, parent links, classrooms; user avatar

Revision ID: 0002_profiles_and_classes
Revises: 0001_auth_schema
Create Date: 2026-10-13
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0002_profiles_and_classes"
down_revision = "0001_auth_schema"
branch_labels = None
depends_on = None


def _user_fk() -> sa.ForeignKey:
    return sa.ForeignKey("users.id", ondelete="CASCADE")


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_filename", sa.String(64), nullable=True))

    op.create_table(
        "student_profiles",
        sa.Column("user_id", sa.String(36), _user_fk(), primary_key=True),
        sa.Column("grade", sa.Integer(), nullable=True),
        sa.Column("board", sa.String(20), nullable=True),
        sa.Column("school_name", sa.String(150), nullable=True),
        sa.Column(
            "subjects",
            postgresql.ARRAY(sa.String(50)),
            nullable=False,
            server_default=sa.text("'{}'::varchar[]"),
        ),
        sa.Column("learning_level", sa.String(20), nullable=True),
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("link_code", sa.String(12), nullable=True, unique=True),
        sa.Column("link_code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "parent_student_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("parent_id", sa.String(36), _user_fk(), nullable=False),
        sa.Column("student_id", sa.String(36), _user_fk(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("parent_id", "student_id", name="uq_parent_student"),
    )
    op.create_index("ix_parent_student_links_parent_id", "parent_student_links", ["parent_id"])
    op.create_index("ix_parent_student_links_student_id", "parent_student_links", ["student_id"])

    op.create_table(
        "classrooms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("teacher_id", sa.String(36), _user_fk(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("subject", sa.String(60), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("join_code", sa.String(12), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_classrooms_teacher_id", "classrooms", ["teacher_id"])

    op.create_table(
        "class_enrollments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "classroom_id",
            sa.String(36),
            sa.ForeignKey("classrooms.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("student_id", sa.String(36), _user_fk(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("classroom_id", "student_id", name="uq_class_student"),
    )
    op.create_index("ix_class_enrollments_classroom_id", "class_enrollments", ["classroom_id"])
    op.create_index("ix_class_enrollments_student_id", "class_enrollments", ["student_id"])


def downgrade() -> None:
    op.drop_table("class_enrollments")
    op.drop_table("classrooms")
    op.drop_table("parent_student_links")
    op.drop_table("student_profiles")
    op.drop_column("users", "avatar_filename")
