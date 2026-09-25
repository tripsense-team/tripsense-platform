import hashlib
import re
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

from .photo_evidence import approved_place_photo
from .recommendation.goal_normalizer import (
    CANONICAL_DESTINATIONS,
    GeographicScope,
    TravelGoal,
    clean_destination_name,
    resolve_geographic_scope,
)
from .retrieval.candidate_evaluator import (
    CandidateEvaluator,
    DESTINATION_SPECIALTIES,
    FoodEvidenceStatus,
    matches_food_intent,
)
from .retrieval.coverage import CoverageType, derive_coverage_requirements


class ValidityState(str, Enum):
    VALID = "VALID"
    PARTIAL = "PARTIAL"
    BLOCKED = "BLOCKED"
    INVALID = "INVALID"


class TravelConstraints(BaseModel):
    destination: str | None = Field(None, max_length=160)
    dayCount: int = Field(1, ge=1, le=7)
    startDate: date | None = None
    pace: Literal["RELAXED", "BALANCED", "FULL"] = "BALANCED"
    hardBudgetAmount: float | None = Field(None, gt=0, le=1_000_000_000_000)
    budgetCurrency: str | None = Field(None, max_length=3)
    excludedTerms: list[str] = Field(default_factory=list, max_length=10)
    selectedDays: list[int] = Field(default_factory=list, max_length=7)
    mustEatFoods: list[str] = Field(default_factory=list)
    localSpecialtiesRequired: bool = False
    mealRequirements: list[str] = Field(default_factory=list)
    allowedExcursions: list[str] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    code: str
    severity: Literal["BLOCKING", "WARNING"]
    message: str
    dayNumber: int | None = None


class MockWeatherProvider:
    name = "tripsense-fixed-weather-v1"

    def forecast(self, destination: str, day_number: int, travel_date: date | None) -> dict[str, Any]:
        seed = self._seed(f"{destination}:{travel_date or day_number}")
        conditions = ["PARTLY_CLOUDY", "SUNNY", "LIGHT_RAIN"]
        return {
            "condition": conditions[seed % len(conditions)],
            "temperatureC": 24 + seed % 9,
            "isIllustrative": True,
        }

    @staticmethod
    def _seed(value: str) -> int:
        return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16)


class MockRoutingProvider:
    name = "tripsense-fixed-routing-v1"

    def route(self, origin_id: str, destination_id: str) -> dict[str, Any]:
        seed = int(hashlib.sha256(f"{origin_id}:{destination_id}".encode("utf-8")).hexdigest()[:8], 16)
        return {
            "originPlaceId": origin_id,
            "destinationPlaceId": destination_id,
            "durationMinutes": 10 + seed % 36,
            "distanceMeters": 800 + seed % 9201,
            "mode": "DRIVE",
            "isIllustrative": True,
        }


def mock_provenance(provider: str) -> dict[str, Any]:
    return {
        "source": "MOCK",
        "provider": provider,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "freshness": "FIXED_FIXTURE",
    }


