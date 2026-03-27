"""
Support dashboard API router.

All endpoints require a valid support JWT (issued by /support/auth/login + /support/auth/mfa/verify).
Role checks are enforced per endpoint.

Predefined message templates (from spec):
  - "received"  : "We have received your escalation and are reviewing it."
  - "contact"   : "A support team member will contact you shortly."
  - "emergency" : "Please reach out to emergency services if you are in immediate danger."
"""
import csv
import io
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.core.security import (
    create_support_access_token,
    create_support_mfa_pending_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.escalation import Escalation
from app.models.support import AuditLog, SupportUser
from app.schemas.support import (
    AuditLogResponse,
    CreateSupportUserRequest,
    EscalationAssignRequest,
    EscalationMessageRequest,
    EscalationStatusUpdate,
    PaginatedAuditLogResponse,
    PaginatedEscalationResponse,
    SupportEscalationResponse,
    SupportLoginRequest,
    SupportMFAPendingResponse,
    SupportMFAVerifyRequest,
    SupportTokenResponse,
    SupportUserResponse,
    SystemHealthResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/support", tags=["support"])

bearer_scheme = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Predefined message templates
# ---------------------------------------------------------------------------

PREDEFINED_TEMPLATES: dict[str, str] = {
    "received": "We have received your escalation and are reviewing it.",
    "contact": "A support team member will contact you shortly.",
    "emergency": "Please reach out to emergency services if you are in immediate danger.",
}

# ---------------------------------------------------------------------------
# Valid escalation status transitions
# ---------------------------------------------------------------------------

_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "NEW": {"ACK", "CLOSED_NO_ACTION"},
    "ACK": {"IN_PROGRESS", "CLOSED_NO_ACTION"},
    "IN_PROGRESS": {"RESOLVED"},
    "RESOLVED": set(),
    "CLOSED_NO_ACTION": set(),
}

_TERMINAL_STATUSES = {"RESOLVED", "CLOSED_NO_ACTION"}

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def _support_credentials_error(detail: str = "Invalid or expired token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _get_support_user_from_token(
    credentials: HTTPAuthorizationCredentials | None,
    db: AsyncSession,
) -> SupportUser:
    if credentials is None:
        raise _support_credentials_error()
    try:
        payload = decode_token(credentials.credentials)
    except Exception:
        raise _support_credentials_error()

    if payload.get("type") != "support_access":
        raise _support_credentials_error("Invalid token type.")

    support_user_id = payload.get("sub")
    try:
        uid = uuid.UUID(support_user_id)
    except (TypeError, ValueError):
        raise _support_credentials_error()

    result = await db.execute(select(SupportUser).where(SupportUser.id == uid))
    support_user: SupportUser | None = result.scalar_one_or_none()
    if not support_user or not support_user.is_active:
        raise _support_credentials_error("Support user not found or inactive.")
    return support_user


async def get_current_support_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> SupportUser:
    return await _get_support_user_from_token(credentials, db)


def _require_roles(*roles: str):
    """Dependency factory that checks the current support user has one of the given roles."""

    async def _check(
        current: SupportUser = Depends(get_current_support_user),
    ) -> SupportUser:
        if current.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current.role}' is not permitted for this action.",
            )
        return current

    return _check


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@router.post("/auth/login")
async def support_login(
    payload: SupportLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate a support user.
    - If MFA is enabled, returns a short-lived mfa_pending token.
    - If MFA is disabled, returns a full access token.
    """
    result = await db.execute(select(SupportUser).where(SupportUser.email == payload.email))
    support_user: SupportUser | None = result.scalar_one_or_none()

    if not support_user or not verify_password(payload.password, support_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if not support_user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    if support_user.mfa_enabled:
        mfa_token = create_support_mfa_pending_token(str(support_user.id))
        return SupportMFAPendingResponse(mfa_token=mfa_token)

    # MFA disabled — issue access token directly.
    access_token = create_support_access_token(str(support_user.id), support_user.role)
    return SupportTokenResponse(
        access_token=access_token,
        expires_in=8 * 3600,
    )


@router.post("/auth/mfa/verify", response_model=SupportTokenResponse)
async def support_mfa_verify(
    payload: SupportMFAVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code for a support user. Exchange mfa_pending token for access token."""
    import pyotp

    try:
        token_data = decode_token(payload.mfa_token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired MFA token.")

    if token_data.get("type") != "support_mfa_pending":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    support_user_id = uuid.UUID(token_data["sub"])
    result = await db.execute(select(SupportUser).where(SupportUser.id == support_user_id))
    support_user: SupportUser | None = result.scalar_one_or_none()

    if not support_user or not support_user.is_active:
        raise HTTPException(status_code=404, detail="Support user not found or inactive.")

    if not support_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not configured for this account.")

    totp = pyotp.TOTP(support_user.mfa_secret)
    if not totp.verify(payload.otp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid OTP code.")

    access_token = create_support_access_token(str(support_user.id), support_user.role)
    return SupportTokenResponse(
        access_token=access_token,
        expires_in=8 * 3600,
    )


# ---------------------------------------------------------------------------
# Escalation queue
# ---------------------------------------------------------------------------


@router.get("/escalations", response_model=PaginatedEscalationResponse)
async def list_escalations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_support: SupportUser = Depends(get_current_support_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated escalation queue, ordered RED unresolved newest-first, then ORANGE newest-first.
    Agents see only their assigned escalations; managers and admins see all.
    """
    offset = (page - 1) * page_size

    base_query = select(Escalation).where(
        Escalation.status.notin_(_TERMINAL_STATUSES)
    )

    if current_support.role == "support_agent":
        base_query = base_query.where(Escalation.assigned_agent_id == current_support.id)

    # Order: RED first, then ORANGE, then others; within same level newest first
    from sqlalchemy import case

    priority = case(
        (Escalation.risk_level == "RED", 1),
        (Escalation.risk_level == "ORANGE", 2),
        else_=3,
    )
    base_query = base_query.order_by(priority, Escalation.created_at.desc())

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    result = await db.execute(base_query.offset(offset).limit(page_size))
    items = result.scalars().all()

    return PaginatedEscalationResponse(
        items=list(items),
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/escalations/export")
async def export_escalations_csv(
    current_support: SupportUser = Depends(
        _require_roles("support_manager", "admin")
    ),
    db: AsyncSession = Depends(get_db),
):
    """Export all escalations as CSV. Manager+ only."""
    result = await db.execute(
        select(Escalation).order_by(Escalation.created_at.desc())
    )
    escalations = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "user_id", "source", "status", "risk_level",
        "assigned_agent_id", "created_at", "updated_at", "resolved_at",
    ])
    for e in escalations:
        writer.writerow([
            str(e.id), str(e.user_id), e.source, e.status, e.risk_level,
            str(e.assigned_agent_id) if e.assigned_agent_id else "",
            e.created_at.isoformat(), e.updated_at.isoformat(),
            e.resolved_at.isoformat() if e.resolved_at else "",
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=escalations.csv"},
    )


@router.get("/escalations/{escalation_id}", response_model=SupportEscalationResponse)
async def get_escalation_detail(
    escalation_id: uuid.UUID,
    current_support: SupportUser = Depends(get_current_support_user),
    db: AsyncSession = Depends(get_db),
):
    """Full escalation detail. Agents can only view their own assigned escalations."""
    result = await db.execute(
        select(Escalation).where(Escalation.id == escalation_id)
    )
    escalation: Escalation | None = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found.")

    if (
        current_support.role == "support_agent"
        and escalation.assigned_agent_id != current_support.id
    ):
        raise HTTPException(status_code=403, detail="Not assigned to this escalation.")

    return escalation


@router.patch("/escalations/{escalation_id}/status", response_model=SupportEscalationResponse)
async def update_escalation_status(
    escalation_id: uuid.UUID,
    payload: EscalationStatusUpdate,
    current_support: SupportUser = Depends(get_current_support_user),
    db: AsyncSession = Depends(get_db),
):
    """Transition escalation status. Only valid transitions are allowed."""
    result = await db.execute(
        select(Escalation).where(Escalation.id == escalation_id)
    )
    escalation: Escalation | None = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found.")

    allowed = _ALLOWED_TRANSITIONS.get(escalation.status, set())
    if payload.status not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Transition from '{escalation.status}' to '{payload.status}' is not allowed.",
        )

    now = datetime.now(timezone.utc)
    escalation.status = payload.status
    escalation.updated_at = now
    if payload.status in _TERMINAL_STATUSES:
        escalation.resolved_at = now

    await write_audit_log(
        db,
        actor_type="support_user",
        actor_id=current_support.id,
        action_key="escalation.status_changed",
        entity_type="escalation",
        entity_id=escalation.id,
        extra={"new_status": payload.status},
    )
    await db.flush()
    return escalation


@router.patch("/escalations/{escalation_id}/assign", response_model=SupportEscalationResponse)
async def assign_escalation(
    escalation_id: uuid.UUID,
    payload: EscalationAssignRequest,
    current_support: SupportUser = Depends(
        _require_roles("support_manager", "admin")
    ),
    db: AsyncSession = Depends(get_db),
):
    """Assign escalation to an agent. Manager+ only."""
    # Verify target agent exists and is active.
    agent_result = await db.execute(
        select(SupportUser).where(
            SupportUser.id == payload.agent_id,
            SupportUser.is_active == True,
        )
    )
    agent: SupportUser | None = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Target agent not found or inactive.")

    result = await db.execute(
        select(Escalation).where(Escalation.id == escalation_id)
    )
    escalation: Escalation | None = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found.")

    escalation.assigned_agent_id = payload.agent_id
    escalation.updated_at = datetime.now(timezone.utc)

    await write_audit_log(
        db,
        actor_type="support_user",
        actor_id=current_support.id,
        action_key="escalation.assigned",
        entity_type="escalation",
        entity_id=escalation.id,
        extra={"assigned_to": str(payload.agent_id)},
    )
    await db.flush()
    return escalation


@router.post("/escalations/{escalation_id}/message", status_code=status.HTTP_201_CREATED)
async def send_template_message(
    escalation_id: uuid.UUID,
    payload: EscalationMessageRequest,
    current_support: SupportUser = Depends(get_current_support_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a predefined template message on an escalation. Only valid template keys accepted."""
    if payload.template_key not in PREDEFINED_TEMPLATES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown template key '{payload.template_key}'. "
                f"Valid keys: {list(PREDEFINED_TEMPLATES.keys())}"
            ),
        )

    result = await db.execute(
        select(Escalation).where(Escalation.id == escalation_id)
    )
    escalation: Escalation | None = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found.")

    message_text = PREDEFINED_TEMPLATES[payload.template_key]

    # Stub: log message; wire to real push/notification in production.
    logger.info(
        "[support-message] escalation=%s user=%s template=%s message=%r",
        escalation_id,
        escalation.user_id,
        payload.template_key,
        message_text,
    )

    await write_audit_log(
        db,
        actor_type="support_user",
        actor_id=current_support.id,
        action_key="escalation.message_sent",
        entity_type="escalation",
        entity_id=escalation.id,
        extra={"template_key": payload.template_key, "message": message_text},
    )
    await db.flush()

    return {
        "template_key": payload.template_key,
        "message": message_text,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------


@router.get("/audit-logs", response_model=PaginatedAuditLogResponse)
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_support: SupportUser = Depends(
        _require_roles("admin", "read_only_auditor")
    ),
    db: AsyncSession = Depends(get_db),
):
    """Paginated audit logs. Admin and read_only_auditor only."""
    count = (
        await db.execute(select(func.count()).select_from(AuditLog))
    ).scalar_one()

    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()

    return PaginatedAuditLogResponse(items=list(items), total=count)


# ---------------------------------------------------------------------------
# System health
# ---------------------------------------------------------------------------


@router.get("/system-health", response_model=SystemHealthResponse)
async def system_health(
    current_support: SupportUser = Depends(_require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """DB + Redis ping, open escalation counts. Admin only."""
    from app.config import settings

    # DB ping
    db_status = "ok"
    try:
        await db.execute(select(func.now()))
    except Exception as exc:
        db_status = f"error: {exc}"

    # Redis ping
    redis_status = "ok"
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        await r.ping()
        await r.aclose()
    except Exception as exc:
        redis_status = f"error: {exc}"

    # Open escalation counts
    async def _count(s: str) -> int:
        return (
            await db.execute(
                select(func.count()).select_from(Escalation).where(Escalation.status == s)
            )
        ).scalar_one()

    new_count = await _count("NEW")
    ack_count = await _count("ACK")
    in_progress_count = await _count("IN_PROGRESS")

    return SystemHealthResponse(
        db_status=db_status,
        redis_status=redis_status,
        open_escalations_new=new_count,
        open_escalations_ack=ack_count,
        open_escalations_in_progress=in_progress_count,
        checked_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Support user management (admin only)
# ---------------------------------------------------------------------------


@router.get("/users", response_model=list[SupportUserResponse])
async def list_support_users(
    current_support: SupportUser = Depends(_require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all support users. Admin only."""
    result = await db.execute(
        select(SupportUser).order_by(SupportUser.created_at.desc())
    )
    return result.scalars().all()


@router.post("/users", response_model=SupportUserResponse, status_code=status.HTTP_201_CREATED)
async def create_support_user(
    payload: CreateSupportUserRequest,
    current_support: SupportUser = Depends(_require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new support user. Admin only."""
    existing = await db.execute(
        select(SupportUser).where(SupportUser.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered.")

    now = datetime.now(timezone.utc)
    new_user = SupportUser(
        id=uuid.uuid4(),
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
        mfa_enabled=payload.mfa_enabled,
        is_active=True,
        must_change_password=True,
        created_at=now,
        updated_at=now,
    )
    db.add(new_user)

    await write_audit_log(
        db,
        actor_type="support_user",
        actor_id=current_support.id,
        action_key="support_user.created",
        entity_type="support_user",
        entity_id=new_user.id,
        extra={"email": payload.email, "role": payload.role.value},
    )
    await db.flush()
    return new_user


@router.patch("/users/{user_id}/deactivate", response_model=SupportUserResponse)
async def deactivate_support_user(
    user_id: uuid.UUID,
    current_support: SupportUser = Depends(_require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a support user. Admin only. Cannot deactivate yourself."""
    if user_id == current_support.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account.")

    result = await db.execute(select(SupportUser).where(SupportUser.id == user_id))
    target: SupportUser | None = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Support user not found.")

    target.is_active = False
    target.updated_at = datetime.now(timezone.utc)

    await write_audit_log(
        db,
        actor_type="support_user",
        actor_id=current_support.id,
        action_key="support_user.deactivated",
        entity_type="support_user",
        entity_id=target.id,
        extra={"email": target.email},
    )
    await db.flush()
    return target


# ─── Crisis keyword management (admin only) ───────────────────────────────────


@router.get("/crisis-keywords", tags=["admin"])
async def get_crisis_keywords(
    current_support: SupportUser = Depends(_require_roles("admin")),
):
    """Return the current server-side crisis keyword list. Admin only."""
    from app.services.crisis_classifier import get_crisis_keywords
    return {"keywords": get_crisis_keywords()}


@router.put("/crisis-keywords", tags=["admin"])
async def update_crisis_keywords(
    payload: dict,
    current_support: SupportUser = Depends(_require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Overwrite the server-side crisis keyword list (spec §24.3).
    Expects: {"keywords": ["phrase one", "phrase two", ...]}
    Admin only. Changes take effect within 60 seconds on all workers.
    """
    keywords: list[str] = payload.get("keywords", [])
    if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
        raise HTTPException(status_code=422, detail="keywords must be a list of strings.")
    if len(keywords) == 0:
        raise HTTPException(status_code=422, detail="keywords list must not be empty.")

    from app.services.crisis_classifier import set_crisis_keywords
    set_crisis_keywords(keywords)

    await write_audit_log(
        db,
        actor_type="support_user",
        actor_id=current_support.id,
        action_key="admin.crisis_keywords_updated",
        entity_type="system",
        entity_id=None,
        extra={"count": len(keywords)},
    )
    await db.flush()
    return {"updated": True, "count": len(keywords)}

