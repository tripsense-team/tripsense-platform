# Recommendation Decision Intelligence — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Owner Service**: `services/recommendation-service`
- **Affected Components**: `services/recommendation-service`, `services/ai-service`, `services/place-service`, `services/api-gateway`, `apps/web/tripsense`
- **Created Date**: 2026-09-25
- **Approved Date**: 2026-09-25
- **Related Baselines**: [Recommendation Engine V2](./recommendation-engine-v2.md), [Evidence-Aware Recommendation Ranking](./evidence-aware-recommendation-ranking.md)
- **Target PR Boundaries**: Phase 1 contracts/persistence; Phase 2 deterministic comparison; Phase 3 AI routing/verbalization; Phase 4 native web presentation; Phase 5 evaluation/observability

---

## 1. Goal & Requirements

### 1.1 Problem statement

The existing engine can produce evidence-aware ranked recommendations, but the conversational path can still bypass it. In particular, the `PLACE_RECOMMENDATION` fallback currently calls `search_places`, which yields a Place artifact without typed distance, ranking basis, completeness, or score evidence. A follow-up such as “Tịnh Quán và Hạnh Thiện, nơi nào tốt hơn?” can therefore reach the LLM with two names and addresses but no comparable evidence. The model then produces a vague or unsupported preference.

This increment makes recommendation and comparison a deterministic decision pipeline:

```text
recommendation intent
  -> canonical recommendation route only
  -> hard-filtered, evidence-aware ranked result
  -> immutable decision snapshot
  -> follow-up candidate resolution
  -> pairwise evidence matrix
  -> meaningful-difference policy
  -> RECOMMENDED | TIED | INSUFFICIENT_DATA
  -> typed explanation contract
  -> LLM verbalizes only / web renders native structure
```

The goal is not to force a winner. The goal is to make the strongest conclusion justified by real, typed evidence and to make unsupported conclusions structurally impossible.

### 1.2 User journeys

#### Initial recommendation

1. A traveler asks for five vegetarian restaurants on Son Tra Peninsula within 5 km, prioritizing proximity and good ratings.
2. AI converts the request into a `RecommendationGoal` and always invokes `recommend_places`; it never presents raw `search_places` results as ranked recommendations.
3. Recommendation service retrieves real canonical Place records, hard-filters required constraints, scores available criteria, and stores an immutable decision snapshot.
4. The response states whether the list is complete, whether it is genuinely ranked, which criteria were available, and which were unavailable.
5. Web renders a native structured table/list. It uses “Ưu tiên” only for a genuinely ranked result; otherwise it uses “STT” and “Địa điểm tìm thấy”.

#### Follow-up comparison

1. The traveler asks to compare two places from the immediately preceding recommendation.
2. AI resolves both names to canonical IDs from the prior artifact and sends the original `recommendationId` plus selected IDs to recommendation-service.
3. Recommendation service verifies ownership and membership, loads the immutable evidence snapshot, and evaluates only dimensions available for both places.
4. It returns one of:
   - `RECOMMENDED`: a winner is supported by a meaningful difference under the original requested priorities;
   - `TIED`: comparable evidence exists, but the aggregate difference is below the meaningful threshold;
   - `INSUFFICIENT_DATA`: there is no decision-grade comparable evidence.
5. AI explains the typed result without inventing convenience, ambience, quality, dietary suitability, distance, or popularity.

### 1.3 Scope boundaries

**In scope**:

- Guarantee that recommendation intents use recommendation-service, including fallback and retry paths.
- Bind comparison follow-ups to a prior owned recommendation impression and its canonical candidates.
- Deterministic pairwise/multi-place comparison over typed evidence.
- Explicit `RECOMMENDED`, `TIED`, and `INSUFFICIENT_DATA` decision states.
- Versioned meaningful-difference thresholds, evidence coverage rules, and per-criterion outcomes.
- Immutable storage of the sanitized decision context and score breakdown required for replay.
- Native web rendering for recommendation and comparison tables; Markdown is a fallback, not the primary layout contract.
- Production/runtime exclusion of development fixtures and preservation of real provider provenance.
- Regression/evaluation coverage for the attached vegetarian-restaurant conversation and earlier cafe cases.

