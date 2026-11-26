# Admin Unified Finance Dashboard (Subscriptions + Hotel Escrow) — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `services/trip-service`, `services/api-gateway`, `apps/web/tripsense`
- **Created Date**: 2026-11-26
- **Target PR Boundaries**: Phase 1 (Backend Subscription Orders Admin Endpoint + Gateway Route), Phase 2 (Frontend Unified `/admin/finance` Dashboard + i18n + Tests)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
`apps/web/tripsense/src/app/admin/finance/page.tsx` currently renders `AdminFinanceView` from `@/features/hotels`, which only queries `/api/hotels/admin/finance/*` (legacy Hotel Escrow, withdrawals, refunds, ledger). Since the platform introduced the **Unified Partner Subscription Model** (`partner_subscription_plan`, `partner_subscription`, `partner_subscription_order` via PayOS VietQR for `HOTEL`, `RESTAURANT`, and `TOUR_GUIDE`), **100% SaaS subscription revenue** is completely missing from `/admin/finance`.

Updating `/admin/finance` gives Admins a single, accurate view of **both** active revenue streams:
1. **Partner Subscriptions (100% Platform Revenue — New Model)**
2. **Hotel Booking Escrow & 10% Commission (Existing Hotel Flow)**

### 1.2 User Flows & Journey
1. Admin navigates to `/admin/finance`.
2. Dashboard loads unified KPIs (Total Platform Revenue = Hotel 10% Commission + Subscription Revenue, Subscription Revenue & Paid Orders, Active/Trial/Expired Partner Subscriptions, plus Hotel Escrow Holding & Pending Withdrawals/Refunds).
3. By default, Admin sees the **"Gói Hội viên (Subscriptions)"** tab listing `partner_subscription_order` PayOS transactions, filterable by `paymentStatus` (`ALL`, `PAID`, `PENDING`, `CANCELLED`, `FAILED`) and `businessKind` (`ALL`, `HOTEL`, `RESTAURANT`, `TOUR_GUIDE`).
4. Admin can switch to **Withdrawals**, **Refunds**, and **Ledger** tabs to continue managing Hotel Escrow operations without regression.

### 1.3 Scope Boundaries
- **In-Scope**:
  - New admin read endpoint `GET /api/admin/finance/subscription-orders` in `services/trip-service` (paginated, filterable by `status` and `businessKind`).
  - API Gateway route for `/api/admin/finance/**` -> `trip-service` (if not already covered).
  - Updated `/admin/finance` UI (`AdminFinanceView`) integrating `getAdminPlatformAnalytics` + `subscription-orders` + existing `/hotels/admin/finance/*` endpoints.
  - Full `en.json` and `vi.json` i18n keys (sorted A→Z) and unit tests.
- **Out-of-Scope**:
  - Deleting or dropping `hotel_booking` / `partner_wallet` / `HotelFinanceController` (kept intact for existing hotel flows).
  - Manual admin approval/mutation of `partner_subscription_order` (already automated via PayOS webhook + `verify-manual`).

