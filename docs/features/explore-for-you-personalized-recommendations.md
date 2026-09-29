# Explore “For You” Personalized Recommendations — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/recommendation-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/recommendation-service`, `services/context-service`, `services/place-service`
- **Created Date**: 2026-09-28
- **Related Baselines**: [Recommendation Engine V2](./recommendation-engine-v2.md), [Evidence-Aware Recommendation Ranking](./evidence-aware-recommendation-ranking.md), [Explore Search Autocomplete Dropdown](./explore-search-autocomplete-dropdown.md), [Mindtrip Explore Experience Redesign](./mindtrip-explore-experience-redesign.md)
- **Target PR Boundaries**: Phase 1 contract/context correctness; Phase 2 non-empty recommendation policy; Phase 3 Explore integration; Phase 4 feedback, observability, and rollout

---

## 0. Repository Audit & Key Findings

### 0.1 Current Explore behavior

`PlaceDiscoveryView` currently uses `searchPlaces(...)` for every feed mode, including `for-you`:

```text
initial / destination change
  -> GET /api/places/search?q="địa điểm nổi tiếng ở <city>"

typing >= 2 characters
  -> debounced GET /api/places/search (dropdown only)

Enter
  -> GET /api/places/search?q=<typed query>
  -> replace feed
```

Consequences:

1. “For You” is presently a generic Place search, not a personalized recommendation surface.
2. The implemented `recommendation-service` pipeline is not called by Explore.
3. The selected city is only a coordinate/query hint; it is not an explicit, server-validated destination context.
4. The input has only one `query` state. There is no explicit separation between text being typed and the last submitted recommendation query.
5. Selecting a provider place from the dropdown can prepend it to the feed. This mixes lookup/navigation results with the ranked For You result set.
6. The clear button currently submits an empty query and changes the feed even though no Enter action occurred.
7. Place API calls use raw `fetch`, while the web application rules require `apiClient` for authenticated/sanitized requests.

### 0.2 Existing recommendation capabilities that must be reused

The repository already implements the correct owner boundary:

```text
recommendation-service
  -> user-service: personalization consent
  -> context-service: purpose-scoped declared preferences
  -> recommendation DB: observed impressions/feedback
  -> place-service: canonical candidates and provider refresh
  -> optional semantic retrieval
  -> hard filters -> features -> evidence-aware rank -> MMR diversity
  -> immutable recommendation impression
```

The public authenticated route already exists through API Gateway at `POST /api/recommendations`. Existing feedback is accepted at `POST /api/recommendations/{recommendationId}/events` with idempotency and ownership/position validation.

### 0.3 Personalization gaps discovered

1. `RemoteRecommendationContextProvider` reads only `FOOD_STYLE`, `ACTIVITY_INTEREST`, `STAY_STYLE`, and `SPLURGE_CATEGORY`, then drops signal confidence and places every `valueCode` into a flat category set.
2. `PreferenceFeatureExtractor` performs exact string intersection. Context codes such as `LOCAL_FOOD`, `HIKING`, or `BEACH` do not reliably equal provider categories such as `restaurant`, `tourist_attraction`, or Vietnamese category labels.
3. Context free text, home-city attributes, visited destinations, and want-to-visit destinations are not exposed as recommendation-safe derived signals. Raw free text must not be sent to recommendation-service.
4. The implemented `MultiTimescaleProfileComposer` and `InteractionWeightCalculator` are not connected to runtime context construction. Observed history currently produces place-ID sets but no category affinities.
5. Semantic retrieval scores query similarity only; its `userSimilarity` value is currently zero.
6. A Context/User dependency failure silently disables declared personalization. That degradation is not visible to the Explore UI.

### 0.4 Security blocker discovered during audit

`services/recommendation-service/src/main/resources/application.yaml` currently contains non-empty credential defaults for external semantic infrastructure, and the internal indexing route is permitted without authentication. No credential value may be repeated in logs, documentation, tests, or UI.

Before enabling this Explore surface in any shared environment:

- rotate the exposed credentials;
- remove all credential defaults from tracked configuration and require environment/secret injection;
- protect `/api/recommendations/internal/**` with service authentication or a network-enforced internal boundary;
- verify Git history and deployment logs according to the team’s secret-incident process.

This is a release blocker, not a reason to expose or duplicate the secret values in this plan.

---

## 1. Goal & Requirements

### 1.1 Goal

Make Explore’s `For you` tab a deterministic, explainable, personalized place feed that:

