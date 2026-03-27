import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.database import get_db
from app.models.escalation import Escalation
from app.models.user import User
from app.schemas.escalation import CreateEscalationRequest, EscalationResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/escalations", tags=["escalations"])


@router.post("", response_model=EscalationResponse, status_code=status.HTTP_201_CREATED)
async def create_escalation(
    payload: CreateEscalationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    escalation = Escalation(
        id=uuid.uuid4(),
        user_id=current_user.id,
        source=payload.source.value,
        status="NEW",
        risk_level=payload.risk_level,
        packet=payload.packet,
        created_at=now,
        updated_at=now,
    )
    db.add(escalation)

    # Update user state to ESCALATED if not already in CRISIS.
    if current_user.state not in ("CRISIS", "ESCALATED"):
        current_user.state = "ESCALATED"
        current_user.updated_at = now

    await write_audit_log(
        db,
        actor_type="user",
        actor_id=current_user.id,
        action_key="escalation.created",
        entity_type="escalation",
        entity_id=escalation.id,
        extra={"source": payload.source.value, "risk_level": payload.risk_level},
    )
    await db.flush()
    return escalation


@router.get("/{escalation_id}", response_model=EscalationResponse)
async def get_escalation(
    escalation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Escalation).where(
            Escalation.id == escalation_id,
            Escalation.user_id == current_user.id,
        )
    )
    escalation: Escalation | None = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=404, detail="Escalation not found.")
    return escalation
