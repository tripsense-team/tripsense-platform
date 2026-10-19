# Explore parallel local hybrid retrieval

`STATUS: DONE`

Date: 2026-10-19. Human approval: “Tiến hành implements” following the agreed changes to parallel internal retrieval and provider supplementation after combined evaluation. Baselines: Explore For You and explore-local-candidate-refresh-policy. Owner: recommendation-service; Place retains canonical/provider ownership.

This approved increment supersedes the previous Explore search exact/relaxed refresh-enabled policy: those stages are now local-only, with one explicit provider supplement after combined evaluation.

## 1. Scope and acceptance

Explore runs local Place retrieval (`allowExternalRefresh=false`) and semantic retrieval concurrently. Keep existing RRF, canonical/category/geographic/business filters, ranking, relevance assessment, display limits and impression/cache contracts. The strict text source may yield zero without vetoing semantic candidates; do not loosen shared Place search rules or introduce intent classification.

For a submitted query, evaluate the combined final relevance-filtered set, retain existing relaxed-radius local retry when sparse. If still empty, attempt one provider-enabled Place source call; fuse that refreshed source with retained internal semantic candidates and rerank without rerunning embeddings/Qdrant. Do not call provider for a nonempty set merely to fill 48 slots. Base feed and destination baseline never call provider. If provider fails/times out retain existing internal candidate state and continue baseline/LKG policy. Existing non-Explore entry points remain sequential/provider-enabled by default.

This is a conservative initial completeness policy using existing relevance checks, not a claim to perfectly identify missing name intent or calibrate vector confidence. Exact-name boosting, new query classifiers and new relevance thresholds need separate evaluation. No batching/asynchronous DB persistence changes here.

Empty output caused by source unavailability, timeout, rejection or interruption does not prove missing inventory; skip provider escalation in that case and retain local baseline/LKG behavior. Internal-only semantic hydration must use existing read-only batch snapshots; disable fallback to individual provider-capable detail endpoints and report unresolved references honestly. Legacy refresh-enabled callers retain their previous fallback.

Acceptance: both sources begin before either completes; deterministic source merge order; failed/timed-out/rejected source does not erase a completed healthy source; total wait has one deadline per parallel stage; request ID propagates and worker context is cleared; no provider on base/nonempty query result; empty search makes at most one provider-source attempt; semantic not repeated by supplement; only final impression recorded; no API/schema/security change.

## 2. Architecture and lifecycle

Add explicit internal context `parallelRetrieval`, default false via all legacy constructors. Explore opts in and forces external refresh false initially. Use one Spring-owned fixed executor (4 workers, bounded queue 32, AbortPolicy, shutdownNow on shutdown), never common pool or per-request executors. Timeout defaults 3 seconds per parallel stage, configurable via existing RecommendationProperties retrieval namespace, strictly positive. Submit all sources before joining, collect in configured source order under one deadline, retain already completed futures even if another expires, cancel unfinished queued/inflight futures best-effort on all exit paths. Cancellation does not guarantee remote server work stops; parallel internal stages cannot trigger provider writes. Executor saturation degrades rather than caller-runs or retries.

Carry only the immutable diagnostics context to worker threads, restore prior ThreadLocal in finally. User identity/context is already explicit domain input; do not propagate servlet/security objects. Existing HTTP interceptor forwards the diagnostic request ID. Late worker completion may log after caller completion; label source timeouts/rejections separately.

PreparedRecommendation retains internal retrieval evidence (not public/persisted) so supplement can reuse source candidates. Provider replacement retains semantic and other sources, replaces the original Place source rather than double counting it. Relevance-filtered prepared copies retain this evidence. Stable public recommendation IDs/positions belong only to selected final response and one impression. Do not write intermediate impressions.

## 3. Contracts/data/security

Public POST /api/recommendations/explore-for-you and internal POST /api/places/recommendations unchanged. Existing allowExternalRefresh parameter is reused. No new events, tables, migrations, indexes, cache key/TTL or vector writes. Cache hits skip retrieval; old cached results remain valid until expiry. No cache flush. JWT/consent/ownership and provider credentials unchanged. Fixed phase names and safe state values only; no query, tokens, profile or payload in logs.

New metadata: retrieval_parallel, provider_supplement_attempted/failed. Existing per-source phases may overlap and must not be summed as serial work. Source degradation codes include unavailable, timeout, rejected and interrupted; cancellation results are not retried inside that stage. No SLA promise or invented performance numbers.

