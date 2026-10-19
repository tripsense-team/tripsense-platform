# Explore Local Candidate Refresh Policy — Specification & Implementation Plan

`STATUS: DONE`

- Owner: recommendation-service orchestration; place-service retains retrieval/provider ownership.
- Date: 2026-10-19.
- Human approval: “Chuẩn nhập tìm kiếm thì chúng ta mới cần phải bổ sung và dùng provider. Giờ bạn tiến hành implements 1 cách cẩn thận cho 2 case đó đi.”
- This approved revision supersedes the proposed minimum-count policy. There is no new 38/48 minimum threshold.
- Related: [Explore For You](./explore-for-you-personalized-recommendations.md), [evidence-aware ranking](./evidence-aware-recommendation-ranking.md).

## 1. Goal & Requirements

Recorded request ef137343-6d86-4458-b53a-03fd53627afc took 7,265 ms at Gateway: Place source timed out at 3,033 ms, then semantic took 1,462 ms. Place's 49 local candidates missed target 50 by one, triggering provider despite otherwise passing recorded evidence checks. DB inventory size is not equivalent to matching candidate count.

Approved behavior:

| User intent / stage | External Place refresh |
| --- | --- |
| Base For You: null/empty/whitespace committed query | Disabled, regardless of available count (40, 1 or 0) |
| Submitted nonblank query: exact stage | Permitted when existing Place assessment requires it, not forced on every search |
| Submitted nonblank query: relaxed-radius stage | Permitted under existing assessment |
| Destination baseline fallback (whether originally base or search) | Disabled: generic fallback must not trigger provider supplementation |
| Non-Explore recommendation entry points | Existing refresh-enabled behavior unchanged |

Return up to the requested limit, not a guaranteed count. Keep display/API maximum 48, candidate cap 50, local retrieval window, ranking, geography, mandatory evidence and freshness rules unchanged. Continue semantic retrieval over existing indexed candidates; “local only” here means no external Place search/ingestion, not offline processing (query embedding may still use its existing backend).

No fabrication or padding. Local stale/missing-field evidence remains honestly labeled; this increment does not upgrade it to SUFFICIENT or bypass final candidate filters. Empty feeds follow existing baseline/last-known-good/error handling. Existing browser feed preservation is unchanged.

Out of scope: UI, async provider jobs, source parallelism, new inventory, category quotas, retrieval overfetch, Mongo indexes, Qdrant/cache/impression optimization. No subsecond guarantee.

Acceptance criteria: base requests never set allowExternalRefresh=true even on fallback/empty inventory; search exact/relaxed permit refresh and baseline does not; adequate search cache/local evidence still avoids provider; default non-Explore callers retain true; counts/evidence/final ranks are truthful; no auth/consent/impression regressions.

## 2. Architecture & Service Boundaries

Web -> Gateway -> Explore orchestration -> existing context/candidate pipelines -> Place REST and semantic source -> existing ranking/impression/cache.

Add explicit `allowExternalRefresh` boolean to internal RecommendationContext. Preserve both existing constructor shapes with default true. Add an immutable copy method to select the policy. Explore derives the flag from the original normalized committed query BEFORE generated default/baseline text is substituted. Fallback copies preserve it; destination baseline explicitly overrides false. Do not infer intent from generated context.query(), session IDs or ThreadLocal state.

PlaceServiceCandidateGenerator maps this explicit flag into its existing request field, replacing hardcoded true. Place already implements refresh-disabled local return and evidence assessment; no new Place contract/decision logic necessary. Canonical data/provider writes stay Place-owned. No cross-service database reads or new service.

## 3. API & Event Contracts

Public POST /api/recommendations/explore-for-you unchanged. Internal POST /api/places/recommendations already accepts `allowExternalRefresh`; no DTO fields, response enum or HTTP behavior added. Example base request retains targetCount=50 but sends allowExternalRefresh=false. Search sends true as before. Existing evidence statuses/reasons remain; a count shortfall may be INSUFFICIENT even when nonempty cards are returned. Do not erase degradation evidence to claim completeness.

No Kafka events. Add metadata-only `external_refresh_allowed` at Recommendation and preserve Place's existing `place_external_refresh_allowed`, `provider_called`, `place_refresh_decision`. Never log raw queries.

## 4. Data & Rollback