**Out of scope**:

- Scraping Google Maps or bypassing licensed provider APIs.
- Treating model memory, place names, addresses, or unstructured prose as verified rating, quietness, vegetarian suitability, or route evidence.
- Learned-to-rank models, embeddings retraining, collaborative filtering, or online weight optimization.
- Route distance/time unless a separately approved routing provider supplies typed evidence.
- Cross-service database reads or cross-service JPA relationships.
- Backfilling production Place data by inserting synthetic businesses.

### 1.4 Domain invariants

1. `place-service` owns canonical place/provider facts; `recommendation-service` owns eligibility, score, rank, comparison, and decision status.
2. A recommendation intent cannot finish with a raw Place search artifact labeled as a recommendation.
3. Runtime candidates must come from configured real providers/canonical Place records. Development fixtures are rejected outside explicit development/test profiles and are never presented as real businesses.
4. `null` is unavailable, not zero, average, or negative evidence.
5. A criterion is comparable only when both candidates have valid evidence of the same semantic type, unit, and freshness policy.
6. Rank position, retrieval order, address text, MMR order, and place name are not themselves proof that one place is better.
7. The MMR/diversity display order is not reused as a pairwise utility score.
8. A winner is returned only when evidence coverage passes the decision floor and the weighted difference meets the versioned meaningful threshold.
9. `TIED` requires comparable evidence. No comparable evidence produces `INSUFFICIENT_DATA`, never `TIED`.
10. Missing requested criteria are listed explicitly and excluded from normalization.
11. LLM and frontend cannot override `comparisonStatus`, `winnerPlaceId`, order, typed values, or explanation codes.
12. All public calls pass through API Gateway; every comparison verifies impression ownership and candidate membership.
13. Only post-filter eligible items may enter the final `PLACE_RECOMMENDATION` artifact. Retrieved or rejected candidates are diagnostic counts, never display candidates.
14. When `returnedCount=0`, the artifact contains `places=[]`; the frontend suppresses the recommendation-card section entirely. It must not fall back to rendering retrieval/search artifacts from the same run.

### 1.5 Acceptance criteria

