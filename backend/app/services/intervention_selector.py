"""
Intervention selection logic for MindLift.

Selection rules per risk level:
- GREEN  : no intervention
- YELLOW : 1 intervention based on highest sub-score
- ORANGE : 2 interventions (YELLOW logic + secondary)
- RED    : escalation only — no interventions

Cooldown: same code cannot auto-trigger more than once in 24 hours.
Safety:   never trigger during CRISIS state.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intervention import Intervention, InterventionEvent
from app.models.user import User
from app.services.risk_engine import RiskLevel, RiskResult


_COOLDOWN_HOURS = 24
_GROUND_COOLDOWN_HOURS = 48

# Intervention codes (match seed data)
WALK_5 = "WALK_5"
BREATHE_3 = "BREATHE_3"
SLEEP_CHECK = "SLEEP_CHECK"
GROUND_54321 = "GROUND_54321"
SOCIAL_TEXT = "SOCIAL_TEXT"


async def _get_intervention_by_code(code: str, db: AsyncSession) -> Intervention | None:
    result = await db.execute(
        select(Intervention).where(
            Intervention.code == code, Intervention.active == True
        )
    )
    return result.scalar_one_or_none()


async def _recently_triggered(
    user_id: uuid.UUID,
    code: str,
    within_hours: int,
    db: AsyncSession,
) -> bool:
    """Return True if the intervention was triggered within the given window."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=within_hours)
    result = await db.execute(
        select(InterventionEvent)
        .join(Intervention, InterventionEvent.intervention_id == Intervention.id)
        .where(
            InterventionEvent.user_id == user_id,
            Intervention.code == code,
            InterventionEvent.triggered_at >= cutoff,
        )
    )
    return result.scalar_one_or_none() is not None


async def _has_social_opt_out(user: User, db: AsyncSession) -> bool:
    """Check whether the user has opted out of social interventions via consent."""
    from app.models.user import UserConsent

    result = await db.execute(
        select(UserConsent)
        .where(
            UserConsent.user_id == user.id,
            UserConsent.consent_key == "social_interventions",
            UserConsent.consent_value == False,
        )
        .order_by(UserConsent.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _create_event(
    user: User,
    intervention: Intervention,
    risk_level: RiskLevel,
    db: AsyncSession,
) -> InterventionEvent:
    now = datetime.now(timezone.utc)
    event = InterventionEvent(
        id=uuid.uuid4(),
        user_id=user.id,
        intervention_id=intervention.id,
        triggered_at=now,
        risk_level=risk_level.value,
        status="TRIGGERED",
        created_at=now,
        updated_at=now,
    )
    db.add(event)
    return event


def _primary_intervention_code(result: RiskResult) -> str:
    """Determine primary intervention code from sub-scores (YELLOW logic)."""
    scores: dict[str, float] = {}
    if result.feature_sleep_score is not None:
        scores["sleep"] = result.feature_sleep_score
    if result.feature_activity_score is not None:
        scores["activity"] = result.feature_activity_score
    if result.feature_heart_score is not None:
        scores["heart"] = result.feature_heart_score
    if result.feature_social_score is not None:
        scores["social"] = result.feature_social_score

    if not scores:
        return BREATHE_3

    highest = max(scores, key=lambda k: scores[k])
    if highest == "sleep":
        return SLEEP_CHECK
    if highest == "activity":
        return WALK_5
    return BREATHE_3


async def select_interventions(
    user: User,
    risk_result: RiskResult,
    db: AsyncSession,
) -> list[InterventionEvent]:
    """
    Select and persist intervention events based on risk result.
    Returns the list of created InterventionEvent objects.
    """
    # Never trigger during CRISIS state.
    if user.state == "CRISIS":
        return []

    level = risk_result.risk_level

    if level == RiskLevel.GREEN or level == RiskLevel.UNDEFINED:
        return []

    if level == RiskLevel.RED:
        # RED => escalation only
        return []

    events: list[InterventionEvent] = []

    # --- Primary intervention ---
    primary_code = _primary_intervention_code(risk_result)
    if not await _recently_triggered(user.id, primary_code, _COOLDOWN_HOURS, db):
        intervention = await _get_intervention_by_code(primary_code, db)
        if intervention:
            events.append(await _create_event(user, intervention, level, db))

    if level == RiskLevel.YELLOW:
        return events

    # --- ORANGE: secondary intervention ---
    # Try GROUND_54321 first (48h cooldown)
    if not await _recently_triggered(user.id, GROUND_54321, _GROUND_COOLDOWN_HOURS, db):
        secondary_code = GROUND_54321
    else:
        # Try SOCIAL_TEXT if user hasn't opted out
        opted_out = await _has_social_opt_out(user, db)
        if not opted_out and not await _recently_triggered(
            user.id, SOCIAL_TEXT, _COOLDOWN_HOURS, db
        ):
            secondary_code = SOCIAL_TEXT
        else:
            secondary_code = BREATHE_3

    if not await _recently_triggered(user.id, secondary_code, _COOLDOWN_HOURS, db):
        intervention = await _get_intervention_by_code(secondary_code, db)
        if intervention:
            events.append(await _create_event(user, intervention, level, db))

    return events
