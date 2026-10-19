---
type: "query"
date: "2026-10-19T03:45:08.669232+00:00"
question: "Hiện tại hệ thống lấy hành vi người dùng như nào lưu như nào và chấm điểm như nào để đóng góp trong phần filter kết quả?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["HeuristicRanker", "RecommendationProperties", "InteractionWeightCalculator"]
---

# Q: Hiện tại hệ thống lấy hành vi người dùng như nào lưu như nào và chấm điểm như nào để đóng góp trong phần filter kết quả?

## Answer

Expanded vocab feedback history profile ranking; graph points to HeuristicRanker and RecommendationProperties, current source verified. Frontend place-discovery-view automatically emits IMPRESSION for 16 pagePlaces with staggered timers, not viewport IntersectionObserver; CLICK card and DETAIL_VIEW detail/map paths, SAVE/UNSAVE and trip callbacks. emitFeedback requires auth/recommendation rank and dedupes in UI by rec/place/type, resets on response; backend validates owner/item/position/time, idempotency per user/key, persists feedback plus outbox. Server impression tables separately record returned list and feature snapshot. Jdbc read last5000 per query, weights impression0.1 click0.3 detail0.4 like0.8 save1 add1.5 dislike-1, reverse unsave/remove, exponential age decay; per-category sum then per-segment maxabs normalization and active weighted mixture50/30/20. Merge Context; features preference and saved/negative flags; rank weighted available criteria normalized then penalties, not hard filtering. Explore query criteria omit HISTORY but keep PREFERENCE; negative penalty independent. Important correction: seen flag not ranked does not mean impressions have zero impact: feedback IMPRESSION contributes positive category affinity. Affinity-only profile availability gate in PreferenceFeatureExtractor can disable preference when declared prefs absent; requires separate review. No code or DB changes made.

## Outcome

- Signal: useful

## Source Nodes

- HeuristicRanker
- RecommendationProperties
- InteractionWeightCalculator