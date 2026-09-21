import asyncio
import json
import logging
import sys
import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Conversation, Message, MessageRole, Run, RunStatus, ActionType, ToolCall, RunEvent
from app.main import (
    settings,
    classify_action,
    is_plan_revision,
    is_explicit_new_plan,
    latest_preview,
    execute_run,
)
from app.recommendation.goal_normalizer import RecommendationGoalNormalizer, clean_destination_name
from app.retrieval.coverage import derive_coverage_requirements
from app.planning import ConstraintExtractor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_real_runs")

PROMPTS = [
    (
        "PROMPT 1 (Golden Da Nang)",
        "Lên lịch trình 1 ngày ở Đà Nẵng đi chơi và ăn uống, có bánh mì và các đặc sản địa phương. Hãy tự sắp xếp lịch trình hợp lý theo buổi sáng, trưa, chiều, tối; cân nhắc vị trí địa lý để tránh di chuyển lòng vòng. Nếu không chắc dữ liệu thời gian thực như giá hoặc giờ mở cửa thì nói rõ, nhưng vẫn đưa ra một kế hoạch hữu ích."
    ),
    (
        "PROMPT 2 (Hue 1 Day)",
        "lên lịch trình 1 ngày ở Huế đi chơi và ăn uống các địa điểm nổi tiếng"
    ),
    (
        "PROMPT 3 (Hue with 'search đi')",
        "lên lịch trình 1 ngày ở Huế đi chơi và ăn uống các địa điểm nổi tiếng, ăn các quán đáng trải nghiệm ở Huế, search đi"
    ),
]

