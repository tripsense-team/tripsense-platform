# Hotel Booking Vouchers & Discounts — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway`
- **Date**: 2026-10-12
- **Related Plans**: `hotel-payos-payment.md`, `hotel-demo-commerce-and-pr66-remediation.md`, `feature-priority-roadmap.md` (Item B01)

---

## 1. Goal & Requirements

### 1.1 Problem Statement
Travelers booking hotels on TripSense need the ability to apply promotional vouchers/discount codes during the checkout hold state (`HELD`).
The discount must:
1. Support percentage discounts (with an optional maximum cap) and fixed-amount discounts.
2. Enforce minimum order value, validity time window, and platform-wide usage quotas.
3. Update the payable total consistently for both PayOS real payment and demo payment.
4. Prevent voucher abuse by tracking redemption state across booking confirmation, cancellation, and expiry.
5. Provide a seamless UX in `HotelCheckoutReview` to browse available vouchers or enter promo codes with transparent subtotal/discount/total breakdowns.

### 1.2 In-Scope & Out-of-Scope
- **In-Scope**:
  - `hotel_voucher` and `hotel_voucher_redemption` schemas with additive migration.
  - Adding `subtotal`, `discount_amount`, `voucher_code` to `hotel_booking`.
  - APIs to list active vouchers, apply a voucher to a held booking, and remove a voucher.
  - Automatic quota management: increment on booking confirmation, decrement on cancellation/expiry.
  - Frontend checkout review enhancements with subtotal/discount breakdown and voucher picker.
  - Full EN/VI localization.
- **Out-of-Scope**:
  - Complex tiered loyalty points or wallet cash-back (reserved for Group C/D).
  - Multi-voucher stacking (strict 1 voucher per booking invariant).
  - Tour or restaurant voucher redemption (hotel direct bookings only in B01).

---

## 2. Architecture & Service Boundaries

- **`services/trip-service`**: Authoritative owner of hotels, bookings, payments, and voucher lifecycle.
- **`apps/web/tripsense`**: Renders voucher breakdown in `HotelCheckoutReview` component.
- All requests route through API Gateway.

---

## 3. Data Contracts & Schema

### 3.1 Migration
Additive Flyway migration: `V20261012180000__add_hotel_vouchers.sql`
- `hotel_booking`: adds `subtotal`, `discount_amount`, `voucher_code`.
- `hotel_voucher`: stores voucher definition, quotas, and validity.
- `hotel_voucher_redemption`: stores 1-to-1 booking-to-voucher redemption state.

### 3.2 REST APIs
- `GET /api/hotels/vouchers/available`: Returns available vouchers.
- `POST /api/hotels/bookings/{id}/voucher`: `{ "code": "WELCOME50" }` -> updates booking total.
- `DELETE /api/hotels/bookings/{id}/voucher` -> restores booking total.

---

## 4. Verification Evidence

- **Database**: Additive migration `V20261012180000__add_hotel_vouchers.sql` with sample seeded vouchers (`WELCOME50`, `SUMMER10`, `TRIPSENSE100`).
- **Backend**:
  - `HotelService.java`: `getAvailableVouchers()`, `applyVoucher()`, `removeVoucher()`, and lifecycle tracking in `adjust()` (increment on confirmation, rollback on cancellation/expiry).
  - `HotelController.java`: endpoints `/vouchers/available`, `/bookings/{id}/voucher` (POST & DELETE).
  - Integration tests in `HotelReservationIntegrationTest.java`:
    - `voucherDiscountPercentAndCap()`
    - `voucherDiscountFixedAndRemoval()`
    - `voucherMinOrderAndExpiryRejection()`
    - `voucherUsageCountTracksConfirmationAndCancellation()`
- **Frontend**:
  - `HotelCheckoutReview.tsx`: Cost breakdown (Tạm tính, Giảm giá voucher, Tổng thanh toán), voucher code input with validation, available vouchers sheet picker.
  - Unit tests in `hotel-checkout-review.test.tsx`.
- **Localization**:
  - Added all voucher keys with 100% parity across `en.json` and `vi.json`.

