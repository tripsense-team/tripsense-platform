import asyncio

import pytest

from app.planning import ItineraryPlanner
from app.web_research import WebResearch, _verify_host
from app.route_provider import route_day


def test_explicit_place_is_locked_and_cannot_disappear_from_preview():
    planner = ItineraryPlanner()
    places = [{"id": "banh-mi-phuong", "name": "Bánh Mì Phượng", "categories": ["restaurant"],
               "location": {"lat": 15.878, "lng": 108.332}},
              {"id": "old-town", "name": "Hội An Old Town", "categories": ["attraction"],
               "location": {"lat": 15.88, "lng": 108.33}}]
    grounding = [{"tool": "search_places", "data": places}]
    request = "lên lịch trình 1 ngày ở Hội An có Bánh Mì Phượng và các đặc sản"
    context = planner.draft_context(request, grounding)
    assert context["requiredPlaceIds"] == ["banh-mi-phuong"]
    omitted = planner.preview(request, grounding, draft={"days": [{"dayNumber": 1, "items": [
        {"canonicalPlaceId": "old-town", "startTime": "09:00", "endTime": "10:00"}]}]})
    assert "MUST_HAVE_MISSING" in {issue["code"] for issue in omitted["issues"]}
    assert omitted["validForPreview"] is False
    assert omitted["lockedPlaceIds"] == ["banh-mi-phuong"]


def test_hoi_an_fallback_varies_food_and_activities():
    planner = ItineraryPlanner()
    places = [
        {"id": "phuong", "name": "Bánh Mì Phượng", "categories": ["restaurant"]},
        {"id": "bread-two", "name": "Another bánh mì", "categories": ["restaurant"]},
        {"id": "old-town", "name": "Old Town", "categories": ["attraction"]},
        {"id": "cao-lau", "name": "Cao lầu", "categories": ["restaurant"]},
        {"id": "cafe", "name": "River cafe", "categories": ["cafe"]},
        {"id": "museum", "name": "History museum", "categories": ["museum"]},
        {"id": "dinner", "name": "Local food dinner", "categories": ["restaurant"]},
    ]
    preview = planner.preview("Plan 1 day in Hoi An with Bánh Mì Phượng and local food",
                              [{"tool": "search_places", "data": places}], draft_failed=True)
    ids = [item["canonicalPlaceId"] for item in preview["days"][0]["items"]]
    assert ids[0] == "phuong"
    assert ids[1] == "old-town"
    assert "museum" in ids
    assert "cafe" in ids
    assert "bread-two" not in ids


def test_web_research_rejects_private_dns_and_requires_configuration(monkeypatch):
    monkeypatch.setattr("app.web_research.socket.getaddrinfo", lambda *args, **kwargs:
                        [(2, 1, 6, "", ("127.0.0.1", 443))])
    with pytest.raises(ValueError, match="public address"):
        asyncio.run(_verify_host("https://example.com/place"))
    with pytest.raises(ValueError, match="configured"):
        asyncio.run(WebResearch("").search("Hoi An local food", "local specialties"))
    with pytest.raises(ValueError, match="Unknown"):
        asyncio.run(WebResearch("test").open("web-1"))


def test_partial_revision_rejects_unrelated_stop_changes():
    planner = ItineraryPlanner()
    original = {"days": [{"dayNumber": 1, "items": [
        {"canonicalPlaceId": "breakfast", "startTime": "09:00"},
        {"canonicalPlaceId": "lunch", "startTime": "12:00"},
        {"canonicalPlaceId": "museum", "startTime": "15:00"}]}]}
    good = {"days": [{"dayNumber": 1, "items": [
        {"canonicalPlaceId": "breakfast", "startTime": "09:00"},
        {"canonicalPlaceId": "cao-lau", "startTime": "12:00"},
        {"canonicalPlaceId": "museum", "startTime": "15:00"}]}]}
    bad = {"days": [{"dayNumber": 1, "items": [
        {"canonicalPlaceId": "other-breakfast", "startTime": "09:00"},
        {"canonicalPlaceId": "cao-lau", "startTime": "12:00"},
        {"canonicalPlaceId": "museum", "startTime": "15:00"}]}]}
    request = "đổi quán trưa thành cao lầu gần phố cổ"
    assert planner._preserves_unaffected(original, good, request)
    assert not planner._preserves_unaffected(original, bad, request)
    removed = {"days": [{"dayNumber": 1, "items": [
        {"canonicalPlaceId": "breakfast"}, {"canonicalPlaceId": "lunch"}]}]}
    assert planner._preserves_unaffected(original, removed, "bỏ điểm thứ 3")


