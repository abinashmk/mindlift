import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr


class UserState(str, Enum):
    ONBOARDING = "ONBOARDING"
    ACTIVE = "ACTIVE"
    LIMITED = "LIMITED"
    OFFLINE = "OFFLINE"
    CRISIS = "CRISIS"
    ESCALATED = "ESCALATED"
    DELETED = "DELETED"


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: EmailStr
    email_verified: bool
    age_confirmed_18_plus: bool
    first_name: str | None
    timezone: str
    state: str
    created_at: datetime
    updated_at: datetime


class UpdateUserRequest(BaseModel):
    first_name: str | None = None
    timezone: str | None = None


class ConsentRequest(BaseModel):
    consent_key: str
    consent_value: bool
    policy_version: str


class ConsentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    consent_key: str
    consent_value: bool
    policy_version: str
    created_at: datetime
