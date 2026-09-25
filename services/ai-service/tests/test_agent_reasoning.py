import pytest
from app.recommendation.goal_normalizer import RecommendationGoalNormalizer, TravelGoal
from app.retrieval.candidate_evaluator import CandidateEvaluator, TrustTier
from app.retrieval.coverage import CoverageRequirement, CoverageType
from app.main import allowed_tools, ActionType


def test_multi_goal_and_nuance_preservation():
    normalizer = RecommendationGoalNormalizer()
    text = (
        "Tao ở Đà Nẵng 2 ngày, mai trời mưa không? Nếu mưa thì đổi lịch giúp tao, "
        "với tìm quán cà phê chill chill, yên tĩnh, ngắm sunset gần khách sạn."
    )
    goal = normalizer.fallback_travel_goal(text, {})

    assert goal.destination == "Đà Nẵng"
    assert goal.durationDays == 2
    assert goal.raw_request == text
    
    # Subgoals verification
    assert "check_weather" in goal.subgoals
    assert "find_cafe" in goal.subgoals
    assert "modify_itinerary" in goal.subgoals
    
    # Semantic desires verification (nuance preserved)
    assert "chill_relaxed" in goal.semantic_desires
    assert "sunset" in goal.semantic_desires
    assert "quiet_uncrowded" in goal.semantic_desires
    assert goal.mode == "DISCOVERY"


def test_action_mode_detection():
    normalizer = RecommendationGoalNormalizer()
    text = "Thêm quán này vào lịch trình ngày 2 giúp tao và chốt lịch."
    goal = normalizer.fallback_travel_goal(text, {})
    assert goal.mode == "ACTION"


def test_allowed_tools_expands_with_travel_goal():
    normalizer = RecommendationGoalNormalizer()
    text = "Mai trời mưa không? Tìm quán cà phê yên tĩnh."
    goal = normalizer.fallback_travel_goal(text, {})

    # Even if action is TRIP_QA, compound subgoals should allow weather research and place search
    tools = allowed_tools(ActionType.TRIP_QA, travel_goal=goal)
    assert "web_search" in tools
    assert "search_places" in tools
    assert "get_itinerary" in tools


def test_candidate_evaluator_soft_penalties_and_trust_tiers():
    evaluator = CandidateEvaluator()
    normalizer = RecommendationGoalNormalizer()
    goal = normalizer.fallback_travel_goal("quán mì quảng ngon ở Đà Nẵng", {})
    scope = goal.geographicScope
    reqs = [
        CoverageRequirement(id="req-food", type=CoverageType.FOOD, target="mì quảng", blocking=True)
    ]

    # Canonical place with missing opening hours (should NOT hard reject, only soft penalty)
    canonical_place = {
        "id": "place-canonical-1",
        "name": "Mì Quảng Bà Mua",
        "categories": ["restaurant", "mì quảng"],
        "city": "Đà Nẵng",
        "address": "19 Trần Bình Trọng, Hải Châu, Đà Nẵng",
        "location": {"lat": 16.065, "lng": 108.215},
        "rating": 4.5,
        "userRatingCount": 120,
    }
    res_canon = evaluator.evaluate(canonical_place, scope, reqs)
    assert res_canon.eligible is True
    assert res_canon.trust_tier == TrustTier.TIER_A_CANONICAL
    assert res_canon.is_external is False
    assert "OPENING_HOURS_UNVERIFIED" in res_canon.soft_penalties
    assert len(res_canon.rejection_reasons) == 0

    # External web candidate (Tier B Grounded External)
    external_place = {
        "id": "web-101",
        "name": "Mì Quảng Bích Đà Nẵng",
        "categories": ["restaurant"],
        "city": "Đà Nẵng",
        "address": "Đà Nẵng",
        "location": {"lat": 16.068, "lng": 108.218},
        "rating": 4.2,
        "source": "WEB",
    }
    res_ext = evaluator.evaluate(external_place, scope, reqs)
    assert res_ext.eligible is True
    assert res_ext.trust_tier == TrustTier.TIER_B_GROUNDED_EXTERNAL
    assert res_ext.is_external is True
    assert "EXTERNAL_SOURCE" in res_ext.soft_penalties

    # Hard Reject: place in completely wrong city (e.g. Quảng Nam when Da Nang required with no excursion)
    wrong_city_place = {
        "id": "place-wrong-1",
        "name": "Mì Quảng Ông Hai Hội An",
        "city": "Quảng Nam",
        "address": "Trương Minh Lượng, Hội An",
        "location": {"lat": 15.88, "lng": 108.33},  # ~28km away
    }
    res_wrong = evaluator.evaluate(wrong_city_place, scope, reqs)
    assert res_wrong.eligible is False
    assert len(res_wrong.rejection_reasons) > 0


