"""add extract source to imported jobs and candidates

Revision ID: 20260513_02
Revises: 20260513_01
Create Date: 2026-05-13 09:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260513_02"
down_revision = "20260513_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("extract_source", sa.String(length=50), nullable=True))
    op.add_column("candidates", sa.Column("extract_source", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "extract_source")
    op.drop_column("jobs", "extract_source")
