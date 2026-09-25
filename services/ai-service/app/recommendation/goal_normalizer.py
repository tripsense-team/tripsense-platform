import re
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field


class GoalConstraint(BaseModel):
    feature: str
    operator: str
    typedValue: Any
    evidenceRequirement: str = "STRUCTURED"


class SoftPreference(BaseModel):
    feature: str
    direction: str = "MAXIMIZE"
    importance: Literal["LOW", "MEDIUM", "HIGH"] = "MEDIUM"


class UnsupportedRequirement(BaseModel):
    phrase: str
    requiredCapability: str


class RecommendationGoal(BaseModel):
    schemaVersion: int = 1
    goalType: Literal["DISCOVER", "RECOMMEND", "COMPARE", "PLAN"] = "DISCOVER"
    subjectTypes: list[str] = Field(default_factory=list)
    searchArea: dict[str, Any] = Field(default_factory=dict)
    requestedTime: dict[str, Any] = Field(default_factory=dict)
    hardConstraints: list[GoalConstraint] = Field(default_factory=list)
    softPreferences: list[SoftPreference] = Field(default_factory=list)
    rankingObjectives: list[str] = Field(default_factory=lambda: ["RELEVANCE", "QUALITY"])
    requestedResultCount: int = Field(5, ge=1, le=10)
    unsupportedRequirements: list[UnsupportedRequirement] = Field(default_factory=list)
    assumptions: list[dict[str, Any]] = Field(default_factory=list)


class GeographicScope(BaseModel):
    destination_name: str
    canonical_destination_id: str | None = None
    admin_area: str | None = None
    country_code: str = "VN"
    center_lat: float | None = None
    center_lng: float | None = None
    soft_radius_km: float = 25.0
    hard_radius_km: float = 35.0
    allowed_excursions: list[str] = Field(default_factory=list)
    strict_destination: bool = True


class TravelGoal(BaseModel):
    schemaVersion: int = 2
    destination: str
    geographicScope: GeographicScope
    durationDays: int = Field(1, ge=1, le=7)
    startDate: date | None = None
    endDate: date | None = None
    travelerCount: int | None = None
    travelerType: str | None = None
    budgetAmount: float | None = None
    budgetCurrency: str = "VND"
    pace: Literal["RELAXED", "BALANCED", "FULL"] = "BALANCED"
    transportationPreference: str | None = None
    mustVisitPlaces: list[str] = Field(default_factory=list)
    mustEatFoods: list[str] = Field(default_factory=list)
    requestedCuisine: list[str] = Field(default_factory=list)
    localSpecialtiesRequired: bool = False
    mealRequirements: list[str] = Field(default_factory=lambda: ["breakfast", "lunch", "dinner"])
    requestedExperiences: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    preferredAreas: list[str] = Field(default_factory=list)
    routePreference: Literal["EFFICIENT", "FLEXIBLE"] = "EFFICIENT"
    explicitPriorities: list[str] = Field(default_factory=list)
    # Agent-centric reasoning enhancements
    raw_request: str = ""
    subgoals: list[str] = Field(default_factory=list)
    semantic_desires: list[str] = Field(default_factory=list)
    mode: Literal["DISCOVERY", "ACTION"] = "DISCOVERY"
    traveler_profile: dict[str, Any] = Field(default_factory=dict)


