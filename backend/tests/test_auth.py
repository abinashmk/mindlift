"""Tests for auth registration, login, and token refresh."""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_register_success(client: AsyncClient):
    resp = await client.post(
        "/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "SecureP@ss123!",
            "first_name": "Alice",
            "timezone": "America/New_York",
            "age_confirmed_18_plus": True,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "id" in data


async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "dup@example.com",
        "password": "SecureP@ss123!",
        "timezone": "UTC",
        "age_confirmed_18_plus": True,
    }
    await client.post("/v1/auth/register", json=payload)
    resp = await client.post("/v1/auth/register", json=payload)
    assert resp.status_code == 409


async def test_register_age_gate(client: AsyncClient):
    resp = await client.post(
        "/v1/auth/register",
        json={
            "email": "young@example.com",
            "password": "SecureP@ss123!",
            "timezone": "UTC",
            "age_confirmed_18_plus": False,
        },
    )
    assert resp.status_code == 422  # Pydantic rejects at schema level


async def test_register_weak_password(client: AsyncClient):
    resp = await client.post(
        "/v1/auth/register",
        json={
            "email": "weakpw@example.com",
            "password": "short",
            "timezone": "UTC",
            "age_confirmed_18_plus": True,
        },
    )
    assert resp.status_code == 422


async def test_login_success(client: AsyncClient):
    email = "login_test@example.com"
    password = "SecureP@ss123!"
    await client.post(
        "/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "timezone": "UTC",
            "age_confirmed_18_plus": True,
        },
    )
    resp = await client.post("/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    resp = await client.post(
        "/v1/auth/login",
        json={"email": "nobody@example.com", "password": "WrongP@ss999!"},
    )
    assert resp.status_code == 401


async def test_refresh_token(client: AsyncClient):
    email = "refresh_test@example.com"
    password = "SecureP@ss123!"
    await client.post(
        "/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "timezone": "UTC",
            "age_confirmed_18_plus": True,
        },
    )
    login = await client.post("/v1/auth/login", json={"email": email, "password": password})
    refresh_token = login.json()["refresh_token"]

    resp = await client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


async def test_get_me_authenticated(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/v1/users/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "email" in data


async def test_get_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/v1/users/me")
    assert resp.status_code == 401


async def test_password_policy_no_uppercase(client: AsyncClient):
    resp = await client.post(
        "/v1/auth/register",
        json={
            "email": "noup@example.com",
            "password": "nouppercase123!",
            "timezone": "UTC",
            "age_confirmed_18_plus": True,
        },
    )
    assert resp.status_code == 422


async def test_password_policy_no_special_char(client: AsyncClient):
    resp = await client.post(
        "/v1/auth/register",
        json={
            "email": "nospec@example.com",
            "password": "NoSpecialChar123",
            "timezone": "UTC",
            "age_confirmed_18_plus": True,
        },
    )
    assert resp.status_code == 422
