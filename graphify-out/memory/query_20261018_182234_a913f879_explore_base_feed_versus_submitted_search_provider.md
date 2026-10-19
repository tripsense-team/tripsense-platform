---
type: "query"
date: "2026-10-18T18:22:34.604187+00:00"
question: "Explore base feed versus submitted search provider refresh implementation"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ExploreRecommendationService", "RecommendationContext", "PlaceServiceCandidateGenerator", "PlaceSearchServiceImpl"]
---

# Q: Explore base feed versus submitted search provider refresh implementation

## Answer

Expanded vocabulary: provider recommendation context. Verified current source: ExploreRecommendationService derives allowExternalRefresh from original normalized committed query, not generated city text; exact/relaxed search allows refresh, generic baseline disables it. RecommendationContext preserves legacy constructors default true and explicit immutable copy; PlaceServiceCandidateGenerator maps existing allowExternalRefresh field. Place already returns local-only when false with truthful insufficiency evidence. 117 offline Recommendation, 29 focused Place, 10 analyzer tests passed. No schema/public DTO change; live latency unmeasured.

## Outcome

- Signal: useful

## Source Nodes

- ExploreRecommendationService
- RecommendationContext
- PlaceServiceCandidateGenerator
- PlaceSearchServiceImpl