- [ ] AC-1: Every `PLACE_RECOMMENDATION` path, including planner fallback/model failure, invokes `recommend_places`; `search_places` remains available only for literal search/discovery or itinerary candidate discovery.
- [ ] AC-2: A constrained recommendation artifact has provider `recommendation-service` and includes `recommendationId`, `requestedCount`, `returnedCount`, `complete`, `rankingStatus`, `rankingBasis`, and `unavailableCriteria`.
- [ ] AC-3: A follow-up comparison resolves only canonical IDs from the prior owned recommendation; ambiguous or absent references produce a typed clarification/insufficient result without guessing.
- [ ] AC-4: Two candidates with no mutually available decision-grade dimension return `INSUFFICIENT_DATA`, `winnerPlaceId=null`, `comparableDimensions=[]`.
- [ ] AC-5: Candidates with comparable evidence but a score delta below the configured threshold return `TIED`, `winnerPlaceId=null`.
- [ ] AC-6: `RECOMMENDED` requires at least one comparable requested dimension, minimum evidence coverage, and a meaningful aggregate margin. Its reasons identify the exact typed evidence and contribution.
- [ ] AC-7: Rating comparison uses confidence-adjusted quality and minimum review evidence; `4.8/2` cannot automatically defeat `4.6/300` on raw rating alone.
- [ ] AC-8: Distance comparison requires typed `STRAIGHT_LINE` values for both candidates. Address numbering or same-street text never substitutes for distance.
- [ ] AC-9: Quietness, dietary suitability, opening status, and other facets are compared only from typed evidence; names/descriptions cannot silently establish them.
- [ ] AC-10: Initial results use “Ưu tiên” only when `rankingStatus=RANKED` and `rankingBasis` is non-empty. Otherwise UI uses “STT” and clearly labels results as unranked/partially ranked.
- [ ] AC-11: The attached Tịnh Quán/Hạnh Thiện case returns `INSUFFICIENT_DATA` when rating, review confidence, distance, and other requested evidence are unavailable; no sentence recommends one based on address convenience.
- [ ] AC-12: A real-provider response never contains fixture IDs/names, fixture photo endpoints, internal trust-tier labels, debug steps, raw HTML entities, or raw backend errors.
- [ ] AC-13: Native table rendering works on narrow screens without exposing Markdown pipe syntax; screen readers receive table headers and decision status.
- [ ] AC-14: Replaying the same stored snapshot under the same comparison-policy version returns byte-equivalent decision fields regardless of LLM output.
- [ ] AC-15: Existing impressions lacking the new decision snapshot fail safely with `COMPARISON_SNAPSHOT_UNAVAILABLE`; AI may rerun the original recommendation once, but cannot reconstruct evidence from prose.
- [ ] AC-16: For the hotel query where retrieval finds only Chùa Linh Ứng, hard category filtering produces `retrievedCount=1`, `returnedCount=0`, `items=[]`; neither the artifact nor UI renders Chùa Linh Ứng as a suggested hotel.
- [ ] AC-17: When a run contains both a raw retrieval result and a recommendation result, artifact selection uses only the recommendation result's eligible item IDs. Rejected retrieval candidates cannot leak through artifact merging, fallback selection, photo enrichment, or stale prior state.
- [ ] AC-18: With zero eligible results, the page shows a localized empty recommendation state and safe next actions, but no “Địa điểm gợi ý (0)” heading, empty carousel, or unrelated place card.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction and decision flow

```text
User -> Web -> API Gateway -> AI service
                              | intent + typed goal
                              v
                    POST recommendation-service /api/recommendations
                              -> Place service REST (canonical real data)
                              -> hard filter -> enrich -> score -> rank/diversify
                              -> persist decision context + per-item evidence snapshot
                              <- typed recommendation result
                   <- native recommendation artifact + bounded prose

Follow-up “A hay B tốt hơn?”
User -> Web -> Gateway -> AI resolves A/B only from prior artifact
                         -> POST /api/recommendations/{id}/comparisons
                              -> ownership + membership validation
                              -> load immutable snapshots
                              -> pairwise comparable-dimension matrix
                              -> deterministic meaningful-difference decision
                              <- typed comparison result
                         <- LLM verbalization + native comparison artifact
```

The recommendation response is the sole source of final display membership. Retrieval candidates may be retained as bounded aggregate diagnostics (`retrieved`, `rejectedByReason`) but their place payloads are not merged into the final artifact.

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| `place-service` | Canonical provider facts, normalized categories/facets, evidence origin/freshness; no ranking or winner selection |
| `recommendation-service` | Recommendation routing target, hard filters, availability-aware scoring, impression snapshots, comparison policy, decision status and evidence reasons |
| `ai-service` | Intent classification, conversational reference resolution, authenticated tool orchestration, typed artifact creation, constrained verbalization |
| `api-gateway` | Public route, authentication propagation, bounded rate limiting |
| `apps/web/tripsense` | Native accessible rendering, localized labels, no client-side scoring/re-ranking |

No Kafka event is required: both recommendation and comparison are synchronous user-facing decisions. No service reads another service's database.

### 2.3 Decision pipeline

```text
PriorRecommendationSnapshot
  -> validate ownership, candidate set, policy version
  -> select requested candidates (2..5)
  -> build comparable evidence matrix
  -> evaluate each criterion: AHEAD | TIED | UNAVAILABLE
  -> normalize weights over comparable requested criteria only
  -> apply evidence coverage floor
  -> apply aggregate meaningful-difference threshold
  -> assemble ComparisonDecision + explanation codes
```

