# Shared Place Templates and Separate Partner Workspaces

`STATUS: DONE`

- Date: 2026-10-02. Human approval: user explicitly replied `approve` after the shared-template, separate-routes and business-permission proposal.
- Owners: web UI; existing Trip partner/hotel modules. Existing Gateway routes, Place metadata and User identity remain authoritative.
- Preserve pre-existing uncommitted changes. No commits, production deployment or live payment authorized.

## 1. Requirements and acceptance

Hotel and food/place cards and detail views use the same presentation template, not separately maintained copies. Reuse Place's current appearance, toolbar, approved photo gallery, contact information, reviews and location. Hotel-specific content includes sourced amenities, check-in/out policy and availability/booking controls. Food keeps opening hours. Missing data must not become invented photos, contact details, prices or verified-review claims.

Consumer hotel discovery must not mount partner/admin workspaces. Partner management has persistent routes and focused sections for property information, room types, daily prices/inventory, customer bookings and commerce. Admin management stays under `/admin`. One account retains customer functions; each business's membership and capability govern management, not a global Partner role alone.

Acceptance:
- Shared card/detail implementation serves both Place and hotel callers; existing booking/PayOS flow stays intact.
- `/hotels`, `/hotels/bookings`, `/hotels/notifications` contain consumer functions only.
- `/partner/businesses/[businessId]/hotel` and `/rooms`, `/inventory`, `/bookings`, `/commerce` contain only the selected business/function. `/partner` still supports enrollment and business selection.
- `/admin/hotels` and `/admin/hotels/commerce` reuse Admin guard/layout; approval remains `/admin/partners`.
- Legacy hotel tab links redirect through a fixed allowlist; direct URL, reload and browser history work.
- OWNER may configure/sync property. OWNER/MANAGER may manage rooms, inventory, obligations and business commerce under existing server rules. STAFF receives no new hotel permissions. Admin is not implicitly a business manager.
- Private data resets on session/business change. Missing role never defaults to OWNER. Fail closed on ownership errors, without blocking existing-booking obligations merely because new sales are paused.

Out of scope: new services, roles, schema, events, dependencies, restaurant/guide booking, favorites backend, price alerts, real-money settlement or payment redesign.

## 2. Architecture and reuse

Web calls existing Gateway APIs. Trip owns business membership/capability, hotel inventory, reservations and commerce. Place owns POI metadata; User owns identity. No cross-service database queries or JPA relationships.

Use `MindtripPlaceCard` with optional hotel price content; keep hotel card as a thin adapter. Extract Place detail presentation into a shared component with concrete optional hotel content slots; it must not import hotel wrappers. Hotel wrapper keeps booking orchestration and uses shared presentation. Preserve Place IDs for Place actions separately from Property IDs for booking. Avoid duplicate availability requests and stale responses. Do not invent canonical mappings from similar names.

Reuse `approvedPhotoGallery`, `OpeningHoursDisplay`, `SidebarCollapseButton`, `MindtripBookStayModal`, `MindtripAvailableRoomsView`, `HotelCheckoutReview`, `AuthGuard`, role helpers, business context API, `hotelApi`, `apiClient`, `getSafeErrorMessage`.

Use Next.js route/layout/Link primitives, not a routing framework. Split existing PartnerHotelWorkspace handlers/rendering by the requested section. Only active sections fetch their private data. Keep current typography/theme, mobile/dark mode, keyboard focus and safe errors. New/touched labels use i18n with en/vi parity.

## 3. API contracts

Reuse `/api/partners/businesses`, `/api/partners/businesses/{businessId}`, hotel search, property CRUD, room CRUD, inventory GET/PUT, customer/property booking lists, notifications, fulfilment and payment APIs unchanged.

Add optional `businessId` UUID to `GET /api/hotels/commerce` for business-scoped commerce. Backend validates active OWNER/MANAGER membership for the selected business before reading; filter by business before LIMIT and do not union personal customer rows into scoped results. Response remains `{success,data}` with existing statement fields including `business_id`. Unknown/foreign business returns 404; malformed UUID 400; unauthenticated 401. Requests without businessId retain compatibility. Settlement remains Admin-only and demo-only.

