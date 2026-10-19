# Explore “For You” Personalized Recommendations — Specification & Implementation Plan

`STATUS: DONE`

### Provider persistence diagnostics follow-up — approved 2026-10-19

`STATUS: DONE` for this diagnostic increment only, explicitly approved before implementation. Human approval: “Tiến hành code để tôi trace xem thử”. Scope: instrument PlacePersistenceServiceImpl.upsertProviderPlace without changing its validation, sequential execution, provider-ID lookup, cross-provider unambiguous duplicate reuse, apply/save/mapping order, cooldown, exception fallback or canonical-ID behavior. No async/batch optimization, extra DB operation, API/schema/index/config change or provider policy change.

Add repeated fixed phases `place_upsert_total`, `place_upsert_provider_lookup`, `place_upsert_duplicate_lookup`, `place_upsert_duplicate_filter`, `place_upsert_new_entity`, `place_upsert_apply`, `place_upsert_save_new`, `place_upsert_save_existing`, `place_upsert_to_dto`. Outer total is inclusive and may report success when the existing implementation swallows a DB exception; inspect `place_upsert_result` (NEW_SAVED, EXISTING_SAVED, DUPLICATE_REUSED, FAILED_FALLBACK, COOLDOWN_BYPASS, INVALID_INPUT) and child error phases. NEW_SAVED/EXISTING_SAVED mean the respective repository.save path and DTO return completed, not a server command-level insert/update count or transaction durability guarantee. A mapping failure after save can produce FAILED_FALLBACK even though save already completed.

Metadata only: provider lookup hit boolean, duplicate check skipped boolean, same-name/qualifying-match counts, fixed result enum. Never emit place/provider IDs, names, address, coordinates, query, review contents, SQL/Mongo commands or exception messages. Replace the touched upsert catch log's raw message with exception type only. Existing analyzer already summarizes repeated phases and `place_` state occurrences; verify compatibility with a regression test, no new parser format.

Tests: new/provider-existing/duplicate-reuse/ambiguous duplicates/skipped duplicate prerequisites, lookup/save/mapping failure and cooldown fallback, invalid DTO, diagnostics disabled, log sanitization and returned data/query/save-order preservation. Verify focused Place tests and analyzer tests without live DB/provider writes. Architecture/database/security/PR review required. Rollback instrumentation only; do not modify stored data. Manual: restart only Place, monitor and submit a real new query in Da Nang; recommendation cache hits skip persistence so absence of spans on a hit is expected. Capture through Place completion even if Recommendation times out. Do not flush caches or delete data to force the branch. Shared timings include logging/driver/callback/network work; do not sum parents and children.

Verification: 50 focused Place Java tests passed on JDK21 (11 new persistence diagnostic cases plus canonicalization, details/search/ranking, provider-policy and servlet diagnostics regressions); 11 analyzer tests passed, including repeated lookup total/average/error counts, result-enum occurrence counts and request filtering. Scoped Spotless formatting/check and whitespace checks passed. No live provider, MongoDB or vector writes were performed. Runtime attribution still requires a restarted Place service and a search request that actually reaches provider persistence.

Architecture/database/security/PR review: no blocking findings in this increment. No service/data owner or DB-operation order/count changed; existing providers, canonical IDs, partial-write/cooldown fallback and exceptions are preserved. Save timings include repository callbacks, driver/network/server time, not server-only execution. Upsert failure warnings are now type-only. Fixed phase/result labels and numeric/boolean metadata avoid place/query/profile/address/token payloads. The analyzer requires no code changes because existing `place_` metadata handling already counts each observed result; use request filtering rather than treating all historical occurrences as the current batch.

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

## 10. Latency diagnostics increment — 2026-10-18

### Scope and approval

The user explicitly approved implementation with “Tôi không biết monitor như nào giờ bạn hãy tiến hành code sau đó để tôi test rồi monitỏ”. This increment implements the existing observability task for diagnosis before optimization. It retains current ranking, consent ownership, fallback policy, limits, downstream timeouts, persistence and cache behavior. No schema, event, authentication or authorization changes are required.

Gateway, Recommendation and Place emit bounded `explore_*` diagnostic events at INFO, scoped to `POST /api/recommendations/explore-for-you` and `POST /api/places/recommendations`. Gateway creates `X-Request-ID`, passes it downstream and returns it as a response header. Recommendation passes the ID to its internal HTTP dependencies; Place includes it in local phase logs. This is request correlation, not a full distributed tracing deployment. User/Context duration is measured from Recommendation's outbound call, including network, response parsing and downstream work; it does not split those services' internal queries.

Diagnostics are enabled by default. Set `EXPLORE_DIAGNOSTICS_ENABLED=false` in the deployment environment and recreate the three containers to disable new phase/request events. INFO logs add overhead and volume; collect a bounded investigation window, then disable if unnecessary. No Prometheus/Grafana infrastructure, public metric endpoint or extra port is introduced. Existing Micrometer registries receive `tripsense.explore.phase` (phase/outcome) and `tripsense.explore.request` (status); high-cardinality request IDs appear only in logs.