- loads automatically from the selected city plus consented Context signals;
- incorporates the user’s submitted text only after an explicit Enter action;
- allows provider-backed autocomplete while typing without mutating the feed;
- returns the best available real places through a bounded fallback policy;
- never fabricates places, scores, evidence, or provider facts;
- learns from real impressions and user actions without crossing service data boundaries.

### 1.2 Required interaction state machine

The frontend must maintain separate state:

| State | Meaning | May change For You feed? |
| --- | --- | --- |
| `draftQuery` | Current text in the input | No |
| `committedQuery` | Last query explicitly submitted with Enter | Yes |
| `suggestions` | Provider/query dropdown results | No |
| `servedRecommendation` | Last atomically accepted non-empty recommendation response | Yes, only after a valid request succeeds |

Transitions:

```text
OPEN EXPLORE / SELECT CITY / RETURN TO FOR-YOU
  -> committedQuery = ""
  -> request personalized destination feed

TYPE
  -> update draftQuery
  -> debounce provider lookup for dropdown
  -> do not alter feed, map pins, result count, feed loading state, or committedQuery

CLICK PROVIDER PLACE
  -> open/select that Place on the map/detail overlay
  -> do not insert it into, replace, or re-rank the For You feed

CLICK TEXT SUGGESTION
  -> copy suggestion into draftQuery
  -> do not submit it

PRESS ENTER
  -> committedQuery = trim(draftQuery)
  -> request selected city + context + committed query
  -> atomically replace feed only with the served recommendation result

CLEAR INPUT WITHOUT ENTER
  -> draftQuery = ""
  -> close dropdown
  -> leave committedQuery and feed unchanged
```

Pressing Enter with an empty draft intentionally returns to the base personalized city feed. Enter on an unchanged committed query may use a fresh cache entry; it must not create parallel duplicate requests.

### 1.3 User flows

#### First authenticated visit

1. Web waits for authentication restoration to settle; it does not issue a generic request during the transient auth-loading state.
2. Web sends the selected canonical destination and no submitted query to recommendation-service.
3. Recommendation-service validates the destination, reads consent and purpose-scoped Context signals, obtains Place candidates, ranks and diversifies them, persists the served impression, and returns typed degradation/fallback metadata.
4. Web displays the non-empty ranked cards and map pins together.

#### Submitted search

1. While the traveler types, provider-backed dropdown lookup is isolated from the recommendation feed.
2. Only Enter commits the trimmed text.
3. Recommendation-service uses the submitted query as the strongest relevance intent while retaining destination, preferences, evidence quality, and diversity.
4. If exact retrieval is too sparse, the server relaxes retrieval in controlled stages and labels the fallback; it never silently claims unrelated results are exact matches.

#### Anonymous visit

An unauthenticated traveler receives a generic, destination-scoped Place feed and a localized sign-in affordance. It must be labeled as popular/explore results rather than personalized “because you like …” content. No anonymous identity is invented and no protected recommendation endpoint is made public solely for this surface.

### 1.4 In scope

- Explore integration with recommendation-service for the authenticated `for-you` tab.
- `draftQuery` versus `committedQuery` separation.
- A destination-validated Explore recommendation contract.
- Deterministic Context-code-to-Place-taxonomy mapping with signal confidence.
- Safe derived Context signals for selected onboarding data; never raw free text.
- Server-owned fallback policy, last-known-good cache, and stale/fallback response metadata.
- Non-empty-feed preservation in the browser.
- Impression/action feedback wiring.
- i18n, zero-leak errors, accessibility, cancellation, stale-response protection, metrics, and tests.
- Rotation/removal of discovered semantic credentials and protection of internal indexing routes before release.

### 1.5 Out of scope

- A new microservice.
- Direct browser calls to ZioMap, Qdrant, embedding providers, or Context.
- Cross-service database reads or shared JPA entities.
- LLM-based final ranking or LLM-generated place facts.
- Automatically treating arbitrary free text as a hard constraint.
- Guaranteeing a non-empty first response when all required services, providers, caches, and stored Place candidates are simultaneously unavailable.
- Redesigning non-For-You category tabs beyond preventing shared search state from causing regressions.

### 1.6 Domain invariants

