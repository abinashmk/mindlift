"""
Seed demo data for abinashdown3@gmail.com.

Story: 30 days of realistic burnout progression for a professional.
Weeks 1-2: healthy baseline — good sleep, active days, light meetings.
Week 3: a project crunch begins — calendar fills up, sleep starts slipping.
Week 4: clear burnout pattern — poor sleep, minimal movement, low mood.

Realism features:
- Sigmoid burnout curve (gradual onset, accelerates ~day 12)
- Weekday vs weekend patterns for sleep, steps, meetings
- Previous night's sleep correlates with next-day HRV and RHR
- Gaussian noise on all metrics (realistic day-to-day variation)
- Risk scores computed from actual metric z-scores (natural GREEN→YELLOW→RED arc)
- meeting_hours only on weekdays, increases as burnout accelerates
"""

import asyncio
import json
import math
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import os
import sys

sys.path.insert(0, "/app")

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL)
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

USER_ID = uuid.UUID("69406364-6247-4c88-a350-b1f2e2795187")
TODAY = date.today()

random.seed(77)


def days_ago(n: int) -> date:
    return TODAY - timedelta(days=n)


def dt(d: date, hour: int = 8) -> datetime:
    return datetime(d.year, d.month, d.day, hour, 0, 0, tzinfo=timezone.utc)


def burnout_factor(i: int) -> float:
    """
    Smooth sigmoid 0.0→1.0.  i = days_ago (30 = oldest/healthiest, 0 = today/burnout).
    Stays near 0 until around day 12, then rises steeply through day 5.

      day-14: ~0.05   (GREEN)
      day-10: ~0.22   (GREEN/YELLOW border)
      day-7:  ~0.52   (YELLOW)
      day-4:  ~0.81   (ORANGE/RED)
      day-0:  ~0.96   (RED)
    """
    progress = (30 - i) / 30          # 0.0 at oldest, 1.0 at today
    x = (progress - 0.76) * 14        # centre at ~day 7, steeper slope
    return max(0.0, min(1.0, 1 / (1 + math.exp(-x))))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


STRESS_HEALTHY = [None, None, "workload", "relationships", "other", None, "workload"]
STRESS_BURNOUT = ["deadlines", "deadlines", "workload", "career", "deadlines", "workload", "deadlines"]


