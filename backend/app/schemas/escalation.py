import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class EscalationSource(str, Enum):
    risk_engine = "risk_engine"
    crisis_classifier = "crisis_classifier"
    manual_user_request = "manual_user_request"
    support_agent = "support_agent"


class EscalationStatus(str, Enum):
    NEW = "NEW"
    ACK = "ACK"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED_NO_ACTION = "CLOSED_NO_ACTION"


class CreateEscalationRequest(BaseModel):
    source: EscalationSource
    risk_level: str
    packet: dict


class EscalationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    source: str
    status: str
    risk_level: str
    packet: dict
    assigned_agent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
