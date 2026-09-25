# Evidence-Aware Recommendation Ranking — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/recommendation-service`
- **Affected Components**: `services/place-service`, `services/recommendation-service`, `services/ai-service`, `apps/web/tripsense`
- **Created Date**: 2026-09-25
- **Approved Date**: 2026-09-25
- **Related Baseline**: [Recommendation Engine V2](./recommendation-engine-v2.md)
- **Target PR Boundaries**: Phase 1 development fixtures; Phase 2 Place evidence contract; Phase 3 recommendation filtering/scoring/response; Phase 4 AI/UI integration; Phase 5 verification

---

## 1. Goal & Requirements

### 1.1 Problem statement

The V2 engine deterministically retrieves and ranks canonical places, but its current end-to-end contract loses request criteria such as required place category, quietness, and requested ranking objectives. Missing rating data can be converted to a configured prior, unavailable dimensions are represented as zero-weight contributions without availability-aware normalization, and the public response does not state completeness, ranking basis, unavailable criteria, or typed straight-line distance. The AI layer therefore cannot reliably distinguish candidate retrieval from a complete recommendation and lacks sufficient typed evidence to explain the final order.

This increment delivers the canonical pipeline:

```text
retrieve -> hard filter -> enrich -> availability-aware score -> rank
         -> typed explanation contract -> LLM verbalize only
```

### 1.2 User flow

1. The traveler requests five quiet cafes within 5 km of Son Tra Peninsula, prioritizing proximity and quality.
2. AI normalizes the request into required categories, geographic constraints, desired criteria, ranking objectives, and requested count.
3. Recommendation service retrieves a widened canonical candidate pool from Place service.
4. Recommendation service hard-filters category, radius, business status, and strict named-area conflicts before feature extraction.
5. Place-backed evidence is normalized into independently available rating, popularity, quietness, and distance features.
6. The ranker scores only available requested/configured dimensions and records feature availability and the exact ranking basis.
7. The response states whether the request is complete, which criteria were usable, which were unavailable, and why each item was ranked.
8. AI preserves item order and verbalizes only typed response evidence. `null` remains unknown.

### 1.3 Scope boundaries

**In scope**:

- An idempotent, development-only Son Tra recommendation fixture set in Place-owned MongoDB.
- Additive Place DTO support for typed quietness evidence.
- Required-category and strict named-area hard filters in recommendation-service.
- Separate availability for rating, review-count popularity, quietness, and distance.
- Availability-aware weighted score normalization.
- Typed completeness, criteria availability, distance, warning, and explanation evidence in the recommendation response.
- AI request mapping, evidence-preserving prompt grounding, order preservation, and feedback-position correction.
- Tests for insufficient candidates, missing attributes, fallback ranking, geographic conflict, and hallucination prevention.
- Removal/suppression of blank activity rows and prevention of encoded category artifacts in the recommendation presentation path.

**Out of scope**:

- Claiming route distance or travel time. Only Haversine straight-line distance is supported.
- Inferring quietness from place name, LLM knowledge, or an unstructured description.
- Scraping reviews or adding a second external provider.
- Enabling Qdrant or a learned ranker.
- Production data backfill. Production enrichment requires a separately approved provider/backfill operation.
- Moving final ranking into `PlaceRankingService`; that service remains retrieval-only.

### 1.4 Domain invariants

1. `place-service` owns canonical Place facts and evidence; fixtures write only to its development MongoDB.
2. `recommendation-service` owns hard filtering, feature availability, final scoring, ranking, completeness, and explanation evidence.
3. AI cannot add candidates, reorder items, calculate distances/scores, or turn absent values into claims.
4. Missing rating is neither zero nor the configured prior. It is unavailable.
5. Review count and rating availability are independent; popularity may be available while rating is unavailable.
6. Missing quietness is unavailable and never inferred from text.
7. Radius checks use Haversine distance and label it `STRAIGHT_LINE`; route distance remains `null`.
8. Required category filtering occurs before ranking and before result limiting.
9. A strict named-area conflict is rejected or explicitly degraded before user-visible output.
10. Public traffic remains Gateway-fronted and no service reads another service's database.

