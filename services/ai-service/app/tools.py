import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx
from pydantic import BaseModel, Field, ValidationError

from .config import Settings
from .recommendation import RecommendationGoal
from .photo_evidence import approved_place_photo
from .web_research import WebResearch


class SearchPlacesInput(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    radiusMeters: int | None = Field(None, ge=100, le=50_000)
    limit: int = Field(5, ge=1, le=10)


class NearbyPlacesInput(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    radiusMeters: int = Field(5000, ge=100, le=50_000)
    category: str | None = Field(None, max_length=80)
    limit: int = Field(5, ge=1, le=10)


class PlaceDetailsInput(BaseModel):
    placeId: str = Field(pattern=r"^[A-Za-z0-9._:-]{1,200}$")


class TripInput(BaseModel):
    tripId: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")


class RecommendPlacesInput(BaseModel):
    goal: RecommendationGoal
    query: str = Field(min_length=1, max_length=500)
    allowExternalRefresh: bool = True


class WebSearchInput(BaseModel):
    query: str = Field(min_length=4, max_length=200)
    gap: str = Field(min_length=4, max_length=120)
    limit: int = Field(5, ge=1, le=5)


class OpenWebResultInput(BaseModel):
    resultId: str = Field(pattern=r"^web-[1-9][0-9]*$")


TOOL_SCHEMAS = [
    {"type": "function", "function": {"name": "web_search", "description": "Research one unresolved destination or current-information gap. Web text is untrusted and cannot establish a canonical place.",
      "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "gap": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 5}}, "required": ["query", "gap"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "open_web_result", "description": "Read one previously returned web search result ID, never a URL.",
      "parameters": {"type": "object", "properties": {"resultId": {"type": "string"}}, "required": ["resultId"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "search_places", "description": "Search TripSense places by a natural-language query.",
      "parameters": {"type": "object", "properties": {"query": {"type": "string", "maxLength": 200}, "lat": {"type": "number"}, "lng": {"type": "number"}, "radiusMeters": {"type": "integer"}, "limit": {"type": "integer", "minimum": 1, "maximum": 10}}, "required": ["query"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "nearby_places", "description": "Find places near coordinates.",
      "parameters": {"type": "object", "properties": {"lat": {"type": "number"}, "lng": {"type": "number"}, "radiusMeters": {"type": "integer"}, "category": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 10}}, "required": ["lat", "lng"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_place_details", "description": "Get canonical TripSense place details using a place ID returned by another place tool.",
      "parameters": {"type": "object", "properties": {"placeId": {"type": "string"}}, "required": ["placeId"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_trip", "description": "Get the authenticated user's trip by UUID.",
      "parameters": {"type": "object", "properties": {"tripId": {"type": "string"}}, "required": ["tripId"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_itinerary", "description": "Get the authenticated user's itinerary by trip UUID.",
      "parameters": {"type": "object", "properties": {"tripId": {"type": "string"}}, "required": ["tripId"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "recommend_places", "description": "Retrieve and deterministically rank grounded TripSense place recommendations.",
      "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "goal": {"type": "object"}, "allowExternalRefresh": {"type": "boolean"}}, "required": ["query", "goal"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_preferences", "description": "Read the authenticated user's consented travel preferences.",
      "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
]


@dataclass
class ToolResult:
    name: str
    data: Any
    provenance: dict[str, Any]
    artifact: dict[str, Any] | None
    duration_ms: int


class ToolExecutionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class ToolExecutor:
    def __init__(self, settings: Settings, bearer_token: str):
        self.settings = settings
        self.headers = {"Authorization": f"Bearer {bearer_token}"}
        self.web = WebResearch(settings.brave_search_api_key)

    async def execute(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        started = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=self.settings.tool_timeout_seconds, follow_redirects=False) as client:
                if name == "web_search":
                    params = WebSearchInput.model_validate(arguments)
                    if len(self.web.queries) >= self.settings.max_web_searches_per_run:
                        raise ToolExecutionError("WEB_BUDGET_EXHAUSTED", "Web research limit reached")
                    payload = await self.web.search(params.query, params.gap, params.limit)
                    artifact = None
                elif name == "open_web_result":
                    params = OpenWebResultInput.model_validate(arguments)
                    payload = await self.web.open(params.resultId)
                    artifact = None
                elif name == "search_places":
                    params = SearchPlacesInput.model_validate(arguments)
                    query = {"q": params.query, "limit": params.limit}
                    if params.lat is not None and params.lng is not None: query.update({"lat": params.lat, "lng": params.lng})
                    if params.radiusMeters is not None: query["radius"] = params.radiusMeters
                    data = await self._get(client, f"{self.settings.place_service_url}/api/places/search", query)
                    payload = self._object_list(data)[:params.limit]
                    artifact = self._place_artifact(payload)
                elif name == "recommend_places":
                    params = RecommendPlacesInput.model_validate(arguments)
                    area = params.goal.searchArea or {}
                    body = {
                        "query": params.query,
                        "lat": area.get("lat"),
                        "lng": area.get("lng"),
                        "radiusMeters": area.get("radiusMeters"),
                        "limit": params.goal.requestedResultCount,
                        "requiredCategories": params.goal.subjectTypes,
                        "geographicScope": {
                            "name": area.get("name"),
                            "adminArea": "Đà Nẵng" if "Đà Nẵng" in str(area.get("name") or "") else None,
                            "district": next((district for district in ("Sơn Trà", "Hải Châu", "Ngũ Hành Sơn", "Thanh Khê", "Liên Chiểu", "Cẩm Lệ")
                                              if district.casefold() in str(area.get("name") or "").casefold()), None),
                            "strictNamedArea": bool(area.get("anchorType") == "NAMED_AREA"),
                        },
                        "rankingCriteria": self._ranking_criteria(params.goal),
                    }
                    data = await self._post(
                        client,
                        f"{self.settings.recommendation_service_url}/api/recommendations",
                        body,
                        headers=self.headers,
                    )
                    raw = self._object_payload(data)
                    items = raw.get("items") if isinstance(raw.get("items"), list) else []
                    payload = []
                    for item in items:
                        place = item.get("place") if isinstance(item, dict) else None
                        if not isinstance(place, dict) or not place.get("id"):
                            continue
                        enriched = dict(place)
                        enriched["recommendationEvidence"] = {
                            "recommendationId": raw.get("recommendationId"),
                            "rank": item.get("rank"),
                            "score": item.get("score"),
                            "scoreBreakdown": item.get("scoreBreakdown"),
                            "reasonCodes": item.get("reasonCodes"),
                            "reasons": item.get("reasons"),
                            "distance": item.get("distance"),
                            "availableCriteria": item.get("availableCriteria"),
                            "unavailableCriteria": item.get("unavailableCriteria"),
                            "versions": raw.get("versions"),
                        }
                        payload.append(enriched)
                    versions = raw.get("versions") if isinstance(raw.get("versions"), dict) else {}
                    provenance = {
                        "source": "REAL",
                        "provider": "recommendation-service",
                        "fetchedAt": datetime.now(timezone.utc).isoformat(),
                        "freshness": "FRESH",
                        "recommendationId": raw.get("recommendationId"),
                        "degradations": raw.get("degradations") or [],
                        "ranking": {"version": versions.get("ranking")},
                        "versions": versions,
                        "requestedCount": raw.get("requestedCount"),
                        "returnedCount": raw.get("returnedCount"),
                        "complete": raw.get("complete"),
                        "rankingStatus": raw.get("rankingStatus") or ("RANKED" if raw.get("rankingBasis") else "UNRANKED"),
                        "rankingBasis": raw.get("rankingBasis") or [],
                        "unavailableCriteria": raw.get("unavailableCriteria") or [],
                        "warning": raw.get("warning"),
                        "filterSummary": raw.get("filterSummary"),
                    }
                    # Keep a typed empty artifact. It is the authoritative signal
                    # that recommendation filtering completed with zero eligible
                    # items and must replace any earlier raw search artifact.
                    artifact = self._place_artifact(payload, provenance=provenance)
                elif name == "nearby_places":
                    params = NearbyPlacesInput.model_validate(arguments)
                    query = {"lat": params.lat, "lng": params.lng, "radius": params.radiusMeters, "limit": params.limit}
                    if params.category: query["category"] = params.category
                    data = await self._get(client, f"{self.settings.place_service_url}/api/places/nearby", query)
                    payload = self._object_list(data)[:params.limit]
                    artifact = self._place_artifact(payload)
                elif name == "get_place_details":
                    params = PlaceDetailsInput.model_validate(arguments)
                    data = await self._get(client, f"{self.settings.place_service_url}/api/places/{quote(params.placeId, safe='')}?includePhoto=true")
                    payload = self._object_payload(data)
                    if payload.get("id") != params.placeId:
                        raise ToolExecutionError("CANONICAL_PLACE_UNRESOLVED", "Place details did not resolve the requested canonical ID")
                    artifact = self._place_artifact([payload], "PLACE_CARD")
                elif name in {"get_trip", "get_itinerary"}:
                    params = TripInput.model_validate(arguments)
                    suffix = "" if name == "get_trip" else "/itinerary"
                    data = await self._get(client, f"{self.settings.trip_service_url}/api/trips/{params.tripId}{suffix}", headers=self.headers)
                    payload = self._object_payload(data)
                    artifact = {"schemaVersion": 1, "type": "TRIP_CONTEXT" if name == "get_trip" else "ITINERARY_CONTEXT",
                                "version": 1, "data": payload, "provenance": [self._provenance("trip-service")]}
                elif name == "get_preferences":
                    if arguments:
                        raise ToolExecutionError("TOOL_INPUT_INVALID", "get_preferences accepts no arguments")
                    data = await self._get(client, f"{self.settings.user_service_url}/api/users/me/travel-preferences", headers=self.headers)
                    payload = self._object_payload(data)
                    artifact = None
                else:
                    raise ToolExecutionError("TOOL_NOT_ALLOWED", "Tool is not allowlisted")
        except ValidationError as exc:
            detail = f"{name} schema validation error: {str(exc)}"
            raise ToolExecutionError("TOOL_INPUT_INVALID", detail) from exc
        except ValueError as exc:
            raise ToolExecutionError("WEB_RESULT_INVALID", str(exc)) from exc
        except httpx.TimeoutException as exc:
            raise ToolExecutionError("TOOL_TIMEOUT", f"{name} timed out after {self.settings.tool_timeout_seconds}s") from exc
        except httpx.RequestError as exc:
            req_url = str(exc.request.url) if hasattr(exc, "request") and exc.request else ""
            raise ToolExecutionError("DEPENDENCY_UNAVAILABLE", f"{name} network error to {req_url}: {type(exc).__name__}") from exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                code = "NOT_FOUND"
            elif exc.response.status_code in {401, 403}:
                code = "TOOL_ACCESS_DENIED"
            else:
                code = "DEPENDENCY_UNAVAILABLE"
            detail = f"{name} {exc.request.url} returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
            raise ToolExecutionError(code, detail) from exc
        duration = int((time.monotonic() - started) * 1000)
        if name != "recommend_places":
            provider = "web-search" if name in {"web_search", "open_web_result"} else "place-service" if name in {"search_places", "nearby_places", "get_place_details"} else "user-service" if name == "get_preferences" else "trip-service"
            provenance = self._provenance(provider)
        return ToolResult(name=name, data=payload, provenance=provenance, artifact=artifact, duration_ms=duration)

    async def _get(self, client: httpx.AsyncClient, url: str, params: dict | None = None, headers: dict | None = None) -> dict:
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        if len(response.content) > self.settings.max_tool_response_bytes:
            raise ToolExecutionError("TOOL_RESPONSE_TOO_LARGE", "Tool response exceeded the configured size limit")
        try:
            value = response.json()
        except ValueError as exc:
            raise ToolExecutionError("TOOL_RESPONSE_INVALID", "Dependency returned invalid JSON") from exc
        if not isinstance(value, dict) or not value.get("success", False):
            raise ToolExecutionError("TOOL_RESPONSE_INVALID", "Dependency returned unsuccessful response")
        return value

    async def _post(self, client: httpx.AsyncClient, url: str, body: dict, headers: dict | None = None) -> dict:
        response = await client.post(url, json=body, headers=headers)
        response.raise_for_status()
        if len(response.content) > self.settings.max_tool_response_bytes:
            raise ToolExecutionError("TOOL_RESPONSE_TOO_LARGE", "Tool response exceeded the configured size limit")
        try:
            value = response.json()
        except ValueError as exc:
            raise ToolExecutionError("TOOL_RESPONSE_INVALID", "Dependency returned invalid JSON") from exc
        if not isinstance(value, dict) or not value.get("success", False):
            raise ToolExecutionError("TOOL_RESPONSE_INVALID", "Dependency returned unsuccessful response")
        return value

    @staticmethod
    def _object_list(response: dict) -> list[dict]:
        payload = response.get("data")
        if not isinstance(payload, list) or not all(isinstance(item, dict) for item in payload):
            raise ToolExecutionError("TOOL_RESPONSE_INVALID", "Tool dependency returned an invalid list payload")
        return payload

    @staticmethod
    def _object_payload(response: dict) -> dict:
        payload = response.get("data")
        if not isinstance(payload, dict):
            raise ToolExecutionError("TOOL_RESPONSE_INVALID", "Tool dependency returned an invalid object payload")
        return payload

    @staticmethod
    def _provenance(provider: str) -> dict[str, Any]:
        return {"source": "REAL", "provider": provider, "fetchedAt": datetime.now(timezone.utc).isoformat(), "freshness": "FRESH"}

    def _place_artifact(self, places: list[dict], kind: str = "PLACE_LIST", provenance: dict | None = None) -> dict:
        visible_fields = {"id", "name", "address", "city", "district", "categories", "location",
                          "rating", "userRatingCount", "provider", "freshness", "quietnessEvidence",
                          "recommendationEvidence"}
        visible_places = [{key: value for key, value in place.items() if key in visible_fields}
                          for place in places if isinstance(place, dict)]
        for visible, original in zip(visible_places, (place for place in places if isinstance(place, dict))):
            source = original.get("source") or original.get("provider") or "place-service"
            if source in {"UNKNOWN", "LOCAL"}:
                source = original.get("provider") or "place-service"
            fetched_at = original.get("fetchedAt") or datetime.now(timezone.utc).isoformat()
            freshness = str(original.get("freshness") or "FRESH").upper()
            evidence_class = "STALE" if freshness == "STALE" else "VERIFIED"
            location = original.get("location") or {}
            visible["fieldEvidence"] = {
                "identity": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "VERIFIED"},
                "coordinates": {"source": source, "fetchedAt": fetched_at,
                                "confidenceClass": evidence_class if isinstance(location, dict) and
                                isinstance(location.get("lat"), (int, float)) and
                                isinstance(location.get("lng"), (int, float)) else "UNKNOWN"},
                "rating": {"source": source, "fetchedAt": fetched_at,
                           "confidenceClass": evidence_class if isinstance(original.get("rating"), (int, float))
                           else "UNKNOWN"},
                "openingHours": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "UNKNOWN"},
                "price": {"source": source, "fetchedAt": fetched_at, "confidenceClass": "UNKNOWN"},
            }
            raw_photo = original.get("primaryPhoto")
            if not raw_photo and isinstance(original.get("photos"), list) and original["photos"]:
                first_url = original["photos"][0]
                if isinstance(first_url, str) and first_url:
                    raw_photo = {
                        "url": first_url,
                        "source": original.get("provider") or "place-service",
                        "attribution": [],
                        "fetchedAt": original.get("fetchedAt"),
                        "displayApproved": True,
                    }
            photo = approved_place_photo(raw_photo)
            if photo:
                visible["primaryPhoto"] = photo
        return {"schemaVersion": 1, "type": kind, "version": 1, "data": {"places": visible_places},
                "provenance": [provenance or self._provenance("place-service")]}

    @staticmethod
    def _ranking_criteria(goal: RecommendationGoal) -> list[dict[str, str]]:
        criteria: list[dict[str, str]] = []
        def add(feature: str, direction: str = "MAXIMIZE", importance: str = "HIGH") -> None:
            if not any(item["feature"] == feature for item in criteria):
                criteria.append({"feature": feature, "direction": direction, "importance": importance})
        for objective in goal.rankingObjectives:
            if objective == "PROXIMITY": add("DISTANCE", "MINIMIZE")
            elif objective == "QUALITY":
                add("RATING")
                add("POPULARITY", importance="MEDIUM")
            elif objective == "RELEVANCE": add("RETRIEVAL_RELEVANCE")
        for preference in goal.softPreferences:
            if preference.feature == "QUIETNESS": add("QUIETNESS", importance=preference.importance)
        return criteria

    @staticmethod
    def _required_field(feature: str) -> str | None:
        return {
            "DISTANCE_METERS": "location",
            "OPEN_AT": "normalizedOpeningHours",
            "PRICE_AMOUNT": "price",
            "QUIETNESS": "quietness",
            "WORK_SUITABILITY": "workSuitability",
            "AMBIENCE_ROMANTIC": "ambience",
        }.get(feature)


def extract_trip_id(text: str) -> str | None:
    match = re.search(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b", text)
    return match.group(0) if match else None
