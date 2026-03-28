"""add meeting_hours to daily_metrics

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "daily_metrics",
        sa.Column("meeting_hours", sa.Double(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("daily_metrics", "meeting_hours")