## 4. Tasks/tests/review

1. Implement bounded executor, context opt-in/backward constructors and diagnostic propagation.
2. Implement deadline collection and source-only supplementation using retained retrieval outcome; wire Explore exact/relaxed/baseline.
3. Test simultaneous start with latches (not timing guesses), deterministic fusion order, timeout/partial results, rejection/interruption, worker cleanup/header context, shutdown bounds, legacy sequential behavior, source failures, empty/nonempty/base provider policy, no duplicate semantic or impressions and stale-future isolation.
4. Run offline Recommendation suite excluding live SemanticCloudIntegrationTest, focused Place regressions and analyzer tests; JDK21/Mockito preload. Never call live provider/DB/vector to verify. Architecture/database/security/PR review and record results.

## 5. Rollout and limitations

Only Recommendation runtime changes; user should restart it once after all verification. Keep existing logs; test base and a submitted query, distinguish cache hits. No repeated restarts to collect incremental diagnostics. Expect retrieval duration nearer max(source times) rather than sum, but source load/network/queue/deadline determine actual behavior. Slow provider persistence may still exceed existing downstream timeout on genuine empty-result supplementation; that optimization is explicitly deferred. Bounded pool adds contention under load; validate before scaling. Rollback this increment only, retaining previous cache/impression optimizations and Place diagnostics.

## 6. Completion and verification — 2026-10-19

- Implemented opt-in parallel local retrieval with deterministic source ordering, a shared three-second stage deadline (configuration: `tripsense.recommendation.retrieval.parallel-timeout`), per-source degradation, best-effort cancellation/queue purge and a bounded Spring-managed executor. Legacy constructors/callers retain sequential refresh-enabled behavior.
- Explore exact/relaxed/baseline contexts are internal-only. Submitted empty-result searches may attempt provider once, after existing relevance and radius retry; nonempty results (including just one useful card), base feeds and internal infrastructure failures do not trigger provider supplementation. No new name-intent classifier or arbitrary count threshold was introduced.
- Supplementation replaces the Place source in its original ordering, retains original semantic source candidates and reruns fusion/filter/ranking without new embedding/vector retrieval. Only the final served response is recorded. Query-relevance transformations preserve internal retrieval evidence.
- Review found a hidden provider-capable semantic hydration fallback. Internal stages now use existing local batch snapshots without individual detail fallback; legacy hydration remains unchanged. Batch errors/missing references degrade honestly rather than inventing snapshots or reaching provider indirectly.
- Verification: 136 offline Recommendation Java tests passed, including ArchUnit; 50 focused Place regression tests passed; 11 analyzer tests passed. Scoped Spotless check and git diff --check passed. Initial test constructor argument mismatch was corrected before the final successful run. No live cloud integration test, database/provider/vector writes, service restart or cache flush was performed.
- New/updated coverage: concurrent start with latches, source order/request-ID propagation, healthy source retained on peer timeout/failure, rejection, pre-interruption, context restoration, invalid deadline, Spring constructor/qualified-executor wiring and lifecycle, provider-only retry/reuse, one final impression, no provider on nonempty/base/saturation paths, successful/failed supplement and internal-only snapshot hydration.
- Architecture review: existing service owners/routes and deterministic orchestration maintained; no common-pool or per-request thread creation. Database review: no schema/index/query/persistence changes. Security review: pooled workers carry only diagnostics, clear/restore context; no servlet auth/token propagation or sensitive metadata. PR review: no blocking findings in this increment. Shared legacy text ranking intentionally unchanged: it controls only text-source membership and does not veto semantic candidates.
- Limitations: not load-tested or runtime-latency measured; per-stage deadline is not an end-to-end SLA. Provider persistence remains synchronous on genuine supplementation and can still time out. Candidate generation under saturation degrades; cancellation cannot guarantee remote work stops. Existing query confidence/name-matching limitations remain explicitly outside scope.

Reproduce automated Recommendation checks:

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home mvn -o -B -ntp -pl services/recommendation-service -am test '-Dtest=*,!SemanticCloudIntegrationTest' -Dsurefire.failIfNoSpecifiedTests=false -DargLine=-javaagent:/Users/lebao/.m2/repository/org/mockito/mockito-core/5.23.0/mockito-core-5.23.0.jar
python3 -m unittest discover -s scripts -p 'test_analyze_explore_latency.py'
```
