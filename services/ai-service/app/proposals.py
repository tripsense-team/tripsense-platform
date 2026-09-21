import hashlib
import json
from datetime import timedelta
from typing import Any
from uuid import uuid4

from .models import Proposal, now


def content_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_proposal(owner: str, conversation_id: str, run_id: str, trip_id: str,
                   preview: dict[str, Any], grounding: list[dict[str, Any]], provenance: list[dict[str, Any]]) -> Proposal:
    trip = next((item.get("data") for item in grounding if item.get("tool") == "get_trip" and isinstance(item.get("data"), dict)), {})
    itinerary = next((item.get("data") for item in grounding if item.get("tool") == "get_itinerary" and isinstance(item.get("data"), dict)), {})
    days_by_number = {int(day.get("dayNumber")): day for day in itinerary.get("days", []) if day.get("dayNumber") is not None}
    operations: list[dict[str, Any]] = []
    affected = set(preview.get("constraints", {}).get("selectedDays") or [day.get("dayNumber") for day in preview.get("days", [])])
    for day in preview.get("days", []):
        number = day.get("dayNumber")
        if number not in affected:
            continue
        canonical_day = days_by_number.get(int(number or 0), {})
        day_id = canonical_day.get("id")
        if not day_id:
            continue
        for item in canonical_day.get("items", []):
            operations.append({"type": "DELETE", "dayId": day_id, "itemId": item.get("id"),
                               "expectedItemVersion": item.get("version")})
        for order, item in enumerate(day.get("items", []), start=1):
            operations.append({"type": "ADD", "dayId": day_id, "placeRef": item.get("canonicalPlaceId"),
                               "title": item.get("title"), "itemType": "PLACE", "startTime": item.get("startTime"),
                               "endTime": item.get("endTime"), "durationMinutes": item.get("durationMinutes"),
                               "sortOrder": order * 100})
    issues = list(preview.get("issues") or [])
    # The trip batch route is fail-closed until it can verify an owned immutable
    # READY proposal. Do not advertise a confirmable proposal meanwhile.
    issues.append({"code": "TRIP_COMMIT_UNAVAILABLE", "severity": "BLOCKING",
                   "message": "Verified trip commit is not available yet."})
    contains_mock = any(str(item.get("source", "")).upper() == "MOCK" for item in provenance if isinstance(item, dict))
    if contains_mock:
        issues.append({"code": "MOCK_EVIDENCE_NON_COMMITTABLE", "severity": "BLOCKING",
                       "message": "Mock provider evidence cannot support a real trip mutation."})
    if not operations:
        issues.append({"code": "NO_RESOLVED_OPERATIONS", "severity": "BLOCKING",
                       "message": "No existing trip days could be resolved for mutation."})
    blocking = any(item.get("severity") == "BLOCKING" for item in issues)
    payload = {"proposalId": None, "expectedTripRevision": int(trip.get("aggregateRevision") or 0),
               "scope": preview.get("scope") or "FULL", "operations": operations}
    proposal = Proposal(id=str(uuid4()), owner_user_id=owner, conversation_id=conversation_id, run_id=run_id,
                        target_trip_id=trip_id, scope=payload["scope"], processing_state=None,
                        business_state="INVALID" if blocking else "READY", payload_version=1,
                        payload_json=payload, payload_hash="", validation_json={"issues": issues, "valid": not blocking},
                        evidence_json={"provenance": provenance}, base_trip_revision=payload["expectedTripRevision"],
                        expires_at=now() + timedelta(minutes=30))
    proposal.payload_json["proposalId"] = proposal.id
    proposal.payload_hash = content_hash(proposal.payload_json)
    return proposal


def proposal_json(proposal: Proposal) -> dict[str, Any]:
    return {"id": proposal.id, "conversationId": proposal.conversation_id, "runId": proposal.run_id,
            "targetTripId": proposal.target_trip_id, "scope": proposal.scope,
            "processingState": proposal.processing_state, "businessState": proposal.business_state,
            "payloadVersion": proposal.payload_version, "payloadHash": proposal.payload_hash,
            "payload": proposal.payload_json, "validation": proposal.validation_json,
            "evidence": proposal.evidence_json, "baseTripRevision": proposal.base_trip_revision,
            "expiresAt": proposal.expires_at, "receipt": proposal.applied_receipt_json}