def test_permanently_closed_is_hard_rejected():
    evaluator = CandidateEvaluator()
    normalizer = RecommendationGoalNormalizer()
    goal = normalizer.fallback_travel_goal("quán ăn Đà Nẵng", {})
    scope = goal.geographicScope
    closed_place = {
        "id": "place-closed-1",
        "name": "Quán Cũ Đã Đóng Cửa",
        "city": "Đà Nẵng",
        "businessStatus": "CLOSED_PERMANENTLY",
        "location": {"lat": 16.05, "lng": 108.20},
    }
    res = evaluator.evaluate(closed_place, scope, [])
    assert res.eligible is False
    assert "PERMANENTLY_CLOSED" in res.rejection_reasons


def test_food_intent_synonym_normalization():
    from app.retrieval.candidate_evaluator import matches_food_intent

    # Bánh tráng cuốn thịt heo synonyms
    matched, term = matches_food_intent("bánh tráng cuốn thịt heo", "Bánh tráng thịt heo Quán Cơm Đại Lộc")
    assert matched is True
    assert term in ("bánh tráng cuốn thịt heo", "bánh tráng thịt heo")

    matched, _ = matches_food_intent("bánh tráng cuốn thịt heo", "Đặc sản thịt heo cuốn bánh tráng Trần")
    assert matched is True

    # Bún chả cá synonyms
    matched, _ = matches_food_intent("bún chả cá", "Chả cá Hờn - 113 Nguyễn Chí Thanh")
    assert matched is True

    # Seafood synonyms
    matched, _ = matches_food_intent("hải sản", "Hải sản Bé Mặn")
    assert matched is True


def test_proposal_reference_detection_and_extraction():
    from app.main import is_proposal_reference, extract_proposed_places_from_history

    # Reference detection
    assert is_proposal_reference("ok tạo lịch trình từ đề xuất này") is True
    assert is_proposal_reference("chốt theo đề xuất trên") is True
    assert is_proposal_reference("lên lịch theo gợi ý vừa rồi") is True
    assert is_proposal_reference("tìm quán cà phê gần đây") is False

    # Place extraction from prior assistant message
    history = [
        {"role": "user", "content": "tạo chuyến đi đà nẵng 1 ngày"},
        {
            "role": "assistant",
            "content": (
                "| 08:30–11:00 | Tham quan Ngũ Hành Sơn – quần thể núi nổi tiếng |\n"
                "| 11:30–13:00 | Ăn trưa tại Bánh tráng cuốn thịt heo Đại Lộc |\n"
                "| 14:00–16:00 | Khám phá Bán đảo Sơn Trà và Chùa Linh Ứng |\n"
                "| 16:30–18:00 | Tắm biển tại Bãi biển Mỹ Khê |\n"
                "| 18:30–20:00 | Ăn tối tại Hải sản Bé Mặn |\n"
                "| 20:30–21:30 | Ngắm Cầu Rồng phun lửa |"
            ),
        },
    ]
    extracted = extract_proposed_places_from_history(history)
    assert len(extracted) >= 5
    extracted_names = [p["name"] for p in extracted]
    assert any("Ngũ Hành Sơn" in n for n in extracted_names)
    assert any("Sơn Trà" in n or "Linh Ứng" in n for n in extracted_names)
    assert any("Mỹ Khê" in n for n in extracted_names)
    assert any("Cầu Rồng" in n for n in extracted_names)


def test_attraction_detection_expansion():
    evaluator = CandidateEvaluator()
    assert evaluator._is_attraction_venue({"name": "Ngũ Hành Sơn", "categories": []}) is True
    assert evaluator._is_attraction_venue({"name": "Bán đảo Sơn Trà", "categories": []}) is True
    assert evaluator._is_attraction_venue({"name": "Chùa Linh Ứng", "categories": []}) is True
    assert evaluator._is_attraction_venue({"name": "Bãi biển Mỹ Khê", "categories": []}) is True
    assert evaluator._is_attraction_venue({"name": "Cầu Rồng", "categories": []}) is True
    assert evaluator._is_attraction_venue({"name": "Quán Cơm Bình Dân", "categories": ["restaurant"]}) is False

