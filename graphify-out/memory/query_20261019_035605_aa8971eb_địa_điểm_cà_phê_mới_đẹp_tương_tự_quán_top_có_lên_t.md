---
type: "query"
date: "2026-10-19T03:56:05.738671+00:00"
question: "Địa điểm cà phê mới đẹp tương tự quán top có lên top được không?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["QualityFeatureExtractor", "HeuristicRanker", "MmrDiversifier"]
---

# Q: Địa điểm cà phê mới đẹp tương tự quán top có lên top được không?

## Answer

Expanded vocab quality popularity diversity ranking. Current source: QualityFeatureExtractor Bayesian shrinks sparse rated counts toward prior4 with threshold20; no ratings excluded from available rating term, count0 popularity term available0; overall rank renormalizes available signals, no blanket new-place zero score. PreferenceFeatureExtractor applies category affinities to unseen candidates so new café matching categories benefits without prior own click. Semantic/retrieval/proximity also contribute if candidate retrieved. MmrDiversifier deterministic relevance minus similarity, not freshness/exploration. No explicit new-place quota/randomized exploration in inspected ranking/diversity path; cannot guarantee exposure. Beauty not inherently inferred from photos by this ranker. Upstream retrieval can exclude before rerank. No code changes.

## Outcome

- Signal: useful

## Source Nodes

- QualityFeatureExtractor
- HeuristicRanker
- MmrDiversifier