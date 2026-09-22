import asyncio
import os
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

os.environ.setdefault("AI_DATABASE_URL", "sqlite:///./test_ai_phase3.db")
os.environ.setdefault("JWT_ACCESS_SECRET", "test-secret-with-sufficient-length")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ["EUREKA_SERVER"] = ""

import jwt
import pytest
from fastapi.testclient import TestClient
from app.main import app, classify_action, is_contextual_followup, is_plan_addition, is_plan_revision
from app.models import ActionType
from app.model_adapter import ModelAdapter
from app.planning import ConstraintExtractor, ItineraryPlanner
from app.main import detail_candidates_for_plan
from app.tools import ToolExecutor, ToolResult
from app.photo_evidence import approved_place_photo


PLACES = [
    {"id": f"place-{index}", "name": f"Place {index}", "address": f"Address {index}", "categories": ["attraction"]}
    for index in range(1, 8)
]


def test_follow_up_adds_only_grounded_place_and_keeps_previous_days():
    assert classify_action("quán nào trong lịch trình đang mở?") == ActionType.GENERAL_CHAT
    assert classify_action("Bánh Mì Phượng có ngon không?") == ActionType.GENERAL_CHAT
    assert is_plan_addition("thêm Bánh mì Phượng nữa")
    assert not is_plan_addition("Bánh mì Phượng ngon không?")
    planner = ItineraryPlanner()
    previous = planner.preview("Plan a 2 day trip in Hoi An", [{"tool": "search_places", "data": PLACES}])
    grounded = [{"tool": "search_places", "data": [{"id": "bakery-1", "name": "Bánh mì Phượng",
                 "location": {"lat": 15.88, "lng": 108.33}}]}]
    generated = planner.preview("thêm Bánh mì Phượng nữa", grounded,
                                base_constraints=previous["constraints"])
    updated = planner.add_to_preview(previous, generated, grounded, "thêm Bánh mì Phượng nữa")
    assert len(updated["days"]) == len(previous["days"])
    assert all(item in updated["days"][1]["items"] for item in previous["days"][1]["items"])
    assert any(item["canonicalPlaceId"] == "bakery-1" for item in updated["days"][0]["items"])
    assert updated["committable"] is False
    assert all(item["canonicalPlaceId"] != "bakery-1" for day in previous["days"] for item in day["items"])
    missing = planner.add_to_preview(previous, generated, [], "thêm Bánh mì Phượng nữa")
    assert missing["validForPreview"] is False
    assert missing["days"] == previous["days"]


def test_follow_up_generic_specialty_addition_updates_preview():
    request = "thêm các đặc sản khác nữa kiếm đi"
    assert is_plan_addition(request)
    assert is_plan_revision(request)
    planner = ItineraryPlanner()
    previous = planner.preview("Plan a 1 day trip in Hoi An", [{"tool": "search_places", "data": PLACES[:3]}])
    grounded = [{"tool": "search_places", "data": [
        {"id": "specialty-1", "name": "Quán Cao Lầu Bá Lễ", "location": {"lat": 15.881, "lng": 108.332}},
        {"id": "specialty-2", "name": "Bánh đập Hến xào", "location": {"lat": 15.871, "lng": 108.333}},
    ]}]
    generated = planner.preview(request, grounded, base_constraints=previous["constraints"])
    updated = planner.add_to_preview(previous, generated, grounded, request)
    assert updated["validForPreview"] is True
    day_items = updated["days"][0]["items"]
    assert any(item["canonicalPlaceId"] == "specialty-1" for item in day_items)


def test_follow_up_revision_uses_previous_places_and_validates_changed_schedule():
    assert is_plan_revision("bỏ Place 2")
    assert is_plan_revision("dời Place 1 sang ngày 2")
    assert is_plan_revision("cho lịch trình thư thả hơn")
    assert not is_plan_revision("Place 1 có mở cửa không?")
    assert is_contextual_followup("Tôi thích ăn chay và đi chậm")
    assert is_contextual_followup("Không thích khách sạn đông người")
    assert not is_contextual_followup("Place 1 có mở cửa không?")
    assert not is_contextual_followup("cảm ơn")
    planner = ItineraryPlanner()
    previous = planner.preview("Plan a 2 day trip in Hoi An", [{"tool": "search_places", "data": PLACES}])
    context = planner.draft_context("bỏ Place 2", [], previous_preview=previous,
                                    base_constraints=previous["constraints"])
    assert context["existingDays"] == previous["days"]
    assert {item["id"] for item in context["places"]} >= {"place-1", "place-2"}
    draft = {"days": [{"dayNumber": day["dayNumber"], "items": [
        {"canonicalPlaceId": item["canonicalPlaceId"], "startTime": item["startTime"],
         "endTime": item["endTime"]} for item in day["items"] if item["canonicalPlaceId"] != "place-2"]}
        for day in previous["days"]]}
    generated = planner.preview("bỏ Place 2", [], draft=draft,
                                base_constraints=previous["constraints"], previous_preview=previous)
    revised = planner.revise_preview(previous, generated, [], "bỏ Place 2")
    assert revised["days"] != previous["days"]
    assert not any(item["canonicalPlaceId"] == "place-2" for day in revised["days"] for item in day["items"])
    assert revised["committable"] is False
    unchanged = planner.revise_preview(previous, generated, [], "bỏ Place 2", draft_failed=True)
    assert unchanged["validForPreview"] is False
    assert unchanged["days"] == previous["days"]