### Measured phases and interpretation

| Service | Phases / metadata |
| --- | --- |
| Gateway | Request total, response status, Reactor termination signal, request ID |
| Recommendation | `resolve_context`, `user_consent`, `observed_history`, `context_preferences`, `profile_fingerprint`, `lock_wait`, `cache_fresh_get`, `exact`, `relaxed`, `baseline`, `cache_lkg_get`, `impression_record`, `cache_put` |
| Ranking pipeline | `retrieval`, `source_place_retrieval`, optional `source_semantic`, `fusion`, `filter`, `enrichment`, `features`, `ranking`, `diversity` |
| Place | `redis_lookup`, `mongo_search` (includes mapping), `local_ranking`, `provider_search`, `provider_key_lookup`, `provider_http`, `provider_key_rotation`, `provider_persistence`, `merge_ranking`, `cache_put` |
| Metadata | Consent enabled, query present (boolean only), limit, cache hit/error, fallback, returned count, local/provider candidate count, provider attempt, served source |

Phase durations are **inclusive**. `exact` contains `retrieval`; `retrieval` contains the source HTTP call; that contains Place's phases. Never sum parent and child times. Repeated Place/fallback calls share the parent request ID; inspect each invocation separately. Metrics aggregate these invocations.

The old preparation log is renamed `recommendation_prepared`. Misleading `contextMs` and `persistenceMs` fields were removed; the old Micrometer latency description now correctly identifies preparation time. New `explore_request_completed service=recommendation-service` includes context, lock/cache, pipeline, persistence, mapping/serialization, and the servlet security chain. Gateway total additionally includes its routing/rate limiter/network/response handling. It excludes browser auth restoration, nginx and browser rendering. Gateway failures before the global filter runs have no diagnostic event. A reactive `onError`/`cancel` can precede final error-response status assignment, so status can be `unknown`. Requests killed with the process cannot emit completion. Backend work can continue after the browser or caller times out.

### How to test and monitor

#### Local with `scripts/start.sh`

The local start script configures Spring's `LOGGING_FILE_NAME` for Gateway, Recommendation and Place, retaining terminal output and additionally writing to `logs/api-gateway.log`, `logs/recommendation-service.log` and `logs/place-service.log` at the repository root. Files contain application logs and are gitignored; the analyzer outputs only bounded diagnostic events. Spring manages file rotation; the monitor reads current `.log` files only, so its summary covers retained current files rather than an explicit 15-minute window. Local timings and production timings should be measured separately.

If these services are already running, press Ctrl+C in their three Terminal tabs first. `start.sh` skips services with occupied ports and cannot retrofit logging or updated Java code into an existing process. Leave other services running and launch from the repo root:

```bash
bash scripts/start.sh
```

After the services are ready, start a live monitor in another terminal, then open For You:

```bash
bash scripts/monitor-explore.sh --follow
```

Stop the monitor with Ctrl+C; summarize current log files or filter by the response's `X-Request-ID`:

```bash
bash scripts/monitor-explore.sh
bash scripts/monitor-explore.sh --request-id REQUEST_ID_FROM_DEVTOOLS
```

The summary combines files grouped by service. A single-request view is grouped by service as well; do not infer cross-service chronological order from line position. If no diagnostic events appear, check that `EXPLORE_DIAGNOSTICS_ENABLED` is not disabled in `env/.env`, the browser actually issued the For You POST, and all three services were restarted. `--follow` shows only events appended after the monitor starts.

#### Server with Docker Compose

1. Build/publish and deploy the changed **api-gateway**, **recommendation-service** and **place-service** images through the existing CD workflow. A restart of old images is insufficient. The CD workflows also copy the analyzer to `/opt/tripsense/deploy/analyze-explore-latency.py`. Python 3 is needed only for the optional analyzer; raw log inspection works without it. No web build is required for this increment.
2. SSH into the server. The following commands match the default deploy script paths/project; adjust if `TRIPSENSE_DEPLOY_DIR` or `TRIPSENSE_COMPOSE_PROJECT` is customized:

   ```bash
   cd /opt/tripsense/deploy
   docker compose -p tripsense --env-file /opt/tripsense/.env logs --no-color --since 1m -f api-gateway recommendation-service place-service | grep --line-buffered 'explore_'
   ```

