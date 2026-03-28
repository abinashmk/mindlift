"""add drift_alerts table

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-28

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "drift_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("metric_key", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("rolling_avg", sa.Float, nullable=False),
        sa.Column("baseline_mean", sa.Float, nullable=False),
        sa.Column("z_score", sa.Float, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_drift_alerts_user_id", "drift_alerts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_drift_alerts_user_id", table_name="drift_alerts")
    op.drop_table("drift_alerts")
