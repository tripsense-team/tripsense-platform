# Explore Category Discovery & Pagination — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Services**: `services/place-service` (category retrieval), `services/recommendation-service` (For You ranking/fallback), `apps/web/tripsense` (interaction and pagination)
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`, `services/recommendation-service`
- **Created Date**: 2026-09-28
- **Related Plans**: [Mindtrip Explore Experience Redesign](./mindtrip-explore-experience-redesign.md), [Explore For You Personalized Recommendations](./explore-for-you-personalized-recommendations.md)
- **Target PR Boundaries**: Phase 1 category contract/ranking; Phase 2 For You resilience/latency; Phase 3 web tabs/pagination; Phase 4 verification/review

---

## 1. Goal & Requirements

### 1.1 Problem statement

Explore category tabs currently concatenate broad Vietnamese phrases and send them to the free-text Place search endpoint. The deterministic text ranker then treats those phrases as exact intent and removes valid results. For example, `khách sạn homestay resort ở Đà Nẵng` can require one Place to match both `homestay` and `resort`; `nhà hàng quán ăn ngon` can require the word `ngon`. This produces sparse or empty tabs, especially Stays.

The initial For You request can also render an empty list because the server's destination-baseline fallback is skipped when the committed query is blank, while the web clears the feed on a successful empty response. Category search then accidentally warms Place storage, explaining why For You works after visiting another tab.

Cold requests may approach ten seconds because Place provider timeout is eight seconds, recommendation downstream timeout is twelve seconds, and sparse results may trigger a second wider retrieval.

### 1.2 User journey

1. The user opens Explore and sees `For You`, `Food`, `Cafés`, `Stays`, and `Attractions`.
2. The first For You load requests a stable destination-scoped recommendation snapshot without requiring another tab to warm Place data.
3. Selecting a category sends a category code plus selected destination/viewport, not an artificial multi-keyword exact query.
4. The server applies OR semantics within the category taxonomy and ranks by category relevance, destination/viewport distance, rating, review confidence, freshness, and local evidence.
5. The web receives one bounded snapshot, shows at most 16 cards, and synchronizes map pins with the current page.
6. Previous/next controls change page locally without a network request. A category, destination, or committed-search change resets to page 1.

### 1.3 Tabs and category taxonomy

| Tab | Category code | Provider query seed | Accepted canonical categories (OR) |
| --- | --- | --- | --- |
| For You | none | recommendation-owned | personalized diversified result |
| Food | `FOOD` | `nhà hàng địa phương` | `restaurant`, `food`, `local_food`, `street_food`, cuisine-specific restaurants |
| Cafés | `CAFE` | `quán cà phê` | `cafe`, `coffee_shop`, `tea_house`, `bakery_cafe` |
| Stays | `STAY` | `khách sạn lưu trú` | `hotel`, `lodging`, `hostel`, `homestay`, `resort`, `guest_house`, `motel` |
| Attractions | `ATTRACTION` | `điểm tham quan` | `tourist_attraction`, `landmark`, `museum`, `temple`, `pagoda`, `beach`, `park`, `heritage` |

`Experiences`, `Locations`, and `Guides` are removed. Guides are content, not Places; experience inventory requires a separately owned product/activity contract and must not be faked through Place search.

### 1.4 Pagination rules

- `PAGE_SIZE = 16` is fixed for this surface.
- The initial bounded snapshot target is `48` items where evidence/providers can supply them; fewer real results are valid.
- Page count is `ceil(snapshot.length / 16)` and never claims provider inventory beyond the loaded stable snapshot.
- Controls render only when `pageCount > 1`.
- Previous is disabled on page 1; next is disabled on the last page.
- Page change does not call the server and scrolls the feed heading into view without moving the map viewport.
- Cards and map pins use only the current page slice. Recommendation ranks and feedback positions retain their original snapshot rank.
- New destination, category, submitted query, or accepted refresh resets page to 1 atomically.
- Photo carousel pagination remains independent from feed pagination.

### 1.5 Local relevance

For this phase, “local” means inside the selected destination and current map viewport/radius. The server must reject outside-radius candidates where coordinates exist and boost shorter distances, rating confidence, and destination/category evidence. Browser GPS/geolocation is out of scope because it requires a separate permission and privacy UX; no location permission is requested implicitly.

### 1.6 In scope

- Replace six keyword tabs with five taxonomy-backed tabs.
- Add optional structured category to Place search while keeping free-text search backward compatible.
- Separate category browse matching from specific free-text matching.
- Fix Stays and other category OR semantics.
- Do not cache empty category responses as reusable successful results.
- Fix initial blank-query For You destination fallback and prevent successful empty refresh from erasing a compatible non-empty feed.
- Add bounded 16-card client pagination for For You and category snapshots.
- Reduce redundant cold retrieval and expose enough timing metadata/log metrics to identify provider versus ranking latency without leaking queries or credentials.
- English/Vietnamese i18n, keyboard navigation, disabled states, accessible labels, and regression tests.

### 1.7 Out of scope

- Infinite scroll.
- A new microservice or cross-service database access.
- Fabricated/bundled Places used to fill pages.
- Claiming a total count larger than the loaded stable snapshot.
- Booking inventory, paid activities, editorial Guides, or implicit browser geolocation.
- Provider-specific page tokens unless ZioMap exposes a documented stable cursor contract later.

### 1.8 Acceptance criteria

- [x] AC-1: Tabs are exactly `For You`, `Food`, `Cafés`, `Stays`, `Attractions`, localized with EN/VI parity.
- [x] AC-2: Category click sends an allowlisted category code; category browse does not hard-filter on every word of a generated phrase.
- [x] AC-3: Stays accepts any supported stay category using OR semantics and returns real Places when provider/local evidence exists.
- [x] AC-4: Category ranking prefers candidates inside the selected destination/viewport and nearer candidates, then quality/popularity/freshness; it never invents local evidence.
- [x] AC-5: First authenticated For You entry runs destination fallback even with blank committed query and does not depend on another tab warming Place storage.
- [x] AC-6: Empty/error refresh preserves the last compatible non-empty feed. A true first-load outage shows localized retry UI.
- [x] AC-7: At most 16 cards and corresponding map pins render per page; page controls are keyboard accessible and make zero network calls.
- [x] AC-8: Destination/category/committed-query/result-snapshot changes reset to page 1; card photo index changes do not affect feed page.
- [x] AC-9: Original recommendation rank is retained for impression/click/detail/save/trip feedback across pages.
- [x] AC-10: Empty category results are not retained as a long-lived successful cache entry; retry remains possible.
- [ ] AC-11: Warm cache renders in under 500 ms at the web boundary; cold-path p95 target is <= 3 seconds when provider responds within budget. Timeouts return old compatible data or an honest retry state.
- [x] AC-12: No raw downstream errors, queries containing user free text, tokens, provider keys, or internal payloads appear in UI or production logs.

---

## 2. Architecture & Service Boundaries

### 2.1 Data flow

```text
Category browse
Browser -> API Gateway -> place-service
  category code + destination/viewport + limit 48
  -> local/cache lookup
  -> bounded provider refresh when insufficient
  -> taxonomy eligibility (OR)
  -> geo/quality/local ranking
  -> stable real-Place snapshot