3. In the browser open DevTools → Network → Fetch/XHR, enable Preserve log, and open Explore with a signed-in test account. Select the `explore-for-you` POST and note its Duration/Waiting and response header `X-Request-ID`. Do not share Authorization headers, cookies, request payloads or an unredacted HAR. If accessing a separate API origin, the header is still visible in DevTools; reading it from JavaScript would additionally require a CORS exposed-header setting.
4. Test first entry/reload, another reload with the same account/destination/query, submit one query, and switch Café → For You. The last case may have **no POST** because frontend memory cache serves it; that is expected and should not be counted as a backend warm-cache measurement. Reload does not clear backend Redis/Mongo data, so “first entry” alone does not prove a cold backend. Use `cache_hit`, `served_from` and `provider_called` to classify; do not flush production caches.
5. After reproducing, get a summary (Ctrl+C stops a live stream; this command is a finite snapshot):

   ```bash
   docker compose -p tripsense --env-file /opt/tripsense/.env logs --no-color --since 15m api-gateway recommendation-service place-service | python3 analyze-explore-latency.py
   ```

   For one slow request, replace the placeholder with the `X-Request-ID` from DevTools:

   ```bash
   docker compose -p tripsense --env-file /opt/tripsense/.env logs --no-color --since 15m api-gateway recommendation-service place-service | python3 analyze-explore-latency.py --request-id REQUEST_ID_FROM_DEVTOOLS
   ```

   Without Python, use `grep -F 'requestId=REQUEST_ID_FROM_DEVTOOLS'` instead of the analyzer. Compose multiplexes logs from different containers; line order across services is not guaranteed. Match service/request ID, phases and timestamps.
6. Also watch resource contention during reproduction in another terminal:

   ```bash
   docker stats --no-stream
   ```

7. Share the analyzer table and diagnostic events for a slow request, plus Network duration and container CPU/memory. Collect approximately 20–30 requests for initial diagnosis and more before treating p95 as a stable production SLO.

Example diagnostic line (illustrative only, not a measured production result):

```text
explore_phase service=recommendation-service requestId=... phase=user_consent durationMs=3100 outcome=error
```

| Observation | What to inspect next |
| --- | --- |
| `user_consent` dominates | User API, PostgreSQL pool/connect/query, network |
| `context_preferences` dominates | Context API/database/network |
| `observed_history` or `impression_record` dominates | Recommendation PostgreSQL/pool/query/transaction |
| `lock_wait` dominates | Concurrent requests/coalescing contention |
| `redis_lookup`, `cache_fresh_get` or `cache_put` dominates | Redis connectivity/serialization; check cache error metadata |
| `mongo_search` dominates | Place query/index/network |
| `provider_http` dominates | External provider; inspect attempts and key rotation |
| `provider_persistence` dominates | Upserts/database and indexing work initiated by persistence |
| Gateway much slower than Recommendation | Gateway rate limiter/discovery/network/queue; compare matching request IDs |
| Browser much slower than Gateway | Auth restoration, nginx/network, response download/rendering outside server timers |

### Verification and review

Required checks: JDK 21 compile; request-ID propagation/validation and cleanup tests; success/error/disabled-filter timing tests; existing Explore cache/fallback, candidate pipeline, Place retrieval and ZioMap regressions; architecture boundaries; analyzer sample/error input checks; YAML parse and whitespace check. No production latency is claimed until the operator runs the above test.

Verification on 2026-10-18: **49 Java tests passed** (Gateway 3, Place 24, Recommendation 22, including ArchUnit) and **4 analyzer tests passed**. The six edited YAML files parsed successfully. Java verification used JDK 21 and a preloaded Mockito agent because the local sandbox disallows Mockito's dynamic self-attachment. No live external provider/database or deployed production environment was contacted by these tests.

Review scope: existing services only; no cross-service persistence or migrations; authentication and response bodies retained; request IDs are bounded/generated and are not authorization credentials; logs contain phase names, durations, outcomes and counts, never user IDs, query text, profiles, raw errors, tokens or provider URLs/keys. Full tracing, Prometheus exporter, dashboards, profile projections, timeout changes and ranking optimization remain separate work.

### Semantic timing detail — follow-up approved 2026-10-18

After the first local measurement showed `source_semantic=23245ms`, the user approved detailed instrumentation with “Tiến hành”. Additional phases are `embedding_cache_get`, `embedding_api` (only on miss), `embedding_cache_put`, `qdrant_search`, `snapshot_batch` (whole resolution including fallback), `snapshot_batch_http` (the batch HTTP call), `snapshot_batch_fallback` (individual resolution inside a failed batch), and `snapshot_individual` (each actual individual HTTP request, including failures before they are converted to empty optionals).

Metadata records `embedding_cache_hit`, `semantic_vector_candidates`, `snapshot_batch_requested`, `snapshot_batch_resolved`, `snapshot_missing_after_batch`, `snapshot_batch_fallback_calls`, `snapshot_generator_fallback_calls`, `snapshot_individual_found` and `semantic_candidates_returned`. Batch-resolved count counts requested candidates, not alias keys in the result map. Cache errors and batch HTTP errors emit booleans without sensitive payloads. Both the batch client's internal fallback and generator's missing-result fallback retain their existing behavior; every actual individual HTTP request contributes one sample to the same phase timer. A zero generator-fallback count does not rule out calls inside batch fallback: check `snapshot_batch_fallback_calls` and the `snapshot_individual` phase count.