async def execute_and_report(title: str, prompt_text: str):
    print("\n" + "=" * 80)
    print(f"VERIFYING: {title}")
    print("=" * 80)
    owner = "bd0070de-f1e1-42b9-9632-cb3140cbb7e5"
    conv_id = str(uuid.uuid4())

    # 1. Raw user message
    print(f"1. RAW USER MESSAGE:\n{prompt_text}\n")

    # 2. Detected action
    classified = classify_action(prompt_text)
    is_rev = is_plan_revision(prompt_text)
    is_new = is_explicit_new_plan(prompt_text)
    detected_action = classified
    if not is_new and is_rev:
        detected_action = ActionType.REFINE_PLAN
    print(f"2. DETECTED ACTION: {detected_action} (is_explicit_new_plan={is_new}, is_plan_revision={is_rev})\n")

    # Setup database with existing prior preview to test fresh plan classification
    with SessionLocal() as db:
        conv = Conversation(id=conv_id, owner_user_id=owner, title=title, locale="vi-VN")
        db.add(conv)
        old_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            owner_user_id=owner,
            role=MessageRole.ASSISTANT,
            content="Old preview",
            content_json={"artifacts": [{"type": "ITINERARY_PREVIEW", "data": {"validForPreview": True, "days": [], "constraints": {"destination": "Đà Nẵng", "durationDays": 1}}}]}
        )
        db.add(old_msg)
        user_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            owner_user_id=owner,
            role=MessageRole.USER,
            content=prompt_text,
            content_json={}
        )
        db.add(user_msg)
        db.flush()
        run = Run(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            owner_user_id=owner,
            trigger_message_id=user_msg.id,
            action_type=detected_action,
            status=RunStatus.QUEUED
        )
        db.add(run)
        db.commit()
        run_id = run.id

    # 3. Extracted TravelGoal & 4. Normalized destination
    normalizer = RecommendationGoalNormalizer()
    extracted_goal = normalizer.fallback_travel_goal(prompt_text, {})
    norm_dest = clean_destination_name(extracted_goal.destination)
    print(f"3. EXTRACTED TRAVEL_GOAL:\n{extracted_goal.model_dump_json(indent=2)}\n")
    print(f"4. NORMALIZED DESTINATION: '{norm_dest}' (ConstraintExtractor._destination: '{ConstraintExtractor._destination(prompt_text)}')\n")

    # 5. Derived CoverageRequirements
    coverage_reqs = derive_coverage_requirements(extracted_goal)
    print("5. DERIVED COVERAGE REQUIREMENTS:")
    for r in coverage_reqs:
        print(f"  - [{r.type.value}] id={r.id} target='{r.target}', blocking={r.blocking}, min={r.minCount}")
    print()

    # Execute run
    print("Executing real execute_run...")
    token = ""
    try:
        await execute_run(run_id, token)
    except Exception as e:
        print(f"execute_run raised exception: {e}")

    # Inspect results
    with SessionLocal() as db:
        completed_run = db.get(Run, run_id)
        assistant_msg = db.get(Message, completed_run.assistant_message_id) if completed_run.assistant_message_id else None
        tool_calls = db.scalars(select(ToolCall).where(ToolCall.run_id == run_id).order_by(ToolCall.created_at)).all()
        events = db.scalars(select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.sequence)).all()

        print("\n--- RUN METRICS ---")
        print(f"Status: {completed_run.status}")
        print(f"Action Type: {completed_run.action_type}")
        print(f"Termination Reason: {completed_run.termination_reason}")
        print(f"Retrieval Sufficiency: {completed_run.retrieval_sufficiency}")

        # 6. Tool Calls and Exact Arguments
        print("\n--- TOOL CALLS (7, 8, 9, 10, 11) ---")
        for tc in tool_calls:
            print(f"  Tool: {tc.tool_name} | Status: {tc.status} | Duration: {tc.duration_ms}ms | Error: {tc.error_code}")
            if tc.provenance_json:
                print(f"    Provenance: {tc.provenance_json}")

        # Activities sequence
        print("\n--- 20. EMITTED AGENT ACTIVITY SEQUENCE ---")
        for ev in events:
            if ev.event_type in {"agent.activity", "activity"}:
                payload = ev.payload_json or {}
                print(f"  [{payload.get('stage')}] status={payload.get('status')} | label='{payload.get('label')}' | summary='{payload.get('summary')}' | progress={payload.get('progress')}")

        # 16, 17, 18, 19: Preview & Validity
        if assistant_msg:
            artifacts = (assistant_msg.content_json or {}).get("artifacts", [])
            preview_artifact = next((a for a in artifacts if a.get("type") == "ITINERARY_PREVIEW"), None)
            place_list_artifact = next((a for a in artifacts if a.get("type") == "PLACE_LIST"), None)

            print("\n--- 13, 14. ACCEPTED / REJECTED CANDIDATES ---")
            if place_list_artifact:
                places = (place_list_artifact.get("data") or {}).get("places", [])
                print(f"Canonical Places in PLACE_LIST ({len(places)}):")
                for p in places:
                    print(f"  - [{p.get('id')}] {p.get('name')} | {p.get('address')} | categories={p.get('categories')}")
            else:
                print("No PLACE_LIST artifact emitted.")

            print("\n--- 16. FINAL VALIDATOR RESULT ---")
            if preview_artifact:
                pdata = preview_artifact.get("data", {})
                print(f"17. validityState: {pdata.get('validityState')}")
                print(f"18. canRenderPreview: {pdata.get('canRenderPreview')}")
                print(f"19. canCommit: {pdata.get('canCommit')}")
                print(f"Days count: {len(pdata.get('days', []))}")
                for d in pdata.get("days", []):
                    items = d.get("items", [])
                    print(f"  Day {d.get('dayNumber')}: {[it.get('title') for it in items]}")
                print(f"Issues: {json.dumps(pdata.get('issues'), indent=2, ensure_ascii=False)}")
            else:
                print("No ITINERARY_PREVIEW artifact.")

            # 14. Final user visible response
            print(f"\n14. FINAL USER-VISIBLE RESPONSE:\n{assistant_msg.content}\n")

async def main():
    for title, prompt_text in PROMPTS:
        await execute_and_report(title, prompt_text)

if __name__ == "__main__":
    asyncio.run(main())
