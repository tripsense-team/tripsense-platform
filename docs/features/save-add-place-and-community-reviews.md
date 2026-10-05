# Save/Add Place & Community Reviews — Specification & Implementation Plan

`STATUS: APPROVED; IMPLEMENTING`

- **Primary owners**: `services/place-service` (saved collections), `services/trip-service` (trip place pool), `services/social-service` (TripSense community reviews)
- **Affected components**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`, `services/trip-service`, `services/social-service`, `services/user-service`
- **Created date**: 2026-09-30
- **Approved date**: 2026-09-30 — human approval covers all release-gate decisions in section 7.1; review writes remain production-feature-flagged until a moderation/takedown owner is configured.
- **Approved architecture revision**: 2026-09-30 — community reviews reuse the existing `social-service`; no `review-service`, database, Gateway route, or deployment unit is created for this release.
- **Reference**: Mindtrip place-card/place-detail interaction and Jira TF-118 screenshot supplied by the requester. The public Mindtrip home page was inspected on 2026-09-30; authenticated/private behavior is specified from the supplied requirements and repository's existing Mindtrip-style components, not from copied proprietary source code.
- **Target PR boundaries**: Phase 1 contracts/data; Phase 2 backend behavior; Phase 3 shared web state/dialogs/pages; Phase 4 community reviews; Phase 5 verification

---

## 1. Goal & Requirements

### 1.1 Problem statement

TripSense already renders Mindtrip-style place cards and a Place Details overlay, but the Heart and Plus actions only mutate component/page-local `Set` state. A refresh loses the state, no trip/collection picker is shown, `/saved` and `/collections` have no production feature implementation, and the Place Details “From our community” block is a static empty placeholder. Provider reviews in `place-service` are not TripSense community reviews.

This feature makes the interactions persistent and consistent across Place Card, Place Details, Saved, and Collections while preserving service data ownership.

### 1.2 User journeys

#### Add a place to a trip

1. An authenticated user selects Plus/Add on a Place Card or Place Details.
2. TripSense opens an accessible responsive dialog/sheet listing the user's non-archived trips. Existing memberships for the place are checked.
3. The user checks or unchecks one or more trips and confirms.
4. `trip-service` idempotently adds/removes the canonical place reference in each selected trip's unscheduled **trip place pool**.
5. All mounted Place Cards, Place Details, and trip picker instances update from the same server-state cache. A place is “Added” when it belongs to at least one accessible trip.
6. A success toast names the affected trip(s); a sanitized error restores the last confirmed state and offers Retry.

Adding to a trip does **not** silently create an itinerary item: current itinerary items require a specific `dayId`, ordering, and optional time. Scheduling a pooled place into a day remains an explicit action in Trip Details.

#### Save a place to collections

1. An authenticated user selects Heart/Save on a Place Card or Place Details.
2. TripSense opens a collection picker showing the user's collections and whether the place belongs to each collection.
3. The user may create a collection inline, select one or more collections, then confirm.
4. `place-service` idempotently persists the associations. Heart is active when at least one collection contains the place.
5. `/saved` shows all distinct saved places, and `/collections` lists/manages collections. Removing the place from its last collection immediately removes it from Saved.

#### Read/write TripSense community reviews

1. Place Details loads provider reviews and TripSense community reviews independently.
2. “Our Community Reviews” displays the TripSense-only aggregate, author, avatar fallback, star count, plain-text content, and absolute timestamp rendered as localized relative time.
3. An authenticated user can create one review per place and edit/delete only their own review. This is necessary for the new community section to have a production data source; likes, replies, and review reports are deferred.
4. With no published reviews, the section shows a responsive empty state and an Add review CTA. Provider rating/review counts are never relabeled as TripSense community data.

### 1.3 Scope boundaries

| In scope | Out of scope |
| --- | --- |
| Add/remove a canonical place in one or more existing non-archived trips | Automatically choosing an itinerary day/time or creating itinerary items |
| Persistent collections, Saved page, Collections page, inline collection creation | Public/shared collections, collaborative collection editing, collection cover upload |
| Shared server-state synchronization across cards/detail/pages | Offline writes or conflict-free offline sync |
| TripSense review list, aggregate, one review per user/place, edit/delete own review | Review likes/replies, images, merchant replies, reports/admin moderation UI |
| EN/VI copy, responsive dialogs/sheets, loading/empty/error states | Pixel-copying Mindtrip assets, brand, proprietary code, or inaccessible authenticated pages |
| Provider reviews remain visible as a separately labeled source | Importing Google/ZioMap reviews as TripSense community reviews |

### 1.4 Domain invariants

- `placeRef` is the canonical `PlaceDto.id` issued by `place-service`, length 1–200. Provider IDs and fabricated map POI IDs must be resolved before writes.
- A `(tripId, placeRef)` pair is unique. Repeated Add is idempotent.
- A `(ownerUserId, collectionId, placeRef)` association is unique.
- A user owns at most 50 collections; names are trimmed, 1–80 characters, case-insensitively unique per owner; a collection holds at most 1,000 places.
- A user may publish at most one active review per place. Rating is integer 1–5; content is trimmed plain text, 10–2,000 Unicode characters.
- Add/Save state becomes confirmed only after the owning service commits. Optimistic UI may be used only with rollback and mutation serialization per place.
- Archived/deleted trips cannot receive new places. A trip deletion cascades only its trip-place associations, never place records.
- Deleting a collection deletes only its associations. Place facts remain owned by `place-service`.
- Provider and TripSense review aggregates are distinct fields and distinct UI labels.

### 1.5 Acceptance criteria

- [ ] **AC-1**: Add opens a trip picker populated from authenticated `GET /api/trips`; archived/cancelled trips are excluded and an empty state links to `/trips/new`.
- [ ] **AC-2**: Confirming Add persists selected trip memberships and returns idempotent success; reopening the picker shows the committed selections after refresh/sign-in on another device.
- [ ] **AC-3**: Add state is identical on every representation of the same canonical place in Place Card and Place Details. State is active when membership count is greater than zero.
- [ ] **AC-4**: Save opens a collection picker, supports inline collection creation, and permits selecting one or more collections.
- [ ] **AC-5**: Heart state is identical on Place Card, Place Details, `/saved`, and `/collections`; it is active exactly when the place belongs to at least one collection.
- [ ] **AC-6**: `/saved` exists in the current sidebar route, displays distinct saved places with pagination and collection filters, and has loading/empty/error states.
- [ ] **AC-7**: `/collections` lists, creates, renames, and deletes owned collections; deleting requires confirmation and never deletes place facts.
- [ ] **AC-8**: Actions require authentication. A signed-out action opens/redirects to login with a safe return URL and performs no speculative write.
- [ ] **AC-9**: Place Details contains a responsive “Our Community Reviews” section with separate TripSense average/count, reviewer identity, 1–5 stars, content, and localized time.
- [ ] **AC-10**: A user can create one review per place and edit/delete only their own. Empty state is shown when there are no published TripSense reviews.
- [ ] **AC-11**: Guessing another user's `collectionId`, another user's review ID, or an inaccessible `tripId` returns generic 404/403 behavior without leaking existence.
- [ ] **AC-12**: Duplicate/concurrent Add, Save, and review submissions resolve through unique constraints/idempotency and do not return 500.
- [ ] **AC-13**: All user-facing text exists in both EN and VI; all requests use `apiClient`; no raw server error or sensitive payload reaches UI or client logs.
- [ ] **AC-14**: Existing place search, provider reviews, recommendation feedback, trip itinerary, and collaboration flows remain backward compatible.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction flow

```text
Browser (Next.js)
  |-- /api/places/me/collections + /saved-* ----------> API Gateway -> place-service -> MongoDB
  |-- /api/trips + /api/trips/{id}/places -----------> API Gateway -> trip-service  -> PostgreSQL
  |                                                            |----> place-service canonical validation
  |-- /api/social/places/{placeRef}/reviews ----------> API Gateway -> social-service -> PostgreSQL
                                                               |----> user-service public profile batch
