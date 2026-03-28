"""add stress_source to daily_metrics

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_metrics",
        sa.Column("stress_source", sa.String(30), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("daily_metrics", "stress_source")
