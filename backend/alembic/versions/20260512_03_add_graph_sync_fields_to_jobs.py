"""add graph sync fields to jobs

Revision ID: 20260512_03
Revises: 20260512_02
Create Date: 2026-05-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260512_03"
down_revision: str | None = "20260512_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("graph_sync_status", sa.String(length=50), nullable=False, server_default="pending"),
    )
    op.add_column("jobs", sa.Column("graph_sync_error", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("graph_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.alter_column("jobs", "graph_sync_status", server_default=None)


def downgrade() -> None:
    op.drop_column("jobs", "graph_synced_at")
    op.drop_column("jobs", "graph_sync_error")
    op.drop_column("jobs", "graph_sync_status")