### 1.5 Acceptance criteria

- [ ] AC-1: The development database contains at least ten deterministic Son Tra fixtures: at least seven valid in-radius cafes plus wrong-category, outside-radius, administrative-conflict, and permanently-closed controls.
- [ ] AC-2: Re-running the fixture command updates the same fixture IDs without duplicates and never deletes provider-owned records.
- [ ] AC-3: `CAFE` is transmitted as a required category and non-cafes are removed before feature extraction/ranking.
- [ ] AC-4: Candidates outside 5 km, permanently closed candidates, and strict-area conflicts are excluded with typed filter reason codes.
- [ ] AC-5: `rating=null, reviewCount>0` yields rating unavailable and popularity available; no prior rating is emitted as observed quality.
- [ ] AC-6: Quietness contributes only when typed quietness evidence is present and valid; otherwise it is listed as unavailable.
- [ ] AC-7: Final score is `sum(weight_i * value_i) / sum(weight_i)` over available active dimensions only. Negative penalties remain separate and bounded. Evidence coverage is reported separately and is a deterministic tie-breaker, not a fabricated score.
- [ ] AC-8: Response includes requested/returned counts, completeness, ranking basis, unavailable criteria, warning, straight-line distance, per-item criterion availability, and typed reasons with supporting values.
- [ ] AC-9: When only two of five candidates qualify, the response has `returnedCount=2`, `complete=false`, and `INSUFFICIENT_VERIFIED_CANDIDATES`.
- [ ] AC-10: AI output says the order is distance-based when distance is the only available requested objective and does not claim rating/quietness superiority.
- [ ] AC-11: AI feedback for every displayed item forwards the original recommendation rank; item two is never sent as position one.
- [ ] AC-12: No blank numbered activity rows, raw HTML entities, or tool/debug payloads appear in the user-facing recommendation output.

---

## 2. Architecture & Service Boundaries

### 2.1 Data flow

```text
Development seed command
    -> MongoDB tripsense_places.places (fixture provider namespace only)

User -> Web -> API Gateway -> AI service
                              -> POST recommendation-service /api/recommendations
                                  -> resolve context
                                  -> Place candidate generator -> place-service REST
                                  -> hard filters
                                  -> evidence enrichment/normalization
                                  -> feature extraction
                                  -> availability-aware ranker
                                  -> diversity (order-safe over ranked candidates)
                                  -> immutable impression
                              <- typed RecommendationResponse
                         <- LLM verbalizes typed evidence without re-ranking
```

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| `place-service` | Canonical place facts, quietness evidence persistence/DTO, provider normalization, development fixture ownership |
| `recommendation-service` | Required-category and geographic hard filters, evidence availability, scoring, ranking, completeness, explanation contract, impressions |
| `ai-service` | Intent normalization, request mapping, preservation of response evidence/order, bounded natural-language rendering, feedback proxy |
| `apps/web/tripsense` | Render final text and place cards safely; keep operational activity separate from answer/export |

No Kafka event or cross-service persistence is introduced. Synchronous REST is retained because ranking needs Place evidence in the user request path.

### 2.3 Stage contracts

```text
CandidateRetrievalPipeline
  -> CandidateFilterPipeline
  -> CandidateEvidenceEnrichmentPipeline
  -> FeaturePipeline
  -> AvailabilityAwareHeuristicRanker
  -> Diversifier
  -> RecommendationExplanationAssembler
```

Enrichment in this increment normalizes evidence already returned in the widened Place response. It must not add a per-candidate Place details N+1 call. A future batch enrichment endpoint requires its own measured need.

---

## 3. API Contracts

### 3.1 Additive recommendation request

