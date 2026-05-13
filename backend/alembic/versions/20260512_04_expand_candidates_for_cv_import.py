"""expand candidates for cv import

Revision ID: 20260512_04
Revises: 20260512_03
Create Date: 2026-05-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260512_04"
down_revision: str | None = "20260512_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="manual"),
    )
    op.add_column("candidates", sa.Column("source_file_name", sa.String(length=255), nullable=True))
    op.add_column(
        "candidates",
        sa.Column("parse_status", sa.String(length=50), nullable=False, server_default="processed"),
    )
    op.add_column(
        "candidates",
        sa.Column("parse_source", sa.String(length=50), nullable=False, server_default="manual"),
    )
    op.add_column("candidates", sa.Column("parse_confidence", sa.Float(), nullable=True))
    op.add_column(
        "candidates",
        sa.Column("graph_sync_status", sa.String(length=50), nullable=False, server_default="pending"),
    )
    op.add_column("candidates", sa.Column("graph_sync_error", sa.Text(), nullable=True))
    op.add_column("candidates", sa.Column("graph_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidates", sa.Column("structured_cv_json", sa.JSON(), nullable=True))
    op.alter_column("candidates", "source_type", server_default=None)
    op.alter_column("candidates", "parse_status", server_default=None)
    op.alter_column("candidates", "parse_source", server_default=None)
    op.alter_column("candidates", "graph_sync_status", server_default=None)


def downgrade() -> None:
    op.drop_column("candidates", "structured_cv_json")
    op.drop_column("candidates", "graph_synced_at")
    op.drop_column("candidates", "graph_sync_error")
    op.drop_column("candidates", "graph_sync_status")
    op.drop_column("candidates", "parse_confidence")
    op.drop_column("candidates", "parse_source")
    op.drop_column("candidates", "parse_status")
    op.drop_column("candidates", "source_file_name")
    op.drop_column("candidates", "source_type")
