# Hotel Live Place Photos — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense` (photo lookup remains owned by existing `services/place-service`)
- **Affected Components**: `apps/web/tripsense`, existing `services/api-gateway`, existing `services/place-service`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: Phase 1 (lazy photo enrichment in hotel UI), Phase 2 (recovery, localization, and verification)
- **Related Features**: [Place Batch Enrichment & ZioMap Settings](./place-batch-enrichment-and-ziomap-settings.md), [Mindtrip Explore Experience Redesign](./mindtrip-explore-experience-redesign.md)

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

The `/hotels` page successfully loads hotel metadata from `GET /api/places/search`, but that search path does not fetch missing provider photo galleries. The hotel's card and detail components already render the photo fields they receive, and the existing Place Details API supports `GET /api/places/{id}?includePhoto=true`. The hotel adapter currently does not call it, so places without stored photos display the “Chưa có ảnh được cấp phép” placeholder.

Load genuine provider photos on demand without seeding/mock images. Reuse existing Place Details API and approved-photo validation; keep the page usable when no approved image exists or provider lookup fails.

### 1.2 User Flow

1. `/hotels` loads hotel search results as it does today.
2. For a hotel card that enters the visible viewport and has no approved photo, the web client requests its Place details with `includePhoto=true` through the existing API Gateway.
3. The Place Service returns existing or newly fetched, rights-approved `primaryPhoto`/`photoGallery`; the backend retains its existing provider-key and rights checks.
4. The hotel card and selected detail panel update from the returned photo data. If the result contains no approved photo or the request fails, the current placeholder remains and other hotel data continues to work.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Lazy, bounded Place Details photo lookup for visible hotel cards missing approved images.
  - If a booking result has no Place ID, search Place Service by hotel name and resolve a candidate only through the existing `isSameHotel` name/address matcher before requesting details.
  - Reuse `getPlaceDetails`, `approvedPhotoGallery`, current hotel card/detail components, API Gateway routes, and Place Service provider implementation.
  - Merge returned photo fields into the matching hotel by stable place ID; keep updates in page memory and rely on the existing Place Service persistence behavior.
  - Deduplicate in-flight lookups, cache successful/empty results for a bounded page lifetime, cancel or ignore stale requests on unmount/search change, and preserve the empty-photo placeholder.
  - Keep the image provider key backend-side and display only media marked approved by the Place Service.
- **Out-of-Scope**:
  - Seed/mock/stock photos, manually attaching unrelated hotel images, or inventing URLs.
  - New image storage service, new provider, new database schema, new public Place endpoint, or changing provider licensing policy.
  - Eagerly fetching photos for every search result or a large gallery on initial page load.
  - Partner-uploaded hotel gallery management, external booking-provider photos, and unrelated restaurant/place photo flows.

### 1.4 Acceptance Criteria

- [ ] **AC-1**: A hotel with an approved gallery returned by Place Details displays that image on its card and in the hotel detail panel without seeded data.
- [ ] **AC-2**: A hotel with existing approved `photos` or photo evidence does not issue a redundant Place Details photo request.
- [ ] **AC-3**: Missing, rejected, or failed photo lookup leaves the truthful placeholder and does not hide hotel details or crash search.
- [ ] **AC-4**: Requests begin only for visible cards, are deduplicated per place ID, and use a small bounded concurrency limit; scrolling/search changes do not create unbounded stale work.
- [ ] **AC-5**: The frontend rejects unapproved media using the existing `approvedPhotoGallery` policy; provider credentials and raw internal errors never reach the browser.
- [ ] **AC-6**: Existing provider rights gate (`ZIOMAP_PHOTO_DISPLAY_APPROVED`), active backend API key, and Gateway routing remain required; the client does not bypass them.
- [ ] **AC-7**: English/Vietnamese loading, empty, and failure states remain consistent with existing place-photo UI.

## 2. Architecture & Service Boundaries

```text
Hotel cards (/hotels)
  | Existing REST through API Gateway
  +--> GET /api/places/search (hotel metadata)
  +--> GET /api/places/{placeId}?includePhoto=true (lazy, visible cards only)
           |
           v
     place-service -> existing ZioMap provider / MongoDB
```

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Trigger bounded lookup for visible hotel cards without a safe photo and merge response into existing hotel display data | Existing authenticated/public JSON API client through Gateway |
| `services/api-gateway` | Continue routing `/api/places/**` to Place Service | Existing Spring Cloud Gateway route |
| `services/place-service` | Own photo provider credentials, consent/rights gate, allowed-host validation, lookup, and existing Place persistence | Existing `GET /api/places/{id}?includePhoto=true` |

No new service or cross-service data access is introduced. Place Service remains the authority for photo retrieval and approval.

## 3. API & Event Contracts

No API contract changes. Reuse:

```text
GET /api/places/{id}?name={hotelName}&lat={lat?}&lng={lng?}&includePhoto=true
```

