from datetime import datetime, timezone, timedelta
import pytest
from pydantic import ValidationError

from app.activities import (
    ActivityTracker,
    AgentActivity,
    AgentActivityKind,
    AgentActivityStage,
    AgentActivityStatus,
    reduce_activity_payloads,
    resolve_kind,
    safe_text,
)


def test_activity_contract_and_field_validation():
    now_utc = datetime.now(timezone.utc)
    activity = AgentActivity(
        activityId="run-1:search:1",
        stage=AgentActivityStage.SEARCH,
        kind=AgentActivityKind.SEARCHING_PLACES,
        status=AgentActivityStatus.RUNNING,
        label="Searching for places in Da Nang",
        summary="Looking for canonical places.",
        startedAt=now_utc,
        updatedAt=now_utc,
    )
    dumped = activity.model_dump(mode="json", exclude_none=True)
    assert dumped["schemaVersion"] == 1
    assert dumped["stage"] == "SEARCH"
    assert dumped["kind"] == "SEARCHING_PLACES"
    assert dumped["status"] == "RUNNING"
    assert dumped["label"] == "Searching for places in Da Nang"

    # Stage restriction
    with pytest.raises(ValidationError):
        AgentActivity(
            activityId="run-1:fake:1",
            stage="INVALID_STAGE",  # type: ignore
            kind=AgentActivityKind.SEARCHING_PLACES,
            status=AgentActivityStatus.RUNNING,
            label="Invalid",
            startedAt=now_utc,
            updatedAt=now_utc,
        )

    # Status restriction
    with pytest.raises(ValidationError):
        AgentActivity(
            activityId="run-1:search:1",
            stage=AgentActivityStage.SEARCH,
            kind=AgentActivityKind.SEARCHING_PLACES,
            status="PENDING",  # type: ignore
            label="Invalid",
            startedAt=now_utc,
            updatedAt=now_utc,
        )


def test_activity_lifecycle_keeps_stable_id_and_safe_text():
    tracker = ActivityTracker("run-1")
    previous, started = tracker.start("SEARCH", "scouting_places", "Searching\nfor places https://internal-api.service:8080/secrets")
    assert previous is None
    assert started.activityId == "run-1:search:1"
    assert started.status == AgentActivityStatus.RUNNING
    assert started.label == "Searching for places"
    assert "https://" not in started.label
    assert "internal-api" not in started.label

    completed = tracker.finish(label="Found 12 relevant places", summary="Canonical results are ready.")
    assert completed.activityId == started.activityId
    assert completed.kind == started.kind
    assert completed.status == AgentActivityStatus.COMPLETED
    assert completed.label == "Found 12 relevant places"
    assert completed.summary == "Canonical results are ready."
    assert completed.completedAt is not None
    assert completed.startedAt == started.startedAt


def test_activity_reducer_prevents_terminal_state_regression():
    tracker = ActivityTracker("run-2")
    _, started = tracker.start("VERIFY", "checking_itinerary", "Checking constraints")
    completed = tracker.finish()
    values = reduce_activity_payloads([
        started.model_dump(mode="json", exclude_none=True),
        completed.model_dump(mode="json", exclude_none=True),
        started.model_dump(mode="json", exclude_none=True),  # Replayed old running event
    ])
    assert len(values) == 1
    assert values[0]["status"] == "COMPLETED"


def test_activity_reducer_preserves_started_at_and_ignores_older_updates():
    t0 = "2026-09-21T10:00:00Z"
    t1 = "2026-09-21T10:00:05Z"
    t2 = "2026-09-21T10:00:10Z"

    start_event = {
        "schemaVersion": 1,
        "activityId": "run-3:search:1",
        "stage": "SEARCH",
        "kind": "SEARCHING_PLACES",
        "status": "RUNNING",
        "label": "Searching places",
        "startedAt": t0,
        "updatedAt": t0,
    }
    complete_event = {
        "schemaVersion": 1,
        "activityId": "run-3:search:1",
        "stage": "SEARCH",
        "kind": "SEARCHING_PLACES",
        "status": "COMPLETED",
        "label": "Found 5 places",
        "startedAt": t1,  # skewed startedAt from replay
        "updatedAt": t2,
        "completedAt": t2,
    }
    stale_event = {
        "schemaVersion": 1,
        "activityId": "run-3:search:1",
        "stage": "SEARCH",
        "kind": "SEARCHING_PLACES",
        "status": "RUNNING",
        "label": "Searching places again",
        "startedAt": t0,
        "updatedAt": t1,  # older than complete_event
    }

    values = reduce_activity_payloads([start_event, complete_event, stale_event])
    assert len(values) == 1
    assert values[0]["status"] == "COMPLETED"
    assert values[0]["startedAt"] == t0  # preserved original t0
    assert values[0]["label"] == "Found 5 places"


