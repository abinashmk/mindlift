import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class RiskLevel(str, Enum):
    UNDEFINED = "UNDEFINED"
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    RED = "RED"


class AssessmentScope(str, Enum):
    daily = "daily"
    intraday = "intraday"


class RiskAssessmentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    assessment_time: datetime
    assessment_scope: str
    risk_score: float
    risk_level: str
    feature_sleep_score: float | None
    feature_activity_score: float | None
    feature_heart_score: float | None
    feature_social_score: float | None
    contributing_features: dict
    model_version: str
    baseline_complete: bool
    created_at: datetime
