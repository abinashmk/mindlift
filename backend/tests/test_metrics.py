"""Tests for daily metrics submission and retrieval."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


VALID_PAYLOAD = {
    "metric_date": "2026-03-01",
    "steps": 8000,
    "resting_heart_rate_bpm": 62.0,
    "average_heart_rate_bpm": 75.0,
    "hrv_ms": 45.0,
    "sleep_hours": 7.5,
    "sleep_source": "wearable",
    "screen_time_minutes": 180,
    "location_home_ratio": 0.6,
    "location_transitions": 5,
    "noise_level_db_avg": 45.0,
    "mood_score": 4,
    "communication_count": 12,
}


async def test_submit_metrics_success(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/v1/metrics/daily", json=VALID_PAYLOAD, headers=auth_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["steps"] == 8000
    assert data["mood_score"] == 4


async def test_submit_metrics_unauthenticated(client: AsyncClient):
    resp = await client.post("/v1/metrics/daily", json=VALID_PAYLOAD)
    assert resp.status_code == 401


async def test_steps_out_of_range_rejected(client: AsyncClient, auth_headers: dict):
    payload = {**VALID_PAYLOAD, "metric_date": "2026-03-10", "steps": 200000}
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_mood_score_out_of_range_rejected(
    client: AsyncClient, auth_headers: dict
):
    payload = {**VALID_PAYLOAD, "metric_date": "2026-03-11", "mood_score": 6}
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_sleep_hours_out_of_range_rejected(
    client: AsyncClient, auth_headers: dict
):
    payload = {**VALID_PAYLOAD, "metric_date": "2026-03-12", "sleep_hours": 25.0}
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_heart_rate_below_minimum_rejected(
    client: AsyncClient, auth_headers: dict
):
    payload = {
        **VALID_PAYLOAD,
        "metric_date": "2026-03-13",
        "resting_heart_rate_bpm": 10.0,
    }
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_noise_level_above_maximum_rejected(
    client: AsyncClient, auth_headers: dict
):
    payload = {
        **VALID_PAYLOAD,
        "metric_date": "2026-03-14",
        "noise_level_db_avg": 200.0,
    }
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_screen_time_minutes_max_ok(client: AsyncClient, auth_headers: dict):
    payload = {
        **VALID_PAYLOAD,
        "metric_date": "2026-03-15",
        "screen_time_minutes": 1440,
    }
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 201


async def test_screen_time_minutes_over_max_rejected(
    client: AsyncClient, auth_headers: dict
):
    payload = {
        **VALID_PAYLOAD,
        "metric_date": "2026-03-16",
        "screen_time_minutes": 1441,
    }
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_location_home_ratio_out_of_range_rejected(
    client: AsyncClient, auth_headers: dict
):
    payload = {**VALID_PAYLOAD, "metric_date": "2026-03-17", "location_home_ratio": 1.5}
    resp = await client.post("/v1/metrics/daily", json=payload, headers=auth_headers)
    assert resp.status_code == 422


async def test_get_metrics_list(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/v1/metrics/daily",
        json={**VALID_PAYLOAD, "metric_date": "2026-02-01"},
        headers=auth_headers,
    )
    resp = await client.get("/v1/metrics/daily", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1


async def test_get_specific_date(client: AsyncClient, auth_headers: dict):
    metric_date = "2026-02-05"
    await client.post(
        "/v1/metrics/daily",
        json={**VALID_PAYLOAD, "metric_date": metric_date},
        headers=auth_headers,
    )
    resp = await client.get(f"/v1/metrics/daily/{metric_date}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["metric_date"] == metric_date


async def test_get_missing_date(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/v1/metrics/daily/2000-01-01", headers=auth_headers)
    assert resp.status_code == 404


async def test_upsert_existing_date(client: AsyncClient, auth_headers: dict):
    metric_date = "2026-02-10"
    await client.post(
        "/v1/metrics/daily",
        json={**VALID_PAYLOAD, "metric_date": metric_date, "steps": 5000},
        headers=auth_headers,
    )
    resp = await client.post(
        "/v1/metrics/daily",
        json={**VALID_PAYLOAD, "metric_date": metric_date, "steps": 9999},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["steps"] == 9999