def test_budget_label_and_review_grounding_are_explicit():
    assert classify_action("Đi Đà Nẵng 3N2Đ budget 3tr") == ActionType.PLAN_ITINERARY
    constraints = ConstraintExtractor().extract("Plan Da Nang for 3 days, budget 3.000.000 VND")
    assert constraints.dayCount == 3
    assert constraints.hardBudgetAmount == 3_000_000
    short = ConstraintExtractor().extract("Đi Đà Nẵng 3N2Đ budget 3tr")
    assert short.destination == "Đà Nẵng"
    assert short.dayCount == 3
    assert short.hardBudgetAmount == 3_000_000
    assert short.budgetCurrency == "VND"

    grounded = [{"tool": "search_places", "data": [
        {"id": "canonical-1", "name": "Real cafe", "location": {"lat": 16.06, "lng": 108.22},
         "rating": 4.7, "userRatingCount": 128, "provider": "ziomap", "fetchedAt": "2026-09-19T00:00:00Z"},
        {"id": "missing-coordinates", "name": "Unknown location", "rating": 5.0, "userRatingCount": 1},
    ]}]
    assert detail_candidates_for_plan(grounded) == ["canonical-1"]
    preview = ItineraryPlanner().preview("Plan a 1 day trip in Da Nang", grounded)
    item = preview["days"][0]["items"][0]
    assert item["location"] == {"lat": 16.06, "lng": 108.22}
    assert item["ratingSummary"]["count"] == 128
    assert item["cost"] == {"kind": "UNKNOWN"}


def test_ai_place_artifact_does_not_expose_unlicensed_review_or_photo_payload():
    executor = ToolExecutor.__new__(ToolExecutor)
    artifact = executor._place_artifact([{
        "id": "canonical-1", "name": "Real cafe", "rating": 4.7,
        "userRatingCount": 128, "reviews": [{"authorName": "Private name", "text": "Raw review"}],
        "photos": ["https://provider.example/photo"],
    }], provenance={"source": "REAL", "provider": "place-service"})
    place = artifact["data"]["places"][0]
    assert place["id"] == "canonical-1"
    assert place["rating"] == 4.7
    assert "reviews" not in place
    assert "photos" not in place


def test_only_approved_attributed_photo_reaches_ai_artifact_and_itinerary():
    photo = {"url": "https://lh3.googleusercontent.com/photo-1", "source": "ziomap",
             "attribution": [{"displayName": "Photo author", "uri": "https://example.com/author"}],
             "fetchedAt": "2026-09-19T00:00:00Z", "displayApproved": True}
    assert approved_place_photo({**photo, "displayApproved": False}) is None
    assert approved_place_photo({**photo, "url": "https://example.com/photo?key=secret"}) is None
    grounded = [{"tool": "get_place_details", "data": {
        "id": "canonical-1", "name": "Real cafe", "primaryPhoto": photo,
        "location": {"lat": 16.06, "lng": 108.22}}}]
    artifact = ToolExecutor.__new__(ToolExecutor)._place_artifact([grounded[0]["data"]])
    assert artifact["data"]["places"][0]["primaryPhoto"]["attribution"][0]["displayName"] == "Photo author"
    preview = ItineraryPlanner().preview("Plan a 1 day trip in Da Nang", grounded)
    assert preview["days"][0]["items"][0]["primaryPhoto"]["url"] == photo["url"]


def place_grounding():
    return [{
        "tool": "search_places",
        "data": PLACES,
        "provenance": {"source": "REAL", "provider": "place-service", "freshness": "FRESH"},
    }]


def test_extracts_structured_multilingual_constraints():
    constraints = ConstraintExtractor().extract(
        "Lập lịch trình ở Đà Nẵng trong 3 ngày, thư giãn, không quá 5000000 VND, tránh bar"
    )
    assert constraints.destination == "Đà Nẵng"
    assert constraints.dayCount == 3
    assert constraints.pace == "RELAXED"
    assert constraints.hardBudgetAmount == 5_000_000
    assert constraints.excludedTerms == ["bar"]


