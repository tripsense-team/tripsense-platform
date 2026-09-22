import importlib.util
from pathlib import Path

from app.recommendation import RecommendationGoalNormalizer, RecommendationRanker


def test_versioned_evaluation_dataset_passes():
    root = Path(__file__).resolve().parents[1]
    script = root / "evaluation" / "run_evaluation.py"
    spec = importlib.util.spec_from_file_location("tripsense_evaluation", script)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    report = module.run(root / "evaluation" / "dataset.v1.json")
    assert report["metrics"]["passRate"] == 1.0
    assert report["metrics"]["hardConstraintViolations"] is None


def test_unsupported_hard_place_evidence_is_not_inferred_from_weak_fields():
    normalizer = RecommendationGoalNormalizer()
    ranker = RecommendationRanker()
    candidate = {"id": "place-1", "categories": ["CAFE"], "openingHours": "open late",
                 "price": 50_000, "rating": 4.8, "description": "quiet romantic cafe"}
    for request in ("cafe open after 23:00", "cafe under 200k"):
        goal = normalizer.normalize(request, {"lat": 16.06, "lng": 108.22})
        assert goal.hardConstraints
        assert ranker.rank(goal, [candidate]).candidates == []
