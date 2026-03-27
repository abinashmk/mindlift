"""add mfa_secret to support_users

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-25

"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "support_users",
        sa.Column("mfa_secret", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("support_users", "mfa_secret")
