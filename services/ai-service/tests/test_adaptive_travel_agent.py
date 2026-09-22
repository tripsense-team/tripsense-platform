import pytest
from datetime import datetime

from app.recommendation.goal_normalizer import (
    GeographicScope,
    TravelGoal,
    resolve_geographic_scope,
    RecommendationGoalNormalizer,
    travel_goal_to_recommendation_goal,
)
from app.retrieval.coverage import (
    CoverageRequirement,
    CoverageType,
    derive_coverage_requirements,
)
from app.retrieval.candidate_evaluator import (
    CandidateEvaluation,
    CandidateEvaluator,
    FoodEvidence,
    FoodEvidenceStatus,
    FoodEvidenceSource,
)
from app.retrieval.evidence_gaps import (
    EvidenceGap,
    detect_evidence_gaps,
    measure_evidence_gain,
)
from app.planning import ItineraryPlanner, ValidityState
from app.main import (
    is_trivial_fast_path,
    extract_venue_names_from_web_results,
)


# ============================================================================
# 1. Regression Test: Reproduce exact Tiên Sa + 43 DANANG + Bài Chòi Hội An
# ============================================================================

def test_regression_tien_sa_43danang_bai_choi_hoi_an():
    """
    Prompt: 'lên lịch trình 1 ngày ở Đà Nẵng đi chơi và ăn uống các địa điểm nổi tiếng'
    Provider returns:
      1. Hải đăng Tiên Sa
      2. TỤ ĐIỂM ĂN CHƠI - 43 DANANG
      3. Bài Chòi Hội An
    """
    normalizer = RecommendationGoalNormalizer()
    evaluator = CandidateEvaluator()
    planner = ItineraryPlanner()

    prompt = "lên lịch trình 1 ngày ở Đà Nẵng đi chơi và ăn uống các địa điểm nổi tiếng"
    goal = normalizer.fallback_travel_goal(prompt, {"destination": "Đà Nẵng"})
    assert goal.destination == "Đà Nẵng"
    assert goal.durationDays == 1
    assert "sightseeing" in goal.requestedExperiences
    assert goal.mealRequirements != []

    requirements = derive_coverage_requirements(goal)
    req_ids = {r.id for r in requirements}
    assert any("sightseeing" in rid for rid in req_ids)

    tien_sa = {
        "id": "tien-sa-lighthouse",
        "name": "Hải đăng Tiên Sa",
        "address": "Bán đảo Sơn Trà, Đà Nẵng",
        "city": "Đà Nẵng",
        "categories": ["attraction", "sightseeing"],
        "location": {"lat": 16.14, "lng": 108.31},
    }
    danang_43 = {
        "id": "43-danang",
        "name": "TỤ ĐIỂM ĂN CHƠI - 43 DANANG",
        "address": "Hải Châu, Đà Nẵng",
        "city": "Đà Nẵng",
        "categories": ["bar", "entertainment"],
        "location": {"lat": 16.07, "lng": 108.22},
    }
    bai_choi = {
        "id": "bai-choi-hoi-an",
        "name": "Bài Chòi Hội An",
        "address": "Vườn tượng An Hội, Phường Minh An, Hội An, Quảng Nam",
        "city": "Hội An",
        "categories": ["attraction", "culture"],
        "location": {"lat": 15.87, "lng": 108.32},
    }

    # Evaluate Hải đăng Tiên Sa
    ev_tiensa = evaluator.evaluate(tien_sa, goal.geographicScope, requirements)
    assert ev_tiensa.eligible is True
    assert any("sightseeing" in r for r in ev_tiensa.satisfies_requirement_ids)
    assert len(ev_tiensa.rejection_reasons) == 0

    # Evaluate 43 DANANG: in Da Nang, but lacks verified food evidence for requested meal/specialty
    ev_43 = evaluator.evaluate(danang_43, goal.geographicScope, requirements)
    assert ev_43.eligible is True
    # Crucial: 43 DANANG must NOT satisfy food requirements without real food evidence
    food_req_ids = [r.id for r in requirements if r.type in (CoverageType.FOOD, CoverageType.LOCAL_SPECIALTY, CoverageType.MEAL)]
    for fid in food_req_ids:
        assert fid not in ev_43.satisfies_requirement_ids
    assert len(ev_43.rejection_reasons) == 0

    # Evaluate Bài Chòi Hội An: must be rejected as OUTSIDE_GEOGRAPHIC_SCOPE
    ev_baichoi = evaluator.evaluate(bai_choi, goal.geographicScope, requirements)
    assert ev_baichoi.eligible is False
    assert any("OUTSIDE_GEOGRAPHIC_SCOPE" in reason for reason in ev_baichoi.rejection_reasons)

    # Detect evidence gaps with these candidates
    gaps = detect_evidence_gaps(requirements, [ev_tiensa, ev_43, ev_baichoi])
    open_blocking_gaps = [g for g in gaps if g.blocking and g.status == "OPEN"]
    # There must be open blocking gaps for food / meal coverage
    assert len(open_blocking_gaps) > 0
    assert any(g.type in ("MEAL", "LOCAL_SPECIALTY", "FOOD") for g in open_blocking_gaps)

    # Itinerary preview must NOT be VALID
    grounding = [{"tool": "search_places", "data": [tien_sa, danang_43, bai_choi]}]
    preview = planner.preview(prompt, grounding)
    assert preview["validityState"] in (ValidityState.BLOCKED.value, ValidityState.INVALID.value)
    assert preview["validForPreview"] is False
    assert preview["canCommit"] is False
    assert any(issue["code"] == "ZERO_RESTAURANTS_FOR_MEALS" for issue in preview["issues"])