async def main():
    async with Session() as db:

        # ── Clear existing data ───────────────────────────────────────────────
        await db.execute(text("DELETE FROM drift_alerts    WHERE user_id = :uid"), {"uid": USER_ID})
        await db.execute(text("DELETE FROM risk_assessments WHERE user_id = :uid"), {"uid": USER_ID})
        await db.execute(text("DELETE FROM baselines        WHERE user_id = :uid"), {"uid": USER_ID})
        await db.execute(text("DELETE FROM daily_metrics    WHERE user_id = :uid"), {"uid": USER_ID})
        await db.commit()
        print("Cleared existing data.")

        # ── Generate daily_metrics ───────────────────────────────────────────
        rows = []
        prev_sleep = 7.6   # seed value for day-to-day carry-forward

        for i in range(30, -1, -1):
            d = days_ago(i)
            b = burnout_factor(i)
            is_weekday = d.weekday() < 5   # Mon=0 … Fri=4
            is_monday  = d.weekday() == 0  # Mondays are rough even when healthy

            # ── Sleep ─────────────────────────────────────────────────────────
            # Healthy: ~7.4h weekday, ~8.0h weekend (lie-in)
            # Burnout: ~5.4h weekday, ~6.3h weekend (sleep debt, can't switch off)
            sleep_healthy = 7.4 if is_weekday else 8.0
            sleep_burnout = 5.4 if is_weekday else 6.3
            sleep = lerp(sleep_healthy, sleep_burnout, b)
            sleep += random.gauss(0, 0.32)          # night-to-night variance
            if is_monday:
                sleep -= random.uniform(0, 0.25)    # Monday effect — slept less well
            # Occasional crash night during high burnout (1 in 7 chance)
            if b > 0.55 and random.random() < 0.14:
                sleep -= random.uniform(0.6, 1.3)
            sleep = round(clamp(sleep, 3.5, 9.5), 1)

            # ── HRV — correlated with previous night's sleep ───────────────
            hrv_base = lerp(62.0, 30.0, b)
            sleep_deficit = max(0.0, 6.8 - prev_sleep)   # hours below threshold
            hrv = hrv_base - sleep_deficit * 3.8 + random.gauss(0, 4.5)
            hrv = round(clamp(hrv, 15.0, 85.0), 1)

            # ── Resting Heart Rate — also affected by prior sleep ──────────
            rhr_base = lerp(60.5, 75.0, b)
            rhr = rhr_base + sleep_deficit * 2.0 + random.gauss(0, 2.2)
            rhr = round(clamp(rhr, 46.0, 92.0), 1)

            # ── Steps ─────────────────────────────────────────────────────────
            # Weekends have higher steps when healthy (errands, walks)
            # Burnout weekends: stuck indoors, low motivation
            if is_weekday:
                steps_healthy, steps_burnout = 8500, 2900
            else:
                steps_healthy, steps_burnout = 11500, 4000
            steps = lerp(steps_healthy, steps_burnout, b)
            steps = int(steps * random.uniform(0.76, 1.24))
            steps = int(clamp(steps, 400, 20000))

            # ── Meeting hours (weekdays only) ──────────────────────────────
            if is_weekday:
                # Healthy: ~1.5h, burnout crunch: ~5.5h
                mtg = lerp(1.5, 5.5, b) + random.gauss(0, 0.55)
                # Mondays and Thursdays tend to be heavier
                if d.weekday() in (0, 3):
                    mtg += random.uniform(0.3, 0.8)
                meeting_hours = round(clamp(mtg, 0.0, 8.0), 1)
            else:
                meeting_hours = 0.0

            # ── Mood ──────────────────────────────────────────────────────────
            mood_mean = lerp(4.2, 1.6, b) + random.gauss(0, 0.6)
            # Weekend mood boost (even during burnout, slight lift)
            if not is_weekday:
                mood_mean += lerp(0.4, 0.15, b)
            mood = int(round(clamp(mood_mean, 1, 5)))

            # ── Stress source ─────────────────────────────────────────────────
            if b < 0.25:
                stress = STRESS_HEALTHY[i % len(STRESS_HEALTHY)]
            elif b < 0.60:
                stress = random.choice(["workload", "relationships", "deadlines", None, "workload"])
            else:
                stress = STRESS_BURNOUT[i % len(STRESS_BURNOUT)]

            # ── Screen time — rises with burnout (doom-scrolling as coping) ──
            screen = int(clamp(lerp(155, 330, b) + random.gauss(0, 28), 60, 480))

            # ── Location — more home-bound as burnout increases ────────────
            loc_home = round(clamp(lerp(0.52, 0.85, b) + random.gauss(0, 0.06), 0.0, 1.0), 2)
            loc_trans = int(clamp(lerp(7.5, 2.5, b) + random.gauss(0, 1.1), 0, 20))

            rows.append({
                "id": uuid.uuid4(),
                "user_id": USER_ID,
                "metric_date": d,
                "steps": steps,
                "resting_heart_rate_bpm": rhr,
                "average_heart_rate_bpm": round(rhr + random.uniform(8, 20), 1),
                "hrv_ms": hrv,
                "sleep_hours": sleep,
                "sleep_source": "wearable" if b < 0.45 else random.choice(["wearable", "inferred"]),
                "screen_time_minutes": screen,
                "location_home_ratio": loc_home,
                "location_transitions": loc_trans,
                "noise_level_db_avg": round(clamp(lerp(50, 39, b) + random.gauss(0, 3), 25, 70), 1),
                "mood_score": mood,
                "stress_source": stress,
                "meeting_hours": meeting_hours,
                "communication_count": int(clamp(lerp(24, 8, b) + random.gauss(0, 4), 0, 60)),
                "created_at": dt(d),
                "updated_at": dt(d),
            })

            prev_sleep = sleep   # carry forward for next-day HRV/RHR correlation

        for row in rows:
            await db.execute(
                text("""
                    INSERT INTO daily_metrics
                        (id, user_id, metric_date, steps, resting_heart_rate_bpm,
                         average_heart_rate_bpm, hrv_ms, sleep_hours, sleep_source,
                         screen_time_minutes, location_home_ratio, location_transitions,
                         noise_level_db_avg, mood_score, stress_source, meeting_hours,
                         communication_count, created_at, updated_at)
                    VALUES
                        (:id, :user_id, :metric_date, :steps, :resting_heart_rate_bpm,
                         :average_heart_rate_bpm, :hrv_ms, :sleep_hours, :sleep_source,
                         :screen_time_minutes, :location_home_ratio, :location_transitions,
                         :noise_level_db_avg, :mood_score, :stress_source, :meeting_hours,
                         :communication_count, :created_at, :updated_at)
                """),
                row,
            )
        await db.commit()
        print(f"Inserted {len(rows)} daily_metric rows.")

        # ── Baselines from healthy period (days 30–16) ────────────────────────
        baseline_rows = [r for r in rows if r["metric_date"] <= days_ago(16)]

        def stats(values: list[float]) -> tuple[float, float, int]:
            n = len(values)
            mean = sum(values) / n
            std = (sum((v - mean) ** 2 for v in values) / n) ** 0.5
            return mean, max(std, 0.01), n

        sleep_vals = [r["sleep_hours"] for r in baseline_rows]
        steps_vals = [float(r["steps"]) for r in baseline_rows]
        hrv_vals   = [r["hrv_ms"] for r in baseline_rows]
        rhr_vals   = [r["resting_heart_rate_bpm"] for r in baseline_rows]
        mood_vals  = [float(r["mood_score"]) for r in baseline_rows]

        sleep_mean, sleep_std, _ = stats(sleep_vals)
        steps_mean, steps_std, _ = stats(steps_vals)
        hrv_mean,   hrv_std,   _ = stats(hrv_vals)

        baselines_to_insert = [
            ("sleep_hours",            *stats(sleep_vals)),
            ("steps",                  *stats(steps_vals)),
            ("hrv_ms",                 *stats(hrv_vals)),
            ("resting_heart_rate_bpm", *stats(rhr_vals)),
            ("mood_score",             *stats(mood_vals)),
        ]

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
                    "end_date": days_ago(16),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        await db.commit()
        print(f"Inserted {len(baselines_to_insert)} baselines.")
        for fk, mv, sv, vd in baselines_to_insert:
            print(f"  {fk}: mean={mv:.2f}, std={sv:.2f}, n={vd}")

        # ── Risk assessments — burnout-factor driven with realistic noise ────
        # Using burnout_factor() directly keeps levels consistent with the metrics.
        # Day ranges: GREEN days14-11, YELLOW days10-8, ORANGE days7-5, RED days4-0
        print("\nInserted risk assessments:")
        for i in range(14, -1, -1):
            d = days_ago(i)
            row = next((r for r in rows if r["metric_date"] == d), None)
            if not row:
                continue

            b = burnout_factor(i)
            # Scale to [0.10, 0.96] with small Gaussian jitter
            risk_score = round(clamp(0.10 + b * 0.86 + random.gauss(0, 0.025), 0.04, 0.97), 4)

            if risk_score < 0.30:
                level = "GREEN"
            elif risk_score < 0.52:
                level = "YELLOW"
            elif risk_score < 0.72:
                level = "ORANGE"
            else:
                level = "RED"

            f_sleep    = round(clamp(0.10 + b * 0.82 + random.gauss(0, 0.03), 0.04, 0.96), 4)
            f_activity = round(clamp(0.10 + b * 0.78 + random.gauss(0, 0.03), 0.04, 0.96), 4)

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
                    "risk_score": risk_score,
                    "risk_level": level,
                    "f_sleep": f_sleep,
                    "f_activity": f_activity,
                    "cf": json.dumps({"features": []}),
                    "model_version": "v1.0-demo",
                    "baseline_complete": True,
                    "created_at": dt(d, 9),
                },
            )
            print(f"  day -{i:02d} ({d.strftime('%a')}): {level:6s}  score={risk_score:.2f}  "
                  f"sleep={row['sleep_hours']:.1f}h  steps={row['steps']:,}")

        await db.commit()

        # ── Drift alerts — computed from actual recent rolling averages ───────
        now = datetime.now(timezone.utc)
        recent = [r for r in rows if days_ago(3) <= r["metric_date"] <= TODAY]
        if recent:
            rolling_sleep = sum(r["sleep_hours"] for r in recent) / len(recent)
            rolling_steps = sum(float(r["steps"]) for r in recent) / len(recent)

            for metric_key, rolling_avg, base_mean, base_std in [
                ("sleep_hours", rolling_sleep, sleep_mean, sleep_std),
                ("steps",       rolling_steps, steps_mean, steps_std),
            ]:
                z = (rolling_avg - base_mean) / base_std
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
                        "baseline_mean": round(base_mean, 4),
                        "z_score": round(z, 4),
                        "created_at": now,
                    },
                )
            await db.commit()
            print(f"\nInserted 2 drift alerts  "
                  f"(sleep 3-day avg={rolling_sleep:.1f}h vs baseline={sleep_mean:.1f}h, "
                  f"steps 3-day avg={rolling_steps:.0f} vs baseline={steps_mean:.0f})")

        # ── Seed a suggested intervention event ───────────────────────────────
        # Pick the intervention most appropriate for high burnout: BREATHE_3
        await db.execute(text("DELETE FROM intervention_events WHERE user_id = :uid"), {"uid": USER_ID})
        intervention_result = await db.execute(
            text("SELECT id, code FROM interventions WHERE code = 'BREATHE_3' LIMIT 1")
        )
        intervention_row = intervention_result.first()
        if intervention_row:
            await db.execute(
                text("""
                    INSERT INTO intervention_events
                        (id, user_id, intervention_id, status, risk_level,
                         triggered_at, created_at, updated_at)
                    VALUES
                        (:id, :user_id, :intervention_id, 'TRIGGERED', 'RED',
                         :triggered_at, :created_at, :updated_at)
                """),
                {
                    "id": uuid.uuid4(),
                    "user_id": USER_ID,
                    "intervention_id": intervention_row.id,
                    "triggered_at": datetime.now(timezone.utc),
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                },
            )
            await db.commit()
            print(f"Seeded intervention event: {intervention_row.code}")
        else:
            print("No BREATHE_3 intervention found — skipping.")

        # ── Set first name ─────────────────────────────────────────────────────
        await db.execute(
            text("UPDATE users SET first_name = 'Abinash' WHERE id = :uid"),
            {"uid": USER_ID},
        )
        await db.commit()
        print("Set first_name = 'Abinash'.")
        print("\nDone.")


asyncio.run(main())
