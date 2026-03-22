"""
Celery task definitions for MindLift background processing.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "mindlift",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        # Recompute baselines nightly at 02:00 UTC
        "nightly-baseline-recompute": {
            "task": "app.worker.tasks.nightly_baseline_recompute",
            "schedule": crontab(hour=2, minute=0),
        },
        # Run daily risk assessment at 06:00 UTC
        "daily-risk-assessment": {
            "task": "app.worker.tasks.run_daily_risk_assessments",
            "schedule": crontab(hour=6, minute=0),
        },
    },
)


def _run_async(coro):
    """Execute a coroutine from a synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="app.worker.tasks.nightly_baseline_recompute", bind=True, max_retries=3)
def nightly_baseline_recompute(self):
    """Recompute baselines for all active users."""

    async def _run():
        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.user import User
        from app.services.baseline import recompute_nightly_baseline

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User.id).where(
                    User.state.in_(["ACTIVE", "LIMITED", "CRISIS", "ESCALATED"]),
                    User.deleted_at.is_(None),
                )
            )
            user_ids = result.scalars().all()

        processed = 0
        for uid in user_ids:
            try:
                async with AsyncSessionLocal() as db:
                    await recompute_nightly_baseline(uid, db)
                    await db.commit()
                processed += 1
            except Exception as exc:
                # Log but continue processing other users.
                print(f"[baseline] Error for user {uid}: {exc}")

        return {"processed": processed, "total": len(user_ids)}

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(name="app.worker.tasks.run_daily_risk_assessments", bind=True, max_retries=3)
def run_daily_risk_assessments(self):
    """Run daily risk assessments for all active users with complete baselines."""

    async def _run():
        from datetime import date

        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.metrics import Baseline, DailyMetric
        from app.models.risk import RiskAssessment
        from app.models.user import User
        from app.services.risk_engine import BaselineEntry, compute_risk
        from app.services.intervention_selector import select_interventions

        today = date.today()

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User).where(
                    User.state.in_(["ACTIVE", "LIMITED"]),
                    User.deleted_at.is_(None),
                )
            )
            users = result.scalars().all()

        processed = 0
        for user in users:
            try:
                async with AsyncSessionLocal() as db:
                    # Fetch today's metrics
                    metric_result = await db.execute(
                        select(DailyMetric).where(
                            DailyMetric.user_id == user.id,
                            DailyMetric.metric_date == today,
                        )
                    )
                    metric: DailyMetric | None = metric_result.scalar_one_or_none()
                    if not metric:
                        continue

                    # Fetch baselines
                    bl_result = await db.execute(
                        select(Baseline).where(Baseline.user_id == user.id)
                    )
                    baselines: dict[str, BaselineEntry] = {
                        b.feature_key: BaselineEntry(
                            mean=b.mean_value, std=b.std_value, valid_days=b.valid_days
                        )
                        for b in bl_result.scalars().all()
                    }

                    risk_result = compute_risk(
                        sleep_hours=metric.sleep_hours,
                        steps=metric.steps,
                        screen_time_minutes=metric.screen_time_minutes,
                        resting_heart_rate_bpm=metric.resting_heart_rate_bpm,
                        average_heart_rate_bpm=metric.average_heart_rate_bpm,
                        hrv_ms=metric.hrv_ms,
                        location_home_ratio=metric.location_home_ratio,
                        location_transitions=metric.location_transitions,
                        mood_score=metric.mood_score,
                        communication_count=metric.communication_count,
                        baselines=baselines,
                    )

                    now = datetime.now(timezone.utc)
                    assessment = RiskAssessment(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        assessment_time=now,
                        assessment_scope="daily",
                        risk_score=risk_result.risk_score,
                        risk_level=risk_result.risk_level.value,
                        feature_sleep_score=risk_result.feature_sleep_score,
                        feature_activity_score=risk_result.feature_activity_score,
                        feature_heart_score=risk_result.feature_heart_score,
                        feature_social_score=risk_result.feature_social_score,
                        contributing_features=risk_result.contributing_features,
                        model_version=risk_result.model_version,
                        baseline_complete=risk_result.baseline_complete,
                        created_at=now,
                    )
                    db.add(assessment)

                    # Select and persist interventions
                    # Re-fetch user within session for state access
                    user_result = await db.execute(
                        select(User).where(User.id == user.id)
                    )
                    fresh_user = user_result.scalar_one()
                    await select_interventions(fresh_user, risk_result, db)

                    await db.commit()
                    processed += 1
            except Exception as exc:
                print(f"[risk] Error for user {user.id}: {exc}")

        return {"processed": processed, "total": len(users)}

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * 5)


@celery_app.task(name="app.worker.tasks.send_push_notification")
def send_push_notification(user_id: str, title: str, body: str, data: dict | None = None):
    """
    Send a push notification to all devices registered for a user.
    Wire up to APNs / FCM in production.
    """
    print(f"[push] user={user_id} title={title!r} body={body!r} data={data}")
    return {"status": "stub_sent"}
