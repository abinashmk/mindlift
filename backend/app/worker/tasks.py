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
        # Drift detection at 07:00 UTC (after risk assessment)
        "daily-drift-detection": {
            "task": "app.worker.tasks.run_drift_detection",
            "schedule": crontab(hour=7, minute=0),
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


@celery_app.task(
    name="app.worker.tasks.nightly_baseline_recompute", bind=True, max_retries=3
)
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


@celery_app.task(
    name="app.worker.tasks.run_daily_risk_assessments", bind=True, max_retries=3
)
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


@celery_app.task(
    name="app.worker.tasks.send_push_notification", bind=True, max_retries=3
)
def send_push_notification(
    self, user_id: str, title: str, body: str, data: dict | None = None
):
    """
    Send a push notification to all active devices registered for a user.
    Dispatches to APNs (iOS) or FCM (Android) based on device platform.
    Retries up to 3 times on transient failures.
    """
    from app.services.push import send_apns, send_fcm

    async def _run() -> dict:
        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.device import Device

        uid = uuid.UUID(user_id)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Device).where(
                    Device.user_id == uid,
                    Device.notifications_enabled.is_(True),
                    Device.push_token.isnot(None),
                )
            )
            devices = result.scalars().all()

        sent = 0
        skipped = 0
        for device in devices:
            try:
                if device.platform == "ios":
                    ok = send_apns(device.push_token, title, body, data)
                else:
                    ok = send_fcm(device.push_token, title, body, data)
                if ok:
                    sent += 1
                else:
                    skipped += 1
            except Exception as exc:  # transient — let Celery retry the whole task
                raise self.retry(exc=exc, countdown=30)

        return {"status": "sent", "sent": sent, "skipped": skipped}

    return _run_async(_run())


