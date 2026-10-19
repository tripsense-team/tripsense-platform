---
type: "query"
date: "2026-10-18T17:17:16.612034+00:00"
question: "Khoang đã nhưng mà bây giờ tôi vẫn đang chưa rõ việc là lấy data từ cache ra và chọn data lưu vào cache redis và tại sao như vậy? Có nên không ?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ExploreRecommendationCache", "ExploreRecommendationService", "PlaceSearchServiceImpl"]
---

# Q: Khoang đã nhưng mà bây giờ tôi vẫn đang chưa rõ việc là lấy data từ cache ra và chọn data lưu vào cache redis và tại sao như vậy? Có nên không ?

## Answer

Expanded via existing graph vocabulary: cache explore recommendation place profile fresh redis. Graph identifies ExploreRecommendationCache, verified against current source. Recommendation cache stores the nonempty final ranked ExploreRecommendationResult after durable impression recording, not all Place documents or a separately selected Redis dataset. Fresh and last-known-good store the same response with default 10m and 24h TTLs; LKG is read on preparation failure or empty results and labeled stale. Key is HMAC over user, destination, normalized query, profile fingerprint, algorithm versions and limit. Context/consent is resolved before fresh-cache lookup, and a hit returns the old recommendation ID without rerunning retrieval/ranking/record. Place cache instead stores query/anchor/radius/limit-scoped candidate lists; cached candidates are reassessed and sufficient lists bypass Mongo/provider. Nonempty response admission does not enforce category balance: hotel-heavy output remains hotel-heavy when cached. Cache is useful for repeated compatible requests, but hit rate, freshness and payload/write costs should be measured; the supplied 43ms read and 460ms write do not prove overall cache value. No application code changed.

## Outcome

- Signal: useful

## Source Nodes

- ExploreRecommendationCache
- ExploreRecommendationService
- PlaceSearchServiceImpl