_KNOWN_LOCATION_SCOPES: dict[str, dict[str, Any]] = {
    "sơn trà": {
        "admin_area": "Đà Nẵng",
        "center_lat": 16.1068,
        "center_lng": 108.2772,
        "soft_radius_km": 5.0,
        "hard_radius_km": 5.0,
    },
    "đà nẵng": {
        "admin_area": "Đà Nẵng",
        "center_lat": 16.0544,
        "center_lng": 108.2022,
        "soft_radius_km": 18.0,
        "hard_radius_km": 22.0,
    },
    "da nang": {
        "admin_area": "Đà Nẵng",
        "center_lat": 16.0544,
        "center_lng": 108.2022,
        "soft_radius_km": 18.0,
        "hard_radius_km": 22.0,
    },
    "hội an": {
        "admin_area": "Quảng Nam",
        "center_lat": 15.8801,
        "center_lng": 108.3380,
        "soft_radius_km": 15.0,
        "hard_radius_km": 25.0,
    },
    "hoi an": {
        "admin_area": "Quảng Nam",
        "center_lat": 15.8801,
        "center_lng": 108.3380,
        "soft_radius_km": 15.0,
        "hard_radius_km": 25.0,
    },
    "hà nội": {
        "admin_area": "Hà Nội",
        "center_lat": 21.0285,
        "center_lng": 105.8542,
        "soft_radius_km": 25.0,
        "hard_radius_km": 40.0,
    },
    "ha noi": {
        "admin_area": "Hà Nội",
        "center_lat": 21.0285,
        "center_lng": 105.8542,
        "soft_radius_km": 25.0,
        "hard_radius_km": 40.0,
    },
    "huế": {
        "admin_area": "Thừa Thiên Huế",
        "center_lat": 16.4637,
        "center_lng": 107.5909,
        "soft_radius_km": 20.0,
        "hard_radius_km": 30.0,
    },
    "hue": {
        "admin_area": "Thừa Thiên Huế",
        "center_lat": 16.4637,
        "center_lng": 107.5909,
        "soft_radius_km": 20.0,
        "hard_radius_km": 30.0,
    },
    "sài gòn": {
        "admin_area": "Hồ Chí Minh",
        "center_lat": 10.8231,
        "center_lng": 106.6297,
        "soft_radius_km": 30.0,
        "hard_radius_km": 45.0,
    },
    "ho chi minh": {
        "admin_area": "Hồ Chí Minh",
        "center_lat": 10.8231,
        "center_lng": 106.6297,
        "soft_radius_km": 30.0,
        "hard_radius_km": 45.0,
    },
    "hồ chí minh": {
        "admin_area": "Hồ Chí Minh",
        "center_lat": 10.8231,
        "center_lng": 106.6297,
        "soft_radius_km": 30.0,
        "hard_radius_km": 45.0,
    },
    "đà lạt": {
        "admin_area": "Lâm Đồng",
        "center_lat": 11.9404,
        "center_lng": 108.4583,
        "soft_radius_km": 20.0,
        "hard_radius_km": 30.0,
    },
    "da lat": {
        "admin_area": "Lâm Đồng",
        "center_lat": 11.9404,
        "center_lng": 108.4583,
        "soft_radius_km": 20.0,
        "hard_radius_km": 30.0,
    },
    "nha trang": {
        "admin_area": "Khánh Hòa",
        "center_lat": 12.2388,
        "center_lng": 109.1967,
        "soft_radius_km": 20.0,
        "hard_radius_km": 30.0,
    },
    "phú quốc": {
        "admin_area": "Kiên Giang",
        "center_lat": 10.2899,
        "center_lng": 103.9840,
        "soft_radius_km": 30.0,
        "hard_radius_km": 45.0,
    },
    "phu quoc": {
        "admin_area": "Kiên Giang",
        "center_lat": 10.2899,
        "center_lng": 103.9840,
        "soft_radius_km": 30.0,
        "hard_radius_km": 45.0,
    },
}


