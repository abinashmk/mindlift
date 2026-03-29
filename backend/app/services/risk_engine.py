"""
Risk scoring engine for MindLift.

Computes a [0, 1] risk score from daily metrics and user baselines,
then maps the score to a RiskLevel enum.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class RiskLevel(str, Enum):
    UNDEFINED = "UNDEFINED"
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    ORANGE = "ORANGE"
    RED = "RED"


MODEL_VERSION = "1.0.0"

# Default group weights — must sum to 1.0
_DEFAULT_WEIGHTS = {
    "sleep": 0.30,
    "activity": 0.20,
    "heart": 0.30,
    "social": 0.20,
}

# Minimum valid baseline days required to produce a non-UNDEFINED result
_MIN_BASELINE_DAYS = 7


@dataclass
class BaselineEntry:
    mean: float
    std: float
    valid_days: int


@dataclass
class RiskResult:
    risk_score: float
    risk_level: RiskLevel
    feature_sleep_score: float | None
    feature_activity_score: float | None
    feature_heart_score: float | None
    feature_social_score: float | None
    contributing_features: dict = field(default_factory=dict)
    baseline_complete: bool = False
    model_version: str = MODEL_VERSION


def _zscore(value: float, entry: BaselineEntry) -> float:
    std = entry.std if entry.std > 0 else 0.01
    return (value - entry.mean) / std


def _score_low_is_bad(z: float) -> float:
    """
    Features where *lower* than baseline is worse (sleep, HRV, mood, etc.).
    z >= -1  => 0
    -2 < z < -1 => 0.5
    z <= -2  => 1
    """
    if z >= -1:
        return 0.0
    if z <= -2:
        return 1.0
    return 0.5


def _score_high_is_bad(z: float) -> float:
    """
    Features where *higher* than baseline is worse (screen_time, HR, home_ratio).
    z <= 1  => 0
    1 < z < 2 => 0.5
    z >= 2  => 1
    """
    if z <= 1:
        return 0.0
    if z >= 2:
        return 1.0
    return 0.5


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def compute_sleep_score(
    sleep_hours: float | None,
    baselines: dict[str, BaselineEntry],
) -> float | None:
    scores: list[float] = []
    if sleep_hours is not None and "sleep_hours" in baselines:
        z = _zscore(sleep_hours, baselines["sleep_hours"])
        scores.append(_score_low_is_bad(z))
    return _average(scores)


def compute_activity_score(
    steps: float | None,
    screen_time_minutes: float | None,
    baselines: dict[str, BaselineEntry],
) -> float | None:
    scores: list[float] = []
    if steps is not None and "steps" in baselines:
        z = _zscore(steps, baselines["steps"])
        scores.append(_score_low_is_bad(z))
    if screen_time_minutes is not None and "screen_time_minutes" in baselines:
        z = _zscore(screen_time_minutes, baselines["screen_time_minutes"])
        scores.append(_score_high_is_bad(z))
    return _average(scores)


def compute_heart_score(
    resting_hr: float | None,
    average_hr: float | None,
    hrv_ms: float | None,
    baselines: dict[str, BaselineEntry],
) -> float | None:
    scores: list[float] = []
    # Use resting_hr if available, else average_hr — only one HR feature contributed
    hr_value = resting_hr if resting_hr is not None else average_hr
    hr_key = (
        "resting_heart_rate_bpm" if resting_hr is not None else "average_heart_rate_bpm"
    )
    if hr_value is not None and hr_key in baselines:
        z = _zscore(hr_value, baselines[hr_key])
        scores.append(_score_high_is_bad(z))
    if hrv_ms is not None and "hrv_ms" in baselines:
        z = _zscore(hrv_ms, baselines["hrv_ms"])
        scores.append(_score_low_is_bad(z))
    return _average(scores)


def compute_social_score(
    location_home_ratio: float | None,
    location_transitions: float | None,
    mood_score: float | None,
    communication_count: float | None,
    baselines: dict[str, BaselineEntry],
) -> float | None:
    scores: list[float] = []
    if location_home_ratio is not None and "location_home_ratio" in baselines:
        z = _zscore(location_home_ratio, baselines["location_home_ratio"])
        scores.append(_score_high_is_bad(z))
    if location_transitions is not None and "location_transitions" in baselines:
        z = _zscore(location_transitions, baselines["location_transitions"])
        scores.append(_score_low_is_bad(z))
    if mood_score is not None and "mood_score" in baselines:
        z = _zscore(mood_score, baselines["mood_score"])
        scores.append(_score_low_is_bad(z))
    if communication_count is not None and "communication_count" in baselines:
        z = _zscore(communication_count, baselines["communication_count"])
        scores.append(_score_low_is_bad(z))
    return _average(scores)


def _redistribute_weights(group_scores: dict[str, float | None]) -> dict[str, float]:
    """
    Redistribute weights proportionally among available groups.
    Groups with None score are excluded.
    """
    available = {k: v for k, v in group_scores.items() if v is not None}
    if not available:
        return {}
    total_weight = sum(_DEFAULT_WEIGHTS[k] for k in available)
    return {k: _DEFAULT_WEIGHTS[k] / total_weight for k in available}


def score_to_risk_level(score: float) -> RiskLevel:
    if score <= 0.29:
        return RiskLevel.GREEN
    if score <= 0.59:
        return RiskLevel.YELLOW
    if score <= 0.79:
        return RiskLevel.ORANGE
    return RiskLevel.RED


def compute_risk(
    *,
    sleep_hours: float | None = None,
    steps: float | None = None,
    screen_time_minutes: float | None = None,
    resting_heart_rate_bpm: float | None = None,
    average_heart_rate_bpm: float | None = None,
    hrv_ms: float | None = None,
    location_home_ratio: float | None = None,
    location_transitions: float | None = None,
    mood_score: float | None = None,
    communication_count: float | None = None,
    baselines: dict[str, BaselineEntry] | None = None,
) -> RiskResult:
    """
    Main entry point. Pass the day's metrics and a dict of BaselineEntry keyed
    by feature name. Returns a fully populated RiskResult.
    """
    baselines = baselines or {}

    # Check baseline completeness: need >= 7 valid days across any feature
    max_valid_days = max((b.valid_days for b in baselines.values()), default=0)
    baseline_complete = max_valid_days >= _MIN_BASELINE_DAYS

    if not baseline_complete:
        return RiskResult(
            risk_score=0.0,
            risk_level=RiskLevel.UNDEFINED,
            feature_sleep_score=None,
            feature_activity_score=None,
            feature_heart_score=None,
            feature_social_score=None,
            contributing_features={},
            baseline_complete=False,
        )

    sleep_s = compute_sleep_score(sleep_hours, baselines)
    activity_s = compute_activity_score(steps, screen_time_minutes, baselines)
    heart_s = compute_heart_score(
        resting_heart_rate_bpm, average_heart_rate_bpm, hrv_ms, baselines
    )
    social_s = compute_social_score(
        location_home_ratio,
        location_transitions,
        mood_score,
        communication_count,
        baselines,
    )

    group_scores: dict[str, float | None] = {
        "sleep": sleep_s,
        "activity": activity_s,
        "heart": heart_s,
        "social": social_s,
    }

    weights = _redistribute_weights(group_scores)

    if not weights:
        return RiskResult(
            risk_score=0.0,
            risk_level=RiskLevel.UNDEFINED,
            feature_sleep_score=None,
            feature_activity_score=None,
            feature_heart_score=None,
            feature_social_score=None,
            contributing_features={},
            baseline_complete=True,
        )

    raw_score = sum(group_scores[k] * weights[k] for k in weights)  # type: ignore[operator]
    clamped = max(0.0, min(1.0, raw_score))
    final_score = round(clamped, 2)

    contributing: dict[str, float] = {k: round(group_scores[k], 3) for k in weights}  # type: ignore[arg-type]

    return RiskResult(
        risk_score=final_score,
        risk_level=score_to_risk_level(final_score),
        feature_sleep_score=sleep_s,
        feature_activity_score=activity_s,
        feature_heart_score=heart_s,
        feature_social_score=social_s,
        contributing_features=contributing,
        baseline_complete=True,
    )
