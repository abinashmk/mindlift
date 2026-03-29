"""
Tests for drift_detector.py

Uses in-memory SQLite (aiosqlite) via the conftest db_session fixture,
following the same pattern as other backend tests.
"""

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.drift_alert import DriftAlert
from app.models.metrics import Baseline, DailyMetric
from app.services.drift_detector import _COOLDOWN_DAYS, detect_drift_for_user


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _baseline(user_id, key, mean, std, valid_days=14) -> Baseline:
    return Baseline(
        user_id=user_id,
        feature_key=key,
        mean_value=mean,
        std_value=std,
        valid_days=valid_days,
        baseline_start_date=date.today() - timedelta(days=28),
        baseline_end_date=date.today() - timedelta(days=1),
    )


def _metric(user_id, days_ago: int, sleep=None, steps=None) -> DailyMetric:
    now = datetime.now(timezone.utc)
    return DailyMetric(
        user_id=user_id,
        metric_date=date.today() - timedelta(days=days_ago),
        sleep_hours=sleep,
        steps=steps,
        created_at=now,
        updated_at=now,
    )


# ─── Tests ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sleep_decline_triggers_alert(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    db_session.add(_metric(uid, 0, sleep=6.0))
    db_session.add(_metric(uid, 1, sleep=6.1))
    db_session.add(_metric(uid, 2, sleep=6.0))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)

    assert len(results) == 1
    r = results[0]
    assert r.metric_key == "sleep_hours"
    assert r.direction == "decline"
    assert r.z_score < -1.0


@pytest.mark.asyncio
async def test_steps_improvement_triggers_alert(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "steps", mean=5000, std=800))
    db_session.add(_metric(uid, 0, steps=7100))
    db_session.add(_metric(uid, 1, steps=6900))
    db_session.add(_metric(uid, 2, steps=7000))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)

    assert len(results) == 1
    r = results[0]
    assert r.metric_key == "steps"
    assert r.direction == "improvement"
    assert r.z_score > 1.0


@pytest.mark.asyncio
async def test_no_alert_within_normal_range(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    # Rolling avg 7.4 h — z ≈ -0.2 (within ±1 std)
    db_session.add(_metric(uid, 0, sleep=7.4))
    db_session.add(_metric(uid, 1, sleep=7.4))
    db_session.add(_metric(uid, 2, sleep=7.4))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert results == []


@pytest.mark.asyncio
async def test_alert_suppressed_within_cooldown(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    db_session.add(_metric(uid, 0, sleep=6.0))
    db_session.add(_metric(uid, 1, sleep=6.0))
    db_session.add(_metric(uid, 2, sleep=6.0))
    # Pre-existing alert sent 1 day ago (within cooldown)
    db_session.add(
        DriftAlert(
            id=uuid.uuid4(),
            user_id=uid,
            metric_key="sleep_hours",
            direction="decline",
            rolling_avg=6.0,
            baseline_mean=7.5,
            z_score=-3.0,
            created_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
    )
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert results == []


@pytest.mark.asyncio
async def test_alert_fires_after_cooldown_expires(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    db_session.add(_metric(uid, 0, sleep=6.0))
    db_session.add(_metric(uid, 1, sleep=6.0))
    db_session.add(_metric(uid, 2, sleep=6.0))
    # Previous alert older than cooldown
    db_session.add(
        DriftAlert(
            id=uuid.uuid4(),
            user_id=uid,
            metric_key="sleep_hours",
            direction="decline",
            rolling_avg=6.0,
            baseline_mean=7.5,
            z_score=-3.0,
            created_at=datetime.now(timezone.utc) - timedelta(days=_COOLDOWN_DAYS + 1),
        )
    )
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert len(results) == 1
    assert results[0].direction == "decline"


@pytest.mark.asyncio
async def test_insufficient_data_no_alert(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    # Only 1 data point (need at least 2)
    db_session.add(_metric(uid, 0, sleep=6.0))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert results == []


@pytest.mark.asyncio
async def test_no_baseline_no_alert(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_metric(uid, 0, sleep=6.0))
    db_session.add(_metric(uid, 1, sleep=6.0))
    db_session.add(_metric(uid, 2, sleep=6.0))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert results == []


@pytest.mark.asyncio
async def test_immature_baseline_no_alert(db_session: AsyncSession):
    uid = uuid.uuid4()
    # Baseline exists but fewer than 7 valid days
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5, valid_days=4))
    db_session.add(_metric(uid, 0, sleep=6.0))
    db_session.add(_metric(uid, 1, sleep=6.0))
    db_session.add(_metric(uid, 2, sleep=6.0))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert results == []


@pytest.mark.asyncio
async def test_both_metrics_trigger_simultaneously(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    db_session.add(_baseline(uid, "steps", mean=5000, std=800))
    # Sleep declining, steps improving
    for d in range(3):
        db_session.add(_metric(uid, d, sleep=6.0, steps=7500))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    keys = {r.metric_key for r in results}
    assert "sleep_hours" in keys
    assert "steps" in keys
    assert len(results) == 2


@pytest.mark.asyncio
async def test_drift_alert_row_persisted(db_session: AsyncSession):
    uid = uuid.uuid4()
    db_session.add(_baseline(uid, "sleep_hours", mean=7.5, std=0.5))
    db_session.add(_metric(uid, 0, sleep=6.0))
    db_session.add(_metric(uid, 1, sleep=6.0))
    db_session.add(_metric(uid, 2, sleep=6.0))
    await db_session.flush()

    results = await detect_drift_for_user(uid, db_session)
    assert len(results) == 1

    rows = (
        (await db_session.execute(select(DriftAlert).where(DriftAlert.user_id == uid)))
        .scalars()
        .all()
    )
    assert len(rows) == 1
    assert rows[0].metric_key == "sleep_hours"
    assert rows[0].direction == "decline"
