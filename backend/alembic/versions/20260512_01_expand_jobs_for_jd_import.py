"""expand jobs for jd import

Revision ID: 20260512_01
Revises: 20260511_01
Create Date: 2026-05-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260512_01"
down_revision: str | None = "20260511_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("responsibilities_text", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("qualifications_text", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("raw_jd_text", sa.Text(), nullable=True))
    op.add_column(
        "jobs",
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="manual"),
    )
    op.add_column("jobs", sa.Column("source_file_name", sa.String(length=255), nullable=True))
    op.add_column(
        "jobs",
        sa.Column(
            "parse_status",
            sa.String(length=50),
            nullable=False,
            server_default="processed",
        ),
    )
    op.add_column("jobs", sa.Column("structured_jd_json", sa.JSON(), nullable=True))
    op.alter_column("jobs", "source_type", server_default=None)
    op.alter_column("jobs", "parse_status", server_default=None)


def downgrade() -> None:
    op.drop_column("jobs", "structured_jd_json")
    op.drop_column("jobs", "parse_status")
    op.drop_column("jobs", "source_file_name")
    op.drop_column("jobs", "source_type")
    op.drop_column("jobs", "raw_jd_text")
    op.drop_column("jobs", "qualifications_text")
    op.drop_column("jobs", "responsibilities_text")