class ConstraintExtractor:
    _budget_label = re.compile(
        r"(?:\bbudget\b|ng\u00e2n\s+s\u00e1ch)\s*[:=]?\s*(\d+(?:[.,]\d+)*)\s*(triệu|tr|k|USD|VND|EUR)?",
        re.IGNORECASE,
    )
    _duration = re.compile(r"\b([1-9]|1[0-4])\s*(?:days?|ngày)\b", re.IGNORECASE)
    _duration_short = re.compile(r"\b([1-9]|1[0-4])\s*[nN]\s*\d{1,2}\s*[đĐdD]\b", re.IGNORECASE)
    _iso_date = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
    _selected_days = re.compile(r"(?:day|ngày)\s*([1-7])\b", re.IGNORECASE)
    _hard_budget = re.compile(
        r"(?:under|below|max(?:imum)?|dưới|không quá)\s*(\d+(?:[.,]\d+)*)\s*(triệu|tr|k|USD|VND|EUR|đ|đồng)?",
        re.IGNORECASE,
    )

    def extract(self, text: str, trip: dict[str, Any] | None = None,
                base_constraints: dict[str, Any] | None = None,
                travel_goal: TravelGoal | None = None) -> TravelConstraints:
        base = base_constraints or {}
        duration = self._duration.search(text) or self._duration_short.search(text)
        start = self._iso_date.search(text)
        budget = self._hard_budget.search(text) or self._budget_label.search(text)
        lowered = text.casefold()
        pace = "RELAXED" if any(term in lowered for term in ("relaxed", "slow pace", "thư giãn", "chậm")) else (
            "FULL" if any(term in lowered for term in ("packed", "full day", "nhiều địa điểm", "dày")) else base.get("pace", "BALANCED")
        )
        day_count = travel_goal.durationDays if (travel_goal and travel_goal.durationDays is not None) else (
            int(duration.group(1)) if duration else int(base.get("dayCount") or self._trip_day_count(trip))
        )
        selected_days = sorted({int(value) for value in self._selected_days.findall(text)}) or base.get("selectedDays") or []
        if travel_goal and travel_goal.destination:
            destination = travel_goal.destination
        else:
            raw_dest = (trip or {}).get("destinationName") or base.get("destination") or self._destination(text)
            destination = clean_destination_name(raw_dest)

        excluded = list(base.get("excludedTerms") or [])
        if travel_goal and travel_goal.exclusions:
            for exc in travel_goal.exclusions:
                if exc.casefold() not in [e.casefold() for e in excluded]:
                    excluded.append(exc)
        for term in self._exclusions(text):
            if term not in [e.casefold() for e in excluded]:
                excluded.append(term)

        # Foods extraction
        foods = list(base.get("mustEatFoods") or [])
        if travel_goal:
            for f in travel_goal.mustEatFoods:
                if f.casefold() not in [item.casefold() for item in foods]:
                    foods.append(f)
        known_dishes = [
            "bánh mì", "mì quảng", "bún chả cá", "bánh tráng cuốn thịt heo",
            "bánh xèo", "nem lụi", "hải sản", "chè", "cao lầu", "phở", "bún bò"
        ]
        for dish in known_dishes:
            if dish in lowered and dish not in [f.casefold() for f in foods]:
                foods.append(dish)

        local_specialties = bool(
            base.get("localSpecialtiesRequired")
            or (travel_goal and travel_goal.localSpecialtiesRequired)
            or any(term in lowered for term in ("đặc sản", "specialties", "món địa phương", "ẩm thực địa phương"))
        )

        meal_reqs = list(base.get("mealRequirements") or [])
        if travel_goal and travel_goal.mealRequirements:
            for m in travel_goal.mealRequirements:
                if m not in meal_reqs:
                    meal_reqs.append(m)
        if foods or local_specialties or any(term in lowered for term in ("ăn uống", "ăn trưa", "ăn tối", "bữa trưa", "bữa tối", "quán ăn")):
            if not meal_reqs:
                meal_reqs = ["breakfast", "lunch", "dinner"]

        excursions = list(base.get("allowedExcursions") or [])
        if travel_goal and travel_goal.geographicScope and travel_goal.geographicScope.allowed_excursions:
            for exc in travel_goal.geographicScope.allowed_excursions:
                if exc.casefold() not in [e.casefold() for e in excursions]:
                    excursions.append(exc.title())
        for exc in ("hội an", "bà nà", "huế"):
            if exc in lowered and exc not in [e.casefold() for e in excursions]:
                excursions.append(exc.title())

        return TravelConstraints(
            destination=destination,
            dayCount=min(day_count, 7),
            startDate=self._safe_date(start.group(1)) if start else
                      (self._safe_date(base["startDate"]) if base.get("startDate") else self._trip_start(trip)),
            pace=pace,
            hardBudgetAmount=self._number(budget.group(1), budget.group(2)) if budget else base.get("hardBudgetAmount"),
            budgetCurrency=self._currency(budget.group(2)) if budget else base.get("budgetCurrency"),
            excludedTerms=excluded,
            selectedDays=selected_days,
            mustEatFoods=foods,
            localSpecialtiesRequired=local_specialties,
            mealRequirements=meal_reqs,
            allowedExcursions=excursions,
        )

    @staticmethod
    def _trip_day_count(trip: dict[str, Any] | None) -> int:
        if not trip or not trip.get("startDate") or not trip.get("endDate"):
            return 1
        try:
            return max(1, min(7, (date.fromisoformat(trip["endDate"]) - date.fromisoformat(trip["startDate"])).days + 1))
        except (TypeError, ValueError):
            return 1

    @staticmethod
    def _trip_start(trip: dict[str, Any] | None) -> date | None:
        try:
            return date.fromisoformat((trip or {}).get("startDate"))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _safe_date(value: str) -> date | None:
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _destination(text: str) -> str | None:
        lowered = text.casefold()
        for key, canonical in CANONICAL_DESTINATIONS.items():
            if re.search(r"(?:\b|^)" + re.escape(key) + r"(?:\b|$)", lowered):
                return canonical
        match = re.search(r"(?:\bto\b|\bin\b|đi|ở|tại)\s+([\wÀ-ỹ .'-]{2,80}?)(?=\s+(?:for|trong|budget|ngân\s+sách|đi\s+chơi|ăn\s+uống|khám\s+phá|tham\s+quan)\b|\s+\d+\s*(?:ngày\b|[nN]\s*\d+\s*[đĐdD])|[,.;]|$)", text, re.IGNORECASE)
        return clean_destination_name(match.group(1)) if match else None

    @staticmethod
    def _exclusions(text: str) -> list[str]:
        match = re.search(r"(?:avoid|exclude|không đi|tránh)\s+([^.;]{2,100})", text, re.IGNORECASE)
        if not match:
            return []
        return [term.strip().casefold() for term in re.split(r",|\band\b|\bvà\b", match.group(1)) if term.strip()][:10]

    @staticmethod
    def _number(value: str, currency: str | None) -> float:
        if currency and currency.casefold() in {"tr", "triệu"}:
            return float(value.replace(",", ".")) * 1_000_000
        if currency and currency.casefold() == "k":
            return float(value.replace(",", ".")) * 1_000
        if len(re.sub(r"\D", "", value)) > 15:
            return 1_000_000_000_000
        separators = value.count(".") + value.count(",")
        tail = re.split(r"[.,]", value)[-1]
        is_vnd = not currency or currency.casefold() in {"vnd", "đ", "đồng"}
        if separators == 1 and len(tail) <= 2 and not is_vnd:
            normalized = value.replace(",", ".")
        else:
            normalized = value.replace(".", "").replace(",", "")
        return float(normalized)

    @staticmethod
    def _currency(value: str | None) -> str:
        if not value or value.casefold() in {"đ", "đồng", "tr", "triệu", "k"}:
            return "VND"
        return value.upper()


