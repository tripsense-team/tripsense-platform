from app.proposals import build_proposal


def test_preview_never_advertises_ready_without_verified_trip_commit():
    proposal = build_proposal(
        owner="owner", conversation_id="conversation", run_id="run", trip_id="trip",
        preview={"scope": "FULL", "days": [], "issues": [], "constraints": {}},
        grounding=[], provenance=[],
    )

    assert proposal.business_state == "INVALID"
    assert any(issue["code"] == "TRIP_COMMIT_UNAVAILABLE"
               for issue in proposal.validation_json["issues"])