Browser -> slice 16 -> cards + map pins

For You
Browser -> API Gateway -> recommendation-service
  -> Context/profile + Place candidates
  -> exact/base retrieval
  -> relaxed/destination baseline even when submitted query is blank
  -> ranked stable snapshot (target 48)
Browser -> slice 16 -> cards + map pins
```

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| `apps/web/tripsense` | Tab labels/state, page state/slicing, accessible controls, feed/map synchronization, preserve compatible non-empty snapshot |
| `services/api-gateway` | Existing `/api/places/**` and `/api/recommendations/**` routes, JWT propagation and policy |
| `services/place-service` | Canonical category taxonomy for browse, provider query translation, geo/category eligibility, deterministic Place ranking and cache |
| `services/recommendation-service` | Personalized ranking, fallback orchestration, stable original rank/impression, latency/degradation metadata |
| `services/context-service` | Existing purpose-scoped recommendation signals; no new contract |

No database sharing, cross-service repository, new JPA relationship, Kafka topic, or new service is introduced. Immediate serving remains synchronous REST because the UI requires the result; provider/index warming may remain asynchronous where already supported.

---

## 3. API & Event Contracts

### 3.1 Category-aware Place search

Backward-compatible extension:

`GET /api/places/search?q={providerSeed}&category={categoryCode}&lat={lat}&lng={lng}&radius={radius}&limit=48`

`category` is optional for existing autocomplete/free-text callers and allowlisted as:

```text
FOOD | CAFE | STAY | ATTRACTION
```

Validation:

- `limit`: `1..50`; Explore sends `48`.
- `radius`: existing `100..50000` bounds.
- `category`: exact enum; unknown values return stable `400 INVALID_CATEGORY`.
- `q`: remains required for current compatibility; category tabs use the single provider query seed from the server-owned category definition rather than concatenated synonyms.
- Client coordinates remain a retrieval hint bounded by existing radius rules, not authority to alter stored Place data.

Existing response envelope remains compatible:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "query": "khách sạn lưu trú",
    "category": "STAY",
    "returned": 32
  }
}
```

`returned` is snapshot size, not total provider inventory.

### 3.2 For You request

Reuse `POST /api/recommendations/explore-for-you`; raise the validated Explore limit ceiling from 30 to 48 and send `limit: 48`. No offset/page is added because client pagination must preserve one ranked impression and stable order.

### 3.3 Events

Reuse existing recommendation feedback endpoint and original absolute rank. No new Kafka event is introduced.

---

## 4. Data Model & Migrations

No persistent schema or migration is required.

- Place taxonomy remains versioned deterministic configuration/code owned by place-service.
- Redis/search cache keys add the category code so `FOOD` and `CAFE` cannot collide for identical provider seeds.
- Web category cache stores only bounded snapshots and must not treat an empty array as a durable successful category result.
- Recommendation cache already scopes by user/destination/query/profile/version/limit; changing limit naturally produces a distinct entry.

Rollback removes the optional category parameter usage and restores prior tabs. Existing Place and recommendation records remain valid.

---

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Category/query injection | Enum allowlist for category, existing query/radius/limit bounds, provider request built server-side |
| Cross-destination results | Radius enforcement and canonical destination center/viewport evidence |
| IDOR/profile spoofing | For You identity remains verified JWT-derived; no client user ID |
| Sensitive location | No implicit GPS request; only selected destination/map viewport is sent |
| Error/secret leakage | `apiClient` for authenticated recommendation calls, safe error codes, metadata-only production logs |
| Feedback corruption | Keep recommendation ID, canonical Place ID, and original absolute rank |

Existing exposed/live-looking environment credentials are an independent release blocker: rotate them and remove them from tracked files/history. No credential value is copied into this plan, tests, logs, or frontend.

---

## 6. Devil's Advocate & Trade-offs

| Decision | Rationale / trade-off |
| --- | --- |
| Client pagination over one bounded snapshot | Instant page changes and stable ranking/impression. It cannot claim inventory beyond the loaded 48 results. |
| No offset-based recommendation API | Offset requests can re-rank between pages, duplicate/skip Places, and create multiple impressions for one browse session. |
| Optional category on existing Place search | Minimal backward-compatible API change; avoids a duplicate category endpoint. |
| Structured taxonomy instead of keyword lists | Prevents the current all-token matching bug and keeps provider aliases server-owned/testable. |
| Current page pins only | Preserves feed/map membership and prevents map clutter; changing page intentionally changes visible pins. |
| No implicit GPS | Avoids surprising permission/privacy behavior. Destination/viewport relevance is honest and deterministic. |
| No fake result filling | A partial final page or honest outage is preferable to unrelated/synthetic Places. |
| Snapshot target 48 | Supports three full pages while staying within current Place limit 50; provider/local evidence may legitimately return fewer. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1 — Place category contract and ranking

- [x] Add category enum/validation and pass it through web API types/controller/service/cache key.
- [x] Add canonical OR taxonomy and provider seed mapping for `FOOD`, `CAFE`, `STAY`, `ATTRACTION`.
- [x] Separate browse-category ranking from specific-name free-text ranking; retain geographic and quality ordering.
- [x] Add tests proving a hotel does not need to also be a homestay/resort and valid restaurants do not need the word `ngon`.

### Phase 2 — For You first-load and latency correctness

- [x] Run destination baseline when a blank-query base request remains empty.
- [x] Preserve the last compatible non-empty snapshot; do not clear it on empty success.
- [x] Prevent repeated equivalent provider refreshes within one request and retain bounded degradation metadata.
- [x] Add timing metrics/tests for Context, Place retrieval, semantic retrieval, ranking, cache hit, and fallback count without logging raw queries.

### Phase 3 — Web tabs and 16-card pagination

- [x] Replace tabs and i18n keys with `For You`, `Food`, `Cafés`, `Stays`, `Attractions`.
- [x] Request bounded snapshot limit 48, store category code in cache identity, and avoid caching empty success.
- [x] Add page state/selectors, current-page card/map slicing, page reset rules, and localized previous/next/page labels.
- [x] Emit impressions only when the ranked card becomes visible/current-page eligible; retain absolute rank.
- [x] Match the supplied reference: circular arrow controls surrounding `Page X of Y`, responsive and keyboard accessible.

### Phase 4 — Reviews and verification

- [x] Architecture review: owners/boundaries unchanged and gateway routing preserved.
- [x] Database review: no migration/cross-service persistence; cache keys correctly scoped.
- [x] Security review: enum validation, no location surprise, no raw error/secret logging.
- [x] PR review: stale requests, page reset, empty cache, accessibility, i18n, duplicated code.

Verification commands:

```bash
./mvnw -pl services/place-service,services/recommendation-service -am test
cd apps/web/tripsense && npm test -- --run src/features/places
cd apps/web/tripsense && npm run type-check
cd apps/web/tripsense && npm run lint -- src/features/places
cd apps/web/tripsense && npm run i18n:check
```

Required regression scenarios:

1. Fresh authenticated user opens For You on cold Place storage and receives server fallback results when a provider is available.
2. Stays returns hotel-only, homestay-only, and resort-only candidates through OR semantics.
3. Food and Café remain distinct; Attractions exclude lodging-only candidates.
4. A 33-item snapshot renders pages `16 / 16 / 1`; arrows make zero API calls and map membership matches each page.
5. Destination/category/Enter submission resets page to 1; photo carousel does not.
6. Empty/error refresh keeps compatible cards; true first-load outage shows retry without fake Places.
7. Warm cache and cold provider paths record timing metrics and satisfy configured budgets in integration/performance environments.

---

## Human Approval Gate

```text
STATUS: APPROVED
```

Approved by the user on 2026-09-28 with “Implement”.

## 8. Completion Record

Repository implementation completed on 2026-09-28.

- Architecture review: passed; the existing web, gateway, place-service, recommendation-service, and context-service ownership boundaries remain unchanged.
- Database review: passed; no schema, migration, cross-service persistence, or cross-service ORM relationship was added. Category is included in the existing search cache identity.
- Security review: passed for this scope; category input is enum-allowlisted, query/radius/limit validation remains bounded, no implicit browser geolocation was added, and new logs contain metadata only.
- PR review: no merge-blocking finding remains in the implemented scope. Stale-request guards, compatible-feed preservation, non-empty cache writes, page resets, page-scoped pins, original recommendation ranks, keyboard controls, and EN/VI parity were verified.
- Verification: all 40 Places web tests, focused ESLint, Explore TypeScript type-check, i18n parity, 8 Place search tests, and 3 Explore recommendation tests passed on JDK 21. Focused Spotless checks passed for changed Java files. A later full-worktree type-check is currently blocked by unrelated concurrent onboarding/settings errors (`toPlaceRef` duplicate export and missing `currentLocale`), which are outside this feature and were left untouched.

AC-11 remains a production/integration measurement gate: defaults now bound the provider wait to 2.5 seconds and recommendation downstream wait to 3 seconds, blank For You starts with one destination-wide retrieval instead of an equivalent second widening request, and cache/fallback latency is logged without raw query data. Warm-cache and cold-path p95 still require observation against the deployed provider and are not claimed from unit tests.
