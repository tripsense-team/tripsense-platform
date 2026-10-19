# Partner Services Hub Navigation — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense` (presentation and navigation only)
- **Affected Components**: `apps/web/tripsense`; existing `services/trip-service` APIs are consumed unchanged
- **Date**: 2026-10-19
- **Related Features**: [Partner Onboarding & Business Approval](./partner-onboarding-and-business-approval.md), [Shared Place Templates and Partner Workspaces](./shared-place-templates-and-partner-workspaces.md)

## 1. Goal & Requirements

### 1.1 Goal

Add **“Quản lý Thực đơn & Dịch vụ”** beneath the Partner section in the sidebar. It opens a Partner services hub where a Partner can choose one of their businesses and continue to the existing management page for that kind. Reuse existing context API, business DTOs, components, routes and service APIs; do not create another CRUD implementation or backend endpoint.

### 1.2 User Flow

1. An authenticated Partner selects **Quản lý Thực đơn & Dịch vụ** in the sidebar.
2. Web opens `/partner/services` and loads the existing Partner context using `getPartnerContext()`.
3. The page presents the Partner's businesses with service actions appropriate to kind and existing capabilities:
   - `RESTAURANT` → existing `/partner/businesses/{businessId}/restaurant-menu` (menu and reservation-request tabs).
   - `HOTEL` → existing `/partner/businesses/{businessId}/hotel` workspace (property, rooms, inventory, bookings and commerce routes remain available there).
   - `TOUR_GUIDE` → existing `/partner/businesses/{businessId}/guide-promotions` and `/guide-inquiries` routes.
4. Clicking an action navigates to that existing page; data loading and writes continue through its existing APIs.
5. Non-partner authenticated users do not see the new Partner-only item. Direct access to the page is guarded and returns the user to the existing Partner enrollment/center flow.

### 1.3 Scope

**In scope**

- Add a translated sidebar item inside the existing Partner section, visible only to enrolled Partners.
- Add `/partner/services` as an aggregate navigation/selection page for owned or joined businesses.
- Reuse `getPartnerContext`, `PartnerContextDto`, `BusinessDetailDto`, existing Partner access/capability data, and current destination routes.
- Keep current shortcuts on `PartnerBusinessCard`, including restaurant “Thực đơn & Đặt bàn”.
- Show loading, empty, error, and business-kind appropriate actions; preserve safe error handling and i18n parity.

**Out of scope**

- New backend endpoints, service APIs, database changes, roles, capabilities, or booking workflows.
- New menu, room, promotion, reservation, or inquiry CRUD UI/business logic.
- Moving or duplicating the existing reservation-request tab into a new bookings module.
- Analytics, coupons/promotions, tour inventory, or new service kinds.

### 1.4 Acceptance Criteria

- [x] AC-1: Partner sidebar includes “Quản lý Thực đơn & Dịch vụ” and routes to `/partner/services`.
- [x] AC-2: Active state is correct for `/partner/services` and its future descendants, without marking the hub active on unrelated `/partner/...` detail pages.
- [x] AC-3: The hub lists businesses from the existing Partner context request and exposes only routes compatible with each `BusinessKind` and granted capability.
- [x] AC-4: Selecting an action navigates to the existing per-business route; no duplicate management UI or API request implementation is added.
- [x] AC-5: Existing `/partner` business-management controls and card shortcuts remain unchanged and functional.
- [x] AC-6: Empty/loading/error states, collapsed sidebar tooltip, keyboard navigation, responsive layout, and en/vi translations work.
- [x] AC-7: Non-partners cannot see the sidebar entry or use the hub as an alternate authorization path; resource authorization remains enforced by existing services.

## 2. Architecture & Service Boundaries

### 2.1 Flow

