import math
import re
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from ..recommendation.goal_normalizer import GeographicScope
from .coverage import CoverageRequirement, CoverageType


class FoodEvidenceStatus(str, Enum):
    VERIFIED = "VERIFIED"
    LIKELY = "LIKELY"
    UNKNOWN = "UNKNOWN"
    CONFLICTING = "CONFLICTING"


class FoodEvidenceSource(str, Enum):
    PROVIDER_MENU = "PROVIDER_MENU"
    PROVIDER_CATEGORY = "PROVIDER_CATEGORY"
    OFFICIAL_DESCRIPTION = "OFFICIAL_DESCRIPTION"
    WEB_SOURCE = "WEB_SOURCE"
    REVIEW = "REVIEW"


class FoodEvidence(BaseModel):
    food: str
    status: FoodEvidenceStatus
    source_type: FoodEvidenceSource
    source_id: str | None = None
    fetched_at: datetime | None = None
    confidence: float | None = None
    excerpt: str | None = None


class TrustTier(str, Enum):
    TIER_A_CANONICAL = "TIER_A_CANONICAL"
    TIER_B_GROUNDED_EXTERNAL = "TIER_B_GROUNDED_EXTERNAL"
    TIER_C_MODEL_KNOWLEDGE = "TIER_C_MODEL_KNOWLEDGE"


class CandidateEvaluation(BaseModel):
    canonical_place_id: str
    eligible: bool
    satisfies_requirement_ids: list[str] = Field(default_factory=list)
    rejection_reasons: list[str] = Field(default_factory=list)
    soft_penalties: list[str] = Field(default_factory=list)
    explanation_notes: list[str] = Field(default_factory=list)
    unknown_fields: list[str] = Field(default_factory=list)
    food_evidences: list[FoodEvidence] = Field(default_factory=list)
    semantic_score: float = 0.0
    geographic_score: float | None = None
    route_score: float | None = None
    trust_tier: TrustTier = TrustTier.TIER_A_CANONICAL
    is_external: bool = False


