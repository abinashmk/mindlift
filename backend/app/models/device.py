import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (Index("idx_devices_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    os_version: Mapped[str] = mapped_column(String(50), nullable=False)
    app_version: Mapped[str] = mapped_column(String(50), nullable=False)
    push_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    motion_permission: Mapped[bool] = mapped_column(Boolean, nullable=False)
    health_permission: Mapped[bool] = mapped_column(Boolean, nullable=False)
    location_permission: Mapped[bool] = mapped_column(Boolean, nullable=False)
    noise_permission: Mapped[bool] = mapped_column(Boolean, nullable=False)
    biometric_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    user: Mapped["User"] = relationship("User", back_populates="devices")
