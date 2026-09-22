from typing import Literal
from pydantic import BaseModel

from .candidate_evaluator import CandidateEvaluation
from .coverage import CoverageRequirement


class EvidenceGap(BaseModel):
    id: str
    requirement_id: str
    type: str
    target: str
    dayPart: str | None = None
    blocking: bool = True
    attempt_count: int = 0
    status: Literal["OPEN", "RESOLVED", "UNRESOLVED"] = "OPEN"
    last_action_signature: str | None = None
    evidence_gain: int = 0


def detect_evidence_gaps(requirements: list[CoverageRequirement],
                         evaluations: list[CandidateEvaluation],
                         existing_gaps: list[EvidenceGap] | None = None) -> list[EvidenceGap]:
    """Evaluates candidates against coverage requirements to produce the active list

    of typed EvidenceGaps.
    """
    existing_map = {g.requirement_id: g for g in (existing_gaps or [])}
    gaps: list[EvidenceGap] = []

    # Map requirementId -> number of eligible candidates satisfying it
    satisfied_counts: dict[str, int] = {}
    for ev in evaluations:
        if not ev.eligible:
            continue
        for req_id in ev.satisfies_requirement_ids:
            satisfied_counts[req_id] = satisfied_counts.get(req_id, 0) + 1

    for req in requirements:
        count = satisfied_counts.get(req.id, 0)
        previous = existing_map.get(req.id)
        attempts = previous.attempt_count if previous else 0
        last_sig = previous.last_action_signature if previous else None

        if count < req.minCount:
            gap_status: Literal["OPEN", "RESOLVED", "UNRESOLVED"] = (
                "UNRESOLVED" if attempts >= 3 else "OPEN"
            )
            gaps.append(
                EvidenceGap(
                    id=f"gap_{req.id}",
                    requirement_id=req.id,
                    type=req.type.value,
                    target=req.target,
                    dayPart=req.mealSlot,
                    blocking=req.blocking,
                    attempt_count=attempts,
                    status=gap_status,
                    last_action_signature=last_sig,
                    evidence_gain=0,
                )
            )

    return gaps


def measure_evidence_gain(before_gaps: list[EvidenceGap],
                          after_gaps: list[EvidenceGap]) -> int:
    """Measures net evidence gain: positive integer if fewer blocking or open gaps remain."""
    before_open = sum(1 for g in before_gaps if g.status == "OPEN")
    after_open = sum(1 for g in after_gaps if g.status == "OPEN")
    return max(0, before_open - after_open)
