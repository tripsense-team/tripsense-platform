"""Safe, replayable summaries of real agent work. Never accepts model-authored prose."""
from datetime import datetime, timezone
from enum import Enum
import re
from typing import Any

from pydantic import BaseModel, Field


class AgentActivityStage(str, Enum):
    UNDERSTAND = "UNDERSTAND"
    SEARCH = "SEARCH"
    EVALUATE = "EVALUATE"
    BUILD = "BUILD"
    ROUTE = "ROUTE"
    VERIFY = "VERIFY"


class AgentActivityStatus(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class AgentActivityKind(str, Enum):
    UNDERSTANDING_REQUEST = "UNDERSTANDING_REQUEST"
    RESOLVING_CONTEXT = "RESOLVING_CONTEXT"
    SEARCHING_PLACES = "SEARCHING_PLACES"
    SEARCHING_CURRENT_SOURCES = "SEARCHING_CURRENT_SOURCES"
    COMPARING_EVIDENCE = "COMPARING_EVIDENCE"
    COMPARING_GEOGRAPHIC_FIT = "COMPARING_GEOGRAPHIC_FIT"
    BUILDING_ITINERARY = "BUILDING_ITINERARY"
    REVISING_ITINERARY = "REVISING_ITINERARY"
    OPTIMIZING_ROUTE = "OPTIMIZING_ROUTE"
    VERIFYING_CONSTRAINTS = "VERIFYING_CONSTRAINTS"
    VERIFYING_EVIDENCE = "VERIFYING_EVIDENCE"


class AgentActivity(BaseModel):
    schemaVersion: int = 1
    activityId: str = Field(min_length=1, max_length=160)
    requirementId: str | None = None
    stage: AgentActivityStage
    kind: AgentActivityKind
    status: AgentActivityStatus
    label: str = Field(min_length=1, max_length=160)
    summary: str | None = Field(None, max_length=320)
    progress: dict[str, int] | None = None
    startedAt: datetime
    updatedAt: datetime
    completedAt: datetime | None = None


_KIND_BY_KEY = {
    "understanding_request": AgentActivityKind.UNDERSTANDING_REQUEST,
    "resolving_context": AgentActivityKind.RESOLVING_CONTEXT,
    "checking_sources": AgentActivityKind.SEARCHING_PLACES,
    "researching_current_sources": AgentActivityKind.SEARCHING_CURRENT_SOURCES,
    "scouting_places": AgentActivityKind.SEARCHING_PLACES,
    "comparing_evidence": AgentActivityKind.COMPARING_EVIDENCE,
    "comparing_geographic_fit": AgentActivityKind.COMPARING_GEOGRAPHIC_FIT,
    "building_itinerary": AgentActivityKind.BUILDING_ITINERARY,
    "revising_itinerary": AgentActivityKind.REVISING_ITINERARY,
    "checking_route": AgentActivityKind.OPTIMIZING_ROUTE,
    "checking_itinerary": AgentActivityKind.VERIFYING_CONSTRAINTS,
    "checking_evidence": AgentActivityKind.VERIFYING_EVIDENCE,
}


def resolve_kind(key: str | AgentActivityKind) -> AgentActivityKind:
    if isinstance(key, AgentActivityKind):
        return key
    if key in _KIND_BY_KEY:
        return _KIND_BY_KEY[key]
    try:
        return AgentActivityKind(key)
    except (ValueError, KeyError):
        return AgentActivityKind.UNDERSTANDING_REQUEST


def safe_text(value: str, limit: int) -> str:
    """Collapse control characters, strip URLs/traces; activity text must come from server templates."""
    cleaned = re.sub(r"[\x00-\x1f\x7f]+", " ", value)
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:limit]


class ActivityTracker:
    def __init__(self, run_id: str):
        self.run_id = run_id
        self.ordinal = 0
        self.current: AgentActivity | None = None

    def start(self, stage: str, activity_key: str | AgentActivityKind, label: str,
              summary: str | None = None, requirement_id: str | None = None,
              activity_id: str | None = None) -> tuple[AgentActivity | None, AgentActivity]:
        previous = self.finish(AgentActivityStatus.COMPLETED) if self.current else None
        self.ordinal += 1
        timestamp = datetime.now(timezone.utc)
        aid = activity_id or (
            f"{self.run_id}:{requirement_id}" if requirement_id else f"{self.run_id}:{stage.casefold()}:{self.ordinal}"
        )
        activity = AgentActivity(
            activityId=aid,
            requirementId=requirement_id,
            stage=AgentActivityStage(stage),
            kind=resolve_kind(activity_key),
            status=AgentActivityStatus.RUNNING,
            label=safe_text(label, 160),
            summary=safe_text(summary, 320) if summary else None,
            startedAt=timestamp,
            updatedAt=timestamp,
        )
        self.current = activity
        return previous, activity

    def update(self, label: str | None = None, summary: str | None = None,
               progress: dict[str, int] | None = None) -> AgentActivity | None:
        if not self.current:
            return None
        timestamp = datetime.now(timezone.utc)
        self.current = self.current.model_copy(update={
            "label": safe_text(label, 160) if label else self.current.label,
            "summary": safe_text(summary, 320) if summary else self.current.summary,
            "progress": progress if progress is not None else self.current.progress,
            "updatedAt": timestamp,
        })
        return self.current

    def finish(self, status: AgentActivityStatus = AgentActivityStatus.COMPLETED,
               label: str | None = None, summary: str | None = None,
               progress: dict[str, int] | None = None) -> AgentActivity | None:
        if not self.current:
            return None
        timestamp = datetime.now(timezone.utc)
        updated = self.current.model_copy(update={
            "status": status,
            "label": safe_text(label, 160) if label else self.current.label,
            "summary": safe_text(summary, 320) if summary else self.current.summary,
            "progress": progress if progress is not None else self.current.progress,
            "updatedAt": timestamp,
            "completedAt": timestamp,
        })
        self.current = None
        return updated


def reduce_activity_payloads(payloads: list[dict], limit: int = 24, finalize_nonterminal: bool = True) -> list[dict]:
    latest: dict[str, dict] = {}
    order: list[str] = []
    terminal = {"COMPLETED", "FAILED", "SKIPPED"}
    for payload in payloads:
        try:
            item = AgentActivity.model_validate(payload).model_dump(mode="json", exclude_none=True)
        except ValueError:
            continue
        activity_id = item["activityId"]
        prior = latest.get(activity_id)
        if prior:
            item["startedAt"] = prior.get("startedAt", item["startedAt"])
            if prior.get("status") in terminal and item["status"] == "RUNNING":
                continue
            prior_updated = prior.get("updatedAt")
            item_updated = item.get("updatedAt")
            if prior_updated and item_updated and item_updated < prior_updated:
                continue
        if activity_id not in latest:
            order.append(activity_id)
        latest[activity_id] = item

    result: list[dict] = []
    for item_id in order:
        item = latest[item_id]
        if finalize_nonterminal and item.get("status") == "RUNNING":
            item["status"] = "FAILED"
            item["summary"] = item.get("summary") or "This step was interrupted."
            if not item.get("completedAt"):
                item["completedAt"] = item.get("updatedAt")
        result.append(item)
    return result[-limit:]
