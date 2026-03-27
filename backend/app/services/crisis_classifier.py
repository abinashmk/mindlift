"""
Keyword-based crisis classifier for MindLift chat messages.

The phrase list is configurable server-side (spec §24.3):
  - Stored in Redis under the key `crisis:keywords` as a JSON array.
  - If the key is absent, the hardcoded default list is used and written
    to Redis so subsequent updates via the admin API take effect.
  - The loaded list is cached in-process for 60 seconds to avoid a Redis
    round-trip on every chat message.

Updating keywords at runtime:
  Call `set_crisis_keywords(patterns)` (used by the admin endpoint) or
  write the JSON array directly to Redis at key `crisis:keywords`.
"""
from __future__ import annotations

import json
import re
import time
from typing import Optional

# ─── Default phrase list (spec §24.3 examples + extras) ──────────────────────

_DEFAULT_PATTERNS: list[str] = [
    "i want to kill myself",
    "kill myself",
    "i want to die",
    "want to die",
    "i don't want to live",
    "i dont want to live",
    "i'm going to hurt myself",
    "im going to hurt myself",
    "i cut myself",
    "i overdosed",
    "i want to hurt someone",
    "i hear voices telling me",
    "nothing matters and i have a plan",
    "end my life",
    "suicide",
    "suicidal",
    "don't want to be here",
    "dont want to be here",
    "hurt myself",
    "self harm",
    "no reason to live",
    "better off dead",
]

_REDIS_KEY = "crisis:keywords"
_CACHE_TTL_SECONDS = 60

# In-process cache: (patterns, compiled_patterns, loaded_at)
_cache: tuple[list[str], list[re.Pattern], float] | None = None


def _get_redis_sync():
    """Return a synchronous Redis client (used inside sync classify())."""
    import redis as sync_redis
    from app.config import settings
    return sync_redis.from_url(settings.redis_url, decode_responses=True)


def _load_patterns() -> tuple[list[str], list[re.Pattern]]:
    """
    Load patterns from Redis, falling back to defaults if not set.
    Writes defaults to Redis on first load so they can be managed via admin API.
    """
    global _cache

    now = time.monotonic()
    if _cache and (now - _cache[2]) < _CACHE_TTL_SECONDS:
        return _cache[0], _cache[1]

    patterns: list[str] = _DEFAULT_PATTERNS

    try:
        r = _get_redis_sync()
        raw: Optional[str] = r.get(_REDIS_KEY)
        if raw:
            patterns = json.loads(raw)
        else:
            # First boot — seed Redis with the defaults.
            r.set(_REDIS_KEY, json.dumps(_DEFAULT_PATTERNS))
    except Exception:
        # Redis unavailable — use defaults silently.
        pass

    compiled = [re.compile(re.escape(p), re.IGNORECASE) for p in patterns]
    _cache = (patterns, compiled, now)
    return patterns, compiled


def classify(message_text: str) -> dict:
    """
    Classify a chat message for crisis indicators.

    Returns:
        {
            "crisis": bool,
            "matched_patterns": list[str]
        }
    """
    patterns, compiled = _load_patterns()
    matched: list[str] = [
        pattern
        for pattern, regex in zip(patterns, compiled)
        if regex.search(message_text)
    ]
    return {"crisis": len(matched) > 0, "matched_patterns": matched}


def set_crisis_keywords(patterns: list[str]) -> None:
    """
    Overwrite the server-side crisis keyword list in Redis and
    invalidate the in-process cache immediately.
    Called by the admin API endpoint.
    """
    global _cache
    r = _get_redis_sync()
    r.set(_REDIS_KEY, json.dumps(patterns))
    _cache = None  # force reload on next classify() call


def get_crisis_keywords() -> list[str]:
    """Return the current active keyword list (from cache or Redis)."""
    patterns, _ = _load_patterns()
    return patterns
