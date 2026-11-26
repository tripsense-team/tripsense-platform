# Hotel Booking Request-to-Confirm & Remove Hotel PayOS / Escrow Flow — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `services/trip-service`, `apps/web/tripsense` (API Gateway routing `/api/hotels/**` & `/api/public/hotels/**` remains unchanged)
- **Created Date**: 2026-11-25
- **Supersedes**: `hotel-payos-payment`, `financial-flow-and-withdrawals`, `hotel-demo-commerce-and-pr66-remediation`
- **Target PR Boundaries**:
  - Phase 1: Backend `trip-service` Refactor (Move shared `PayOsConfig` for Partner Subscriptions; remove Hotel PayOS, Demo Commerce & Escrow Finance; enable Partner Confirm on `HELD` requests; extend Hold TTL & fix inventory/public-rooms bugs)
  - Phase 2: Frontend Web Refactor (`apps/web/tripsense`: switch Customer & Partner hotel flows to Request → Confirm → Pay at Property; remove Hotel PayOS checkout, refund-bank modal, and Admin/Partner hotel commerce/escrow pages)
  - Phase 3: Regression Tests & Documentation Sync (Update Java integration tests, Vitest web tests, and i18n keys)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & Strategic Decision
Currently, `trip-service` routes customer hotel room payments through the **Platform Owner's PayOS account** (`PayOsPaymentService`, `PayOsWebhookController`, `HotelFinanceService`), maintaining platform-side escrow (`10%` commission / `90%` partner wallet), manual partner withdrawal requests, and manual customer bank-account refund tickets.

This conflicts with TripSense's real business model:
1. **PayOS belongs exclusively to the Platform Owner** for B2B SaaS **Partner Subscriptions** (`PartnerSubscriptionService` + `PartnerSubscriptionWebhookController`) — **NOT** for collecting hotel room fees on behalf of partners.
2. TripSense should **not hold customer room funds, manage partner escrow wallets, or process hotel refunds**.
3. Additionally, the current codebase has critical mismatches caused by mixing PayOS online checkout with direct booking:
   - `HotelService.transitionLocked()` (`L471`) blocks Partners (`isOwner`) from calling `POST /api/hotels/bookings/{id}/confirm` with `404 HOTEL_NOT_FOUND` (only `customer_id` was allowed!).
   - `HotelReservationDialog` only creates a 10-minute `HELD` record while telling both guest and hotel "Đặt phòng thành công — thanh toán tại khách sạn".
   - `UserBookingsView` forces a bank-account refund form even when cancelling unpaid `HELD` or `PAY_AT_PROPERTY` bookings.
   - `PublicHotelService.getPublicHotelRooms()` fakes `Math.max(1, available_rooms)` and `500,000 VND / 10 rooms` fallback when sold out, and `hotel-service-adapter.ts` calls a broken URL `/api/hotels/public/hotels/{id}/rooms`.

**Target Direction:**
- **Hotels operate on a clean Request → Partner Confirm → Pay at Property model** (consistent with Restaurant Reservations and Rental Bookings in `PartnerBookingsHub`).
- **Keep PayOS 100% intact for Partner Subscriptions (`PartnerSubscriptionService` & `PartnerSubscriptionWebhookController`)**, while completely removing PayOS, Demo Payment, Escrow Wallet, Withdrawals, and Refunds from **Hotel Bookings**.

### 1.2 Target User Flows & Journey

