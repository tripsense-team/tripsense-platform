from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from .models import ActionType, RunStatus


class ConversationCreate(BaseModel):
    title: str | None = Field(None, max_length=160)
    locale: str | None = Field(None, max_length=16)


class ConversationPatch(BaseModel):
    title: str | None = Field(None, max_length=160)
    archived: bool | None = None


class MessageContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tripId: str | None = Field(None, pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
    hotelPlaceId: str | None = Field(None, pattern=r"^[A-Za-z0-9._:-]{1,200}$")
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    timezone: str | None = Field(None, pattern=r"^[A-Za-z0-9_+./-]{1,64}$")


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
    clientMessageId: str = Field(min_length=1, max_length=80)
    intent: str = Field("NORMAL", pattern="^(NORMAL|CORRECTION)$")
    tripId: str | None = Field(None, pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
    locale: str | None = Field(None, max_length=16)
    context: MessageContext = Field(default_factory=MessageContext)
    replacesRunId: str | None = Field(None, pattern=r"^[0-9a-fA-F-]{36}$")


class ConversationResponse(BaseModel):
    id: str
    title: str | None
    locale: str | None
    status: str
    createdAt: datetime
    updatedAt: datetime


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    createdAt: datetime


class RunResponse(BaseModel):
    id: str
    conversationId: str
    actionType: ActionType
    status: RunStatus
    assistantMessageId: str | None
    error: dict | None = None
    inputTokens: int = 0
    outputTokens: int = 0


class AcceptedRun(BaseModel):
    messageId: str
    runId: str
    status: RunStatus
    streamUrl: str


class ErrorBody(BaseModel):
    code: str
    message: str
    retryable: bool = False
    runId: str | None = None
    retryAfterSeconds: int | None = None


class RecommendationFeedbackCreate(BaseModel):
    candidateId: str = Field(min_length=1, max_length=200, pattern=r"^[A-Za-z0-9._:-]+$")
    action: str = Field(pattern=r"^(SAVE|REJECT|MORE_LIKE_THIS)$")
