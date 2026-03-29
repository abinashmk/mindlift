import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class InterventionType(str, Enum):
    walk = "walk"
    breathing = "breathing"
    sleep_hygiene = "sleep_hygiene"
    grounding = "grounding"
    social_nudge = "social_nudge"


class InterventionStatus(str, Enum):
    TRIGGERED = "TRIGGERED"
    VIEWED = "VIEWED"
    COMPLETED = "COMPLETED"
    DISMISSED = "DISMISSED"
    EXPIRED = "EXPIRED"


class InterventionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    code: str
    name: str
    type: str
    duration_minutes: int
    instructions_markdown: str
    contraindications: list
    active: bool
    created_at: datetime
    updated_at: datetime


class InterventionEventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    intervention_id: uuid.UUID
    triggered_at: datetime
    risk_level: str
    status: str
    completed: bool | None
    helpful_rating: int | None
    created_at: datetime
    updated_at: datetime


class InterventionEventDetailResponse(BaseModel):
    """Joined event + intervention content — used by the mobile detail screen."""

    event_id: str
    code: str
    name: str
    duration_minutes: int
    instructions_markdown: str
    status: str
    triggered_at: datetime
    suggested_reason: str | None = None


class UpdateInterventionEventRequest(BaseModel):
    status: InterventionStatus
    completed: bool | None = None
    helpful_rating: int | None = Field(default=None, ge=1, le=5)
