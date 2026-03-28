import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, model_validator


class ChatSessionState(str, Enum):
    IDLE = "IDLE"
    CHECK_IN = "CHECK_IN"
    SUPPORT = "SUPPORT"
    SUGGESTION = "SUGGESTION"
    CRISIS = "CRISIS"
    END = "END"


class SenderType(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class CreateSessionRequest(BaseModel):
    initial_state: ChatSessionState = ChatSessionState.IDLE


class ChatSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    session_id: uuid.UUID | None = None  # alias for id, populated post-init
    user_id: uuid.UUID
    started_at: datetime
    ended_at: datetime | None
    state: str
    crisis_flag: bool

    @model_validator(mode="after")
    def _set_session_id(self) -> "ChatSessionResponse":
        if self.session_id is None:
            self.session_id = self.id
        return self


class SendMessageRequest(BaseModel):
    message_text: str


class ChatMessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    session_id: uuid.UUID
    sender_type: str
    message_text: str | None
    message_length: int | None
    classifier_result: dict | None
    created_at: datetime


class MessagesListResponse(BaseModel):
    items: list[ChatMessageResponse]
    total: int


class SessionSummary(BaseModel):
    session_id: uuid.UUID
    state: str
    crisis_flag: bool


class SendMessageResponse(BaseModel):
    # None when crisis is detected — no LLM reply is generated per spec §24.4
    assistant_message: ChatMessageResponse | None
    session: SessionSummary


class EndSessionRequest(BaseModel):
    pass
