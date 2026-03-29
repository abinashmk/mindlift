"""
Supplementary unit tests for risk_engine.py — spec §37.4 (≥90% coverage).

Covers paths not reached by test_risk_engine.py:
  - _average() with empty list and single value
  - _redistribute_weights() when all groups are None
  - compute_heart_score() using average_hr fallback (no resting_hr)
  - compute_social_score() with only location_transitions
  - compute_risk() when all groups resolve to None (empty weights branch)
  - score boundary precision (exactly 0.30, 0.60, 0.80)
  - _zscore with zero std (uses 0.01 minimum)
"""

import pytest

from app.services.risk_engine import (
    BaselineEntry,
    RiskLevel,
    _average,
    _redistribute_weights,
    _zscore,
    compute_activity_score,
    compute_heart_score,
    compute_risk,
    compute_social_score,
    score_to_risk_level,
)


def _bl(mean: float, std: float, days: int = 14) -> BaselineEntry:
    return BaselineEntry(mean=mean, std=std, valid_days=days)


# ─── _average ─────────────────────────────────────────────────────────────────


class TestAverage:
    def test_empty_list_returns_none(self):
        assert _average([]) is None

    def test_single_value_returns_value(self):
        assert _average([0.5]) == 0.5

    def test_multiple_values(self):
        assert _average([0.0, 1.0]) == 0.5


# ─── _zscore with zero std ────────────────────────────────────────────────────


class TestZScore:
    def test_std_zero_uses_min_std(self):
        bl = BaselineEntry(mean=5.0, std=0.0, valid_days=14)
        # std should be replaced with 0.01
        z = _zscore(4.0, bl)
        assert z == pytest.approx((4.0 - 5.0) / 0.01)

    def test_positive_std(self):
        bl = BaselineEntry(mean=0.0, std=2.0, valid_days=14)
        assert _zscore(4.0, bl) == pytest.approx(2.0)


# ─── _redistribute_weights ────────────────────────────────────────────────────


class TestRedistributeWeights:
    def test_all_none_returns_empty(self):
        result = _redistribute_weights(
            {"sleep": None, "activity": None, "heart": None, "social": None}
        )
        assert result == {}

    def test_single_group_gets_full_weight(self):
        result = _redistribute_weights(
            {"sleep": 0.5, "activity": None, "heart": None, "social": None}
        )
        assert "sleep" in result
        assert result["sleep"] == pytest.approx(1.0)

    def test_two_groups_weights_sum_to_one(self):
        result = _redistribute_weights(
            {"sleep": 0.5, "activity": 0.5, "heart": None, "social": None}
        )
        assert sum(result.values()) == pytest.approx(1.0)


# ─── compute_heart_score with average_hr fallback ────────────────────────────


class TestHeartScoreAverageHrFallback:
    def test_uses_average_hr_when_no_resting(self):
        baselines = {"average_heart_rate_bpm": _bl(70, 5)}
        # average_hr = 85 → z = (85-70)/5 = 3 → _score_high_is_bad = 1.0
        score = compute_heart_score(None, 85.0, None, baselines)
        assert score == 1.0

    def test_no_hr_no_hrv_returns_none(self):
        score = compute_heart_score(None, None, None, {})
        assert score is None

    def test_only_hrv_contributes(self):
        baselines = {"hrv_ms": _bl(50, 10)}
        # hrv_ms = 20 → z = (20-50)/10 = -3 → _score_low_is_bad = 1.0
        score = compute_heart_score(None, None, 20.0, baselines)
        assert score == 1.0


# ─── compute_social_score edge cases ─────────────────────────────────────────


class TestSocialScoreEdgeCases:
    def test_only_location_transitions(self):
        baselines = {"location_transitions": _bl(5, 1)}
        # transitions = 2 → z = -3 → low_is_bad → 1.0
        score = compute_social_score(None, 2.0, None, None, baselines)
        assert score == 1.0

    def test_only_communication_count(self):
        baselines = {"communication_count": _bl(10, 2)}
        # comm = 5 → z = -2.5 → low_is_bad → 1.0
        score = compute_social_score(None, None, None, 5.0, baselines)
        assert score == 1.0

    def test_no_data_returns_none(self):
        score = compute_social_score(None, None, None, None, {})
        assert score is None


# ─── compute_activity_score edge cases ───────────────────────────────────────


class TestActivityScoreEdgeCases:
    def test_only_screen_time(self):
        baselines = {"screen_time_minutes": _bl(120, 30)}
        # screen_time = 240 → z = (240-120)/30 = 4 → high_is_bad = 1.0
        score = compute_activity_score(None, 240.0, baselines)
        assert score == 1.0

    def test_no_data_returns_none(self):
        assert compute_activity_score(None, None, {}) is None


# ─── compute_risk: all groups None → empty weights branch ────────────────────


class TestComputeRiskAllGroupsNone:
    def test_all_groups_none_returns_undefined(self):
        """When baselines exist but none match any metric field, weights is empty."""
        # Provide a baseline with valid_days >= 7, but pass no matching metrics
        baselines = {"sleep_hours": _bl(7.5, 1.0, days=14)}
        # Pass no metric values at all — sleep_score will be None (no sleep_hours arg)
        # activity, heart, social also None
        # But wait: if we pass sleep_hours=None, sleep_s=None.
        # The code enters compute_risk with sleep_hours=None → sleep_s=None.
        # Same for activity, heart, social → all None → weights = {} → UNDEFINED
        result = compute_risk(baselines=baselines)
        assert result.risk_level == RiskLevel.UNDEFINED
        # baseline_complete should be True (baseline has valid data)
        assert result.baseline_complete is True


# ─── score_to_risk_level boundary precision ──────────────────────────────────


class TestScoreBoundaryPrecision:
    def test_exactly_0_30_is_yellow(self):
        assert score_to_risk_level(0.30) == RiskLevel.YELLOW

    def test_exactly_0_60_is_orange(self):
        assert score_to_risk_level(0.60) == RiskLevel.ORANGE

    def test_exactly_0_80_is_red(self):
        assert score_to_risk_level(0.80) == RiskLevel.RED

    def test_exactly_0_00_is_green(self):
        assert score_to_risk_level(0.00) == RiskLevel.GREEN
