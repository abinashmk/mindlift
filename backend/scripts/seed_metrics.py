"""
Seed 30 days of realistic daily metrics for a given user.
Creates baseline + daily_metrics rows so the risk engine has data to work with.

Usage (inside the container):
    docker exec mindlift_app python scripts/seed_metrics.py abinashdown3@gmail.com

Pass --orange or --red to seed the last 3 days with deteriorating metrics
so the risk engine fires an intervention / escalation.
"""

import asyncio
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://mindlift:mindlift_secret@postgres:5432/mindlift_db",
)

TARGET_EMAIL = sys.argv[1] if len(sys.argv) > 1 else "abinashdown3@gmail.com"
RISK_SCENARIO = "normal"
if "--orange" in sys.argv:
    RISK_SCENARIO = "orange"
elif "--red" in sys.argv:
    RISK_SCENARIO = "red"


def normal_day(day_offset: int) -> dict:
    """Realistic healthy baseline with small natural variation."""
    rng = random.Random(day_offset)
    return {
        "sleep_hours": round(rng.gauss(7.2, 0.5), 2),
        "sleep_quality": round(rng.gauss(0.72, 0.08), 2),
        "steps": int(rng.gauss(8500, 1200)),
        "active_minutes": int(rng.gauss(45, 10)),
        "heart_rate_avg": round(rng.gauss(68, 4), 1),
        "hrv_ms": round(rng.gauss(52, 8), 1),
        "mood_score": round(rng.gauss(6.5, 0.8)),
        "social_interactions": int(rng.gauss(5, 2)),
        "screen_time_minutes": int(rng.gauss(180, 40)),
        "notification_response_rate": round(rng.gauss(0.75, 0.1), 2),
        "location_home_ratio": round(rng.gauss(0.55, 0.1), 2),
        "location_transitions": int(rng.gauss(4, 1)),
        "ambient_noise_db": round(rng.gauss(48, 6), 1),
    }


def bad_day(severity: str, day_offset: int) -> dict:
    """Deteriorating metrics for orange/red scenario."""
    rng = random.Random(day_offset + 1000)
    if severity == "orange":
        return {
            "sleep_hours": round(rng.gauss(4.5, 0.4), 2),
            "sleep_quality": round(rng.gauss(0.38, 0.06), 2),
            "steps": int(rng.gauss(2800, 500)),
            "active_minutes": int(rng.gauss(8, 3)),
            "heart_rate_avg": round(rng.gauss(82, 4), 1),
            "hrv_ms": round(rng.gauss(28, 5), 1),
            "mood_score": round(rng.gauss(3.2, 0.5)),
            "social_interactions": int(rng.gauss(1, 1)),
            "screen_time_minutes": int(rng.gauss(380, 50)),
            "notification_response_rate": round(rng.gauss(0.25, 0.08), 2),
            "location_home_ratio": round(rng.gauss(0.92, 0.05), 2),
            "location_transitions": int(rng.gauss(1, 1)),
            "ambient_noise_db": round(rng.gauss(32, 4), 1),
        }
    else:  # red
        return {
            "sleep_hours": round(rng.gauss(2.5, 0.5), 2),
            "sleep_quality": round(rng.gauss(0.18, 0.05), 2),
            "steps": int(rng.gauss(800, 300)),
            "active_minutes": int(rng.gauss(2, 2)),
            "heart_rate_avg": round(rng.gauss(95, 5), 1),
            "hrv_ms": round(rng.gauss(14, 4), 1),
            "mood_score": round(rng.gauss(1.5, 0.4)),
            "social_interactions": 0,
            "screen_time_minutes": int(rng.gauss(500, 60)),
            "notification_response_rate": round(rng.gauss(0.05, 0.03), 2),
            "location_home_ratio": round(rng.gauss(0.99, 0.01), 2),
            "location_transitions": 0,
            "ambient_noise_db": round(rng.gauss(24, 3), 1),
        }


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get user id
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": TARGET_EMAIL},
        )
        row = result.fetchone()
        if not row:
            print(f"ERROR: user {TARGET_EMAIL} not found.")
            return
        user_id = str(row[0])
        print(f"Seeding metrics for {TARGET_EMAIL} ({user_id})")

        today = date.today()
        days = 30

        for i in range(days):
            day = today - timedelta(days=(days - 1 - i))
            day_offset = i

            # Last 3 days: bad metrics if scenario is set
            if RISK_SCENARIO != "normal" and i >= days - 3:
                m = bad_day(RISK_SCENARIO, day_offset)
            else:
                m = normal_day(day_offset)

            # Clamp to valid ranges
            m["sleep_hours"] = clamp(m["sleep_hours"], 0, 24)
            m["sleep_quality"] = clamp(m["sleep_quality"], 0, 1)
            m["steps"] = clamp(m["steps"], 0, 100000)
            m["active_minutes"] = clamp(m["active_minutes"], 0, 1440)
            m["heart_rate_avg"] = clamp(m["heart_rate_avg"], 30, 220)
            m["hrv_ms"] = clamp(m["hrv_ms"], 1, 300)
            m["mood_score"] = clamp(m["mood_score"], 1, 10)
            m["social_interactions"] = clamp(m["social_interactions"], 0, 100)
            m["screen_time_minutes"] = clamp(m["screen_time_minutes"], 0, 1440)
            m["notification_response_rate"] = clamp(m["notification_response_rate"], 0, 1)
            m["location_home_ratio"] = clamp(m["location_home_ratio"], 0, 1)
            m["location_transitions"] = clamp(m["location_transitions"], 0, 50)
            m["ambient_noise_db"] = clamp(m["ambient_noise_db"], 0, 140)

            await session.execute(
                text("""
                    INSERT INTO daily_metrics (
                        id, user_id, metric_date,
                        sleep_hours, steps,
                        average_heart_rate_bpm, hrv_ms, mood_score, communication_count,
                        screen_time_minutes, location_home_ratio, location_transitions,
                        noise_level_db_avg, created_at, updated_at
                    ) VALUES (
                        :id, :user_id, :metric_date,
                        :sleep_hours, :steps,
                        :heart_rate_avg, :hrv_ms, :mood_score, :social_interactions,
                        :screen_time_minutes, :location_home_ratio, :location_transitions,
                        :ambient_noise_db, :now, :now
                    )
                    ON CONFLICT (user_id, metric_date) DO UPDATE SET
                        sleep_hours = EXCLUDED.sleep_hours,
                        steps = EXCLUDED.steps,
                        average_heart_rate_bpm = EXCLUDED.average_heart_rate_bpm,
                        hrv_ms = EXCLUDED.hrv_ms,
                        mood_score = EXCLUDED.mood_score,
                        communication_count = EXCLUDED.communication_count,
                        screen_time_minutes = EXCLUDED.screen_time_minutes,
                        location_home_ratio = EXCLUDED.location_home_ratio,
                        location_transitions = EXCLUDED.location_transitions,
                        noise_level_db_avg = EXCLUDED.noise_level_db_avg,
                        updated_at = EXCLUDED.updated_at
                """),
                {**m, "id": str(uuid.uuid4()), "user_id": user_id,
                 "metric_date": day, "now": datetime.now(timezone.utc)},
            )

        await session.commit()
        print(f"  inserted {days} days of metrics (scenario: {RISK_SCENARIO})")

    await engine.dispose()
    print("\nDone. Now trigger the risk engine:")
    print(f"  docker exec mindlift_app python -c \"import asyncio; from app.services.risk import run_risk_assessment; ...\"")


if __name__ == "__main__":
    asyncio.run(seed())
