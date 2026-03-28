import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DriftAlert(Base):
    """
    Records a drift notification that was sent to a user.

    Used to suppress duplicate alerts — we won't re-alert on the same
    metric + direction within 3 days of the last alert.
    """

    __tablename__ = "drift_alerts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "sleep_hours" or "steps"
    metric_key: Mapped[str] = mapped_column(String(50), nullable=False)
    # "decline" or "improvement"
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    rolling_avg: Mapped[float] = mapped_column(Float, nullable=False)
    baseline_mean: Mapped[float] = mapped_column(Float, nullable=False)
    z_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
