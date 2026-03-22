import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field


class SleepSource(str, Enum):
    wearable = "wearable"
    inferred = "inferred"
    manual = "manual"
    unknown = "unknown"


class DailyMetricCreate(BaseModel):
    metric_date: date
    steps: int | None = Field(default=None, ge=0, le=100000)
    resting_heart_rate_bpm: float | None = Field(default=None, ge=20.0, le=220.0)
    average_heart_rate_bpm: float | None = Field(default=None, ge=20.0, le=220.0)
    hrv_ms: float | None = Field(default=None, ge=0.0, le=500.0)
    sleep_hours: float | None = Field(default=None, ge=0.0, le=24.0)
    sleep_source: SleepSource | None = None
    screen_time_minutes: int | None = Field(default=None, ge=0, le=1440)
    location_home_ratio: float | None = Field(default=None, ge=0.0, le=1.0)
    location_transitions: int | None = Field(default=None, ge=0, le=100)
    noise_level_db_avg: float | None = Field(default=None, ge=0.0, le=140.0)
    mood_score: int | None = Field(default=None, ge=1, le=5)
    communication_count: int | None = Field(default=None, ge=0, le=500)


class DailyMetricResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: uuid.UUID
    metric_date: date
    steps: int | None
    resting_heart_rate_bpm: float | None
    average_heart_rate_bpm: float | None
    hrv_ms: float | None
    sleep_hours: float | None
    sleep_source: str | None
    screen_time_minutes: int | None
    location_home_ratio: float | None
    location_transitions: int | None
    noise_level_db_avg: float | None
    mood_score: int | None
    communication_count: int | None
    created_at: datetime
    updated_at: datetime


class MetricsListResponse(BaseModel):
    items: list[DailyMetricResponse]
    total: int
