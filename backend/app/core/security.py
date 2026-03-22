import re
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Password policy regex components
_PASSWORD_MIN_LEN = 12
_RE_UPPER = re.compile(r"[A-Z]")
_RE_LOWER = re.compile(r"[a-z]")
_RE_DIGIT = re.compile(r"\d")
_RE_SPECIAL = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]")


def validate_password_strength(password: str) -> None:
    """Raise ValueError if the password does not meet the policy."""
    errors: list[str] = []
    if len(password) < _PASSWORD_MIN_LEN:
        errors.append(f"Password must be at least {_PASSWORD_MIN_LEN} characters long.")
    if not _RE_UPPER.search(password):
        errors.append("Password must contain at least one uppercase letter.")
    if not _RE_LOWER.search(password):
        errors.append("Password must contain at least one lowercase letter.")
    if not _RE_DIGIT.search(password):
        errors.append("Password must contain at least one digit.")
    if not _RE_SPECIAL.search(password):
        errors.append("Password must contain at least one special character.")
    if errors:
        raise ValueError(" ".join(errors))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _make_token(data: dict, expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    payload["jti"] = str(uuid.uuid4())
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_access_token(user_id: str) -> str:
    return _make_token(
        {"sub": user_id, "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: str) -> str:
    return _make_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def create_mfa_token(user_id: str) -> str:
    """Short-lived token issued after password check, before TOTP verification."""
    return _make_token(
        {"sub": user_id, "type": "mfa_pending"},
        timedelta(minutes=5),
    )


def create_support_access_token(support_user_id: str, role: str) -> str:
    """Access token for support dashboard users, includes role claim."""
    return _make_token(
        {"sub": support_user_id, "type": "support_access", "role": role},
        timedelta(hours=8),
    )


def create_support_mfa_pending_token(support_user_id: str) -> str:
    """Short-lived token issued to support user after password check, before MFA."""
    return _make_token(
        {"sub": support_user_id, "type": "support_mfa_pending"},
        timedelta(minutes=5),
    )


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
