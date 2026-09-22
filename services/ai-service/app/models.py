import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class ConversationStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class MessageRole(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class ActionType(str, enum.Enum):
    GENERAL_CHAT = "GENERAL_CHAT"
    PLACE_SEARCH = "PLACE_SEARCH"
    PLACE_RECOMMENDATION = "PLACE_RECOMMENDATION"
    TRIP_QA = "TRIP_QA"
    PLAN_ITINERARY = "PLAN_ITINERARY"
    MODIFY_ITINERARY = "MODIFY_ITINERARY"
    REFINE_PLAN = "REFINE_PLAN"
    CURRENT_RESEARCH = "CURRENT_RESEARCH"


class RunStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCEL_REQUESTED = "CANCEL_REQUESTED"
    CANCELLED = "CANCELLED"
    SUPERSEDED = "SUPERSEDED"


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(160))
    locale: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[ConversationStatus] = mapped_column(Enum(ConversationStatus, native_enum=False), default=ConversationStatus.ACTIVE)
    summary_json: Mapped[dict | None] = mapped_column(JSON)
    summary_version: Mapped[int] = mapped_column(Integer, default=0)
    summary_through_message_id: Mapped[str | None] = mapped_column(String(36))
    summary_source_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")
    __table_args__ = (Index("ix_conversations_owner_updated", "owner_user_id", "updated_at"),)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    client_message_id: Mapped[str | None] = mapped_column(String(80))
    idempotency_key: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole, native_enum=False), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    __table_args__ = (
        UniqueConstraint("owner_user_id", "client_message_id", name="uq_messages_owner_client"),
        UniqueConstraint("owner_user_id", "idempotency_key", name="uq_messages_owner_idempotency"),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
    )


class Run(Base):
    __tablename__ = "runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    trigger_message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"))
    assistant_message_id: Mapped[str | None] = mapped_column(ForeignKey("messages.id"))
    action_type: Mapped[ActionType] = mapped_column(Enum(ActionType, native_enum=False), default=ActionType.GENERAL_CHAT)
    status: Mapped[RunStatus] = mapped_column(Enum(RunStatus, native_enum=False), default=RunStatus.QUEUED, index=True)
    state_version: Mapped[int] = mapped_column(Integer, default=0)
    execution_profile: Mapped[str | None] = mapped_column(String(32))
    context_sufficiency: Mapped[str | None] = mapped_column(String(32))
    retrieval_sufficiency: Mapped[str | None] = mapped_column(String(32))
    goal_json: Mapped[dict | None] = mapped_column(JSON)
    counters_json: Mapped[dict] = mapped_column(JSON, default=dict)
    termination_reason: Mapped[str | None] = mapped_column(String(80))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retry_of_run_id: Mapped[str | None] = mapped_column(String(36))
    supersedes_run_id: Mapped[str | None] = mapped_column(String(36))
    error_code: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(String(500))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_micros: Mapped[int] = mapped_column(Integer, default=0)
    cancel_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class ToolCall(Base):
    __tablename__ = "tool_calls"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    provenance_json: Mapped[dict | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ModelCall(Base):
    __tablename__ = "model_calls"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    usage_source: Mapped[str] = mapped_column(String(20), default="ESTIMATED")
    error_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ContextFact(Base):
    __tablename__ = "conversation_context_facts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    fact_key: Mapped[str] = mapped_column(String(80), nullable=False)
    value_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    source_ref: Mapped[str | None] = mapped_column(String(80))
    confidence: Mapped[int] = mapped_column(Integer, default=100)
    scope_type: Mapped[str] = mapped_column(String(24), default="CONVERSATION")
    scope_id: Mapped[str | None] = mapped_column(String(80))
    state: Mapped[str] = mapped_column(String(24), default="KNOWN")
    sensitivity: Mapped[str] = mapped_column(String(24), default="NORMAL")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    supersedes_fact_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        Index("ix_context_facts_conversation_key", "owner_user_id", "conversation_id", "fact_key", "state"),
        Index("ix_context_facts_scope_key", "owner_user_id", "scope_type", "scope_id", "fact_key"),
        Index("ix_context_facts_expiry", "expires_at"),
    )


class PendingClarification(Base):
    __tablename__ = "pending_clarifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    originating_run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    required_keys_json: Mapped[list] = mapped_column(JSON, nullable=False)
    answer_schema_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="ACTIVE")
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("ix_pending_clarification_active", "owner_user_id", "conversation_id", "status"),)


class RunEvent(Base):
    __tablename__ = "run_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    conversation_id: Mapped[str] = mapped_column(String(36), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        UniqueConstraint("run_id", "sequence", name="uq_run_events_sequence"),
        Index("ix_run_events_replay", "run_id", "sequence"),
    )


class ConversationLease(Base):
    __tablename__ = "conversation_run_leases"
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False)
    lease_token: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class RecommendationImpression(Base):
    __tablename__ = "recommendation_impressions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    artifact_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True)
    goal_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    candidates_json: Mapped[list] = mapped_column(JSON, nullable=False)
    ranking_version: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    impression_id: Mapped[str] = mapped_column(ForeignKey("recommendation_impressions.id", ondelete="CASCADE"), nullable=False)
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    candidate_id: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("owner_user_id", "idempotency_key", name="uq_recommendation_feedback_owner_key"),)


class Proposal(Base):
    __tablename__ = "proposals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    target_trip_id: Mapped[str] = mapped_column(String(36), nullable=False)
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    processing_state: Mapped[str | None] = mapped_column(String(24))
    business_state: Mapped[str] = mapped_column(String(24), nullable=False)
    payload_version: Mapped[int] = mapped_column(Integer, default=1)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    validation_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    evidence_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    base_trip_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    applied_receipt_json: Mapped[dict | None] = mapped_column(JSON)
    state_version: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
