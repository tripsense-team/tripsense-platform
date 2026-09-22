import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ActionType, ContextFact, Conversation, Message, MessageRole, PendingClarification, now
from .post_preview import KIND as POST_PREVIEW_KIND, KEYS as POST_PREVIEW_KEYS, extract_answers as extract_post_preview_answers


@dataclass
class ContextResolution:
    status: str
    facts: dict[str, Any] = field(default_factory=dict)
    missing_keys: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    question: str | None = None
    clarification_attempt: int = 1
    post_preview_attempt: int = 1


class ContextResolver:
    _locations = (
        "đà nẵng", "da nang", "hà nội", "ha noi", "hội an", "hoi an", "huế", "hue",
        "sài gòn", "ho chi minh", "hồ chí minh", "đà lạt", "da lat", "nha trang", "phú quốc", "phu quoc",
        "quy nhơn", "quy nhon", "vũng tàu", "vung tau", "hạ long", "ha long", "ninh bình", "ninh binh",
        "sa pa", "sapa", "phan thiết", "phan thiet", "mũi né", "mui ne", "cần thơ", "can tho",
        "hải phòng", "hai phong", "côn đảo", "con dao", "sơn trà", "hải châu", "ngũ hành sơn",
        "thanh khê", "liên chiểu", "cẩm lệ"
    )
    _location_coordinates: dict[str, tuple[float, float]] = {
        "hội an": (15.8801, 108.3380),
        "hoi an": (15.8801, 108.3380),
        "đà nẵng": (16.0544, 108.2022),
        "da nang": (16.0544, 108.2022),
        "hà nội": (21.0285, 105.8542),
        "ha noi": (21.0285, 105.8542),
        "huế": (16.4637, 107.5909),
        "hue": (16.4637, 107.5909),
        "sài gòn": (10.8231, 106.6297),
        "ho chi minh": (10.8231, 106.6297),
        "hồ chí minh": (10.8231, 106.6297),
        "đà lạt": (11.9404, 108.4583),
        "da lat": (11.9404, 108.4583),
        "nha trang": (12.2388, 109.1967),
        "phú quốc": (10.2899, 103.9840),
        "phu quoc": (10.2899, 103.9840),
        "quy nhơn": (13.7820, 109.2197),
        "quy nhon": (13.7820, 109.2197),
        "vũng tàu": (10.3460, 107.0843),
        "vung tau": (10.3460, 107.0843),
        "hạ long": (20.9505, 107.0734),
        "ha long": (20.9505, 107.0734),
        "ninh bình": (20.2506, 105.9745),
        "ninh binh": (20.2506, 105.9745),
        "sa pa": (22.3364, 103.8438),
        "sapa": (22.3364, 103.8438),
        "phan thiết": (10.9805, 108.2615),
        "phan thiet": (10.9805, 108.2615),
        "mũi né": (10.9333, 108.2872),
        "mui ne": (10.9333, 108.2872),
        "cần thơ": (10.0452, 105.7469),
        "can tho": (10.0452, 105.7469),
        "hải phòng": (20.8449, 106.6881),
        "hai phong": (20.8449, 106.6881),
        "côn đảo": (8.6835, 106.6074),
        "con dao": (8.6835, 106.6074),
        "sơn trà": (16.10, 108.25),
        "hải châu": (16.05, 108.22),
        "ngũ hành sơn": (16.00, 108.25),
        "thanh khê": (16.06, 108.18),
        "liên chiểu": (16.12, 108.15),
        "cẩm lệ": (16.01, 108.20),
    }

    def resolve(self, db: Session, conversation: Conversation, trigger: Message, action: ActionType) -> ContextResolution:
        metadata = trigger.content_json or {}
        client_context = metadata.get("context") or {}
        facts = self._active_facts(db, conversation.owner_user_id, conversation.id)
        pending = db.scalar(select(PendingClarification).where(
            PendingClarification.owner_user_id == conversation.owner_user_id,
            PendingClarification.conversation_id == conversation.id,
            PendingClarification.status == "ACTIVE",
            PendingClarification.expires_at > now(),
        ).order_by(PendingClarification.created_at.desc()))
        current = self._extract(trigger.content, metadata, client_context)
        if action in {ActionType.PLAN_ITINERARY, ActionType.MODIFY_ITINERARY, ActionType.REFINE_PLAN}:
            current.update(extract_post_preview_answers(trigger.content, list(POST_PREVIEW_KEYS)))
        if pending and (pending.answer_schema_json or {}).get("kind") == POST_PREVIEW_KIND \
                and action == ActionType.REFINE_PLAN:
            # A departure-city answer is not a correction to the itinerary destination.
            current.pop("LOCATION", None)
            current.pop("DESTINATION", None)
        for key, value in current.items():
            previous = facts.get(key)
            if previous != value:
                self._persist_fact(db, conversation, trigger, key, value, previous)
            facts[key] = value

        clarification_attempt = 1
        post_preview_attempt = 1
        if pending:
            if (pending.answer_schema_json or {}).get("kind") == POST_PREVIEW_KIND:
                if action == ActionType.REFINE_PLAN:
                    post_preview_attempt = pending.attempt_number + 1
                    answers = extract_post_preview_answers(trigger.content, pending.required_keys_json or [])
                    for key, value in answers.items():
                        if facts.get(key) != value:
                            self._persist_fact(db, conversation, trigger, key, value, facts.get(key))
                        facts[key] = value
                    pending.status = "ANSWERED" if set(pending.required_keys_json or []) <= set(answers) else "UNRESOLVED"
                elif action == ActionType.PLAN_ITINERARY:
                    pending.status = "SUPERSEDED"
            elif self._apply_pending_answer(db, conversation, trigger, pending, facts):
                pending.status = "ANSWERED"
            else:
                pending.status = "UNRESOLVED"
                clarification_attempt = pending.attempt_number + 1

        missing: list[str] = []
        if action in {ActionType.PLACE_SEARCH, ActionType.PLACE_RECOMMENDATION} and not self._has_search_area(facts):
            missing.append("LOCATION")
        if action in {ActionType.PLAN_ITINERARY, ActionType.MODIFY_ITINERARY, ActionType.REFINE_PLAN}:
            if not facts.get("DESTINATION") and not facts.get("TRIP_ID"):
                missing.append("DESTINATION")
        if action == ActionType.TRIP_QA and not facts.get("TRIP_ID"):
            missing.append("TRIP_ID")
        if missing:
            return ContextResolution(status="NEEDS_CLARIFICATION", facts=facts, missing_keys=missing,
                                     question=self._question(missing[0], trigger.content),
                                     clarification_attempt=clarification_attempt,
                                     post_preview_attempt=post_preview_attempt)
        return ContextResolution(status="SUFFICIENT", facts=facts, post_preview_attempt=post_preview_attempt)

    def create_pending(self, db: Session, conversation: Conversation, run_id: str, missing: list[str], attempt: int,
                       kind: str | None = None) -> PendingClarification:
        item = PendingClarification(owner_user_id=conversation.owner_user_id, conversation_id=conversation.id,
                                    originating_run_id=run_id, required_keys_json=missing,
                                    answer_schema_json={"type": "string", "maxLength": 160, **({"kind": kind} if kind else {})},
                                    attempt_number=attempt,
                                    expires_at=now() + timedelta(hours=24))
        db.add(item)
        return item

    def update_summary(self, db: Session, conversation: Conversation, messages: list[Message], recent_count: int) -> None:
        older = messages[:-recent_count] if len(messages) > recent_count else []
        if not older:
            return
        source = "|".join(item.id for item in older)
        digest = hashlib.sha256(source.encode()).hexdigest()
        if conversation.summary_source_hash == digest:
            return
        facts = self._active_facts(db, conversation.owner_user_id, conversation.id)
        conversation.summary_json = {"schemaVersion": 1, "facts": facts, "messageCount": len(older)}
        conversation.summary_version = (conversation.summary_version or 0) + 1
        conversation.summary_through_message_id = older[-1].id
        conversation.summary_source_hash = digest

    @staticmethod
    def summary_prompt(conversation: Conversation) -> str | None:
        if not conversation.summary_json:
            return None
        return "CONVERSATION_SUMMARY_JSON (regenerable, lower precedence than canonical/current facts):\n" + json.dumps(conversation.summary_json, default=str)

    def _active_facts(self, db: Session, owner: str, conversation_id: str) -> dict[str, Any]:
        rows = db.scalars(select(ContextFact).where(ContextFact.owner_user_id == owner,
                         ContextFact.conversation_id == conversation_id,
                         ContextFact.state == "KNOWN").order_by(ContextFact.created_at)).all()
        facts: dict[str, Any] = {}
        for row in rows:
            facts[row.fact_key] = (row.value_json or {}).get("value")
        return facts

    def _persist_fact(self, db: Session, conversation: Conversation, trigger: Message, key: str, value: Any, previous: Any) -> None:
        existing = db.scalars(select(ContextFact).where(ContextFact.owner_user_id == conversation.owner_user_id,
                              ContextFact.conversation_id == conversation.id, ContextFact.fact_key == key,
                              ContextFact.state == "KNOWN")).all()
        for row in existing:
            row.state = "SUPERSEDED"
        db.add(ContextFact(owner_user_id=conversation.owner_user_id, conversation_id=conversation.id,
                           fact_key=key, value_json={"value": value}, source_type="CURRENT_MESSAGE",
                           source_ref=trigger.id, confidence=100, state="KNOWN",
                           sensitivity="SENSITIVE" if key in {"LAT", "LNG", "DEPARTURE_POINT"} else "NORMAL"))

    def _apply_pending_answer(self, db: Session, conversation: Conversation, trigger: Message,
                              pending: PendingClarification, facts: dict[str, Any]) -> bool:
        key = (pending.required_keys_json or [None])[0]
        text = trigger.content.strip()
        if key == "LOCATION" and self._valid_location_answer(text):
            self._persist_fact(db, conversation, trigger, "LOCATION", text, facts.get("LOCATION"))
            facts["LOCATION"] = text
            return True
        if key == "DESTINATION" and len(text) <= 160:
            self._persist_fact(db, conversation, trigger, "DESTINATION", text, facts.get("DESTINATION"))
            facts["DESTINATION"] = text
            return True
        return False

    @staticmethod
    def _valid_location_answer(text: str) -> bool:
        lowered = text.casefold().strip()
        if not 2 <= len(lowered) <= 160 or not any(character.isalpha() for character in lowered):
            return False
        if re.search(r"\b\d{1,3}\s*(?:people|persons?|người|days?|ngày)\b", lowered):
            return False
        return lowered not in {"yes", "no", "ok", "four", "có", "không"}

    def _extract(self, text: str, metadata: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        lowered = text.casefold()
        result: dict[str, Any] = {}
        if metadata.get("tripId") or context.get("tripId"):
            result["TRIP_ID"] = metadata.get("tripId") or context.get("tripId")
        if context.get("lat") is not None and context.get("lng") is not None:
            result["LAT"] = context["lat"]
            result["LNG"] = context["lng"]
        location = next((item for item in self._locations if item in lowered), None)
        if location:
            result["LOCATION"] = location
            result["DESTINATION"] = location
            coords = self._location_coordinates.get(location)
            if coords and result.get("LAT") is None:
                result["LAT"] = coords[0]
                result["LNG"] = coords[1]
        people = re.search(r"\b(\d{1,2})\s*(?:people|persons?|người)\b", lowered)
        if people:
            result["TRAVELER_COUNT"] = int(people.group(1))
        return result

    @staticmethod
    def _has_search_area(facts: dict[str, Any]) -> bool:
        return bool(facts.get("LOCATION") or (facts.get("LAT") is not None and facts.get("LNG") is not None) or facts.get("TRIP_ID"))

    @staticmethod
    def _question(key: str, text: str) -> str:
        vietnamese = bool(re.search(r"[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]", text.casefold()))
        if key == "LOCATION":
            return "Bạn muốn tìm ở khu vực hoặc thành phố nào?" if vietnamese else "Which area or city should I search in?"
        if key == "DESTINATION":
            return "Bạn muốn lên kế hoạch cho điểm đến nào?" if vietnamese else "Which destination should I plan for?"
        return "Bạn muốn hỏi về chuyến đi nào?" if vietnamese else "Which trip should I use?"
