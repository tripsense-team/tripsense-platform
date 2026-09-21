import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

os.environ.setdefault("AI_DATABASE_URL", "sqlite:///./test_ai.db")
os.environ.setdefault("JWT_ACCESS_SECRET", "test-secret-with-sufficient-length")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ["EUREKA_SERVER"] = ""

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app, classify_action, settings
from app.models import ActionType
from app.tools import ToolExecutionError, ToolExecutor, ToolResult, TripInput


class FakeModelAdapter:
    def __init__(self, _):
        pass

    async def stream(self, _, max_output_tokens=None):
        yield "Hello"
        yield " from TripSense"


class FakeGroundedAdapter(FakeModelAdapter):
    async def select_tools(self, _, max_tool_calls=None):
        return [{"id": "tool-1", "name": "search_places", "arguments": {"query": "cà phê Đà Nẵng", "limit": 2}}]


class FakeToolExecutor:
    def __init__(self, *_):
        pass

    async def execute(self, name, _):
        provenance = {"source": "REAL", "provider": "place-service", "fetchedAt": "2026-09-18T00:00:00Z", "freshness": "FRESH"}
        places = [{"id": "place-1", "name": "Cà phê Test", "city": "Đà Nẵng", "rating": 4.8}]
        return ToolResult(name=name, data=places, provenance=provenance,
                          artifact={"schemaVersion": 1, "type": "PLACE_LIST", "version": 1,
                                    "data": {"places": places}, "provenance": [provenance]}, duration_ms=5)


def token(subject: str | None = None) -> str:
    return jwt.encode({"sub": subject or str(uuid.uuid4()), "type": "ACCESS",
                       "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                      os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")


def test_action_classification_is_bounded():
    assert classify_action("Please plan a trip to Hue") == ActionType.PLAN_ITINERARY
    assert classify_action("Hello there") == ActionType.GENERAL_CHAT
    assert classify_action("Tìm địa điểm cà phê gần đây") == ActionType.PLACE_SEARCH


def test_conversation_is_owner_scoped():
    with TestClient(app) as client:
        first = {"Authorization": f"Bearer {token()}"}
        second = {"Authorization": f"Bearer {token()}"}
        created = client.post("/api/ai/v1/conversations", headers=first, json={"title": "Test"})
        assert created.status_code == 201
        assert client.get(f"/api/ai/v1/conversations/{created.json()['id']}", headers=second).status_code == 404


def test_refresh_token_is_rejected():
    bad = jwt.encode({"sub": str(uuid.uuid4()), "type": "REFRESH",
                      "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                     os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")
    with TestClient(app) as client:
        assert client.get("/api/ai/v1/conversations", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_message_creates_durable_completed_run(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakeModelAdapter)
    headers = {"Authorization": f"Bearer {token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        message_headers = {**headers, "Idempotency-Key": "request-1"}
        accepted = client.post(f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers=message_headers, json={"content": "Hello", "clientMessageId": "client-1", "intent": "NORMAL"})
        assert accepted.status_code == 202
        run = client.get(f"/api/ai/v1/runs/{accepted.json()['runId']}", headers=headers)
        assert run.json()["status"] == "COMPLETED"
        messages = client.get(f"/api/ai/v1/conversations/{conversation['id']}/messages", headers=headers).json()
        assert [item["content"] for item in messages["items"]][-2:] == ["Hello", "Hello from TripSense"]
        duplicate = client.post(f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers=message_headers, json={"content": "Hello", "clientMessageId": "client-1", "intent": "NORMAL"})
        assert duplicate.json()["runId"] == accepted.json()["runId"]


def test_grounded_place_artifact_is_persisted(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakeGroundedAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakeToolExecutor)
    headers = {"Authorization": f"Bearer {token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        accepted = client.post(f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": "grounded-request"},
            json={"content": "Tìm địa điểm cà phê ở Đà Nẵng", "clientMessageId": "grounded-client", "intent": "NORMAL"})
        assert accepted.status_code == 202
        messages = client.get(f"/api/ai/v1/conversations/{conversation['id']}/messages", headers=headers).json()["items"]
        assistant = messages[-1]
        assert assistant["artifacts"][0]["type"] == "PLACE_LIST"
        assert assistant["artifacts"][0]["provenance"][0]["provider"] == "place-service"


def test_tool_allowlist_and_trip_id_validation():
    executor = ToolExecutor(settings, "short-lived-test-token")
    with pytest.raises(ToolExecutionError, match="allowlisted") as forbidden:
        asyncio.run(executor.execute("fetch_url", {"url": "https://example.com"}))
    assert forbidden.value.code == "TOOL_NOT_ALLOWED"
    with pytest.raises(ValidationError):
        TripInput.model_validate({"tripId": "------------------------------------"})
    assert executor._object_list({"data": [{"id": "place-1"}]}) == [{"id": "place-1"}]
    with pytest.raises(ToolExecutionError) as malformed:
        executor._object_payload({"data": ["not-an-object"]})
    assert malformed.value.code == "TOOL_RESPONSE_INVALID"