```text
[Traveler (Web)]                        [Trip Service (:8084)]                     [Hotel Partner (Web)]
       │                                          │                                          │
       │ 1. Chọn phòng, ngày, số khách            │                                          │
       │    POST /api/hotels/holds                │                                          │
       ├─────────────────────────────────────────►│                                          │
       │    (Idempotency-Key)                     ├─ Lock hotel_property FOR UPDATE          │
       │                                          ├─ Validate inventory & capacity           │
       │                                          ├─ held += qty, payment_method=PAY_AT_PROPERTY
       │                                          ├─ status='HELD', expires_at=min(now+24h, checkIn)
       │                                          ├─ Notify Partner (Outbox + Notification) ─►│
       │◄─── 200 OK (status: HELD - Chờ KS duyệt)─┤                                          │
       │                                          │                                          │
       │                                          │ 2A. Partner duyệt đơn:                   │
       │                                          │     POST /api/hotels/bookings/{id}/confirm
       │                                          │◄─────────────────────────────────────────┤
       │                                          ├─ Verify Partner OWNER/MANAGER            │
       │                                          ├─ held -= qty, booked += qty              │
       │                                          ├─ status='CONFIRMED'                      │
       │◄─── Thông báo/Email: KS đã xác nhận ─────┤                                          │
       │     (Thanh toán trực tiếp tại KS)        │                                          │
       │                                          │ 2B. HOẶC Partner từ chối (kèm lý do):    │
       │                                          │     POST /api/hotels/bookings/{id}/cancel│
       │                                          │◄─────────────────────────────────────────┤
       │◄─── Thông báo/Email: KS từ chối + lý do ─├─ Nhả kho (held/booked -= qty)            │
       │                                          │                                          │
       │ 3. Khách tự hủy (HELD bất cứ lúc nào;    │                                          │
       │    CONFIRMED trước free_cancellation_until)                                         │
       │    POST /api/hotels/bookings/{id}/cancel │                                          │
       ├─────────────────────────────────────────►├─ Nhả kho, không cần form STK hoàn tiền   │
       │                                          ├─ Thông báo Partner ─────────────────────►│
       │                                          │                                          │
       │ 4. Lưu trú thực tế (Thanh toán trực tiếp tại khách sạn, ngoài nền tảng)             │
       │                                          │◄── POST /check-in -> POST /check-out     │
       │                                          │    (hoặc /no-show sau cutoff)            │
       │                                          │    KHÔNG tạo giao dịch ví / quyết toán   │
```

### 1.3 Scope Boundaries
- **In-Scope**:
  - **Decommission Hotel PayOS, Demo Commerce & Hotel Finance**:
    - Remove `PayOsPaymentService`, `PayOsWebhookController`, `HotelFinanceService`, `HotelFinanceController`, `HotelFinanceDtos`.
    - Move shared `PayOsConfig` bean out of `hotel/` into `fu.tripsense.tripservice.config.PayOsConfig` so `PartnerSubscriptionService` & `PartnerSubscriptionWebhookController` continue working untouched.
    - Remove `/api/hotels/payments/payos/webhook` from `SecurityConfig.java` (keep `/api/partners/subscriptions/payos/webhook`).
    - Remove Hotel Demo Payment / Settlement / Commerce endpoints & logic from `HotelController` and `HotelService`.
    - Remove `payOsPayments.reconcile()` from `HotelJobs`.
    - Update `AdminPlatformAnalyticsService` so platform revenue derives strictly from `partner_subscription_order` (`PAID`) without depending on `hotel_payos_payment` or `partner_wallet` (keeping DTO backward-compatible with `0` for deprecated hotel escrow/commission metrics).
  - **Refactor Hotel Booking to Request-to-Confirm (`PAY_AT_PROPERTY`)**:
    - `HotelService.hold()`: Always set `payment_method = 'PAY_AT_PROPERTY'`. Extend hold expiration from `10 minutes` to **`24 hours`** (capped at property `check_in` local time, minimum 15 minutes for same-day bookings) so Partners have a realistic window to review and confirm.
    - `HotelService.transitionLocked()` (`POST /api/hotels/bookings/{id}/confirm`): Change authorization so **ONLY Property `OWNER`/`MANAGER` (`isPropertyOwner`)** can confirm a `HELD` booking into `CONFIRMED` (customers can no longer bypass partner approval).
    - `HotelService.checkIn()`: Enforce date guard (prevent Check-in earlier than `check_in` date in property timezone).
    - `HotelService.propertyCancel()`: Release applied voucher (`hotel_voucher_redemption` + `usage_count`) if vouchers remain enabled, and send outbox notification cleanly.
    - Fix `PublicHotelService.getPublicHotelRooms()`: Stop faking `Math.max(1, available_rooms)` and remove hardcoded `500000.00 / 10` fallbacks when inventory is empty or `stop_sell = true`.
  - **Frontend Web Cleanup & Alignment**:
    - Remove `/hotels/payment-result/[bookingId]/page.tsx`, `/admin/hotels/commerce/page.tsx`, `/admin/finance/page.tsx`, `/partner/businesses/[businessId]/hotel/commerce/page.tsx`, `hotel-commerce.tsx`, `partner-finance-view.tsx`, `admin-finance-view.tsx`, and associated sidebar/tab links.
    - Update `MindtripAvailableRoomsView` (remove auto PayOS redirect; show clear "Đã gửi yêu cầu đặt phòng — Chờ khách sạn xác nhận").
    - Update `HotelCheckoutReview` (remove PayOS / Demo Payment buttons; show booking request summary, estimated total payable at hotel, countdown/status, and Cancel action).
    - Update `HotelReservationDialog` (fix copy from "Đặt phòng thành công" to "Đã gửi yêu cầu đặt phòng — Chờ khách sạn xác nhận" and display server `booking.total`).
    - Update `UserBookingsView` (remove `handleQuickPay` PayOS redirect and remove Refund Bank Account modal; use standard `ConfirmationDialog` → `POST /api/hotels/bookings/{id}/cancel`).
    - Fix `hotel-service-adapter.ts` `L504` broken URL (`/api/public/hotels/${place.id}/rooms` instead of `/api/hotels/public/hotels/${place.id}/rooms`).