The analyzer now displays `Count`, `Total`, `Avg`, `p95`, `Errors` per phase and a semantic state-value table. `Total` sums repeated samples **for that same phase**; parent/child totals still overlap. State values are grouped by observed value and occurrence count, not summed across requests. Filter by the new request ID to isolate a fresh measurement from old log entries.

For local testing, restart only the **recommendation-service** Terminal (Ctrl+C, then `bash scripts/start.sh` from the repository root), retaining the existing Gateway/Place processes. Reload For You or submit a new query while running `bash scripts/monitor-explore.sh --follow`, then run `bash scripts/monitor-explore.sh --request-id NEW_REQUEST_ID`. A recommendation-cache hit skips semantic entirely; use its `cache_hit` metadata to distinguish this from a missing timer. Do not clear shared caches merely to force an embedding-cache miss. New queries can cause real provider traffic. Timing-only instrumentation does not change semantic enablement, ranking, retry, deadline or snapshot fallback logic.

Verification: 30 focused Recommendation Java tests passed, including cached/miss embedding paths, Qdrant failure, alias-aware batch success, failed batch with individual fallback, individual HTTP failure, existing Explore/cache regressions and ArchUnit; 5 analyzer tests passed. Java formatting and whitespace checks passed. Review confirmed bounded phase tags/counts, no payload/token/query logging in new diagnostics, and unchanged API/data ownership and fallback semantics. Actual semantic timings still require a fresh local request after restart.

### Read-only Qdrant/Place consistency audit

For the user's reported historical test vectors referencing nonexistent places, `scripts/audit-qdrant-places.py` compares every point's `payload.placeId` against the existing Place Service batch snapshot API. No direct cross-service database access is introduced. The tool has no delete/update operation; its output is a review inventory, not deletion authorization.

Run locally with Place Service running:

```bash
python3 scripts/audit-qdrant-places.py --place-url http://localhost:8083
```

The default config file is `env/.env`; process environment takes precedence. Only `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_PLACE_COLLECTION` and `PLACE_SERVICE_URL` are read, without executing shell expressions. Options `--env-file`, `--collection`, `--qdrant-url`, `--place-url` support explicit environment selection; API keys belong in the env file/environment, never command arguments. Remote Qdrant API-key traffic requires HTTPS; redirects are disabled to avoid forwarding credentials to another host.

Qdrant scroll reads pages of 100 and selects only `placeId` payload, with vectors excluded. Place lookups use groups of at most 100 IDs and recognize both canonical `id` and `providerPlaceId` aliases. IDs absent from the first pass are checked again. Missing payloads are a separate manual-review group. HTTP errors, malformed envelopes, invalid snapshots, duplicate points or repeated pagination offsets abort the audit rather than treating an unavailable service as evidence of absence.

A new timestamped JSON report is generated under gitignored `logs/`, with configured source URLs (without credentials), collection, counts and exact `pointId`/`placeId` pairs. Existing report files are never overwritten. The report distinguishes `qdrantPoints`, `uniqueReferencedPlaceIds`, `validPoints`, `orphanedPoints` and `invalidPayloadPoints`. The Place database may contain more places than the vector collection because not every place is necessarily indexed; raw total-count differences do not establish orphaned vectors.

Before any future deletion, verify the source environments, review the explicit point list, recheck absence against live Place data and export the selected points' vectors/payloads for recovery. The read-only report does not contain vectors and is not a restorable backup. Avoid clearing the whole collection. Concurrent indexing/deletion can change the result after the audit timestamp.

Verification: 10 offline audit tests passed, covering alias matching, pagination, 1,400 IDs batched within API limits, rechecking concurrent additions, invalid payloads/envelopes, fail-closed HTTP errors and credential-safe transport behavior.

### Authorized cleanup of reviewed orphan points

The user explicitly authorized backup, revalidation and deletion of the 139 points in `logs/qdrant-place-audit-20261018T145807782466Z.json` with “Tiến hành giúp tôi”. `scripts/cleanup-qdrant-places.py` requires the exact report, expected count and collection confirmation; default mode backs up only. Execution requires `--execute`. It verifies that active Qdrant and Place source URLs match the report, checks current point/place bindings, rechecks Place existence, and preserves points that have reappeared or changed.

Before any deletion it exports full vectors/payloads to a new owner-readable JSON file, flushes/syncs it, verifies the saved contents and records SHA256. Each delete batch revalidates both live Place existence and unchanged point contents. Its conditional Qdrant selector pairs each explicit point ID with the reviewed `payload.placeId`, and an exact count query checks the selector before mutation. Deletes use `wait=true`; subsequent point retrieval verifies absence. Per-batch receipts support investigation if a later operation fails. There are no blanket deletes, collection drops or automatic retries of uncertain mutations.

