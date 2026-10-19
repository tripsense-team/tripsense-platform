---
type: "architecture"
date: "2026-10-18T12:13:48.102764+00:00"
question: "How does TripSense Explore For You place recommendation currently work, what is its output, and why can first load take about 20 seconds while returning to the tab is fast?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ExploreRecommendationService", "ExploreRecommendationCache", "RecommendationApplicationService", "RemoteRecommendationContextProvider", "CandidateRetrievalPipeline", "PlaceServiceCandidateGenerator", "authenticatedFetch", "PlaceSearchServiceImpl"]
---

# Q: How does TripSense Explore For You place recommendation currently work, what is its output, and why can first load take about 20 seconds while returning to the tab is fast?

## Answer

Explore For You posts destination/query/session/limit to recommendation-service. The service resolves consent and preference context, retrieves candidates from place-service, filters/ranks/diversifies, applies exact-relaxed-baseline-last-known-good fallback, persists an impression, and caches the response. First-load latency is dominated by sequential downstream calls, provider refresh/fallback retries, synchronous persistence, late cache lookup after context resolution, and an overly large Gateway/browser timeout budget. Returning to For You is fast because the frontend Zustand categoryCache immediately reuses the Place[] under destination:for-you:, without a backend call. That frontend cache omits recommendationId/ranks/fallback/stale metadata, so feedback and status metadata are lost after switching away and back.

## Outcome

- Signal: useful

## Source Nodes

- ExploreRecommendationService
- ExploreRecommendationCache
- RecommendationApplicationService
- RemoteRecommendationContextProvider
- CandidateRetrievalPipeline
- PlaceServiceCandidateGenerator
- authenticatedFetch
- PlaceSearchServiceImpl