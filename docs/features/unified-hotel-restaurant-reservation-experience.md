# Unified Hotel & Restaurant Reservation Experience — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway`
- **Created Date**: 2026-10-30
- **Target PR Boundaries**: [Phase 1: Hotel Partner Confirmation & Decision Flow, Phase 2: Public Hotel Booking UI Harmonization, Phase 3: Unified Guest Reservations Hub & Extensibility Polish]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Currently, the booking and reservation experience between Restaurants and Hotels on TripSense is asymmetrical and disjointed:
1. **Public Booking CTA Inconsistency**: On the public restaurant page, chat previously competed with table reservations, and on the public hotel page (`MindtripHotelDetailOverlay` and `MindtripBookStayModal`), having an `ownerUserId` hijacked the primary button into "Nhắn tin đặt phòng trực tiếp", preventing guests from directly selecting and reserving rooms.
2. **Partner Acceptance Disparity**: In the Restaurant Partner dashboard (`RestaurantReservationsTab`), partners have clear **Xác nhận đặt bàn (Confirm)** and **Từ chối (Reject)** actions. In the Hotel Partner dashboard (`PartnerHotelBookingsPage` and `PartnerHotelWorkspace`), when a booking is in `HELD` state (waiting for hotel approval or payment verification), there is only a "Hủy đơn (Cancel)" button — the partner has no button to **Chấp nhận / Xác nhận đặt phòng (Confirm)**, despite the backend endpoint `POST /api/hotels/bookings/{id}/confirm` already existing in `HotelController.java`.
3. **Customer Visibility & Extensibility**: Customers need a consistent, intuitive view of their reservations (both Hotel stays and Restaurant tables) at `/reservations`, with standardized status badges, host contact phone numbers, and 1-click calls. Future verticals (e.g., Tour Guide inquiries, boat tours) must easily plug into this exact symmetrical lifecycle.

### 1.2 User Flows & Journey

#### Flow 1: Guest Books Hotel / Restaurant Room or Table
1. Guest navigates to Hotel detail overlay or Restaurant page.
2. The **primary button** is always the direct reservation action: **"Chọn phòng & Đặt ngay"** (Hotel) or **"Đặt bàn giữ chỗ"** (Restaurant).
3. The **secondary button** is the consultation action: **"Nhắn tin tư vấn"** (via `ownerUserId`), clearly signaling inquiry rather than competing with booking.
4. Guest fills in dates, guest count, and mandatory contact details (Full Name, Phone number).
5. Request is placed into `HELD` / `REQUESTED` state. A notification toast appears with a direct link to `/reservations`.

#### Flow 2: Partner Reviews & Accepts/Rejects Booking
1. Partner opens their Business Dashboard (`/partner/businesses/{bizId}/hotel/bookings` or `/partner/businesses/{bizId}/restaurant-menu?tab=reservations`).
2. Symmetrical filter tabs: Tất cả / Chờ xác nhận / Đã xác nhận / Đã hủy / Hoàn tất.
3. Each booking card displays: Guest Name, Contact Phone (with 1-click `tel:` call button), stay dates / dining time, room type / guests, total price / deposit.
4. When booking is in pending state (`HELD` for Hotel, `REQUESTED` for Restaurant):
   - **Xác nhận đặt phòng / Xác nhận đặt bàn** (Emerald primary button): Transitions booking to `CONFIRMED`.
   - **Từ chối / Hủy đơn** (Destructive outline button): Opens rejection reason dialog and transitions booking to `CANCELLED`/`REJECTED`.
5. For hotels, partners can subsequently advance stay lifecycles: **Nhận phòng (Check-in)**, **Trả phòng (Check-out)**, or **Khách vắng mặt (No-show)**.

#### Flow 3: Guest Views & Manages Active Reservations
1. Guest opens `/reservations` (`UnifiedReservationsHub`).
2. Two clean tabs: **Khách sạn & Lưu trú** (`UserBookingsView`) and **Nhà hàng & Ẩm thực** (`CustomerReservationsView`).
3. Status badges, property contact hotline, and cancellation rules are rendered symmetrically.

