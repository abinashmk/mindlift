"""
Keyword-based crisis classifier for MindLift chat messages.

Flags a message as crisis if it contains any of the defined patterns
(case-insensitive, substring match).
"""
from __future__ import annotations

import re

_CRISIS_PATTERNS: list[str] = [
    "kill myself",
    "end my life",
    "want to die",
    "suicide",
    "suicidal",
    "don't want to be here",
    "dont want to be here",
    "hurt myself",
    "self harm",
    "no reason to live",
    "better off dead",
]

# Pre-compile patterns for performance
_COMPILED: list[re.Pattern] = [
    re.compile(re.escape(p), re.IGNORECASE) for p in _CRISIS_PATTERNS
]


def classify(message_text: str) -> dict:
    """
    Classify a chat message for crisis indicators.

    Returns:
        {
            "crisis": bool,
            "matched_patterns": list[str]  # patterns that matched
        }
    """
    matched: list[str] = []
    for pattern, compiled in zip(_CRISIS_PATTERNS, _COMPILED):
        if compiled.search(message_text):
            matched.append(pattern)

    return {
        "crisis": len(matched) > 0,
        "matched_patterns": matched,
    }