Cleanup completed on 2026-10-18: **139 selected points deleted and individually verified absent**, with zero changed/reappeared points skipped. Recovery backup: `logs/qdrant-orphan-backup-20261018T150322832468Z.json` (4.5 MB), SHA256 `57ac73ecf4b2149dd3a8c2544c3bdf1c2ec631b3f8567f4b7662b409154411bb`. Receipt: `logs/qdrant-cleanup-receipt-20261018T150322832468Z.json`. These artifacts are local, gitignored and not an off-machine backup. Recovery can upsert the saved `id`, `payload`, `vector` fields into the same collection after checking for conflicting replacements; restoring stale points would also restore the original inconsistency.

Eight offline cleanup tests passed, covering exact-target preservation, backup-before-delete, two batches of 139 points, file permissions, dry run, failed backup, changed/rebound points, source/count mismatch and places reappearing before mutation. All 23 operational Python tests passed together. Cleanup only removes inconsistent data; the sequential fallback code and other measured latency remain separate optimization work. A fresh request is needed to measure its effect; cached recommendations may skip semantic retrieval.

Post-cleanup full audit: `logs/qdrant-place-audit-20261018T150519562342Z.json` confirms **879 Qdrant points, 879 valid Place references, 0 orphaned points, 0 invalid payloads**. No Redis entries or Place documents were deleted.

### Place retrieval decision and MongoDB timing — approved follow-up

The user approved tracing the next bottleneck with “Oke tiến hahf rồi hướng dẫn tôi chạy test”. This increment adds diagnostics only, preserving candidate sufficiency rules, provider refresh policy, query ordering, cooldown and timeouts.

`mongo_search` retains its inclusive meaning (local retrieval plus mapping). Its children are `mongo_fetch` and `mongo_dto_mapping`; `mongo_fetch` contains `mongo_text_query`, and when text search fails, `mongo_regex_query`. During the existing 30-second failure cooldown, the regex query is used directly. These timers include driver/network/materialization work as seen by the service; they are not MongoDB server execution-time measurements.

Place metadata now includes:

| Field | Meaning |
| --- | --- |
| `place_target_count`, `place_retrieval_window`, `place_mongo_query_limit` | Requested candidate target, bounded retrieval window and actual query page limit |
| `place_mongo_candidates` | Entities returned before DTO mapping, ranking and geographic filtering |
| `place_local_removed_after_ranking_geo` | Count removed by the combined ranking/geographic step |
| `place_search_method` | `TEXT`, `REGEX_AFTER_TEXT_FAILURE` or `REGEX_COOLDOWN` |
| `place_{stage}_candidate_count`, `place_{stage}_eligible_count` | Candidate count and count meeting all required fields, for `cache`, `local`, `provider`, `provider_failure` stages |
| `place_{stage}_status`, `place_{stage}_freshness`, `place_{stage}_geographic_coverage` | Existing evidence assessment values |
| `place_{stage}_reason_codes` | Existing rejection/refresh reason codes, comma-separated; `NONE` when no reason exists |
| `place_{stage}_coverage_{field}` | Required-field coverage for known allowlisted field names only |
| `place_refresh_decision` | `USE_CACHE`, `USE_LOCAL`, `REFRESH_PROVIDER`, `REFRESH_DISABLED` or `NO_ANCHOR` |

Reasons include `TOO_FEW_CANDIDATES`, `MANDATORY_FIELD_MISSING:<known-field>`, `STALE_REQUIRED_EVIDENCE`, `WEAK_GEOGRAPHIC_COVERAGE`, `LOCATION_ANCHOR_UNRESOLVED` and `PROVIDER_UNAVAILABLE`. Arbitrary client-provided required-field names are replaced with `UNSUPPORTED_FIELD` in diagnostic reason codes and omitted from coverage log keys. Raw query/field values and database exception messages are not logged by these diagnostics. The analyzer displays both semantic and Place state under `DIAGNOSTIC STATE VALUES` and supports older log lines.

Local test instructions:

1. Press Ctrl+C only in the **place-service** Terminal. Run `bash scripts/start.sh` from the repository root; wait until Place Service starts on port 8083.
2. In a separate terminal run `bash scripts/monitor-explore.sh --follow` before issuing the request.
3. In Explore → For You submit a previously unused query with **Enter**. Typing alone only drives autocomplete. A hard reload clears frontend memory state but does not invalidate recommendation/Place Redis caches. Do not flush shared caches. A recommendation cache hit skips Place entirely; a sufficient Place cache hit skips MongoDB. Both are expected, not missing instrumentation.
4. Wait for Place's `explore_request_completed` as well as Recommendation/Gateway completion: Place can continue processing after its caller times out.
5. Stop only the live monitor with Ctrl+C and run `bash scripts/monitor-explore.sh --request-id NEW_REQUEST_ID`. Share that request's phases and state values. The unfiltered summary mixes historical logs and is unsuitable for comparing one reproduction.

The key comparison is `place_target_count` versus `place_local_candidate_count`/`place_local_eligible_count`, alongside **all** `place_local_reason_codes`. For example, candidate count 49 and target 50 can coexist with stale/missing-field reasons; do not change the threshold based on count alone. Use `mongo_text_query` versus `mongo_dto_mapping` to determine whether the local lookup cost comes from querying or mapping.

