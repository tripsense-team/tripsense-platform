# AI Granular Itinerary Update APIs, Replace Semantics & Hotel/Stay Display — Specification & Implementation Plan

`STATUS: DONE`

- **Human Approval**: Approved by user on 2026-11-25 (`"Tiến hành implements"`).
- **Completed**: 2026-11-25 (all 3 phases implemented and verified across `trip-service`, `ai-service`, and `apps/web/tripsense`).

- **Owner Service**: `services/trip-service` (authoritative itinerary & trip mutation APIs), `services/ai-service` (AI tool orchestration, strict STAY grounding & prompt rules), `apps/web/tripsense` (AI Chat stay display, category badges & PlaceCards fixes)
- **Affected Components**: `services/trip-service`, `services/ai-service`, `apps/web/tripsense` (no Gateway route changes needed; existing `/api/trips/**` & `/api/ai/**` routes cover all new paths)
- **Date**: 2026-11-25
- **Target PR Boundaries**:
  - Phase 1 (`trip-service`): Granular Item/Day/Trip itinerary APIs (`PATCH` move/clearPlaceRef, `PUT/DELETE` day items, `POST` swap days, `REPLACE_DAYS` & `REPLACE_TRIP_ITEMS` in `/internal/ai/itinerary-commits`, dedupe guard, `@CacheEvict`, SSE `CollaborationChangeEvent`) + unit/integration tests
  - Phase 2 (`ai-service`): Strict `STAY` filtering + fallback in `prepareTripCandidates`, `hasTripItems` & `tripRevision` runtime sync in `chat.ts`, granular AI tools (`createTripProposal` commit modes + deterministic replace guard, `replaceDayItinerary`, `manageItineraryDays`, `updateTripDetails`, fixed `updateItineraryItem`/`replaceItineraryItem`/`addItineraryItems`), prompt rules (1 hotel per area for ≥ 2-day trips) + tests
  - Phase 3 (`apps/web/tripsense`): `ItineraryPreview` accommodation highlight card + category badges, suppress duplicate raw `searchPlaces` carousel under proposals, `PlaceCards` `+ Add to trip` fix (`placeRef`, mapped type, day selection, `tripsense:itinerary-updated`), `ActiveAgentStatus` labels for new tools, EN/VI i18n parity + tests

---

## 1. Goal & Requirements

### 1.1 Problem Statement
Audit of live AI Chat test sessions (`4eda42a9-...` / trip `97424049-...`) and source code identified 3 core defects:
1. **Updating an existing itinerary via AI duplicates all stops instead of replacing them**:
   - `AiItineraryCommitRequest.Action` only supports `CREATE_TRIP` and `ADD_TO_TRIP` (append-only). When a user asks *"Hãy cập nhật lại lịch trình 2 ngày này..."*, the AI calls `createTripProposal`, which auto-commits with `ADD_TO_TRIP` and appends 14 new stops onto the existing 14 stops (28 total, duplicating landmarks across both days).
   - `chat.ts:1338` checks `Array.isArray(tripData?.trip?.items)` (always `false`, since `TripResponse` has no `items` field — items live in `days` from `/itinerary`), so the AI runtime never knows whether the linked trip already has items.
   - `trip-service` lacks day-level atomic replace (`PUT .../days/{dayId}/items`), clear day (`DELETE .../days/{dayId}/items`), swap days (`POST .../days/swap`), item cross-day move (`targetDayId`), and snapshot clearing (`clearPlaceRef`).
   - `ai-service` lacks a tool to update trip duration/budget/travelers (`PATCH /api/trips/{tripId}`), `parseTimes` silently drops single times like `"12:30"`, `replaceItineraryItem` leaves stale snapshots when `placeRef` is null, and `runtime.tripRevision` is not initialized or kept in sync across multi-tool turns.
2. **Hotels / accommodation (`STAY`) rarely appear in initial AI Chat itineraries and candidate retrieval leaks non-hotels**:
   - `prompts.ts` mentions check-in/check-out times without requiring a real `STAY` venue for multi-day trips (`durationDays >= 2`).
   - `prepareTripCandidates` queries `recommendation-service` with soft `preferredCategories: ["hotel", "lodging", "resort"]`, returning restaurants, coffee shops, food walking tours, and museums inside the `STAY` bucket (3/5 items wrong in live DB evidence), preventing fallback to `place-service?category=STAY`.
   - `ItineraryPreview` renders all stops identically without category badges or a dedicated accommodation summary block.
