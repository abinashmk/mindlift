"""
Rate limiter for MindLift API.

Uses slowapi (built on the `limits` library) with Redis as the shared storage
backend so limits are enforced consistently across multiple workers.

Limits applied (spec §33.6):
  POST /auth/login            — 10/minute per IP
  POST /auth/mfa/verify       — 10/minute per IP
  POST /auth/forgot-password  — 5/minute per IP
  POST /auth/reset-password   — 10/minute per IP
  POST /chat/message          — 30/minute per authenticated user ID
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Default key: remote IP address (used for auth endpoints).
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    # Return 429 with a JSON body matching our standard error format.
    headers_enabled=True,
)


def get_user_id_or_ip(request) -> str:
    """
    Key function for authenticated endpoints: use the bearer token subject (user ID)
    so the limit is per-user rather than per-IP (handles shared IPs / proxies).
    Falls back to IP if no valid token is present.
    """
    from jose import JWTError

    from app.core.security import decode_token

    auth_header: str = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            token_data = decode_token(auth_header[7:])
            sub = token_data.get("sub")
            if sub:
                return f"user:{sub}"
        except (JWTError, Exception):
            pass
    return get_remote_address(request)
