import importlib.util
from pathlib import Path

from app.recommendation import RecommendationGoalNormalizer


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


def test_hard_place_evidence_is_typed_before_recommendation_service_ranking():
    normalizer = RecommendationGoalNormalizer()
    for request in ("cafe open after 23:00", "cafe under 200k"):
        goal = normalizer.normalize(request, {"lat": 16.06, "lng": 108.22})
        assert goal.hardConstraints
        assert all(constraint.feature in {"OPEN_AT", "PRICE_AMOUNT"}
                   for constraint in goal.hardConstraints)