Comparison uses pre-diversification utility evidence, not the final MMR position. This prevents diversity reshuffling from being misrepresented as “better overall.”

### 2.4 Criterion policy (initial version `comparison-v1`)

Thresholds are server-owned configuration, versioned with each decision, and calibrated through an offline golden set before production enablement. Initial proposed defaults are conservative:

| Criterion | Comparable when | Meaningful difference |
| --- | --- | --- |
| `DISTANCE` | Both have typed straight-line distance from the same anchor | `max(0.25 km, 10% of farther distance)` |
| `RATING` | Both ratings valid and review-confidence calculation available | confidence-adjusted quality delta `>= 0.20` |
| `POPULARITY` | Both verified review counts available | normalized `log1p(count)` delta `>= 0.10` |
| `QUIETNESS` | Both typed scores meet minimum evidence count/freshness | normalized delta `>= 0.10` |
| `PREFERENCE` / `CONTEXT` | Both snapshots use the same feature version | normalized delta `>= 0.10` |
| `RETRIEVAL_RELEVANCE` | Both scores are from the same request/provider fusion version | normalized delta `>= 0.10`; explanatory only unless explicitly requested |

Overall decision defaults:

- Minimum comparable requested dimensions: `1`.
- Minimum pairwise evidence coverage: `0.40` of requested weight.
- Aggregate meaningful score delta: `0.08` after re-normalizing over mutually available criteria.
- Deterministic tie-breakers used for list ordering do not change `TIED` into `RECOMMENDED`.
- If different equally weighted criteria favor different candidates and aggregate delta is below threshold, status is `TIED` and trade-offs are preserved in criterion outcomes.

These numbers are configuration defaults, not public API inputs. They must be validated against golden cases and can change only with a new comparison-policy version.

---

## 3. API & Artifact Contracts

### 3.1 Recommendation response additions

`POST /api/recommendations` remains authenticated and backward-compatible. Add:

```json
{
  "recommendationId": "uuid",
  "rankingStatus": "RANKED",
  "rankingBasis": ["DISTANCE", "RATING", "POPULARITY"],
  "requestedCount": 5,
  "returnedCount": 4,
  "complete": false,
  "unavailableCriteria": ["QUIETNESS"],
  "comparisonAvailable": true,
  "comparisonPolicyVersion": "comparison-v1"
}
```

`rankingStatus` enum:

- `RANKED`: at least one requested criterion was available and deterministic scoring was applied.
- `PARTIALLY_RANKED`: usable ranking exists, but evidence coverage is below the configured presentation-confidence floor.
- `UNRANKED`: no requested ranking criterion was available; returned order is not described as preference.

### 3.2 Comparison endpoint

`POST /api/recommendations/{recommendationId}/comparisons`

- Auth: bearer JWT through API Gateway.
- The authenticated user must own the impression.
- `placeIds` must be unique and must belong to that impression.
- Limits: `2..5` place IDs; request body maximum and timeouts follow existing service standards.
- Clients cannot supply scores, evidence, weights, thresholds, or winner IDs.

Request:

```json
{
  "placeIds": ["place-a", "place-b"]
}
```

Response:

```json
{
  "recommendationId": "uuid",
  "comparisonStatus": "INSUFFICIENT_DATA",
  "winnerPlaceId": null,
  "comparedPlaceIds": ["place-a", "place-b"],
  "comparableDimensions": [],
  "unavailableDimensions": ["DISTANCE", "RATING", "POPULARITY"],
  "evidenceCoverage": 0.0,
  "aggregateScoreDelta": null,
  "criterionOutcomes": [
    {
      "criterion": "RATING",
      "status": "UNAVAILABLE",
      "winnerPlaceId": null,
      "values": [
        {"placeId": "place-a", "available": false, "value": null, "unit": "RATING_5"},
        {"placeId": "place-b", "available": false, "value": null, "unit": "RATING_5"}
      ],
      "normalizedDelta": null,
      "meaningfulThreshold": 0.20,
      "explanationCode": "RATING_NOT_COMPARABLE"
    }
  ],
  "explanationCodes": ["NO_COMPARABLE_REQUESTED_EVIDENCE"],
  "versions": {
    "ranking": "...",
    "feature": "...",
    "comparison": "comparison-v1"
  }
}
```

