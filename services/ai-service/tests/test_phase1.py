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
from app.main import app, classify_action, fallback_tool_calls, settings, should_publish_place_artifact
from app.models import ActionType
from app.recommendation.goal_normalizer import RecommendationGoalNormalizer, travel_goal_to_recommendation_goal
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
    assert classify_action("vậy khách sanj gần thanh khê đi") == ActionType.PLACE_SEARCH


def test_recommendation_fallback_never_uses_raw_place_search():
    calls = fallback_tool_calls(
        ActionType.PLACE_RECOMMENDATION,
        "Gợi ý 5 khách sạn ở bán đảo Sơn Trà",
        None,
    )

    assert [call["name"] for call in calls] == ["recommend_places"]


def test_empty_recommendation_artifact_is_typed_and_display_safe():
    executor = ToolExecutor(settings, "short-lived-test-token")
    artifact = executor._place_artifact(
        [],
        provenance={
            "source": "REAL",
            "provider": "recommendation-service",
            "returnedCount": 0,
            "rankingStatus": "UNRANKED",
        },
    )

    assert artifact["type"] == "PLACE_LIST"
    assert artifact["data"]["places"] == []
    assert artifact["provenance"][0]["provider"] == "recommendation-service"


def test_hotel_followup_uses_hotel_category_and_latest_named_area():
    text = (
        "Gợi ý 5 khách sạn ở bán đảo Sơn Trà, Đà Nẵng, trong bán kính 5 km. "
        "vậy khách sanj gần thanh khê đi"
    )
    travel_goal = RecommendationGoalNormalizer().fallback_travel_goal(text, {"destination": "Đà Nẵng"})
    goal = travel_goal_to_recommendation_goal(travel_goal)

    assert "HOTEL" in goal.subjectTypes
    assert goal.searchArea["name"] == "Thanh Khê, Đà Nẵng"


def test_raw_search_cannot_replace_authoritative_empty_recommendation_artifact():
    assert should_publish_place_artifact("recommend_places", "PLACE_LIST", False) is True
    assert should_publish_place_artifact("recommend_places", "PLACE_LIST", True) is True
    assert should_publish_place_artifact("search_places", "PLACE_LIST", False) is True
    assert should_publish_place_artifact("search_places", "PLACE_LIST", True) is False
    assert should_publish_place_artifact("get_place_details", "PLACE_CARD", True) is True


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
