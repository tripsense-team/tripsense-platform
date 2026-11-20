# Mindtrip Trip Detail Redesign, Unified Itinerary Panel & Time Ordering — Specification & Implementation Plan

`STATUS: DONE`

- **Human Approval**: Approved by user on 2026-11-20 (`"Tiến hành implements"`).

- **Owner Service**: `apps/web/tripsense` (UI & shared itinerary workspace), `services/trip-service` (itinerary reorder/time persistence), `services/ai-service` (AI reorder tool)
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/ai-service`
- **Created Date**: 2026-11-20
- **Target PR Boundaries**:
  - Phase 1: `trip-service` `preserveTimes` reorder option & `ai-service` `reorderItineraryItems` tool
  - Phase 2: Shared Mindtrip Itinerary Panel component (photo cards, distances toggle, inline time editor, drag-and-drop & sort-by-time)
  - Phase 3: `/trips/[tripId]` Overview & Itinerary split-view redesign (matching Mindtrip reference)
  - Phase 4: AI Chat `TripDetailPanel` integration, EN/VI i18n parity, and verification

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Audit of the current TripSense web UI and codebase reveals three UX and functional gaps compared to the target Mindtrip reference designs:

1. **Trip Detail Overview (`/trips/[tripId]` — [trip-detail-screen.tsx](../../apps/web/tripsense/src/features/trip-management/components/trip-detail-screen.tsx)) feels cluttered and inconsistent**:
   - The top header duplicates the trip title (`Trip to Đà Nẵng`) already rendered in the left column and crowds action buttons.
   - Trip metadata (`destination`, `dates`, `travelers`, `budget`) uses 4 separated chips rather than a cohesive segmented Mindtrip pill bar with direct click-to-edit modals.
   - The AI suggestion area is boxed inside a dense card with cramped prompt pills instead of Mindtrip's clean, borderless editorial block (`Sparkles` icon, `< 1 of 3 >` pager, thumbnail preview, `Shape the days` / `Dismiss` buttons).
   - The `Chats` list auto-expands the first session and dumps raw unrendered markdown (`**Chuyến đi Đà Nẵng 3 ngày**`) inside a grey scrollable box instead of rendering clean clickable chat cards that open `/ai-planner/[sessionId]?tripId=[tripId]`.
   - The bottom chat composer is a thin single-row bar instead of a spacious 2-row rounded-2xl composer card.
   - Map markers in `trip-detail-screen.tsx` inject hardcoded fake ratings (`rating: 4.8`, `userRatingCount: 120`).

2. **Trip Detail Itinerary View (`/trips/[tripId]` → clicking `Lịch trình`) is disconnected from the polished Mindtrip design**:
   - Clicking `Lịch trình` renders a squeezed 2-column sub-grid inside the right pane with text-only rows (no place thumbnails, no category icons, no collapsible `Ideas` section with `+ Add` tile, no `Distances` toggle or timeline distance connectors, no `Book` CTA, and no reorder controls).
   - Meanwhile, AI Chat's [trip-detail-panel.tsx](../../apps/web/tripsense/src/components/chat/trip-detail-panel.tsx) already implements Mindtrip-style photo cards and distance connectors, causing UI duplication and drift between `/trips/[tripId]` and `/ai-planner`.

3. **Missing Time Scheduling & Reordering in AI Chat and Trip Detail**:
   - `TripDetailPanel` in AI Chat only imports `deleteItineraryItem` — it has **no UI** to edit `startTime`/`endTime`, **no UI** to drag-and-drop or move stops up/down, and **no UI** to sort stops chronologically by time.
   - `TripDetailScreen` declares `onMoveItem` and `onReorderItems` in its prop type, but never destructures or renders any controls for them.
   - `TripManagementView` calls `chainItineraryResponse(nextItinerary)` on initial load, silently overwriting explicit time gaps (e.g. `09:00–11:00` followed by `13:00–15:00`) on the client.
   - `TripServiceImpl.reorderItems()` unconditionally chains item times via `applyStartKeepingDuration()`, which overwrites user-chosen `startTime`/`endTime` whenever items are sorted chronologically.
   - `services/ai-service/src/ai/tools/itinerary-management.ts` exposes `add`, `get`, `remove`, `update`, and `replace` tools, but lacks a `reorderItineraryItems` tool for conversational reordering/time sorting.

### 1.2 User Flows & Journey

1. **Trip Detail Overview (`/trips/[tripId]`)**:
   - User clicks a trip in *Chuyến đi của tôi* (`/trips`) → opens `/trips/[tripId]`.
   - Left pane displays clean Mindtrip editorial overview: large bold title, clickable segmented metadata pill bar (`Destination | Duration/Dates | Travelers | Budget`), borderless AI coach tip with `< 1 of 3 >` navigation, destination/place preview thumbnail(s), `Shape the days` / `Dismiss` pills, clean clickable `Chats` cards (clicking navigates to `/ai-planner/[chatId]?tripId=[tripId]`), and a spacious 2-row bottom composer to start a new AI chat for this trip.
   - Right pane displays the 2×3 Mindtrip action cards (`Ideas`, `Itinerary [N]`, `Bookings`, `Media`, `Trip preferences [N]`, `Calendar [N]`) above the clean rounded-2xl `MapVinaContainer`.
2. **Opening Itinerary inside Trip Detail (`/trips/[tripId]` → click `Lịch trình` / `Itinerary`)**:
   - Left pane stays visible (Trip Overview + Chats + Composer); right pane smoothly transitions to the full-width **Mindtrip Itinerary Panel** (with `×` close back to overview, collapse/expand, and map preview toggle in its top bar).
   - Displays collapsible `Ideas` strip with `+ Add` tile, `Itinerary · X ngày` header with **`Distances` toggle switch** (`Khoảng cách`) and `...` itinerary menu (`Sort all days by time`, `Export`), and collapsible Day accordions (`Day 1 ...`).
   - Each scheduled stop renders as a Mindtrip card: square rounded-xl place photo, category icon, bold title, clickable clock time range (`9:00 – 11:00`), context-aware `Book` pill button (for bookable hotel/restaurant/rental items), drag handle, and `...` action menu.
   - Between adjacent stops (when `Distances` is ON), a thin dashed vertical timeline shows the Haversine distance (`km` in VI, `mi` or `km` localized).
3. **Editing Time & Ordering/Reordering (identical in BOTH `/trips/[tripId]` AND `/ai-planner`)**:
   - **Edit Time**: User clicks the clock badge (`9:00 – 11:00` or `Set time`) on any stop card → inline popover opens with `startTime` / `endTime` (`HH:mm` 24h selector/input) and optional quick duration presets (`+30m`, `+1h`, `+2h`) → saves via `PATCH /api/trips/{tripId}/itinerary/items/{itemId}`.
   - **Manual Reorder**: User drags a stop card by its handle (or clicks Move Up / Move Down in card actions) within a day → optimistic UI update + `PUT /api/trips/{tripId}/itinerary/days/{dayId}/items/reorder` with `preserveTimes: true` (preserving explicit timestamps unless user chooses `Auto-chain times`).
   - **Sort by Time**: User clicks `Sort by time` (`Sắp xếp theo giờ`) on a day header (or for all days in the `...` menu) → sorts items chronologically by `startTime` ascending (items without `startTime` stay at the bottom in relative order) and persists via `PUT .../reorder` with `preserveTimes: true`.
   - **Conversational AI Reorder**: In `/ai-planner`, user asks *"Sắp xếp lại Ngày 1 theo khung giờ"* or *"Đưa quán cafe lên trước Ngũ Hành Sơn"* → AI invokes `reorderItineraryItems` tool → `trip-service` persists new order → `tripsense:itinerary-updated` refreshes the right panel immediately.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Mindtrip-style redesign of `/trips/[tripId]` Overview (`trip-detail-screen.tsx`) and unified Itinerary view.
  - Shared Mindtrip Itinerary Panel component reused by both `/trips/[tripId]` and `/ai-planner` (`TripDetailPanel`), including `Ideas` + `+ Add`, `Distances` toggle, day accordions, photo resolution, `Book` CTA, inline time editor, drag-and-drop & Up/Down reorder, and chronological `Sort by time`.
  - Backward-compatible `preserveTimes` flag on `trip-service` `PUT /api/trips/{tripId}/itinerary/days/{dayId}/items/reorder`.
  - New `reorderItineraryItems` AI tool in `services/ai-service`.
  - Removal of destructive client-side `chainItineraryResponse()` on initial load and removal of fake `rating: 4.8` map markers in `trip-detail-screen.tsx`.
  - Full EN/VI i18n parity (`en.json` & `vi.json`), tweakcn semantic CSS tokens (zero hardcoded colors), and read-only enforcement for `VIEWER` collaborators.
- **Out-of-Scope**:
  - Database schema changes or Flyway migrations (all required columns already exist).
  - Cross-day drag-and-drop (moving items between different days in a single drag gesture; users can add/edit day separately in a future phase).
  - Real-time voice-to-text speech recognition inside the bottom composer (existing mic icon remains a non-blocking affordance or omitted if unused).
  - Rewriting the `Bookings`, `Media`, or `Calendar` standalone pages (existing routes/modals remain wired cleanly).

### 1.4 Acceptance Criteria

- [ ] **AC-1**: `/trips/[tripId]` renders the clean Mindtrip Overview layout (no duplicate title in top bar, segmented metadata bar, borderless AI coach with `< 1 of 3 >` pager, clean clickable Chat cards without raw markdown boxes, 2-row rounded-2xl composer, 2×3 action tiles, clean map without fake `4.8` ratings).
- [ ] **AC-2**: Clicking `Lịch trình` (`Itinerary`) on `/trips/[tripId]` opens the Mindtrip Itinerary view in the right pane matching the target design (`Ideas` + `+ Add`, `Itinerary · X ngày` + `Distances` toggle, collapsible day sections, photo cards with category icon + time + `Book` pill + dashed distance connector), while keeping the Trip Overview on the left pane.
- [ ] **AC-3**: Both `/trips/[tripId]` and `/ai-planner` (`TripDetailPanel`) render the same shared Mindtrip Itinerary list component so design and behavior stay consistent.
- [ ] **AC-4**: Users with edit permissions (`canEdit !== false`) can click any stop's time badge in **both** `/trips/[tripId]` and `/ai-planner` to set/edit `startTime` and `endTime` (`HH:mm`), with inline validation rejecting `endTime <= startTime` and persisting via `PATCH /api/trips/{tripId}/itinerary/items/{itemId}`.
- [ ] **AC-5**: Users with edit permissions can reorder stops within a day via drag-and-drop or Move Up / Move Down controls in **both** `/trips/[tripId]` and `/ai-planner`, persisting via `PUT /api/trips/{tripId}/itinerary/days/{dayId}/items/reorder`.
- [ ] **AC-6**: Clicking `Sort by time` on a day (or across all days) orders stops chronologically by `startTime` (unscheduled items last) and persists via `reorder` with `preserveTimes: true`, **without overwriting** users' explicit `startTime`/`endTime` values.
- [ ] **AC-7**: Toggling `Distances` (`Khoảng cách`) shows/hides the dashed distance connectors between consecutive stops.
- [ ] **AC-8**: In `/ai-planner`, AI Assistant can invoke `reorderItineraryItems` (either explicit `orderedItemIds` or `sortByTime: true`) and the right `TripDetailPanel` refreshes automatically when the turn completes.
- [ ] **AC-9**: `VIEWER` collaborators (`capabilities.canEdit === false`) see read-only itinerary cards with no drag handles, no time edit popover, no reorder/sort/delete controls; backend still enforces `403 Forbidden`.
- [ ] **AC-10**: On `409 Conflict` (stale `version` or `expectedTripRevision`), UI safely refetches the latest itinerary and shows a localized safe error toast (`getSafeErrorMessage`) with zero raw backend errors.
- [ ] **AC-11**: Zero hardcoded hex colors; dark & light themes use semantic tokens; `npm run i18n:check`, `npm run type-check`, `npm run lint`, `npm test` (web + ai-service), and `mvn test -pl services/trip-service` all pass.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Next.js Web: /trips/[tripId] & /ai-planner]
   │  (Shared MindtripItineraryPanel)
   │
   ├── GET    /api/trips/{tripId}/itinerary
   ├── PATCH  /api/trips/{tripId}/itinerary/items/{itemId}              (edit startTime / endTime)
   ├── PUT    /api/trips/{tripId}/itinerary/days/{dayId}/items/reorder  (drag reorder / sort by time, preserveTimes)
   ├── POST   /api/trips/{tripId}/itinerary/days/{dayId}/items          (+ Add stop / idea)
   ├── DELETE /api/trips/{tripId}/itinerary/items/{itemId}
   ├── POST   /api/places/batch-snapshots                               (place thumbnail photos)
   └── POST   /api/ai/chat (SSE)
                  │
                  ▼
       [API Gateway (:8080)] ──► [trip-service (:8084)] ──► PostgreSQL (tripsense_trip)
                  │                    ▲                           │
                  │                    │ (Bearer JWT forwarded)    ▼ SSE Collaboration Event
                  ▼                    │                     (ITEM_UPDATED / ITEM_REORDERED)
            [ai-service (:8089)] ──────┘
              (tool: reorderItineraryItems / updateItineraryItem)
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Mindtrip Trip Overview, shared `MindtripItineraryPanel`, inline time editor, DnD/Up-Down reorder, sort-by-time, photo resolution, i18n | Sync REST + SSE via API Gateway (`apiClient`) |
| `services/api-gateway` | Existing routing (`/api/trips/**`, `/api/places/**`, `/api/ai/**`), JWT verification, rate limiting (no route changes needed) | Spring Cloud Gateway |
| `services/trip-service` | Owns `trips`, `itinerary_days`, `itinerary_items`, optimistic locking (`version`, `aggregateRevision`), time validation, reorder persistence, SSE collaboration events | Sync Spring Boot REST |
| `services/ai-service` | Conversational orchestration + new `reorderItineraryItems` tool delegating to `trip-service` using caller's JWT | Sync internal HTTP REST to `trip-service` |
| `services/place-service` | Read-only batch place photo/metadata lookup (`getPlaceBatchSnapshots`) — unchanged | Sync REST via Gateway |

### 2.3 Architecture Guardrails Verification

- [x] Public traffic goes through API Gateway (`apiClient` → `/api/**`).
- [x] Each service owns its own database; **no cross-service DB queries**.
- [x] **No cross-service JPA relationships** (IDs and snapshots only).
- [x] Synchronous REST used only for immediate user-driven itinerary edits/reorders; collaboration sync continues using existing SSE change stream.
- [x] Frontend adheres to `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md` and `docs/I18N_STANDARDS.md`.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints

| Method | Gateway Path | Service Internal Path | Auth Required | Change |
| --- | --- | --- | --- | --- |
| `PUT` | `/api/trips/{tripId}/itinerary/days/{dayId}/items/reorder` | `/api/trips/{tripId}/itinerary/days/{dayId}/items/reorder` | `Bearer JWT` (`OWNER`/`EDITOR`) | Add optional `preserveTimes` boolean (default `false` for backward compatibility) |
| `PATCH` | `/api/trips/{tripId}/itinerary/items/{itemId}` | `/api/trips/{tripId}/itinerary/items/{itemId}` | `Bearer JWT` (`OWNER`/`EDITOR`) | Add optional `clearTimes` boolean (default `false`) so users can explicitly clear a stop's scheduled time if needed |
| `POST` | `/api/trips/{tripId}/itinerary/days/{dayId}/items` | `/api/trips/{tripId}/itinerary/days/{dayId}/items` | `Bearer JWT` (`OWNER`/`EDITOR`) | Existing, unchanged |
| `DELETE` | `/api/trips/{tripId}/itinerary/items/{itemId}` | `/api/trips/{tripId}/itinerary/items/{itemId}` | `Bearer JWT` (`OWNER`/`EDITOR`) | Existing, unchanged |
| `GET` | `/api/trips/{tripId}/itinerary` | `/api/trips/{tripId}/itinerary` | `Bearer JWT` (Trip member) | Existing, unchanged |

#### Updated Request DTOs

```json
// PUT /api/trips/{tripId}/itinerary/days/{dayId}/items/reorder
{
  "orderedItemIds": ["uuid-1", "uuid-2", "uuid-3"],
  "version": 4,
  "expectedTripRevision": 12,
  "preserveTimes": true
}
```

- **Behavior in `TripServiceImpl.reorderItems`**:
  - When `Boolean.TRUE.equals(request.preserveTimes())`: updates `sortOrder = (i + 1) * SORT_ORDER_STEP` for every item while **keeping each item's existing `startTime`, `endTime`, and `durationMinutes` untouched**.
  - When `preserveTimes` is `null` or `false`: retains existing duration-chaining behavior (`applyStartKeepingDuration`) so all existing callers and tests stay 100% backward compatible.

```json
// PATCH /api/trips/{tripId}/itinerary/items/{itemId}
{
  "startTime": "09:00",
  "endTime": "11:00",
  "durationMinutes": 120,
  "clearTimes": false,
  "version": 2,
  "expectedTripRevision": 12
}
```

- **Behavior in `TripServiceImpl.updateItem`**:
  - When `Boolean.TRUE.equals(request.clearTimes())`: sets `startTime = null`, `endTime = null`, `durationMinutes = null`.
  - Otherwise: validates `validateTimeRange(nextStart, nextEnd)` and computes `durationMinutes` via existing `resolveDurationMinutes(...)`.

### 3.2 AI Service Tool Contract (`services/ai-service`)

New tool in `services/ai-service/src/ai/tools/itinerary-management.ts`:

```ts
export const reorderItineraryItemsSchema = z.object({
  dayNumber: z.number().int().min(1).max(365),
  orderedItemIds: z.array(z.string().min(1)).optional(),
  sortByTime: z.boolean().optional().default(false),
  preserveTimes: z.boolean().optional().default(true),
  tripId: z.string().optional(),
});
```

- Fetches current itinerary from `trip-service` (`GET /api/trips/{targetTripId}/itinerary`) to obtain authoritative `day.id`, `day.version`, `tripRevision`, and current `day.items`.
- If `sortByTime` is `true`, deterministically sorts `day.items` by `startTime` ascending (nulls last, tie-breaking by `sortOrder`), then calls `PUT /api/trips/{targetTripId}/itinerary/days/{dayId}/items/reorder` with `{ orderedItemIds, version: day.version, expectedTripRevision, preserveTimes }`.
- If `orderedItemIds` is provided, verifies exact membership against `day.items` (returns clean tool error if IDs are stale/mismatched) before calling `trip-service`.
- Updates `context.runtime.tripRevision` on success so subsequent tool calls in the same turn remain revision-consistent.

### 3.3 Collaboration & Client Events

- Existing `trip-service` `CollaborationChangeType.ITEM_UPDATED` and `ITEM_REORDERED` SSE events continue to fire automatically on both edits and reorders.
- Frontend dispatches existing `tripsense:itinerary-updated` window event after mutations in `TripDetailPanel` or AI tool turns so all open views stay synchronized.

---

## 4. Data Model & Migrations

- **No database schema changes or Flyway migrations are required.**
- Existing `tripsense_trip.itinerary_items` columns (`id`, `day_id`, `sort_order`, `start_time`, `end_time`, `duration_minutes`, `version`) and `itinerary_days.version` / `trips.aggregate_revision` already persist order and timestamps with optimistic locking.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authentication** | All browser calls go through API Gateway with user JWT. `ai-service` forwards the user's own `Authorization` header to `trip-service` — never uses a privileged bypass key for user mutations. |
| **Authorization / Anti-IDOR** | `trip-service` enforces `getEditableTrip(userId, tripId)` (`OWNER` / `EDITOR` only) on `updateItem` and `reorderItems`. Frontend checks `itinerary?.capabilities?.canEdit !== false` to hide/disable editing and drag handles for `VIEWER`s. |
| **Input Validation** | Strict `HH:mm` format check and `endTime > startTime` validation on both frontend and `TripServiceImpl.validateTimeRange`. `reorderItems` enforces exact bijection between `orderedItemIds` and current day items. |
| **XSS / Zero-Leak Error Handling** | Chat cards in `/trips/[tripId]` render plain escaped titles/dates (removing inline raw markdown dump). All API errors pass through `apiClient` + `getSafeErrorMessage(err)`; zero raw server traces in UI or toasts. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Preserving vs Chaining Times** | Currently `TripServiceImpl.reorderItems()` always chains times back-to-back, and `TripManagementView` runs `chainItineraryResponse()` on every load, silently erasing deliberate gaps (e.g. `11:00 → 11:30` rest time). | Add `preserveTimes` (default `false` on API for backward compatibility; UI sends `true` for manual reorder & `Sort by time`, and offers explicit `Auto-chain times` action sending `false`). Remove destructive `chainItineraryResponse()` on initial load in `TripManagementView`. |
| **Concurrency (`409 Conflict`)** | User drags a card or edits time in `TripDetailPanel` while AI finishes a streaming mutation or a collaborator edits the same day. | Send `day.version` + `itinerary.revision` (or `item.version`). On `409 Conflict`, automatically refetch `getItinerary(tripId)` and display a safe localized toast prompting retry (or single retry on reorder, matching `trip-management-view.tsx`). |
| **DnD Dependency vs Native** | Adding `@dnd-kit/*` introduces new bundle weight and package churn right before presentation. | Use zero-dependency HTML5 native Drag & Drop (`draggable`, drop indicator line) **paired with accessible Move Up / Move Down buttons and `Sort by time`** so keyboard, trackpad, and touch users all have full reorder capability with zero added dependencies. |
| **Photo Fetching N+1** | `/trips/[tripId]` previously rendered no photos on itinerary cards; naively calling `searchPlaces` per card causes slow N+1 requests. | Reuse the batched photo loader (`getPlaceBatchSnapshots` first + `knownPlacePhotos` cache + bounded-concurrency `searchPlaces` fallback with `AbortController`) extracted into a shared hook `useItineraryPlacePhotos`. |
| **Theme Fidelity vs Mindtrip Reference** | Reference screenshots are light-mode white/black; hardcoding `#fff`/`#000` breaks dark mode and violates `web-ui-component-patterns`. | Map every Mindtrip surface to semantic tweakcn tokens (`bg-background`, `bg-card`, `bg-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-foreground text-background` for high-contrast pills like `Book` and Sparkles badge). |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend & AI Tool Time/Reorder Support
- [x] **Task 1.1 (`trip-service`)**: Add optional `Boolean preserveTimes` to `ReorderItemsRequest` (keep 2-arg and 3-arg constructors for backward compatibility) and respect it in `TripServiceImpl.reorderItems()`.
- [x] **Task 1.2 (`trip-service`)**: Add optional `Boolean clearTimes` to `UpdateItineraryItemRequest` and handle it cleanly in `TripServiceImpl.updateItem()`.
- [x] **Task 1.3 (`trip-service` tests)**: Add unit tests in `TripServiceTest` verifying `preserveTimes=true` keeps explicit `startTime`/`endTime` while updating `sortOrder`, `preserveTimes=false/null` retains chaining, and `clearTimes=true` clears scheduled times.
- [x] **Task 1.4 (`ai-service`)**: Add `reorderItineraryItems` tool to `services/ai-service/src/ai/tools/itinerary-management.ts`, update AI system prompt/tool descriptions, and add unit tests in `itinerary-management.test.ts`.

### Phase 2: Shared Mindtrip Itinerary Component & Time/Order Controls
- [x] **Task 2.1**: Extract shared hook `useItineraryPlacePhotos` (`apps/web/tripsense/src/features/trip-management/hooks/use-itinerary-place-photos.ts`) from `trip-detail-panel.tsx`.
- [x] **Task 2.2**: Create shared `MindtripItineraryView` (`apps/web/tripsense/src/features/trip-management/components/mindtrip-itinerary-view.tsx`) matching Reference Image 3:
  - Collapsible `Ideas` strip + `+ Add` rounded-2xl card
  - `Itinerary · X ngày` header + `Distances` toggle switch + `...` itinerary menu (`Sort all days by time`, `Auto-chain times`)
  - Collapsible Day sections with theme/date + per-day `+ Add` and `Sort by time` button
  - Mindtrip stop cards: square rounded-xl thumbnail, category icon, title, clickable inline **Time Editor Popover** (`startTime`, `endTime`, presets, clear, validation), context-aware `Book` pill CTA, drag handle (`draggable` + drop indicator), and `...` menu (`Edit time`, `Move up`, `Move down`, `View place details`, `Locate on map`, `Google Maps`, `Remove`)
  - Dashed vertical timeline distance connector (toggled by `Distances`, localized `km` / `mi`).
  - Read-only mode when `canEdit === false`.
- [x] **Task 2.3**: Update `apps/web/tripsense/src/features/trip-management/types/index.ts` and `trip-management-api.ts` for `preserveTimes` and `clearTimes`.

### Phase 3: Redesign `/trips/[tripId]` Overview & Itinerary Split-View
- [x] **Task 3.1**: Redesign `TripDetailScreen` (`trip-detail-screen.tsx`) to match Reference Images 2 & 3:
  - Clean minimal top bar (circular `<` back button left; Invite, Export, Edit, `...` right — no duplicate title).
  - Left pane: bold `Trip to ...` title, cohesive segmented metadata pill bar (clicking opens edit dialog), borderless editorial AI Coach section with `< 1 of 3 >` carousel, place preview thumbnails, `Shape the days` / `Dismiss` buttons, clean clickable `Chats` cards (no inline raw markdown preview; capped with `Show all` toggle when > 5), and spacious 2-row rounded-2xl bottom composer.
  - Right pane (Overview mode): crisp 2×3 Mindtrip action cards with accurate counts (`Itinerary`, `Calendar`, `Trip preferences`, etc.) + clean `MapVinaContainer` (removed fake `rating: 4.8` on markers).
  - Right pane (Itinerary mode): renders shared `MindtripItineraryView` full-width in right pane with `×` close + map toggle, wired directly to `TripManagementView` handlers (`onAddItem`, `onUpdateItemTime`, `onReorderItems`, `onSortAllDaysByTime`, `onDeleteItem`).
- [x] **Task 3.2**: Update `TripManagementView` (`trip-management-view.tsx`) to stop calling `chainItineraryResponse()` on initial load, pass `preserveTimes` through `handleReorderItems`, and add direct inline time-update + sort-by-time handlers with `409` conflict recovery.

### Phase 4: AI Chat `TripDetailPanel` Integration, i18n & Verification
- [x] **Task 4.1**: Refactor `TripDetailPanel` (`apps/web/tripsense/src/components/chat/trip-detail-panel.tsx`) `itinerary` tab to use shared `MindtripItineraryView`, wiring `updateItineraryItem`, `reorderItineraryItems` (`preserveTimes: true`), `handleSortAllDaysByTime`, and `+ Add` item dialog directly inside AI Chat; registered `reorderItineraryItems` in `ITINERARY_MUTATING_TOOLS` inside `shell.tsx`.
- [x] **Task 4.2**: Added all new EN & VI translation keys in `apps/web/tripsense/src/locales/en.json` and `vi.json` with 100% key parity and A–Z sorting.
- [x] **Task 4.3**: Updated `trip-detail-panel.test.tsx` and added `mindtrip-itinerary-view.test.tsx` and `time.test.ts`.

### Verification Results (2026-11-20)

- `services/trip-service`: `TripServiceTest` (against isolated disposable PostgreSQL DB `tripsense_trip_test_verify`, dropped immediately after) → **17/17 PASSED (`BUILD SUCCESS`)**.
- `services/ai-service`: `npm test` (`tsc` + `node --test`) → **67/67 PASSED**.
- `apps/web/tripsense`:
  - `npm run i18n:check` → **PASSED** (100% EN/VI parity & A–Z order).
  - `npm run type-check` → **PASSED** (0 errors).
  - `npx eslint` on all modified/created files → **0 errors**.
  - Targeted unit tests (`trip-detail-panel.test.tsx`, `mindtrip-itinerary-view.test.tsx`, `time.test.ts`) → **13/13 PASSED**. Full suite: **111/112 files (534 tests) PASSED** (only unrelated pre-existing `reservation-review-and-status.test.tsx` Node `--localstorage-file` environment failure).
  - `npm run build` (`next build --webpack`) → **PASSED** (48/48 static pages + all dynamic routes compiled cleanly).

---

## Status

```text
STATUS: DONE
```