CANONICAL_DESTINATIONS: dict[str, str] = {
    "đà nẵng": "Đà Nẵng",
    "da nang": "Da Nang",
    "hội an": "Hội An",
    "hoi an": "Hoi An",
    "huế": "Huế",
    "hue": "Hue",
    "hà nội": "Hà Nội",
    "ha noi": "Ha Noi",
    "hồ chí minh": "Hồ Chí Minh",
    "ho chi minh": "Ho Chi Minh",
    "sài gòn": "Sài Gòn",
    "sai gon": "Sai Gon",
    "đà lạt": "Đà Lạt",
    "da lat": "Da Lat",
    "nha trang": "Nha Trang",
    "phú quốc": "Phú Quốc",
    "phu quoc": "Phu Quoc",
    "quy nhơn": "Quy Nhơn",
    "quy nhon": "Quy Nhon",
    "vũng tàu": "Vũng Tàu",
    "vung tau": "Vung Tau",
    "hạ long": "Hạ Long",
    "ha long": "Ha Long",
    "ninh bình": "Ninh Bình",
    "ninh binh": "Ninh Binh",
    "sa pa": "Sa Pa",
    "sapa": "Sapa",
    "phan thiết": "Phan Thiết",
    "phan thiet": "Phan Thiet",
    "mũi né": "Mũi Né",
    "mui ne": "Mui Ne",
    "cần thơ": "Cần Thơ",
    "can tho": "Can Tho",
    "hải phòng": "Hải Phòng",
    "hai phong": "Hai Phong",
    "côn đảo": "Côn Đảo",
    "con dao": "Con Dao",
}

NON_DESTINATION_PHRASES: tuple[str, ...] = (
    "đi chơi và ăn uống", "đi chơi", "ăn uống", "ăn đặc sản", "quán đáng trải nghiệm", "tham quan",
    "nghỉ dưỡng", "du lịch", "trải nghiệm", "check in", "check-in", "sống ảo",
    "ngắm cảnh", "vui chơi", "khám phá", "tự túc", "tự do", "nổi tiếng",
    "ngon bổ rẻ", "giá rẻ", "đẹp nhất", "đáng đi", "thử trải nghiệm", "các địa điểm nổi tiếng",
)


