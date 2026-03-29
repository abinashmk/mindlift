import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.core.limiter import get_user_id_or_ip, limiter
from app.database import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.drift_alert import DriftAlert
from app.models.escalation import Escalation
from app.models.risk import RiskAssessment
from app.models.user import User, UserConsent
from app.schemas.chat import (
    ChatMessageResponse,
    ChatSessionResponse,
    CreateSessionRequest,
    MessagesListResponse,
    SendMessageRequest,
    SendMessageResponse,
    SessionSummary,
)
from app.services.auth import get_current_user
from app.services.crisis_classifier import classify
from app.services.llm import generate_chat_reply, generate_greeting

router = APIRouter(prefix="/chat", tags=["chat"])

_LEVEL_LABELS = {
    "GREEN": "low",
    "YELLOW": "moderate",
    "ORANGE": "elevated",
    "RED": "high",
    "UNDEFINED": "not yet calculated",
}

_DRIFT_COPY = {
    ("sleep_hours", "decline"): "sleep has been below their normal level",
    ("sleep_hours", "improvement"): "sleep has improved above their normal level",
    ("steps", "decline"): "physical activity has dropped below their normal level",
    ("steps", "improvement"): "physical activity has been higher than usual",
    (
        "meeting_hours",
        "improvement",
    ): "calendar has been unusually packed with meetings",
    ("meeting_hours", "decline"): "meeting load has been lighter than usual",
}


async def _build_burnout_context(
    user_id: uuid.UUID,
    db: AsyncSession,
) -> str | None:
    """
    Compose a plain-language burnout context string from the user's latest
    risk assessment and any active drift alerts (last 3 days).
    Returns None if there is no risk data yet.
    """
    risk_result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.user_id == user_id)
        .order_by(RiskAssessment.assessment_time.desc())
        .limit(1)
    )
    latest_risk: RiskAssessment | None = risk_result.scalar_one_or_none()
    if not latest_risk:
        return None

    level_label = _LEVEL_LABELS.get(latest_risk.risk_level, "unknown")
    score_pct = round(latest_risk.risk_score * 100)
    lines = [f"The user's current burnout load is {level_label} ({score_pct}%)."]

    # Active drift signals (last 3 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=3)
    drift_result = await db.execute(
        select(DriftAlert)
        .where(
            DriftAlert.user_id == user_id,
            DriftAlert.created_at >= cutoff,
        )
        .order_by(DriftAlert.created_at.desc())
    )
    recent_alerts = drift_result.scalars().all()

    seen: set[tuple[str, str]] = set()
    signal_lines: list[str] = []
    for alert in recent_alerts:
        key = (alert.metric_key, alert.direction)
        if key not in seen:
            seen.add(key)
            copy = _DRIFT_COPY.get(key)
            if copy:
                signal_lines.append(f"Their {copy} recently.")

    if signal_lines:
        lines.append("Recent signals: " + " ".join(signal_lines))

    return " ".join(lines)