`POST /api/recommendations` remains authenticated and backward-compatible. New fields are optional for old callers.

```json
{
  "query": "quán cà phê bán đảo Sơn Trà",
  "lat": 16.1068,
  "lng": 108.2772,
  "radiusMeters": 5000,
  "limit": 5,
  "requiredCategories": ["CAFE"],
  "geographicScope": {
    "name": "Sơn Trà, Đà Nẵng",
    "adminArea": "Đà Nẵng",
    "district": "Sơn Trà",
    "strictNamedArea": true
  },
  "rankingCriteria": [
    {"feature": "DISTANCE", "direction": "MINIMIZE", "importance": "HIGH"},
    {"feature": "RATING", "direction": "MAXIMIZE", "importance": "HIGH"},
    {"feature": "QUIETNESS", "direction": "MAXIMIZE", "importance": "HIGH"}
  ]
}
```

Allowlisted enums:

- Required categories initially reuse the normalized Place category taxonomy.
- Criteria: `RETRIEVAL_RELEVANCE`, `DISTANCE`, `RATING`, `POPULARITY`, `QUIETNESS`, `PREFERENCE`, `CONTEXT`, `HISTORY`, `SEMANTIC`.
- Direction: `MINIMIZE`, `MAXIMIZE`.
- Importance maps to versioned configuration weights; clients cannot send arbitrary numeric weights.

Validation remains bounded: maximum 20 categories, maximum 12 criteria, no duplicate feature, coordinates paired, radius `100..50_000`, limit `1..50`.

### 3.2 Place evidence contract

The existing Place recommendation DTO receives one additive nullable field:

```json
{
  "quietnessEvidence": {
    "score": 0.86,
    "evidenceCount": 14,
    "source": "VERIFIED_REVIEWS",
    "observedAt": "2026-09-25T00:00:00Z"
  }
}
```

Rules:

- `score`: `0..1`.
- `evidenceCount`: non-negative.
- `source`: allowlisted evidence origin such as `VERIFIED_REVIEWS`, `CURATED`, or `DEVELOPMENT_FIXTURE`.
- Missing or invalid evidence maps to unavailable, never zero.
- Public response may expose score/count/source but never raw review text through this field.

### 3.3 Typed recommendation response

```json
{
  "success": true,
  "data": {
    "recommendationId": "uuid",
    "requestedCount": 5,
    "returnedCount": 2,
    "complete": false,
    "rankingBasis": ["DISTANCE"],
    "unavailableCriteria": ["RATING", "QUIETNESS"],
    "warning": {
      "code": "INSUFFICIENT_VERIFIED_CANDIDATES",
      "messageKey": "recommendation.insufficientVerifiedCandidates"
    },
    "items": [
      {
        "place": {
          "id": "canonical-place-id",
          "name": "Cafe Du Musee",
          "rating": null,
          "userRatingCount": null,
          "quietnessEvidence": null
        },
        "rank": 1,
        "score": 0.91,
        "evidenceCoverage": 0.3333,
        "distance": {
          "straightLineKm": 0.7,
          "routeDistanceKm": null,
          "kind": "STRAIGHT_LINE"
        },
        "availableCriteria": ["DISTANCE"],
        "unavailableCriteria": ["RATING", "POPULARITY", "QUIETNESS"],
        "scoreBreakdown": {
          "DISTANCE": {
            "available": true,
            "normalizedValue": 0.91,
            "configuredWeight": 0.15,
            "normalizedWeight": 1.0,
            "contribution": 0.91
          },
          "RATING": {"available": false},
          "QUIETNESS": {"available": false},
          "finalScore": 0.91
        },
        "reasons": [
          {
            "code": "NEAR_REQUESTED_AREA",
            "criterion": "DISTANCE",
            "supportingValue": {"straightLineKm": 0.7},
            "contribution": 0.91
          }
        ]
      }
    ],
    "filterSummary": {
      "retrieved": 10,
      "eligible": 2,
      "rejectedByReason": {
        "CATEGORY_MISMATCH": 2,
        "OUTSIDE_MAXIMUM_RADIUS": 1
      }
    },
    "versions": {
      "feature": "features-v2",
      "ranking": "heuristic-availability-v2",
      "explanation": "recommendation-explanation-v1"
    },
    "degradations": []
  }
}
```