### 1.3 Scope Boundaries
- **In-Scope**:
  - **Hotel Partner Booking Actions**: Add the **"Xác nhận đặt phòng (Confirm)"** button to `PartnerHotelBookingsPage` and `PartnerHotelWorkspace` calling `POST /api/hotels/bookings/{id}/confirm`.
  - **Hotel Partner Rejection Modal**: Add rejection dialog with reason prompt matching the restaurant partner reject modal.
  - **Public Hotel Booking UI Harmonization**: In `MindtripHotelDetailOverlay` and `MindtripBookStayModal`, make "Chọn phòng & Đặt ngay" / "Kiểm tra phòng trống" the primary CTA, and demote chat to "Nhắn tin tư vấn" (`variant="outline"`).
  - **Unified Status & Filter Symmetries**: Harmonize status color codes (`HELD`/`REQUESTED` = Amber, `CONFIRMED` = Emerald, `CHECKED_IN` = Blue, `CANCELLED`/`REJECTED` = Destructive).
  - **i18n Parity**: Add matching Vietnamese and English locale keys for hotel and restaurant reservation management.
  - **Automated Tests**: Unit & component tests for hotel booking confirmation and reservation display.
- **Out-of-Scope**:
  - Changing payment gateways (PayOS webhook and Demo payment flows remain as-is).
  - External OTA scrapers or channel managers (first-party inventory remains the system of record).

### 1.4 Acceptance Criteria
- [x] **AC-1**: When a hotel booking is in `HELD` status, the hotel partner sees an **"Xác nhận đặt phòng"** button that executes `POST /api/hotels/bookings/{id}/confirm` and refreshes the booking list with status `CONFIRMED`.
- [x] **AC-2**: When a hotel partner rejects a `HELD` or `CONFIRMED` booking, they can provide a reason in a modal, which updates the booking via `POST /api/hotels/bookings/{id}/cancel` with `expectedVersion`.
- [x] **AC-3**: On `MindtripHotelDetailOverlay` and `MindtripBookStayModal`, the primary CTA is always "Chọn phòng & Đặt ngay" / "Kiểm tra phòng trống". "Nhắn tin tư vấn" is an auxiliary secondary button with chat icon.
- [x] **AC-4**: In `/reservations`, switching between `Khách sạn & Lưu trú` and `Nhà hàng & Ẩm thực` works smoothly with URL query parameter sync (`?tab=hotels` vs `?tab=restaurants`).
- [x] **AC-5**: Both `vi.json` and `en.json` maintain 100% key and alphabetical order parity via `npm run i18n:sort`.
- [x] **AC-6**: All Vitest test suites in `apps/web/tripsense` pass with zero failures.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Guest / User]                     [Hotel Partner / Dashboard]
      |                                        |
      |-- 1. Create Hold / Booking ---------->|
      |   POST /api/hotels/holds               |
      |   (Status: HELD)                       |
      |                                        |
      |<-- 2. Notification Toast & SSE --------|
      |                                        |
      |                                        |-- 3. Review Booking (/partner/.../hotel/bookings)
      |                                        |-- 4. Click "Xác nhận đặt phòng"
      |                                        |   POST /api/hotels/bookings/{id}/confirm
      |                                        |   (Status: CONFIRMED)
      |<-- 5. Status updated in /reservations -|
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Hotel & Restaurant booking modals, partner dashboards, Unified Reservations Hub | HTTP REST / Next.js client |
| `services/api-gateway` | Routes `/api/hotels/**` and `/api/restaurants/**` to `trip-service` | Spring Cloud Gateway |
| `services/trip-service` | Owns `hotel_booking`, `restaurant_reservation_request`, inventory, holds, and state transitions | Synchronous Spring Boot JPA |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic routes exclusively through API Gateway.
- [x] Each service owns its own database tables; zero cross-service DB queries or cross-service JPA entities.
- [x] Concurrency controlled via Optimistic Locking (`version` / `expectedVersion`).
- [x] No sensitive tokens or raw SQL traces exposed in UI toasts or client logs (Zero-Leak error handling).

---

## 3. API & Event Contracts

### 3.1 REST Endpoints
| Method | Path | Auth | Roles | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/hotels/bookings/{id}/confirm` | Bearer JWT | `OWNER`, `PARTNER`, `ADMIN` | Confirms a held hotel booking (`HELD` -> `CONFIRMED`) |
| `POST` | `/api/hotels/bookings/{id}/cancel` | Bearer JWT | `OWNER`, `PARTNER`, `CUSTOMER` | Cancels hotel booking with `expectedVersion` and `reason` |
| `POST` | `/api/hotels/bookings/{id}/check-in` | Bearer JWT | `OWNER`, `PARTNER` | Records guest check-in (`CONFIRMED` -> `CHECKED_IN`) |
| `POST` | `/api/hotels/bookings/{id}/check-out` | Bearer JWT | `OWNER`, `PARTNER` | Records guest check-out (`CHECKED_IN` -> `CHECKED_OUT`) |
| `POST` | `/api/hotels/bookings/{id}/no-show` | Bearer JWT | `OWNER`, `PARTNER` | Records guest no-show (`CONFIRMED` -> `NO_SHOW`) |
| `GET` | `/api/hotels/properties/{id}/bookings` | Bearer JWT | `OWNER`, `PARTNER` | Retrieves all bookings for the partner property |
| `GET` | `/api/hotels/bookings` | Bearer JWT | Authenticated User | Retrieves all customer bookings for `/reservations` |

#### Hotel Confirmation Request & Response
```http
POST /api/hotels/bookings/550e8400-e29b-41d4-a716-446655440000/confirm HTTP/1.1
Authorization: Bearer <jwt-token>
```
Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "propertyName": "Riverside Heritage Boutique Hotel",
  "roomName": "Deluxe River View",
  "checkIn": "2026-11-01",
  "checkOut": "2026-11-03",
  "quantity": 1,
  "guests": 2,
  "total": 2400000,
  "currency": "VND",
  "status": "CONFIRMED",
  "version": 2
}
```

