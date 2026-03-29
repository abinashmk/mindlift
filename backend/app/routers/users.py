import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.database import get_db
from app.models.user import User, UserConsent
from app.schemas.user import (
    ConsentRequest,
    ConsentResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    payload: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.timezone is not None:
        current_user.timezone = payload.timezone
    current_user.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.deleted_at = datetime.now(timezone.utc)
    current_user.state = "DELETED"
    current_user.updated_at = datetime.now(timezone.utc)
    await write_audit_log(
        db,
        actor_type="user",
        actor_id=current_user.id,
        action_key="user.soft_delete",
        entity_type="user",
        entity_id=current_user.id,
    )
    await db.flush()
    return None


@router.post(
    "/me/consents", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED
)
async def create_consent(
    payload: ConsentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    consent = UserConsent(
        id=uuid.uuid4(),
        user_id=current_user.id,
        consent_key=payload.consent_key,
        consent_value=payload.consent_value,
        policy_version=payload.policy_version,
        created_at=datetime.now(timezone.utc),
    )
    db.add(consent)
    await db.flush()
    return consent


@router.get("/me/consents", response_model=list[ConsentResponse])
async def list_consents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select

    result = await db.execute(
        select(UserConsent)
        .where(UserConsent.user_id == current_user.id)
        .order_by(UserConsent.created_at.desc())
    )
    return result.scalars().all()
