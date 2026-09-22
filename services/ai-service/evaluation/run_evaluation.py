from __future__ import annotations

import argparse
import json
import platform
from pathlib import Path

from app.recommendation import RecommendationGoalNormalizer, RecommendationRanker
from app.retrieval import RetrievalSufficiencyPolicy


ROOT = Path(__file__).resolve().parent


def run(dataset_path: Path) -> dict:
    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))
    normalizer = RecommendationGoalNormalizer()
    policy = RetrievalSufficiencyPolicy()
    ranker = RecommendationRanker()
    results = []
    for case in dataset["cases"]:
        goal = normalizer.normalize(case["text"], case.get("context"))
        actual_hard = {item.feature for item in goal.hardConstraints}
        actual_soft = {item.feature for item in goal.softPreferences}
        unsupported = {item.requiredCapability for item in goal.unsupportedRequirements}
        checks = {
            "subjects": set(case.get("expectedSubjects", [])).issubset(set(goal.subjectTypes)),
            "hard": set(case.get("expectedHard", [])).issubset(actual_hard),
            "soft": set(case.get("expectedSoft", [])).issubset(actual_soft),
            "unsupported": set(case.get("unsupported", [])).issubset(unsupported),
            "objectives": set(case.get("expectedObjectives", [])).issubset(set(goal.rankingObjectives)),
        }
        empty_assessment = policy.assess(goal, [], refresh_available=False)
        ranked = ranker.rank(goal, [])
        checks["boundedEmptyRetrieval"] = empty_assessment.status == "INSUFFICIENT"
        checks["deterministicEmptyRanking"] = ranked.candidates == []
        results.append({"id": case["id"], "passed": all(checks.values()), "checks": checks,
                        "goal": goal.model_dump(mode="json")})
    passed = sum(1 for item in results if item["passed"])
    return {
        "datasetVersion": dataset["datasetVersion"],
        "environment": {"python": platform.python_version(), "rankingVersion": RecommendationRanker.version,
                        "goalSchemaVersion": 1},
        "metrics": {"caseCount": len(results), "passed": passed,
                    "passRate": passed / len(results) if results else 0.0,
                    # This fixture checks normalization only; no candidate or plan is validated here.
                    "hardConstraintViolations": None},
        "cases": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run deterministic TripSense AI evaluation")
    parser.add_argument("--dataset", type=Path, default=ROOT / "dataset.v1.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = run(args.dataset)
    rendered = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    return 0 if report["metrics"]["passRate"] == 1.0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
