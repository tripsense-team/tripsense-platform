---
type: "diagnostic_plan"
date: "2026-10-18T13:45:07.920156+00:00"
question: "HIện tại hệ thống của tôi có lấy User Service và Context Service tuy nhiên tôi nhớ là Context Service đã chứa personalize rồi mà nhỉ user service làm gì chứa gì. Với lại giờ tôi muốn monitor xem thử lý do thời gian tốn ở đâu đã rồi mới đưa ra quyết định"
contributor: "graphify"
outcome: "useful"
source_nodes: ["RemoteRecommendationContextProvider", "TravelPreference", "RecommendationObservability", "RecommendationApplicationService", "ExploreRecommendationService", "JpaPreferenceSignalPublisher"]
---

# Q: HIện tại hệ thống của tôi có lấy User Service và Context Service tuy nhiên tôi nhớ là Context Service đã chứa personalize rồi mà nhỉ user service làm gì chứa gì. Với lại giờ tôi muốn monitor xem thử lý do thời gian tốn ở đâu đã rồi mới đưa ra quyết định

## Answer

Expanded via graph vocabulary: [user, profile, personalization, context, preference, signal, recommendation, observability, latency, timer, registry, duration]. In the implemented recommendation flow, User Service is called only as the canonical consent gate: recommendation reads personalizationEnabled from /api/users/me/travel-preferences and ignores its preferences JSON. Context Service supplies purpose-filtered derived preference signals used for ranking. User Service nevertheless stores overlapping preference JSON, indicating legacy/duplicate modeling, while architecture docs say User owns identity/consent and Context owns onboarding answers/derived signals. Current monitoring cannot locate the 20s: the Micrometer timer measures only prepare(), excludes context/cache/lock/impression persistence; contextMs is effectively zero; the persistenceMs label does not measure record(); and no Prometheus/Grafana/tracing stack is configured. Instrument bounded phase timers for consent, history, Context, cache, lock wait, each retrieval/fallback, impression record, cache put, plus Place cache/Mongo/provider/provider-persist phases; propagate one trace/correlation ID; export Prometheus histograms and add a trace backend before architectural changes.

## Outcome

- Signal: useful

## Source Nodes

- RemoteRecommendationContextProvider
- TravelPreference
- RecommendationObservability
- RecommendationApplicationService
- ExploreRecommendationService
- JpaPreferenceSignalPublisher