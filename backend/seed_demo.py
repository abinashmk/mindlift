"""
Seed demo data for abinashdown3@gmail.com.

Story: 30 days of data. First 3 weeks show a healthy baseline — decent sleep,
good step counts, stable mood. Final week shows a burnout pattern: sleep drops,
steps drop, mood dips, stress source shifts to deadlines/workload. This triggers
the pattern insight card and a non-green burnout load score.
"""

import asyncio
import uuid
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import os
import sys

sys.path.insert(0, "/app")

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL)
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

USER_ID = uuid.UUID("69406364-6247-4c88-a350-b1f2e2795187")
TODAY = date.today()


def days_ago(n: int) -> date:
    return TODAY - timedelta(days=n)


def dt(d: date, hour: int = 8) -> datetime:
    return datetime(d.year, d.month, d.day, hour, 0, 0, tzinfo=timezone.utc)


async def main():
    async with Session() as db:
        # ── Clear existing data for clean seed ───────────────────────────────
        await db.execute(text("DELETE FROM drift_alerts WHERE user_id = :uid"), {"uid": USER_ID})
        await db.execute(text("DELETE FROM risk_assessments WHERE user_id = :uid"), {"uid": USER_ID})
        await db.execute(text("DELETE FROM baselines WHERE user_id = :uid"), {"uid": USER_ID})
        await db.execute(text("DELETE FROM daily_metrics WHERE user_id = :uid"), {"uid": USER_ID})
        await db.commit()
        print("Cleared existing data.")

        # ── Generate daily_metrics ───────────────────────────────────────────
        # Baseline period (days 29 → 7): steady healthy patterns
        # Decline period (days 6 → 0): sleep drops, steps drop, mood dips

        random.seed(42)
        rows = []

        stress_sources_baseline = ["workload", "relationships", None, None, "other", "workload", None]
        stress_sources_decline  = ["deadlines", "deadlines", "workload", "deadlines", "career", "deadlines", "workload"]

        for i in range(30, -1, -1):
            d = days_ago(i)
            is_decline = i <= 6  # last 7 days

            if is_decline:
                # Burnout week: less sleep, fewer steps, lower mood
                sleep = round(random.uniform(5.0, 6.4), 1)
                steps = random.randint(2800, 5500)
                mood  = random.choice([1, 2, 2, 2, 3])
                stress = stress_sources_decline[i % len(stress_sources_decline)]
                hrv   = round(random.uniform(28, 40), 1)
                rhr   = round(random.uniform(68, 78), 1)
            else:
                # Healthy baseline
                sleep = round(random.uniform(6.8, 8.2), 1)
                steps = random.randint(6500, 11000)
                mood  = random.choice([3, 3, 4, 4, 4, 5])
                stress = stress_sources_baseline[i % len(stress_sources_baseline)]
                hrv   = round(random.uniform(42, 65), 1)
                rhr   = round(random.uniform(58, 67), 1)

            row_id = uuid.uuid4()
            rows.append({
                "id": row_id,
                "user_id": USER_ID,
                "metric_date": d,
                "steps": steps,
                "resting_heart_rate_bpm": rhr,
                "average_heart_rate_bpm": round(rhr + random.uniform(5, 15), 1),
                "hrv_ms": hrv,
                "sleep_hours": sleep,
                "sleep_source": "inferred",
                "screen_time_minutes": random.randint(120, 360),
                "location_home_ratio": round(random.uniform(0.4, 0.85), 2),
                "location_transitions": random.randint(2, 8),
                "noise_level_db_avg": round(random.uniform(38, 55), 1),
                "mood_score": mood,
                "stress_source": stress,
                "communication_count": random.randint(5, 30),
                "created_at": dt(d),
                "updated_at": dt(d),
            })

        for row in rows:
            await db.execute(
                text("""
                    INSERT INTO daily_metrics
                        (id, user_id, metric_date, steps, resting_heart_rate_bpm,
                         average_heart_rate_bpm, hrv_ms, sleep_hours, sleep_source,
                         screen_time_minutes, location_home_ratio, location_transitions,
                         noise_level_db_avg, mood_score, stress_source,
                         communication_count, created_at, updated_at)
                    VALUES
                        (:id, :user_id, :metric_date, :steps, :resting_heart_rate_bpm,
                         :average_heart_rate_bpm, :hrv_ms, :sleep_hours, :sleep_source,
                         :screen_time_minutes, :location_home_ratio, :location_transitions,
                         :noise_level_db_avg, :mood_score, :stress_source,
                         :communication_count, :created_at, :updated_at)
                """),
                row,
            )
        await db.commit()
        print(f"Inserted {len(rows)} daily_metric rows.")

        # ── Compute baselines from first 23 days ─────────────────────────────
        baseline_rows = [r for r in rows if days_ago(30) <= r["metric_date"] <= days_ago(8)]

        def stats(values):
            n = len(values)
            mean = sum(values) / n
            std  = (sum((v - mean) ** 2 for v in values) / n) ** 0.5
            return mean, max(std, 0.01), n

        sleep_vals = [r["sleep_hours"] for r in baseline_rows]
        steps_vals = [r["steps"] for r in baseline_rows]
        hrv_vals   = [r["hrv_ms"] for r in baseline_rows]
        rhr_vals   = [r["resting_heart_rate_bpm"] for r in baseline_rows]
        mood_vals  = [r["mood_score"] for r in baseline_rows]

        baselines_to_insert = [
            ("sleep_hours", *stats(sleep_vals)),
            ("steps",       *stats(steps_vals)),
            ("hrv_ms",      *stats(hrv_vals)),
            ("resting_heart_rate_bpm", *stats(rhr_vals)),
            ("mood_score",  *stats(mood_vals)),
        ]

        start_date = days_ago(30).isoformat()
        end_date   = days_ago(8).isoformat()

        for feature_key, mean_val, std_val, valid_days in baselines_to_insert:
            await db.execute(
                text("""
                    INSERT INTO baselines
                        (id, user_id, feature_key, mean_value, std_value, valid_days,
                         baseline_start_date, baseline_end_date, updated_at)
                    VALUES
                        (:id, :user_id, :feature_key, :mean_value, :std_value, :valid_days,
                         :start_date, :end_date, :updated_at)
                """),
                {
                    "id": uuid.uuid4(),
                    "user_id": USER_ID,
                    "feature_key": feature_key,
                    "mean_value": round(mean_val, 4),
                    "std_value": round(std_val, 4),
                    "valid_days": valid_days,
                    "start_date": days_ago(30),
                    "end_date": days_ago(8),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        await db.commit()
        print(f"Inserted {len(baselines_to_insert)} baselines.")
        for feature_key, mean_val, std_val, valid_days in baselines_to_insert:
            print(f"  {feature_key}: mean={mean_val:.2f}, std={std_val:.2f}, n={valid_days}")

        # ── Risk assessments — one per day, last 14 days ─────────────────────
        sleep_mean, sleep_std, _ = stats(sleep_vals)
        steps_mean, steps_std, _ = stats(steps_vals)

        for i in range(14, -1, -1):
            d = days_ago(i)
            day_row = next((r for r in rows if r["metric_date"] == d), None)
            if not day_row:
                continue

            z_sleep = (day_row["sleep_hours"] - sleep_mean) / sleep_std
            z_steps = (day_row["steps"] - steps_mean) / steps_std
            z_hrv   = (day_row["hrv_ms"] - stats(hrv_vals)[0]) / stats(hrv_vals)[1]

            # Composite score: weighted average of feature z-scores (inverted — positive z = lower risk)
            raw = (-0.4 * z_sleep + -0.35 * z_steps + -0.25 * z_hrv)
            # Normalise to 0–1 with sigmoid-like clamp
            risk_score = max(0.0, min(1.0, 0.5 + raw * 0.18))

            if risk_score < 0.35:
                level = "GREEN"
            elif risk_score < 0.55:
                level = "YELLOW"
            elif risk_score < 0.75:
                level = "ORANGE"
            else:
                level = "RED"

            import json
            await db.execute(
                text("""
                    INSERT INTO risk_assessments
                        (id, user_id, assessment_time, assessment_scope, risk_score,
                         risk_level, feature_sleep_score, feature_activity_score,
                         contributing_features, model_version, baseline_complete, created_at)
                    VALUES
                        (:id, :user_id, :assessment_time, :scope, :risk_score,
                         :risk_level, :f_sleep, :f_activity,
                         cast(:cf as jsonb), :model_version, :baseline_complete, :created_at)
                """),
                {
                    "id": uuid.uuid4(),
                    "user_id": USER_ID,
                    "assessment_time": dt(d, 9),
                    "scope": "daily",
                    "risk_score": round(risk_score, 4),
                    "risk_level": level,
                    "f_sleep": round(max(0, min(1, 0.5 - z_sleep * 0.25)), 4),
                    "f_activity": round(max(0, min(1, 0.5 - z_steps * 0.25)), 4),
                    "cf": json.dumps({"features": []}),
                    "model_version": "v1.0-demo",
                    "baseline_complete": True,
                    "created_at": dt(d, 9),
                },
            )
        await db.commit()
        print("Inserted 14 risk assessments.")

        # ── Drift alerts — seed 2 active alerts to trigger pattern card ──────
        now = datetime.now(timezone.utc)
        rolling_sleep = sum(r["sleep_hours"] for r in rows if days_ago(3) <= r["metric_date"] <= TODAY) / 3
        rolling_steps = sum(r["steps"] for r in rows if days_ago(3) <= r["metric_date"] <= TODAY) / 3

        for metric_key, rolling_avg, baseline_mean, baseline_std in [
            ("sleep_hours", rolling_sleep, sleep_mean, sleep_std),
            ("steps",       rolling_steps, steps_mean, steps_std),
        ]:
            z = (rolling_avg - baseline_mean) / baseline_std
            await db.execute(
                text("""
                    INSERT INTO drift_alerts
                        (id, user_id, metric_key, direction, rolling_avg,
                         baseline_mean, z_score, created_at)
                    VALUES
                        (:id, :user_id, :metric_key, :direction, :rolling_avg,
                         :baseline_mean, :z_score, :created_at)
                """),
                {
                    "id": uuid.uuid4(),
                    "user_id": USER_ID,
                    "metric_key": metric_key,
                    "direction": "decline",
                    "rolling_avg": round(rolling_avg, 4),
                    "baseline_mean": round(baseline_mean, 4),
                    "z_score": round(z, 4),
                    "created_at": now,
                },
            )
        await db.commit()
        print("Inserted 2 drift alerts (sleep↓ + steps↓ — triggers burnout pattern card).")

        # ── Update user first_name so greeting works ─────────────────────────
        await db.execute(
            text("UPDATE users SET first_name = 'Abinash' WHERE id = :uid"),
            {"uid": USER_ID},
        )
        await db.commit()
        print("Set first_name = 'Abinash'.")

        print("\nDone! Summary:")
        print(f"  31 days of metrics (healthy baseline → burnout week)")
        print(f"  5 baselines computed from first 23 days")
        print(f"  15 risk assessments (GREEN→YELLOW→ORANGE trend)")
        print(f"  2 drift alerts active → pattern insight card will show")
        print(f"  First name set to Abinash")


asyncio.run(main())
