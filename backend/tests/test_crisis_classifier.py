"""
Unit tests for crisis_classifier.py — ≥90% coverage required (spec §37.4).

Covers:
  - classify() matches known patterns
  - classify() returns empty when no match
  - classify() is case-insensitive
  - classify() matches mid-sentence substrings
  - in-process cache is reused within TTL
  - cache expires after TTL and reloads
  - Redis unavailable → falls back to defaults
  - Redis missing key → seeds defaults
  - set_crisis_keywords() overwrites and invalidates cache
  - get_crisis_keywords() returns current list
"""

import json
import time
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clear_module_cache():
    """Reset the module-level _cache variable to None between tests."""
    import app.services.crisis_classifier as cc

    cc._cache = None


# ---------------------------------------------------------------------------
# classify() — basic matching
# ---------------------------------------------------------------------------


class TestClassify:
    def setup_method(self):
        _clear_module_cache()

    def test_matches_known_pattern(self):
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["kill myself", "want to die"])
            mock_redis_factory.return_value = mock_redis

            result = classify("I want to kill myself right now.")
            assert result["crisis"] is True
            assert "kill myself" in result["matched_patterns"]

    def test_no_match_returns_false(self):
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["kill myself", "want to die"])
            mock_redis_factory.return_value = mock_redis

            result = classify("I had a great day today!")
            assert result["crisis"] is False
            assert result["matched_patterns"] == []

    def test_case_insensitive_match(self):
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["suicide"])
            mock_redis_factory.return_value = mock_redis

            result = classify("I've been thinking about SUICIDE.")
            assert result["crisis"] is True

    def test_matches_substring_in_sentence(self):
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["hurt myself"])
            mock_redis_factory.return_value = mock_redis

            result = classify(
                "Sometimes I feel like I want to hurt myself and nobody cares."
            )
            assert result["crisis"] is True

    def test_multiple_patterns_can_match(self):
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["suicide", "end my life"])
            mock_redis_factory.return_value = mock_redis

            result = classify("I am thinking about suicide — I want to end my life.")
            assert result["crisis"] is True
            assert len(result["matched_patterns"]) == 2


# ---------------------------------------------------------------------------
# Cache behavior
# ---------------------------------------------------------------------------


class TestCache:
    def setup_method(self):
        _clear_module_cache()

    def test_cache_is_reused_within_ttl(self):
        """Redis should only be called once if classify is called twice within TTL."""
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["suicide"])
            mock_redis_factory.return_value = mock_redis

            classify("test one")
            classify("test two")

            # _get_redis_sync should be called only once (first load)
            assert mock_redis_factory.call_count == 1

    def test_cache_expires_after_ttl(self):
        """After the TTL has elapsed, patterns should be reloaded from Redis."""
        import app.services.crisis_classifier as cc

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["suicide"])
            mock_redis_factory.return_value = mock_redis

            # Load patterns (first call)
            cc._load_patterns()
            assert mock_redis_factory.call_count == 1

            # Expire the cache by backdating it
            patterns, compiled, loaded_at = cc._cache
            cc._cache = (patterns, compiled, loaded_at - cc._CACHE_TTL_SECONDS - 1)

            # Should re-call Redis
            cc._load_patterns()
            assert mock_redis_factory.call_count == 2


# ---------------------------------------------------------------------------
# Redis unavailable
# ---------------------------------------------------------------------------


class TestRedisUnavailable:
    def setup_method(self):
        _clear_module_cache()

    def test_falls_back_to_defaults_when_redis_unavailable(self):
        """If Redis throws, defaults are used and classify still works."""
        from app.services.crisis_classifier import classify

        with patch(
            "app.services.crisis_classifier._get_redis_sync",
            side_effect=Exception("redis is down"),
        ):
            result = classify("I want to kill myself.")
            # Should still match using defaults
            assert result["crisis"] is True


# ---------------------------------------------------------------------------
# Redis empty key (seed behavior)
# ---------------------------------------------------------------------------


class TestRedisSeed:
    def setup_method(self):
        _clear_module_cache()

    def test_seeds_redis_on_first_load(self):
        """When Redis returns None, defaults should be written back to Redis."""
        import app.services.crisis_classifier as cc

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = None  # Key absent
            mock_redis_factory.return_value = mock_redis

            cc._load_patterns()

            # Defaults should have been written to Redis
            mock_redis.set.assert_called_once_with(
                cc._REDIS_KEY, json.dumps(cc._DEFAULT_PATTERNS)
            )

    def test_uses_defaults_when_redis_key_absent(self):
        """When Redis key is absent, the default pattern list is active."""
        import app.services.crisis_classifier as cc

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = None
            mock_redis_factory.return_value = mock_redis

            patterns, _ = cc._load_patterns()
            assert patterns == cc._DEFAULT_PATTERNS


# ---------------------------------------------------------------------------
# set_crisis_keywords / get_crisis_keywords
# ---------------------------------------------------------------------------


class TestSetAndGetKeywords:
    def setup_method(self):
        _clear_module_cache()

    def test_set_crisis_keywords_overwrites_and_clears_cache(self):
        """set_crisis_keywords should update Redis and set _cache to None."""
        import app.services.crisis_classifier as cc

        # Prime the cache
        cc._cache = (["old"], [], time.monotonic())

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis_factory.return_value = mock_redis

            cc.set_crisis_keywords(["new phrase"])

            mock_redis.set.assert_called_once_with(
                cc._REDIS_KEY, json.dumps(["new phrase"])
            )
            assert cc._cache is None

    def test_get_crisis_keywords_returns_current_list(self):
        """get_crisis_keywords should return the loaded patterns."""
        from app.services.crisis_classifier import get_crisis_keywords

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            mock_redis.get.return_value = json.dumps(["phrase one", "phrase two"])
            mock_redis_factory.return_value = mock_redis

            keywords = get_crisis_keywords()
            assert "phrase one" in keywords
            assert "phrase two" in keywords

    def test_classify_uses_new_keywords_after_set(self):
        """After set_crisis_keywords, classify should use the new list."""
        from app.services.crisis_classifier import classify, set_crisis_keywords

        with patch(
            "app.services.crisis_classifier._get_redis_sync"
        ) as mock_redis_factory:
            mock_redis = MagicMock()
            # After set_crisis_keywords, Redis returns new list
            mock_redis.get.return_value = json.dumps(["unique custom phrase"])
            mock_redis_factory.return_value = mock_redis

            set_crisis_keywords(["unique custom phrase"])

            result = classify("I have a unique custom phrase in my message.")
            assert result["crisis"] is True