# ============================================================================
# 2. Acceptance Test: External Web Fallback with Canonical Place-Service Resolution
# ============================================================================

def test_external_fallback_canonical_resolution():
    """
    User: 'Lên lịch Đà Nẵng 1 ngày có bánh mì'
    Internal search: 0 bánh mì candidates
    External web results: mentions 3 venues
      - Venue A: canonically resolved in place-service
      - Venue B: canonically resolved in place-service
      - Venue C: failed resolution in place-service
    Expected:
      - Venue A and B enter canonical candidate pool and itinerary
      - Venue C remains textual evidence only, NEVER appears in preview items
    """
    web_payload = {
        "query": "bánh mì ngon Đà Nẵng",
        "gap": "bánh mì",
        "results": [
            {"title": "Bánh Mì Bà Lan - 62 Trưng Nữ Vương Đà Nẵng", "snippet": "Bánh mì Bà Lan nổi tiếng giòn ngon"},
            {"title": "Bánh Mì Cô Tiên - 08 Trần Phú Đà Nẵng", "snippet": "Bánh mì chảo và bánh mì que ngon rẻ"},
            {"title": "Quán Bánh Mì Ảo Tưởng Không Tồn Tại", "snippet": "Bài viết giới thiệu một quán không có trong cơ sở dữ liệu"},
        ]
    }

    extracted = extract_venue_names_from_web_results(web_payload)
    assert len(extracted) >= 2
    assert any("Bà Lan" in name for name in extracted)

    # Simulated canonical place-service database
    canonical_db = {
        "bánh mì bà lan đà nẵng": {
            "id": "place-banh-mi-ba-lan",
            "name": "Bánh Mì Bà Lan",
            "address": "62 Trưng Nữ Vương, Hải Châu, Đà Nẵng",
            "categories": ["restaurant", "food"],
            "location": {"lat": 16.062, "lng": 108.219},
        },
        "bánh mì cô tiên đà nẵng": {
            "id": "place-banh-mi-co-tien",
            "name": "Bánh Mì Cô Tiên",
            "address": "08 Trần Phú, Hải Châu, Đà Nẵng",
            "categories": ["restaurant", "food"],
            "location": {"lat": 16.068, "lng": 108.224},
        },
    }

    # Simulate canonical resolution step
    canonical_candidates = []
    unresolved_venues = []

    for venue in extracted:
        key = f"{venue.lower()} đà nẵng"
        match = next((v for k, v in canonical_db.items() if venue.lower() in k or k in venue.lower()), None)
        if match:
            canonical_candidates.append(match)
        else:
            unresolved_venues.append(venue)

    assert len(canonical_candidates) >= 1
    assert "place-banh-mi-ba-lan" in [c["id"] for c in canonical_candidates]

    # Test that planner preview only uses canonical places
    planner = ItineraryPlanner()
    attraction = {
        "id": "cau-rong",
        "name": "Cầu Rồng Đà Nẵng",
        "address": "Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
        "categories": ["attraction"],
        "location": {"lat": 16.061, "lng": 108.227},
    }
    grounding = [
        {"tool": "search_places", "data": [attraction, *canonical_candidates]},
        {"tool": "web_search", "data": web_payload},
    ]

    preview = planner.preview("Lên lịch Đà Nẵng 1 ngày có bánh mì", grounding)
    planned_ids = {item["canonicalPlaceId"] for day in preview["days"] for item in day["items"]}

    assert "place-banh-mi-ba-lan" in planned_ids
    # Unresolved venue C must NEVER be a canonicalPlaceId in the itinerary
    for u in unresolved_venues:
        assert u not in planned_ids


# ============================================================================
# 3. Model Extraction Failure Graceful Fallback
# ============================================================================

def test_model_extraction_graceful_fallback():
    """
    Fallback must preserve raw request food constraints without wiping them to []
    """
    normalizer = RecommendationGoalNormalizer()
    prompt = "Lên lịch 1 ngày Đà Nẵng ăn bánh mì và mì Quảng đặc sản"
    context = {"destination": "Đà Nẵng"}

    fallback = normalizer.fallback_travel_goal(prompt, context)
    assert fallback.destination == "Đà Nẵng"
    assert fallback.durationDays == 1
    # Must preserve foods extracted from raw text
    assert "bánh mì" in [f.casefold() for f in fallback.mustEatFoods]
    assert "mì quảng" in [f.casefold() for f in fallback.mustEatFoods]
    assert fallback.localSpecialtiesRequired is True