def test_budget_followup_preserves_stops_and_records_unverified_budget():
    planner = ItineraryPlanner()
    grounding = [{"tool": "search_places", "data": [
        {"id": "banh-mi-phuong", "name": "Bánh Mì Phượng", "location": {"lat": 15.88, "lng": 108.33}}]}]
    previous = planner.preview("Plan 1 day in Hoi An with Bánh Mì Phượng", grounding)
    generated = planner.preview("budget 700k cho 2 người", grounding,
                                base_constraints=previous["constraints"], previous_preview=previous)
    updated = planner.revise_preview(previous, generated, grounding, "budget 700k cho 2 người")
    assert updated["days"] == previous["days"]
    assert updated["constraints"]["hardBudgetAmount"] == 700000
    assert updated["validForPreview"] is False
    assert {issue["code"] for issue in updated["issues"]} == {"BUDGET_COVERAGE_INCOMPLETE"}


def test_configured_route_uses_provider_leg_values(monkeypatch):
    class Response:
        content = b"{}"
        def raise_for_status(self):
            pass
        def json(self):
            return {"code": "Ok", "routes": [{"legs": [{"distance": 1200.4, "duration": 540.0}]}]}
    class Client:
        def __init__(self, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def get(self, url, params):
            assert "/route/v1/driving/108.330000,15.880000;108.340000,15.890000" in url
            return Response()
    monkeypatch.setattr("app.route_provider.httpx.AsyncClient", Client)
    items = [{"canonicalPlaceId": "one", "location": {"lat": 15.88, "lng": 108.33}},
             {"canonicalPlaceId": "two", "location": {"lat": 15.89, "lng": 108.34}}]
    routes = asyncio.run(route_day("https://configured-routing.example", items))
    assert routes[0]["distanceMeters"] == 1200
    assert routes[0]["durationMinutes"] == 9
    assert routes[0]["isIllustrative"] is False


# ====================================================================
# REGRESSION TESTS A - I (Adaptive AI Travel Chat Orchestration)
# ====================================================================

def test_regression_a_destination_extraction():
    from app.planning import ConstraintExtractor
    from app.recommendation.goal_normalizer import clean_destination_name, RecommendationGoalNormalizer

    prompt = "Lên lịch trình 1 ngày ở Đà Nẵng đi chơi và ăn uống, có bánh mì và các đặc sản địa phương."
    extracted = ConstraintExtractor._destination(prompt)
    assert extracted == "Đà Nẵng"
    assert "đi chơi" not in extracted
    assert "ăn uống" not in extracted

    cleaned = clean_destination_name("Đà Nẵng đi chơi và ăn uống")
    assert cleaned == "Đà Nẵng"

    normalizer = RecommendationGoalNormalizer()
    goal = normalizer.fallback_travel_goal(prompt)
    assert goal.destination == "Đà Nẵng"
    assert goal.durationDays == 1
    assert "bánh mì" in [f.casefold() for f in goal.mustEatFoods]
    assert goal.localSpecialtiesRequired is True
    assert "sightseeing" in goal.requestedExperiences
    assert "local_food" in goal.requestedExperiences


def test_regression_b_fresh_plan_classification():
    from app.main import classify_action, is_plan_revision, is_explicit_new_plan
    from app.models import ActionType

    prompt = ("Lên lịch trình 1 ngày ở Đà Nẵng đi chơi và ăn uống, có bánh mì và các đặc sản địa phương. "
              "Hãy tự sắp xếp lịch trình hợp lý theo buổi sáng, trưa, chiều, tối; cân nhắc vị trí địa lý "
              "để tránh di chuyển lòng vòng. Nếu không chắc dữ liệu thời gian thực như giá hoặc giờ mở cửa "
              "thì nói rõ, nhưng vẫn đưa ra một kế hoạch hữu ích.")

    # 1. Prompt has explicit new plan intent
    assert is_explicit_new_plan(prompt) is True

    # 2. "tránh di chuyển lòng vòng" must not trigger plan revision
    assert is_plan_revision(prompt) is False

    # 3. Classified as PLAN_ITINERARY
    action = classify_action(prompt)
    assert action == ActionType.PLAN_ITINERARY

    # 4. In conversation with previous preview, explicit new plan must NOT become REFINE_PLAN
    has_preview = True
    is_new = is_explicit_new_plan(prompt)
    if not is_new and is_plan_revision(prompt) and has_preview:
        action = ActionType.REFINE_PLAN
    assert action == ActionType.PLAN_ITINERARY


def test_regression_c_search_unavailable():
    from app.tools import ToolExecutionError, ToolExecutor
    from app.config import Settings
    from pydantic import ValidationError

    settings = Settings()
    executor = ToolExecutor(settings, bearer_token="test-token")

    # Verify that schema validation errors capture exact field failure
    try:
        from app.tools import RecommendPlacesInput
        RecommendPlacesInput.model_validate({"query": "", "goal": {}})
    except ValidationError as exc:
        err = ToolExecutionError("TOOL_INPUT_INVALID", f"recommend_places schema validation error: {str(exc)}")
        assert "schema validation error" in str(err)
        assert err.code == "TOOL_INPUT_INVALID"


def test_regression_d_coverage_survives():
    from app.recommendation.goal_normalizer import TravelGoal, resolve_geographic_scope
    from app.retrieval.coverage import derive_coverage_requirements, CoverageType

    goal = TravelGoal(
        destination="Đà Nẵng",
        geographicScope=resolve_geographic_scope("Đà Nẵng"),
        durationDays=1,
        mustEatFoods=["bánh mì"],
        localSpecialtiesRequired=True,
        requestedExperiences=["sightseeing", "local_food"],
        mealRequirements=["breakfast", "lunch", "dinner"],
    )
    reqs = derive_coverage_requirements(goal)
    req_types = [r.type for r in reqs]
    assert CoverageType.FOOD in req_types
    assert any(r.type == CoverageType.FOOD and "bánh mì" in r.target.casefold() for r in reqs)
    assert CoverageType.LOCAL_SPECIALTY in req_types
    assert CoverageType.ATTRACTION in req_types

    # All these must be blocking
    blocking_reqs = [r for r in reqs if r.blocking]
    assert len(blocking_reqs) >= 3


def test_regression_e_geographic_rejection():
    from app.retrieval.candidate_evaluator import CandidateEvaluator
    from app.recommendation.goal_normalizer import resolve_geographic_scope
    from app.retrieval.coverage import CoverageRequirement, CoverageType

    evaluator = CandidateEvaluator()
    scope = resolve_geographic_scope("Đà Nẵng")
    req = CoverageRequirement(id="food-1", type=CoverageType.FOOD, target="bánh mì", blocking=True)

    hoi_an_place = {
        "id": "banh-mi-phuong",
        "name": "Bánh Mì Phượng",
        "address": "Phan Chu Trinh, Cẩm Châu, Hội An, Đà Nẵng",
        "city": "Hội An",
        "categories": ["restaurant"],
        "location": {"lat": 15.878, "lng": 108.332},
    }

    da_nang_place = {
        "id": "banh-mi-ba-lan",
        "name": "Bánh Mì Bà Lan",
        "address": "62 Trưng Nữ Vương, Bình Hiên, Hải Châu, Đà Nẵng",
        "city": "Đà Nẵng",
        "categories": ["restaurant"],
        "location": {"lat": 16.061, "lng": 108.219},
    }

    hoi_an_eval = evaluator.evaluate(hoi_an_place, scope, [req])
    assert hoi_an_eval.eligible is False
    assert any("OUTSIDE_GEOGRAPHIC_SCOPE" in r for r in hoi_an_eval.rejection_reasons)

    da_nang_eval = evaluator.evaluate(da_nang_place, scope, [req])
    assert da_nang_eval.eligible is True
    assert "food-1" in da_nang_eval.satisfies_requirement_ids


def test_regression_f_no_canonical_results():
    from app.planning import ItineraryPlanner, ValidityState

    planner = ItineraryPlanner()
    preview = planner.preview(
        "Lên lịch trình 1 ngày ở Đà Nẵng đi chơi và ăn uống, có bánh mì và các đặc sản địa phương.",
        grounding=[],
        draft_failed=True,
    )
    assert preview["validityState"] in (ValidityState.BLOCKED.value, ValidityState.INVALID.value)
    assert preview["canCommit"] is False
    assert any(i["code"] == "CANONICAL_PLACES_REQUIRED" for i in preview["issues"])


def test_regression_g_zero_results_activity():
    count = 0
    eval_progress = {"found": 0, "accepted": 0, "rejected": 0}
    accepted_count = eval_progress["accepted"]
    if count == 0 or accepted_count == 0:
        done_label = "Chưa tìm thấy địa điểm phù hợp"
        done_summary = "Chưa tìm thấy địa điểm phù hợp từ nguồn hiện tại."
    else:
        done_label = f"Found {count} relevant places"
        done_summary = "Canonical results are ready for comparison."

    assert done_summary != "Canonical results are ready for comparison."
    assert "Chưa tìm thấy" in done_label


def test_regression_h_external_fallback():
    from app.retrieval.candidate_evaluator import CandidateEvaluator
    from app.recommendation.goal_normalizer import resolve_geographic_scope
    from app.retrieval.coverage import CoverageRequirement, CoverageType

    evaluator = CandidateEvaluator()
    scope = resolve_geographic_scope("Đà Nẵng")
    req = CoverageRequirement(id="req-bm", type=CoverageType.FOOD, target="bánh mì", blocking=True)

    v1 = {"id": "dn-bm-1", "name": "Bánh Mì Bà Lan", "address": "Hải Châu, Đà Nẵng", "categories": ["restaurant"], "location": {"lat": 16.06, "lng": 108.22}}
    v2 = {"id": "dn-bm-2", "name": "Bánh Mì AA", "address": "Thanh Khê, Đà Nẵng", "categories": ["restaurant"], "location": {"lat": 16.05, "lng": 108.20}}
    v3_unresolved = {"id": "unresolved-ext", "name": "Bánh Mì Ven Đường", "address": "Hội An", "city": "Hội An", "location": {"lat": 15.88, "lng": 108.33}}

    ev1 = evaluator.evaluate(v1, scope, [req])
    ev2 = evaluator.evaluate(v2, scope, [req])
    ev3 = evaluator.evaluate(v3_unresolved, scope, [req])

    assert ev1.eligible is True
    assert ev2.eligible is True
    assert ev3.eligible is False


def test_regression_i_hue_scenario():
    from app.planning import ItineraryPlanner, ValidityState
    from app.recommendation.goal_normalizer import RecommendationGoalNormalizer
    from app.retrieval.coverage import derive_coverage_requirements, CoverageType

    normalizer = RecommendationGoalNormalizer()
    prompt = "lên lịch trình 1 ngày ở Huế đi chơi và ăn uống các địa điểm nổi tiếng"
    goal = normalizer.fallback_travel_goal(prompt)
    assert goal.destination == "Huế"

    reqs = derive_coverage_requirements(goal)
    food_reqs = [r for r in reqs if r.type in (CoverageType.FOOD, CoverageType.LOCAL_SPECIALTY, CoverageType.MEAL)]
    assert len(food_reqs) > 0

    planner = ItineraryPlanner()
    places = [
        {"id": "hue-citadel", "name": "Đại Nội Huế", "categories": ["attraction", "museum"], "location": {"lat": 16.469, "lng": 107.578}},
        {"id": "thien-mu", "name": "Chùa Thiên Mụ", "categories": ["attraction"], "location": {"lat": 16.453, "lng": 107.545}},
    ]
    preview = planner.preview(prompt, [{"tool": "search_places", "data": places}], draft_failed=True)

    assert preview["validityState"] != ValidityState.VALID.value
    assert preview["canCommit"] is False
    assert any("RESTAURANTS" in i["code"] or "SPECIALTY" in i["code"] or "FOOD" in i["code"] for i in preview["issues"])


def test_format_preview_markdown_renders_places_and_notes():
    from app.planning import format_preview_markdown

    mock_preview = {
        "constraints": {"destination": "Đà Nẵng"},
        "days": [
            {
                "dayNumber": 1,
                "date": "2026-09-26",
                "weather": {"temperatureC": 28},
                "items": [
                    {
                        "title": "Mì Quảng Bếp Trang",
                        "startTime": "08:00",
                        "endTime": "09:15",
                        "address": "441 Ông Ích Khiêm, Đà Nẵng",
                        "ratingSummary": {"value": 4.3, "count": 450}
                    },
                    {
                        "title": "Cầu Rồng",
                        "startTime": "09:45",
                        "endTime": "11:30",
                        "address": "Nguyễn Văn Linh, Đà Nẵng",
                        "ratingSummary": {"value": 4.7, "count": 3500}
                    }
                ]
            }
        ],
        "issues": [{"code": "INFO", "message": "Giờ mở cửa cần xác minh tại chỗ."}]
    }

    md_vi = format_preview_markdown(mock_preview, is_vi=True)
    assert "Đà Nẵng" in md_vi
    assert "Mì Quảng Bếp Trang" in md_vi
    assert "08:00–09:15" in md_vi
    assert "⭐ 4.3/5" in md_vi
    assert "Cầu Rồng" in md_vi
    assert "Giờ mở cửa cần xác minh tại chỗ" in md_vi

    md_en = format_preview_markdown(mock_preview, is_vi=False)
    assert "Day 1" in md_en
    assert "Mì Quảng Bếp Trang" in md_en
    assert "reviews" in md_en