Verification: 23 focused Place Java tests passed on JDK 21, including six new diagnostic tests for 49/50 candidates, sufficient local evidence, missing required fields, stale evidence, text-search failure/regex cooldown and arbitrary-field redaction. Six analyzer tests passed. Review confirmed unchanged retrieval/provider decisions and no new API contracts, persistence access or raw query logging. Live latency must still be measured after restarting Place Service; offline tests do not establish runtime performance.

### Impression persistence timing — approved follow-up

The user approved this diagnostic increment with “Oke tiến hành” after reviewing the repeated 2.3-second `impression_record` bottleneck. Preserve the existing local `@Transactional` boundary, SQL, sequential insert order, feedback validation, response and cache behavior. No schema, batch/async write, extra query or database-owner change is authorized here.

Add `impression_transaction_begin`, `impression_header_prepare`, `impression_header_insert`, `impression_items_write`, repeated `impression_item_prepare`/`impression_item_insert`, and transaction commit/rollback phases. Spring Boot registers a transaction execution observer restricted to `JdbcRecommendationStore.record` during monitored requests. The begin phase includes connection acquisition AND transaction setup; it does not isolate pure pool wait, connection establishment or individual driver operations. Commit/rollback phases measure the corresponding transaction-manager operation; connection cleanup after completion remains in the inclusive outer `impression_record` timing.

Log `impression_items_expected` and `impression_item_inserts_completed`. The latter counts successful item statements, not committed rows: a later failure rolls back the transaction. The analyzer reports repeated insert count/total/average/p95/errors and these count fields. Parent/child timings overlap; never add `impression_items_write` to its item prepare/insert children. No SQL, parameters, query text, user/place IDs, feature JSON or exception messages are added to diagnostic logs. Cached Explore responses skip the write path by existing design.

Local verification: restart only Recommendation Service with Ctrl+C in its terminal, then run `bash scripts/start.sh` from the repository root. Start `bash scripts/monitor-explore.sh --follow` in another terminal, issue a For You request and share the new log through Gateway completion. A cache hit intentionally has no impression-write phases; use another query submitted with Enter or allow the result cache to expire, without flushing shared caches. No Place/Gateway restart is needed for this increment.

Verification completed: 29 focused Java tests passed on JDK 21, including real Spring Boot transaction-manager/transactional-proxy wiring against mocked JDBC, 48 sequential item inserts, acquisition failure, item failure with rollback, commit failure, disabled diagnostics, unrelated transaction exclusion, callback idempotency, Explore/cache/semantic regressions and ArchUnit. Seven analyzer tests passed. Formatting and whitespace checks passed. Architecture/database/security/PR review found no blocking issue in this increment: SQL and transaction ownership are unchanged, the observer does not replace the transaction manager, and only fixed phase names/outcomes/counts enter new logs. No live database/provider was contacted. Repeated per-item diagnostics add logging overhead within the existing diagnostics switch; runtime results must not be presented as instrumentation-free timings.

### Impression batch persistence optimization — 2026-10-19

`STATUS: DONE` — implementation explicitly approved by the user below.

The user explicitly approved replacing sequential item writes and optimizing impression persistence: “Tiến hành đổi sang batch insert cũng như tối ưu giúp tôi phần impression này”. This supersedes the preceding diagnostic-only restriction on batching, but does not authorize async persistence, dropping feature snapshots, table/schema changes, provider policy changes or feedback-contract changes.

Implementation scope: retain the existing header insert and one synchronous service-owned `@Transactional` transaction. Write items with parameterized JDBC batches of at most 100, retaining all fields, 1-based positions and existing IDs. Enable the PostgreSQL driver's `reWriteBatchedInserts` on Recommendation's Hikari datasource by default, with a Recommendation-scoped environment override. Do not change another service's datasource or append flags to secret-bearing URLs. Validate batch result cardinality and counts, accepting JDBC `SUCCESS_NO_INFO`, and roll back on errors/unexpected counts; no automatic retry after uncertain writes.

Replace two per-item diagnostic events with chunk-level `impression_items_prepare` and `impression_items_batch_insert` phases, retaining `impression_items_write`, transaction phases and outer `impression_record`. Add bounded mode/batch-attempt counters. Completed-item metadata counts only fully verified successful chunks, is conservative on partial batch failure, and never claims durability before commit. Existing log analysis remains backward compatible. No raw SQL, parameters, IDs, exception messages or feature JSON enter new logs.

Acceptance tests: 48 items use one executeBatch rather than 48 executeUpdate calls; chunk boundary over 100 and empty/single-item input; exact parameter/position/JSON preservation; batch/partial/invalid-result failures and commit failure roll back or propagate without a success response; JDBC `SUCCESS_NO_INFO`; disabled diagnostics still persist; driver batch-unsupported fallback; existing feedback ownership/rank validation, Explore/cache regressions and architecture boundaries. Mocked JDBC verifies wiring/transaction calls, not actual PostgreSQL durability or production latency. Reproduce with the existing local monitor after restarting only Recommendation Service; compare batch phases and outer impression timing on fresh requests, not cache hits.

