"""add parse provenance to jobs

Revision ID: 20260512_02
Revises: 20260512_01
Create Date: 2026-05-12
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260512_02"
down_revision: str | None = "20260512_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("parse_source", sa.String(length=50), nullable=False, server_default="manual"),
    )
    op.add_column("jobs", sa.Column("parse_confidence", sa.Float(), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE jobs
            SET parse_source = CASE
                WHEN source_type = 'jd_pdf' THEN 'rule_based'
                ELSE 'manual'
            END
            """
        )
    )
    op.alter_column("jobs", "parse_source", server_default=None)


def downgrade() -> None:
    op.drop_column("jobs", "parse_confidence")
    op.drop_column("jobs", "parse_source")