---

## 4. Data Model & Lifecycle Synchronization

### 4.1 Hotel Booking vs Restaurant Reservation Lifecycle Alignment
Both verticals follow an identical state progression, making future service expansions (tours, rentals) plug-and-play:

```text
[Customer Requests]
        |
        v
+------------------+------------------+
| Hotel Status     | Restaurant State | Meaning                           |
+------------------+------------------+-----------------------------------+
| HELD             | REQUESTED        | Awaiting partner confirmation     |
| CONFIRMED        | CONFIRMED        | Partner accepted / Table reserved |
| CHECKED_IN       | SEATED           | Guest arrived and in-service      |
| CHECKED_OUT      | COMPLETED        | Fulfilled stay / Completed dining |
| CANCELLED        | REJECTED/CANCELLED| Declined by partner or customer  |
+------------------+------------------+-----------------------------------+
```

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Partner Authorization (Anti-IDOR)** | `HotelService.java` verifies that `property.businessId` belongs to the authenticated partner before confirming/cancelling bookings. |
| **Concurrency & Double Action** | `expectedVersion` is required for cancel, check-in, check-out, and no-show transitions to prevent race conditions. |
| **Zero-Leak Logging** | All error messages sanitized via `getSafeErrorMessage` before reaching toasts or alerts. |

---

## 6. Technical Trade-offs & Alternatives

| Decision | Chosen Solution | Rejected Alternative & Rationale |
| --- | --- | --- |
| **Hotel Confirmation Endpoint** | Reuse existing `/api/hotels/bookings/{id}/confirm` in `HotelController.java`. | Creating a new partner-specific controller. Rejected because the existing endpoint already handles tenancy, transitions, and auditing cleanly. |
| **Public Hotel CTA** | Direct booking "Chọn phòng" as primary, chat "Nhắn tin tư vấn" as secondary. | Forcing chat whenever `ownerUserId` is set. Rejected because it breaks self-service booking and causes user frustration. |

---

## 7. Phased Implementation Tasks

### Phase 1: Hotel Partner Booking Confirmation & Rejection Flow
- [x] Task 1.1: Add **"Xác nhận đặt phòng (Confirm)"** button in `apps/web/tripsense/src/app/(main)/partner/businesses/[businessId]/hotel/bookings/page.tsx` for `HELD` status.
- [x] Task 1.2: Add **"Xác nhận đặt phòng"** button in `PartnerHotelWorkspace` (`activeTab === "guests"`).
- [x] Task 1.3: Harmonize rejection dialog with reason prompt for hotel bookings.

### Phase 2: Public Hotel Booking UI Harmonization
- [x] Task 2.1: Update `MindtripHotelDetailOverlay`: Keep "Chọn phòng & Đặt ngay" / "Kiểm tra phòng trống" as primary button; make "Nhắn tin tư vấn" a secondary button.
- [x] Task 2.2: Update `MindtripBookStayModal`: Keep "Chọn phòng" as primary button; make "Nhắn tin tư vấn" secondary.

### Phase 3: Unified Reservations Hub & Extensibility Polish
- [x] Task 3.1: Ensure status badges in `UserBookingsView` and `CustomerReservationsView` share identical color schemes and clear Vietnamese labels.
- [x] Task 3.2: Verify telephone/hotline direct links for both hotel front desk and restaurant manager.
- [x] Task 3.3: Run `check-i18n.mjs` and execute Vitest test suite.

---

## Human Approval Gate

```text
STATUS: DONE (Approved and Implemented)
```
> Kế hoạch kỹ thuật đồng nhất quy trình đặt chỗ và duyệt đơn giữa Khách sạn (Hotel) và Nhà hàng (Restaurant) đã hoàn thiện.
> Vui lòng phê duyệt bằng cách phản hồi `Approved`, `Implement` hoặc `Proceed` để bắt đầu triển khai code.

