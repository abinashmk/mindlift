import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import write_audit_log
from app.core.limiter import get_user_id_or_ip, limiter
from app.database import get_db
from app.models.chat import ChatMessage, ChatSession
from app.models.escalation import Escalation
from app.models.user import User, UserConsent
from app.schemas.chat import (
    ChatMessageResponse,
    ChatSessionResponse,
    CreateSessionRequest,
    MessagesListResponse,
    SendMessageRequest,
)
from app.services.auth import get_current_user
from app.services.crisis_classifier import classify

router = APIRouter(prefix="/chat", tags=["chat"])


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


@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
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
    return session


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
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
    message = ChatMessage(
        id=uuid.uuid4(),
        session_id=session.id,
        sender_type="user",
        message_text=store_text,
        message_length=store_length,
        classifier_result=classifier_result,
        created_at=now,
    )
    db.add(message)

    # If crisis detected: flag session and update user state.
    if classifier_result["crisis"]:
        session.crisis_flag = True
        session.state = "CRISIS"
        current_user.state = "CRISIS"
        current_user.updated_at = now

        # Create escalation record
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
            extra={"user_id": str(current_user.id), "patterns": classifier_result["matched_patterns"]},
        )

    await db.flush()
    return message


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
