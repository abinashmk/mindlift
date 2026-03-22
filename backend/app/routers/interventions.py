import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.intervention import Intervention, InterventionEvent
from app.models.user import User
from app.schemas.intervention import (
    InterventionEventResponse,
    InterventionResponse,
    UpdateInterventionEventRequest,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/interventions", tags=["interventions"])


@router.get("/active", response_model=list[InterventionResponse])
async def list_active_interventions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Intervention).where(Intervention.active == True).order_by(Intervention.name)
    )
    return result.scalars().all()


@router.patch("/events/{event_id}", response_model=InterventionEventResponse)
async def update_event(
    event_id: uuid.UUID,
    payload: UpdateInterventionEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterventionEvent).where(
            InterventionEvent.id == event_id,
            InterventionEvent.user_id == current_user.id,
        )
    )
    event: InterventionEvent | None = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Intervention event not found.")

    event.status = payload.status.value
    if payload.completed is not None:
        event.completed = payload.completed
    if payload.helpful_rating is not None:
        event.helpful_rating = payload.helpful_rating
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return event
