"""
Push notification delivery for iOS (APNs) and Android (FCM).

APNs uses JWT-based provider authentication (ES256).
FCM uses the Legacy HTTP API with a server key.

Both senders are stateless — callers pass title/body and the device token.
The Celery task is responsible for looking up devices and dispatching here.
"""
import json
import time
from typing import Any

import httpx
from jose import jwt

from app.config import settings

# APNs endpoints
_APNS_PROD = "https://api.push.apple.com"
_APNS_SANDBOX = "https://api.sandbox.push.apple.com"

# FCM Legacy HTTP endpoint
_FCM_URL = "https://fcm.googleapis.com/fcm/send"

# Cache the APNs JWT for up to 55 minutes (Apple allows up to 60).
_apns_token_cache: dict[str, Any] = {"token": None, "issued_at": 0}


def _apns_jwt() -> str:
    """Return a cached APNs provider JWT, refreshing if older than 55 minutes."""
    now = int(time.time())
    if _apns_token_cache["token"] and now - _apns_token_cache["issued_at"] < 55 * 60:
        return _apns_token_cache["token"]  # type: ignore[return-value]

    token = jwt.encode(
        {"iss": settings.apns_team_id, "iat": now},
        settings.apns_auth_key_pem,
        algorithm="ES256",
        headers={"kid": settings.apns_key_id},
    )
    _apns_token_cache["token"] = token
    _apns_token_cache["issued_at"] = now
    return token


def send_apns(device_token: str, title: str, body: str, data: dict | None = None) -> bool:
    """
    Send a push notification to an iOS device via APNs HTTP/2.

    Returns True on success, False on a non-retriable failure.
    Raises httpx.HTTPError on transient failures (caller may retry).
    """
    if not all([settings.apns_key_id, settings.apns_team_id, settings.apns_auth_key_pem]):
        # Config absent — acceptable in local/dev; log and skip.
        print("[push/apns] APNs not configured — skipping.")
        return False

    host = _APNS_SANDBOX if settings.apns_use_sandbox else _APNS_PROD
    url = f"{host}/3/device/{device_token}"

    payload: dict[str, Any] = {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}}
    if data:
        payload.update(data)

    headers = {
        "authorization": f"bearer {_apns_jwt()}",
        "apns-topic": settings.apns_bundle_id,
        "apns-push-type": "alert",
        "apns-priority": "10",
    }

    with httpx.Client(http2=True, timeout=10) as client:
        resp = client.post(url, content=json.dumps(payload), headers=headers)

    if resp.status_code == 200:
        return True

    reason = resp.json().get("reason", "") if resp.content else ""
    # Non-retriable device-level errors — token is invalid/unregistered.
    if reason in ("BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"):
        print(f"[push/apns] non-retriable error device={device_token} reason={reason}")
        return False

    # Any other 4xx/5xx — raise so Celery can retry.
    resp.raise_for_status()
    return False  # unreachable


def send_fcm(device_token: str, title: str, body: str, data: dict | None = None) -> bool:
    """
    Send a push notification to an Android device via FCM Legacy HTTP API.

    Returns True on success, False on a non-retriable failure.
    Raises httpx.HTTPError on transient failures (caller may retry).
    """
    if not settings.fcm_server_key:
        print("[push/fcm] FCM not configured — skipping.")
        return False

    payload: dict[str, Any] = {
        "to": device_token,
        "notification": {"title": title, "body": body},
        "priority": "high",
    }
    if data:
        payload["data"] = data

    headers = {
        "Authorization": f"key={settings.fcm_server_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=10) as client:
        resp = client.post(_FCM_URL, json=payload, headers=headers)

    if resp.status_code == 200:
        body_json = resp.json()
        if body_json.get("failure", 0) == 0:
            return True
        # Check per-result error
        results = body_json.get("results", [{}])
        error = results[0].get("error", "")
        if error in ("NotRegistered", "InvalidRegistration"):
            print(f"[push/fcm] non-retriable error device={device_token} error={error}")
            return False
        # Other FCM errors — raise for retry
        raise httpx.HTTPStatusError(
            f"FCM error: {error}", request=None, response=resp  # type: ignore[arg-type]
        )

    resp.raise_for_status()
    return False  # unreachable