### 1.4 Acceptance Criteria
- [ ] AC-1: `GET /api/admin/finance/subscription-orders` enforces `ADMIN` role (`401`/`403` otherwise) and returns paginated `partner_subscription_order` joined with `partner_business` and `partner_subscription_plan`.
- [ ] AC-2: `/admin/finance` displays Total Platform Revenue (`hotelCommissionRevenue + subscriptionRevenue`), Subscription Revenue, Active/Trial/Expired subscription counts, and Hotel Escrow metrics.
- [ ] AC-3: Subscriptions tab supports filtering by payment status and business kind, with loading/empty/error states adhering to `ERROR_HANDLING_AND_LOGGING_STANDARDS.md`.
- [ ] AC-4: Existing Hotel Withdrawals, Refunds, and Ledger tabs continue working identically.
- [ ] AC-5: Backend unit/controller tests and Frontend `i18n:check`, `type-check`, `lint`, and `vitest` tests pass.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[Admin Browser (/admin/finance)]
       │
       ├──► GET /api/admin/analytics/overview?periodDays=30   (existing)
       ├──► GET /api/admin/finance/subscription-orders        (new)
       └──► GET/POST /api/hotels/admin/finance/*              (existing)
                   │
                   ▼
           [API Gateway (:8080)]
                   │ (JWT + Admin role check)
                   ▼
           [Trip Service (:8084)]
```

### 2.2 Architecture Guardrails Verification
- [x] All traffic goes through API Gateway.
- [x] All queried tables (`partner_subscription_order`, `partner_subscription`, `partner_subscription_plan`, `partner_business`, `hotel_*`) are owned by `services/trip-service`.
- [x] No cross-service DB queries or JPA relationships.

---

## 3. API & Event Contracts

### 3.1 New Endpoint: `GET /api/admin/finance/subscription-orders`
- **Auth**: `Bearer JWT` + `user.isAdmin()` (`401 UNAUTHORIZED`, `403 FORBIDDEN`)
- **Query Params**:
  - `status` (optional): `PAID` | `PENDING` | `CANCELLED` | `FAILED`
  - `businessKind` (optional): `HOTEL` | `RESTAURANT` | `TOUR_GUIDE`
  - `page` (default `0`), `size` (default `20`, max `100`)
- **Response (`200 OK`, `ApiResponse<SubscriptionOrderPageDto>`)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "orderCode": 30000012,
        "businessId": "uuid",
        "businessName": "Sunrise Boutique Hotel",
        "businessKind": "HOTEL",
        "planId": "HOTEL_PLAN_1_MONTH",
        "planName": "Gói Lưu Trú Linh Hoạt (1 Tháng)",
        "durationDays": 30,
        "amount": 399000.00,
        "paymentStatus": "PAID",
        "paidAt": "2026-11-20T08:15:00Z",
        "createdAt": "2026-11-20T08:12:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1
  }
}
```

---

## 4. Data Model & Migrations

No new tables or Flyway migrations required. Reads existing `partner_subscription_order`, `partner_subscription_plan`, and `partner_business` tables in `tripsense_trip`.

---

## 5. Security & Trust Boundaries

- Strictly enforce `admin.isAdmin()` on `AdminFinanceController`.
- Parameterized SQL (`JdbcTemplate`) for `status`, `businessKind`, `LIMIT`, `OFFSET` (no SQL injection).
- Frontend uses `apiClient` and `getSafeErrorMessage(err)` — no raw backend errors leaked to UI.

---

## 6. Devil's Advocate & Technical Tradeoffs

- **Reusing `/api/admin/analytics/overview` for KPI totals vs duplicating SQL in `/api/admin/finance/overview`**: Reusing `getAdminPlatformAnalytics(30)` avoids duplicating `FinanceAndSubscriptionStats` queries and guarantees `/admin/analytics` and `/admin/finance` never show conflicting numbers.
- **Keep `/api/hotels/admin/finance/*` untouched**: Preserves backward compatibility for `/admin/hotels/commerce` and existing Hotel Escrow workflows.

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend (`services/trip-service`, `services/api-gateway`)
1. Add `AdminFinanceController` + `AdminSubscriptionOrderService` (and DTOs) in `services/trip-service` exposing `GET /api/admin/finance/subscription-orders`.
2. Ensure `/api/admin/finance/**` is routed in `services/api-gateway`.
3. Add unit tests for admin authorization and filtering.

### Phase 2: Frontend (`apps/web/tripsense`)
1. Add `getAdminSubscriptionOrders` API client & types.
2. Upgrade `AdminFinanceView` with unified Platform Revenue KPIs + "Subscriptions" tab (default) alongside Withdrawals, Refunds, and Ledger tabs.
3. Add sorted `en.json` and `vi.json` keys and component/API unit tests.

### Verification Commands
```bash
./mvnw -pl services/trip-service,services/api-gateway test
cd apps/web/tripsense && npm run i18n:check && npm run type-check && npm run lint && npm test
```

---

## Human Approval Gate

STATUS: WAITING_FOR_HUMAN_APPROVAL

