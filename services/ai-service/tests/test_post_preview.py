import os
import json
import uuid
from datetime import datetime, timedelta, timezone

os.environ.setdefault("AI_DATABASE_URL", "sqlite:///./test_ai_post_preview.db")
os.environ.setdefault("JWT_ACCESS_SECRET", "test-secret-with-sufficient-length")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ["EUREKA_SERVER"] = ""

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.context.post_preview import extract_answers, question_block, required_keys
from app.database import SessionLocal
from app.main import app
from app.models import ContextFact, PendingClarification, Run
from app.planning import ConstraintExtractor
from app.tools import ToolResult


def test_two_questions_parse_typed_answers_without_inventing_budget_scope():
    constraints = {"hardBudgetAmount": 3_000_000, "budgetCurrency": "VND"}
    missing = required_keys(constraints, {})
    assert missing == ["TRANSPORT_INCLUDED", "TRAVELER_COUNT", "BUDGET_SCOPE", "LODGING_TYPE"]
    question = question_block(missing, 3_000_000)
    assert question.count("\n1.") == 1 and question.count("\n2.") == 1
    assert "3.000.000 VND" in question
    answers = extract_answers("Không tính vé, 2 người, 3 triệu cho cả nhóm, hostel", missing)
    assert answers == {"TRANSPORT_INCLUDED": False, "TRAVELER_COUNT": 2,
                       "BUDGET_SCOPE": "GROUP", "LODGING_TYPE": "HOSTEL_HOMESTAY"}
    assert extract_answers("2 người, hostel", missing) == {
        "TRAVELER_COUNT": 2, "LODGING_TYPE": "HOSTEL_HOMESTAY"}
    assert required_keys(constraints, answers) == []
    assert required_keys({}, {}) == []
    assert required_keys(constraints, {**answers, "TRANSPORT_INCLUDED": True}) == ["DEPARTURE_POINT"]
    assert extract_answers("Hà Nội", ["DEPARTURE_POINT"]) == {"DEPARTURE_POINT": "Hà Nội"}


def test_followup_constraints_preserve_destination_duration_and_budget():
    extractor = ConstraintExtractor()
    base = extractor.extract("Plan a 3 days itinerary in Da Nang, budget 3000000 VND").model_dump(mode="json")
    refined = extractor.extract("Không tính vé, 2 người, hostel", base_constraints=base)
    assert refined.destination == "Da Nang"
    assert refined.dayCount == 3
    assert refined.hardBudgetAmount == 3_000_000
    assert refined.budgetCurrency == "VND"


class FakeAdapter:
    def __init__(self, _):
        pass

    async def select_tools(self, _, max_tool_calls=None):
        return []

    async def draft_itinerary(self, context):
        count = context["constraints"]["dayCount"]
        return {"days": [{"dayNumber": day, "items": [
            {"canonicalPlaceId": f"place-{day}", "startTime": "09:00", "endTime": "10:30"}]}
            for day in range(1, count + 1)]}

    async def stream(self, _, max_output_tokens=None):
        yield "Here is a provisional itinerary with unknown price coverage."


class FakeTools:
    def __init__(self, *_):
        pass

    async def execute(self, name, _):
        provenance = {"source": "REAL", "provider": "place-service", "freshness": "FRESH"}
        if name == "get_preferences":
            return ToolResult(name=name, data={}, provenance=provenance, artifact=None, duration_ms=1)
        places = [{"id": f"place-{index}", "name": f"Place {index}",
                   "location": {"lat": 16.0 + index / 100, "lng": 108.2}}
                  for index in range(1, 8)]
        return ToolResult(name=name, data=places, provenance=provenance, artifact=None, duration_ms=1)


def test_answer_then_two_questions_then_same_plan_refinement(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakeAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakeTools)
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        endpoint = f"/api/ai/v1/conversations/{conversation['id']}/messages"

        def send(content):
            response = client.post(endpoint,
                headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
                json={"content": content, "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"})
            assert response.status_code == 202
            return response.json()["runId"]

        first_run = send("Plan a 3 days itinerary in Da Nang, budget 3000000 VND")
        messages = client.get(endpoint, headers=headers).json()["items"]
        first_answer = messages[-1]
        assert "provisional itinerary" in first_answer["content"]
        assert "\n1." in first_answer["content"] and "\n2." in first_answer["content"]
        replay = client.get(f"/api/ai/v1/runs/{first_run}/stream?afterSequence=0", headers=headers)
        assert replay.status_code == 200
        events = [json.loads(line[6:]) for line in replay.text.splitlines() if line.startswith("data: ")]
        assert any("Mình cần bạn trả lời" in event.get("payload", {}).get("textDelta", "") for event in events)
        first_preview = next(item["data"] for item in first_answer["artifacts"]
                             if item["type"] == "ITINERARY_PREVIEW")
        assert first_preview["constraints"]["dayCount"] == 3
        with SessionLocal() as db:
            pending = db.scalars(select(PendingClarification).where(
                PendingClarification.originating_run_id == first_run)).first()
            assert pending is not None and pending.status == "ACTIVE"

        second_run = send("Không tính vé, 2 người, 3 triệu cho cả nhóm, hostel")
        messages = client.get(endpoint, headers=headers).json()["items"]
        second_answer = messages[-1]
        second_preview = next(item["data"] for item in second_answer["artifacts"]
                              if item["type"] == "ITINERARY_PREVIEW")
        assert second_preview["constraints"]["destination"] == first_preview["constraints"]["destination"]
        assert second_preview["constraints"]["dayCount"] == 3
        assert second_preview["constraints"]["hardBudgetAmount"] == 3_000_000
        assert second_preview["committable"] is False
        assert "\n1." not in second_answer["content"]
        with SessionLocal() as db:
            assert db.get(Run, second_run).action_type.value == "REFINE_PLAN"
            facts = db.scalars(select(ContextFact).where(ContextFact.conversation_id == conversation["id"],
                ContextFact.state == "KNOWN")).all()
            values = {fact.fact_key: fact.value_json["value"] for fact in facts}
            assert values["TRAVELER_COUNT"] == 2
            assert values["TRANSPORT_INCLUDED"] is False
            assert values["BUDGET_SCOPE"] == "GROUP"
            assert values["LODGING_TYPE"] == "HOSTEL_HOMESTAY"
            old_pending = db.scalars(select(PendingClarification).where(
                PendingClarification.originating_run_id == first_run)).first()
            assert old_pending.status == "ANSWERED"


