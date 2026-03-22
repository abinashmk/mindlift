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


@celery_app.task(name="app.worker.tasks.compute_risk_assessment", bind=True, max_retries=3)
def compute_risk_assessment(self, user_id: str):
    """
    Compute a risk assessment for a single user on demand.
    Used when a new daily metric is submitted outside the nightly batch window.
    """

    async def _run():
        from datetime import date

        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.metrics import Baseline, DailyMetric
        from app.models.risk import RiskAssessment
        from app.models.user import User
        from app.services.intervention_selector import select_interventions
        from app.services.risk_engine import BaselineEntry, compute_risk

        uid = uuid.UUID(user_id)
        today = date.today()

        async with AsyncSessionLocal() as db:
            user_result = await db.execute(select(User).where(User.id == uid))
            user = user_result.scalar_one_or_none()
            if not user or user.deleted_at is not None:
                return {"status": "skipped", "reason": "user_not_found"}

            metric_result = await db.execute(
                select(DailyMetric).where(
                    DailyMetric.user_id == uid,
                    DailyMetric.metric_date == today,
                )
            )
            metric: DailyMetric | None = metric_result.scalar_one_or_none()
            if not metric:
                return {"status": "skipped", "reason": "no_metric_for_today"}

            bl_result = await db.execute(select(Baseline).where(Baseline.user_id == uid))
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
                user_id=uid,
                assessment_time=now,
                assessment_scope="intraday",
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

            await select_interventions(user, risk_result, db)
            await db.commit()

        return {"status": "done", "risk_level": risk_result.risk_level.value}

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.worker.tasks.run_nightly_baseline_update", bind=True, max_retries=3)
def run_nightly_baseline_update(self):
    """
    Alias / explicit export for the nightly baseline recompute task.
    Delegates to nightly_baseline_recompute.
    """
    return nightly_baseline_recompute()


@celery_app.task(name="app.worker.tasks.process_account_deletion", bind=True, max_retries=3)
def process_account_deletion(self, user_id: str):
    """
    Permanently purge all data associated with a deleted user.
    The user record itself is soft-deleted first by the API; this task removes
    dependent data (metrics, baselines, chat, devices, etc.).
    """

    async def _run():
        from sqlalchemy import delete, select

        from app.database import AsyncSessionLocal
        from app.models.chat import ChatMessage, ChatSession
        from app.models.device import Device
        from app.models.escalation import Escalation, EscalationContact
        from app.models.intervention import InterventionEvent
        from app.models.metrics import Baseline, DailyMetric
        from app.models.risk import RiskAssessment
        from app.models.user import User, UserConsent

        uid = uuid.UUID(user_id)

        async with AsyncSessionLocal() as db:
            # Remove all dependent data; the user row itself is kept (soft-deleted)
            # so audit trails referencing the user_id remain intact.
            # Chat messages — must delete before sessions due to FK
            sessions_result = await db.execute(
                select(ChatSession.id).where(ChatSession.user_id == uid)
            )
            session_ids = sessions_result.scalars().all()
            if session_ids:
                await db.execute(
                    delete(ChatMessage).where(ChatMessage.session_id.in_(session_ids))
                )
            await db.execute(delete(ChatSession).where(ChatSession.user_id == uid))

            # Remaining dependent tables
            for model in (
                DailyMetric,
                Baseline,
                RiskAssessment,
                InterventionEvent,
                EscalationContact,
                Escalation,
                Device,
                UserConsent,
            ):
                await db.execute(delete(model).where(model.user_id == uid))  # type: ignore[attr-defined]

            # Null-out PII on the user row
            user_result = await db.execute(select(User).where(User.id == uid))
            user = user_result.scalar_one_or_none()
            if user:
                user.email = f"deleted_{uid}@deleted.invalid"
                user.password_hash = ""
                user.first_name = None
                user.mfa_secret = None

            await db.commit()

        return {"status": "done", "user_id": user_id}

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.worker.tasks.generate_export_zip", bind=True, max_retries=3)
def generate_export_zip(self, user_id: str):
    """
    Generate a GDPR-compliant data export for the user and log the result.
    In production, upload the ZIP to S3/presigned URL and notify the user.
    """

    async def _run():
        import json

        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.chat import ChatSession
        from app.models.intervention import InterventionEvent
        from app.models.metrics import DailyMetric
        from app.models.risk import RiskAssessment
        from app.models.user import User, UserConsent

        uid = uuid.UUID(user_id)

        async with AsyncSessionLocal() as db:
            user_result = await db.execute(select(User).where(User.id == uid))
            user = user_result.scalar_one_or_none()
            if not user:
                return {"status": "skipped", "reason": "user_not_found"}

            metrics_result = await db.execute(
                select(DailyMetric).where(DailyMetric.user_id == uid)
            )
            consents_result = await db.execute(
                select(UserConsent).where(UserConsent.user_id == uid)
            )

            export_data = {
                "user_id": user_id,
                "email": user.email,
                "metrics_count": len(metrics_result.scalars().all()),
                "consents_count": len(consents_result.scalars().all()),
                "exported_at": datetime.now(timezone.utc).isoformat(),
            }

        # Stub: log export summary; wire to real storage in production.
        print(f"[export] user={user_id} export={json.dumps(export_data)}")
        return {"status": "done", "user_id": user_id}

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
