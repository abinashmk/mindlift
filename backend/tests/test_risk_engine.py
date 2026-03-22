"""Unit tests for the pure risk engine logic (no DB required)."""
import pytest

from app.services.risk_engine import (
    BaselineEntry,
    RiskLevel,
    _score_high_is_bad,
    _score_low_is_bad,
    compute_activity_score,
    compute_heart_score,
    compute_risk,
    compute_sleep_score,
    compute_social_score,
    score_to_risk_level,
)

# ------------------------------------------------------------------ helpers


def _bl(mean: float, std: float, days: int = 14) -> BaselineEntry:
    return BaselineEntry(mean=mean, std=std, valid_days=days)


# ----------------------------------------------- scoring function tests


class TestScoreLowIsBad:
    def test_z_above_minus1_is_zero(self):
        assert _score_low_is_bad(0.0) == 0.0
        assert _score_low_is_bad(-0.5) == 0.0
        assert _score_low_is_bad(-1.0) == 0.0

    def test_z_between_minus2_and_minus1_is_half(self):
        assert _score_low_is_bad(-1.5) == 0.5

    def test_z_below_minus2_is_one(self):
        assert _score_low_is_bad(-2.0) == 1.0
        assert _score_low_is_bad(-3.0) == 1.0


class TestScoreHighIsBad:
    def test_z_below_1_is_zero(self):
        assert _score_high_is_bad(0.0) == 0.0
        assert _score_high_is_bad(1.0) == 0.0

    def test_z_between_1_and_2_is_half(self):
        assert _score_high_is_bad(1.5) == 0.5

    def test_z_above_2_is_one(self):
        assert _score_high_is_bad(2.0) == 1.0
        assert _score_high_is_bad(3.0) == 1.0


# ------------------------------------------------ group score tests


class TestSleepScore:
    def test_normal_sleep(self):
        baselines = {"sleep_hours": _bl(7.5, 1.0)}
        score = compute_sleep_score(7.5, baselines)
        assert score == 0.0

    def test_mild_sleep_deficit(self):
        # z = (6 - 7.5) / 1 = -1.5 => 0.5
        baselines = {"sleep_hours": _bl(7.5, 1.0)}
        score = compute_sleep_score(6.0, baselines)
        assert score == 0.5

    def test_severe_sleep_deficit(self):
        # z = (5 - 7.5) / 1 = -2.5 => 1.0
        baselines = {"sleep_hours": _bl(7.5, 1.0)}
        score = compute_sleep_score(5.0, baselines)
        assert score == 1.0

    def test_no_data_returns_none(self):
        assert compute_sleep_score(None, {}) is None


class TestActivityScore:
    def test_normal_activity(self):
        baselines = {
            "steps": _bl(8000, 1000),
            "screen_time_minutes": _bl(120, 30),
        }
        score = compute_activity_score(8000, 120, baselines)
        assert score == 0.0

    def test_low_steps_high_screen(self):
        # steps z = (5000 - 8000) / 1000 = -3 => 1.0
        # screen z = (200 - 120) / 30 = 2.67 => 1.0
        baselines = {
            "steps": _bl(8000, 1000),
            "screen_time_minutes": _bl(120, 30),
        }
        score = compute_activity_score(5000, 200, baselines)
        assert score == 1.0


class TestHeartScore:
    def test_normal_hr_and_hrv(self):
        baselines = {
            "resting_heart_rate_bpm": _bl(65, 5),
            "hrv_ms": _bl(45, 10),
        }
        score = compute_heart_score(65, None, 45, baselines)
        assert score == 0.0

    def test_elevated_hr_low_hrv(self):
        # hr z = (80 - 65) / 5 = 3 => 1.0
        # hrv z = (20 - 45) / 10 = -2.5 => 1.0
        baselines = {
            "resting_heart_rate_bpm": _bl(65, 5),
            "hrv_ms": _bl(45, 10),
        }
        score = compute_heart_score(80, None, 20, baselines)
        assert score == 1.0


class TestSocialScore:
    def test_normal_social(self):
        baselines = {
            "location_home_ratio": _bl(0.5, 0.1),
            "mood_score": _bl(3.5, 0.5),
        }
        score = compute_social_score(0.5, None, 3.5, None, baselines)
        assert score == 0.0

    def test_poor_social_indicators(self):
        # home_ratio z = (0.95 - 0.5) / 0.1 = 4.5 => 1.0 (high is bad)
        # mood z = (1 - 3.5) / 0.5 = -5 => 1.0 (low is bad)
        baselines = {
            "location_home_ratio": _bl(0.5, 0.1),
            "mood_score": _bl(3.5, 0.5),
        }
        score = compute_social_score(0.95, None, 1, None, baselines)
        assert score == 1.0