Top-level `unavailableCriteria` contains requested criteria unavailable for every returned result. Per-item availability remains authoritative for mixed evidence. `warning.messageKey` is stable; localized prose belongs to the UI/AI layer.

### 3.4 Feedback contract preservation

No public feedback API shape changes. AI stores and forwards the original `recommendationId`, `placeId`, and upstream `rank`. Filtered display lists retain upstream rank rather than re-numbering the impression. Feedback for a non-displayed item remains impossible.

---

## 4. Data Model, Development Fixtures, and Migration

### 4.1 Place-owned MongoDB field

MongoDB `places` receives an additive optional subdocument:

```javascript
quietnessEvidence: {
  score: Number,
  evidenceCount: NumberInt,
  source: String,
  observedAt: ISODate
}
```

No recommendation database column is required. Existing impression JSON already stores versioned score evidence and will be updated additively.

### 4.2 Development fixture dataset

Add an idempotent repository script under `scripts/dev/` and execute it only against the Compose development database. Fixture documents use:

```text
provider = "tripsense-dev-fixture"
providerPlaceId = "son-tra-rec-<case>"
sourceData.fixtureSet = "son-tra-recommendation-v1"
```

Required cases:

| Case | Expected behavior |
| --- | --- |
| Five or more in-radius cafes with rating, reviews, and quietness | Full multi-criteria rank path |
| In-radius cafe with `rating=null`, `reviewCount>0` | Rating unavailable; popularity available |
| In-radius cafe with rating but zero reviews | Rating unavailable under confidence policy; popularity available with zero value |
| In-radius cafe with quietness missing | Quietness unavailable, not zero |
| In-radius restaurant | `CATEGORY_MISMATCH` hard rejection |
| Cafe beyond 5 km | `OUTSIDE_MAXIMUM_RADIUS` hard rejection |
| Cafe with `district=Hải Châu` under strict Sơn Trà scope | `ADMIN_LOCATION_CONFLICT` hard rejection |
| Permanently closed cafe | `BUSINESS_STATUS_REJECTED` |

Every fixture has deterministic IDs, coordinates, category, address, district, freshness timestamps, and explicit expected test behavior. Names must include a visible `TripSense Test` marker to avoid confusing fixtures with real provider venues.

### 4.3 Seed safety and rollback

- The seed command refuses non-local Mongo hosts unless `ALLOW_DEV_FIXTURE_SEED=true` is explicitly set.
- It uses `updateOne(..., {$set: ...}, {upsert: true})` keyed by `(provider, providerPlaceId)`.
- It never calls `deleteMany({})` or modifies non-fixture providers.
- Rollback deletes only `{provider: "tripsense-dev-fixture", "sourceData.fixtureSet": "son-tra-recommendation-v1"}` after printing the matched count and requiring an explicit fixture-set argument.
- Production Compose does not mount or auto-run the fixture.

---

## 5. Scoring and Explanation Rules

### 5.1 Independent availability

| Criterion | Available when |
| --- | --- |
| `DISTANCE` | Request has an anchor and candidate has valid coordinates |
| `RATING` | Rating is valid and review count meets the configured minimum confidence policy |
| `POPULARITY` | Review count is present and non-negative, independent of rating |
| `QUIETNESS` | Valid typed quietness evidence exists |
| Other existing criteria | Their current typed extractor reports available |

Bayesian quality may shrink an observed rating only after rating availability is established. It may not manufacture availability from the prior.

