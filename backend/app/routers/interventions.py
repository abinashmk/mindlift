import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.intervention import Intervention, InterventionEvent
from app.models.user import User
from app.schemas.intervention import (
    InterventionEventDetailResponse,
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
        select(Intervention)
        .where(Intervention.active == True)
        .order_by(Intervention.name)
    )
    return result.scalars().all()


@router.get("/events", response_model=list[InterventionEventResponse])
async def list_intervention_events(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's intervention events, newest first."""
    result = await db.execute(
        select(InterventionEvent)
        .where(InterventionEvent.user_id == current_user.id)
        .order_by(InterventionEvent.triggered_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/events/{event_id}", response_model=InterventionEventDetailResponse)
async def get_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a single intervention event with joined intervention content."""
    result = await db.execute(
        select(InterventionEvent, Intervention)
        .join(Intervention, InterventionEvent.intervention_id == Intervention.id)
        .where(
            InterventionEvent.id == event_id,
            InterventionEvent.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Intervention event not found.")
    event, intervention = row
    return InterventionEventDetailResponse(
        event_id=str(event.id),
        code=intervention.code,
        name=intervention.name,
        duration_minutes=intervention.duration_minutes,
        instructions_markdown=intervention.instructions_markdown,
        status=event.status,
        triggered_at=event.triggered_at,
        suggested_reason=None,
    )


@router.patch("/events/{event_id}", response_model=InterventionEventDetailResponse)
async def update_event(
    event_id: uuid.UUID,
    payload: UpdateInterventionEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterventionEvent, Intervention)
        .join(Intervention, InterventionEvent.intervention_id == Intervention.id)
        .where(
            InterventionEvent.id == event_id,
            InterventionEvent.user_id == current_user.id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Intervention event not found.")
    event, intervention = row

    event.status = payload.status.value
    if payload.completed is not None:
        event.completed = payload.completed
    if payload.helpful_rating is not None:
        event.helpful_rating = payload.helpful_rating
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return InterventionEventDetailResponse(
        event_id=str(event.id),
        code=intervention.code,
        name=intervention.name,
        duration_minutes=intervention.duration_minutes,
        instructions_markdown=intervention.instructions_markdown,
        status=event.status,
        triggered_at=event.triggered_at,
        suggested_reason=None,
    )


# ---------------------------------------------------------------------------
# Convenience action endpoints
# ---------------------------------------------------------------------------


async def _get_event_for_user(
    event_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> InterventionEvent:
    result = await db.execute(
        select(InterventionEvent).where(
            InterventionEvent.id == event_id,
            InterventionEvent.user_id == user.id,
        )
    )
    event: InterventionEvent | None = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Intervention event not found.")
    return event


@router.post("/events/{event_id}/view", response_model=InterventionEventResponse)
async def view_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an intervention event as VIEWED."""
    event = await _get_event_for_user(event_id, current_user, db)
    event.status = "VIEWED"
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return event


@router.post("/events/{event_id}/complete", response_model=InterventionEventResponse)
async def complete_event(
    event_id: uuid.UUID,
    helpful_rating: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an intervention event as COMPLETED with optional helpfulness rating (1-5)."""
    if helpful_rating is not None and not (1 <= helpful_rating <= 5):
        raise HTTPException(
            status_code=422, detail="helpful_rating must be between 1 and 5."
        )
    event = await _get_event_for_user(event_id, current_user, db)
    event.status = "COMPLETED"
    event.completed = True
    if helpful_rating is not None:
        event.helpful_rating = helpful_rating
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return event


@router.post("/events/{event_id}/dismiss", response_model=InterventionEventResponse)
async def dismiss_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an intervention event as DISMISSED."""
    event = await _get_event_for_user(event_id, current_user, db)
    event.status = "DISMISSED"
    event.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return event
