"""
GET /insights/pattern — active drift pattern with a plain-language explanation.

Queries the most recent DriftAlert rows (last 3 days) for the current user,
then generates a headline and explanation that describes the combination of
active signals so the mobile app can show an insight card.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.drift_alert import DriftAlert
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(prefix="/insights", tags=["insights"])

# ─── Response schema ──────────────────────────────────────────────────────────


class PatternSignal(BaseModel):
    metric_key: str  # "sleep_hours" | "steps"
    direction: str  # "decline" | "improvement"
    label: str  # "Sleep" | "Activity"
    delta_pct: float  # (rolling_avg - baseline_mean) / baseline_mean * 100


class PatternInsightResponse(BaseModel):
    has_pattern: bool
    headline: str
    explanation: str
    signals: list[PatternSignal]


# ─── Pattern copy ─────────────────────────────────────────────────────────────
# Keyed by frozenset of "metric:direction" strings present in the active alerts.

_LABELS = {"sleep_hours": "Sleep", "steps": "Activity", "meeting_hours": "Meetings"}

_COPY: dict[frozenset, tuple[str, str]] = {
    frozenset({"sleep_hours:decline", "steps:decline"}): (
        "Classic burnout pattern detected",
        "Your sleep and movement have both dropped below your normal levels — "
        "a combination that's strongly linked to burnout in students and professionals. "
        "Your body is signalling it needs recovery. Even one early night or a "
        "10-minute walk today can start to shift this.",
    ),
    frozenset({"sleep_hours:decline", "steps:improvement"}): (
        "Pushing hard, but rest is falling behind",
        "You've been staying active, but your sleep has dipped below your baseline. "
        "High output without recovery is a common path to burnout. "
        "Prioritising sleep right now will actually protect your performance — "
        "not undermine it.",
    ),
    frozenset({"sleep_hours:improvement", "steps:decline"}): (
        "Recovery mode — your body is catching up",
        "Your sleep has improved, which is a strong sign your body is recovering. "
        "Your movement has slowed — that's often normal during a high-pressure period. "
        "Even light activity can help you re-energise without adding to your load.",
    ),
    frozenset({"sleep_hours:improvement", "steps:improvement"}): (
        "You're in a strong recovery window",
        "Both your sleep and activity are above your normal levels — "
        "this is your body bouncing back. This is a good time to tackle demanding "
        "work or study while your energy and focus are higher.",
    ),
    frozenset({"sleep_hours:decline"}): (
        "Sleep is the first thing burnout targets",
        "Your sleep has dropped below your personal baseline over the past few days. "
        "Poor sleep compounds stress — it makes deadlines feel bigger and decisions "
        "harder. A consistent wind-down routine, even 20 minutes, can make a "
        "meaningful difference.",
    ),
    frozenset({"sleep_hours:improvement"}): (
        "Better sleep is your best performance tool",
        "Your sleep has been better than your baseline recently. "
        "Good sleep is directly tied to focus, decision-making, and stress resilience — "
        "all things that matter when you're under pressure. This is worth protecting.",
    ),
    frozenset({"steps:decline"}): (
        "Movement has dropped — common under high pressure",
        "Your step count has been below your normal level. When deadlines pile up, "
        "movement is usually the first thing that gets cut — but it's also one of "
        "the most effective ways to clear mental load. Even a short walk outside helps.",
    ),
    frozenset({"steps:improvement"}): (
        "Staying active is helping you cope",
        "Your activity has been above your normal levels recently. "
        "Regular movement is one of the most evidence-backed ways to manage "
        "work and study stress — keep it in your routine.",
    ),
    # ── Meeting hours combinations ─────────────────────────────────────────────
    frozenset({"meeting_hours:improvement", "sleep_hours:decline"}): (
        "Back-to-back meetings are eating into your recovery",
        "Your calendar has been unusually packed while your sleep has dropped below "
        "your baseline — a high-risk combination for burnout. Meeting overload leaves "
        "little time to decompress, and poor sleep compounds the cognitive toll. "
        "Try to block at least one meeting-free hour today and protect your bedtime.",
    ),
    frozenset({"meeting_hours:improvement", "steps:decline"}): (
        "Heavy schedule is crowding out movement",
        "Your meeting load is above normal and your step count has dropped — "
        "a pattern where calendar pressure displaces recovery habits. "
        "Even a 5-minute walk between calls can help break the cycle.",
    ),
    frozenset({"meeting_hours:improvement", "sleep_hours:decline", "steps:decline"}): (
        "High meeting load, low recovery — watch for burnout",
        "Your calendar is unusually full, your sleep is below your baseline, and your "
        "movement has dropped off — all three signals pointing toward a sustained "
        "burnout risk. This combination is worth acting on: protect one recovery block "
        "today, even if it's just stepping away from screens for 15 minutes.",
    ),
    frozenset({"meeting_hours:improvement", "sleep_hours:improvement"}): (
        "Heavy meetings, but sleep is holding up",
        "Your meeting load is above your normal level, but your sleep has actually "
        "improved — a resilient pattern. Keep protecting your sleep routine; "
        "it's your best buffer against the cognitive load of a packed calendar.",
    ),
    frozenset({"meeting_hours:improvement", "steps:improvement"}): (
        "Busy but moving — a healthy balance",
        "Your calendar has been packed and you've still kept your step count up. "
        "Physical activity is actively counteracting the stress of a heavy meeting load. "
        "Keep it up — this is exactly the kind of habit that prevents burnout.",
    ),
    frozenset({"meeting_hours:improvement"}): (
        "Heavy meeting load detected",
        "Your calendar has been unusually packed over the past few days. "
        "Research consistently links meeting overload to cognitive fatigue and reduced "
        "focus. Try to protect at least one deep-work block or recovery period today.",
    ),
    frozenset({"meeting_hours:decline"}): (
        "Schedule is lighter than usual",
        "Your meeting load has dropped below your normal level — "
        "a good opportunity to focus on deep work, catch up on sleep, "
        "or take a proper break before the next busy stretch.",
    ),
    frozenset({"meeting_hours:decline", "sleep_hours:decline"}): (
        "Low meetings, but rest is still suffering",
        "Despite a lighter schedule, your sleep has dipped below your baseline. "
        "This can happen after a sustained high-pressure period — your nervous system "
        "stays activated even when the workload drops. A consistent wind-down routine "
        "will help your body catch up.",
    ),
}


# ─── Endpoint ─────────────────────────────────────────────────────────────────


@router.get("/pattern", response_model=PatternInsightResponse)
async def get_pattern_insight(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the most recently active drift signals and a plain-language
    explanation of what the combination may mean for the user.

    Only returns signals from the last 3 days. If no active drift has been
    detected, returns has_pattern=False with empty signals.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=3)

    result = await db.execute(
        select(DriftAlert)
        .where(
            DriftAlert.user_id == current_user.id,
            DriftAlert.created_at >= cutoff,
        )
        .order_by(DriftAlert.created_at.desc())
    )
    recent_alerts: list[DriftAlert] = list(result.scalars().all())

    if not recent_alerts:
        return PatternInsightResponse(
            has_pattern=False,
            headline="",
            explanation="",
            signals=[],
        )

    # Deduplicate: keep the newest alert per (metric_key, direction) pair
    seen: set[tuple[str, str]] = set()
    deduped: list[DriftAlert] = []
    for alert in recent_alerts:
        key = (alert.metric_key, alert.direction)
        if key not in seen:
            seen.add(key)
            deduped.append(alert)

    signal_keys = frozenset(f"{a.metric_key}:{a.direction}" for a in deduped)
    headline, explanation = _COPY.get(
        signal_keys,
        (
            "Some of your patterns have shifted recently",
            "Your recent sleep or activity levels have moved away from your normal "
            "baseline. This may be affecting how you feel day-to-day.",
        ),
    )

    signals = [
        PatternSignal(
            metric_key=a.metric_key,
            direction=a.direction,
            label=_LABELS.get(a.metric_key, a.metric_key),
            delta_pct=round(
                (a.rolling_avg - a.baseline_mean) / a.baseline_mean * 100, 1
            )
            if a.baseline_mean != 0
            else 0.0,
        )
        for a in deduped
    ]

    return PatternInsightResponse(
        has_pattern=True,
        headline=headline,
        explanation=explanation,
        signals=signals,
    )
