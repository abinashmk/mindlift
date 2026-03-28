"""
GET /home — aggregated home screen data for the mobile app.

Returns the latest risk assessment, today's metrics, a suggested intervention,
and the last 7 days of risk history in a single request.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.intervention import Intervention, InterventionEvent
from app.models.metrics import DailyMetric
from app.models.risk import RiskAssessment
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter(tags=["home"])


# ─── Response schemas ─────────────────────────────────────────────────────────

class HomeRiskAssessment(BaseModel):
    assessment_time: datetime
    risk_score: float
    risk_level: str
    baseline_complete: bool
    contributing_features: list | dict


class HomeTodayMetrics(BaseModel):
    metric_date: str
    steps: int | None = None
    resting_heart_rate_bpm: float | None = None
    average_heart_rate_bpm: float | None = None
    hrv_ms: float | None = None
    sleep_hours: float | None = None
    sleep_source: str | None = None
    screen_time_minutes: int | None = None
    location_home_ratio: float | None = None
    location_transitions: int | None = None
    noise_level_db_avg: float | None = None
    mood_score: int | None = None
    stress_source: str | None = None
    meeting_hours: float | None = None
    communication_count: int | None = None


class HomeSuggestedIntervention(BaseModel):
    event_id: str
    code: str
    name: str
    duration_minutes: int
    instructions_markdown: str
    status: str
    triggered_at: datetime
    suggested_reason: str | None = None


class HomeRiskHistoryItem(BaseModel):
    date: str
    risk_level: str
    risk_score: float


class DailyGoal(BaseModel):
    key: str           # "sleep" | "steps" | "mood" | "stress"
    label: str
    done: bool
    detail: str        # e.g. "6.5 / 7 hrs" or "Logged"


class HomeResponse(BaseModel):
    risk_assessment: HomeRiskAssessment | None
    today_metrics: HomeTodayMetrics | None
    suggested_intervention: HomeSuggestedIntervention | None
    recent_risk_history: list[HomeRiskHistoryItem]
    daily_goals: list[DailyGoal]


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/home", response_model=HomeResponse)
async def get_home(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate home screen data in a single round-trip."""

    # 1. Latest risk assessment
    risk_result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.user_id == current_user.id)
        .order_by(RiskAssessment.assessment_time.desc())
        .limit(1)
    )
    latest_risk: RiskAssessment | None = risk_result.scalar_one_or_none()

    risk_assessment = None
    if latest_risk:
        cf = latest_risk.contributing_features
        risk_assessment = HomeRiskAssessment(
            assessment_time=latest_risk.assessment_time,
            risk_score=latest_risk.risk_score,
            risk_level=latest_risk.risk_level,
            baseline_complete=latest_risk.baseline_complete,
            contributing_features=cf if cf is not None else [],
        )

    # 2. Today's metrics
    today = date.today()
    metrics_result = await db.execute(
        select(DailyMetric).where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.metric_date == today,
        )
    )
    today_metric: DailyMetric | None = metrics_result.scalar_one_or_none()

    today_metrics = None
    if today_metric:
        today_metrics = HomeTodayMetrics(
            metric_date=today_metric.metric_date.isoformat(),
            steps=today_metric.steps,
            resting_heart_rate_bpm=today_metric.resting_heart_rate_bpm,
            average_heart_rate_bpm=today_metric.average_heart_rate_bpm,
            hrv_ms=today_metric.hrv_ms,
            sleep_hours=today_metric.sleep_hours,
            sleep_source=today_metric.sleep_source,
            screen_time_minutes=today_metric.screen_time_minutes,
            location_home_ratio=today_metric.location_home_ratio,
            location_transitions=today_metric.location_transitions,
            noise_level_db_avg=today_metric.noise_level_db_avg,
            mood_score=today_metric.mood_score,
            stress_source=today_metric.stress_source,
            meeting_hours=today_metric.meeting_hours,
            communication_count=today_metric.communication_count,
        )

    # 3. Most recent non-terminal intervention event
    event_result = await db.execute(
        select(InterventionEvent, Intervention)
        .join(Intervention, InterventionEvent.intervention_id == Intervention.id)
        .where(
            InterventionEvent.user_id == current_user.id,
            InterventionEvent.status.notin_(["COMPLETED", "DISMISSED", "EXPIRED"]),
        )
        .order_by(InterventionEvent.triggered_at.desc())
        .limit(1)
    )
    event_row = event_result.first()

    suggested_intervention = None
    if event_row:
        event, intervention = event_row
        suggested_intervention = HomeSuggestedIntervention(
            event_id=str(event.id),
            code=intervention.code,
            name=intervention.name,
            duration_minutes=intervention.duration_minutes,
            instructions_markdown=intervention.instructions_markdown,
            status=event.status,
            triggered_at=event.triggered_at,
        )

    # 4. Recent risk history (last 7 days), one entry per day
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    history_result = await db.execute(
        select(RiskAssessment)
        .where(
            RiskAssessment.user_id == current_user.id,
            RiskAssessment.assessment_time >= cutoff,
        )
        .order_by(RiskAssessment.assessment_time.desc())
    )
    history_rows = history_result.scalars().all()

    # Deduplicate to one entry per calendar date (newest wins)
    seen: set[str] = set()
    recent_risk_history: list[HomeRiskHistoryItem] = []
    for row in history_rows:
        day = row.assessment_time.date().isoformat()
        if day not in seen:
            seen.add(day)
            recent_risk_history.append(
                HomeRiskHistoryItem(
                    date=day,
                    risk_level=row.risk_level,
                    risk_score=row.risk_score,
                )
            )

    # ── Daily goals — derived from today's metrics, no extra DB query needed ──
    _SLEEP_TARGET = 7.0   # hours
    _STEPS_TARGET = 7000

    m = today_metric  # shorthand
    sleep_done = m is not None and m.sleep_hours is not None and m.sleep_hours >= _SLEEP_TARGET
    steps_done = m is not None and m.steps is not None and m.steps >= _STEPS_TARGET
    mood_done  = m is not None and m.mood_score is not None
    stress_done = m is not None and m.stress_source is not None

    daily_goals = [
        DailyGoal(
            key="sleep",
            label=f"Sleep {int(_SLEEP_TARGET)}+ hours",
            done=sleep_done,
            detail=(
                f"{m.sleep_hours:.1f} / {int(_SLEEP_TARGET)} hrs"
                if m and m.sleep_hours is not None
                else f"Target: {int(_SLEEP_TARGET)} hrs"
            ),
        ),
        DailyGoal(
            key="steps",
            label=f"Walk {_STEPS_TARGET:,} steps",
            done=steps_done,
            detail=(
                f"{m.steps:,} / {_STEPS_TARGET:,}"
                if m and m.steps is not None
                else f"Target: {_STEPS_TARGET:,}"
            ),
        ),
        DailyGoal(
            key="mood",
            label="Log your mood",
            done=mood_done,
            detail="Logged" if mood_done else "Not logged yet",
        ),
        DailyGoal(
            key="stress",
            label="Check in on stress",
            done=stress_done,
            detail="Checked in" if stress_done else "Not logged yet",
        ),
    ]

    return HomeResponse(
        risk_assessment=risk_assessment,
        today_metrics=today_metrics,
        suggested_intervention=suggested_intervention,
        recent_risk_history=recent_risk_history,
        daily_goals=daily_goals,
    )
