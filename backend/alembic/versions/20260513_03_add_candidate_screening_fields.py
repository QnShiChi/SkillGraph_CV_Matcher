"""add candidate screening fields

Revision ID: 20260513_03
Revises: 20260513_02
Create Date: 2026-05-13 13:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260513_03"
down_revision = "20260513_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("verification_status", sa.String(length=50), nullable=True))
    op.add_column("candidates", sa.Column("verification_score", sa.Float(), nullable=True))
    op.add_column("candidates", sa.Column("verification_summary", sa.Text(), nullable=True))
    op.add_column("candidates", sa.Column("verified_links_json", sa.JSON(), nullable=True))
    op.add_column("candidates", sa.Column("screening_decision", sa.String(length=50), nullable=True))
    op.add_column("candidates", sa.Column("screening_reason", sa.Text(), nullable=True))
    op.add_column("candidates", sa.Column("match_score", sa.Float(), nullable=True))
    op.add_column("candidates", sa.Column("match_rank", sa.Integer(), nullable=True))
    op.add_column("candidates", sa.Column("match_summary", sa.Text(), nullable=True))
    op.add_column("candidates", sa.Column("final_report_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "final_report_json")
    op.drop_column("candidates", "match_summary")
    op.drop_column("candidates", "match_rank")
    op.drop_column("candidates", "match_score")
    op.drop_column("candidates", "screening_reason")
    op.drop_column("candidates", "screening_decision")
    op.drop_column("candidates", "verified_links_json")
    op.drop_column("candidates", "verification_summary")
    op.drop_column("candidates", "verification_score")
    op.drop_column("candidates", "verification_status")