Verification on 2026-10-19: all 92 Recommendation offline Java tests passed on JDK 21 (cloud integration test explicitly excluded), including 15 transaction/batch diagnostic cases, parameter preservation across 100/101 boundaries, feedback owner/rank rejection, YAML-to-Hikari default/override binding and ArchUnit. Eight analyzer tests passed, including old sequential-log compatibility and request-filtered batch logs. Formatting, whitespace and production Compose YAML parsing passed. No live database/provider/cloud data was contacted or mutated during verification.

Architecture/database/security/PR review: no blocking finding in the increment. Service/table ownership, foreign-key order, full item snapshots, feedback contracts and synchronous transaction semantics are retained; batch failures propagate without retry and request success still waits for commit. Parameterized SQL remains unchanged. Diagnostic cardinality is bounded by chunk count rather than item count and carries only phase names, durations, outcomes and counts. Datasource rewrite configuration is isolated to Recommendation and passed through production Compose as `RECOMMENDATION_REWRITE_BATCHED_INSERTS` (default true; false disables rewriting without disabling JDBC batching). No migration or cache flush is needed. This is not a claim that the 1.47-second unexplained gap in the earlier trace was entirely caused by logging, nor a measured runtime speedup.

Manual acceptance: Ctrl+C only Recommendation's Terminal, run `bash scripts/start.sh`, wait for port 8088 startup, then run `bash scripts/monitor-explore.sh --follow` in a separate terminal. Submit a fresh For You query with Enter and collect through Gateway completion. For 48 returned items expect `impression_write_mode=JDBC_BATCH`, `impression_batch_calls=1`, `impression_item_inserts_completed=48`, one `impression_items_prepare` and one `impression_items_batch_insert`; there should no longer be 48 per-item prepare/insert phases. Compare `impression_record` against the previous 4290ms and batch insert against the previous 2586ms summed individual insert time. Measure several fresh requests; recommendation cache hits skip persistence and are not comparable. No Gateway/Place restart, schema migration or manual DB edit is required locally. For rollback, revert this optimization and rebuild/restart Recommendation; do not remove impression data.

### Cache write phase diagnostics — approved 2026-10-19

`STATUS: DONE` — implementation explicitly approved by the user below.

The user approved detailed cache-write tracing with “Tiến hành” after a measured 460ms outer `cache_put` and read-only remote Redis PING checks. Add fixed `cache_fresh_key`, `cache_fresh_serialize`, `cache_fresh_redis_set`, `cache_lkg_key`, `cache_lkg_serialize`, `cache_lkg_redis_set` phases. Key timers measure HMAC/key preparation; serialization timers measure Jackson encoding, including checked failures; Redis SET timers include client encoding, scheduling, network/TLS, payload transfer and response waiting, not server-only execution time. The outer `cache_put` remains inclusive; logging/metrics overhead can appear between child phases.

Preserve exactly two serializations and two sequential SETs with existing keys and TTLs. No pipelining, async write, payload slimming, size/key-count report, TTL change, cache flush or additional Redis command is authorized by this increment. Retain fail-open behavior: serialization/SET failure on fresh still allows the LKG attempt; errors remain bounded type-only logs and no exception payload, query, key, ID, profile, JSON or credentials are emitted. Empty results and disabled cache still perform no writes. Diagnostics-disabled requests must have the same cache behavior without diagnostic events.

Tests cover ordered operations, independent success/error timings, fresh serialization/SET failure followed by LKG success, LKG failures, unchanged key/TTL compatibility, empty/disabled cache and diagnostics off; the analyzer must show the new phases with correct request filtering. Run offline Recommendation regression/architecture tests and analyzer tests. Actual attribution of the 460ms requires restarting only Recommendation Service and reproducing with `cache_hit=false`; share log through Gateway completion, without changing Redis or restarting Place/Gateway.

Verification: all 99 Recommendation offline Java tests passed on JDK 21 (cloud integration excluded), including seven new cache diagnostic cases and ArchUnit. Nine analyzer tests passed; formatting and whitespace checks passed. The unit tests preserve the sequence serialize-fresh/SET-fresh/serialize-LKG/SET-LKG, custom TTLs and matching read/write keys, validate checked serialization and Redis failure attribution, and verify no new diagnostic events outside monitored requests. No live Redis/database/provider was contacted in this implementation verification.

Architecture/database/security/PR review found no blocking issue: existing owners, cache keys, payload, TTL, synchronous write order and independent fail-open behavior are retained. Fixed phase names do not incorporate user input, and tests check diagnostic logs do not contain payloads, query/profile/secret, key or user ID. Checked Jackson exceptions are timed with start/finish rather than converted to different exceptions. The new Redis SET measurements cannot distinguish server CPU from client/network work; use them to narrow the bottleneck, not to claim Redis server execution takes 0.5 seconds. No API/schema/config/migration or deployment-script change was necessary.

