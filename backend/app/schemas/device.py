import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class DevicePlatform(str, Enum):
    ios = "ios"
    android = "android"


class DeviceCreate(BaseModel):
    platform: DevicePlatform
    os_version: str
    app_version: str
    push_token: str | None = None
    notifications_enabled: bool
    motion_permission: bool
    health_permission: bool
    location_permission: bool
    noise_permission: bool
    biometric_enabled: bool


class DeviceUpdate(BaseModel):
    os_version: str | None = None
    app_version: str | None = None
    push_token: str | None = None
    notifications_enabled: bool | None = None
    motion_permission: bool | None = None
    health_permission: bool | None = None
    location_permission: bool | None = None
    noise_permission: bool | None = None
    biometric_enabled: bool | None = None


class DeviceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    platform: str
    os_version: str
    app_version: str
    push_token: str | None
    notifications_enabled: bool
    motion_permission: bool
    health_permission: bool
    location_permission: bool
    noise_permission: bool
    biometric_enabled: bool
    created_at: datetime
    updated_at: datetime