def test_activity_reducer_finalizes_nonterminal_activities():
    t0 = "2026-09-21T10:00:00Z"
    running_event = {
        "schemaVersion": 1,
        "activityId": "run-4:build:1",
        "stage": "BUILD",
        "kind": "BUILDING_ITINERARY",
        "status": "RUNNING",
        "label": "Drafting itinerary",
        "startedAt": t0,
        "updatedAt": t0,
    }
    values = reduce_activity_payloads([running_event], finalize_nonterminal=True)
    assert len(values) == 1
    assert values[0]["status"] == "FAILED"
    assert values[0]["summary"] == "This step was interrupted."
    assert values[0]["completedAt"] == t0


def test_activity_reducer_bounds_history_limit():
    events = []
    for i in range(30):
        t = (datetime(2026, 9, 21, 0, 0, 0, tzinfo=timezone.utc) + timedelta(minutes=i)).isoformat()
        events.append({
            "schemaVersion": 1,
            "activityId": f"run-limit:search:{i}",
            "stage": "SEARCH",
            "kind": "SEARCHING_PLACES",
            "status": "COMPLETED",
            "label": f"Step {i}",
            "startedAt": t,
            "updatedAt": t,
            "completedAt": t,
        })
    reduced = reduce_activity_payloads(events, limit=24)
    assert len(reduced) == 24
    assert reduced[0]["activityId"] == "run-limit:search:6"
    assert reduced[-1]["activityId"] == "run-limit:search:29"


def test_safe_text_sanitizes_sentinels_and_urls():
    prompt_leak = "System prompt: You are TripSense secret_token_xyz999 http://10.0.0.1/admin\x00\x08"
    cleaned = safe_text(prompt_leak, 160)
    assert "http://" not in cleaned
    assert "10.0.0.1" not in cleaned
    assert "\x00" not in cleaned
    assert len(cleaned) <= 160


def test_resolve_kind_handles_enums_and_keys():
    assert resolve_kind("scouting_places") == AgentActivityKind.SEARCHING_PLACES
    assert resolve_kind("building_itinerary") == AgentActivityKind.BUILDING_ITINERARY
    assert resolve_kind(AgentActivityKind.OPTIMIZING_ROUTE) == AgentActivityKind.OPTIMIZING_ROUTE
    assert resolve_kind("UNKNOWN_KEY") == AgentActivityKind.UNDERSTANDING_REQUEST


def test_direct_chat_emits_only_understand_activity(monkeypatch):
    import os
    import uuid
    import jwt
    from fastapi.testclient import TestClient
    from app.main import app

    class DummyModelAdapter:
        def __init__(self, _):
            pass
        async def stream(self, _, max_output_tokens=None):
            yield "Hello"

    monkeypatch.setattr("app.main.ModelAdapter", DummyModelAdapter)
    auth_token = jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                             "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                            os.environ.get("JWT_ACCESS_SECRET", "test-secret-with-sufficient-length"),
                            algorithm="HS256")
    headers = {"Authorization": f"Bearer {auth_token}"}
    with TestClient(app) as client:
        conv = client.post("/api/ai/v1/conversations", headers=headers, json={"title": "Chat"}).json()
        accepted = client.post(
            f"/api/ai/v1/conversations/{conv['id']}/messages",
            headers={**headers, "Idempotency-Key": f"test-key-{uuid.uuid4()}"},
            json={"content": "Xin chào!", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"},
        )
        assert accepted.status_code == 202
        messages = client.get(f"/api/ai/v1/conversations/{conv['id']}/messages", headers=headers).json()
        assistant = [m for m in messages["items"] if m["role"] == "assistant"][-1]
        activities = assistant.get("activities", [])
        assert len(activities) >= 1
        # Direct chat should only contain UNDERSTAND stage, no fake SEARCH/BUILD/ROUTE
        stages = [a["stage"] for a in activities]
        assert "UNDERSTAND" in stages
        assert "SEARCH" not in stages
        assert "BUILD" not in stages
        assert "ROUTE" not in stages