### Single serialization and pipelined cache writes — 2026-10-19

`STATUS: DONE` — implementation explicitly approved by the user below.

The user explicitly approved “serializee một lần + pipeline” and deferred provider-count policy to a later discussion. Replace duplicate encoding/sequential response waits with one JSON serialization, one payload UTF-8 encoding and a synchronous Spring Data Redis `executePipelined` callback issuing two independent SET-with-expiration commands. Keep existing HMAC keys, full response JSON, original recommendation ID, per-key configured TTLs, reads, privacy guards and empty/disabled-cache behavior. No provider, retrieval, ranking, impression, schema, API, async task, transaction or cache-flush change is in scope.

Pipelining is not atomic and does not guarantee exactly one network packet or halve latency. The request still waits for pipeline completion. A shared serialization failure now skips both cache writes (one attempt only). A synchronous enqueue failure should best-effort attempt the other command; connection acquisition, deferred command or pipeline-close failures are swallowed as cache-only failures without retry because write outcomes may be uncertain. Do not delete/invalidate an already-written key or change TTLs to compensate. Spring must always close/release the pipeline connection; do not issue manual MULTI/EXEC or replace connection/flush configuration globally.

Implementation review identified that the installed Lettuce connection opens a dedicated native connection for pipelines, which the non-pooling provider releases/closes after each use. Repeated remote TLS setup would undermine this optimization. Add Boot-managed `commons-pool2` and bounded Lettuce pooling only in Recommendation's application config (8 active, 4 idle, 0 minimum idle, 100ms maximum borrow wait); retain Boot's connection factory, authentication/TLS, timeout and flush defaults. No Redis server or other service configuration is changed. Initial connections remain cold; warm pipeline connections can be reused. Standard Spring property overrides remain available for operators. Pool exhaustion remains a fail-open cache failure and is not retried.

Use fixed phases `cache_serialize`, `cache_payload_encode`, `cache_pipeline_execute`, retaining key and outer put phases. Do not present command enqueue time as Redis round-trip time; separate per-key SET/serialize timers are historical once writes are pipelined. Tests must cover single encoding, both SETs queued before close, separate TTLs/read-key compatibility, payload identity/UTF-8, serialization and immediate/deferred/connection/close failures, cleanup/no retries, empty/disabled/diagnostics-off paths and old/new analyzer compatibility. Verify with real RedisTemplate pipeline wiring and mocked Redis connections, not live writes. Measure actual improvement only after a local restart and fresh request.

Verification: all 106 offline Recommendation Java tests passed on JDK 21 (cloud integration excluded), including 12 pipeline/codec/error cases and two Boot-to-Lettuce pool/TLS binding cases, plus existing Explore, cache, impression, feedback and architecture regressions. Ten analyzer tests passed with old sequential and new pipeline phase compatibility. Java formatting and whitespace checks passed. Boot-managed Commons Pool 2 was downloaded into Maven's dependency cache; subsequent verification ran offline. No live Redis/database/provider write or cache flush occurred.

Review (architecture/database/security/PR): no blocking finding. No new service boundary or API/schema change; original HMAC key material, full response content, read path, IDs and expiration values are retained. UTF-8 payload bytes are computed once and reused, including non-ASCII content; real Jackson round-trip checks preserve the response and recommendation ID. Spring's real pipeline lifecycle is exercised against mocks; callback returns null, both commands are issued before closing, connections are released, and uncertain writes are never retried. Checked and runtime serialization errors skip the pipeline and remain cache-only failures. Enqueue errors remain visible as `cache_write_error` and per-kind enqueue-error metadata even if the remaining command/pipeline completes successfully. Logging contains no keys, JSON, query/profile, tokens or error messages. Pooling is bounded and isolated to Recommendation; the initial dedicated connection can still incur cold TLS setup. Runtime speedup and behavior under actual Redis load are not claimed by offline tests.

Manual acceptance: restart only Recommendation Service (Ctrl+C, then `bash scripts/start.sh`, wait for 8088); start `bash scripts/monitor-explore.sh --follow` in another terminal. Issue 2–3 nonempty-result For You requests using different submitted queries with Enter, without restarting between them, to observe initial and reused pipeline connections. Check `cache_hit=false`, one `cache_serialize`, one `cache_payload_encode` and one `cache_pipeline_execute` per cache write. Compare inclusive `cache_put` against the previous 368ms; compare shared pipeline time against the previous 191ms + 135ms sequential SET timings. These are not guaranteed savings because both payload copies still travel and conditions vary. Cache hits skip writes. No Place/Gateway restart, Redis/server configuration, migration or manual data cleanup is needed. Provider count/refresh policy remains a separate discussion. Rollback requires reverting this cache optimization and its pool/dependency additions, rebuilding/restarting Recommendation; existing cache entries remain compatible.