def test_grounded_preview_is_schema_valid_and_mocks_are_labeled():
    planner = ItineraryPlanner()
    preview = planner.preview("Plan a 2 days trip in Da Nang", place_grounding())
    artifact = planner.artifact(preview, [place_grounding()[0]["provenance"]])
    ids = [item["canonicalPlaceId"] for day in preview["days"] for item in day["items"]]
    assert preview["validForPreview"] is True
    assert preview["committable"] is False
    assert len(preview["days"]) == 2
    assert len(ids) == len(set(ids))
    assert all(day["weather"]["isIllustrative"] for day in preview["days"])
    assert {entry["source"] for entry in artifact["provenance"]} == {"REAL", "MOCK"}


def test_hard_budget_is_blocked_without_price_coverage():
    preview = ItineraryPlanner().preview("Plan 2 days in Hue under 200 USD", place_grounding())
    assert preview["validForPreview"] is False
    assert "BUDGET_COVERAGE_INCOMPLETE" in {issue["code"] for issue in preview["issues"]}


def test_unsupported_duration_is_detected_instead_of_silently_truncated():
    preview = ItineraryPlanner().preview("Plan a 12 days trip in Hue", place_grounding())
    assert preview["validForPreview"] is False
    assert "DURATION_LIMIT_EXCEEDED" in {issue["code"] for issue in preview["issues"]}


def test_places_are_reserved_so_each_supported_day_has_an_activity():
    preview = ItineraryPlanner().preview("Plan a 7 days trip in Hue", place_grounding())
    assert preview["validForPreview"] is True
    assert all(day["items"] for day in preview["days"])


def test_invalid_date_and_unconfigured_real_provider_fail_safely():
    preview = ItineraryPlanner().preview("Plan 2 days in Hue from 2026-99-99", place_grounding())
    assert "INVALID_START_DATE" in {issue["code"] for issue in preview["issues"]}
    with pytest.raises(ValueError, match="approved Phase 3 mock"):
        ItineraryPlanner(weather_provider="real")


def test_model_draft_cannot_use_noncanonical_places_or_invalid_times():
    draft = {"days": [{"dayNumber": 1, "items": [
        {"canonicalPlaceId": "invented-place", "startTime": "later", "endTime": "never"}
    ]}]}
    preview = ItineraryPlanner().preview("Plan 1 day in Hue", place_grounding(), draft=draft)
    codes = {issue["code"] for issue in preview["issues"]}
    assert preview["validForPreview"] is False
    assert {"CANONICAL_PLACE_ID_REQUIRED", "INVALID_ITEM_TIME"}.issubset(codes)


def test_model_draft_gets_exactly_one_bounded_repair_attempt():
    class FakeCompletions:
        def __init__(self):
            self.calls = 0

        async def create(self, **_):
            self.calls += 1
            content = "not-json" if self.calls == 1 else '{"days": []}'
            return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])

    completions = FakeCompletions()
    adapter = object.__new__(ModelAdapter)
    adapter.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
    adapter.settings = SimpleNamespace(ai_model="test", max_output_tokens=1200)
    assert asyncio.run(adapter.draft_itinerary({"constraints": {}, "places": []})) == {"days": []}
    assert completions.calls == 2


def test_partial_replanning_preserves_unselected_days_byte_for_byte():
    existing = {
        "tripId": "6a2cbb2b-ef60-44bb-a9cc-e196f9643469",
        "days": [
            {"dayNumber": 1, "date": "2026-10-01", "items": [{"id": "old-1", "title": "Keep one"}]},
            {"dayNumber": 2, "date": "2026-10-02", "items": [{"id": "old-2", "title": "Replace two"}]},
            {"dayNumber": 3, "date": "2026-10-03", "items": [{"id": "old-3", "title": "Keep three"}]},
        ],
    }
    grounding = place_grounding() + [
        {"tool": "get_trip", "data": {"destinationName": "Hue", "startDate": "2026-10-01", "endDate": "2026-10-03"}},
        {"tool": "get_itinerary", "data": existing},
    ]
    before = deepcopy(existing)
    preview = ItineraryPlanner().preview("Refine day 2 for trip 6a2cbb2b-ef60-44bb-a9cc-e196f9643469", grounding)
    assert preview["scope"] == "SELECTED_DAYS"
    assert preview["preservedDayNumbers"] == [1, 3]
    assert preview["days"][0] == before["days"][0]
    assert preview["days"][2] == before["days"][2]
    assert preview["days"][1] != before["days"][1]
    assert existing == before


class FakePlanningAdapter:
    def __init__(self, _):
        pass

    async def select_tools(self, _, max_tool_calls=None):
        return [{"id": "phase3-search", "name": "search_places", "arguments": {"query": "Da Nang", "limit": 7}}]

    async def draft_itinerary(self, _):
        return {"days": [
            {"dayNumber": 1, "items": [{"canonicalPlaceId": "place-1", "startTime": "09:00", "endTime": "10:30"}]},
            {"dayNumber": 2, "items": [{"canonicalPlaceId": "place-2", "startTime": "09:00", "endTime": "10:30"}]},
        ]}

    async def stream(self, messages, max_output_tokens=None):
        assert any("ITINERARY_PREVIEW_JSON" in str(message.get("content")) for message in messages)
        yield "Here is a grounded preview."