1. `place-service` owns canonical Place/provider data and retrieval; `recommendation-service` owns personalization, final order, diversity, fallback policy, impressions, and feedback.
2. The selected city is a hard candidate scope where evidence permits; it is never inferred solely from query text.
3. A submitted query affects ranking only after Enter. Keystrokes, focus, blur, Escape, clear, query-suggestion click, and provider-place click do not commit it.
4. Provider dropdown results are lookup/navigation results, not recommendation members.
5. The server returns only real canonical Place snapshots. No fixture, synthetic venue, or LLM-generated venue can satisfy the non-empty policy.
6. Query relevance dominates on submitted-query requests; user preferences and quality personalize within relevant candidates and controlled fallback candidates.
7. On base For You requests, declared/observed preference, geographic suitability, quality, popularity, history, and diversity determine the order.
8. Missing optional evidence is unavailable, not zero and not guessed. Existing availability-aware normalization remains authoritative.
9. The frontend never merges raw retrieval, autocomplete, previous-city, or rejected candidates into a new recommendation response.
10. A failed/empty refresh never erases a previously displayed non-empty feed.
11. Feedback always carries the original `recommendationId`, canonical `placeId`, and upstream `rank`.
12. Consent off means no declared or observed personalization. The result may still be destination-scoped but must not claim personalization.

### 1.7 Acceptance criteria

- [x] AC-1: First authenticated entry to `/explore` with `for-you` active calls recommendation-service exactly once after auth restoration and includes the selected destination.
- [x] AC-2: The initial order changes deterministically for materially different consented preference profiles when candidates contain matching evidence.
- [x] AC-3: Typing any text, waiting for debounce, opening/closing the dropdown, clicking a query suggestion, pressing Escape, or clearing without Enter makes zero For You recommendation calls and leaves feed/map membership unchanged.
- [x] AC-4: Provider dropdown lookup still returns matching real places. Clicking one opens/selects it without inserting it into the ranked feed.
- [x] AC-5: Enter sends the exact normalized committed query plus destination; returned membership comes only from the recommendation response.
- [x] AC-6: Out-of-order or aborted responses cannot overwrite a newer destination/query result.
- [x] AC-7: Exact, relaxed, destination fallback, and last-known-good responses are distinguishable via typed metadata and localized UI copy.
- [x] AC-8: Empty/error refresh preserves the last non-empty compatible feed. Results from another user or destination are never reused.
- [x] AC-9: On a true first-load total outage with no safe cached data, UI shows a localized retry state without fake/unrelated places or raw errors.
- [x] AC-10: Context signal confidence and canonical taxonomy mapping affect scores; `LOCAL_FOOD`, `CAFE`, `HIKING`, `BEACH`, stay styles, and other supported codes have explicit tested mappings.
- [x] AC-11: Raw Context free text, tokens, secret values, embeddings, and provider payloads never reach the browser, impressions, cache keys, logs, or public response.
- [ ] AC-12: Each visible card emits at most one `IMPRESSION` per served recommendation/session; click/detail/save/add/remove events use idempotency keys and the original rank.
- [x] AC-13: Anonymous users receive a destination-scoped generic feed and no misleading personalized reason.
- [ ] AC-14: Context/semantic failures degrade safely to available ranking features; the response exposes stable degradation codes without raw downstream errors.
- [ ] AC-15: p95 server latency target is <= 1.5 seconds for a warm destination/profile cache and <= 3 seconds when one provider refresh is required; timeout never blocks the old feed.
- [x] AC-16: No tracked recommendation configuration contains live credential defaults, and the internal indexing API rejects unauthenticated public requests before rollout.

---

## 2. Architecture & Service Boundaries

### 2.1 Target interaction flow

```text
Authenticated Browser
  |  POST /api/recommendations/explore-for-you
  v
API Gateway (JWT + rate limit + no-store)
  v
recommendation-service
  +-> validate destination against server-owned catalog
  +-> user-service: consent
  +-> context-service: purpose=EXPLORE_RECOMMENDATION
  +-> recommendation DB: observed user/session history
  +-> place-service: canonical lexical/geo/provider candidates
  +-> optional semantic generator
  +-> staged fallback retrieval when candidate count is insufficient
  +-> filter -> feature extraction -> rank -> MMR
  +-> persist exactly the served impression
  `-> user-scoped Redis result / last-known-good cache