No DB migrations, new indexes, vector writes or data cleanup. Existing cache keys/TTL and impression persistence unchanged. Place cache hits retain per-request assessment; refresh-disabled incomplete cache still follows existing local-read behavior, not provider. A fresh complete recommendation-cache hit bypasses retrieval and therefore cannot prove policy execution. Test misses and hits separately, without flushing shared caches. Existing cached responses can expire normally.

Rollback is code revert/redeploy of this increment only; keep earlier batch/pipeline changes. No cache flush required. No new config toggle needed for this deterministic user-intent rule.

## 5. Security

Policy is server-owned, not a new public parameter. Keep Gateway auth, downstream trust, consent and feedback ownership checks, destination/radius bounds, validation and provider credential handling unchanged. Counts/booleans/enums/request IDs only in diagnostics. No raw errors, tokens, profiles or cache payloads.

## 6. Trade-offs & Reviews

Base feed may return fewer cards or no new cards in sparse cities; provider ingestion is intentionally not hidden in that request. Search may still time out on a slow provider; this increment addresses base-feed latency, not all search latency. Partial evidence must stay partial. Hotel-heavy inventory is a separate data-quality problem.

Rejected: hard 48/38 acceptance threshold (same boundary problem), always calling provider on search (unnecessary cost), globally disabling provider (breaks search/AI), deciding from generated query text (base feed has synthetic nonblank query), background refresh now (unapproved lifecycle/load complexity).

## 7. Tasks & Verification

1. Add backward-compatible explicit context policy, propagate base/search/relaxed/baseline decisions and map existing Place request field.
2. Tests: legacy constructors/default true; generated nonblank base query still false; search exact/relaxed true; search baseline false; base empty/baseline false; 40 valid results do not trigger top-up; search returns available results without forced refresh; cache-hit bypass; adapter serialized flag; Place local/cache/provider behavior for refresh disabled/enabled.
3. Run offline Recommendation suite excluding SemanticCloudIntegrationTest (live vector mutation), focused Place tests, analyzer tests, formatter and diff checks. Use JDK21 and local Mockito agent. Tests must not call real provider, DB or cloud vectors.
4. Architecture/database/security/PR review; record actual results below.

Manual test: stop/restart Recommendation (occupied ports are skipped by scripts/start.sh), keep other services running. Run bash scripts/monitor-explore.sh --follow. Open base For You, submit a real query with Enter, then clear and Enter to return to base. Base retrieval must show external_refresh_allowed=false and Place provider_called=false; submitted search true, but provider_called depends on evidence. Blank/draft typing is not a submitted search. Compare matched request IDs, cold/warm cache states, source timings and returned counts. No cache flush; no guaranteed target latency before measurement.

## Approval Gate

`STATUS: APPROVED` — implementation explicitly authorized for the revised two-case policy above.

## Completion — 2026-10-19

- Implemented explicit immutable `RecommendationContext.allowExternalRefresh`, with both legacy constructor shapes defaulting true. Explore derives the policy from normalized committed query, copies it through relaxed retrieval and forces false on generic baseline. Place adapter now sends this flag instead of hardcoded true.
- Added request-level `external_refresh_allowed` metadata. Existing Place assessment, response contracts, source limits, TTLs, ranking, impressions and consent behavior are unchanged. No Place application-code changes were needed.
- Added 11 Recommendation test cases (8 orchestration, 3 adapter/context compatibility) and 6 Place regression cases, including counts 0/1/40/49, partial/complete cache, generated base query, search/relaxed/baseline, legacy defaults and cache-hit bypass. Tests use mocked dependencies; no live provider/DB/vector writes.
- Verification: 117 offline Recommendation tests passed (live SemanticCloudIntegrationTest excluded); 29 focused Place tests passed; 10 analyzer tests passed. Scoped Spotless formatting/check and git diff --check passed. A test-only missing static import found on a rerun was corrected, then the full offline Recommendation suite passed again.
- Architecture review: orchestration owns user intent; Place still owns provider access; no new service, cross-service DB access or public route.
- Database review: no schema, migration, transaction, cache-key or TTL change; previous batch/pipeline work preserved.
- Security review: no client-controlled policy field, auth/consent change, new credential exposure or sensitive log payload.
- PR review: no blocking findings in this increment. Legacy caller behavior and search capability covered; generic baseline is deliberately local-only. Limitation: base inventory may remain sparse and submitted search still has existing provider timeout risk.
- Not runtime-tested against the user's running stack; only Recommendation requires restart for this increment. Latency improvement remains to be measured. “No provider” refers to Place candidate supplementation; existing embedding infrastructure and separate autocomplete/detail workflows are not disabled.
