import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest

os.environ.setdefault("AI_DATABASE_URL", "sqlite:///./test_ai_increment_a.db")
os.environ.setdefault("JWT_ACCESS_SECRET", "test-secret-with-sufficient-length")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ["EUREKA_SERVER"] = ""

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.execution import ExecutionProfile, budget_for_action
from app.main import (SessionLocal, acquire_conversation_lease, app, release_conversation_lease,
                      settings)
from app.models import ActionType, ModelCall, Run, RunEvent
from app.recommendation import RecommendationGoalNormalizer
from app.recommendation.goal_normalizer import travel_goal_to_recommendation_goal
from app.retrieval import RetrievalSufficiencyPolicy
from app.context import ContextResolver


def access_token() -> str:
    return jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                       "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                      os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")


def test_recommendation_goal_normalizes_supported_and_unsupported_features():
    normalizer = RecommendationGoalNormalizer()
    work = normalizer.normalize("quiet café for working in Da Nang")
    assert work.subjectTypes == ["CAFE"]
    assert {item.feature for item in work.softPreferences} == {"QUIETNESS", "WORK_SUITABILITY"}
    assert work.searchArea["anchorType"] == "NAMED_AREA"

    cheap = normalizer.normalize("restaurant under 200k")
    assert cheap.hardConstraints[0].feature == "PRICE_AMOUNT"
    assert cheap.hardConstraints[0].typedValue == 200_000
    assert "NORMALIZED_PRICE" in {item.requiredCapability for item in cheap.unsupportedRequirements}

    late = normalizer.normalize("café open after 23:00")
    assert late.requestedTime["localTime"] == "23:00"
    assert any(item.feature == "OPEN_AT" for item in late.hardConstraints)


def test_vietnamese_cafe_request_preserves_category_count_area_radius_and_preferences():
    prompt = "Gợi ý địa điểm: tìm 5 quán cà phê yên tĩnh ở bán đảo Sơn Trà, Đà Nẵng, trong bán kính 5 km, ưu tiên gần và đánh giá tốt."
    normalizer = RecommendationGoalNormalizer()
    travel_goal = normalizer.fallback_travel_goal(prompt, {"destination": "Đà Nẵng"})
    goal = travel_goal_to_recommendation_goal(travel_goal)

    assert goal.subjectTypes == ["CAFE"]
    assert goal.requestedResultCount == 5
    assert goal.searchArea["name"] == "Sơn Trà, Đà Nẵng"
    assert goal.searchArea["radiusMeters"] == 5_000
    assert goal.searchArea["lat"] == pytest.approx(16.1068)
    assert goal.rankingObjectives[:2] == ["PROXIMITY", "QUALITY"]
    assert {item.feature for item in goal.softPreferences} == {"QUIETNESS"}


def test_vegetarian_restaurant_is_a_specific_typed_subject():
    prompt = "Gợi ý 10 nhà hàng chay ở Liên Chiểu, Đà Nẵng"
    normalizer = RecommendationGoalNormalizer()
    direct_goal = normalizer.normalize(prompt)
    travel_goal = normalizer.fallback_travel_goal(prompt, {"destination": "Đà Nẵng"})
    converted_goal = travel_goal_to_recommendation_goal(travel_goal)

    assert direct_goal.subjectTypes == ["VEGETARIAN_RESTAURANT"]
    assert converted_goal.subjectTypes == ["VEGETARIAN_RESTAURANT"]
    assert converted_goal.searchArea["district"] == "Liên Chiểu"
    assert converted_goal.requestedResultCount == 10


def test_near_hotel_requires_owned_anchor_instead_of_inventing_coordinates():
    normalizer = RecommendationGoalNormalizer()
    missing = normalizer.normalize("romantic café near my hotel")
    assert "HOTEL_ANCHOR" in {item.requiredCapability for item in missing.unsupportedRequirements}
    resolved = normalizer.normalize("romantic café near my hotel", {"hotelPlaceId": "hotel-1"})
    assert resolved.searchArea == {"anchorType": "PLACE", "anchorPlaceId": "hotel-1"}


def test_retrieval_sufficiency_does_not_invent_mandatory_fields():
    goal = RecommendationGoalNormalizer().normalize("restaurant under 200k in Da Nang")
    candidates = [{"id": f"p-{index}", "location": {"lat": 16.0, "lng": 108.0}} for index in range(5)]
    assessment = RetrievalSufficiencyPolicy().assess(goal, candidates, refresh_available=True)
    assert assessment.status == "REFRESHABLE"
    assert "MANDATORY_FIELD_MISSING:PRICE_AMOUNT" in assessment.reasonCodes
    assert assessment.eligibleCount == 0

    soft_goal = RecommendationGoalNormalizer().normalize("romantic café in Da Nang")
    soft_assessment = RetrievalSufficiencyPolicy().assess(soft_goal, candidates, refresh_available=False)
    assert soft_assessment.status == "INSUFFICIENT"
    assert "OBJECTIVE_EVIDENCE_MISSING:AMBIENCE_ROMANTIC" in soft_assessment.reasonCodes


def test_execution_profiles_have_hard_bounded_limits():
    direct = budget_for_action(ActionType.GENERAL_CHAT)
    recommendation = budget_for_action(ActionType.PLACE_RECOMMENDATION)
    planning = budget_for_action(ActionType.PLAN_ITINERARY)
    assert direct.profile == ExecutionProfile.L0_DIRECT and direct.tool_calls == 0
    assert recommendation.external_refresh_rounds == 1 and recommendation.repair_attempts == 1
    assert planning.tool_calls == 8 and planning.wall_seconds == 80


