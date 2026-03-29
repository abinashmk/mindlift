import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Double, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    __table_args__ = (
        Index("idx_risk_assessments_user_time", "user_id", "assessment_time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assessment_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    assessment_scope: Mapped[str] = mapped_column(String(20), nullable=False)
    risk_score: Mapped[float] = mapped_column(Double, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    feature_sleep_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    feature_activity_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    feature_heart_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    feature_social_score: Mapped[float | None] = mapped_column(Double, nullable=True)
    contributing_features: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    baseline_complete: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    user: Mapped["User"] = relationship("User", back_populates="risk_assessments")