- **Out-of-Scope**:
  - **Partner Subscription PayOS flow** (`PartnerSubscriptionService`, `PartnerSubscriptionController`, `PartnerSubscriptionWebhookController`, `/partner/services`, `partner-subscription-view.tsx`) — **MUST remain 100% functional**.
  - Destructive `DROP TABLE` migrations on historical tables (`hotel_payos_payment`, `hotel_demo_payment`, `partner_wallet`, `partner_withdrawal_request`, `customer_refund_request`, `financial_ledger_entry`) — retain tables untouched for safe rollback & historical audit.
  - Restaurant Reservations, Rental Bookings, and Tour Guide Inquiries (already follow Request-to-Confirm / direct contact).

### 1.4 Acceptance Criteria
- [ ] **AC-1 (Partner Subscription Preserved):** Partner subscription checkout & PayOS webhook (`/api/partners/subscriptions/payos/webhook`) compile, start cleanly, and pass tests using the shared `PayOsConfig` bean.
- [ ] **AC-2 (No Hotel PayOS / Escrow Endpoints):** All hotel PayOS, Demo Payment, and Hotel Finance endpoints return 404 / are removed; zero PayOS redirects or bank-account refund modals appear anywhere in Traveler, Partner, or Admin hotel UI.
- [ ] **AC-3 (Request → Partner Confirm Works):**
  - Traveler submits `POST /api/hotels/holds` → creates `HELD` booking (`payment_method = 'PAY_AT_PROPERTY'`, 24h expiry capped at check-in), locks inventory `held += qty`, notifies Partner.
  - Traveler calling `POST /api/hotels/bookings/{id}/confirm` is rejected (`403`/`404`).
  - Partner (`OWNER`/`MANAGER`) calling `POST /api/hotels/bookings/{id}/confirm` transitions `HELD -> CONFIRMED`, moves `held -> booked`, and notifies Traveler.
  - Partner rejecting via `POST /api/hotels/bookings/{id}/cancel` with `reason` transitions `HELD/CONFIRMED -> CANCELLED`, releases inventory, and notifies Traveler.
- [ ] **AC-4 (Traveler Cancel Without Refund Form):** Traveler can cancel `HELD` anytime and `CONFIRMED` before `free_cancellation_until` via simple confirmation dialog (`POST /api/hotels/bookings/{id}/cancel`), releasing inventory and notifying Partner.
- [ ] **AC-5 (Accurate Public Availability & URL):** `PublicHotelService.getPublicHotelRooms()` returns `0` when sold out (never fakes `1` or `10`), and `hotel-service-adapter.ts` calls `/api/public/hotels/{id}/rooms`.
- [ ] **AC-6 (Admin Analytics Stability):** `GET /api/admin/analytics/overview` succeeds without querying removed hotel payment flows; platform revenue accurately reflects `partner_subscription_order`.

---

## 2. Architecture & Service Boundaries

