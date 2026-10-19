---
type: "query"
date: "2026-10-18T16:08:44.430030+00:00"
question: "Explain current Explore For You recommendation flow: cache, Place, provider, semantic, impression, and hotel-heavy results."
contributor: "graphify"
outcome: "useful"
source_nodes: ["ExploreRecommendationService", "PlaceServiceCandidateGenerator", "JdbcRecommendationStore", "MmrDiversifier"]
---

# Q: Explain current Explore For You recommendation flow: cache, Place, provider, semantic, impression, and hotel-heavy results.

## Answer

Expanded via graph vocabulary: explore recommendation cache place provider semantic impression feedback ranking context. Graph located ExploreRecommendationService, PlaceServiceCandidateGenerator, JdbcRecommendationStore and MmrDiversifier; verified current source because graph is older than diagnostic edits. Flow resolves consent/context before user-scoped fresh cache; cache miss retrieves Place and semantic sources sequentially, fuses, filters, extracts features, ranks and applies category MMR, then synchronously persists served-list impression and items before caching/response. Place reuses sufficient search cache, otherwise Mongo then external provider refresh if evidence insufficient; count/freshness/field sufficiency does not measure category balance. Semantic embeds query, checks embedding cache, searches existing Qdrant vectors and resolves canonical Place snapshots. Backend served-list record is distinct from frontend IMPRESSION feedback and is required by current feedback membership/ownership/rank checks. MMR is soft diversity, not category quotas; hotel-heavy candidate input can remain hotel-heavy output. Current supplied runtime logs disable personalization, resolve all semantic snapshots, and show repeated 2.3-second impression recording.

## Outcome

- Signal: useful

## Source Nodes

- ExploreRecommendationService
- PlaceServiceCandidateGenerator
- JdbcRecommendationStore
- MmrDiversifier