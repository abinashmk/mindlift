"""
Risk assessment endpoints.

GET /risk/current  — latest risk assessment for the current user
GET /risk/history  — last N days of risk assessments (default 30, max 90)
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.risk import RiskAssessment
from app.models.user import User
from app.schemas.risk import RiskAssessmentResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/risk", tags=["risk"])


@router.get("/current", response_model=RiskAssessmentResponse)
async def get_current_risk(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent risk assessment for the authenticated user."""
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.user_id == current_user.id)
        .order_by(RiskAssessment.assessment_time.desc())
        .limit(1)
    )
    assessment: RiskAssessment | None = result.scalar_one_or_none()
    if not assessment:
        raise HTTPException(status_code=404, detail="No risk assessment found.")
    return assessment


@router.get("/history", response_model=list[RiskAssessmentResponse])
async def get_risk_history(
    days: int = Query(default=30, ge=1, le=90, description="Number of past days to return."),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return risk assessments for the past N days, newest first."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(RiskAssessment)
        .where(
            RiskAssessment.user_id == current_user.id,
            RiskAssessment.assessment_time >= cutoff,
        )
        .order_by(RiskAssessment.assessment_time.desc())
    )
    return result.scalars().all()