### 2.1 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Traveler Stays discovery, Request dialog, My Bookings, Partner Bookings Hub & Admin Hotel overview | HTTP REST via API Gateway |
| `services/api-gateway` | JWT verification & routing `/api/hotels/**`, `/api/public/hotels/**`, `/api/partners/**` | Spring Cloud Gateway (no route changes required) |
| `services/trip-service` | Owns `hotel_property`, `hotel_room_type`, `hotel_inventory`, `hotel_booking`, `hotel_outbox`, `hotel_notification`, plus `partner_subscription_*` | Synchronous REST + local PostgreSQL + Outbox -> `mail-service` |

### 2.2 Architecture Guardrails Verification
- [x] Public traffic goes through API Gateway.
- [x] `trip-service` owns all hotel & partner booking data; no cross-service DB queries or JPA relationships.
- [x] PayOS credentials remain strictly backend-side inside `trip-service` (`config/PayOsConfig.java`) exclusively for platform-owned Partner Subscriptions.
- [x] Deterministic business rules (inventory locks, capacity checks, cancellation cutoff, Partner-only confirm RBAC) stay explicit and unit/integration tested.

---

## 3. API & Contract Changes

### 3.1 Retained & Updated Hotel Endpoints (`HotelController` & `PublicHotelController`)
| Method | Path | Auth / Actor | Change |
| --- | --- | --- | --- |
| `GET` | `/api/hotels/search` | Public | Unchanged (returns real-time available room offers & totals) |
| `GET` | `/api/public/hotels/{id}/rooms` | Public | Fix SQL & DTO: return real `availableRooms` (`>= 0`, no `Math.max(1, ...)` fake, no hardcoded `500000`/`10` fallback) |
| `POST` | `/api/hotels/holds` | Traveler (`Idempotency-Key`) | Always sets `payment_method = 'PAY_AT_PROPERTY'`, `status = 'HELD'`, `expires_at = LEAST(clock_timestamp() + interval '24 hours', check_in_instant)` (min 15m if near check-in) |
| `POST` | `/api/hotels/bookings/{id}/confirm` | **Partner `OWNER`/`MANAGER` only** | **Updated RBAC:** Only property owner/manager can confirm `HELD -> CONFIRMED` (replaces old customer self-confirm & PayOS check) |
| `POST` | `/api/hotels/bookings/{id}/cancel` | Traveler OR Partner (`reason` required for Partner) | Unchanged path; releases `held`/`booked` inventory + releases voucher if present + notifies counterparty |
| `POST` | `/api/hotels/bookings/{id}/check-in` | Partner `OWNER`/`MANAGER` | Add check: cannot check-in before `check_in` date in property timezone |
| `POST` | `/api/hotels/bookings/{id}/check-out` | Partner `OWNER`/`MANAGER` | Remove `hotelFinanceService.settleBooking(id)` call |
| `POST` | `/api/hotels/bookings/{id}/no-show` | Partner `OWNER`/`MANAGER` | Unchanged (releases remaining nights from `today` to `check_out`) |
| `GET` | `/api/hotels/bookings` | Traveler | Lists customer's hotel booking requests & confirmed stays |
| `GET` | `/api/hotels/properties/{id}/bookings` | Partner `OWNER`/`MANAGER` | Lists property's incoming booking requests & stays |

### 3.2 Endpoints to Remove (Decommissioned)
- `POST /api/hotels/payments/payos/webhook` (`PayOsWebhookController`)
- `POST /api/hotels/bookings/{id}/payos-payment` (`HotelController`)
- `GET /api/hotels/bookings/{id}/payment` (`HotelController`)
- `POST /api/hotels/bookings/{id}/demo-payment` (`HotelController`)
- `POST /api/hotels/bookings/{id}/demo-settlement` (`HotelController`)
- `GET /api/hotels/commerce` & `GET /api/hotels/commerce/config` (`HotelController`)
- All `/api/hotels/finance/**`, `/api/hotels/admin/finance/**`, and `POST /api/hotels/bookings/{id}/cancel-and-refund` (`HotelFinanceController`)

---

## 4. Data Model & Migration Strategy