### 5.2 Availability-aware score

For active criteria `A(c)` available on candidate `c`:

```text
baseScore(c) = sum(weight_i * normalizedValue_i) / sum(weight_i), i in A(c)
finalScore(c) = clamp(baseScore(c) + boundedPenalties(c), 0, 1)
evidenceCoverage(c) = availableRequestedWeight / totalRequestedWeight
```

If no positive criterion is available, the deterministic fallback is retrieval order with `NO_SCORABLE_REQUESTED_CRITERIA`. Missing criteria do not receive zero, prior, or average values. Sorting is:

1. `finalScore DESC`
2. `evidenceCoverage DESC`
3. upstream retrieval rank
4. canonical Place ID

The response must make this order and fallback basis explicit.

### 5.3 LLM contract

AI receives the typed recommendation object after bounded compaction that preserves:

- request/return counts and completeness;
- ranking basis and unavailable criteria;
- item order and upstream rank;
- straight-line distance and its kind;
- supported rating/review/quietness values;
- reason codes and supporting values;
- warning and degradation codes.

Prompt rules prohibit:

- reordering or adding places;
- calculating distance from coordinates;
- calling an item “best” without matching typed criteria;
- converting `null` into a guess;
- asking the user to supply Google Maps results as the default fallback.

---

## 6. Security and Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Fixture contamination | Local-host guard, fixture provider namespace, no production auto-run, targeted rollback only |
| User-controlled weights | Enum/importance allowlists; numeric weights remain server configuration |
| LLM fabrication | Typed evidence only; preserve order; no raw coordinates-only distance explanation |
| Cross-service data access | Recommendation uses Place REST only; no Mongo access outside Place ownership |
| Raw provider/review leakage | Quietness exposes aggregate evidence only; no raw review text |
| Feedback poisoning | Preserve immutable recommendation ID and upstream shown rank; existing ownership/idempotency validation remains |
| HTML/entity injection | Render text nodes, normalize bounded provider category strings, never use raw HTML injection |

No secret or personal profile data is added to the response, fixtures, logs, or browser.

---

## 7. Devil's Advocate and Trade-offs

| Risk / alternative | Decision |
| --- | --- |
| Dynamic weight normalization can let a candidate with sparse evidence score highly | Keep missing neutral as required; expose `evidenceCoverage` and use it as a deterministic tie-breaker rather than silently penalizing missing data |
| Quietness is subjective | Accept only typed aggregate evidence with source/count/time; otherwise unavailable |
| Strict district filtering may reject a valid border venue | Apply it only when `strictNamedArea=true`; radius remains independently enforced |
| Enrichment could reintroduce N+1 latency | Normalize fields from the widened Place candidate response; do not call details per candidate |
| Adding test records may pollute user search | Development-only provider namespace and visible test naming; never seed production automatically |
| Returning score internals may expose too much | Expose bounded normalized criterion evidence, not raw profiles, embeddings, or provider payloads |
| Moving rank to Place service | Rejected because it violates the approved ownership split between retrieval rank and final recommendation rank |

---

## 8. Phased Implementation and Verification

### Phase 1 — Development data first

- [ ] Add the idempotent Son Tra Mongo fixture and targeted cleanup scripts.
- [ ] Add fixture validation that asserts IDs, count, coordinates, and required edge cases.
- [ ] Run the seed against the active development Compose database.
- [ ] Record inserted/updated fixture counts without printing credentials.
- [ ] Smoke-test Place retrieval against the seeded dataset before recommendation changes.

### Phase 2 — Place evidence contract

- [ ] Add the typed quietness evidence model and DTO mapping in place-service.
- [ ] Preserve backward compatibility for documents and callers without the field.
- [ ] Add persistence/DTO/contract tests for present, absent, and invalid quietness evidence.
- [ ] Ensure list retrieval remains bounded and does not call details per candidate.

### Phase 3 — Filter, enrich, score, rank, explain

