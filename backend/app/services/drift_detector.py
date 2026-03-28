"""
Drift detection service for sleep and step trends.

Compares the 3-day rolling average of a metric against the user's stored
baseline to detect sustained decline or improvement. A notification is
triggered when the deviation exceeds 1 standard deviation and no alert for
the same metric + direction has been sent in the last 3 days.

Algorithm:
  1. Fetch the user's last 3 days of daily_metrics rows.
  2. Require at least 2 of those 3 days to have a non-null value for the metric.
  3. Compute the rolling average of those non-null values.
  4. Look up the baseline entry for the metric (min 7 valid days required).
  5. Compute z = (rolling_avg - baseline_mean) / baseline_std.
  6. z < -1.0 → "decline";  z > +1.0 → "improvement".
  7. Check the drift_alerts table for a recent alert (within 3 days) for the
     same (user_id, metric_key, direction). If one exists, suppress.
  8. Otherwise insert a DriftAlert row and return the result so the caller can
     dispatch a push notification.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.drift_alert import DriftAlert
from app.models.metrics import Baseline, DailyMetric

# Number of recent days to average over
_WINDOW_DAYS = 3
# Minimum data points within the window required to compute a rolling avg
_MIN_POINTS = 2
# Minimum valid baseline days to trust the baseline
_MIN_BASELINE_DAYS = 7
# Z-score magnitude that triggers a drift alert
_DRIFT_THRESHOLD = 1.0
# Cooldown: don't re-alert for the same metric + direction within this many days
_COOLDOWN_DAYS = 3

# Metrics we track
_TRACKED_METRICS: tuple[str, ...] = ("sleep_hours", "steps", "meeting_hours")

# Human-readable notification copy per metric + direction
_NOTIFICATION_COPY: dict[tuple[str, str], tuple[str, str]] = {
    ("sleep_hours", "decline"): (
        "Sleep check-in",
        "Your sleep has dipped over the last few days. "
        "Try winding down a bit earlier tonight.",
    ),
    ("sleep_hours", "improvement"): (
        "Sleep improvement",
        "Your sleep has been better lately — great work keeping up a consistent rest routine!",
    ),
    ("steps", "decline"): (
        "Activity reminder",
        "Your step count has been lower lately. Even a short walk today can make a difference.",
    ),
    ("steps", "improvement"): (
        "Activity milestone",
        "You've been more active over the last few days — keep it up!",
    ),
    # For meeting_hours, "improvement" (z > 0) means meetings are UP — that's the alert
    ("meeting_hours", "improvement"): (
        "Heavy meeting load",
        "Your calendar has been unusually packed over the last few days. "
        "Try to protect at least one recovery block today.",
    ),
    ("meeting_hours", "decline"): (
        "Schedule lightening up",
        "Your meeting load has dropped below your usual level — "
        "a good opportunity to focus on deep work or take a proper break.",
    ),
}


@dataclass
class DriftResult:
    user_id: uuid.UUID
    metric_key: str
    direction: str          # "decline" | "improvement"
    rolling_avg: float
    baseline_mean: float
    z_score: float
    notification_title: str
    notification_body: str


async def detect_drift_for_user(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> list[DriftResult]:
    """
    Run drift detection for a single user.

    Returns a list of DriftResult objects (0–2 items) for metrics where a
    new alert should be sent. Inserts DriftAlert rows for each result.
    """
    today = date.today()
    window_start = today - timedelta(days=_WINDOW_DAYS - 1)

    # Fetch recent metrics (last 3 days)
    metrics_result = await db.execute(
        select(DailyMetric)
        .where(
            DailyMetric.user_id == user_id,
            DailyMetric.metric_date >= window_start,
            DailyMetric.metric_date <= today,
        )
        .order_by(DailyMetric.metric_date.asc())
    )
    recent_metrics: list[DailyMetric] = list(metrics_result.scalars().all())

    # Fetch all baselines for this user
    baseline_result = await db.execute(
        select(Baseline).where(Baseline.user_id == user_id)
    )
    baselines: dict[str, Baseline] = {
        b.feature_key: b for b in baseline_result.scalars().all()
    }

    alerts: list[DriftResult] = []

    for metric_key in _TRACKED_METRICS:
        # Collect non-null values from the window
        values: list[float] = [
            getattr(m, metric_key)
            for m in recent_metrics
            if getattr(m, metric_key) is not None
        ]

        if len(values) < _MIN_POINTS:
            continue  # Not enough data to detect drift

        baseline = baselines.get(metric_key)
        if baseline is None or baseline.valid_days < _MIN_BASELINE_DAYS:
            continue  # Baseline not yet established

        rolling_avg = sum(values) / len(values)
        std = baseline.std_value if baseline.std_value > 0 else 0.01
        z_score = (rolling_avg - baseline.mean_value) / std

        if abs(z_score) < _DRIFT_THRESHOLD:
            continue  # Within normal range

        direction = "decline" if z_score < 0 else "improvement"

        # Cooldown check — suppress if we already alerted recently
        cooldown_start = today - timedelta(days=_COOLDOWN_DAYS)
        from datetime import datetime, timezone
        cooldown_dt = datetime(
            cooldown_start.year, cooldown_start.month, cooldown_start.day,
            tzinfo=timezone.utc,
        )
        existing = await db.execute(
            select(DriftAlert).where(
                DriftAlert.user_id == user_id,
                DriftAlert.metric_key == metric_key,
                DriftAlert.direction == direction,
                DriftAlert.created_at >= cooldown_dt,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue  # Already alerted within cooldown window

        # Record the alert
        alert_row = DriftAlert(
            id=uuid.uuid4(),
            user_id=user_id,
            metric_key=metric_key,
            direction=direction,
            rolling_avg=rolling_avg,
            baseline_mean=baseline.mean_value,
            z_score=z_score,
        )
        db.add(alert_row)

        title, body = _NOTIFICATION_COPY[(metric_key, direction)]
        alerts.append(
            DriftResult(
                user_id=user_id,
                metric_key=metric_key,
                direction=direction,
                rolling_avg=rolling_avg,
                baseline_mean=baseline.mean_value,
                z_score=z_score,
                notification_title=title,
                notification_body=body,
            )
        )

    return alerts
