"""
Baseline computation service for MindLift.

Rules:
- Initial baseline: 14 days starting the first full day after onboarding.
- A day is "valid" if data for at least 2 of 4 feature groups is present.
- Nightly recompute: trailing 28 valid days, RED-risk days excluded.
- mean = arithmetic mean, std = sample std (ddof=1), if std==0 replace with 0.01.
"""

from __future__ import annotations

import math
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metrics import Baseline, DailyMetric
from app.models.risk import RiskAssessment


# Feature groups used to determine if a day is "valid".
_GROUP_FEATURES: dict[str, list[str]] = {
    "sleep": ["sleep_hours"],
    "activity": ["steps", "screen_time_minutes"],
    "heart": ["resting_heart_rate_bpm", "average_heart_rate_bpm", "hrv_ms"],
    "social": [
        "location_home_ratio",
        "location_transitions",
        "mood_score",
        "communication_count",
    ],
}

# All numeric features that get their own baseline entry.
_ALL_FEATURES = [
    "sleep_hours",
    "steps",
    "screen_time_minutes",
    "resting_heart_rate_bpm",
    "average_heart_rate_bpm",
    "hrv_ms",
    "location_home_ratio",
    "location_transitions",
    "mood_score",
    "communication_count",
]


def _sample_std(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.01
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / (n - 1)
    std = math.sqrt(variance)
    return std if std > 0 else 0.01


def _group_coverage(metric: DailyMetric) -> int:
    """Return the number of feature groups that have at least one non-None value."""
    count = 0
    for group, features in _GROUP_FEATURES.items():
        if any(getattr(metric, f, None) is not None for f in features):
            count += 1
    return count


def _is_valid_day(metric: DailyMetric) -> bool:
    return _group_coverage(metric) >= 2


async def compute_initial_baseline(user_id: uuid.UUID, db: AsyncSession) -> None:
    """
    Compute baseline from the first 14 days of data for a newly onboarded user.
    Should be called once, 14 days after onboarding completes.
    """
    result = await db.execute(
        select(DailyMetric)
        .where(DailyMetric.user_id == user_id)
        .order_by(DailyMetric.metric_date)
        .limit(14)
    )
    metrics: list[DailyMetric] = list(result.scalars().all())
    valid_metrics = [m for m in metrics if _is_valid_day(m)]
    await _upsert_baselines(user_id, valid_metrics, db)


async def recompute_nightly_baseline(user_id: uuid.UUID, db: AsyncSession) -> None:
    """
    Recompute baseline using the trailing 28 valid days, excluding RED-risk days.
    Called by the nightly Celery task.
    """
    # Load last 60 days of metrics to find the trailing 28 valid non-RED days.
    cutoff = date.today() - timedelta(days=60)
    metrics_result = await db.execute(
        select(DailyMetric)
        .where(DailyMetric.user_id == user_id, DailyMetric.metric_date >= cutoff)
        .order_by(DailyMetric.metric_date.desc())
    )
    all_metrics: list[DailyMetric] = list(metrics_result.scalars().all())

    # Load risk assessments to identify RED days.
    red_dates: set[date] = set()
    risk_result = await db.execute(
        select(RiskAssessment).where(
            RiskAssessment.user_id == user_id,
            RiskAssessment.risk_level == "RED",
        )
    )
    for ra in risk_result.scalars().all():
        red_dates.add(ra.assessment_time.date())

    valid_non_red: list[DailyMetric] = []
    for m in all_metrics:
        if _is_valid_day(m) and m.metric_date not in red_dates:
            valid_non_red.append(m)
        if len(valid_non_red) == 28:
            break

    await _upsert_baselines(user_id, valid_non_red, db)


async def _upsert_baselines(
    user_id: uuid.UUID,
    metrics: list[DailyMetric],
    db: AsyncSession,
) -> None:
    if not metrics:
        return

    sorted_metrics = sorted(metrics, key=lambda m: m.metric_date)
    start_date = sorted_metrics[0].metric_date
    end_date = sorted_metrics[-1].metric_date
    valid_days = len(sorted_metrics)

    for feature in _ALL_FEATURES:
        values = [
            getattr(m, feature)
            for m in sorted_metrics
            if getattr(m, feature) is not None
        ]
        if not values:
            continue

        mean_val = sum(values) / len(values)
        std_val = _sample_std(values)

        # Upsert
        result = await db.execute(
            select(Baseline).where(
                Baseline.user_id == user_id,
                Baseline.feature_key == feature,
            )
        )
        existing: Baseline | None = result.scalar_one_or_none()

        if existing:
            existing.mean_value = mean_val
            existing.std_value = std_val
            existing.valid_days = valid_days
            existing.baseline_start_date = start_date
            existing.baseline_end_date = end_date
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(
                Baseline(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    feature_key=feature,
                    mean_value=mean_val,
                    std_value=std_val,
                    valid_days=valid_days,
                    baseline_start_date=start_date,
                    baseline_end_date=end_date,
                    updated_at=datetime.now(timezone.utc),
                )
            )

    await db.flush()