def test_pending_location_does_not_accept_a_party_size_as_a_place():
    assert ContextResolver._valid_location_answer("4 people") is False
    assert ContextResolver._valid_location_answer("4 người") is False
    assert ContextResolver._valid_location_answer("Hội An") is True


def test_missing_location_produces_durable_clarification_without_model_call():
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        accepted = client.post(
            f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"clarify-{uuid.uuid4()}"},
            json={"content": "quiet café for working", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"},
        )
        assert accepted.status_code == 202
        run_id = accepted.json()["runId"]
        run = client.get(f"/api/ai/v1/runs/{run_id}", headers=headers).json()
        assert run["status"] == "COMPLETED"
        assert run["executionProfile"] == "L3_RECOMMEND"
        assert run["contextSufficiency"] == "NEEDS_CLARIFICATION"
        assert run["terminationReason"] == "CONTEXT_INSUFFICIENT"
        messages = client.get(f"/api/ai/v1/conversations/{conversation['id']}/messages", headers=headers).json()["items"]
        assert any(fragment in messages[-1]["content"] for fragment in ("area or city", "khu vực hoặc thành phố"))
        with SessionLocal() as db:
            events = db.scalars(select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.sequence)).all()
            assert [event.sequence for event in events] == list(range(1, len(events) + 1))
            assert events[-1].event_type == "run.completed"
        replay = client.get(f"/api/ai/v1/runs/{run_id}/stream?afterSequence=1", headers=headers)
        assert replay.status_code == 200
        assert "id: 1\n" not in replay.text
        assert "event: run.completed" in replay.text


def test_location_answer_continues_the_pending_place_recommendation(monkeypatch):
    class FakeAdapter:
        def __init__(self, _): pass
        async def select_tools(self, _, max_tool_calls=None): return []
        async def stream(self, _, max_output_tokens=None): yield "Không tìm thấy kết quả phù hợp."

    class NoResultTools:
        def __init__(self, *_): pass
        async def execute(self, name, arguments):
            from app.tools import ToolResult
            return ToolResult(name=name, data=[], provenance={"source": "UNKNOWN"}, artifact=None, duration_ms=1)

    monkeypatch.setattr("app.main.ModelAdapter", FakeAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", NoResultTools)
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        first = client.post(
            f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"pending-{uuid.uuid4()}"},
            json={"content": "gợi ý 5 quán cà phê yên tĩnh", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"},
        ).json()
        assert client.get(f"/api/ai/v1/runs/{first['runId']}", headers=headers).json()["contextSufficiency"] == "NEEDS_CLARIFICATION"

        second = client.post(
            f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"answer-{uuid.uuid4()}"},
            json={"content": "Sơn Trà, Đà Nẵng", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"},
        ).json()
        run = client.get(f"/api/ai/v1/runs/{second['runId']}", headers=headers).json()
        assert run["actionType"] == "PLACE_RECOMMENDATION"
        assert run["contextSufficiency"] == "SUFFICIENT"
        with SessionLocal() as db:
            stored = db.get(Run, second["runId"])
            assert stored.goal_json["subjectTypes"] == ["CAFE"]
            assert stored.goal_json["requestedResultCount"] == 5


def test_explicit_coordinates_make_context_sufficient(monkeypatch):
    class FakeAdapter:
        def __init__(self, _): pass
        async def select_tools(self, _, max_tool_calls=None): return []
        async def stream(self, _, max_output_tokens=None): yield "Grounded response"

    class NoResultTools:
        def __init__(self, *_): pass
        async def execute(self, name, arguments):
            from app.tools import ToolResult
            return ToolResult(name=name, data=[], provenance={"source": "UNKNOWN"}, artifact=None, duration_ms=1)

    monkeypatch.setattr("app.main.ModelAdapter", FakeAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", NoResultTools)
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        accepted = client.post(
            f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"coords-{uuid.uuid4()}"},
            json={"content": "quiet café for working", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL",
                  "context": {"lat": 16.05, "lng": 108.2}},
        ).json()
        run = client.get(f"/api/ai/v1/runs/{accepted['runId']}", headers=headers).json()
        assert run["contextSufficiency"] == "SUFFICIENT"
        assert run["retrievalSufficiency"] == "INSUFFICIENT"
        assert run["counters"]["toolCalls"] <= settings.max_tool_calls_per_run
        with SessionLocal() as db:
            model_call = db.scalar(select(ModelCall).where(ModelCall.run_id == accepted["runId"]))
            assert model_call.status == "COMPLETED"
            assert model_call.usage_source == "ESTIMATED"


def test_message_context_rejects_unapproved_fields():
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        response = client.post(
            f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"invalid-context-{uuid.uuid4()}"},
            json={"content": "hello", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL",
                  "context": {"ownerUserId": str(uuid.uuid4())}},
        )
        assert response.status_code == 422


def test_database_conversation_lease_blocks_a_second_worker():
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        first = asyncio.run(acquire_conversation_lease(conversation["id"], "run-a", 1))
        assert first is not None
        second = asyncio.run(acquire_conversation_lease(conversation["id"], "run-b", 0.05))
        assert second is None
        release_conversation_lease(conversation["id"], first)
