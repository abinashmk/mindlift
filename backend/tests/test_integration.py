"""
Integration tests for MindLift — spec §37.2.

Covers:
  1. Consent submission
  2. Device registration
  3. Baseline creation (service-level)
  4. Missing-feature weight redistribution (risk engine)
  5. Intervention creation (service-level)
  6. Manual escalation
  7. Crisis chat stop
  8. Export request
  9. Delete request
"""
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intervention import Intervention, InterventionEvent
from app.models.metrics import Baseline, DailyMetric
from app.models.user import User
from app.services.baseline import compute_initial_baseline
from app.services.intervention_selector import SLEEP_CHECK, select_interventions
from app.services.risk_engine import BaselineEntry, RiskLevel, compute_risk

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# 1. Consent submission
# ---------------------------------------------------------------------------


async def test_consent_submission(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/v1/users/me/consents",
        json={
            "consent_key": "health_data_accepted",
            "consent_value": True,
            "policy_version": "1.0",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["consent_key"] == "health_data_accepted"
    assert data["consent_value"] is True


async def test_consent_list(client: AsyncClient, auth_headers: dict):
    # Submit then retrieve
    await client.post(
        "/v1/users/me/consents",
        json={"consent_key": "location_category_accepted", "consent_value": False, "policy_version": "1.0"},
        headers=auth_headers,
    )
    resp = await client.get("/v1/users/me/consents", headers=auth_headers)
    assert resp.status_code == 200
    keys = [c["consent_key"] for c in resp.json()]
    assert "location_category_accepted" in keys


# ---------------------------------------------------------------------------
# 2. Device registration
# ---------------------------------------------------------------------------


async def test_device_registration(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/v1/devices",
        json={
            "platform": "ios",
            "os_version": "17.4",
            "app_version": "1.0.0",
            "push_token": "tok_" + uuid.uuid4().hex,
            "notifications_enabled": True,
            "motion_permission": True,
            "health_permission": True,
            "location_permission": False,
            "noise_permission": False,
            "biometric_enabled": True,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["platform"] == "ios"
    assert data["push_token"].startswith("tok_")


async def test_device_registration_unauthenticated(client: AsyncClient):
    resp = await client.post(
        "/v1/devices",
        json={
            "platform": "android",
            "os_version": "14",
            "app_version": "1.0.0",
            "push_token": "tok_abc",
            "notifications_enabled": True,
            "motion_permission": False,
            "health_permission": False,
            "location_permission": False,
            "noise_permission": False,
            "biometric_enabled": False,
        },
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 3. Baseline creation (service-level)
# ---------------------------------------------------------------------------


async def test_compute_initial_baseline(db_session: AsyncSession, test_user: User):
    """Baseline rows should be created from 14 valid daily metric rows."""
    now = datetime.now(timezone.utc)

    for day_offset in range(14):
        m = DailyMetric(
            id=uuid.uuid4(),
            user_id=test_user.id,
            metric_date=date(2026, 1, day_offset + 1),
            sleep_hours=7.0 + (day_offset % 3) * 0.5,
            steps=8000 + day_offset * 100,
            mood_score=3,
            communication_count=10,
            created_at=now,
            updated_at=now,
        )
        db_session.add(m)
    await db_session.commit()

    await compute_initial_baseline(test_user.id, db_session)

    from sqlalchemy import select

    result = await db_session.execute(
        select(Baseline).where(Baseline.user_id == test_user.id)
    )
    baselines = result.scalars().all()
    baseline_keys = {b.feature_key for b in baselines}

    assert "sleep_hours" in baseline_keys
    assert "steps" in baseline_keys
    # All baselines must have valid_days > 0
    for b in baselines:
        assert b.valid_days > 0
        assert b.mean_value is not None
        assert b.std_value >= 0


# ---------------------------------------------------------------------------
# 4. Missing feature weight redistribution
# ---------------------------------------------------------------------------


def test_missing_feature_redistribution_scores_non_zero():
    """When only sleep + heart baselines are present, weight redistributes so score > 0."""
    baselines = {
        "sleep_hours": BaselineEntry(mean=7.5, std=1.0, valid_days=14),
        "resting_heart_rate_bpm": BaselineEntry(mean=65.0, std=5.0, valid_days=14),
    }
    result = compute_risk(
        sleep_hours=3.0,              # severely low → high score
        resting_heart_rate_bpm=90.0,  # severely high → high score
        baselines=baselines,
    )
    assert result.risk_level != RiskLevel.UNDEFINED
    assert result.risk_score > 0.0
    # Activity and social were missing — their feature scores must be None
    assert result.feature_activity_score is None
    assert result.feature_social_score is None


def test_missing_feature_redistribution_with_only_activity():
    """Only activity baseline → UNDEFINED because valid_days < 7 threshold not met at group level."""
    # Provide activity with enough valid days so the result is not UNDEFINED
    baselines = {
        "steps": BaselineEntry(mean=8000, std=1000, valid_days=14),
    }
    result = compute_risk(steps=500, baselines=baselines)
    # activity group has enough valid_days; redistributed weight should give a non-zero score
    assert result.risk_level != RiskLevel.UNDEFINED
    assert result.risk_score > 0.0


# ---------------------------------------------------------------------------
# 5. Intervention creation (service-level)
# ---------------------------------------------------------------------------


async def test_select_interventions_yellow_creates_event(
    db_session: AsyncSession, test_user: User
):
    """YELLOW risk for sleep deficit should create a SLEEP_CHECK intervention event."""
    now = datetime.now(timezone.utc)

    # Seed the SLEEP_CHECK intervention
    intervention = Intervention(
        id=uuid.uuid4(),
        code=SLEEP_CHECK,
        name="Sleep Check",
        type="cognitive",
        duration_minutes=5,
        instructions_markdown="Check your sleep habits.",
        contraindications=[],
        active=True,
        created_at=now,
        updated_at=now,
    )
    db_session.add(intervention)
    await db_session.commit()

    # Build a YELLOW risk result with sleep as the dominant score
    risk_result = compute_risk(
        sleep_hours=5.5,  # deficit
        baselines={"sleep_hours": BaselineEntry(mean=7.5, std=0.5, valid_days=14)},
    )
    assert risk_result.risk_level == RiskLevel.YELLOW

    events = await select_interventions(test_user, risk_result, db_session)
    assert len(events) == 1
    assert events[0].status == "TRIGGERED"

    from sqlalchemy import select as sa_select

    result = await db_session.execute(
        sa_select(InterventionEvent).where(InterventionEvent.user_id == test_user.id)
    )
    stored = result.scalars().all()
    assert len(stored) >= 1


async def test_select_interventions_green_creates_no_events(
    db_session: AsyncSession, test_user: User
):
    """GREEN risk should produce zero intervention events."""
    risk_result = compute_risk(
        sleep_hours=7.5,
        baselines={"sleep_hours": BaselineEntry(mean=7.5, std=1.0, valid_days=14)},
    )
    assert risk_result.risk_level == RiskLevel.GREEN
    events = await select_interventions(test_user, risk_result, db_session)
    assert events == []


# ---------------------------------------------------------------------------
# 6. Manual escalation
# ---------------------------------------------------------------------------


async def test_manual_escalation(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/v1/escalations",
        json={
            "source": "manual_user_request",
            "risk_level": "ORANGE",
            "packet": {"note": "User requested escalation via app."},
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["source"] == "manual_user_request"
    assert data["status"] == "NEW"
    assert data["risk_level"] == "ORANGE"


async def test_manual_escalation_sets_user_state_escalated(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User
):
    """Creating an escalation must transition user state to ESCALATED (unless CRISIS)."""
    resp = await client.post(
        "/v1/escalations",
        json={"source": "manual_user_request", "risk_level": "RED", "packet": {}},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    await db_session.refresh(test_user)
    assert test_user.state in ("ESCALATED", "CRISIS")


# ---------------------------------------------------------------------------
# 7. Crisis chat stop
# ---------------------------------------------------------------------------


async def test_crisis_blocks_chat_input(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User
):
    """Chat input must be blocked (403) when user is in CRISIS state."""
    # Set user to CRISIS
    test_user.state = "CRISIS"
    test_user.updated_at = datetime.now(timezone.utc)
    await db_session.commit()

    # Create a chat session first
    sess_resp = await client.post(
        "/v1/chat/sessions",
        json={"initial_state": "IDLE"},
        headers=auth_headers,
    )
    assert sess_resp.status_code == 201
    session_id = sess_resp.json()["id"]

    # Attempt to send a message — must be blocked
    msg_resp = await client.post(
        f"/v1/chat/sessions/{session_id}/messages",
        json={"content": "I need help"},
        headers=auth_headers,
    )
    assert msg_resp.status_code == 403


# ---------------------------------------------------------------------------
# 8. Export request
# ---------------------------------------------------------------------------


async def test_export_request_enqueues_task(client: AsyncClient, auth_headers: dict):
    """POST /account/export must return 202 and enqueue the Celery task."""
    mock_result = MagicMock()
    mock_result.id = "fake-task-id"

    with patch(
        "app.routers.account.generate_export_zip.delay",
        return_value=mock_result,
    ) as mock_delay:
        resp = await client.post("/v1/account/export", headers=auth_headers)

    assert resp.status_code == 202
    data = resp.json()
    assert data["task_id"] == "fake-task-id"
    mock_delay.assert_called_once()


# ---------------------------------------------------------------------------
# 9. Delete request
# ---------------------------------------------------------------------------


async def test_delete_account_enqueues_task(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession, test_user: User
):
    """DELETE /account must return 202, soft-delete the user, and enqueue deletion task."""
    mock_result = MagicMock()
    mock_result.id = "fake-delete-task"

    with patch(
        "app.routers.account.process_account_deletion.delay",
        return_value=mock_result,
    ) as mock_delay:
        resp = await client.delete("/v1/account", headers=auth_headers)

    assert resp.status_code == 202
    data = resp.json()
    assert data["task_id"] == "fake-delete-task"
    mock_delay.assert_called_once()

    # User should be soft-deleted in DB
    await db_session.refresh(test_user)
    assert test_user.state == "DELETED"
    assert test_user.deleted_at is not None