3. **In-chat `PlaceCards` "Add to trip" drops place grounding & doesn't sync the right panel**:
   - `place-cards.tsx` omits `placeRef`, hardcodes `type: "PLACE"`, always appends to `days[0]`, and does not dispatch `tripsense:itinerary-updated`.

### 1.2 In-Scope & Out-of-Scope
- **In-Scope**:
  - Complete 4-tier itinerary mutation APIs in `trip-service`: Item-level (`move` + `clearPlaceRef`), Day-level (`replaceDayItems`, `clearDayItems`, `swapDays`), Atomic AI multi-day commit (`REPLACE_DAYS`, `REPLACE_TRIP_ITEMS`, same-day `placeRef` dedupe in `ADD_TO_TRIP`, `@CacheEvict`, `CollaborationChangeEvent`), and existing Trip-level (`PATCH /api/trips/{tripId}`).
  - Compact, non-overlapping AI toolset in `ai-service` mapped 1-to-1 to those APIs + strict `STAY` candidate filtering + 1-hotel-per-area planning rule for trips ≥ 2 days.
  - Web UI polish in `ItineraryPreview`, `message.tsx`, `shell.tsx`, and `PlaceCards` with full EN/VI i18n parity.
- **Out-of-Scope**:
  - Re-opening `POST /api/trips/{tripId}/itinerary/batch` (stays fail-closed `503` until independent proposal-proof exists; AI multi-day commits use HMAC-signed `/internal/ai/itinerary-commits`).
  - Database schema changes or new Flyway migrations (all requirements fit existing `trips`, `itinerary_days`, `itinerary_items`, `collaboration_change_events`, `itinerary_commit_receipts` tables).
  - Live hotel pricing/booking checkout flow inside AI Chat (links to existing `/hotels` or place detail drawer).

### 1.3 Acceptance Criteria
1. Asking AI to *"Cập nhật lại lịch trình 2 ngày này..."* on a trip with 14 items atomically **replaces** the itinerary instead of appending to 28 items; `/trips/[tripId]` and AI Chat right panel refresh immediately with the exact updated stops.
2. Asking AI to *"Đổi lại toàn bộ Ngày 2 đi Bà Nà Hills"* replaces **only Day 2** while leaving Day 1 untouched.
3. Asking AI to *"Dời Chùa Linh Ứng từ Ngày 1 sang sáng Ngày 2"* moves the item atomically to Day 2 without duplicating or losing notes.
4. Asking AI to *"Xóa hết hoạt động Ngày 2"* clears Day 2 while keeping the Day 2 container; asking *"Đổi lịch Ngày 1 và Ngày 2 cho nhau"* swaps items cleanly.
5. Asking AI to *"Đổi giờ ăn trưa sang 12:30"* updates `startTime = 12:30:00` (not a silent no-op).
6. Asking AI to *"Thêm ngày thứ 3 cho chuyến đi này"* extends `endDate` via `PATCH /api/trips/{tripId}` (creating Day 3) and populates Day 3 without `INVALID_AI_COMMIT_DAY`.
7. Creating a multi-day trip (≥ 2 days) in a single city automatically includes **1 real grounded hotel/stay (`STAY`, valid `placeId`)** from filtered `STAY` candidates (never cafes/restaurants/tours), displayed with an Accommodation highlight block + category badges in `ItineraryPreview`.
8. Clicking `+ Add` on `PlaceCards` in AI Chat preserves `placeRef`, maps `HOTEL`/`MEAL`/`PLACE` properly, lets the user pick the target day when multiple days exist, and refreshes `TripDetailPanel` immediately.

---

## 2. Architecture & Service Boundaries