# Specific local specialty catalog by administrative destination
DESTINATION_SPECIALTIES: dict[str, list[str]] = {
    "đà nẵng": [
        "mì quảng", "bún chả cá", "bánh tráng cuốn thịt heo", "bánh xèo", "nem lụi",
        "hải sản", "bún mắm nêm", "gỏi cá nam ô", "bê thui cầu mống", "chè sầu"
    ],
    "da nang": [
        "mì quảng", "bún chả cá", "bánh tráng cuốn thịt heo", "bánh xèo", "nem lụi",
        "hải sản", "bún mắm nêm", "gỏi cá nam ô", "bê thui cầu mống", "chè sầu"
    ],
    "hội an": [
        "cao lầu", "cơm gà hội an", "bánh bao bánh vạc", "bánh mì phượng", "bánh mì madam khánh",
        "mì quảng", "chè bắp", "hoành thánh chiên"
    ],
    "hà nội": [
        "phở", "bún chả", "chả cá lã vọng", "bún ốc", "bún thang", "bánh cuốn cà cuống",
        "cốm làng vòng", "cà phê trứng"
    ],
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class CandidateEvaluator:
    """Evaluates candidate places against GeographicScope and CoverageRequirements

    using typed provenance, without naive substring matching.
    """

    def evaluate(self, place: dict[str, Any], scope: GeographicScope,
                 requirements: list[CoverageRequirement]) -> CandidateEvaluation:
        place_id = str(place.get("id") or "")
        rejection_reasons: list[str] = []
        satisfies_ids: list[str] = []
        unknown_fields: list[str] = []
        food_evidences: list[FoodEvidence] = []

        # 1. Geographic Evaluation
        geo_ok, geo_score, geo_reason = self._evaluate_geography(place, scope)
        if not geo_ok:
            rejection_reasons.append(geo_reason)

        # 2. Food & Capability Evidence Extraction
        for req in requirements:
            if req.type == CoverageType.FOOD:
                evidence = self._extract_food_evidence(place, req.target)
                food_evidences.append(evidence)
                if evidence.status in (FoodEvidenceStatus.VERIFIED, FoodEvidenceStatus.LIKELY) and (evidence.confidence or 0) >= 0.7:
                    satisfies_ids.append(req.id)
                else:
                    unknown_fields.append(f"food:{req.target}")
            elif req.type == CoverageType.LOCAL_SPECIALTY:
                specialties = DESTINATION_SPECIALTIES.get(scope.destination_name.strip().casefold(), [])
                matched_specialty = False
                for sp in specialties:
                    ev = self._extract_food_evidence(place, sp)
                    if ev.status in (FoodEvidenceStatus.VERIFIED, FoodEvidenceStatus.LIKELY) and (ev.confidence or 0) >= 0.7:
                        food_evidences.append(ev)
                        matched_specialty = True
                        break
                if matched_specialty:
                    satisfies_ids.append(req.id)
                else:
                    unknown_fields.append("localSpecialty")
            elif req.type == CoverageType.MEAL:
                if self._is_restaurant_venue(place):
                    satisfies_ids.append(req.id)
                else:
                    unknown_fields.append("mealSuitability")
            elif req.type == CoverageType.ATTRACTION:
                if self._is_attraction_venue(place):
                    satisfies_ids.append(req.id)
            elif req.type == CoverageType.ACTIVITY:
                target_name = req.target.casefold().strip()
                place_name = str(place.get("name") or "").casefold()
                if req.context.get("category") == "CAFE":
                    if self._is_cafe_venue(place):
                        satisfies_ids.append(req.id)
                    else:
                        rejection_reasons.append("CATEGORY_MISMATCH: Expected a cafe.")
                elif target_name in place_name or place_name in target_name:
                    satisfies_ids.append(req.id)

        # Detect trust tier and external source
        is_external = bool(
            place.get("source") in ("WEB", "EXTERNAL")
            or place.get("isExternal")
            or place_id.startswith("web-")
            or str(place.get("canonicalPlaceId", "")).startswith("web-")
        )
        trust_tier = TrustTier.TIER_B_GROUNDED_EXTERNAL if is_external else TrustTier.TIER_A_CANONICAL

        # Check fatal status (Hard Reject)
        if str(place.get("businessStatus", "")).upper() in ("CLOSED_PERMANENTLY", "PERMANENTLY_CLOSED"):
            rejection_reasons.append("PERMANENTLY_CLOSED")

        # Soft penalties and explanation notes
        soft_penalties: list[str] = []
        explanation_notes: list[str] = []
        if not place.get("openingHours") and not place.get("normalizedOpeningHours"):
            soft_penalties.append("OPENING_HOURS_UNVERIFIED")
            explanation_notes.append("Chưa có giờ mở cửa xác minh cho hôm nay")
        if is_external:
            soft_penalties.append("EXTERNAL_SOURCE")
            explanation_notes.append("Thông tin từ nguồn trực tuyến ngoài hệ thống")
        if place.get("userRatingCount") is not None and int(place.get("userRatingCount") or 0) < 5:
            soft_penalties.append("FEW_REVIEWS")

        # Semantic Score calculation with soft penalties
        score = 0.5
        if satisfies_ids:
            score += 0.3
        rating = place.get("rating")
        if isinstance(rating, (int, float)) and 0 <= rating <= 5:
            score += (rating / 5.0) * 0.2
        if soft_penalties:
            score = max(0.1, round(score - len(soft_penalties) * 0.05, 4))

        eligible = len(rejection_reasons) == 0

        return CandidateEvaluation(
            canonical_place_id=place_id,
            eligible=eligible,
            satisfies_requirement_ids=satisfies_ids,
            rejection_reasons=rejection_reasons,
            soft_penalties=soft_penalties,
            explanation_notes=explanation_notes,
            unknown_fields=list(set(unknown_fields)),
            food_evidences=food_evidences,
            semantic_score=score,
            geographic_score=geo_score,
            trust_tier=trust_tier,
            is_external=is_external,
        )

    def _evaluate_geography(self, place: dict[str, Any], scope: GeographicScope) -> tuple[bool, float, str]:
        """Strict geographic verification:

        1. Administrative locality match
        2. Prohibited out-of-province exclusions (e.g. Hội An vs Đà Nẵng)
        3. Coordinate/boundary validation
        4. Radius fallback
        """
        dest_norm = scope.destination_name.strip().casefold()
        address = str(place.get("address") or "").casefold()
        city = str(place.get("city") or "").casefold()
        name = str(place.get("name") or "").casefold()
        addr_locality = f"{address} {city}".strip()
        full_text = f"{name} {addr_locality}"

        allowed_excursions = [e.casefold() for e in scope.allowed_excursions if e.casefold() != dest_norm]

        loc = place.get("location")
        lat = None
        lng = None
        if isinstance(loc, dict):
            if isinstance(loc.get("lat"), (int, float)) and isinstance(loc.get("lng"), (int, float)):
                lat = float(loc["lat"])
                lng = float(loc["lng"])
            elif isinstance(loc.get("coordinates"), (list, tuple)) and len(loc["coordinates"]) >= 2:
                lng = float(loc["coordinates"][0])
                lat = float(loc["coordinates"][1])

        is_excursion = bool(allowed_excursions and any(exc in addr_locality for exc in allowed_excursions))

        # Coordinate distance check against destination center
        if lat is not None and lng is not None and scope.center_lat and scope.center_lng:
            distance = _haversine_km(scope.center_lat, scope.center_lng, lat, lng)
            if distance > scope.hard_radius_km:
                if is_excursion:
                    return True, 0.6, ""
                return False, 0.0, f"OUTSIDE_GEOGRAPHIC_SCOPE: Distance {distance:.1f}km exceeds hard radius {scope.hard_radius_km}km."
            geo_score = max(0.2, 1.0 - (distance / scope.hard_radius_km))
            return True, geo_score, ""

        # Default fallback
        if not address and not city:
            return True, 0.5, ""
        if dest_norm in addr_locality:
            return True, 0.9, ""
        if scope.admin_area and scope.admin_area.casefold() in addr_locality:
            return True, 0.9, ""

        if is_excursion:
            return True, 0.7, ""

        if city and dest_norm not in city and (not scope.admin_area or scope.admin_area.casefold() not in city):
            return False, 0.0, f"OUTSIDE_GEOGRAPHIC_SCOPE: Place city '{city}' does not match destination '{scope.destination_name}'."

        return True, 0.6, ""

    def _extract_food_evidence(self, place: dict[str, Any], food_target: str) -> FoodEvidence:
        target_norm = food_target.strip().casefold()
        name = str(place.get("name") or "").casefold()
        categories = [str(c).casefold() for c in (place.get("categories") or [])]
        description = str(place.get("description") or "").casefold()

        # Check negative/conflicting indicators in reviews first
        raw_reviews = place.get("topReviews") or place.get("reviews") or []
        reviews: list[str] = [str(r.get("text") if isinstance(r, dict) else r).casefold() for r in raw_reviews]
        for rev in reviews:
            # Negative patterns: "quán không có mì quảng", "không bán bánh mì", "hết món..."
            if re.search(rf"\b(?:không\s+(?:có|bán|phục\s+vụ)|chưa\s+có|đừng\s+gọi)\s+{re.escape(target_norm)}\b", rev):
                return FoodEvidence(
                    food=food_target,
                    status=FoodEvidenceStatus.CONFLICTING,
                    source_type=FoodEvidenceSource.REVIEW,
                    confidence=0.9,
                    excerpt=rev[:120],
                )

        # 1. Direct Name match (high confidence verified)
        if target_norm in name:
            return FoodEvidence(
                food=food_target,
                status=FoodEvidenceStatus.VERIFIED,
                source_type=FoodEvidenceSource.OFFICIAL_DESCRIPTION,
                confidence=0.95,
                excerpt=f"Tên quán '{place.get('name')}' thể hiện món '{food_target}'",
            )

        # 2. Categories match
        if any(target_norm in cat for cat in categories):
            return FoodEvidence(
                food=food_target,
                status=FoodEvidenceStatus.VERIFIED,
                source_type=FoodEvidenceSource.PROVIDER_CATEGORY,
                confidence=0.90,
                excerpt=f"Danh mục quán chứa '{food_target}'",
            )

        # 3. Description positive match
        if target_norm in description and not any(neg in description for neg in ("không có", "không bán")):
            return FoodEvidence(
                food=food_target,
                status=FoodEvidenceStatus.LIKELY,
                source_type=FoodEvidenceSource.OFFICIAL_DESCRIPTION,
                confidence=0.85,
                excerpt=description[:140],
            )

        # 4. Review positive match (must have positive sentiment towards the dish)
        for rev in reviews:
            if target_norm in rev and any(pos in rev for pos in ("ngon", "đặc sản", "nổi tiếng", "đậm đà", "chuẩn vị", "rất thích", "tươi", "phục vụ")):
                return FoodEvidence(
                    food=food_target,
                    status=FoodEvidenceStatus.LIKELY,
                    source_type=FoodEvidenceSource.REVIEW,
                    confidence=0.80,
                    excerpt=rev[:140],
                )

        # No positive evidence found -> UNKNOWN
        return FoodEvidence(
            food=food_target,
            status=FoodEvidenceStatus.UNKNOWN,
            source_type=FoodEvidenceSource.PROVIDER_CATEGORY,
            confidence=0.0,
            excerpt=None,
        )

    def _is_restaurant_venue(self, place: dict[str, Any]) -> bool:
        categories = [str(c).casefold() for c in (place.get("categories") or [])]
        name = str(place.get("name") or "").casefold()
        # Disqualify generic bars/nightclubs unless food evidence is confirmed
        if any(b in name for b in ("tụ điểm ăn chơi", "bar", "club", "karaoke", "pub")) and not any(r in name for r in ("quán", "nhà hàng", "quán ăn")):
            return False
        food_terms = ("restaurant", "food", "quán ăn", "nhà hàng", "ẩm thực", "quán", "bún", "mì", "cơm", "phở", "bánh mì", "hải sản")
        return any(term in cat for cat in categories for term in food_terms) or any(term in name for term in ("nhà hàng", "quán ăn", "bún", "mì", "cơm", "phở", "bánh mì", "hải sản", "quán"))

    @staticmethod
    def _is_cafe_venue(place: dict[str, Any]) -> bool:
        categories = [str(c).casefold() for c in (place.get("categories") or [])]
        name = str(place.get("name") or "").casefold()
        cafe_terms = ("cafe", "café", "coffee", "cà phê")
        return any(term in value for value in categories for term in cafe_terms) or any(term in name for term in cafe_terms)

    def _is_attraction_venue(self, place: dict[str, Any]) -> bool:
        categories = [str(c).casefold() for c in (place.get("categories") or [])]
        name = str(place.get("name") or "").casefold()
        attraction_terms = (
            "attraction", "sightseeing", "tham quan", "di tích", "museum", "bảo tàng",
            "công viên", "park", "bãi biển", "beach", "cầu", "bridge", "chùa", "pagoda",
            "hải đăng", "lighthouse", "bán đảo", "peninsula", "chợ", "market", "ngũ hành sơn", "bà nà"
        )
        return any(term in cat for cat in categories for term in attraction_terms) or any(term in name for term in attraction_terms)
