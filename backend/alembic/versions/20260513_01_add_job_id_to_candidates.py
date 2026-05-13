"""add job id to candidates

Revision ID: 20260513_01
Revises: 20260512_04
Create Date: 2026-05-13 08:55:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260513_01"
down_revision: str | None = "20260512_04"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("job_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_candidates_job_id"), "candidates", ["job_id"], unique=False)
    op.create_foreign_key(
        "fk_candidates_job_id_jobs",
        "candidates",
        "jobs",
        ["job_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_candidates_job_id_jobs", "candidates", type_="foreignkey")
    op.drop_index(op.f("ix_candidates_job_id"), table_name="candidates")
    op.drop_column("candidates", "job_id")