Allowed `comparisonStatus`: `RECOMMENDED`, `TIED`, `INSUFFICIENT_DATA`.

Allowed criterion status: `AHEAD`, `TIED`, `UNAVAILABLE`. Supporting values are typed; unknown values stay `null`.

### 3.3 Error contract

| Status | Code | Condition |
| --- | --- | --- |
| `400` | `INVALID_COMPARISON_REQUEST` | Invalid count, duplicate/malformed IDs |
| `401` | `UNAUTHORIZED` | Missing/invalid identity |
| `404` | `RECOMMENDATION_NOT_FOUND` | Missing or non-owned recommendation (same response prevents ID enumeration) |
| `409` | `COMPARISON_SNAPSHOT_UNAVAILABLE` | Legacy/incomplete snapshot cannot be compared safely |
| `422` | `CANDIDATE_NOT_IN_RECOMMENDATION` | Authenticated owner supplied candidate outside the impression |
| `429` | `RATE_LIMITED` | Comparison abuse/burst limit |
| `503` | `COMPARISON_UNAVAILABLE` | Safe dependency/config failure; no raw exception leakage |

### 3.4 AI tool and artifact contracts

Add allowlisted tool `compare_recommended_places`:

```json
{
  "recommendationId": "uuid",
  "placeIds": ["place-a", "place-b"]
}
```

AI must resolve those values from the prior typed artifact, never from free-form invented IDs. The tool returns a `PLACE_COMPARISON` artifact containing the response above plus minimal canonical display snapshots (`id`, `name`, `address`, provider-backed rating/count and typed distance). The LLM receives explicit rules:

- verbalize the status and exact criterion outcomes;
- never create a winner when `winnerPlaceId=null`;
- never use address/name prose as evidence;
- never expose policy internals as certainty;
- never ask the user to supply Google Maps results as the default fallback.

### 3.5 Native web presentation

The artifact renderer, not generated Markdown, owns the visible table:

- Recommendation headers: rank label, place, address, rating/review count, typed distance, evidence note.
- Comparison headers: criterion, candidate values, evidence availability, outcome.
- `RECOMMENDED`: show bounded “xếp trước theo dữ liệu hiện có” copy.
- `TIED`: show trade-offs and say the evidence does not establish an overall winner.
- `INSUFFICIENT_DATA`: state exactly which dimensions are missing; no visual winner emphasis.
- Responsive overflow and semantic `<table>`, `<th scope>`, captions, and localized labels are required.
- Place cards remain supporting navigation and never replace the decision table.
- The cards consume exactly `RecommendationResponse.items`. When this list is empty, the entire cards section is omitted; raw retrieval candidates are never used as a visual fallback.

### 3.6 Zero-result contract

For a request that retrieves candidates but rejects all of them during hard filtering:

```json
{
  "recommendationId": "uuid",
  "requestedCount": 5,
  "returnedCount": 0,
  "complete": false,
  "rankingStatus": "UNRANKED",
  "rankingBasis": [],
  "unavailableCriteria": ["DISTANCE", "RATING", "POPULARITY"],
  "warning": {
    "code": "NO_ELIGIBLE_CANDIDATES",
    "messageKey": "recommendation.noEligibleCandidates"
  },
  "items": [],
  "filterSummary": {
    "retrieved": 1,
    "eligible": 0,
    "rejectedByReason": {"CATEGORY_MISMATCH": 1}
  }
}
```

