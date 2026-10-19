---
type: "architecture_advice"
date: "2026-10-18T13:16:16.612634+00:00"
question: "Một hệ thống bình thường mà như này là quá lâu. thật sự là 3s cũng đã gọi là lâu rồi bạn có thể tư vấn tôi không?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ExploreRecommendationService", "ExploreRecommendationCache", "RemoteRecommendationContextProvider", "CandidateRetrievalPipeline", "PlaceServiceCandidateGenerator", "PlaceSearchServiceImpl", "authenticatedFetch"]
---

# Q: Một hệ thống bình thường mà như này là quá lâu. thật sự là 3s cũng đã gọi là lâu rồi bạn có thể tư vấn tôi không?

## Answer

Expanded from original query via graph vocab: [explore, recommendation, cache, cached, context, fallback, fetch, place, provider, retrieve, response, async]. Recommended redesign: do not target merely reducing 20 seconds to 3 seconds. Target immediate stale/cache rendering, warm p95 under 800 ms, cold local p95 under 1.5 seconds, and keep provider refresh outside the user-facing critical path. Replace synchronous User/Context calls with a recommendation-owned profile projection updated asynchronously; make Place provider ingestion/background refresh asynchronous; retrieve one broad candidate pool and apply fallback locally; preserve compact impression persistence; reduce initial limit from 48 to 16-20; cache the full recommendation envelope with TTL; enforce a 1.2s server soft budget, about 2s Gateway deadline, and 2.5s browser deadline while preserving the old feed.

## Outcome

- Signal: useful

## Source Nodes

- ExploreRecommendationService
- ExploreRecommendationCache
- RemoteRecommendationContextProvider
- CandidateRetrievalPipeline
- PlaceServiceCandidateGenerator
- PlaceSearchServiceImpl
- authenticatedFetch