- **`services/trip-service`** (*existing, authoritative owner*): Owns `trips`, `itinerary_days`, `itinerary_items`, `collaboration_change_events`, and `itinerary_commit_receipts`. Validates `placeRef` synchronously against `place-service` via `PlaceClient`. No cross-service DB/JPA coupling.
- **`services/ai-service`** (*existing, orchestrator*): Owns chat sessions, proposals, LLM tool definitions, prompt rules, and candidate grounding (`place-grounding.ts`). Calls `trip-service` synchronously over HTTP with user JWT (+ HMAC signature for `/internal/ai/itinerary-commits`) and `place-service` / `recommendation-service` for place discovery.
- **`apps/web/tripsense`** (*existing*): Calls Gateway REST APIs via `apiClient` / `authenticatedFetch`; receives realtime trip updates via existing SSE (`/api/trips/{tripId}/collaboration/events`) and custom window event `tripsense:itinerary-updated`.
- **Sync vs Async**: All itinerary edits require immediate confirmation for the user's active conversation/view → synchronous REST. Multi-tab/collaborator propagation uses existing `CollaborationChangeService.record(...)` → `CollaborationRealtime.afterCommit(...)` SSE stream.

---

## 3. API & Tool Contracts

### 3.1 `services/trip-service` REST & Internal APIs

All public endpoints require valid JWT (`CurrentUserProvider.userId()`) and pass `getEditableTrip(userId, tripId)` (`OWNER` or `EDITOR`).

#### A. Upgrade `PATCH /api/trips/{tripId}/itinerary/items/{itemId}` (Item Move & Clear Place)
- **DTO**: `UpdateItineraryItemRequest` (backward-compatible record — keep all existing constructors, add optional fields):
  ```java
  public record UpdateItineraryItemRequest(
      UUID placeId,
      String placeRef,
      ItineraryItemType type,
      @Size(max = 200) String title,
      LocalTime startTime,
      LocalTime endTime,
      @Min(1) @Max(1440) Integer durationMinutes,
      ItineraryItemStatus status,
      @Size(max = 5000) String notes,
      Long version,
      Long expectedTripRevision,
      Boolean clearTimes,
      UUID targetDayId,
      Boolean clearPlaceRef)
  ```
- **Behavior**:
  - If `targetDayId != null` and `!targetDayId.equals(item.getDayId())`: verify `targetDayId` belongs to `tripId` via `getTripDay(tripId, targetDayId)`, reassign `item.setDayId(targetDayId)`, assign `sortOrder = maxSortOrder(tripId, targetDayId) + 100`.
  - If `Boolean.TRUE.equals(clearPlaceRef)` (and `effectivePlaceRef() == null`): clear `placeId`, `placeRef`, `placeNameSnapshot`, `placeAddressSnapshot`, `latSnapshot`, `lngSnapshot` to `null`.
  - Records `CollaborationChangeType.ITEM_UPDATED`, increments `publicationRevision`, evicts caches.

#### B. New `PUT /api/trips/{tripId}/itinerary/days/{dayId}/items` (Atomic Replace Single Day)
- **Request DTO** `ReplaceDayItemsRequest`:
  ```java
  public record ReplaceDayItemsRequest(
      @NotNull @Size(max = 50) List<@Valid CreateItineraryItemRequest> items,
      Long version,
      Long expectedTripRevision) {}
  ```
- **Response**: `200 OK` → `ApiResponse<ItineraryDayResponse>`
- **Behavior (`@Transactional`, `@CacheEvict`)**:
  1. `Trip trip = getEditableTrip(userId, tripId)`, `ensureNotArchived(trip)`, `validateAggregateRevision(expectedTripRevision, trip)`.
  2. Lock day via `dayRepository.findByIdAndTripIdForUpdate(dayId, trip.getId())`; validate `version` if provided.
  3. Validate all incoming items (`validateTimeRange` + `placeClient.validatePlace` when `effectivePlaceRef() != null`) **before** deleting old rows so validation errors roll back cleanly.
  4. Delete existing items for `(tripId, dayId)` (`deleteAllInBatch` + flush), insert new items with sequential `sortOrder = (idx + 1) * 100`.
  5. Increment `publicationRevision`, save trip, call `collaborationChangeService.record(trip, userId, CollaborationChangeType.ITEM_UPDATED, Map.of("dayId", dayId.toString(), "replacedCount", savedItems.size()))`.