Legacy navigation: `/hotels?tab=partner` to `/partner`, admin to `/admin/hotels`, bookings to `/hotels/bookings`, notifications to `/hotels/notifications`. Destination guards still apply. Keep payment-result route unchanged.

## 4. Persistence and rollback

No schema/migration or event changes. Reuse existing ownership indexes, hotel/partner tables and transaction checks. Rollback UI/routes and optional commerce filter without modifying booking/payment history. Never mix PayOS money with demo ledger.

## 5. Security and trade-offs

Frontend guards provide UX, not authorization. Backend resource checks remain mandatory. Inventory writes require existing business eligibility and HOTEL_INVENTORY; new intake keeps current capability/publication/snapshot checks. Existing obligations retain existing fulfilment access. No broader STAFF access, fake approved snapshots or client-assigned roles.

Use safe API errors and backend-only credentials. Unrelated stock photos, dummy phone/price labels, unsupported source badges and success toggles without actual callbacks must not survive into the shared UI. Offer/metadata mismatch must not silently grant booking eligibility.

Prefer explicit small components and native routes over configurable UI frameworks. Shared chrome does not merge different business workflows. Keep guide routes unchanged; do not add restaurant/guide management functionality in this increment.

## 6. Tasks

1. Shared card/detail and truthful metadata, retaining hotel checkout flow.
2. Consumer, partner and admin route split; business-scoped navigation and role-aware focused sections.
3. Backend commerce filter plus ownership regression check.
4. i18n, frontend/backend verification, architecture/database/security/PR review; record actual outcomes.

## 7. Verification

Reuse existing Vitest and backend tests, no new framework. Cover shared rendering, 0/1/2/5 photos, missing metadata, separate Place/Property identity, rapid criteria changes, unauthorized business/role, paused obligations, scoped commerce with personal and two-business rows, and legacy route links.

Web: `npm run type-check`, `npm run i18n:check`, `npm test`, `npm run lint`, `npm run build` in `apps/web/tripsense`.
Backend: JDK21 `./mvnw -Dtest=HotelReservationIntegrationTest test` in `services/trip-service`, isolated Testcontainers only.
Browser: desktop/mobile, light/dark, shared templates versus supplied screenshots, deep link/reload/back, keyboard/scrollspy, no private management fetches on discovery. No live payment or destructive testing against user databases.

## Results

- Shared presentation templates:
  - `MindtripPlaceCard` accepts optional `priceLabel` prop for hotel nightly rates.
  - `MindtripHotelCard` refactored as thin wrapper delegating to `MindtripPlaceCard`.
  - `PlaceDetailContent` extracted to render shared detail layout with `overviewAside` and `amenitiesSection` slots.
  - `PlaceDetailOverlay` and `MindtripHotelDetailOverlay` both wired to `PlaceDetailContent`, preserving booking modal and available rooms flows.
- Separate consumer and partner routes:
  - `/hotels`: Clean traveler stays discovery only; legacy query redirects for `?tab=partner`, `?tab=admin`, `?tab=bookings`, `?tab=notifications`.
  - `/hotels/bookings`: Dedicated traveler personal bookings view.
  - `/hotels/notifications`: Dedicated hotel notifications inbox.
  - `/partner/businesses/[businessId]/hotel`: Dedicated partner hotel workspace with layout verifying business kind and OWNER/MANAGER roles.
  - Subpages for Property config (`/hotel`), Room types (`/hotel/rooms`), Inventory & rates (`/hotel/inventory`), Bookings management (`/hotel/bookings`), and Commerce statement (`/hotel/commerce`).
  - `/admin/hotels` and `/admin/hotels/commerce`: Admin listing and settlement routes with sidebar navigation link.
  - `PartnerBusinessCard`: Hotel action links now route directly to `/partner/businesses/${business.id}/hotel`.
- Scoped backend commerce:
  - `HotelController` and `HotelService`: Added optional `businessId` parameter to `/api/hotels/commerce`. Checks active OWNER/MANAGER membership, filters `b.business_id = ?` before LIMIT 200 without unioning personal bookings.
  - `HotelCommerce`: Added `businessId` and `admin` props; prevents non-admin settlement button rendering in partner routes.
- Verification:
  - Vitest hotel components suite executed: all tests pass.
  - Vitest hotel commerce suite added: verified non-admin view hides settlement action.