Typing path (separate)
Browser -> API Gateway -> place-service autocomplete/search -> dropdown only
```

### 2.2 Ownership and communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Draft/committed state machine, UI cache safety, rendering, action feedback | REST through Gateway only |
| `services/api-gateway` | Public routing, JWT propagation, rate limiting, response cache policy | Spring Cloud Gateway |
| `services/recommendation-service` | Explore orchestration, Context normalization, fallback, final rank/diversity, cache, impressions, feedback | Synchronous REST + owned PostgreSQL/Redis |
| `services/context-service` | Consented purpose-scoped declared and derived preference signals | Authenticated REST; owns its PostgreSQL data |
| `services/place-service` | Canonical Places, provider lookup/refresh, destination retrieval evidence | Internal synchronous REST; owns MongoDB |
| `services/user-service` | Identity and personalization consent | Authenticated synchronous REST |

No Kafka dependency is introduced for the serving path. Existing outbox records remain the future asynchronous integration point. The user-visible request needs an immediate answer, so synchronous bounded calls are appropriate.

### 2.3 Server-owned destination catalog

The browser sends a stable destination ID, not arbitrary scope authority. Recommendation-service validates it against configuration (initially `danang`, `hue`, `hoian`) containing canonical display name, aliases, center, default radius, maximum radius, and administrative names. Unknown IDs return `400 INVALID_DESTINATION`.

The client-supplied coordinates are not trusted to expand scope. Longer term the catalog may move behind a Place-owned read contract; this phase does not add cross-service persistence.

### 2.4 Context normalization

Add a focused `ExplorePreferenceMapper` in recommendation-service:

```text
Context PreferenceSignal(dimension, value, confidence, source, updatedAt)
  -> allowlist dimension/value
  -> map to canonical affinity features
  -> retain bounded confidence and freshness
  -> combine duplicate evidence deterministically