def test_departure_answer_does_not_replace_trip_destination(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakeAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakeTools)
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        endpoint = f"/api/ai/v1/conversations/{conversation['id']}/messages"

        def send(content):
            response = client.post(endpoint,
                headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
                json={"content": content, "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"})
            assert response.status_code == 202
            return client.get(endpoint, headers=headers).json()["items"][-1]

        send("Plan a 3 days itinerary in Da Nang, budget 3000000 VND")
        second = send("Có tính vé, 2 người, 3 triệu cho cả nhóm, phòng riêng ở khách sạn")
        assert "xuất phát từ đâu" in second["content"]
        third = send("Hà Nội")
        preview = next(item["data"] for item in third["artifacts"] if item["type"] == "ITINERARY_PREVIEW")
        assert preview["constraints"]["destination"] == "Da Nang"
        assert "xuất phát từ đâu" not in third["content"]
        with SessionLocal() as db:
            facts = db.scalars(select(ContextFact).where(ContextFact.conversation_id == conversation["id"],
                ContextFact.state == "KNOWN")).all()
            values = {fact.fact_key: fact.value_json["value"] for fact in facts}
            assert values["DESTINATION"] == "da nang"
            assert values["DEPARTURE_POINT"] == "Hà Nội"


def test_partial_answers_stop_after_two_question_rounds(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakeAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakeTools)
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        endpoint = f"/api/ai/v1/conversations/{conversation['id']}/messages"

        def send(content):
            response = client.post(endpoint, headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
                json={"content": content, "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"})
            assert response.status_code == 202
            return client.get(endpoint, headers=headers).json()["items"][-1]

        first = send("Plan a 3 days itinerary in Da Nang, budget 3000000 VND")
        second = send("2 người")
        third = send("không tính vé")
        assert "Mình cần bạn trả lời" in first["content"]
        assert "Mình cần bạn trả lời" in second["content"]
        assert "Mình cần bạn trả lời" not in third["content"]
        with SessionLocal() as db:
            active = db.scalars(select(PendingClarification).where(
                PendingClarification.conversation_id == conversation["id"],
                PendingClarification.status == "ACTIVE")).all()
            assert active == []


def test_initial_request_does_not_repeat_answers_already_supplied(monkeypatch):
    monkeypatch.setattr("app.main.ModelAdapter", FakeAdapter)
    monkeypatch.setattr("app.main.ToolExecutor", FakeTools)
    token = jwt.encode({"sub": str(uuid.uuid4()), "type": "ACCESS",
                        "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                       os.environ["JWT_ACCESS_SECRET"], algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        conversation = client.post("/api/ai/v1/conversations", headers=headers, json={}).json()
        endpoint = f"/api/ai/v1/conversations/{conversation['id']}/messages"
        response = client.post(endpoint, headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
            json={"content": "Plan a 3 days itinerary in Da Nang, budget 3000000 VND for 2 people, "
                             "whole group, hostel, not include flight tickets",
                  "clientMessageId": str(uuid.uuid4()), "intent": "NORMAL"})
        assert response.status_code == 202
        answer = client.get(endpoint, headers=headers).json()["items"][-1]
        assert "Mình cần bạn trả lời" not in answer["content"]
        with SessionLocal() as db:
            facts = db.scalars(select(ContextFact).where(ContextFact.conversation_id == conversation["id"],
                ContextFact.state == "KNOWN")).all()
            values = {fact.fact_key: fact.value_json["value"] for fact in facts}
            assert values["TRAVELER_COUNT"] == 2
            assert values["TRANSPORT_INCLUDED"] is False
            assert values["BUDGET_SCOPE"] == "GROUP"
            assert values["LODGING_TYPE"] == "HOSTEL_HOMESTAY"