```

All browser traffic goes through API Gateway. No service reads another service's database and no cross-service JPA relationship is introduced.

### 2.2 Ownership decisions

| Component | Ownership and responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Dialogs/sheets, pages, React Query state, sanitized feedback, responsive UI | REST through relative `/api/**` only |
| `place-service` (existing) | Place facts plus user-to-place collection organization; validates canonical place locally | MongoDB; JWT for `/me/**` |
| `trip-service` (existing) | Trip ownership and unscheduled trip place pool | PostgreSQL; sync canonical validation with `place-service` |
| `social-service` (existing) | TripSense community review aggregate/lifecycle, reusing community security, moderation infrastructure, PostgreSQL, and public-profile client | PostgreSQL; sync canonical-place check and profile batch reads |
| `user-service` (existing) | Authoritative public display name/avatar only; no review/collection tables | Existing batch public profile contract |
| `api-gateway` | Routes, rate limits, auth propagation; blocks internal routes | Spring Cloud Gateway |

The approved revision deliberately avoids a mostly idle service. `social-service` already owns community-generated content, moderation/audit infrastructure, JWT handling, PostgreSQL/Flyway, and `UserPublicProfileClient`. A dedicated `review-service` remains a future extraction boundary when review traffic, moderation, merchant replies, or independent scaling justify it. Provider reviews remain owned by `place-service` and are never stored in the social tables.

### 2.3 Sync versus async

- Add/Save/review mutations and picker/status reads are synchronous because the user needs an immediate, authoritative result.
- No Kafka event is required for MVP correctness.
- A future `tripsense.review.review-changed.v1` event may feed recommendation/ranking, but it is explicitly deferred until a consumer and replay/idempotency contract exist.
- Existing recommendation `SAVE`, `UNSAVE`, `ADD_TO_TRIP`, and `REMOVE_FROM_TRIP` feedback is emitted **after** successful persistence. It remains analytics/ranking input, never the source of truth.

### 2.4 Frontend state architecture

- Add feature modules `features/saved-places`, `features/place-actions`, and `features/community-reviews`; `features/collections/index.ts` becomes a real domain entry point.
- React Query is authoritative for remote state. Suggested keys:
  - `['place-actions','saved-status',sortedPlaceRefs]`
  - `['collections']`, `['collection',collectionId]`, `['saved-places',filters]`
  - `['trip-place-memberships',sortedPlaceRefs]`
  - `['community-reviews',placeRef,page,size]`
- Remove `favoriteIds`, `addedPlaceIds`, and independent optimistic state from `PlaceDiscoveryView`/`MindtripPlaceCard`. Presentational components receive confirmed state and pending flags from shared hooks.
- Serialize mutations by `(action, placeRef)`; cancel relevant reads, snapshot cache, optimistically update, rollback on failure, then invalidate. A stale response must not overwrite a newer user selection.
- Status batches are loaded for the visible page and selected detail only, with a maximum of 100 place refs per request. Avoid N+1 requests.

---

## 3. API Contracts

All envelopes retain the owning service's standard `{ "success": true, "data": ... }` shape. Timestamps are ISO-8601 UTC. Error responses expose stable codes and safe messages only.

### 3.1 Saved collections — `place-service`

| Method | Gateway/service path | Auth | Result |
| --- | --- | --- | --- |
| `GET` | `/api/places/me/collections` | JWT | Owned collections ordered by updated time |
| `POST` | `/api/places/me/collections` | JWT | Create collection; `201` |
| `PATCH` | `/api/places/me/collections/{collectionId}` | JWT owner | Rename collection |
| `DELETE` | `/api/places/me/collections/{collectionId}` | JWT owner | Delete collection + associations; `204` |
| `PUT` | `/api/places/me/collections/{collectionId}/places/{placeRef}` | JWT owner | Idempotently save canonical place; `200/201` |
| `DELETE` | `/api/places/me/collections/{collectionId}/places/{placeRef}` | JWT owner | Idempotently remove association; `204` |
| `POST` | `/api/places/me/saved-status:batch` | JWT | Membership state for up to 100 refs |
| `GET` | `/api/places/me/saved?collectionId=&page=0&size=20` | JWT | Distinct current Place DTOs plus collection IDs |

```json
// POST /api/places/me/collections
{ "name": "Đà Nẵng ăn gì" }

// Collection response
{
  "id": "0d983de8-c5a9-4c89-8f85-ef7a46e822eb",
  "name": "Đà Nẵng ăn gì",
  "placeCount": 8,
  "version": 0,
  "createdAt": "2026-09-30T14:00:00Z",
  "updatedAt": "2026-09-30T14:00:00Z"
}

// POST /api/places/me/saved-status:batch
{ "placeRefs": ["canonical-place-id-1", "canonical-place-id-2"] }

// Response data
{
  "items": [
    {
      "placeRef": "canonical-place-id-1",
      "saved": true,
      "collectionIds": ["0d983de8-c5a9-4c89-8f85-ef7a46e822eb"]
    }
  ]
}
```

Rules: collection mutation endpoints derive `ownerUserId` from verified JWT, never request payload/path. Save returns `422 PLACE_NOT_CANONICAL` for an unresolved/provider-only ID, `404` for foreign collection, `409 COLLECTION_LIMIT_REACHED` or `COLLECTION_PLACE_LIMIT_REACHED`, and maps duplicate races to success.

### 3.2 Trip place pool — `trip-service`

| Method | Path | Auth | Result |
| --- | --- | --- | --- |
| `POST` | `/api/trips/place-memberships:batch` | JWT | Accessible trip memberships for up to 100 place refs |
| `PUT` | `/api/trips/{tripId}/places/{placeRef}` | JWT trip owner | Idempotently add to unscheduled pool; `200/201` |
| `DELETE` | `/api/trips/{tripId}/places/{placeRef}` | JWT trip owner | Idempotently remove; `204` |
| `GET` | `/api/trips/{tripId}/places?page=0&size=50` | JWT trip owner | Trip place pool for Trip Details |

The picker reuses existing `GET /api/trips?size=50`. MVP is owner-only to match the existing list contract. Collaborative editor support requires an explicit follow-up authorization/UX decision.

```json
// POST /api/trips/place-memberships:batch
{ "placeRefs": ["canonical-place-id-1"] }

// Response data
{
  "items": [
    {
      "placeRef": "canonical-place-id-1",
      "added": true,
      "tripIds": ["172b77c4-f810-4bcd-b97f-6bb254f08eca"]
    }
  ]
}

// PUT response data
{
  "id": "c9b0f68e-d042-4500-baa9-143411788467",
  "tripId": "172b77c4-f810-4bcd-b97f-6bb254f08eca",
  "placeRef": "canonical-place-id-1",
  "placeNameSnapshot": "Cầu Rồng",
  "placeAddressSnapshot": "Đà Nẵng",
  "addedAt": "2026-09-30T14:05:00Z",
  "version": 0
}
```

Before insert, `trip-service` validates owner/status, then calls a strict canonical snapshot method in `place-service`. Unlike current best-effort `validatePlace`, Add must fail closed with `422 PLACE_NOT_CANONICAL` or `503 PLACE_VALIDATION_UNAVAILABLE`; it must never persist a fabricated ID or null snapshot.

### 3.3 Community reviews — existing `social-service`

| Method | Path | Auth | Result |
| --- | --- | --- | --- |
| `GET` | `/api/social/places/{placeRef}/reviews?page=0&size=10` | Public | Published TripSense reviews + aggregate |
| `POST` | `/api/social/places/{placeRef}/reviews` | JWT | Create current user's review; `201` |
| `PATCH` | `/api/social/place-reviews/{reviewId}` | JWT author | Update rating/content |
| `DELETE` | `/api/social/place-reviews/{reviewId}` | JWT author | Soft-delete; `204` |

```json
// POST/PATCH request
{ "rating": 5, "content": "Không gian đẹp, phù hợp đi vào buổi tối." }

// GET response data
{
  "placeRef": "canonical-place-id-1",
  "summary": { "averageRating": 4.7, "reviewCount": 24 },
  "page": 0,
  "size": 10,
  "totalElements": 24,
  "totalPages": 3,
  "items": [
    {
      "id": "e94b1d52-9251-48e9-8ae5-3255f904be1d",
      "author": {
        "userId": "320dfd8f-1272-4da4-af86-a84e310c59fd",
        "displayName": "Phát Nguyễn",
        "avatarUrl": null
      },
      "rating": 5,
      "content": "Không gian đẹp, phù hợp đi vào buổi tối.",
      "createdAt": "2026-09-30T13:00:00Z",
      "updatedAt": "2026-09-30T13:00:00Z",
      "ownedByCurrentUser": false
    }
  ]
}
```

The public list validates the place reference through a cached canonical existence check. Author IDs on the page are hydrated through the existing user-service public profile batch endpoint (maximum 50); on profile-service failure, return a generic localized traveler label and null avatar, never fail the entire review list. `ownedByCurrentUser` is derived from optional valid JWT and is false for anonymous readers.

Stable error codes include `REVIEW_ALREADY_EXISTS` (409), `REVIEW_NOT_FOUND` (404), `REVIEW_FORBIDDEN` (404/403 according to the common anti-enumeration policy), and `INVALID_REVIEW` (422).

### 3.4 Gateway changes

- Existing `/api/places/**`, `/api/trips/**`, and `/api/users/**` routes cover collection, trip, and profile calls.
- Reuse the existing `/api/social/**` -> `lb://social-service` route; no new Gateway route is added.
- Apply per-user write rate limits: collections 10/minute, saved membership 60/minute, trip-place membership 30/minute, review create/update 5/minute. Public review reads use a separate IP-based burst limit and cache headers.
- Gateway forwards the bearer token; downstream services independently validate it and derive actor identity.

---

## 4. Data Model & Migrations

### 4.1 `place-service` MongoDB collections

```javascript
// user_place_collections
{
  _id: UUID,
  ownerUserId: UUID,
  name: String,
  normalizedName: String,
  version: NumberLong,
  createdAt: ISODate,
  updatedAt: ISODate
}
db.user_place_collections.createIndex(
  { ownerUserId: 1, normalizedName: 1 },
  { unique: true, name: "uq_collection_owner_name" }
)
db.user_place_collections.createIndex(
  { ownerUserId: 1, updatedAt: -1 },
  { name: "idx_collection_owner_updated" }
)

// user_saved_places
{
  _id: UUID,
  ownerUserId: UUID,
  collectionId: UUID,
  placeRef: String,
  savedAt: ISODate
}
db.user_saved_places.createIndex(
  { ownerUserId: 1, collectionId: 1, placeRef: 1 },
  { unique: true, name: "uq_saved_owner_collection_place" }
)
db.user_saved_places.createIndex(
  { ownerUserId: 1, placeRef: 1 },
  { name: "idx_saved_owner_place" }
)
```

Use an idempotent Mongock/Spring migration (or the repository's approved Mongo migration mechanism; do not silently rely on production auto-index creation) to create indexes. Rollback removes only new indexes/collections after data export. Collection delete and association cleanup execute in a Mongo transaction when the deployment topology supports it; otherwise delete the owner-validated collection first and run retryable idempotent association cleanup with an orphan cleanup job.

### 4.2 `trip-service` Flyway migration

```sql
CREATE TABLE trip_places (
  id UUID PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  place_ref VARCHAR(200) NOT NULL,
  place_name_snapshot VARCHAR(255) NOT NULL,
  place_address_snapshot VARCHAR(512),
  lat_snapshot NUMERIC(10, 7),
  lng_snapshot NUMERIC(10, 7),
  added_by_user_id UUID NOT NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_trip_places_trip_ref UNIQUE (trip_id, place_ref)
);
CREATE INDEX idx_trip_places_trip_created ON trip_places(trip_id, created_at DESC);
CREATE INDEX idx_trip_places_ref ON trip_places(place_ref);
```

Flyway file: next timestamped version after the current latest migration, named `__create_trip_places.sql`. Rollback script drops `trip_places`; deploy is additive/backward compatible. Do not change the semantics of `itinerary_items`.

### 4.3 `social-service` Flyway migration

```sql
CREATE TABLE place_reviews (
  id UUID PRIMARY KEY,
  place_ref VARCHAR(200) NOT NULL,
  author_user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content VARCHAR(2000) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED'
    CHECK (status IN ('PUBLISHED', 'REMOVED')),
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_review_content_length CHECK (char_length(btrim(content)) BETWEEN 10 AND 2000)
);
CREATE UNIQUE INDEX uq_review_active_author_place
  ON place_reviews(author_user_id, place_ref)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_review_place_published_created
  ON place_reviews(place_ref, created_at DESC)
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX idx_review_place_published_rating
  ON place_reviews(place_ref, rating)
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
```

Aggregate is calculated with indexed SQL for MVP and may be cached for 60 seconds with mutation eviction. Do not persist profile fields or place facts in this table. Rollback drops only this new table after export.

### 4.4 Retention and deletion

- Account deletion workflow must delete/anonymize owned collections, saved associations, trip membership actor references as required by audit policy, and review author data according to the platform retention policy. This must be wired before production enablement.
- Review soft deletion hides content immediately. A later privacy job may hard-delete after the approved retention window.
- Backups/logs are outside Flyway rollback; operational runbooks must cover their retention.

---

## 5. UI/UX Specification

### 5.1 Action controls

- Reuse existing Mindtrip-style Heart and Plus placement and TripSense theme tokens; do not copy logos/assets.
- Pending controls are disabled with visible progress and `aria-busy`; focus does not jump after success.
- Heart opens `SaveToCollectionDialog`; Plus opens `AddToTripDialog`. The same components are used from `MindtripPlaceCard` and `PlaceDetailOverlay`.
- Desktop uses centered dialogs; mobile uses bottom sheets with safe-area padding and a sticky confirmation footer.
- Dialogs trap focus, close on Escape, restore focus to the trigger, label checkboxes, and announce success/error using an `aria-live` region.

### 5.2 Save/Collections

- Collection row: checkbox, name, count, selected/pending state.
- Inline create: 80-character counter, trimmed validation, duplicate-name message.
- `/saved`: title, search, collection filter chips, responsive place-card grid, pagination, unsave action.
- `/collections`: collection cards with name/count, rename/delete controls, and selected collection detail.
- Sidebar continues to expose Saved and Collections; active route state works on desktop/mobile.

### 5.3 Add to trip

- Trip row: checkbox, trip name, destination, localized date range, display status.
- Cancelled/archived trips are not selectable. An empty state offers Create trip and retains a safe return path to reopen the place detail after trip creation.
- A place can belong to multiple trips; the global Plus/check state means “in at least one trip,” while the picker is the exact source of membership detail.
- Trip Details gains an “Ideas/Saved places” pool in a later subphase of this same feature so users can see/remove/schedule pooled places. Scheduling uses the existing create-itinerary-item contract after the user chooses a day; it is never automatic.

### 5.4 Community reviews

- Keep provider review section labeled `Provider reviews`/`Đánh giá từ nhà cung cấp`.
- New section heading: `Our Community Reviews` / `Đánh giá từ cộng đồng TripSense`.
- Header shows TripSense average and count only. Review card shows avatar/fallback initials, display name, five-star visualization, content, and localized `createdAt`; edited reviews show `Edited`/`Đã chỉnh sửa`.
- Pagination uses Load more. Empty state is neutral, not a fabricated rating.
- Add/Edit review dialog uses accessible 1–5 rating radio buttons and plain textarea. Delete requires confirmation.

### 5.5 Localization and errors

- Add keys to `common`, `nav`, `places`, `trip`, and `errors` namespaces in both `en.json` and `vi.json`, alphabetically sorted with schema parity.
- All calls use `@/services/api-client`; UI uses `getSafeErrorMessage` and domain-safe localized fallback copy.
- No raw exception, response body, SQL/JDBC message, token, or full review payload is logged. Development logs contain operation and non-sensitive resource IDs only.

---

## 6. Security & Trust Boundaries

| Risk | Required control |
| --- | --- |
| Authentication spoofing | Validate access JWT at Gateway and each service; derive actor from security context, never `userId` request data |
| Collection IDOR | Query/update by both `collectionId` and authenticated `ownerUserId`; foreign IDs return generic 404 |
| Trip IDOR | `trip-service` verifies owner and active status before membership read/write; never trust a trip returned by the client |
| Review IDOR | Update/delete by review ID + authenticated author; administrative override is not included |
| Fake/provider place IDs | Strict canonical lookup in `place-service`; fail closed on unavailable validation for all writes |
| Stored XSS | Normalize line endings, reject control characters, persist plain text, render through JSX only; no `dangerouslySetInnerHTML` |
| Spam/abuse | Per-user/IP rate limits, one active review/user/place, payload limits; production review write enablement requires abuse monitoring and takedown runbook |
| Duplicate/replay | Unique indexes, idempotent PUT/DELETE, optional `Idempotency-Key` for POST collection/review create, map duplicate races to 200/409 not 500 |
| Enumeration/privacy | Batch state returns data only for current actor; no membership counts or collection names exposed to other users |
| Error leakage | Stable public codes, sanitized messages, no internal service/DB details in UI/logs |
| External links/images | Existing approved image policy, allowlisted URLs, `rel=noopener noreferrer`; no user-entered link in review content |

Review write endpoints must not be enabled in production without a documented abuse/takedown owner. If that operational owner is unavailable, ship read + empty state behind a feature flag and keep the write CTA disabled with honest copy; do not silently publish unmoderated content.

---

## 7. Devil's Advocate & Trade-offs

| Concern | Decision / mitigation |
| --- | --- |
| Existing itinerary item could represent Add | Rejected: it requires a day/order and would silently schedule a user idea. `trip_places` preserves intent and can later promote into an itinerary item. |
| Store collections in `user-service` | Rejected for this plan: it would require cross-service place hydration and split the place curation domain. `place-service` can validate and return Place DTOs locally. |
| Create a dedicated `review-service` now | Rejected by the approved revision: it duplicates security/profile/moderation/deployment infrastructure and would be mostly idle. Keep community reviews cohesive in `social-service`; extract behind the same contract only when scaling/ownership warrants it. |
| Use recommendation events as persistence | Rejected: feedback is analytics/ranking input, may be dropped/replayed, and has no ownership/collection semantics. |
| One toggle means remove from all trips/collections | Rejected: destructive and ambiguous. The picker shows exact memberships; global icon is aggregate only. |
| Optimistic local Sets | Rejected as source of truth: refresh/device changes diverge. React Query cache is optimistic only around authoritative mutations with rollback. |
| New review service increases deployment scope | Accepted because it is an existing target architecture boundary. Review phase can be separately feature-flagged, but data may not be placed in another DB as a shortcut. |
| Profile lookup can slow review list | One batch call per page with short cache and generic-author fallback; never N+1. |
| Place deleted after save | Saved/trip associations retain refs/snapshots where defined, but reads mark unavailable and allow removal; they must not expose stale private data or crash a page. |
| Concurrent multi-tab edits | Unique constraints + idempotent methods; mutation responses/invalidation restore server truth. Review PATCH uses `version`/`If-Match` and returns 409 on stale edits. |

### 7.1 Release gates / open decisions

These are approval choices, not implementation guesses:

1. Community review ownership in existing `social-service` is approved; dedicated `review-service` is deferred.
2. Owner-only Add for MVP is approved; collaborator Editor support is deferred.
3. Review write scope (one review/user/place, own edit/delete) is approved.
4. Production review writes remain feature-flagged until a moderation/takedown owner is named.

---

## 8. Phased Implementation Tasks

### Phase 1 — Contracts and persistence

- [ ] Add OpenAPI/DTO definitions and safe error codes for collection, trip-place, and review contracts.
- [ ] Add Mongo collection/index migration for saved collections and Flyway migration for `trip_places`.
- [ ] Add `place_reviews` Flyway migration to the existing `social-service`; reuse its JWT, profile client, exception handling, and deployment.
- [ ] Reuse the existing Gateway social route and add scoped review rate-limit matching only if required.

### Phase 2 — Backend behavior

- [ ] Implement collection ownership, limits, CRUD, idempotent membership, batch status, and paged Saved read in `place-service`.
- [ ] Implement strict canonical validation contract and tests.
- [ ] Implement owner-only trip place pool, batch membership, list/add/remove, snapshot mapping, and duplicate-race handling in `trip-service`.
- [ ] Implement public review list/aggregate and authenticated own-review create/update/delete in `social-service`; batch hydrate public profiles with fallback.
- [ ] Add global safe exception mapping, validation, security, IDOR, concurrency, and service-unavailable tests.

### Phase 3 — Shared web actions and pages

- [ ] Build typed API clients and React Query hooks using `apiClient`; add query keys and mutation rollback/serialization.
- [ ] Build reusable `SaveToCollectionDialog` and `AddToTripDialog`; wire auth gate, inline collection create, empty states, safe toasts, and accessibility.
- [ ] Remove local `favoriteIds`/`addedPlaceIds` and internal card optimistic state; wire Place Card and Place Details to shared confirmed state.
- [ ] Implement `/saved`, `/collections`, and Trip Details place-pool section with responsive UI.
- [ ] Emit existing recommendation feedback only after successful domain mutation.

### Phase 4 — Community reviews

- [ ] Replace static community placeholder with `CommunityReviewsSection` and separate provider/community aggregates.
- [ ] Add review create/edit/delete dialog, pagination, profile fallback, pending/error/empty states, and production write feature flag.
- [ ] Add EN/VI translations and run sort/parity checks.

### Phase 5 — Verification and rollout

- [ ] Backend unit/integration tests with real PostgreSQL/Mongo test infrastructure for uniqueness, ownership, canonical validation, transaction/cleanup, stale version, and downstream outage behavior.
- [ ] Gateway route/auth/rate-limit tests.
- [ ] Frontend component/hook tests for dialog focus, selection reconciliation, mutation rollback, cross-component state, auth gate, empty/error states, and EN/VI.
- [ ] E2E: Save from card -> visible in detail/Saved/Collection after refresh; Add from detail -> visible in card/trip pool after refresh; create/edit/delete review; foreign-ID denial; mobile sheet flow.
- [ ] Feature flags: `NEXT_PUBLIC_PLACE_COLLECTIONS_ENABLED`, `NEXT_PUBLIC_TRIP_PLACE_POOL_ENABLED`, `NEXT_PUBLIC_COMMUNITY_REVIEWS_ENABLED`, and backend review-write flag. Roll out reads before writes.
- [ ] Observe mutation error rate, 409/422 rate, canonical validation latency, review API p95, profile fallback rate, and orphan association count.

### Verification commands

```bash
# Backend (root)
./mvnw -pl services/place-service,services/trip-service,services/social-service,services/api-gateway -am test

# Web
cd apps/web/tripsense
npm run i18n:sort
npm run i18n:check
npm run type-check
npm run lint
npm test
npm run build
```

No new Maven module or deployment unit is introduced by this feature.

---

## 9. Definition of Done

- [ ] All acceptance criteria pass with production services; no mock/in-memory persistence remains.
- [ ] Architecture, database, and security reviewers approve ownership and trust boundaries.
- [ ] Migrations are additive, repeatable in CI, and documented with rollback/export procedure.
- [ ] Provider reviews and TripSense reviews are visibly/source-wise distinct.
- [ ] No cross-service database access/JPA relationship exists.
- [ ] Web i18n, zero-leak logging, accessibility, responsive behavior, and test/build gates pass.
- [ ] Feature index/status and service docs are updated at completion.

---

## Human Approval Gate

```text
STATUS: APPROVED; IMPLEMENTING
```

Human approval was received on 2026-09-30. Implementation must remain within this specification; any ownership, contract, migration, security-model, event-contract, or acceptance-criteria change requires a revised approval.