async def _chat_logging_accepted(user: User, db: AsyncSession) -> bool:
    """Return True if the user has an active chat_logging consent."""
    result = await db.execute(
        select(UserConsent)
        .where(
            UserConsent.user_id == user.id,
            UserConsent.consent_key == "chat_logging_accepted",
            UserConsent.consent_value == True,
        )
        .order_by(UserConsent.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


@router.post(
    "/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED
)
async def create_session(
    payload: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    session = ChatSession(
        id=uuid.uuid4(),
        user_id=current_user.id,
        started_at=now,
        state=payload.initial_state.value,
        crisis_flag=False,
    )
    db.add(session)
    await db.flush()

    # Generate and store an opening greeting so the chat screen isn't blank
    greeting_text = await generate_greeting(current_user.first_name or "there")
    greeting_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_type="assistant",
        message_text=greeting_text,
        message_length=len(greeting_text),
        classifier_result=None,
        created_at=now,
    )
    db.add(greeting_msg)
    await db.flush()

    return session


@router.post(
    "/sessions/{session_id}/messages",
    response_model=SendMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute", key_func=get_user_id_or_ip)
async def send_message(
    request: Request,
    response: Response,
    session_id: uuid.UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Safety: block chat input for users in CRISIS state.
    if current_user.state == "CRISIS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Chat input is blocked while you are in a crisis state. "
                "Please contact emergency services or a crisis helpline immediately."
            ),
        )

    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session: ChatSession | None = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.ended_at is not None:
        raise HTTPException(status_code=400, detail="Session has already ended.")

    # Crisis classification
    classifier_result = classify(payload.message_text)

    # Determine what to store based on consent.
    logging_ok = await _chat_logging_accepted(current_user, db)
    store_text = payload.message_text if logging_ok else None
    store_length = len(payload.message_text)

    now = datetime.now(timezone.utc)
    user_message = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_type="user",
        message_text=store_text,
        message_length=store_length,
        classifier_result=classifier_result,
        created_at=now,
    )
    db.add(user_message)

    # Crisis path: flag session, create escalation, no LLM reply (spec §24.4)
    if classifier_result["crisis"]:
        session.crisis_flag = True
        session.state = "CRISIS"
        current_user.state = "CRISIS"
        current_user.updated_at = now

        escalation = Escalation(
            id=uuid.uuid4(),
            user_id=current_user.id,
            source="crisis_classifier",
            status="NEW",
            risk_level="RED",
            packet={
                "session_id": str(session.id),
                "matched_patterns": classifier_result["matched_patterns"],
                "message_length": store_length,
            },
            created_at=now,
            updated_at=now,
        )
        db.add(escalation)

        await write_audit_log(
            db,
            actor_type="system",
            actor_id=None,
            action_key="crisis.detected",
            entity_type="chat_session",
            entity_id=session.id,
            extra={
                "user_id": str(current_user.id),
                "patterns": classifier_result["matched_patterns"],
            },
        )

        await db.flush()
        return SendMessageResponse(
            assistant_message=None,
            session=SessionSummary(
                session_id=session.id,
                state=session.state,
                crisis_flag=session.crisis_flag,
            ),
        )

    # Normal path: fetch recent history and generate LLM reply (spec §23)
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(20)
    )
    prior_messages = history_result.scalars().all()

    # Convert prior messages to anthropic format (skip messages with no text)
    history: list[dict[str, str]] = []
    for m in prior_messages:
        if m.message_text and m.sender_type in ("user", "assistant"):
            history.append({"role": m.sender_type, "content": m.message_text})

    burnout_context = await _build_burnout_context(current_user.id, db)
    reply_text = await generate_chat_reply(
        history, payload.message_text, burnout_context
    )

    assistant_msg = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_type="assistant",
        message_text=reply_text if logging_ok else None,
        message_length=len(reply_text),
        classifier_result=None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_msg)

    await db.flush()
    # Always return the reply text to the client; logging_ok only controls
    # whether the text is persisted server-side for support-agent review.
    return SendMessageResponse(
        assistant_message=ChatMessageResponse(
            id=assistant_msg.id,
            session_id=assistant_msg.session_id,
            sender_type=assistant_msg.sender_type,
            message_text=reply_text,
            message_length=assistant_msg.message_length,
            classifier_result=assistant_msg.classifier_result,
            created_at=assistant_msg.created_at,
        ),
        session=SessionSummary(
            session_id=session.id,
            state=session.state,
            crisis_flag=session.crisis_flag,
        ),
    )


@router.get("/sessions/{session_id}/messages", response_model=MessagesListResponse)
async def get_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found.")

    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    items = list(msg_result.scalars().all())
    return MessagesListResponse(items=items, total=len(items))


@router.post("/sessions/{session_id}/end", response_model=ChatSessionResponse)
async def end_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session: ChatSession | None = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    if session.ended_at is not None:
        raise HTTPException(status_code=400, detail="Session already ended.")

    session.ended_at = datetime.now(timezone.utc)
    session.state = "END"
    await db.flush()
    return session
