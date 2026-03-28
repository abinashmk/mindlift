import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.metrics import DailyMetric
from app.models.user import User
from app.schemas.metrics import DailyMetricCreate, DailyMetricResponse, MetricsListResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/daily", response_model=DailyMetricResponse, status_code=status.HTTP_201_CREATED)
async def submit_daily_metrics(
    payload: DailyMetricCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Upsert: if a record already exists for this user+date, update it.
    result = await db.execute(
        select(DailyMetric).where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.metric_date == payload.metric_date,
        )
    )
    existing: DailyMetric | None = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if existing:
        for field, value in payload.model_dump(exclude_none=True, exclude={"metric_date"}).items():
            setattr(existing, field, value)
        existing.updated_at = now
        await db.flush()
        return existing

    sleep_source_val = payload.sleep_source.value if payload.sleep_source else None
    stress_source_val = payload.stress_source.value if payload.stress_source else None

    metric = DailyMetric(
        id=uuid.uuid4(),
        user_id=current_user.id,
        metric_date=payload.metric_date,
        steps=payload.steps,
        resting_heart_rate_bpm=payload.resting_heart_rate_bpm,
        average_heart_rate_bpm=payload.average_heart_rate_bpm,
        hrv_ms=payload.hrv_ms,
        sleep_hours=payload.sleep_hours,
        sleep_source=sleep_source_val,
        screen_time_minutes=payload.screen_time_minutes,
        location_home_ratio=payload.location_home_ratio,
        location_transitions=payload.location_transitions,
        noise_level_db_avg=payload.noise_level_db_avg,
        mood_score=payload.mood_score,
        stress_source=stress_source_val,
        meeting_hours=payload.meeting_hours,
        communication_count=payload.communication_count,
        created_at=now,
        updated_at=now,
    )
    db.add(metric)
    await db.flush()
    return metric


@router.get("/daily", response_model=MetricsListResponse)
async def list_daily_metrics(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=90),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(DailyMetric).where(DailyMetric.user_id == current_user.id)
    if start_date:
        query = query.where(DailyMetric.metric_date >= start_date)
    if end_date:
        query = query.where(DailyMetric.metric_date <= end_date)
    query = query.order_by(DailyMetric.metric_date.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    items = list(result.scalars().all())

    # Total count
    from sqlalchemy import func

    count_query = select(func.count()).select_from(DailyMetric).where(
        DailyMetric.user_id == current_user.id
    )
    if start_date:
        count_query = count_query.where(DailyMetric.metric_date >= start_date)
    if end_date:
        count_query = count_query.where(DailyMetric.metric_date <= end_date)
    total = (await db.execute(count_query)).scalar_one()

    return MetricsListResponse(items=items, total=total)


@router.get("/daily/{metric_date}", response_model=DailyMetricResponse)
async def get_daily_metric(
    metric_date: date,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DailyMetric).where(
            DailyMetric.user_id == current_user.id,
            DailyMetric.metric_date == metric_date,
        )
    )
    metric: DailyMetric | None = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="No metrics found for this date.")
    return metric