#### C. New `DELETE /api/trips/{tripId}/itinerary/days/{dayId}/items` (Clear Single Day)
- **Query Params**: `expectedTripRevision` (optional `Long`), `expectedDayVersion` (optional `Long`)
- **Response**: `200 OK` → `ApiResponse<ItineraryDayResponse>` (empty items list)
- **Behavior**: Locks trip + day, validates revision/version, deletes all items in `dayId`, increments `publicationRevision`, records `CollaborationChangeType.ITEM_DELETED`, evicts caches.

#### D. New `POST /api/trips/{tripId}/itinerary/days/swap` (Swap Two Days)
- **Request DTO** `SwapDaysRequest`:
  ```java
  public record SwapDaysRequest(
      @NotNull @Min(1) @Max(365) Integer firstDayNumber,
      @NotNull @Min(1) @Max(365) Integer secondDayNumber,
      Long expectedTripRevision) {}
  ```
- **Response**: `200 OK` → `ApiResponse<ItineraryResponse>`
- **Behavior**: Validates `firstDayNumber != secondDayNumber`, locks trip + both days, swaps `dayId` on all items between Day A and Day B (using temporary negative `sortOrder` if unique constraint exists, then restoring positive `sortOrder`), increments `publicationRevision`, records `CollaborationChangeType.ITEM_REORDERED`, evicts caches.

#### E. Upgrade `POST /internal/ai/itinerary-commits` (Atomic Multi-Day Replace & Dedupe)
- **DTO** `AiItineraryCommitRequest` (backward-compatible):
  ```java
  public enum Action {
    CREATE_TRIP,
    ADD_TO_TRIP,
    REPLACE_DAYS,
    REPLACE_TRIP_ITEMS
  }
  // Add optional field:
  List<@Min(1) @Max(365) Integer> replaceDayNumbers // required & non-empty when action == REPLACE_DAYS
  ```
- **Behavior in `AiItineraryCommitServiceImpl`**:
  - Add `@CacheEvict(cacheNames = {"trip-detail", "trip-list", "trip-itinerary"}, allEntries = true)`.
  - **`REPLACE_TRIP_ITEMS`**: Validates all incoming `dayNumber`s exist (and time ranges + canonical places), deletes all existing `ItineraryItem`s for `trip.getId()`, inserts the new items with fresh sequential `sortOrder = 100, 200...` per day.
  - **`REPLACE_DAYS`**: Requires non-empty `replaceDayNumbers`, verifies every day number exists in `trip`, verifies every incoming item's `dayNumber` is in `replaceDayNumbers`, deletes existing items ONLY for those target `dayId`s, inserts new items into those days (untouched days remain 100% intact).
  - **`ADD_TO_TRIP`**: Keeps existing idempotency check AND adds same-day `placeRef` dedupe: if `requestedItem.placeRef() != null` and an item with the same `placeRef` already exists in that `dayId`, mark `SKIPPED_DUPLICATE` instead of duplicating.
  - **Revision + Realtime**: Replace manual `trip.setAggregateRevision(nextRevision)` with `collaborationChangeService.record(trip, userId, CollaborationChangeType.ITEM_UPDATED, ...)` (which atomically increments `aggregateRevision` and triggers SSE after commit) + increment `publicationRevision`.

### 3.2 `services/ai-service` Compact Toolset (8 Non-Overlapping Itinerary Tools)

1. **`createTripProposal`** (enhanced):
   - Add `commitMode?: "ADD_TO_TRIP" | "REPLACE_DAYS" | "REPLACE_TRIP_ITEMS"` (optional).
   - **Deterministic Server Guard**: When `context.runtime.hasTripItems === true` and `commitMode` is omitted or `"ADD_TO_TRIP"` while the proposal covers existing days of the trip, automatically upgrade commit action to `"REPLACE_TRIP_ITEMS"` (if proposal covers all trip days) or `"REPLACE_DAYS"` (for the covered `dayNumber`s) — **making accidental duplication structurally impossible even if the LLM forgets `commitMode`!**
