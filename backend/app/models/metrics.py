import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    Date,
    DateTime,
    Double,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    __table_args__ = (
        UniqueConstraint("user_id", "metric_date", name="uq_daily_metrics_user_date"),
        Index("idx_daily_metrics_user_date", "user_id", "metric_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    metric_date: Mapped[date] = mapped_column(Date, nullable=False)
    steps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resting_heart_rate_bpm: Mapped[float | None] = mapped_column(Double, nullable=True)
    average_heart_rate_bpm: Mapped[float | None] = mapped_column(Double, nullable=True)
    hrv_ms: Mapped[float | None] = mapped_column(Double, nullable=True)
    sleep_hours: Mapped[float | None] = mapped_column(Double, nullable=True)
    sleep_source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    screen_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_home_ratio: Mapped[float | None] = mapped_column(Double, nullable=True)
    location_transitions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    noise_level_db_avg: Mapped[float | None] = mapped_column(Double, nullable=True)
    mood_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stress_source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    meeting_hours: Mapped[float | None] = mapped_column(Double, nullable=True)
    communication_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship("User", back_populates="daily_metrics")


class Baseline(Base):
    __tablename__ = "baselines"
    __table_args__ = (
        UniqueConstraint("user_id", "feature_key", name="uq_baselines_user_feature"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    feature_key: Mapped[str] = mapped_column(String(100), nullable=False)
    mean_value: Mapped[float] = mapped_column(Double, nullable=False)
    std_value: Mapped[float] = mapped_column(Double, nullable=False)
    valid_days: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    baseline_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship("User", back_populates="baselines")