The frontend uses the existing `getPlaceDetails(id, name, lat, lng, signal, true)` client helper. It consumes `data.photos`, `data.primaryPhoto`, and `data.photoGallery`; only values accepted by `approvedPhotoGallery` are passed to image components. No provider URL, provider key, or photo metadata is added to booking payloads.

## 4. Data & Configuration

- No new table or migration.
- Place Service already uses `ZIOMAP_PHOTO_DISPLAY_APPROVED` as an operator-controlled gate and a backend-held active API key. The provider returns an empty gallery if the rights gate/key is unavailable; the frontend must treat this as a normal empty result.
- Reuse the current 5-minute freshness behavior for successfully fetched photo evidence where compatible. Empty results should have a shorter retry window and not trigger repeated requests on every render.
- Do not use the Unsplash fallback in `offersToHotel` as an approved provider photo; it is not evidence for the specific hotel and is rejected by the current approved-photo allowlist.

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Unlicensed or mismatched image | Fetch only by the matched Place ID; accept only provider output marked approved and passing existing HTTPS/host checks. Never attach generic stock imagery to a real hotel. |
| API key exposure | The Place Service performs provider calls; no key is placed in query parameters, frontend configuration, or browser logs. |
| Provider quota/cost | Fetch only for visible cards without an approved photo; deduplicate per place ID, bound concurrency, stop work for stale views, and avoid retry loops for empty results. |
| Tracking or stale responses | Use the current hotel search identity/abort signal and merge results only into the matching stable place ID. |
| Error leakage | Keep the existing placeholder on failure and use sanitized logging/feedback per `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`. |

## 6. Trade-offs

| Concern | Decision |
| --- | --- |
| Eagerly fetch all search results | Rejected due to provider quota, latency, and unnecessary work for cards never viewed. Lazy visible-card enrichment can leave below-fold cards blank until scrolled into view. |
| Use generic hotel stock images | Rejected because they can misrepresent the specific property and are not provider evidence for that hotel. |
| Add a new image API or database | Not needed; the existing Place Details endpoint already retrieves approved galleries and persists provider data under Place Service ownership. |
| Provider has no image or rights gate is disabled | Keep the current placeholder. Display must not imply an image exists when no approved photo is available. |

## 7. Implementation Tasks & Verification

### Phase 1: Hotel UI Photo Enrichment

- [x] Add a reusable lazy-photo lookup for hotel cards using existing Place search/details helpers and visibility observation; booking-only results first resolve to a matching Place ID.
- [x] Add per-place request deduplication, bounded concurrency, stale-result suppression, and short-lived in-memory cache for success and empty results.
- [x] Merge approved photo evidence into the existing `MindtripHotel` display model and update both card and selected detail display without refetching hotel offers.
- [x] Remove unrelated Unsplash fallback photos from live hotel offers; keep truthful placeholders.

### Phase 2: Verification

- [x] Unit tests: lookup only when visible and no approved image; no duplicate lookup; successful gallery appears; empty/unapproved result preserves placeholder; stale component results are ignored after unmount.
- [ ] Manual check in DevTools: a visible hotel triggers `GET /api/places/{id}?includePhoto=true`; response includes `photoGallery`; browser then requests the approved image host.
- [ ] Verify with photo rights enabled and disabled, and with a missing provider key; non-photo hotel metadata must continue to render in all cases. These checks require a live backend configured for each provider state.
- [x] Run web type-check, hotel component/service tests, full web test suite, lint, and production build. `npm run i18n:check` was run but is blocked by pre-existing A→Z ordering errors in `src/locales/en.json` and `src/locales/vi.json`; this feature adds no translation keys.

### Implementation Review & Completion

- Architecture review: passes; photo retrieval stays in the existing Place Service through the API Gateway, with no new service or direct database access.
- Database review: no persistence/schema changes; existing Place Service remains the owner of stored photo URLs and evidence.
- Security review: passes; only stable Place IDs are queried, returned IDs must match, media is filtered through `approvedPhotoGallery`, and provider credentials remain backend-side.
- PR review: no blocking findings. Failed or empty lookups preserve the existing licensed-photo placeholder; request errors are swallowed by the enrichment layer and are not exposed to users.
- Verification: type-check, production build, full web test suite (327 tests before the final added test), targeted hotel tests (13 tests), and lint completed. Lint reported zero errors; it reports existing warnings elsewhere in the app. The new behavior also has a visibility-triggered component test.
- Runtime provider verification remains dependent on the Place Service rights flag and active provider key. If either is unavailable, no image is expected and the placeholder remains.
- Docker runtime inspection was unavailable in the implementation environment (`docker` socket permission denied), so the active container's provider key and rights flag could not be confirmed here.

```bash
cd apps/web/tripsense && npm run type-check
cd apps/web/tripsense && npm test -- --run hotel-service-adapter mindtrip-hotel-components
cd apps/web/tripsense && npm run i18n:check
```

## Human Approval Gate

```text
STATUS: DONE
```

Approved by the user on 2026-10-19 and implemented within the approved scope. Runtime provider checks are environment-dependent as recorded above.
