from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    validate_password_strength,
)
from app.database import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.auth import login_user, refresh_tokens, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


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
        metadata={"email": user.email},
    )
    return {"id": str(user.id), "message": "Registration successful. Please verify your email."}


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    return await login_user(payload, db)


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
    """Verify email via token issued at registration (stub — wire to email service)."""
    try:
        token_data = decode_token(payload.token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")

    if token_data.get("type") != "email_verify":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    from sqlalchemy import select
    import uuid
    from app.models.user import User

    user_id = uuid.UUID(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.email_verified = True
    await db.flush()
    return {"message": "Email verified successfully."}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(payload: ForgotPasswordRequest):
    # In production: generate a signed reset token, email it to the user.
    # Returning a generic message prevents user enumeration.
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        token_data = decode_token(payload.token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    if token_data.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token type.")

    validate_password_strength(payload.new_password)

    from sqlalchemy import select
    import uuid
    from app.models.user import User

    user_id = uuid.UUID(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(payload.new_password)
    await db.flush()
    return {"message": "Password reset successfully."}