### 4.1 Non-Destructive Schema Approach (Recommended)
- **No destructive `DROP TABLE` migration** in this PR. Legacy tables (`hotel_payos_payment`, `hotel_payos_receipt`, `hotel_demo_payment`, `hotel_demo_ledger`, `hotel_demo_command`, `partner_wallet`, `partner_payout_account`, `partner_withdrawal_request`, `customer_refund_request`, `financial_ledger_entry`) remain dormant in `trip_db` to preserve historical audit records and guarantee zero-risk rollback.
- Existing `hotel_booking` columns (`status`, `payment_method`, `expires_at`, `free_cancellation_until`, `cancelled_by`, `cancellation_reason`, `version`) already support the full Request → Partner Confirm → Pay at Property lifecycle without requiring schema alteration.
- *(Optional future cleanup)*: A separate archived-table cleanup migration can drop unused tables after production soak period.

---

## 5. Security & Trust Boundaries

1. **Confirm Authorization (Anti-Bypass / Anti-IDOR):**
   - `POST /api/hotels/bookings/{id}/confirm` strictly verifies `isPropertyOwner(u, property)` (`partner_business_member` with `state='ACTIVE'` and `role IN ('OWNER','MANAGER')`). Customers cannot self-confirm their own `HELD` request.
2. **Cancel Authorization:**
   - Customer can only cancel their own booking (`customer_id == u.id()`), anytime in `HELD`, and before `free_cancellation_until` in `CONFIRMED`.
   - Partner (`isPropertyOwner`) can reject/cancel `HELD` or `CONFIRMED` with a mandatory non-blank `reason`.
3. **Public Webhook Surface Reduction:**
   - Removing `/api/hotels/payments/payos/webhook` from `SecurityConfig.permitAll()` reduces unauthenticated attack surface while keeping `/api/partners/subscriptions/payos/webhook` intact (protected by PayOS SDK HMAC verification).
4. **Error Handling:**
   - Extend `HotelExceptionHandler` (`@RestControllerAdvice`) to cover both `HotelController.class` and `PublicHotelController.class` so all hotel errors return sanitized `ErrorResponse` JSON.

---

## 6. Devil's Advocate, Trade-offs & Open Decisions

| Decision Point | Recommended Option | Alternative | Rationale |
| --- | --- | --- | --- |
| **1. `PayOsConfig` bean location** | Move to `fu.tripsense.tripservice.config.PayOsConfig` | Delete `PayOsConfig` | **Must keep** because `PartnerSubscriptionService` & `PartnerSubscriptionWebhookController` inject `@Nullable PayOS` for platform B2B subscriptions. |
| **2. Hold TTL (`expires_at`)** | **24 hours** (capped at `check_in` start time, min 15 min) | Keep 10 minutes | 10 minutes is unusable when waiting for a human Partner to review & confirm. 24 hours prevents stale inventory locks while giving Partners reasonable response time. |
| **3. Hotel Vouchers (`hotel_voucher`)** | **Option A (Recommended): Keep or remove?** *(Needs human confirmation below)* | Remove voucher UI & endpoints | Since the platform no longer collects money, platform-funded discount vouchers have no settlement mechanism unless treated as partner-honored promo codes at check-in. Removing hotel voucher UI/endpoints simplifies the flow cleanly, or keeping them purely as display-only promo codes on the booking slip. |
| **4. DB Tables cleanup** | Non-destructive (keep tables, remove code) | Flyway `DROP TABLE` | Safer for rollback and preserves any existing dev/staging/prod audit rows. |
| **5. `AdminPlatformAnalyticsService`** | Keep DTO fields (`totalHotelGmv=0`, `escrowHolding=0`, `hotelCommissionRevenue=0`, `partnerPayableBalance=0`) and compute `totalPlatformRevenue = subscriptionRevenue` | Breaking DTO removal | Avoids breaking Admin Analytics frontend charts & tests while immediately fixing business semantics. |

---

## 7. Detailed Cleanup & Implementation Task List

