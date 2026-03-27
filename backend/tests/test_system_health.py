"""
System health endpoint tests — spec §24 / item #24.

Verifies:
  - GET /health returns 200 with {"status": "ok"}
  - GET /v1/support/system-health requires admin auth
  - GET /v1/support/system-health returns expected fields (db_status, redis_status,
    open_escalations_new, open_escalations_ack, open_escalations_in_progress)
"""
import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_support_access_token, hash_password
from app.models.support import SupportUser

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Public health endpoint
# ---------------------------------------------------------------------------


async def test_health_check_returns_ok(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


# ---------------------------------------------------------------------------
# Support system-health endpoint (admin only)
# ---------------------------------------------------------------------------


@pytest.fixture
async def admin_support_user(db_session: AsyncSession) -> SupportUser:
    now = datetime.now(timezone.utc)
    user = SupportUser(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:6]}@mindlift.app",
        password_hash=hash_password("AdminP@ss1!"),
        role="admin",
        mfa_enabled=False,
        is_active=True,
        must_change_password=False,
        created_at=now,
        updated_at=now,
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
def admin_headers(admin_support_user: SupportUser) -> dict:
    token = create_support_access_token(str(admin_support_user.id), "admin")
    return {"Authorization": f"Bearer {token}"}


async def test_system_health_requires_auth(client: AsyncClient):
    resp = await client.get("/v1/support/system-health")
    assert resp.status_code == 401


async def test_system_health_returns_fields(
    client: AsyncClient,
    admin_support_user: SupportUser,
    admin_headers: dict,
):
    resp = await client.get("/v1/support/system-health", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()

    # DB connectivity — SQLite is always ok in tests
    assert data["db_status"] == "ok"

    # Redis may not be present in test environment — just check field exists
    assert "redis_status" in data

    # Escalation counts — should be integers (zero or more)
    assert isinstance(data["open_escalations_new"], int)
    assert isinstance(data["open_escalations_ack"], int)
    assert isinstance(data["open_escalations_in_progress"], int)
    assert "checked_at" in data


async def test_system_health_counts_open_escalations(
    client: AsyncClient,
    admin_support_user: SupportUser,
    admin_headers: dict,
    auth_headers: dict,
):
    """Creating an escalation increments the open_escalations_new count."""
    # Get baseline count
    baseline_resp = await client.get("/v1/support/system-health", headers=admin_headers)
    baseline_new = baseline_resp.json()["open_escalations_new"]

    # Create an escalation
    await client.post(
        "/v1/escalations",  # correct /v1 prefix
        json={"source": "manual_user_request", "risk_level": "YELLOW", "packet": {}},
        headers=auth_headers,
    )

    # Recheck
    resp = await client.get("/v1/support/system-health", headers=admin_headers)
    assert resp.json()["open_escalations_new"] == baseline_new + 1


async def test_system_health_non_admin_forbidden(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Support agents (non-admin) cannot access system-health."""
    now = datetime.now(timezone.utc)
    agent = SupportUser(
        id=uuid.uuid4(),
        email=f"agent_{uuid.uuid4().hex[:6]}@mindlift.app",
        password_hash=hash_password("AgentP@ss1!"),
        role="support_agent",
        mfa_enabled=False,
        is_active=True,
        must_change_password=False,
        created_at=now,
        updated_at=now,
    )
    db_session.add(agent)
    await db_session.commit()

    token = create_support_access_token(str(agent.id), "support_agent")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/v1/support/system-health", headers=headers)
    assert resp.status_code == 403
