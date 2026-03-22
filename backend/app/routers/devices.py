import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.device import Device
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def register_device(
    payload: DeviceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    device = Device(
        id=uuid.uuid4(),
        user_id=current_user.id,
        platform=payload.platform.value,
        os_version=payload.os_version,
        app_version=payload.app_version,
        push_token=payload.push_token,
        notifications_enabled=payload.notifications_enabled,
        motion_permission=payload.motion_permission,
        health_permission=payload.health_permission,
        location_permission=payload.location_permission,
        noise_permission=payload.noise_permission,
        biometric_enabled=payload.biometric_enabled,
        created_at=now,
        updated_at=now,
    )
    db.add(device)
    await db.flush()
    return device


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: uuid.UUID,
    payload: DeviceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device).where(Device.id == device_id, Device.user_id == current_user.id)
    )
    device: Device | None = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(device, field, value)
    device.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return device


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Device)
        .where(Device.user_id == current_user.id)
        .order_by(Device.created_at.desc())
    )
    return result.scalars().all()