The AI may state that non-hotel candidates were excluded, using only aggregate filter counts/reason codes. It must not name, attach, or display the rejected candidate unless the user explicitly starts a separate place-search request.

---

## 4. Data Model & Migrations

### 4.1 Recommendation-service migration

Existing `recommendation_impression_item.feature_snapshot` already stores item evidence, but historical comparison also needs the exact request/decision context and pre-diversification score breakdown. Add backward-compatible columns:

```sql
ALTER TABLE recommendation_impression
  ADD COLUMN decision_context JSONB,
  ADD COLUMN comparison_policy_version VARCHAR(80);

ALTER TABLE recommendation_impression_item
  ADD COLUMN score_breakdown JSONB,
  ADD COLUMN evidence_coverage DOUBLE PRECISION;

ALTER TABLE recommendation_impression_item
  ADD CONSTRAINT ck_impression_item_evidence_coverage
  CHECK (evidence_coverage IS NULL OR (evidence_coverage >= 0 AND evidence_coverage <= 1));
```

`decision_context` stores only sanitized deterministic fields:

- requested criteria, directions, and importance enums;
- effective ranking basis and unavailable criteria;
- geographic anchor type and coordinates required to interpret distance;
- feature/ranking/diversity/comparison versions;
- no raw prompt, access token, provider credential, or personal free text.

New impressions require all comparison fields at the application layer. Columns remain nullable during rollout so old rows remain readable; comparison of a legacy row returns `COMPARISON_SNAPSHOT_UNAVAILABLE`.

### 4.2 Persistence access

Add an owner-scoped `RecommendationDecisionSnapshotReader` port. Its adapter performs one bounded join over impression and selected items. It never exposes a repository/entity outside recommendation-service and never queries Place or AI databases.

### 4.3 Retention and rollback

- Comparison eligibility follows the existing recommendation impression retention policy.
- Rollout is expand-first: nullable columns, dual-write, verify, enable comparison endpoint.
- Rollback disables endpoint/tool/UI flag, stops new writes, then removes columns only in a later migration after the rollback window.
- No attempt is made to synthesize historical snapshot data from old final scores.

No new AI-service persistence table is required. AI's existing conversational impression can retain artifact references, while recommendation-service remains authoritative for decisions.

---

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Impression/candidate IDOR | Derive user identity from verified JWT; owner-scoped lookup; do not trust client user IDs; hide non-owned existence with `404` |
| Client-forged evidence or thresholds | Endpoint accepts only recommendation ID and candidate IDs; all evidence, weights, and policy values are loaded server-side |
| Prompt injection from provider text | Comparison engine ignores prose; LLM gets allowlisted typed fields; descriptions/reviews are not decision instructions |
| Fixture leakage | Profile-gated fixture provider namespace plus server-side production rejection and frontend defense-in-depth filtering |
| Raw error leakage | Stable public error codes/messages; detailed exceptions only in sanitized server logs under existing standards |
| Enumeration/abuse | UUID recommendation IDs, bounded candidates, per-user rate limits, request size limits, audit metrics |
| Sensitive retention | Store query hash and sanitized decision context only; never store raw prompt, secrets, or tokens |
| Stale evidence | Preserve evidence/freshness in snapshot and state comparison is “theo dữ liệu tại thời điểm gợi ý”; a future refresh is a new recommendation ID |

Provider credentials stay backend-side. No direct browser-to-provider call is added.

---

## 6. Devil's Advocate & Technical Trade-offs

### 6.1 Why prompt-only changes are rejected

Prompt rules cannot guarantee deterministic routing, ownership, evidence comparability, thresholds, replay, or safe behavior after model changes. The winner decision belongs in recommendation-service; prompts are defense in depth only.

### 6.2 Why raw final score/rank is insufficient

The final score may be normalized over different available dimensions per item, and MMR may reorder items for diversity. Comparing those ranks as utility can reward missing data or mistake diversity for quality. Comparison therefore rebuilds a common pairwise feature space from mutually available evidence.

