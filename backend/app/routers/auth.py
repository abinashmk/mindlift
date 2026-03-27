import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_mfa_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.database import get_db
from app.models.user import User, UserConsent
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MFAVerifyRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.auth import refresh_tokens, register_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# ---------------------------------------------------------------------------
# Redis helper — lazy singleton so the app starts even without Redis available
# ---------------------------------------------------------------------------

_redis_client = None


async def _get_redis():
    global _redis_client
    if _redis_client is None:
        import redis.asyncio as aioredis

        from app.config import settings

        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    user = await register_user(payload, db)
    await write_audit_log(
        db,
        actor_type="user",
        actor_id=user.id,
        action_key="user.register",
        entity_type="user",
        entity_id=user.id,
        extra={"email": user.email},
    )
    return {"id": str(user.id), "message": "Registration successful. Please verify your email."}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    user: User | None = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    if user.deleted_at is not None:
        raise HTTPException(status_code=403, detail="Account deleted.")

    # If MFA is enabled, return a short-lived mfa_pending token instead of full tokens.
    if user.mfa_enabled and user.mfa_secret:
        mfa_token = create_mfa_token(str(user.id))
        return {
            "access_token": mfa_token,
            "refresh_token": "",
            "token_type": "mfa_pending",
            "expires_in": 300,
        }

    from app.config import settings

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/mfa/verify", response_model=TokenResponse)
@limiter.limit("10/minute")
async def mfa_verify(
    request: Request,
    response: Response,
    payload: MFAVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify TOTP code after password check. Exchanges mfa_pending token for full tokens."""
    import pyotp

    try:
        token_data = decode_token(payload.mfa_token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired MFA token.")

    if token_data.get("type") != "mfa_pending":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    user_id = uuid.UUID(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found.")

    if not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA not configured for this account.")

    totp = pyotp.TOTP(user.mfa_secret)
    if not totp.verify(payload.otp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid OTP code.")

    from app.config import settings

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    return await refresh_tokens(payload.refresh_token, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest):
    # Stateless JWT: client must discard tokens.
    # For full token revocation, add the JTI to a Redis blocklist here.
    return None


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify email via token, set email_verified=True, and transition ONBOARDING state if consents already accepted."""
    try:
        token_data = decode_token(payload.token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")

    if token_data.get("type") != "email_verify":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    user_id = uuid.UUID(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.email_verified = True
    user.updated_at = datetime.now(timezone.utc)

    # Transition from ONBOARDING → ACTIVE if the user has already accepted required consents.
    if user.state == "ONBOARDING":
        consents_result = await db.execute(
            select(UserConsent).where(
                UserConsent.user_id == user_id,
                UserConsent.consent_value == True,
            )
        )
        accepted_keys = {c.consent_key for c in consents_result.scalars().all()}
        required = {"terms_accepted", "privacy_accepted"}
        if required.issubset(accepted_keys):
            user.state = "ACTIVE"
            user.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return {"message": "Email verified successfully."}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    response: Response,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a password-reset token, store it in Redis with a 30-minute TTL,
    and log it to console (real email not wired yet).
    Always returns a generic message to prevent user enumeration.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user: User | None = result.scalar_one_or_none()

    if user and user.deleted_at is None:
        reset_token = str(uuid.uuid4())
        redis = await _get_redis()
        key = f"pwd_reset:{reset_token}"
        await redis.set(key, str(user.id), ex=1800)  # 30-minute TTL

        from app.config import settings as cfg
        from app.services.email import send_password_reset_email

        reset_url = f"{cfg.app_base_url}/reset-password?token={reset_token}"
        try:
            send_password_reset_email(user.email, reset_url)
        except Exception as email_exc:
            logger.warning("[forgot-password] email send failed for %s: %s", payload.email, email_exc)

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def reset_password(
    request: Request,
    response: Response,
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Validate reset token from Redis, update password hash, invalidate token."""
    redis = await _get_redis()
    key = f"pwd_reset:{payload.token}"
    user_id_str: str | None = await redis.get(key)

    if not user_id_str:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    try:
        validate_password_strength(payload.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user_id = uuid.UUID(user_id_str)
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.now(timezone.utc)
    await db.flush()

    # Invalidate the token immediately after use.
    await redis.delete(key)

    return {"message": "Password reset successfully."}