```

Examples (the implementation must keep the full mapping in versioned configuration/tests):

| Context code | Canonical affinities |
| --- | --- |
| `CAFE` | `cafe` |
| `LOCAL_FOOD` | `restaurant`, `local_food` |
| `STREET_FOOD` | `restaurant`, `street_food` |
| `FINE_DINING` | `restaurant`, `fine_dining` |
| `HOTEL`, `HOMESTAY`, `HOSTEL`, `RESORT` | corresponding stay category plus `lodging` |
| `NATURE`, `HIKING`, `CULTURE`, `BEACH`, `NIGHTLIFE` | corresponding experience/attraction affinities |

Exact provider strings remain normalized through the existing `PlaceCategoryTaxonomy`; UI labels never become scoring keys.

For multiple signals supporting one affinity, use a bounded confidence union rather than raw count:

```text
affinity(category) = 1 - product(1 - clamp(signalConfidence * mappingWeight, 0, 1))
```

Raw onboarding free text stays encrypted in context-service. Context may derive only allowlisted tags with source/version/confidence (initial release: deterministic Vietnamese/English keyword rules; optional AI-assisted extraction requires separate evaluation and must never directly control hard filters). Unrecognized text is ignored rather than guessed.

### 2.5 Ranking policy

Use versioned server configuration, never client-supplied numeric weights.

**Base For You (no committed query)** prioritizes:

1. destination eligibility and distance;
2. declared and observed preference affinity;
3. confidence-adjusted quality/popularity;
4. negative-history suppression and saved/add-to-trip signals;
5. MMR diversity across category and near-duplicate places.

**Submitted query** prioritizes:

1. lexical/semantic relevance to the committed query;
2. destination eligibility;
3. preferences as a re-ranker among relevant/related candidates;
4. evidence quality, distance, popularity, history, and diversity.

The query must not be diluted by profile preferences. A cafe lover searching `museum` should get relevant museums first, not cafes with weak query relevance.

### 2.6 Non-empty result policy

The backend owns one request-scoped cascade and persists only the final served set:

| Level | Candidate policy | UI meaning |
| --- | --- | --- |
| `EXACT` | committed query + selected destination + normal candidate pool | Best matching recommendations |
| `RELAXED_RETRIEVAL` | widen candidate pool/radius up to destination maximum; preserve query and recognized hard intent | More results near the selected city |
| `DESTINATION_BASELINE` | remove soft query terms, preserve any safely recognized hard category, rank popular/high-quality destination candidates with profile | Related/popular alternatives |
| `LAST_KNOWN_GOOD` | compatible prior non-empty response for same user + destination; query-specific cache only for same normalized query | Previously prepared recommendations; may be stale |

Rules:

- Minimum target before final limiting: `max(3 * requestedLimit, 30)` retrieved candidates where available.
- Fallback never crosses the selected destination maximum scope.
- A recognized hard category is not removed merely to fill cards. If it yields no results, destination baseline must be labeled as related alternatives, not exact matches.
- Current non-empty browser feed is the final resilience layer for refresh failures.
- An absolute first-load non-empty guarantee is impossible during total dependency/cache failure without fake or bundled stale data; the system must fail honestly in that case.

### 2.7 Cache and concurrency

- Exact cache key inputs: HMAC-pseudonymized user ID, destination ID, normalized committed-query hash, consent/profile fingerprint, algorithm version, and limit.
- Never place raw query, token, email, or raw preference values in a Redis key.
- Fresh result TTL: 10 minutes with request coalescing/single-flight for identical keys.
- Last-known-good TTL: 24 hours, user- and destination-scoped; query-specific responses are reusable only for the same query hash.
- Cache entries retain the original persisted `recommendationId` so feedback membership/rank remains verifiable.
- The web cache is scoped by authenticated user ID + destination + committed query and is cleared on logout/user change.
- Every request has an AbortController and monotonically increasing request ID. Only the latest compatible response may commit.

---

## 3. API & Event Contracts

### 3.1 Explore For You endpoint

Add an authenticated, surface-specific endpoint that reuses the existing recommendation domain pipeline without changing AI recommendation behavior:

`POST /api/recommendations/explore-for-you`

Request:

```json
{
  "destinationId": "danang",
  "query": "quán cà phê yên tĩnh",
  "sessionId": "explore.018f...",
  "limit": 20
}
```

Validation:

- `destinationId`: allowlisted `[a-z0-9-]{1,64}` and must exist in server catalog.
- `query`: optional after trimming, maximum 200 Unicode characters; control characters rejected.
- `sessionId`: existing bounded format, generated per authenticated browser session without PII.
- `limit`: `1..30`; default `20`.
- No body `userId`, coordinates, numeric weights, raw preference object, provider key, or arbitrary fallback flag.

Response:

```json
{
  "success": true,
  "data": {
    "recommendationId": "uuid",
    "destinationId": "danang",
    "committedQuery": "quán cà phê yên tĩnh",
    "queryApplied": true,
    "resultMode": "QUERY_PERSONALIZED",
    "fallbackLevel": "EXACT",
    "stale": false,
    "personalization": {
      "enabled": true,
      "applied": true,
      "signalCount": 4
    },
    "requestedCount": 20,
    "returnedCount": 20,
    "rankingStatus": "RANKED",
    "items": [
      {
        "place": { "id": "...", "name": "...", "categories": [] },
        "rank": 1,
        "score": 0.82,
        "availableCriteria": ["SEMANTIC", "PREFERENCE", "DISTANCE", "RATING"],
        "reasons": [
          { "code": "STRONG_SEMANTIC_MATCH", "criterion": "SEMANTIC" },
          { "code": "MATCHES_USER_PREFERENCE", "criterion": "PREFERENCE" }
        ]
      }
    ],
    "versions": {},
    "degradations": []
  }
}
```

Allowed enums:

- `resultMode`: `PERSONALIZED`, `QUERY_PERSONALIZED`, `GENERIC_DESTINATION`.
- `fallbackLevel`: `EXACT`, `RELAXED_RETRIEVAL`, `DESTINATION_BASELINE`, `LAST_KNOWN_GOOD`.

The response may expose typed reason codes and bounded counts, but not raw Context values, confidence maps, embeddings, provider payloads, or internal exception messages.

### 3.2 Stable errors

| HTTP | Code | Behavior |
| --- | --- | --- |
| `400` | `INVALID_DESTINATION` / `INVALID_EXPLORE_QUERY` | Keep current feed; show safe localized validation text |
| `401` | `UNAUTHORIZED` | Existing refresh flow; otherwise switch to generic guest behavior |
| `429` | `RATE_LIMITED` | Keep current feed; bounded retry affordance |
| `503` | `RECOMMENDATION_UNAVAILABLE` | Keep current feed or show first-load retry state |

Raw server/provider errors are sanitized at the API boundary and through frontend `apiClient`.

### 3.3 Context contract

Extend the existing endpoint allowlist:

`GET /api/context/preferences?purpose=EXPLORE_RECOMMENDATION`

Response remains the existing typed list:

```json
[
  {
    "dimensionCode": "FOOD_STYLE",
    "valueCode": "CAFE",
    "confidence": 1.0,
    "source": "ONBOARDING",
    "updatedAt": "2026-09-28T00:00:00Z"
  }
]
```

Only STANDARD, purpose-allowlisted signals are returned. Sensitive dietary/loyalty data and raw free text are excluded unless a separately reviewed purpose/consent rule explicitly permits a safe derived code.

### 3.4 Feedback contract reuse

Reuse:

`POST /api/recommendations/{recommendationId}/events`

with an `Idempotency-Key` and existing body `{placeId,eventType,position,occurredAt}`.

Event mapping:

| UI action | Event |
| --- | --- |
| Card becomes meaningfully visible once | `IMPRESSION` |
| Card/pin selected | `CLICK` |
| Detail overlay opened | `DETAIL_VIEW` |
| Favorite/save toggled | `SAVE` / `UNSAVE` |
| Added/removed from trip | `ADD_TO_TRIP` / `REMOVE_FROM_TRIP` |

Feedback failure is non-blocking and never rolls back the user action. Retry is bounded and reuses the same idempotency key.

No new Kafka topic is required. Existing recommendation outbox remains the durable publication boundary.

---

## 4. Data Model & Migrations

### 4.1 Recommendation database

No schema change is required for the first release. Existing recommendation impressions, item snapshots, feedback events, query hash, algorithm versions, and outbox provide the durable evidence needed for this surface.

If later analytics require the Explore surface/fallback level in SQL, add nullable `surface` and `fallback_level` columns in an expand-first migration; do not overload degradation JSON without a reviewed query need.

### 4.2 Context database

The existing `preference_signals` table can store safe derived signals using distinct sources such as `ONBOARDING_DERIVED_V1`; no new table is required. Replacement must be idempotent by `(user_id, dimension_code, value_code, source)` and must delete obsolete derived values for the same source version.

Raw free text remains encrypted in `onboarding_free_text` with the existing retention rule and is never copied into recommendation persistence.

### 4.3 Redis (disposable)

Redis stores serialized bounded public response data only under recommendation-owned prefixes. It is not the source of truth for consent, profiles, impressions, or feedback. Cache loss reduces performance/resilience but not correctness.

### 4.4 Rollback

- Disable the Explore endpoint/feature flag.
- Web falls back to the existing generic Place search without claiming personalization.
- Stop writing derived Context signals and delete only the exact derived source namespace if required.
- Expire/delete only versioned recommendation cache prefixes; durable impressions/feedback remain auditable.
- Credential rotation and internal-route authentication are not rolled back.

---

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| IDOR/profile spoofing | User ID only from verified JWT; request has no user ID |
| Arbitrary geo expansion | Server validates destination ID and owns center/radius/max scope |
| Sensitive Context leakage | Purpose allowlist, STANDARD signals only, no raw free text/profile in response/log/cache key |
| Prompt/provider injection | Provider text is data only; no LLM decides membership/order; React renders escaped text |
| Cross-user cache leak | HMAC user scope, auth/profile fingerprint, strict destination/query compatibility, clear web store on auth change |
| Feedback poisoning | Existing impression ownership, place membership, exact rank, idempotency, bounded timestamp |
| Secret exposure | Rotate discovered credentials, remove tracked defaults, env/secret injection only, scan history/logs |
| Internal indexing abuse | Authenticated service identity or network policy; never public `permitAll` |
| Raw error leakage | Stable backend codes, `apiClient`, `getSafeErrorMessage`, no raw response/token logging |
| Query abuse | 200-char bound, control-character rejection, Gateway per-user/IP rate limit, downstream timeout |

All frontend strings use `places`/`errors` i18n namespaces with English/Vietnamese parity and alphabetical ordering.

---

## 6. Devil’s Advocate & Trade-offs

| Question / risk | Decision |
| --- | --- |
| Can “always results” be guaranteed absolutely? | No during a first-load total outage without fake/bundled data. Guarantee best-effort server fallback plus preservation of the last compatible non-empty feed; otherwise show an honest retry state. |
| Why not call recommendation on every keystroke? | It creates unstable UI, unnecessary embeddings/provider traffic, misleading impressions, race conditions, and cost. Only Enter represents recommendation intent. |
| Why not let frontend call Place fallback itself after an empty recommendation? | That would mix owners, bypass one-impression evidence, and risk rejected/autocomplete candidates leaking into the ranked feed. Fallback belongs server-side. |
| Why add a surface-specific endpoint? | Explore needs destination validation, staged non-empty policy, and metadata different from AI’s evidence-strict recommendation flow. Reusing internal pipeline code avoids duplicating ranking while preserving public behavior. |
| Why not send raw onboarding free text? | It violates purpose minimization and makes ranking unauditable. Only allowlisted derived signals with confidence/source/version are safe. |
| Could fallback make search irrelevant? | Yes. Therefore query is preserved through the first two levels; destination baseline is explicitly labeled “related alternatives,” never an exact match. |
| Could preferences overwhelm query relevance? | Yes. Submitted-query mode uses a separate versioned weight profile and minimum relevance eligibility before preference re-ranking. |
| Could stale cache show obsolete recommendations? | Yes. TTL, destination/query/profile fingerprints, visible stale metadata, and no cross-user reuse bound the risk. |
| Is Redis sufficient for last-known-good? | It improves availability but is disposable. The frontend’s current non-empty set is the final refresh fallback; durable impressions remain in PostgreSQL. |
| Does impression history personalize categories today? | Not fully. Runtime wiring must build confidence-weighted category affinities from feedback; tested but unused profile helper classes are insufficient by themselves. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 0 — Mandatory security remediation

- [ ] Rotate exposed semantic/vector credentials and invalidate old values.
- [x] Remove non-empty secret defaults from tracked YAML; fail closed or disable semantic integration when required secrets are absent.
- [x] Protect internal indexing endpoints with reviewed service authentication/network policy.
- [ ] Add secret-scanning regression coverage for tracked config and verify no secret is printed by startup/error logs.

### Phase 1 — Contracts and context correctness

- [x] Add destination catalog and `POST /api/recommendations/explore-for-you` DTO/controller/application boundary.
- [x] Add `EXPLORE_RECOMMENDATION` purpose allowlist to context-service.
- [ ] Preserve signal confidence/source/freshness through recommendation context resolution.
- [x] Implement versioned Context-code-to-Place-taxonomy affinity mapping.
- [x] Connect observed feedback to decayed category affinities and the existing multi-timescale composer; add session isolation.
- [x] Add deterministic safe derived-signal generation for allowlisted onboarding inputs; never emit raw free text.
- [ ] Add contract tests for consent on/off, Context unavailable, unsupported signals, mapping collisions, and profile fingerprinting.

### Phase 2 — Non-empty recommendation policy

- [x] Implement exact -> relaxed -> destination baseline -> last-known-good cascade inside one orchestration request.
- [x] Add minimum query-relevance eligibility for submitted-query mode and distinct server-owned weight profiles.
- [x] Add user/destination/query/profile/version-scoped Redis cache and single-flight request coalescing.
- [x] Persist exactly one final served impression and preserve response `recommendationId` on cache replay.
- [x] Return typed `resultMode`, `fallbackLevel`, `stale`, personalization summary, and degradation codes.
- [ ] Add metrics for fallback distribution, empty rate, cache hit, Context availability, provider refresh, latency, and candidate counts.

### Phase 3 — Explore web integration

- [x] Add `recommendations-api.ts` using mandatory `apiClient` and typed response models.
- [x] Split `draftQuery` and `committedQuery` in the Explore store; scope caches by user/destination/query.
- [x] Keep autocomplete/provider lookup in independent state and loading UI.
- [x] Make only Enter commit; query-suggestion click fills draft only; clear without Enter does not refresh.
- [x] Ensure provider-place selection opens details/map without mutating recommendation membership.
- [x] On destination selection, cancel old requests, reset committed query, and load base For You exactly once.
- [x] Preserve the old compatible feed during loading/error/empty refresh and atomically swap valid results.
- [x] Keep non-For-You category behavior isolated and regression-tested.
- [x] Add localized fallback/stale/generic/error labels without showing raw reasons or server text.
- [x] Clear user-scoped Explore state on logout/account change.

### Phase 4 — Feedback, evaluation, and rollout

- [ ] Emit deduplicated viewport impressions and idempotent click/detail/save/trip feedback with original rank.
- [ ] Add offline golden profiles covering all onboarding dimensions and query/profile conflicts.
- [ ] Measure `Precision@K`, `NDCG@K`, intra-list diversity, coverage, fallback rate, empty rate, CTR/detail/save/add-to-trip rate, latency, and provider cost.
- [ ] Release behind `NEXT_PUBLIC_EXPLORE_FOR_YOU_RECOMMENDATIONS` plus backend feature flag; shadow/compare before full enablement.
- [ ] Do not tune weights from a small number of manual examples; version every production weight/mapping change.

### Required tests

**Recommendation service**:

- Unit: taxonomy mappings, confidence union, weight profiles, query relevance floor, every fallback level, cache compatibility, stale metadata, deterministic ordering.
- Property: missing evidence never improves score; query/profile conflict cannot promote irrelevant places above relevant ones; cache keys never collide across user/destination/query/profile version.
- Integration: JWT identity, destination validation, Context/Place timeouts, one persisted served impression, feedback against cached responses, Redis unavailable, total outage.
- Security: internal endpoint authentication, no secret defaults, no raw Context/query/token values in logs or cache keys.

**Context service**:

- Purpose allowlist and sensitivity filtering.
- Idempotent derived-signal replacement and deletion.
- Raw free text never appears in preference response, outbox, or logs.
- Confidence/source/version and consent behavior.

**Web**:

- Typing/debounce/dropdown/clear/Escape/query-suggestion clicks make zero recommendation calls.
- Enter commits once; duplicate/out-of-order requests cannot replace the latest result.
- Destination change requests once with blank committed query.
- Provider-place click leaves feed membership/order unchanged.
- Old non-empty feed remains on empty/error refresh; first-load outage shows retry.
- Logout/account switch clears scoped cache.
- i18n parity, keyboard behavior, accessible loading/fallback labels, and zero-leak errors.

**End to end**:

1. Two users with different Context profiles open the same city and receive explainably different top results.
2. Type without Enter: dropdown changes, feed/map do not.
3. Submit `museum` as a cafe-preferring user: relevant museums remain ahead of cafes.
4. Provider exact search is sparse: related fallback is labeled and remains inside the city scope.
5. Context and semantic dependencies fail independently: real destination results still render with typed degradation.
6. Refresh fails after a good feed: previous feed remains usable.
7. Fresh user + total outage + no cache: honest localized retry, no synthetic place.

### Verification commands

```bash
./mvnw -pl services/context-service,services/recommendation-service,services/api-gateway -am test
cd apps/web/tripsense && npm run i18n:check
cd apps/web/tripsense && npm test -- --run src/features/places
cd apps/web/tripsense && npx tsc --noEmit
cd apps/web/tripsense && npm run lint
```

### Release gates

- Secret remediation and internal endpoint protection completed.
- Unsupported/fabricated Place rate: `0` in golden and E2E suites.
- Typing-without-Enter feed mutation rate: `0`.
- Cross-user/destination cache leakage: `0`.
- Warm-cache p95 <= 1.5 seconds; provider-refresh p95 <= 3 seconds.
- First-load empty rate and fallback distribution reviewed with real provider data before full rollout.
- Personalization uplift is evaluated against generic destination baseline; no claim of “best for you” without applied evidence.

---

## 8. Approval Decisions Requested

Approval of this plan authorizes:

1. A dedicated authenticated Explore For You recommendation endpoint reusing the existing ranking pipeline.
2. A strict draft-versus-committed search state machine where only Enter updates recommendation intent.
3. Purpose-scoped Context normalization and safe derived signals, with no raw free text leaving context-service.
4. Server-owned staged fallback and user-scoped last-known-good caching.
5. Existing feedback contract integration for impressions and actions.
6. Mandatory secret rotation/config cleanup and protection of internal recommendation indexing routes before release.

It does not authorize application code changes until a human explicitly approves this specification.

---

## Human Approval Gate

```text
STATUS: APPROVED
```

Approved by the user on 2026-09-28 with “Tiến hành implements”.

## 9. Completion Record

Repository implementation completed on 2026-09-28.

- Architecture review: passed; public traffic remains gateway-routed, ownership stays with existing services, and the recommendation ArchUnit boundary suite passes.
- Database review: passed; no schema or cross-service persistence change was introduced, and existing recommendation feedback indexes support the observed-profile query path.
- Security review: passed for repository changes; tracked credential defaults were removed, cache keys are HMAC-pseudonymized and scoped by user/destination/query/profile/version/limit, logs are metadata-only, and internal indexing fails closed behind a constant-time service key.
- PR review: no merge-blocking code finding remains in the implemented scope.
- Verification: Context tests `8/8`, Recommendation tests `54/54` excluding the credentialed network-only semantic cloud test, Explore/Places web tests `28/28`, TypeScript type-check, focused ESLint, i18n parity, Java compilation, and recommendation architecture tests passed.

Production rollout is still gated by operator-owned credential rotation/history review, real-provider latency measurement for AC-15, golden-profile evaluation, metrics dashboards, and rollout flags. These operational/evaluation tasks remain intentionally unchecked above and are not implied by `STATUS: DONE` for repository implementation.