- [ ] Extend request DTO/context with required categories, strict geographic scope, and ranking criteria.
- [ ] Add category and strict-area hard filters with retained filter reason counts.
- [ ] Add the evidence-enrichment stage before feature extraction.
- [ ] Split rating and popularity availability; add quietness feature extraction.
- [ ] Implement availability-aware normalization and deterministic tie-breaking.
- [ ] Add response completeness, availability, typed distance, warnings, explanation reasons, and version updates.
- [ ] Preserve original upstream rank in the immutable impression.

### Phase 4 — AI and web integration

- [ ] Map `RecommendationGoal` categories/preferences/objectives into the new request contract.
- [ ] Preserve typed recommendation evidence during prompt compaction.
- [ ] Add an explicit verbalization prompt and deterministic insufficient-result fallback.
- [ ] Fix local impression storage and feedback proxy to forward upstream rank.
- [ ] Prevent blank activity rows and raw encoded category strings from entering recommendation presentation/export.
- [ ] Add i18n keys for partial-result and unavailable-criteria messages.

### Phase 5 — Verification and PR review

- [ ] Unit tests for all missing-value combinations and score normalization.
- [ ] Contract tests for old and new recommendation request/response shapes.
- [ ] Integration test seeded Son Tra query returning five ranked cafes when sufficient.
- [ ] Integration test reduced fixture subset returning two-of-five with correct warning.
- [ ] Test wrong category, outside radius, strict-area conflict, and closed place rejection.
- [ ] Test LLM grounding object contains no unsupported facts and preserves order.
- [ ] Test feedback on the second item forwards position two.
- [ ] Web tests for no blank activities and no literal HTML entity artifact.

Verification commands:

```bash
./mvnw -pl services/place-service,services/recommendation-service -am test
cd services/ai-service && pytest -q tests
cd apps/web/tripsense && npm run test -- --reporter=dot
cd apps/web/tripsense && npm run type-check
cd apps/web/tripsense && npm run i18n:check
./mvnw spotless:check
docker compose --env-file env/.env config
```

Runtime acceptance uses the exact prompt:

```text
Gợi ý địa điểm: tìm 5 quán cà phê yên tĩnh ở bán đảo Sơn Trà, Đà Nẵng,
trong bán kính 5 km, ưu tiên gần và đánh giá tốt.
```

The test captures request mapping, retrieved/filtered counts, feature availability, final response JSON, AI text, rendered artifacts, and feedback for rank two.

---

## Human Approval Gate

```text
STATUS: DONE
```

Approved by the user on 2026-09-25 with the instruction to continue implementation, beginning with development data seeding.

Implementation completed on 2026-09-25. Verification covered the seeded 5-of-5 and insufficient-result runtime paths, 34 recommendation-service tests, 26 AI-service tests, 14 focused web tests, TypeScript type-check, i18n schema validation, Compose validation, and whitespace validation. The checklist above is retained as the approved planning baseline; completion evidence is recorded in the implementation and test results.

### Post-implementation correction — real provider data only

On 2026-09-25 the user rejected development fixtures in user-visible recommendation results. All `tripsense-dev-fixture` documents and their Redis cache entries were removed, and the seed/cleanup scripts were deleted from the repository. Runtime acceptance now uses canonical ZioMap-backed places only. Place retrieval evaluates sufficiency after applying the requested radius, so geographically irrelevant stored results cannot prevent a provider refresh. Explicit conflicting district text in a provider address is also rejected under strict named-area scope when the structured district is absent.

Legacy conversation artifacts are defensively filtered by fixture ID, provider, and visible test-name prefix before rendering or Place detail enrichment. This prevents deleted fixture IDs from generating 404 requests without mutating user conversation history. The AI runner also initializes the published artifact per tool call and persists recommendation impressions only when an artifact was actually published, preventing planning-mode recommendation runs from failing with an unbound artifact reference.