def clean_destination_name(dest: Any) -> str:
    """Conservative cleanup helper for destination strings.
    Never overrides model-extracted destinations; preserves arbitrary destinations worldwide."""
    if not dest:
        return "Đà Nẵng"
    if isinstance(dest, dict):
        dest = dest.get("name") or dest.get("destination") or "Đà Nẵng"
    text = str(dest).strip().strip('"\'')
    if not text:
        return "Đà Nẵng"

    # Strip leading/trailing prepositions & punctuation
    cleaned = re.sub(r"^(?:ở|tại|đi|đến|to|in|at)\s+", "", text, flags=re.IGNORECASE)
    for phrase in NON_DESTINATION_PHRASES:
        cleaned = re.sub(re.escape(phrase), " ", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[,.;:!?-]+$", "", cleaned).strip()
    cleaned = " ".join(cleaned.split()).strip()

    # If canonical alias matches, normalize casing/diacritics, else keep cleaned text
    lowered = cleaned.casefold()
    for key, canonical in CANONICAL_DESTINATIONS.items():
        if key == lowered:
            return canonical

    return cleaned if len(cleaned) >= 2 else text


def resolve_geographic_scope(destination_name: str, allowed_excursions: list[str] | None = None) -> GeographicScope:
    """Resolve geographic scope generically for any destination worldwide."""
    clean_dest = clean_destination_name(destination_name)
    dest_norm = clean_dest.strip().casefold()
    info = _KNOWN_LOCATION_SCOPES.get(dest_norm, {})
    clean_excursions = [
        clean_destination_name(e) for e in (allowed_excursions or [])
        if clean_destination_name(e).casefold() != dest_norm
    ]
    return GeographicScope(
        destination_name=clean_dest,
        admin_area=info.get("admin_area"),
        center_lat=info.get("center_lat"),
        center_lng=info.get("center_lng"),
        soft_radius_km=info.get("soft_radius_km", 25.0),
        hard_radius_km=info.get("hard_radius_km", 35.0),
        allowed_excursions=clean_excursions,
        strict_destination=True,
    )


def refine_geographic_scope(scope: GeographicScope, text: str) -> GeographicScope:
    """Apply an explicitly named sub-area and radius without changing the destination city."""
    lowered = text.casefold()
    area = next((name for name in ("sơn trà", "hải châu", "ngũ hành sơn", "thanh khê", "liên chiểu", "cẩm lệ")
                 if name in lowered), None)
    info = _KNOWN_LOCATION_SCOPES.get(area or "", {})
    radius = re.search(r"(?:within|under|trong\s+bán\s+kính|trong\s+vòng|dưới)\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b", lowered)
    radius_km = (float(radius.group(1).replace(",", ".")) * (1 if radius.group(2) == "km" else 0.001)) if radius else None
    return scope.model_copy(update={
        "center_lat": info.get("center_lat", scope.center_lat),
        "center_lng": info.get("center_lng", scope.center_lng),
        "soft_radius_km": radius_km or info.get("soft_radius_km", scope.soft_radius_km),
        "hard_radius_km": radius_km or info.get("hard_radius_km", scope.hard_radius_km),
    })


class RecommendationGoalNormalizer:
    _categories = {
        "CAFE": ("cafe", "café", "coffee", "cà phê", "quán cà phê"),
        "RESTAURANT": (
            "restaurant", "nhà hàng", "quán ăn", "food", "quán",
            "bánh mì", "banh mi", "mì quảng", "mi quang", "cao lầu", "cao lau",
            "phở", "pho", "bún chả", "bun cha", "bún bò", "bun bo", "bánh xèo",
            "hải sản", "ẩm thực", "ăn uống", "đặc sản", "dac san", "món ăn",
            "mon an", "đồ ăn", "do an", "món", "specialty", "specialties"
        ),
        "HOTEL": ("hotel", "khách sạn"),
        "ATTRACTION": ("attraction", "sightseeing", "tham quan", "địa điểm du lịch", "đi chơi"),
    }
    _known_locations = tuple(_KNOWN_LOCATION_SCOPES.keys()) + (
        "quy nhơn", "quy nhon", "vũng tàu", "vung tau", "hạ long", "ha long", "ninh bình", "ninh binh",
        "sa pa", "sapa", "phan thiết", "phan thiet", "mũi né", "mui ne", "cần thơ", "can tho",
        "hải phòng", "hai phong", "côn đảo", "con dao", "sơn trà", "hải châu", "ngũ hành sơn",
        "thanh khê", "liên chiểu", "cẩm lệ"
    )

    def normalize(self, text: str, context: dict[str, Any] | None = None) -> RecommendationGoal:
        context = context or {}
        lowered = text.casefold()
        subjects = [key for key, terms in self._categories.items() if any(term in lowered for term in terms)]
        recommend = any(term in lowered for term in ("recommend", "best", "suggest", "gợi ý", "đề xuất", "nên"))
        goal = RecommendationGoal(goalType="RECOMMEND" if recommend else "DISCOVER", subjectTypes=subjects)

        count = re.search(
            r"(?:^|\s)(\d{1,2})\s+(?:quán|khách\s+sạn|hotels?|nhà\s+hàng|places?|locations?|kết quả)\b",
            lowered,
        )
        if count:
            goal.requestedResultCount = min(10, max(1, int(count.group(1))))

        location = next((item for item in self._known_locations if item in lowered), None)
        if not location:
            ctx_loc = context.get("locationName") or context.get("location") or context.get("destination")
            if isinstance(ctx_loc, str):
                ctx_loc_lower = ctx_loc.casefold().strip()
                location = next((item for item in self._known_locations if item in ctx_loc_lower), ctx_loc_lower)
        if context.get("lat") is not None and context.get("lng") is not None:
            goal.searchArea = {"anchorType": "COORDINATES", "lat": context["lat"], "lng": context["lng"]}
            if location:
                goal.searchArea["name"] = location
        elif context.get("tripId"):
            goal.searchArea = {"anchorType": "ACTIVE_TRIP", "tripId": context["tripId"]}
            if location:
                goal.searchArea["name"] = location
        elif location:
            info = _KNOWN_LOCATION_SCOPES.get(location)
            goal.searchArea = {
                "anchorType": "NAMED_AREA",
                "name": location,
                **({"lat": info["center_lat"], "lng": info["center_lng"]} if info else {}),
            }

        radius = re.search(r"(?:within|under|trong vòng|dưới)\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b", lowered)
        if radius:
            distance = float(radius.group(1).replace(",", ".")) * (1000 if radius.group(2) == "km" else 1)
            goal.hardConstraints.append(GoalConstraint(feature="DISTANCE_METERS", operator="LTE", typedValue=int(distance)))
            goal.searchArea["radiusMeters"] = int(distance)
        elif any(term in lowered for term in ("near my hotel", "gần khách sạn")):
            goal.rankingObjectives.insert(0, "PROXIMITY")
            if not context.get("hotelPlaceId"):
                goal.unsupportedRequirements.append(UnsupportedRequirement(phrase="near my hotel", requiredCapability="HOTEL_ANCHOR"))
            else:
                goal.searchArea = {"anchorType": "PLACE", "anchorPlaceId": context["hotelPlaceId"]}

        mandatory = any(term in lowered for term in ("must", "phải", "bắt buộc"))
        self._add_unsupported_preference(goal, lowered, ("quiet", "yên tĩnh"), "QUIETNESS", mandatory)
        self._add_unsupported_preference(goal, lowered, ("work", "working", "làm việc"), "WORK_SUITABILITY", mandatory)
        self._add_unsupported_preference(goal, lowered, ("romantic", "lãng mạn"), "AMBIENCE_ROMANTIC", mandatory)

        if any(term in lowered for term in ("cheap", "budget", "giá rẻ", "rẻ")):
            goal.rankingObjectives.insert(0, "PRICE")
            goal.unsupportedRequirements.append(UnsupportedRequirement(phrase="cheap", requiredCapability="NORMALIZED_PRICE"))
        price = re.search(r"(?:under|below|dưới|không quá)\s*(\d[\d.,]*)\s*(k|vnd|đ|đồng)?", lowered)
        if price:
            raw = float(price.group(1).replace(".", "").replace(",", ""))
            amount = raw * 1000 if price.group(2) == "k" else raw
            goal.hardConstraints.append(GoalConstraint(feature="PRICE_AMOUNT", operator="LTE", typedValue=amount))
            goal.unsupportedRequirements.append(UnsupportedRequirement(phrase=price.group(0), requiredCapability="NORMALIZED_PRICE"))

        late = re.search(r"(?:after|sau)\s*(\d{1,2})(?::(\d{2}))?", lowered)
        if "open late" in lowered or "mở muộn" in lowered or late:
            cutoff = f"{int(late.group(1)):02d}:{late.group(2) or '00'}" if late else "22:00"
            goal.rankingObjectives.insert(0, "OPENING_FIT")
            goal.requestedTime = {"localTime": cutoff}
            if late or mandatory:
                goal.hardConstraints.append(GoalConstraint(feature="OPEN_AT", operator="AT_OR_AFTER", typedValue=cutoff,
                                                            evidenceRequirement="FRESH_NORMALIZED_OPENING_HOURS"))
        goal.rankingObjectives = list(dict.fromkeys(goal.rankingObjectives))
        return goal

    @staticmethod
    def _add_unsupported_preference(goal: RecommendationGoal, text: str, terms: tuple[str, ...], feature: str, mandatory: bool) -> None:
        phrase = next((term for term in terms if term in text), None)
        if not phrase:
            return
        if mandatory:
            goal.hardConstraints.append(GoalConstraint(feature=feature, operator="EQ", typedValue=True,
                                                        evidenceRequirement="STRUCTURED_UNAVAILABLE"))
        else:
            goal.softPreferences.append(SoftPreference(feature=feature, importance="HIGH"))
        goal.unsupportedRequirements.append(UnsupportedRequirement(phrase=phrase, requiredCapability=feature))

    def fallback_travel_goal(self, text: str, context: dict[str, Any] | None = None,
                             prior_goal: TravelGoal | None = None) -> TravelGoal:
        """Graceful fallback that preserves prior goals and extracts obvious constraints

        without wiping food requirements.
        """
        context = context or {}
        lowered = text.casefold()

        # Destination resolution
        dest = None
        for key, canonical in CANONICAL_DESTINATIONS.items():
            if re.search(r"(?:\b|^)" + re.escape(key) + r"(?:\b|$)", lowered):
                dest = canonical
                break
        if not dest and prior_goal:
            dest = prior_goal.destination
        if not dest:
            dest = clean_destination_name(context.get("destination") or context.get("locationName") or "Đà Nẵng")
        dest = clean_destination_name(dest)

        # Excursions
        allowed_excursions = list(prior_goal.geographicScope.allowed_excursions if prior_goal else [])
        for exc in ("hội an", "bà nà", "bà nà hills", "huế"):
            if exc in lowered and exc not in [e.casefold() for e in allowed_excursions]:
                allowed_excursions.append(exc.title())

        geo_scope = refine_geographic_scope(resolve_geographic_scope(dest, allowed_excursions), text)

        # Duration
        days = 1
        dur_match = re.search(r"\b([1-7])\s*(?:days?|ngày)\b", lowered) or re.search(r"\b([1-7])\s*[nN]\s*\d+\s*[đĐdD]\b", lowered)
        if dur_match:
            days = int(dur_match.group(1))
        elif prior_goal:
            days = prior_goal.durationDays

        # Foods: preserve prior foods, add newly mentioned dishes
        foods: list[str] = list(prior_goal.mustEatFoods if prior_goal else [])
        food_candidates = [
            "bánh mì", "mì quảng", "bún chả cá", "bánh tráng cuốn thịt heo",
            "bánh xèo", "nem lụi", "hải sản", "chè", "cao lầu", "phở", "bún bò"
        ]
        for f in food_candidates:
            if f in lowered and f not in [existing.casefold() for existing in foods]:
                foods.append(f)

        local_specialties = bool(
            (prior_goal and prior_goal.localSpecialtiesRequired)
            or any(term in lowered for term in ("đặc sản", "specialties", "món địa phương", "ẩm thực địa phương"))
        )

        # Experiences
        experiences = list(prior_goal.requestedExperiences if prior_goal else [])
        if any(term in lowered for term in ("đi chơi", "tham quan", "sightseeing", "nổi tiếng", "địa điểm nổi tiếng")):
            if "sightseeing" not in experiences:
                experiences.append("sightseeing")
        if any(term in lowered for term in ("ăn uống", "ẩm thực", "ăn đặc sản", "món ngon", "quán ăn")):
            if "local_food" not in experiences:
                experiences.append("local_food")

        # Subgoals extraction
        subgoals: list[str] = []
        if any(term in lowered for term in ("mưa", "nắng", "thời tiết", "weather", "trời")):
            subgoals.append("check_weather")
        if any(term in lowered for term in ("cà phê", "cafe", "coffee")):
            subgoals.append("find_cafe")
        if any(term in lowered for term in ("khách sạn", "hotel", "resort", "homestay")):
            subgoals.append("hotel_nearby")
        if any(term in lowered for term in ("lịch", "itinerary", "kế hoạch", "tour")):
            subgoals.append("plan_itinerary")
        if any(term in lowered for term in ("đổi lịch", "sửa lịch", "thay đổi", "adjust")):
            subgoals.append("modify_itinerary")

        # Semantic desires (nuance preserving)
        semantic_desires: list[str] = []
        if any(term in lowered for term in ("chill", "thư giãn", "slow", "nhẹ nhàng", "relax")):
            semantic_desires.append("chill_relaxed")
        if any(term in lowered for term in ("sunset", "hoàng hôn", "chiều tà")):
            semantic_desires.append("sunset")
        if any(term in lowered for term in ("ít đông", "vắng", "yên tĩnh", "quiet", "tránh đông")):
            semantic_desires.append("quiet_uncrowded")
        if any(term in lowered for term in ("tránh tourist trap", "không tourist trap", "local", "bản địa", "quán ruột")):
            semantic_desires.append("authentic_local")
        if any(term in lowered for term in ("gia đình", "bố mẹ", "trẻ em", "family")):
            semantic_desires.append("family_friendly")
        if any(term in lowered for term in ("view đẹp", "sống ảo", "check-in", "aesthetic", "đẹp")):
            semantic_desires.append("aesthetic_view")

        # Mode detection (Discovery vs Action)
        is_action_mode = any(phrase in lowered for phrase in (
            "thêm vào lịch", "cho vào lịch", "chốt lịch", "lưu vào chuyến đi", "save trip", "thêm quán này"
        ))
        mode = "ACTION" if is_action_mode else "DISCOVERY"

        return TravelGoal(
            destination=dest,
            geographicScope=geo_scope,
            durationDays=days,
            mustEatFoods=foods,
            localSpecialtiesRequired=local_specialties,
            requestedExperiences=experiences,
            mealRequirements=["breakfast", "lunch", "dinner"] if (foods or local_specialties or "ăn uống" in lowered) else [],
            exclusions=list(prior_goal.exclusions if prior_goal else []),
            raw_request=text,
            subgoals=subgoals,
            semantic_desires=semantic_desires,
            mode=mode,
        )


def travel_goal_to_recommendation_goal(goal: TravelGoal) -> RecommendationGoal:
    """Converts a TravelGoal into a RecommendationGoal for place-service compatibility."""
    subjects = []
    raw_request = goal.raw_request.casefold()
    if "find_cafe" in goal.subgoals or any(term in raw_request for term in ("cà phê", "cafe", "café", "coffee")):
        subjects.append("CAFE")
    if "hotel_nearby" in goal.subgoals or any(
        term in raw_request for term in ("khách sạn", "khách sanj", "hotel", "resort", "homestay")
    ):
        subjects.append("HOTEL")
    if goal.mustEatFoods or goal.localSpecialtiesRequired:
        subjects.append("RESTAURANT")
    if goal.requestedExperiences:
        subjects.append("ATTRACTION")
    if not subjects:
        subjects = ["RESTAURANT", "ATTRACTION"]

    mentioned_areas = [
        area for area in ("sơn trà", "hải châu", "ngũ hành sơn", "thanh khê", "liên chiểu", "cẩm lệ")
        if area in raw_request
    ]
    # A contextual follow-up can contain the previous and replacement areas.
    # The last mention is the user's newest instruction and must win.
    named_area = max(mentioned_areas, key=raw_request.rfind) if mentioned_areas else None
    area_info = _KNOWN_LOCATION_SCOPES.get(named_area or "", {})
    search_area: dict[str, Any] = {"name": f"{named_area.title()}, {goal.destination}" if named_area else goal.destination}
    if goal.geographicScope.center_lat and goal.geographicScope.center_lng:
        search_area.update({
            "anchorType": "NAMED_AREA",
            "lat": area_info.get("center_lat", goal.geographicScope.center_lat),
            "lng": area_info.get("center_lng", goal.geographicScope.center_lng),
            "radiusMeters": int(area_info.get("hard_radius_km", goal.geographicScope.hard_radius_km) * 1000),
        })

    radius = re.search(r"(?:within|under|trong\s+bán\s+kính|trong\s+vòng|dưới)\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b", raw_request)
    if radius:
        distance = float(radius.group(1).replace(",", ".")) * (1000 if radius.group(2) == "km" else 1)
        search_area["radiusMeters"] = int(distance)

    count = re.search(
        r"(?:^|\s)(\d{1,2})\s+(?:quán|khách\s+sạn|hotels?|nhà\s+hàng|places?|locations?|kết quả)\b",
        raw_request,
    )
    requested_count = min(10, max(1, int(count.group(1)))) if count else 5
    preferences = []
    if any(term in raw_request for term in ("yên tĩnh", "quiet", "vắng", "ít đông")):
        preferences.append(SoftPreference(feature="QUIETNESS", importance="HIGH"))
    objectives = ["PROXIMITY", "QUALITY"] if any(term in raw_request for term in ("ưu tiên gần", "gần nhất", "nearby", "closest")) else ["RELEVANCE", "QUALITY"]

    return RecommendationGoal(
        goalType="RECOMMEND",
        subjectTypes=list(dict.fromkeys(subjects)),
        searchArea=search_area,
        softPreferences=preferences,
        rankingObjectives=objectives,
        requestedResultCount=requested_count,
    )