### 6.3 Sparse evidence versus usefulness

A strict evidence floor will produce more `INSUFFICIENT_DATA` outcomes. This is intentional: an honest non-decision is better than an unsupported winner. The response remains useful by exposing comparable facts, missing dimensions, and safe next actions such as widening radius or refreshing provider data.

### 6.4 Rating uncertainty

Raw averages overvalue small samples. `comparison-v1` uses the same versioned confidence-adjusted quality policy as ranking (Bayesian shrinkage/minimum evidence), while still displaying raw rating and review count separately. Threshold calibration must avoid double-counting rating and popularity; outcome reasons identify both contributions.

### 6.5 Multi-candidate comparison

The endpoint permits up to five candidates for UI reuse, but the first conversational implementation targets two-place comparisons. For more than two, service returns a deterministic decision matrix and optional winner only if the same decision rules hold across all candidates; otherwise `TIED`/`INSUFFICIENT_DATA`. No tournament tie-break guessing.

### 6.6 Real provider accuracy

“Real map data” means provider-grounded and traceable, not guaranteed perfect. The engine preserves provider, timestamps, freshness, and availability; it does not relabel provider data as independently verified truth. Address/category conflicts remain filter/degradation signals, not LLM repair opportunities.

### 6.7 Availability and latency

Comparison reads immutable local recommendation snapshots, so it does not depend on live Place provider availability and should remain low latency. Refreshing current evidence creates a new recommendation rather than mutating the old decision. This provides reproducibility at the cost of showing snapshot-age context.

---

## 7. Phased Implementation Tasks & Verification

### Phase 1 — Contracts and immutable snapshots

- [ ] Add migration for decision context, score breakdown, evidence coverage, and comparison policy version.
- [ ] Persist sanitized request criteria, effective basis, versions, typed feature evidence, and pre-diversification score breakdown atomically with each impression.
- [ ] Add owner-scoped snapshot reader port/adapter and legacy-snapshot failure behavior.
- [ ] Extend recommendation response with `rankingStatus`, `comparisonAvailable`, and policy version.
- [ ] Add domain/contract tests for serialization, old rows, transaction rollback, and no sensitive fields.

### Phase 2 — Deterministic comparison engine

- [ ] Implement typed comparison domain models and `comparison-v1` policy configuration.
- [ ] Build mutually available criterion matrix and confidence-adjusted rating comparison.
- [ ] Implement evidence floor, meaningful deltas, aggregate normalization, and the three statuses.
- [ ] Ensure MMR position and fallback sort keys cannot create a winner.
- [ ] Add endpoint, validation, ownership/membership checks, stable errors, and Gateway route/rate limit.
- [ ] Add unit/property tests for symmetry: swapping candidate input order swaps evidence sides but does not change the semantic decision.

### Phase 3 — AI routing, context binding, and verbalization

- [ ] Change all `PLACE_RECOMMENDATION` fallback paths from `search_places` to `recommend_places`.
- [ ] Add `compare_recommended_places` tool and exact-reference resolver over the preceding artifact.
- [ ] Prevent arbitrary free-form IDs and prevent comparison from stale unrelated artifacts.
- [ ] Emit typed `PLACE_COMPARISON` artifact and constrain LLM to status/evidence codes.
- [ ] Remove prompt requirements that rely on generated Markdown tables as the primary UI.
- [ ] Add tests for model failure, tool timeout, ambiguous names, missing snapshot, and no hallucinated winner.
- [ ] Make final artifact selection authoritative: recommendation items replace, rather than merge with, raw retrieval candidates for recommendation intents.
- [ ] Clear stale place artifacts/cards on a completed zero-result recommendation while retaining prior messages unchanged.

### Phase 4 — Native web presentation