class FakePlanningTools:
    def __init__(self, *_):
        pass

    async def execute(self, name, _):
        provenance = {"source": "REAL", "provider": "place-service", "fetchedAt": "2026-09-18T00:00:00Z", "freshness": "FRESH"}
        return ToolResult(name=name, data=PLACES, provenance=provenance,
                          artifact={"schemaVersion": 1, "type": "PLACE_LIST", "version": 1,
                                    "data": {"places": PLACES}, "provenance": [provenance]}, duration_ms=4)


def access_token() -> str:
    return jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                       "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                      os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")


def test_planning_run_persists_preview_artifact(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakePlanningAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakePlanningTools)
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        accepted = client.post(f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"phase3-{uuid.uuid4()}"},
            json={"content": "Plan a 2 days itinerary in Da Nang", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"})
        assert accepted.status_code == 202
        messages = client.get(f"/api/ai/v1/conversations/{conversation['id']}/messages", headers=headers).json()["items"]
        preview = next(artifact for artifact in messages[-1]["artifacts"] if artifact["type"] == "ITINERARY_PREVIEW")
        assert preview["data"]["validForPreview"] is True
        assert preview["data"]["committable"] is False
        assert {item["source"] for item in preview["provenance"]} == {"REAL", "MOCK"}


def test_itinerary_planning_vietnamese_query_grounds_places_and_coordinates(monkeypatch):
    class FakeHoiAnAdapter(FakePlanningAdapter):
        async def draft_itinerary(self, _):
            return {"days": [
                {"dayNumber": 1, "items": [
                    {"canonicalPlaceId": "hoian-1", "startTime": "09:00", "endTime": "10:30"},
                    {"canonicalPlaceId": "hoian-2", "startTime": "11:00", "endTime": "12:30"},
                ]},
            ]}

    class FakeHoiAnTools:
        def __init__(self, *_):
            pass

        async def execute(self, name, args):
            provenance = {"source": "REAL", "provider": "place-service", "fetchedAt": "2026-09-20T00:00:00Z", "freshness": "FRESH"}
            places_with_coords = [
                {"id": "hoian-1", "name": "Chùa Cầu", "address": "Nguyễn Thị Minh Khai, Hội An",
                 "location": {"lat": 15.877, "lng": 108.326}, "rating": 4.6, "userRatingCount": 500,
                 "primaryPhoto": {"url": "https://example.com/chuacau.jpg", "source": "ziomap", "displayApproved": True}},
                {"id": "hoian-2", "name": "Bánh mì Phượng", "address": "2B Phan Chu Trinh, Hội An",
                 "location": {"lat": 15.879, "lng": 108.333}, "rating": 4.5, "userRatingCount": 1200},
                {"id": "hoian-3", "name": "Chợ đêm Hội An", "address": "Nguyễn Hoàng, Hội An",
                 "location": {"lat": 15.876, "lng": 108.325}, "rating": 4.4, "userRatingCount": 350},
            ]
            return ToolResult(name=name, data=places_with_coords, provenance=provenance,
                              artifact={"schemaVersion": 1, "type": "PLACE_LIST", "version": 1,
                                        "data": {"places": places_with_coords}, "provenance": [provenance]},
                              duration_ms=5)

    monkeypatch.setattr("app.main.ModelAdapter", FakeHoiAnAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakeHoiAnTools)
    headers = {"Authorization": f"Bearer {access_token()}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        accepted = client.post(f"/api/ai/v1/conversations/{conversation['id']}/messages",
            headers={**headers, "Idempotency-Key": f"hoian-{uuid.uuid4()}"},
            json={"content": "Lên lịch trình 1 ngày ở Hội An", "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"})
        assert accepted.status_code == 202
        messages = client.get(f"/api/ai/v1/conversations/{conversation['id']}/messages", headers=headers).json()["items"]
        preview = next(artifact for artifact in messages[-1]["artifacts"] if artifact["type"] == "ITINERARY_PREVIEW")
        assert preview["data"]["validForPreview"] is True
        days = preview["data"]["days"]
        assert len(days) == 1
        day_items = days[0]["items"]
        assert len(day_items) >= 2
        for item in day_items:
            assert item["canonicalPlaceId"]
            assert item["title"]
            assert item.get("location") is not None
            assert item["location"]["lat"] > 0
            assert item["location"]["lng"] > 0
        # Verify assistant message has grounded itinerary preview content
        assert "grounded preview" in messages[-1]["content"].lower()