```text
Partner sidebar -> /partner/services
                         |
                         +-> existing GET /api/partners/businesses via getPartnerContext()
                         |
                         +-> business-kind/capability action links
                                   +-> existing restaurant menu/reservation page
                                   +-> existing hotel workspace pages
                                   +-> existing guide promotion/inquiry pages
```

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| `apps/web/tripsense` | Partner-only navigation, business selection and links to existing workspaces. |
| `services/api-gateway` | Existing routes only; no change. |
| `services/trip-service` | Remains authoritative for business context, membership/capability validation, menu, restaurant reservations, hotel operations and guide operations. |

No service-to-service call, event, schema change, or API contract change is required. Public and authenticated traffic continues through the existing Gateway paths.

## 3. API & Contracts

No API changes.

Reuse `GET /api/partners/businesses` through `getPartnerContext()` in `apps/web/tripsense/src/features/partner/services/partner-api.ts`. Use the returned `BusinessDetailDto` fields (`id`, `kind`, `myRole`, `capabilities`, eligibility/status) to determine display and actions. Do not infer authorization from the frontend; destination services keep enforcing membership and capability.

## 4. Data Model & Migrations

- No database or persistence changes.
- No migrations or indexes.
- Reuse the existing business context response; do not add frontend-only duplicate business state stores unless required by current page lifecycle.
- No cross-service reads or relationships.

## 5. Security & Trust Boundaries

- Sidebar visibility is a UX affordance only; the hub must check authenticated Partner state and fail closed if context loading fails.
- Hub actions are rendered from the user's existing business memberships and capabilities. Client-side filtering does not replace backend enforcement.
- Do not accept a manually entered business ID or use `ROLE_PARTNER` alone to show operations on a business.
- Use existing `apiClient` path through `getPartnerContext`, sanitized safe error messages, no raw backend logging, and translated UI strings.
- Keep account switching/logout state isolated; do not persist another user's business list in a shared cache.

## 6. Devil's Advocate & Trade-offs

| Concern | Decision |
| --- | --- |
| Duplicate management surfaces | Hub only selects/navigates; current per-business pages remain the sole CRUD surfaces. Existing card shortcuts stay for direct access. |
| Capability/display drift | Derive links from returned business kind/capabilities, while destination pages/backend remain authoritative. Avoid showing actions unsupported by the business. |
| API overhead | One reuse of the already existing Partner context endpoint on hub load; no per-kind API fan-out. |
| Booking fragmentation | Keep restaurant reservations in its current tab and hotel bookings in its current workspace. A unified inbox is a separate future product decision. |
| Rejected alternative | Redirecting directly to a single restaurant page was rejected because a Partner may own multiple businesses and different kinds. |

## 7. Phased Implementation Tasks & Verification

Implementation starts only after approval.

1. Add `nav.partnerServices` to both locale dictionaries, sorted and parity-checked.
2. Extend the existing Partner sidebar section with a Partner-only link and accurate active-state matching.
3. Create `/partner/services` as a thin hub reusing `getPartnerContext`, DTOs, shared business visual patterns and existing route targets. Avoid cloning `PartnerDashboardView` operational controls; use service-action cards/links only.
4. Add focused web tests for Partner visibility, route active states, kind/capability destination mapping, loading/error/empty states and preservation of card shortcuts.
5. Verify with `npm test -- src/features/partner src/components/layout/user`, `npm run type-check`, `npm run i18n:check`, targeted ESLint, and `git diff --check`.

### Implementation Record

- Added the Partner-only sidebar entry and `/partner/services` business-selection hub.
- The hub calls the existing `getPartnerContext()` API and links to the existing restaurant menu, hotel workspace, guide promotions, and guide inquiries routes based on kind and capability.
- No API, database, or backend service changes were made. Existing business-card shortcuts remain in place.
- Verification passed: 32 targeted tests, TypeScript type-check, i18n parity check, targeted ESLint, and `git diff --check`.
- Manual browser verification was not performed in this environment.

## Human Approval Gate

`STATUS: DONE`

Human approval received on 2026-10-19. Implementation and listed automated verification are complete.
