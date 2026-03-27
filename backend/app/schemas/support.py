"""
Pydantic schemas for the support dashboard API.
"""
import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr


# ---------------------------------------------------------------------------
# Support user roles
# ---------------------------------------------------------------------------


class SupportRole(str, Enum):
    support_agent = "support_agent"
    support_manager = "support_manager"
    admin = "admin"
    read_only_auditor = "read_only_auditor"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class SupportLoginRequest(BaseModel):
    email: str
    password: str


class SupportMFAVerifyRequest(BaseModel):
    mfa_token: str   # short-lived support_mfa_pending token
    otp_code: str    # 6-digit TOTP code


class SupportTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class SupportMFAPendingResponse(BaseModel):
    mfa_token: str
    token_type: str = "mfa_pending"
    message: str = "OTP required"


# ---------------------------------------------------------------------------
# Escalations
# ---------------------------------------------------------------------------


class EscalationStatusUpdate(BaseModel):
    status: str  # validated against allowed transitions in the router


class EscalationAssignRequest(BaseModel):
    agent_id: uuid.UUID


class EscalationMessageRequest(BaseModel):
    template_key: str   # must match one of PREDEFINED_TEMPLATES


class SupportEscalationResponse(BaseModel):
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


class PaginatedEscalationResponse(BaseModel):
    items: list[SupportEscalationResponse]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


class AuditLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    actor_type: str
    actor_id: uuid.UUID | None
    action_key: str
    entity_type: str
    entity_id: uuid.UUID | None
    metadata: dict
    created_at: datetime


class PaginatedAuditLogResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int


# ---------------------------------------------------------------------------
# System health
# ---------------------------------------------------------------------------


class SystemHealthResponse(BaseModel):
    db_status: str
    redis_status: str
    open_escalations_new: int
    open_escalations_ack: int
    open_escalations_in_progress: int
    checked_at: datetime


# ---------------------------------------------------------------------------
# Support users (admin management)
# ---------------------------------------------------------------------------


class SupportUserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    email: str
    role: str
    mfa_enabled: bool
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime


class CreateSupportUserRequest(BaseModel):
    email: EmailStr
    password: str
    role: SupportRole
    mfa_enabled: bool = True