@celery_app.task(
    name="app.worker.tasks.compute_risk_assessment", bind=True, max_retries=3
)
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

            bl_result = await db.execute(
                select(Baseline).where(Baseline.user_id == uid)
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


@celery_app.task(
    name="app.worker.tasks.run_nightly_baseline_update", bind=True, max_retries=3
)
def run_nightly_baseline_update(self):
    """
    Alias / explicit export for the nightly baseline recompute task.
    Delegates to nightly_baseline_recompute.
    """
    return nightly_baseline_recompute()


@celery_app.task(
    name="app.worker.tasks.process_account_deletion", bind=True, max_retries=3
)
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
    Build a GDPR-compliant ZIP export for the user, upload it to S3, generate
    a 15-minute presigned download URL, then notify the user via email and push.

    ZIP contents (per spec §34):
      profile.json
      consents.json
      daily_metrics.csv
      risk_assessments.csv
      intervention_events.csv
      chat_messages.csv  (only when chat_logging_accepted is true)
      escalations.csv
    """
    import csv
    import io
    import json
    import zipfile

    async def _fetch_data() -> dict:
        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.chat import ChatMessage, ChatSession
        from app.models.escalation import Escalation
        from app.models.intervention import InterventionEvent
        from app.models.metrics import DailyMetric
        from app.models.risk import RiskAssessment
        from app.models.user import User, UserConsent

        uid = uuid.UUID(user_id)
        async with AsyncSessionLocal() as db:
            user = (
                await db.execute(select(User).where(User.id == uid))
            ).scalar_one_or_none()
            if not user:
                return {}

            consents = (
                (
                    await db.execute(
                        select(UserConsent).where(UserConsent.user_id == uid)
                    )
                )
                .scalars()
                .all()
            )

            chat_logging = any(
                c.consent_key == "chat_logging_accepted" and c.consent_value
                for c in consents
            )

            metrics = (
                (
                    await db.execute(
                        select(DailyMetric)
                        .where(DailyMetric.user_id == uid)
                        .order_by(DailyMetric.metric_date)
                    )
                )
                .scalars()
                .all()
            )

            risks = (
                (
                    await db.execute(
                        select(RiskAssessment)
                        .where(RiskAssessment.user_id == uid)
                        .order_by(RiskAssessment.assessment_time)
                    )
                )
                .scalars()
                .all()
            )

            events = (
                (
                    await db.execute(
                        select(InterventionEvent)
                        .where(InterventionEvent.user_id == uid)
                        .order_by(InterventionEvent.triggered_at)
                    )
                )
                .scalars()
                .all()
            )

            escalations = (
                (
                    await db.execute(
                        select(Escalation)
                        .where(Escalation.user_id == uid)
                        .order_by(Escalation.created_at)
                    )
                )
                .scalars()
                .all()
            )

            chat_messages: list = []
            if chat_logging:
                sessions = (
                    (
                        await db.execute(
                            select(ChatSession).where(ChatSession.user_id == uid)
                        )
                    )
                    .scalars()
                    .all()
                )
                session_ids = [s.id for s in sessions]
                if session_ids:
                    chat_messages = (
                        (
                            await db.execute(
                                select(ChatMessage)
                                .where(ChatMessage.session_id.in_(session_ids))
                                .order_by(ChatMessage.created_at)
                            )
                        )
                        .scalars()
                        .all()
                    )

        return {
            "user": user,
            "consents": consents,
            "metrics": metrics,
            "risks": risks,
            "events": events,
            "escalations": escalations,
            "chat_messages": chat_messages,
            "chat_logging": chat_logging,
        }

    def _build_zip(data: dict) -> bytes:
        user = data["user"]
        exported_at = datetime.now(timezone.utc).isoformat()
        buf = io.BytesIO()

        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            # profile.json
            profile = {
                "user_id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "timezone": user.timezone,
                "state": user.state,
                "created_at": user.created_at.isoformat(),
                "exported_at": exported_at,
            }
            zf.writestr("profile.json", json.dumps(profile, indent=2))

            # consents.json
            consents_out = [
                {
                    "consent_key": c.consent_key,
                    "consent_value": c.consent_value,
                    "policy_version": c.policy_version,
                    "created_at": c.created_at.isoformat(),
                }
                for c in data["consents"]
            ]
            zf.writestr("consents.json", json.dumps(consents_out, indent=2))

            # daily_metrics.csv
            metrics_fields = [
                "metric_date",
                "steps",
                "resting_heart_rate_bpm",
                "average_heart_rate_bpm",
                "hrv_ms",
                "sleep_hours",
                "sleep_source",
                "screen_time_minutes",
                "location_home_ratio",
                "location_transitions",
                "noise_level_db_avg",
                "mood_score",
                "communication_count",
                "created_at",
                "updated_at",
            ]
            metrics_buf = io.StringIO()
            w = csv.DictWriter(metrics_buf, fieldnames=metrics_fields)
            w.writeheader()
            for m in data["metrics"]:
                w.writerow({f: getattr(m, f) for f in metrics_fields})
            zf.writestr("daily_metrics.csv", metrics_buf.getvalue())

            # risk_assessments.csv
            risk_fields = [
                "assessment_time",
                "assessment_scope",
                "risk_score",
                "risk_level",
                "feature_sleep_score",
                "feature_activity_score",
                "feature_heart_score",
                "feature_social_score",
                "baseline_complete",
                "created_at",
            ]
            risk_buf = io.StringIO()
            w = csv.DictWriter(risk_buf, fieldnames=risk_fields)
            w.writeheader()
            for r in data["risks"]:
                w.writerow({f: getattr(r, f) for f in risk_fields})
            zf.writestr("risk_assessments.csv", risk_buf.getvalue())

            # intervention_events.csv
            event_fields = [
                "id",
                "intervention_id",
                "triggered_at",
                "risk_level",
                "status",
                "completed",
                "helpful_rating",
                "created_at",
            ]
            event_buf = io.StringIO()
            w = csv.DictWriter(event_buf, fieldnames=event_fields)
            w.writeheader()
            for e in data["events"]:
                w.writerow({f: getattr(e, f) for f in event_fields})
            zf.writestr("intervention_events.csv", event_buf.getvalue())

            # escalations.csv
            esc_fields = [
                "id",
                "source",
                "status",
                "risk_level",
                "created_at",
                "updated_at",
                "resolved_at",
            ]
            esc_buf = io.StringIO()
            w = csv.DictWriter(esc_buf, fieldnames=esc_fields)
            w.writeheader()
            for e in data["escalations"]:
                w.writerow({f: getattr(e, f) for f in esc_fields})
            zf.writestr("escalations.csv", esc_buf.getvalue())

            # chat_messages.csv — only when chat logging consent was given
            if data["chat_logging"]:
                msg_fields = [
                    "id",
                    "session_id",
                    "sender_type",
                    "message_text",
                    "message_length",
                    "created_at",
                ]
                msg_buf = io.StringIO()
                w = csv.DictWriter(msg_buf, fieldnames=msg_fields)
                w.writeheader()
                for m in data["chat_messages"]:
                    w.writerow({f: getattr(m, f) for f in msg_fields})
                zf.writestr("chat_messages.csv", msg_buf.getvalue())

        return buf.getvalue()

    try:
        data = _run_async(_fetch_data())
        if not data:
            return {"status": "skipped", "reason": "user_not_found"}

        zip_bytes = _build_zip(data)

        # Upload to S3
        from app.services.s3 import presigned_download_url, upload_bytes

        s3_key = f"exports/{user_id}/{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"
        upload_bytes(s3_key, zip_bytes, content_type="application/zip")

        # 15-minute presigned URL (spec §34)
        download_url = presigned_download_url(s3_key, expires_in=900)

        # Notify user via email and push
        user = data["user"]
        try:
            from app.services.email import send_export_ready_email

            send_export_ready_email(user.email, download_url)
        except Exception as email_exc:
            print(f"[export] email send failed user={user_id}: {email_exc}")

        send_push_notification.delay(
            user_id,
            title="MindLift reminder",
            body="A short action is ready",
            data={"type": "export_ready"},
        )

        return {
            "status": "done",
            "user_id": user_id,
            "s3_key": s3_key,
            "download_url": download_url,
        }

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.worker.tasks.run_drift_detection", bind=True, max_retries=3)
def run_drift_detection(self):
    """
    Detect sustained sleep/step drift for all active users and send push
    notifications where warranted. Runs daily at 07:00 UTC.
    """

    async def _run():
        from sqlalchemy import select

        from app.database import AsyncSessionLocal
        from app.models.user import User
        from app.services.drift_detector import detect_drift_for_user

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User.id).where(
                    User.state.in_(["ACTIVE", "LIMITED"]),
                    User.deleted_at.is_(None),
                )
            )
            user_ids = result.scalars().all()

        notifications_sent = 0
        for uid in user_ids:
            try:
                async with AsyncSessionLocal() as db:
                    drift_results = await detect_drift_for_user(uid, db)
                    await db.commit()

                for drift in drift_results:
                    send_push_notification.delay(
                        str(drift.user_id),
                        title=drift.notification_title,
                        body=drift.notification_body,
                        data={
                            "type": "drift_alert",
                            "metric": drift.metric_key,
                            "direction": drift.direction,
                        },
                    )
                    notifications_sent += 1
            except Exception as exc:
                print(f"[drift] Error for user {uid}: {exc}")

        return {
            "users_checked": len(user_ids),
            "notifications_sent": notifications_sent,
        }

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * 5)