# ============================================================================
# 4. Fast Path Routing
# ============================================================================

def test_fast_path_routing():
    assert is_trivial_fast_path("ok") is True
    assert is_trivial_fast_path("hủy") is True
    assert is_trivial_fast_path("đồng ý tạo trip") is True
    assert is_trivial_fast_path("cảm ơn") is True
    assert is_trivial_fast_path("thanks") is True

    # Travel semantic queries must NOT be trivial fast path
    assert is_trivial_fast_path("lên lịch trình 1 ngày ở Đà Nẵng") is False
    assert is_trivial_fast_path("tìm quán bánh mì ngon Đà Nẵng") is False
    assert is_trivial_fast_path("đi chơi Đà Nẵng ăn đặc sản") is False


# ============================================================================
# 5. Food Evidence with Provenance & Negative Review Detection
# ============================================================================

def test_food_evidence_provenance_and_negative_reviews():
    evaluator = CandidateEvaluator()

    # Case A: Negative review
    place_negative = {
        "id": "place-neg",
        "name": "Quán Cơm Bình Dân",
        "categories": ["restaurant"],
        "topReviews": [
            {"author": "User A", "text": "Quán không có mì quảng, đừng gọi nhé."}
        ]
    }
    ev_neg = evaluator._extract_food_evidence(place_negative, "mì quảng")
    assert ev_neg.status == FoodEvidenceStatus.CONFLICTING
    assert ev_neg.source_type == FoodEvidenceSource.REVIEW

    # Case B: Positive review with culinary praise
    place_positive = {
        "id": "place-pos",
        "name": "Bếp Miền Trung",
        "categories": ["restaurant"],
        "topReviews": [
            {"author": "User B", "text": "Mì quảng ở đây chuẩn vị đậm đà rất ngon!"}
        ]
    }
    ev_pos = evaluator._extract_food_evidence(place_positive, "mì quảng")
    assert ev_pos.status == FoodEvidenceStatus.LIKELY
    assert ev_pos.confidence >= 0.7

    # Case C: Direct menu / name match
    place_direct = {
        "id": "place-direct",
        "name": "Mì Quảng Bà Mua",
        "categories": ["restaurant"],
    }
    ev_direct = evaluator._extract_food_evidence(place_direct, "mì quảng")
    assert ev_direct.status == FoodEvidenceStatus.VERIFIED
    assert ev_direct.confidence >= 0.9


# ============================================================================
# 6. Geographic Scope: Admin Locality Match vs Radius Fallback
# ============================================================================

def test_geographic_scope_admin_boundary():
    evaluator = CandidateEvaluator()
    scope = resolve_geographic_scope("Đà Nẵng")

    # Hoi An place without allowed excursion
    hoi_an_place = {
        "id": "hoi-an-spot",
        "name": "Phố cổ Hội An",
        "address": "Trần Phú, Hội An, Quảng Nam",
        "city": "Hội An",
    }
    geo_ok, score, reason = evaluator._evaluate_geography(hoi_an_place, scope)
    assert geo_ok is False
    assert "OUTSIDE_GEOGRAPHIC_SCOPE" in reason

    # With allowed excursion
    scope_with_excursion = resolve_geographic_scope("Đà Nẵng", ["Hội An"])
    geo_ok_exc, score_exc, _ = evaluator._evaluate_geography(hoi_an_place, scope_with_excursion)
    assert geo_ok_exc is True


# ============================================================================
# 7. Validity Separation: VALID vs PARTIAL vs BLOCKED vs INVALID
# ============================================================================

def test_validity_separation_restaurant_not_always_blocking():
    planner = ItineraryPlanner()

    attraction = {
        "id": "attraction-1",
        "name": "Bảo tàng Điêu khắc Chăm",
        "address": "02 2 Tháng 9, Bình Hiên, Hải Châu, Đà Nẵng",
        "categories": ["attraction", "museum"],
        "location": {"lat": 16.06, "lng": 108.22},
    }
    grounding = [{"tool": "search_places", "data": [attraction]}]

    # User asks only for attractions: 0 restaurants should NOT be a blocking issue
    preview_sightseeing = planner.preview("đi các điểm nổi tiếng Đà Nẵng", grounding)
    assert not any(i["code"] == "ZERO_RESTAURANTS_FOR_MEALS" for i in preview_sightseeing["issues"])

    # User explicitly asks for meals / food: 0 restaurants MUST be a blocking issue
    preview_food = planner.preview("lên lịch 1 ngày Đà Nẵng ăn uống đặc sản", grounding)
    assert any(i["code"] == "ZERO_RESTAURANTS_FOR_MEALS" for i in preview_food["issues"])
    assert preview_food["validityState"] == ValidityState.BLOCKED.value
    assert preview_food["canCommit"] is False
