---
type: "query"
date: "2026-10-19T02:56:42.642425+00:00"
question: "observed_history nó lấy ra những data gì sao mà mất nhiều thời gian vậy bạn"
contributor: "graphify"
outcome: "useful"
source_nodes: ["JdbcRecommendationStore", "RemoteRecommendationContextProvider"]
---

# Q: observed_history nó lấy ra những data gì sao mà mất nhiều thời gian vậy bạn

## Answer

Expanded vocab: observed history feedback recommendation. Verified current JdbcRecommendationStore.read: three sequential JDBC SELECTs for recent shown place IDs, recent feedback-derived state, feedback joined full feature_snapshot JSON for category affinities. Each query uses configured maxHistoryEvents default5000, not known actual runtime row counts. Recomputes profile every read before Context fetch and result cache lookup. Existing migrations define user-time indexes; live indexes and SQL latency unverified. 1649ms is aggregate including connection wait, SQL/network, mapping and composition; cannot assign cause without per-query timing and row counts.

## Outcome

- Signal: useful

## Source Nodes

- JdbcRecommendationStore
- RemoteRecommendationContextProvider