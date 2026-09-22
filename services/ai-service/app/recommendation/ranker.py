import math
from dataclasses import dataclass
from typing import Any

from .goal_normalizer import RecommendationGoal


@dataclass(frozen=True)
class RankedRecommendations:
    candidates: list[dict[str, Any]]
    ranking: dict[str, Any]


class RecommendationRanker:
    """Versioned, deterministic, evidence-aware ranking. Missing optional features are neutral."""

    version = "recommendation-rank-v1"

    def rank(self, goal: RecommendationGoal, candidates: list[dict[str, Any]]) -> RankedRecommendations:
        scored: list[tuple[float, dict[str, Any], dict[str, float], list[str]]] = []
        for candidate in candidates:
            matched, missing = self._hard_constraints(goal, candidate)
            if not matched:
                continue
            contributions = self._features(goal, candidate)
            score = round(sum(contributions.values()), 6)
            enriched = dict(candidate)
            enriched["recommendationEvidence"] = {
                "rankingVersion": self.version,
                "score": score,
                "contributions": contributions,
                "matchedHardConstraints": [item.feature for item in goal.hardConstraints],
                "uncertainty": "KNOWN" if not missing else "UNKNOWN",
                "missingOptionalFeatures": missing,
            }
            scored.append((score, enriched, contributions, missing))

        scored.sort(key=lambda value: (-value[0], str(value[1].get("id") or value[1].get("name") or "")))
        diversified: list[dict[str, Any]] = []
        category_counts: dict[str, int] = {}
        for _, candidate, _, _ in scored:
            categories = candidate.get("categories") or ["UNKNOWN"]
            primary = str(categories[0]).upper()
            if category_counts.get(primary, 0) >= max(2, goal.requestedResultCount // 2):
                continue
            diversified.append(candidate)
            category_counts[primary] = category_counts.get(primary, 0) + 1
            if len(diversified) >= goal.requestedResultCount:
                break
        if len(diversified) < goal.requestedResultCount:
            existing = {str(item.get("id")) for item in diversified}
            diversified.extend(item for _, item, _, _ in scored if str(item.get("id")) not in existing)
        diversified = diversified[:goal.requestedResultCount]
        return RankedRecommendations(diversified, {
            "version": self.version,
            "inputCount": len(candidates),
            "eligibleCount": len(scored),
            "outputCount": len(diversified),
            "diversity": {"primaryCategoryCounts": category_counts},
        })

    def _hard_constraints(self, goal: RecommendationGoal, candidate: dict[str, Any]) -> tuple[bool, list[str]]:
        missing: list[str] = []
        for constraint in goal.hardConstraints:
            if constraint.feature == "DISTANCE_METERS":
                distance = self._distance(goal, candidate)
                if distance is None:
                    return False, [constraint.feature]
                if constraint.operator == "LTE" and distance > float(constraint.typedValue):
                    return False, []
            elif constraint.feature == "OPEN_AT":
                # No normalized, date/timezone-aware opening-hours contract exists yet.
                return False, [constraint.feature]
            elif constraint.feature == "PRICE_AMOUNT":
                # The current place contract has no normalized currency/amount evidence.
                return False, [constraint.feature]
            elif constraint.feature in {"QUIETNESS", "WORK_SUITABILITY", "AMBIENCE_ROMANTIC"}:
                # Descriptions/reviews cannot become authoritative structured attributes.
                return False, [constraint.feature]
        return True, missing

    def _features(self, goal: RecommendationGoal, candidate: dict[str, Any]) -> dict[str, float]:
        result: dict[str, float] = {}
        categories = " ".join(str(value).upper() for value in candidate.get("categories") or [])
        result["RELEVANCE"] = 1.0 if not goal.subjectTypes or any(value in categories for value in goal.subjectTypes) else 0.0
        rating = float(candidate.get("rating") or 0)
        reviews = max(0, int(candidate.get("userRatingCount") or 0))
        result["QUALITY"] = round((rating / 5.0) * min(1.0, math.log10(reviews + 10) / 3.0), 6)
        distance = self._distance(goal, candidate)
        if distance is not None:
            result["PROXIMITY"] = round(1.0 / (1.0 + distance / 1000.0), 6)
        freshness = str(candidate.get("freshness") or "UNKNOWN").upper()
        result["FRESHNESS"] = 0.25 if freshness == "FRESH" else 0.0
        return result

    @staticmethod
    def _distance(goal: RecommendationGoal, candidate: dict[str, Any]) -> float | None:
        area = goal.searchArea or {}
        location = candidate.get("location") or {}
        if area.get("lat") is None or area.get("lng") is None or location.get("lat") is None or location.get("lng") is None:
            return None
        lat1, lon1 = math.radians(float(area["lat"])), math.radians(float(area["lng"]))
        lat2, lon2 = math.radians(float(location["lat"])), math.radians(float(location["lng"]))
        value = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
        return 6_371_000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