2. **`replaceDayItinerary`** (new): Replaces all items in a single `dayNumber` via `PUT /api/trips/{tripId}/itinerary/days/{dayId}/items` (resolves canonical places via `resolveCanonicalActivityPlaces`).
3. **`addItineraryItems`** (enhanced): Adds 1–N stops to a single `dayNumber` via `ADD_TO_TRIP` (now deduplicated by `placeRef` per day); updates `runtime.tripRevision`.
4. **`updateItineraryItem`** (enhanced): Edits `title`, `timeSlot` (fixed `parseTimes` to support single start times like `"12:30"`!), `notes`, `clearTimes`, **and `targetDayNumber`** (maps to `targetDayId` on `PATCH`) — updates `runtime.tripRevision`.
5. **`replaceItineraryItem`** (enhanced): Replaces one stop with a new place via `PATCH`; sends `clearPlaceRef: true` whenever `canonical` is null so stale coordinates/photos are wiped; updates `runtime.tripRevision`.
6. **`removeItineraryItem`** (enhanced): Deletes one item via `DELETE`; updates `runtime.tripRevision`.
7. **`manageItineraryDays`** (new — compact 2-in-1 day tool): `action: "CLEAR_DAY"` (`DELETE .../days/{dayId}/items`) or `action: "SWAP_DAYS"` (`POST .../days/swap`).
8. **`updateTripDetails`** (new): Calls `PATCH /api/trips/{tripId}` to extend/adjust `durationDays` (computes new `endDate` from trip's `startDate`), `startDate`, `endDate`, `travelerCount`, `budgetAmount`, or `name`, and refreshes `runtime.brief` & `runtime.tripRevision`.
9. **`reorderItineraryItems`** (existing): Reorders or sorts a day chronologically (`preserveTimes: true`).

---

## 4. Data Model & Migrations

- **No database schema changes or Flyway migrations required.**
- Add repository helper methods in `ItineraryItemRepository`:
  - `List<ItineraryItem> findByTripId(UUID tripId)` / `void deleteByTripId(UUID tripId)`
  - `void deleteByTripIdAndDayIdIn(UUID tripId, Collection<UUID> dayIds)`
  - `boolean existsByTripIdAndDayIdAndPlaceRef(UUID tripId, UUID dayId, String placeRef)`
- Flush (`itemRepository.flush()`) after bulk deletes before inserting replacement items inside the same transaction so unique indexes on `(trip_id, day_id, sort_order)` or `(trip_id, source_proposal_id, source_item_key)` never collide.

---

## 5. Security & Trust Boundaries

- **Auth & Anti-IDOR**:
  - Every public endpoint in `TripController` resolves `UUID userId = currentUserProvider.userId()` from JWT and enforces `getEditableTrip(userId, tripId)` (`OWNER` or `EDITOR` only; `VIEWER` gets `403`, non-members get `404`).
  - `targetDayId`, `dayId`, and `itemId` are always queried with `AND trip_id = :tripId` to prevent cross-trip IDOR.
  - `/internal/ai/itinerary-commits` enforces `AiCommitSignatureVerifier` (HMAC-SHA256 + timestamp window + body SHA-256) PLUS user JWT `resolveTrip` ownership/editor verification.
- **Validation**:
  - `replaceDayItems`: max 50 items/day; time range `startTime < endTime`; `title` max 200 chars; `notes` max 5,000 chars.
  - `swapDays`: `firstDayNumber != secondDayNumber`, both days must belong to `tripId`.
  - `updateTripDetails`: forwards user JWT to `PATCH /api/trips/{tripId}` so `trip-service` enforces `validateDateRange`, `blockDateShrinkWithItems`, and `MAX_TRIP_DAYS`.
- **Zero-Leak Errors**: All frontend API errors in `PlaceCards` and chat panels pass through `getSafeErrorMessage(err)`.

---

## 6. Devil's Advocate & Technical Trade-offs (Phản biện kỹ thuật)

| Topic | Naive Approach | Critical Pushback & Adopted Solution |
|---|---|---|
| **LLM Tool Sprawl** | Expose 12–14 separate AI tools (`moveItem`, `clearDay`, `swapDays`, `replaceTrip`, `replaceDay`, etc.). | **Rejected.** Too many overlapping tools bloat input tokens (~2k tokens/turn) and increase wrong-tool selection in Gemini. **Solution**: Keep **full REST granularity in `trip-service`** (reusable by Web & Mobile), but expose **compact, orthogonal AI tools** (`updateItineraryItem` absorbs `targetDayNumber`; `manageItineraryDays` combines `CLEAR_DAY`/`SWAP_DAYS`; `createTripProposal` handles `ADD_TO_TRIP` / `REPLACE_DAYS` / `REPLACE_TRIP_ITEMS`). |
| **Prompt-only Replace Guard** | Rely only on `prompts.ts` telling Gemini not to duplicate items. | **Rejected.** LLMs still occasionally omit `commitMode` or call `createTripProposal` on update prompts. **Solution**: Enforce a **deterministic server-side guard** in `create-trip-proposal.ts` using true `runtime.hasTripItems` (fixed from `days` in `chat.ts`) so updating an already-populated trip automatically uses `REPLACE_TRIP_ITEMS` / `REPLACE_DAYS`. |
| **Hotel (`STAY`) Filtering** | Only add a prompt rule asking for 1 hotel per area. | **Rejected.** Live DB evidence showed 3/5 items returned in `prepareTripCandidates`'s `STAY` bucket were cafes, vegan restaurants, food tours, and museums because `recommendation-service` treats `preferredCategories` as a soft boost. **Solution**: Add deterministic `matchesBrowseCategory(place, "STAY")` filtering in `place-grounding.ts` and trigger `place-service?category=STAY` fallback whenever filtered stays `< minThreshold`. |
| **Single-Area vs Multi-Area Hotels** | Recommend 3–5 hotels inside a 2-day single-city itinerary or 0 hotels. | **Adopted UX Rule**: For trips ≥ 2 days in 1 area → **exactly 1 grounded `STAY` venue** (check-in Day 1 ~`14:00`, check-out last day `11:00–12:00`), surfaced as a clean **"Nơi lưu trú chính" highlight card** at the top of `ItineraryPreview` (users can click *"Đổi khách sạn khác"* anytime). Multi-area trips → max 1 stay per overnight area. 1-day trips → no stay unless requested. |
| **Manual Items vs Full Replace** | Silently overwrite vs merge manually added items during `REPLACE_TRIP_ITEMS`. | Merging arbitrary old manual items into a newly generated full-day timeline causes time overlaps and geographic zig-zagging. **Decision**: `REPLACE_TRIP_ITEMS` / `REPLACE_DAYS` cleanly replaces all stops within the replaced day scope, while leaving untouched days (in `REPLACE_DAYS`) and single-item edits completely intact. |
| **Public `/itinerary/batch`** | Re-enable `POST /api/trips/{tripId}/itinerary/batch`. | **Rejected.** Preserves the existing fail-closed security boundary (`503`). Public single-day REST APIs + HMAC-protected `/internal/ai/itinerary-commits` cover 100% of use cases securely. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: `services/trip-service` Granular APIs & Atomic AI Commit Replace
- [x] **1.1**: Add `targetDayId` & `clearPlaceRef` to `UpdateItineraryItemRequest` (backward-compatible constructors) and implement cross-day move + snapshot clearing in `TripServiceImpl.updateItem()`.
- [x] **1.2**: Add `ReplaceDayItemsRequest`, `SwapDaysRequest`, `ItineraryItemRepository` bulk-delete/dedupe queries, and implement `replaceDayItems`, `clearDayItems`, `swapDays` in `TripService` / `TripServiceImpl` / `TripController`.
- [x] **1.3**: Extend `AiItineraryCommitRequest` (`REPLACE_DAYS`, `REPLACE_TRIP_ITEMS`, `replaceDayNumbers`) and `AiItineraryCommitServiceImpl`: atomic replace, same-day `placeRef` dedupe on `ADD_TO_TRIP`, `@CacheEvict`, `publicationRevision++`, and `collaborationChangeService.record(...)` for SSE realtime sync.
- [x] **1.4**: Add unit/integration tests in `TripServiceTest` & `AiItineraryCommitServiceTest` (run against isolated disposable PostgreSQL DB `tripsense_trip_test_verify`, dropped immediately after — **26/26 passed**).

### Phase 2: `services/ai-service` Tools, Strict `STAY` Grounding & Runtime Sync
- [x] **2.1**: Fix `place-grounding.ts` `prepareTripCandidates` to strictly filter `STAY` candidates (`isStayCandidate`) and force `place-service?category=STAY` fallback when filtered stays `< minThreshold`.
- [x] **2.2**: Fix `chat.ts` `fetchTripSummary` to return `days` and `revision` so `planningRuntime.hasTripItems` and `planningRuntime.tripRevision` are accurate from turn start.
- [x] **2.3**: Upgrade `create-trip-proposal.ts` (`commitMode` + deterministic replace guard `resolveProposalCommitAction` when `hasTripItems === true`, fix `parseTimes` to support single times like `"12:30"`).
- [x] **2.4**: Upgrade `itinerary-management.ts`: add `replaceDayItinerary`, `manageItineraryDays` (`CLEAR_DAY`/`SWAP_DAYS`), `updateTripDetails`; enhance `updateItineraryItem` (`targetDayNumber`, `clearTimes`, single-time support), `replaceItineraryItem` (`clearPlaceRef: true`), and keep `runtime.tripRevision` synced across all mutation tools.
- [x] **2.5**: Update `prompts.ts` with crisp 4-tier tool-routing rules (Create vs Full Replace vs Day Replace vs Single-Item Edit vs Trip Duration) and the **1 grounded hotel per overnight area for trips ≥ 2 days** rule.
- [x] **2.6**: Update & expand `itinerary-management.test.ts` and `place-grounding.test.ts` (**71/71 passed**, `tsc --noEmit` clean).

### Phase 3: `apps/web/tripsense` AI Chat Stay Display, Tool Sync & `PlaceCards` Fix
- [x] **3.1**: Enhance `ItineraryPreview` (`itinerary-preview.tsx`): render an **Accommodation / Nơi lưu trú** highlight card at the top when the proposal contains `STAY` stop(s), plus semantic category badges (`Khách sạn`, `Ẩm thực`, `Cà phê`, `Tham quan`, `Biển`) on activity rows.
- [x] **3.2**: Update `message.tsx` & `shell.tsx`: register new mutating tools (`replaceDayItinerary`, `manageItineraryDays`, `updateTripDetails`) in `ITINERARY_MUTATING_TOOLS` (with `activeTrip` refresh on `updateTripDetails`) and `ActiveAgentStatus`; suppress duplicate raw `fallbackSearchPlaces` carousel when `hasProposalInMessage` is true; render compact confirmation pills for completed granular mutation tools.
- [x] **3.3**: Fix `place-cards.tsx`: pass `placeRef: place.id` (`placeId` only when UUID), infer `HOTEL`/`MEAL`/`PLACE`, support day selection for multi-day trips, dispatch `tripsense:itinerary-updated`, and sanitize errors via `getSafeErrorMessage`.
- [x] **3.4**: Add EN/VI keys in `en.json` & `vi.json` (`i18n:sort` + `i18n:check` passed) and expand unit tests (`itinerary-preview.test.tsx`, `message-recommend-places.test.tsx`, `place-cards.test.tsx`).

### Verification Results (2026-11-25)
- `services/trip-service`: `mvn -B test -Dtest="AiItineraryCommitServiceTest,TripServiceTest"` against disposable DB `tripsense_trip_test_verify` (dropped via `EXIT` trap) → **26/26 passed** (21 `TripServiceTest` + 5 `AiItineraryCommitServiceTest`).
- `services/ai-service`: `npm test && npx tsc --noEmit` → **71/71 passed**, 0 TypeScript errors.
- `apps/web/tripsense`:
  - `npm run i18n:sort && npm run i18n:check` → **passed** (EN/VI exact parity, A→Z sorted).
  - `npm run type-check` → **passed** (0 errors).
  - `npx eslint` on modified files → **0 errors**.
  - `npx vitest run src/components/chat/ src/features/trip-management/` → **28/28 files, 134/134 tests passed**.
  - `npm run build` → **passed** (compiled + 48/48 static pages generated).

---

## Completion Status

```text
STATUS: DONE
```