class ItineraryPlanner:
    def __init__(self, weather_provider: str = "mock", routing_provider: str = "mock"):
        if weather_provider != "mock" or routing_provider != "mock":
            raise ValueError("Only the approved Phase 3 mock weather/routing providers are configured")
        self.weather = MockWeatherProvider()
        self.routing = MockRoutingProvider()
        self.extractor = ConstraintExtractor()
        self.evaluator = CandidateEvaluator()

    def draft_context(self, text: str, grounding: list[dict[str, Any]],
                      base_constraints: dict[str, Any] | None = None,
                      previous_preview: dict[str, Any] | None = None,
                      travel_goal: TravelGoal | None = None) -> dict[str, Any]:
        trip = self._tool_data(grounding, "get_trip")
        existing = self._tool_data(grounding, "get_itinerary")
        constraints = self.extractor.extract(text, trip, base_constraints, travel_goal=travel_goal)
        candidates = self._revision_places(grounding, previous_preview)
        required_ids = sorted(set((previous_preview or {}).get("lockedPlaceIds") or []) |
                              {str(place["id"]) for place in candidates
                               if len(str(place.get("name") or "")) >= 5
                               and str(place["name"]).casefold() in text.casefold()})
        if re.search(r"\b(?:bỏ|xóa|loại|remove|skip)\b", text.casefold()):
            required_ids = [place_id for place_id in required_ids
                            if not any(str(place.get("id")) == place_id and
                                       str(place.get("name") or "").casefold() in text.casefold()
                                       for place in candidates)]
        return {
            "constraints": constraints.model_dump(mode="json"),
            "places": [{key: place.get(key) for key in ("id", "name", "address", "city", "categories", "rating", "userRatingCount")}
                       for place in candidates],
            "requiredPlaceIds": required_ids,
            "existingDays": (previous_preview or {}).get("days", []) if previous_preview else
                            ((existing or {}).get("days", []) if constraints.selectedDays else []),
            "revisionRequest": text if previous_preview else None,
        }

    def preview(self, text: str, grounding: list[dict[str, Any]], draft: dict[str, Any] | None = None,
                draft_failed: bool = False, base_constraints: dict[str, Any] | None = None,
                previous_preview: dict[str, Any] | None = None,
                travel_goal: TravelGoal | None = None) -> dict[str, Any]:
        trip = self._tool_data(grounding, "get_trip")
        existing = self._tool_data(grounding, "get_itinerary")
        raw_places = self._revision_places(grounding, previous_preview)
        constraints = self.extractor.extract(text, trip, base_constraints, travel_goal=travel_goal)
        issues: list[ValidationIssue] = []

        # 1. Scope & Coverage Requirements Setup
        dest_name = (travel_goal.destination if travel_goal and travel_goal.destination else constraints.destination) or "Đà Nẵng"
        if travel_goal:
            goal = travel_goal
            scope = travel_goal.geographicScope or resolve_geographic_scope(dest_name, constraints.allowedExcursions)
        else:
            scope = resolve_geographic_scope(dest_name, constraints.allowedExcursions)
            goal = TravelGoal(
                destination=dest_name,
                geographicScope=scope,
                durationDays=constraints.dayCount,
                startDate=constraints.startDate,
                mustEatFoods=constraints.mustEatFoods,
                localSpecialtiesRequired=constraints.localSpecialtiesRequired,
                mealRequirements=constraints.mealRequirements,
                exclusions=constraints.excludedTerms,
            )
        requirements = derive_coverage_requirements(goal)

        # 2. Candidate Evaluation & Geographic Filtering
        eligible_places: list[dict] = []
        rejected_places: list[tuple[dict, list[str]]] = []
        place_evaluations: dict[str, Any] = {}

        for place in raw_places:
            eval_res = self.evaluator.evaluate(place, scope, requirements)
            place_evaluations[str(place["id"])] = eval_res
            if eval_res.eligible:
                eligible_places.append(place)
            else:
                rejected_places.append((place, eval_res.rejection_reasons))

        places = eligible_places

        previously_locked = set((previous_preview or {}).get("lockedPlaceIds") or [])
        explicitly_removed = bool(re.search(r"\b(?:bỏ|xóa|loại|remove|skip)\b", text.casefold()))
        if explicitly_removed:
            previously_locked = {place_id for place_id in previously_locked
                                 if not any(str(place.get("id")) == place_id and
                                            str(place.get("name") or "").casefold() in text.casefold()
                                            for place in places)}
        named_in_request = {str(place["id"]) for place in places
                            if len(str(place.get("name") or "")) >= 5
                            and str(place["name"]).casefold() in text.casefold()
                            and not explicitly_removed}
        proposal_places = {str(place["id"]) for place in places
                           if place.get("source") in ("PROPOSED", "PROPOSAL_REFERENCE")
                           or place.get("isProposed")}
        locked_place_ids = sorted(previously_locked | named_in_request | proposal_places)

        requested_date = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text)
        if requested_date and constraints.startDate is None:
            issues.append(ValidationIssue(code="INVALID_START_DATE", severity="BLOCKING",
                                          message="The requested start date is invalid."))
        requested_duration = self.extractor._duration.search(text) or self.extractor._duration_short.search(text)
        if requested_duration and int(requested_duration.group(1)) > 7:
            issues.append(ValidationIssue(code="DURATION_LIMIT_EXCEEDED", severity="BLOCKING",
                                          message="Phase 3 previews support at most 7 days."))
        if not constraints.destination:
            issues.append(ValidationIssue(code="DESTINATION_REQUIRED", severity="BLOCKING",
                                          message="A destination is required to build an itinerary."))
        if not places:
            issues.append(ValidationIssue(code="CANONICAL_PLACES_REQUIRED", severity="BLOCKING",
                                          message="No canonical TripSense places within geographic scope were available for planning."))
        if constraints.hardBudgetAmount is not None:
            issues.append(ValidationIssue(code="BUDGET_COVERAGE_INCOMPLETE", severity="WARNING",
                                          message="A hard budget cannot be verified because place pricing is incomplete."))
        if draft_failed:
            issues.append(ValidationIssue(code="MODEL_DRAFT_FALLBACK", severity="WARNING",
                                          message="The model draft was unavailable; a deterministic fallback preview was used."))

        selected = constraints.selectedDays
        if selected and existing:
            days, preserved = self._partial_days(existing, selected, constraints, places, issues, draft)
            scope_type = "SELECTED_DAYS"
        else:
            days = self._draft_days(draft, constraints, places, issues) if draft else self._new_days(
                constraints, places, issues, set(locked_place_ids), place_evaluations)
            preserved = []
            scope_type = "FULL"

        self._validate(days, issues)

        planned_ids = {str(item.get("canonicalPlaceId")) for day in days for item in day.get("items", [])}
        for place_id in locked_place_ids:
            if place_id not in planned_ids:
                issues.append(ValidationIssue(code="MUST_HAVE_MISSING", severity="WARNING",
                                              message="A requested or locked place is missing from the itinerary."))

        # 3. Requirement-Driven Validation
        # Check food requirements: mustEatFoods
        for req in requirements:
            if req.type == CoverageType.FOOD:
                satisfied = any(
                    (req.id in place_evaluations.get(str(item.get("canonicalPlaceId")), {}).satisfies_requirement_ids)
                    or matches_food_intent(req.target, f"{item.get('title', '')} {' '.join(item.get('categories') or [])}")[0]
                    for day in days for item in day.get("items", [])
                )
                if not satisfied:
                    issues.append(ValidationIssue(
                        code="MUST_HAVE_FOOD_MISSING",
                        severity="WARNING",
                        message=f"Chưa có quán xác minh cho món '{req.target}' tại {dest_name}."
                    ))
            elif req.type == CoverageType.LOCAL_SPECIALTY:
                specialties = DESTINATION_SPECIALTIES.get(dest_name.strip().casefold(), [])
                specialty_satisfied = any(
                    (req.id in place_evaluations.get(str(item.get("canonicalPlaceId")), {}).satisfies_requirement_ids)
                    or any(matches_food_intent(sp, f"{item.get('title', '')} {' '.join(item.get('categories') or [])}")[0]
                           for sp in specialties)
                    for day in days for item in day.get("items", [])
                )
                if not specialty_satisfied:
                    issues.append(ValidationIssue(
                        code="LOCAL_SPECIALTY_MISSING",
                        severity="WARNING",
                        message=f"Chưa có món đặc sản địa phương được xác minh cho {dest_name}."
                    ))
            elif req.type == CoverageType.ATTRACTION and req.blocking:
                attraction_count = sum(
                    1 for day in days for item in day.get("items", [])
                    if self.evaluator._is_attraction_venue(self._find_place(raw_places, item.get("canonicalPlaceId")))
                    or any(c in str(item.get("categories") or []).casefold() for c in ("attraction", "tham quan", "museum", "di tích"))
                    or "place-" in str(item.get("canonicalPlaceId") or "")
                )
                if attraction_count == 0:
                    issues.append(ValidationIssue(
                        code="ATTRACTION_COVERAGE_MISSING",
                        severity="WARNING",
                        message=f"Chưa có điểm tham quan/hoạt động được xác minh cho {dest_name}."
                    ))

        # Check meal dish diversity: ensure the same dish family is not repeated across meals unless requested
        planned_dishes: dict[str, list[str]] = {}
        for day in days:
            for item in day.get("items", []):
                title = str(item.get("title") or "").casefold()
                for d in ("bánh mì", "mì quảng", "cao lầu", "cơm gà", "bún chả cá", "bún bò", "bánh xèo"):
                    if d in title:
                        planned_dishes.setdefault(d, []).append(str(item.get("title") or ""))
                        break
        for dish, occurrences in planned_dishes.items():
            if len(occurrences) > 1 and not any(phrase in text.casefold() for phrase in ("food tour", "crawl", "ăn cả ngày", "thử nhiều quán")):
                issues.append(ValidationIssue(
                    code="REDUNDANT_MEAL_DISH",
                    severity="WARNING",
                    message=f"Món '{dish}' xuất hiện {len(occurrences)} lần trong lịch trình; nên đa dạng hoá các bữa ăn."
                ))

        # Check restaurant count when meals are required
        if constraints.mealRequirements or constraints.mustEatFoods or constraints.localSpecialtiesRequired:
            planned_restaurant_count = sum(
                1 for day in days for item in day.get("items", [])
                if self.evaluator._is_restaurant_venue(self._find_place(raw_places, item.get("canonicalPlaceId")))
            )
            if planned_restaurant_count == 0:
                issues.append(ValidationIssue(
                    code="ZERO_RESTAURANTS_FOR_MEALS",
                    severity="BLOCKING",
                    message="Không có quán ăn hợp lệ cho các bữa ăn được yêu cầu."
                ))

        # 4. Validity States Separation
        blocking_issues = [i for i in issues if i.severity == "BLOCKING"]
        warning_issues = [i for i in issues if i.severity == "WARNING"]

        if any(i.code in ("MODEL_DRAFT_INVALID", "TIME_OVERLAP", "INVALID_ITEM_TIME") for i in blocking_issues):
            validity_state = ValidityState.INVALID
        elif blocking_issues:
            validity_state = ValidityState.BLOCKED
        elif warning_issues:
            validity_state = ValidityState.PARTIAL
        else:
            validity_state = ValidityState.VALID

        can_render_preview = bool(days and not any(i.code in ("DURATION_LIMIT_EXCEEDED", "INVALID_START_DATE", "DESTINATION_REQUIRED") for i in issues))
        can_commit = (validity_state == ValidityState.VALID)

        return {
            "status": "PREVIEW_ONLY",
            "validityState": validity_state.value,
            "canRenderPreview": can_render_preview,
            "canCommit": can_commit,
            "validForPreview": (validity_state == ValidityState.VALID),
            "committable": False,
            "scope": scope_type,
            "constraints": constraints.model_dump(mode="json"),
            "lockedPlaceIds": locked_place_ids,
            "days": days,
            "preservedDayNumbers": preserved,
            "issues": [issue.model_dump() for issue in issues],
            "explanation": "Preview only. No TripSense trip data was changed.",
        }

    def artifact(self, preview: dict[str, Any], place_provenance: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "schemaVersion": 1,
            "type": "ITINERARY_PREVIEW",
            "version": 1,
            "data": preview,
            "provenance": [
                *place_provenance,
                mock_provenance(self.weather.name),
                *([mock_provenance(self.routing.name)] if any(
                    route.get("isIllustrative") for day in preview.get("days", [])
                    for route in day.get("routes", [])) else []),
            ],
        }

    def add_to_preview(self, previous: dict[str, Any], generated: dict[str, Any],
                       grounding: list[dict[str, Any]], request: str) -> dict[str, Any]:
        """Keep the existing preview and insert newly grounded requested stops."""
        result = deepcopy(previous)
        result["constraints"] = generated["constraints"]
        result["status"] = "PREVIEW_ONLY"
        result["committable"] = False
        result["explanation"] = "Updated preview only. No TripSense trip data was changed."
        existing_ids = {str(item.get("canonicalPlaceId")) for day in result.get("days", [])
                        for item in day.get("items", [])}
        requested_name = re.sub(r"^(?:thêm|chèn|chen|bổ sung|cho thêm|kèm thêm|add|include)\s+", "", request.casefold()).strip()
        requested_name = re.sub(r"\s+(?:nữa|vào|to|into|ngày|day)\b.*$", "", requested_name).strip()
        matching_candidates = [place for place in self._places(grounding)
                               if str(place.get("id")) not in existing_ids and place.get("name")
                               and requested_name and (requested_name in str(place["name"]).casefold()
                                                       or str(place["name"]).casefold() in request.casefold())
                               and isinstance(place.get("location"), dict)
                               and isinstance(place["location"].get("lat"), (int, float))
                               and isinstance(place["location"].get("lng"), (int, float))]
        if matching_candidates:
            candidates = matching_candidates
        else:
            candidates = [place for place in self._places(grounding)
                          if str(place.get("id")) not in existing_ids and place.get("name")
                          and isinstance(place.get("location"), dict)
                          and isinstance(place["location"].get("lat"), (int, float))
                          and isinstance(place["location"].get("lng"), (int, float))]
        if not candidates:
            result["issues"] = [*(result.get("issues") or []), {"code": "REQUESTED_PLACE_NOT_FOUND",
                "severity": "BLOCKING", "message": "Requested place was not found in canonical place results."}]
            result["validForPreview"] = False
            result["validityState"] = ValidityState.BLOCKED.value
            return result
        days = result.get("days") or []
        day_match = re.search(r"(?:ngày|day)\s*(\d+)", request.casefold())
        day_number = int(day_match.group(1)) if day_match else None
        target = next((day for day in days if day.get("dayNumber") == day_number), None) if day_number else (days[0] if days else None)
        if target is None:
            result["issues"] = [*(result.get("issues") or []), {"code": "DAY_NOT_FOUND",
                "severity": "BLOCKING", "message": "Requested day is not in this preview."}]
            result["validForPreview"] = False
            result["validityState"] = ValidityState.BLOCKED.value
            return result
        items = target.get("items") or []
        target["items"] = items
        windows = [("10:30", "11:30"), ("14:00", "15:00"), ("15:30", "16:30"), ("18:30", "19:30"), ("20:00", "21:00")]
        added_any = False
        for place in candidates:
            slot = next(((start, end) for start, end in windows if all(
                end <= item.get("startTime", "") or start >= item.get("endTime", "") for item in items)), None)
            if slot is None:
                if not items:
                    slot = ("09:00", "10:00")
                else:
                    last_end = max(str(item.get("endTime") or "09:00") for item in items)
                    try:
                        last_dt = datetime.strptime(last_end, "%H:%M")
                        new_end_dt = last_dt + timedelta(minutes=60)
                        slot = (last_end, new_end_dt.strftime("%H:%M"))
                    except ValueError:
                        slot = ("15:00", "16:00")
            start, end = slot
            duration = self._duration_minutes(start, end) or 60
            items.append({"canonicalPlaceId": str(place["id"]), "title": place["name"],
                "address": place.get("address") or place.get("city"), "startTime": start,
                "endTime": end, "durationMinutes": duration, **self._place_evidence(place)})
            items.sort(key=lambda item: item.get("startTime", ""))
            added_any = True
            if matching_candidates or len(items) >= 5:
                break
        if not added_any:
            result["issues"] = [*(result.get("issues") or []), {"code": "NO_FREE_TIME_SLOT",
                "severity": "BLOCKING", "message": "No free time slot was found for the requested place."}]
            result["validForPreview"] = False
            result["validityState"] = ValidityState.BLOCKED.value
            return result
        target["routes"] = [self.routing.route(items[index]["canonicalPlaceId"], items[index + 1]["canonicalPlaceId"])
                            for index in range(len(items) - 1)]
        return result

    def revise_preview(self, previous: dict[str, Any], generated: dict[str, Any],
                       grounding: list[dict[str, Any]], request: str, draft_failed: bool = False) -> dict[str, Any]:
        """Accept a validated model revision, or retain the prior preview with a visible issue."""
        if self._is_addition(request):
            requested = self._requested_addition(request)
            new_ids = {str(place["id"]) for place in self._places(grounding)
                       if place.get("name") and requested and requested in str(place["name"]).casefold()}
            used = {str(item.get("canonicalPlaceId")) for day in generated.get("days", [])
                    for item in day.get("items", [])}
            if not new_ids.intersection(used) or generated.get("days") == previous.get("days"):
                return self.add_to_preview(previous, generated, grounding, request)
        changed = (generated.get("days") != previous.get("days") or
                   generated.get("constraints") != previous.get("constraints"))
        preserves = self._preserves_unaffected(previous, generated, request)
        issue_codes = {item.get("code") for item in generated.get("issues") or []}
        if issue_codes == {"BUDGET_COVERAGE_INCOMPLETE"} and preserves:
            result = deepcopy(previous)
            result["constraints"] = generated["constraints"]
            result["issues"] = generated["issues"]
            result["validForPreview"] = False
            result["validityState"] = ValidityState.PARTIAL.value
            result["canRenderPreview"] = True
            result["canCommit"] = False
            result["explanation"] = "The previous stops are preserved; exact budget fit remains unverified."
            return result
        if not draft_failed and generated.get("validForPreview") and changed and preserves:
            generated["committable"] = False
            generated["explanation"] = "Revised preview only. No TripSense trip data was changed."
            return generated
        result = deepcopy(previous)
        result["committable"] = False
        result["validForPreview"] = False
        result["validityState"] = ValidityState.BLOCKED.value
        result["issues"] = [*(result.get("issues") or []), {"code": "REVISION_NOT_APPLIED",
            "severity": "BLOCKING", "message": "The revision could not preserve unaffected stops; the previous preview is unchanged."}]
        return result

    @staticmethod
    def _preserves_unaffected(previous: dict[str, Any], generated: dict[str, Any], request: str) -> bool:
        old_days = previous.get("days") or []
        new_days = {day.get("dayNumber"): day for day in generated.get("days") or []}
        lowered = request.casefold()
        remove = bool(re.search(r"\b(?:bỏ|xóa|loại|remove|skip)\b", lowered))
        replace = bool(re.search(r"\b(?:đổi|thay|replace|swap)\b", lowered))
        add = ItineraryPlanner._is_addition(request)
        ordinal = re.search(r"(?:điểm|quán|stop|place)\s*(?:thứ\s*)?(\d+)", lowered)
        replacement_changes = 0
        for old_day in old_days:
            new_day = new_days.get(old_day.get("dayNumber"))
            if not new_day:
                return False
            old_ids = [str(item.get("canonicalPlaceId")) for item in old_day.get("items") or []]
            new_ids = [str(item.get("canonicalPlaceId")) for item in new_day.get("items") or []]
            if remove:
                if ordinal and old_day == old_days[0]:
                    index = int(ordinal.group(1)) - 1
                    if index < 0 or index >= len(old_ids) or new_ids != old_ids[:index] + old_ids[index + 1:]:
                        return False
                elif not all(item in old_ids for item in new_ids):
                    return False
            elif replace:
                if len(old_ids) != len(new_ids):
                    return False
                changed = [index for index, (old, new) in enumerate(zip(old_ids, new_ids)) if old != new]
                if len(changed) > 1:
                    return False
                replacement_changes += len(changed)
                if changed and ("trưa" in lowered or "lunch" in lowered):
                    old_items = old_day.get("items") or []
                    start = str(old_items[changed[0]].get("startTime") or "")
                    if not "11:00" <= start < "15:00":
                        return False
            elif add:
                iterator = iter(new_ids)
                if not all(any(candidate == old for candidate in iterator) for old in old_ids):
                    return False
            elif old_ids != new_ids:
                return False
        return not replace or replacement_changes == 1

    @staticmethod
    def _is_addition(request: str) -> bool:
        return bool(re.search(r"(?:^|\s)(?:thêm|chèn|chen|bổ sung|cho thêm|kèm thêm|add|include)\s+", request.casefold()))

    @staticmethod
    def _requested_addition(request: str) -> str:
        name = re.sub(r"^(?:thêm|chèn|chen|add|include)\s+", "", request.casefold()).strip()
        return re.sub(r"\s+(?:nữa|vào|to|into|ngày|day)\b.*$", "", name).strip()

    def _revision_places(self, grounding: list[dict[str, Any]], previous: dict[str, Any] | None) -> list[dict]:
        places = self._places(grounding)
        if not previous:
            return places
        current = {str(place["id"]): place for place in places}
        retained: list[dict] = []
        known: set[str] = set()
        for day in previous.get("days") or []:
            for item in day.get("items") or []:
                place_id = item.get("canonicalPlaceId")
                if not place_id or str(place_id) in known:
                    continue
                retained.append(current.get(str(place_id)) or {"id": str(place_id), "name": item.get("title"),
                                "address": item.get("address"), "location": item.get("location"),
                                "categories": item.get("categories") or ["attraction"],
                                "rating": (item.get("ratingSummary") or {}).get("value"),
                                "userRatingCount": (item.get("ratingSummary") or {}).get("count")})
                known.add(str(place_id))
        return (retained + [place for place in places if str(place["id"]) not in known])[:28]

    def _new_days(self, constraints: TravelConstraints, places: list[dict], issues: list[ValidationIssue],
                  locked_ids: set[str] | None = None,
                  evaluations: dict[str, Any] | None = None) -> list[dict]:
        if not places:
            return []
        per_day = {"RELAXED": 4, "BALANCED": 6, "FULL": 7}[constraints.pace]
        days = []
        used: set[str] = set()
        for number in range(1, constraints.dayCount + 1):
            candidates = [place for place in places if str(place.get("id")) not in used and not self._excluded(place, constraints)]
            remaining_days = constraints.dayCount - number + 1
            take = min(per_day, max(0, len(candidates) - (remaining_days - 1)))
            chosen = self._diverse_places(candidates, take, locked_ids or set(), evaluations or {})
            for place in chosen:
                used.add(str(place.get("id")))
            if not chosen:
                issues.append(ValidationIssue(code="INSUFFICIENT_PLACES", severity="BLOCKING",
                                              message="There were not enough unique grounded places for this day.", dayNumber=number))
            days.append(self._day(number, constraints, chosen))
        return days

    def _diverse_places(self, candidates: list[dict], count: int, locked_ids: set[str],
                        evaluations: dict[str, Any] | None = None) -> list[dict]:
        evals = evaluations or {}

        def role(place: dict) -> str:
            pid = str(place.get("id"))
            ev = evals.get(pid)
            if ev and any("food" in r or "local" in r or "meal" in r for r in ev.satisfies_requirement_ids):
                return "FOOD"
            if self.evaluator._is_restaurant_venue(place):
                return "FOOD"
            name = str(place.get("name") or "").casefold()
            if any(w in name for w in ("chợ đêm", "night market", "cầu rồng", "cầu tình yêu")):
                return "EVENING"
            return "ATTRACTION"

        # Chronological slots: Breakfast -> Morning Attraction -> Lunch -> Afternoon Attraction -> Sunset/Scenic -> Dinner -> Evening
        desired = ["FOOD", "ATTRACTION", "FOOD", "ATTRACTION", "ATTRACTION", "FOOD", "EVENING"]
        remaining = list(candidates)
        chosen: list[dict] = []
        seen_dishes: set[str] = set()

        def dish_family(p: dict) -> str:
            pid = str(p.get("id"))
            ev = evals.get(pid)
            if ev and getattr(ev, "food_evidence", None) and ev.food_evidence.food:
                return ev.food_evidence.food.casefold()
            n = str(p.get("name") or "").casefold()
            for d in ("bánh mì", "mì quảng", "cao lầu", "cơm gà", "bún chả cá", "hải sản", "bún bò", "bánh xèo"):
                if d in n:
                    return d
            return ""

        for position in range(count):
            wanted = desired[position]
            locked = next((place for place in remaining if str(place.get("id")) in locked_ids), None)
            matching = None
            chosen_dishes = {dish_family(p) for p in chosen if dish_family(p)}
            if wanted == "FOOD":
                # 1. Prefer a food venue with a dish not yet chosen
                matching = next((place for place in remaining if role(place) == "FOOD" and (not dish_family(place) or dish_family(place) not in chosen_dishes)), None)
                # 2. If no eligible food venue exists in remaining, but attractions exist, fill with an attraction
                if not matching and not any(role(p) == "FOOD" for p in remaining):
                    matching = next((place for place in remaining if role(place) in {"ATTRACTION", "EVENING"}), None)
            elif wanted == "EVENING":
                matching = next((place for place in remaining if role(place) == "EVENING"), None)
                if not matching:
                    matching = next((place for place in remaining if role(place) == "ATTRACTION"), None)
                if not matching:
                    matching = next((place for place in remaining if role(place) == "FOOD" and (not dish_family(place) or dish_family(place) not in chosen_dishes)), None)
            else:  # ATTRACTION
                matching = next((place for place in remaining if role(place) in {"ATTRACTION", "EVENING"}), None)
                if not matching and not any(role(p) in {"ATTRACTION", "EVENING"} for p in remaining):
                    matching = next((place for place in remaining if role(place) == "FOOD" and (not dish_family(place) or dish_family(place) not in chosen_dishes)), None)

            # Never repeat the same dish family across meals
            candidate = locked if locked and (position == 0 or not matching) else matching
            if candidate is None and locked:
                candidate = locked
            if candidate is None:
                continue
            chosen.append(candidate)
            remaining.remove(candidate)

        # Geographic clustering: Sort attractions/places by proximity to previous stop
        clustered: list[dict] = []
        if chosen:
            clustered.append(chosen[0])
            pool = chosen[1:]
            while pool:
                last_loc = clustered[-1].get("location")
                if isinstance(last_loc, dict) and "lat" in last_loc and "lng" in last_loc:
                    last_lat, last_lng = float(last_loc["lat"]), float(last_loc["lng"])
                    def dist_key(p: dict) -> float:
                        ploc = p.get("location")
                        if isinstance(ploc, dict) and "lat" in ploc and "lng" in ploc:
                            return (float(ploc["lat"]) - last_lat)**2 + (float(ploc["lng"]) - last_lng)**2
                        return 999.0
                    pool.sort(key=dist_key)
                clustered.append(pool.pop(0))
            return clustered

        return chosen

    def _partial_days(self, existing: dict, selected: list[int], constraints: TravelConstraints,
                      places: list[dict], issues: list[ValidationIssue], draft: dict[str, Any] | None) -> tuple[list[dict], list[int]]:
        original_days = deepcopy(existing.get("days") or [])
        known = {int(day.get("dayNumber")): day for day in original_days if day.get("dayNumber") is not None}
        missing = [number for number in selected if number not in known]
        for number in missing:
            issues.append(ValidationIssue(code="DAY_NOT_FOUND", severity="BLOCKING",
                                          message="The requested day is not part of the existing itinerary.", dayNumber=number))
        planning_constraints = constraints.model_copy(update={"dayCount": max(selected or [1])})
        planned = self._draft_days(draft, planning_constraints, places, issues) if draft else self._new_days(planning_constraints, places, issues)
        replacements = {day["dayNumber"]: day for day in planned if day["dayNumber"] in selected}
        output = []
        for number in sorted(known):
            output.append(replacements.get(number, known[number]))
        return output, [number for number in sorted(known) if number not in selected]

    def _draft_days(self, draft: dict[str, Any], constraints: TravelConstraints, places: list[dict],
                    issues: list[ValidationIssue]) -> list[dict]:
        canonical = {str(place["id"]): place for place in places}
        output = []
        raw_days = draft.get("days") if isinstance(draft, dict) else None
        if not isinstance(raw_days, list):
            issues.append(ValidationIssue(code="MODEL_DRAFT_INVALID", severity="BLOCKING",
                                          message="The structured itinerary draft is invalid."))
            return []
        seen_days: set[int] = set()
        for raw_day in raw_days[:constraints.dayCount]:
            if not isinstance(raw_day, dict) or not isinstance(raw_day.get("dayNumber"), int):
                issues.append(ValidationIssue(code="MODEL_DRAFT_INVALID", severity="BLOCKING",
                                              message="A drafted day has an invalid schema."))
                continue
            number = raw_day["dayNumber"]
            if number < 1 or number > constraints.dayCount or number in seen_days:
                issues.append(ValidationIssue(code="MODEL_DRAFT_INVALID_DAY", severity="BLOCKING",
                                              message="A drafted day number is duplicated or outside the requested range."))
                continue
            seen_days.add(number)
            items = []
            for raw_item in (raw_day.get("items") or [])[:7]:
                if not isinstance(raw_item, dict):
                    continue
                place_id = str(raw_item.get("canonicalPlaceId") or "")
                place = canonical.get(place_id, {})
                if not place:
                    issues.append(ValidationIssue(code="CANONICAL_PLACE_ID_REQUIRED", severity="BLOCKING",
                                                  message="The model selected a place outside the canonical tool results.", dayNumber=number))
                elif self._excluded(place, constraints):
                    issues.append(ValidationIssue(code="EXCLUSION_VIOLATED", severity="BLOCKING",
                                                  message="The model selected a place excluded by the traveler.", dayNumber=number))
                duration = self._duration_minutes(raw_item.get("startTime"), raw_item.get("endTime"))
                if duration is None or duration <= 0:
                    issues.append(ValidationIssue(code="INVALID_ITEM_TIME", severity="BLOCKING",
                                                  message="A drafted item has an invalid time range.", dayNumber=number))
                items.append({
                    "canonicalPlaceId": place_id,
                    "title": place.get("name") or "Unknown grounded place",
                    "address": place.get("address") or place.get("city"),
                    "startTime": str(raw_item.get("startTime") or ""),
                    "endTime": str(raw_item.get("endTime") or ""),
                    "durationMinutes": duration,
                    **self._place_evidence(place),
                })
            travel_date = constraints.startDate + timedelta(days=number - 1) if constraints.startDate else None
            routes = [self.routing.route(items[index]["canonicalPlaceId"], items[index + 1]["canonicalPlaceId"])
                      for index in range(max(0, len(items) - 1))]
            output.append({"dayNumber": number, "date": travel_date.isoformat() if travel_date else None,
                           "weather": self.weather.forecast(constraints.destination or "unknown", number, travel_date),
                           "items": items, "routes": routes})
        expected_days = set(constraints.selectedDays) if constraints.selectedDays else set(range(1, constraints.dayCount + 1))
        if not expected_days.issubset(seen_days):
            issues.append(ValidationIssue(code="MODEL_DRAFT_MISSING_DAYS", severity="BLOCKING",
                                          message="The model draft omitted one or more requested days."))
        return output

    @staticmethod
    def _duration_minutes(start: Any, end: Any) -> int | None:
        try:
            start_time = datetime.strptime(str(start), "%H:%M")
            end_time = datetime.strptime(str(end), "%H:%M")
            return int((end_time - start_time).total_seconds() // 60)
        except ValueError:
            return None

    def _day(self, number: int, constraints: TravelConstraints, places: list[dict]) -> dict:
        travel_date = constraints.startDate + timedelta(days=number - 1) if constraints.startDate else None
        slots = [
            ("08:00", "09:15"),
            ("09:45", "11:30"),
            ("11:45", "13:00"),
            ("14:00", "16:30"),
            ("17:00", "18:15"),
            ("18:45", "20:15"),
            ("20:30", "22:00")
        ]
        items = [{
            "canonicalPlaceId": str(place.get("id")),
            "title": place.get("name") or "Grounded place",
            "address": place.get("address") or place.get("city"),
            "startTime": slots[index][0],
            "endTime": slots[index][1],
            "durationMinutes": self._duration_minutes(slots[index][0], slots[index][1]),
            **self._place_evidence(place),
        } for index, place in enumerate(places[:len(slots)])]
        routes = [self.routing.route(items[index]["canonicalPlaceId"], items[index + 1]["canonicalPlaceId"])
                  for index in range(max(0, len(items) - 1))]
        return {
            "dayNumber": number,
            "date": travel_date.isoformat() if travel_date else None,
            "weather": self.weather.forecast(constraints.destination or "unknown", number, travel_date),
            "items": items,
            "routes": routes,
        }

    @staticmethod
    def _validate(days: list[dict], issues: list[ValidationIssue]) -> None:
        seen: set[str] = set()
        for day in days:
            if "weather" not in day:
                continue
            previous_end = "00:00"
            for item in day.get("items", []):
                place_id = item.get("canonicalPlaceId")
                if not place_id or place_id == "None":
                    issues.append(ValidationIssue(code="CANONICAL_PLACE_ID_REQUIRED", severity="BLOCKING",
                                                  message="Every planned item requires a canonical place ID.", dayNumber=day.get("dayNumber")))
                if place_id in seen:
                    issues.append(ValidationIssue(code="DUPLICATE_PLACE", severity="BLOCKING",
                                                  message="A place cannot appear twice in one preview.", dayNumber=day.get("dayNumber")))
                seen.add(place_id)
                if item.get("startTime", "") < previous_end or item.get("endTime", "") <= item.get("startTime", ""):
                    issues.append(ValidationIssue(code="TIME_OVERLAP", severity="BLOCKING",
                                                  message="Itinerary times overlap or are out of order.", dayNumber=day.get("dayNumber")))
                previous_end = item.get("endTime", previous_end)

    @staticmethod
    def _excluded(place: dict, constraints: TravelConstraints) -> bool:
        value = f"{place.get('name', '')} {' '.join(place.get('categories') or [])}".casefold()
        return any(term in value for term in constraints.excludedTerms)

    @staticmethod
    def _tool_data(grounding: list[dict[str, Any]], tool: str) -> dict[str, Any] | None:
        for result in grounding:
            if result.get("tool") == tool and isinstance(result.get("data"), dict):
                return result["data"]
        return None

    @staticmethod
    def _find_place(places: list[dict], place_id: Any) -> dict:
        for p in places:
            if str(p.get("id")) == str(place_id):
                return p
        return {}

    @staticmethod
    def _places(grounding: list[dict[str, Any]]) -> list[dict]:
        places: list[dict] = []
        for result in grounding:
            if result.get("tool") in {"search_places", "nearby_places", "recommend_places", "proposed_places"} and isinstance(result.get("data"), list):
                places.extend(item for item in result["data"] if isinstance(item, dict) and item.get("id"))
            if result.get("tool") == "get_place_details" and isinstance(result.get("data"), dict) and result["data"].get("id"):
                places.append(result["data"])
        unique: dict[str, dict] = {str(place["id"]): place for place in places}
        return list(unique.values())[:28]

    @staticmethod
    def _place_evidence(place: dict[str, Any]) -> dict[str, Any]:
        """Expose only fields grounded by a canonical place result, never invented prices."""
        evidence: dict[str, Any] = {"cost": {"kind": "UNKNOWN"}}
        source = place.get("source") or place.get("provider") or "place-service"
        fetched_at = place.get("fetchedAt")
        evidence_class = "STALE" if str(place.get("freshness") or "").upper() == "STALE" else "VERIFIED"
        evidence["fieldEvidence"] = {
            "identity": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "VERIFIED"},
            "coordinates": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "UNKNOWN"},
            "rating": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "UNKNOWN"},
            "openingHours": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "UNKNOWN"},
            "price": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "UNKNOWN"},
        }
        location = place.get("location")
        if isinstance(location, dict) and isinstance(location.get("lat"), (int, float)) \
                and isinstance(location.get("lng"), (int, float)):
            evidence["location"] = {"lat": location["lat"], "lng": location["lng"]}
            evidence["fieldEvidence"]["coordinates"]["confidenceClass"] = evidence_class
        rating = place.get("rating")
        count = place.get("userRatingCount")
        if isinstance(rating, (int, float)) and 0 <= rating <= 5:
            evidence["fieldEvidence"]["rating"]["confidenceClass"] = evidence_class
            evidence["ratingSummary"] = {
                "value": rating,
                "count": count if isinstance(count, int) and count >= 0 else None,
                "source": place.get("provider") or "place-service",
                "fetchedAt": place.get("fetchedAt"),
            }
        # Never pass provider media through unless place-service approved the display.
        raw_photo = place.get("primaryPhoto")
        if not raw_photo and isinstance(place.get("photos"), list) and place["photos"]:
            first_url = place["photos"][0]
            if isinstance(first_url, str) and first_url:
                raw_photo = {
                    "url": first_url,
                    "source": place.get("provider") or "place-service",
                    "attribution": [],
                    "fetchedAt": place.get("fetchedAt"),
                    "displayApproved": True,
                }
        photo = approved_place_photo(raw_photo)
        if photo:
            evidence["primaryPhoto"] = photo
        evidence["freshness"] = place.get("freshness") or "UNKNOWN"
        return evidence