### Phase 1: Backend (`services/trip-service`)
1. Move `hotel/PayOsConfig.java` → `config/PayOsConfig.java` (verify `PartnerSubscriptionService` & `PartnerSubscriptionWebhookController` still inject `PayOS`).
2. Delete `PayOsPaymentService.java`, `PayOsWebhookController.java`, `HotelFinanceService.java`, `HotelFinanceController.java`, `HotelFinanceDtos.java`, and `PayOsPaymentIntegrationTest.java`.
3. Update `SecurityConfig.java`: remove `/api/hotels/payments/payos/webhook` from `permitAll()`.
4. Update `HotelJobs.java`: remove `PayOsPaymentService` dependency and `payOsPayments.reconcile()` call; update `BOOKING_CONFIRMED` message to reflect Partner confirmation & pay-at-property.
5. Update `HotelController.java` & `HotelService.java`:
   - Remove PayOS, Demo Payment, Demo Settlement, and Commerce endpoints/methods.
   - Force `payment_method = "PAY_AT_PROPERTY"` in `hold()` with 24h TTL (capped at check-in).
   - Fix `transitionLocked()` so **only Partner (`isPropertyOwner`)** can `confirm` `HELD -> CONFIRMED`.
   - Add check-in date validation in `checkIn()`, remove `hotelFinanceService.settleBooking()` from `checkOut()`, release voucher (if retained) in `propertyCancel()`.
   - Update `HotelExceptionHandler` to include `PublicHotelController.class`.
6. Fix `PublicHotelService.getPublicHotelRooms()` (`availableRooms` honest count without `Math.max(1, ...)` or fake `500000`/`10`).
7. Update `AdminPlatformAnalyticsService.java` (remove queries on `hotel_payos_payment` and `partner_wallet`; platform revenue = `subscriptionRevenue`).

### Phase 2: Frontend (`apps/web/tripsense`)
1. Delete deprecated pages & components:
   - `src/app/(main)/hotels/payment-result/[bookingId]/page.tsx`
   - `src/app/(main)/partner/businesses/[businessId]/hotel/commerce/page.tsx`
   - `src/app/admin/hotels/commerce/page.tsx`
   - `src/app/admin/finance/page.tsx`
   - `src/features/hotels/components/hotel-commerce.tsx`
   - `src/features/hotels/components/partner-finance-view.tsx`
   - `src/features/hotels/components/admin-finance-view.tsx`
   - `src/features/hotels/components/__tests__/hotel-commerce.test.tsx`
2. Clean up navigation & exports:
   - `src/features/hotels/index.ts`
   - `src/features/hotels/components/partner-hotel-workspace.tsx` (remove `commerce` tab)
   - `src/app/admin/hotels/page.tsx` (remove link to `/admin/hotels/commerce`)
   - `src/components/layout/admin/admin-sidebar.tsx` (remove `/admin/finance` & `/admin/hotels/commerce` matching)
3. Refactor customer booking flow to Request → Wait for Confirm → Pay at Property:
   - `src/features/hotels/components/mindtrip-available-rooms-view.tsx` (remove auto PayOS redirect; show submitted request state cleanly)
   - `src/features/hotels/components/hotel-checkout-review.tsx` (remove PayOS/Demo pay buttons; show "Chờ khách sạn xác nhận • Thanh toán trực tiếp tại khách sạn" + Cancel button)
   - `src/features/partner/components/hotel-reservation-dialog.tsx` (change success text to "Đã gửi yêu cầu đặt phòng — Chờ khách sạn xác nhận" and use `booking.total` from server)
   - `src/features/hotels/components/user-bookings-view.tsx` (remove PayOS quick-pay & Bank Refund modal; use simple cancel confirmation calling `POST /api/hotels/bookings/{id}/cancel`)
   - `src/features/hotels/services/hotel-service-adapter.ts` (fix `/api/public/hotels/${place.id}/rooms` URL)
4. Verify Partner confirmation UI (`src/app/(main)/partner/businesses/[businessId]/hotel/bookings/page.tsx` & `partner-bookings-hub.tsx`) seamlessly confirms & rejects `HELD` hotel booking requests.
5. Update `src/locales/vi.json` and `src/locales/en.json` keeping schema parity (`npm run i18n:check`).

### Phase 3: Verification
- Backend: `mvn -pl services/trip-service test` (update `HotelReservationIntegrationTest` to assert Partner-only confirm, 24h hold TTL, customer cancel, and `PartnerSubscriptionService` tests pass).
- Frontend: `npm run type-check`, `npm run i18n:check`, `npm test` (update `hotel-checkout-review.test.tsx`, `hotel-reservation-dialog.test.tsx`, `partner-bookings-hub.test.tsx`).
