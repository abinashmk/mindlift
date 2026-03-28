"""
LLM chat reply service using Anthropic Claude (spec §23).

Reply structure (spec §23.3):
  1. one reflective statement
  2. one concrete non-clinical suggestion
  3. one follow-up question
  Max: 3 sentences, 60 words total

Disallowed output (spec §23.4) and medical advice handling (spec §23.5) are
enforced via the system prompt.
"""

from anthropic import AsyncAnthropic

from app.config import settings

_SYSTEM_PROMPT = """\
You are a burnout prevention coach inside MindLift, an app for students and \
professionals managing work and study pressure. Your role is strictly bounded: \
you offer practical stress-management support for career and academic pressures — \
not therapy, diagnosis, treatment, or emergency help. You are not a human and \
must never claim to be one.

CONTEXT: Users are often dealing with deadlines, job uncertainty, heavy workloads, \
or exam stress. Speak to that reality — be practical and grounded, not clinical.

REQUIRED REPLY STRUCTURE (every normal response):
1. One brief reflective statement that acknowledges the specific pressure they described
2. One concrete micro-action they can take right now (e.g., a 5-minute break, \
writing down tomorrow's top 3 tasks, stepping outside, closing one browser tab)
3. One follow-up question that helps them identify what's most draining them

HARD LIMITS:
- Maximum 3 sentences and 60 words total
- Never output any of: "I diagnose", "You have depression", "You have anxiety \
disorder", "Take medication", "You don't need anyone else", "I love you", \
"I am always here for you"
- Never claim to offer crisis support or emergency assistance
- Never use corporate jargon or toxic positivity ("you've got this!", "stay positive!")

IF THE USER ASKS FOR MEDICAL ADVICE OR DIAGNOSIS:
Respond that you cannot provide diagnosis or medical advice, recommend they \
contact a licensed professional, and ask one brief question about their next \
support step. Keep this to under 60 words.

Respond with only the reply text — no preamble, no labels, no meta-commentary.\
"""

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def generate_greeting(first_name: str) -> str:
    """
    Generate a short opening check-in message when a chat session starts.
    Personalised to the user's first name, framed as a burnout coach check-in.
    """
    if not settings.anthropic_api_key:
        return (
            f"Hey {first_name}, glad you're here. "
            "What's been taking up most of your headspace today?"
        )

    prompt = (
        f"The user's name is {first_name}. "
        "Generate a single warm, casual opening message to start a check-in. "
        "It should acknowledge they may be under work or study pressure and ask "
        "one open question about how they're doing right now. "
        "Maximum 2 sentences, 30 words. No preamble."
    )
    try:
        response = await _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception:
        return (
            f"Hey {first_name}, glad you're here. "
            "What's been taking up most of your headspace today?"
        )


def _build_system_prompt(burnout_context: str | None) -> str:
    """Append a brief burnout-load context block to the system prompt if available."""
    if not burnout_context:
        return _SYSTEM_PROMPT
    return (
        _SYSTEM_PROMPT
        + f"\n\nUSER CONTEXT (from their recent biometric and behavioural data):\n{burnout_context}\n"
        "Use this context to make your reply more specific and relevant. "
        "Do not quote raw numbers back to the user — translate them into plain language. "
        "Do not diagnose based on this data."
    )


async def generate_chat_reply(
    history: list[dict[str, str]],
    user_message: str,
    burnout_context: str | None = None,
) -> str:
    """
    Generate a bounded assistant reply per spec §23.

    `history` is a list of {"role": "user"|"assistant", "content": "..."} dicts
    representing prior turns (excluding the current user message).

    `burnout_context` is an optional plain-language summary of the user's
    current burnout load derived from their latest risk assessment and drift
    alerts. When provided it is injected into the system prompt so replies
    are contextually relevant without requiring the user to recap their state.

    Returns the reply text. Falls back to a safe canned message when the API
    key is absent or the call fails, so the endpoint never 500s on LLM errors.
    """
    if not settings.anthropic_api_key:
        return (
            "I hear that things feel difficult right now. "
            "Taking a few slow breaths can sometimes help create a moment of calm. "
            "What feels most on your mind today?"
        )

    messages = [*history, {"role": "user", "content": user_message}]
    system = _build_system_prompt(burnout_context)

    try:
        response = await _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            system=system,
            messages=messages,
        )
        return response.content[0].text.strip()
    except Exception:
        # LLM failure — surface a safe canned reply rather than 500
        return (
            "It sounds like you're carrying something heavy right now. "
            "Grounding yourself with a few slow, deep breaths can help. "
            "Would you like to share more about what's going on?"
        )
