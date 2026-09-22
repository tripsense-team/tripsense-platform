from typing import Any, Literal

from pydantic import BaseModel, Field

from ..recommendation import RecommendationGoal


class RetrievalAssessment(BaseModel):
    status: Literal["SUFFICIENT", "REFRESHABLE", "INSUFFICIENT", "PARTIALLY_SUFFICIENT"]
    reasonCodes: list[str] = Field(default_factory=list)
    candidateCount: int = 0
    eligibleCount: int = 0
    requiredFieldCoverage: dict[str, float] = Field(default_factory=dict)
    is_discovery_usable: bool = True


class RetrievalSufficiencyPolicy:
    def assess(self, goal: RecommendationGoal, candidates: list[dict[str, Any]], refresh_available: bool = True) -> RetrievalAssessment:
        target = max(goal.requestedResultCount, 1)
        reasons: list[str] = []
        required = {item.feature for item in goal.hardConstraints}
        desired = {item.feature for item in goal.softPreferences}
        desired.update({
            "PRICE_AMOUNT" for objective in goal.rankingObjectives if objective == "PRICE"
        })
        desired.update({
            "OPEN_AT" for objective in goal.rankingObjectives if objective == "OPENING_FIT"
        })
        desired.update({
            "AMBIENCE_ROMANTIC" for objective in goal.rankingObjectives if objective == "AMBIENCE_FIT"
        })
        coverage: dict[str, float] = {}
        for feature in sorted(required):
            supported = sum(1 for item in candidates if self._supports(item, feature))
            coverage[feature] = supported / len(candidates) if candidates else 0.0
            if coverage[feature] < 1.0:
                reasons.append(f"MANDATORY_FIELD_MISSING:{feature}")
        if len(candidates) < target:
            reasons.append("TOO_FEW_CANDIDATES")
        for feature in sorted(desired - required):
            supported = sum(1 for item in candidates if self._supports(item, feature))
            coverage[feature] = supported / len(candidates) if candidates else 0.0
            if coverage[feature] == 0.0:
                reasons.append(f"OBJECTIVE_EVIDENCE_MISSING:{feature}")
        if goal.searchArea and any(item.get("location") is None for item in candidates):
            reasons.append("WEAK_GEOGRAPHIC_COVERAGE")
        stale = [item for item in candidates if str(item.get("freshness", "")).upper() == "STALE"]
        if stale and required:
            reasons.append("STALE_REQUIRED_EVIDENCE")
        if not reasons:
            return RetrievalAssessment(status="SUFFICIENT", candidateCount=len(candidates), eligibleCount=len(candidates),
                                       requiredFieldCoverage=coverage, is_discovery_usable=True)
        status = "REFRESHABLE" if refresh_available else "INSUFFICIENT"
        has_mandatory_failure = any(r.startswith("MANDATORY_FIELD_MISSING") for r in reasons)
        is_discovery_usable = bool(candidates and (not has_mandatory_failure or len(candidates) >= 1))
        return RetrievalAssessment(status=status, reasonCodes=reasons, candidateCount=len(candidates),
                                   eligibleCount=sum(1 for item in candidates if all(self._supports(item, f) for f in required)),
                                   requiredFieldCoverage=coverage, is_discovery_usable=is_discovery_usable)

    @staticmethod
    def _supports(candidate: dict[str, Any], feature: str) -> bool:
        mapping = {
            "DISTANCE_METERS": "location",
            "OPEN_AT": "normalizedOpeningHours",
            "PRICE_AMOUNT": "price",
            "QUIETNESS": "quietness",
            "WORK_SUITABILITY": "workSuitability",
            "AMBIENCE_ROMANTIC": "ambience",
        }
        field = mapping.get(feature)
        return field is None or candidate.get(field) is not None