- [ ] Extend AI artifact types with complete recommendation/comparison contracts (no lossy local type).
- [ ] Add native localized recommendation and comparison tables with responsive overflow and accessibility semantics.
- [ ] Switch “Ưu tiên”/“STT” based on `rankingStatus` and render missing evidence explicitly.
- [ ] Keep raw server/debug/tool content out of messages, toasts, console logs, and exported text.
- [ ] Preserve real provider photos/cards while preventing fixture-detail fetches and 404 noise.

### Phase 5 — Evaluation, calibration, and rollout

- [ ] Create a versioned golden dataset containing at least 60 cases: decisive, tied, insufficient, conflicting criteria, sparse reviews, missing distance, outside radius, wrong category, and fixture leakage.
- [ ] Include exact regression cases for Son Tra vegetarian restaurants and cafes.
- [ ] Calibrate thresholds without changing statuses to satisfy desired prose; record threshold rationale/version.
- [ ] Add shadow metrics before enabling winner display, then release behind a feature flag.
- [ ] Monitor unsupported-winner rate, status distribution, evidence coverage, routing correctness, latency, errors, and provider freshness.

### Required tests

**Recommendation-service**:

- Unit: availability matrix, score re-normalization, distance units, review confidence, every status boundary, deterministic explanation codes.
- Property: null never improves a candidate; unavailable never becomes zero; input order invariance; identical evidence is never `RECOMMENDED`.
- Integration: impression ownership, candidate membership, legacy snapshot, migration compatibility, rollback atomicity.
- Contract: endpoint JSON/schema and Gateway authentication propagation.

**AI-service**:

- Classification/routing: all recommendation fallbacks call `recommend_places`.
- Conversation: name-to-ID resolution uses only prior artifact; ambiguous names request clarification.
- Verbalization: `winnerPlaceId=null` never yields preference language; unavailable dimensions remain unknown.
- Failure: service timeout produces sanitized partial response without switching to unranked search as a hidden substitute.
- Membership: a category-rejected attraction may appear in internal retrieval diagnostics but never in the final recommendation artifact.

**Web**:

- Component: all three states, missing values, long Vietnamese names/addresses, narrow viewport, keyboard/screen reader labels.
- Security/error: no raw backend exception or tool payload; no fixture photo request.
- E2E: initial recommendation -> native ranked table -> compare two cards -> matching native decision table.
- E2E zero-result: hotel request -> one wrong-category retrieval candidate -> zero cards/empty carousel -> localized empty state and expansion action.

### Verification commands

```bash
cd services/recommendation-service && ./mvnw test
cd services/ai-service && pytest -q
cd apps/web/tripsense && npm run lint
cd apps/web/tripsense && npm test -- --run
cd apps/web/tripsense && npm run build
```

### Release gates and success metrics

- Recommendation-intent routing to recommendation-service: `100%` in golden/E2E cases.
- Unsupported winner rate: `0` in golden set and sampled production audits.
- Decision replay determinism for identical snapshot/version: `100%`.
- Fixture leakage in non-development profiles: `0`.
- Comparison API p95 target: `<150 ms` excluding Gateway/network overhead.
- Raw error/debug leakage: `0` in E2E and log-sanitization tests.
- Winner display remains feature-flagged until the golden set passes and status-distribution review shows no systematic over-selection.

---

## 8. Approval Decisions Requested

Human approval of this plan authorizes:

1. The new authenticated comparison endpoint and `comparison-v1` deterministic policy.
2. The additive recommendation impression migration and snapshot dual-write.
3. Mandatory `recommend_places` routing for recommendation intents, including fallbacks.
4. Native frontend recommendation/comparison tables driven by typed artifacts.
5. Conservative defaults that prefer `TIED` or `INSUFFICIENT_DATA` over unsupported winner selection.

No production provider import, scraping, synthetic venue insertion, or learned-ranking rollout is authorized by this plan.

---

## Human Approval Gate

```text
STATUS: IMPLEMENTING
```

Implementation was authorized by the user on 2026-09-25 with “sửa đi”.