# ---------------------------------------------------- risk level mapping


class TestRiskLevelMapping:
    def test_green(self):
        assert score_to_risk_level(0.0) == RiskLevel.GREEN
        assert score_to_risk_level(0.29) == RiskLevel.GREEN

    def test_yellow(self):
        assert score_to_risk_level(0.30) == RiskLevel.YELLOW
        assert score_to_risk_level(0.59) == RiskLevel.YELLOW

    def test_orange(self):
        assert score_to_risk_level(0.60) == RiskLevel.ORANGE
        assert score_to_risk_level(0.79) == RiskLevel.ORANGE

    def test_red(self):
        assert score_to_risk_level(0.80) == RiskLevel.RED
        assert score_to_risk_level(1.00) == RiskLevel.RED


# ----------------------------------------------- full compute_risk tests


class TestComputeRisk:
    def _healthy_baselines(self) -> dict[str, BaselineEntry]:
        return {
            "sleep_hours": _bl(7.5, 1.0),
            "steps": _bl(8000, 1500),
            "screen_time_minutes": _bl(120, 40),
            "resting_heart_rate_bpm": _bl(65, 5),
            "hrv_ms": _bl(45, 10),
            "location_home_ratio": _bl(0.5, 0.1),
            "mood_score": _bl(3.5, 0.5),
            "communication_count": _bl(15, 5),
        }

    def test_undefined_if_baseline_incomplete(self):
        baselines = {"sleep_hours": _bl(7.5, 1.0, days=3)}
        result = compute_risk(sleep_hours=7.5, baselines=baselines)
        assert result.risk_level == RiskLevel.UNDEFINED
        assert result.baseline_complete is False

    def test_green_for_normal_day(self):
        baselines = self._healthy_baselines()
        result = compute_risk(
            sleep_hours=7.5,
            steps=8000,
            screen_time_minutes=120,
            resting_heart_rate_bpm=65,
            hrv_ms=45,
            location_home_ratio=0.5,
            mood_score=3,
            communication_count=15,
            baselines=baselines,
        )
        assert result.risk_level == RiskLevel.GREEN
        assert result.baseline_complete is True

    def test_red_for_severely_degraded_day(self):
        baselines = self._healthy_baselines()
        result = compute_risk(
            sleep_hours=3.0,      # z = -4.5 => 1.0
            steps=500,            # z = -5 => 1.0
            screen_time_minutes=400,  # z = 7 => 1.0
            resting_heart_rate_bpm=90,  # z = 5 => 1.0
            hrv_ms=10,            # z = -3.5 => 1.0
            location_home_ratio=0.98,   # z = 4.8 => 1.0
            mood_score=1,         # z = -5 => 1.0
            communication_count=0,  # z = -3 => 1.0
            baselines=baselines,
        )
        assert result.risk_level == RiskLevel.RED
        assert result.risk_score == 1.0

    def test_weight_redistribution_when_groups_missing(self):
        # Only sleep and heart baselines provided
        baselines = {
            "sleep_hours": _bl(7.5, 1.0),
            "resting_heart_rate_bpm": _bl(65, 5),
        }
        result = compute_risk(
            sleep_hours=3.0,
            resting_heart_rate_bpm=90,
            baselines=baselines,
        )
        # Both present scores are 1.0; redistributed weights still produce a non-zero result
        assert result.risk_score > 0.0
        assert result.risk_level != RiskLevel.UNDEFINED

    def test_no_baselines_returns_undefined(self):
        result = compute_risk(sleep_hours=7.5, baselines={})
        assert result.risk_level == RiskLevel.UNDEFINED

    def test_score_clamped_to_1(self):
        baselines = self._healthy_baselines()
        result = compute_risk(
            sleep_hours=0.0,
            steps=0,
            screen_time_minutes=1440,
            resting_heart_rate_bpm=220,
            hrv_ms=0.0,
            mood_score=1,
            location_home_ratio=1.0,
            communication_count=0,
            baselines=baselines,
        )
        assert result.risk_score <= 1.0

    def test_score_clamped_to_0(self):
        baselines = self._healthy_baselines()
        result = compute_risk(
            sleep_hours=10.0,
            steps=20000,
            baselines=baselines,
        )
        assert result.risk_score >= 0.0

    def test_contributing_features_populated(self):
        baselines = self._healthy_baselines()
        result = compute_risk(
            sleep_hours=7.5,
            steps=8000,
            baselines=baselines,
        )
        assert isinstance(result.contributing_features, dict)
        assert len(result.contributing_features) >= 1
