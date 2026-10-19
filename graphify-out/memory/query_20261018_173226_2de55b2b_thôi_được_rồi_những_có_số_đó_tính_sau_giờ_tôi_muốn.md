---
type: "query"
date: "2026-10-18T17:32:26.517317+00:00"
question: "Thôi được rồi những có số đó tính sau giờ tôi muốn bạn kiểm tra xem lý do tại sao cache put mất 0.5s trong khi tôi nhớ là cache redis thì tốc độ đọc ghi rất nhanh"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ExploreRecommendationCache", "ExploreRecommendationService"]
---

# Q: Thôi được rồi những có số đó tính sau giờ tôi muốn bạn kiểm tra xem lý do tại sao cache put mất 0.5s trong khi tôi nhớ là cache redis thì tốc độ đọc ghi rất nhanh

## Answer

Expanded query via graph vocabulary: cache explore recommendation redis. Graph locates ExploreRecommendationCache, verified current source lines 51-64 and 105-107. cache_put includes two key preparations, duplicate serialization of the same full ExploreRecommendationResult and two synchronous sequential Redis SETs with TTLs. It is not Redis server command execution timing. Configuration points to remote Redis over TLS. Read-only redis-cli probe of six PINGs on one connection measured first startup/TLS 315.6ms then warm 44.4,43.2,49.9,57.0,52.7ms. Baseline is about 49ms per round trip; two RTTs alone do not explain 460ms. Full result contains ranked features/snapshots/breakdown and may cost serialization/upload, but no per-write instrumentation exists to attribute the remainder. INFO commandstats did not provide usable server timing. No application code, cache contents, TTL, or data changed. Next diagnostic requires separate serialization/fresh SET/LKG SET phases; do not claim TLS handshake per SET or that Redis execution itself took 0.5s.

## Outcome

- Signal: useful

## Source Nodes

- ExploreRecommendationCache
- ExploreRecommendationService