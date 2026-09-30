# Hotel payOS payment — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- Date: 2026-09-30.
- Owner: `services/trip-service`; affected: `apps/web/tripsense`, existing API Gateway hotel route, backend environment/configuration.
- Approval: human approved session plan through the plan approval gate on 2026-09-30.
- Implementation: completed. Verified official payOS API/SDK (v2, SDK 2.0.1). Ready for test verification.
- Related: [demo commerce](hotel-demo-commerce-and-pr66-remediation.md), [partner ownership](partner-onboarding-and-business-approval.md), [architecture](../architecture/tripsense-architecture.md), [boundaries](../architecture/service-boundaries.md), [workflow](../workflows/multi-agent-feature-workflow.md).

## 1. Goal, scope and acceptance

Add hosted payOS checkout to existing hotel reservation review. Existing checkout supports `DEMO_ONLINE` and `PAY_AT_PROPERTY`; this increment introduces `PAYOS` for new bookings when explicitly enabled. Preserve legacy bookings and pending uncommitted work.

Flow: authenticated customer creates hold, reviews authoritative total/cutoff, requests a payment link, completes hosted provider checkout, then views backend-confirmed booking/payment status. Provider callbacks arrive through Gateway. A return URL never establishes that money was received.

Acceptance:
- Both `hotel-search.tsx` and `mindtrip-available-rooms-view.tsx` reuse `HotelCheckoutReview` for payOS; reload/retry/double-click cannot create independent payable links for one booking.
- Backend owns amount, currency, order code, expiry and return URLs. VND total must be a positive exact integer within verified provider limits; reject rather than silently round.
- Online bookings cannot bypass payment through `/confirm`, demo endpoints, crafted return URLs or unverified callbacks.
- Signature, order/payment-link identity, amount/currency and authoritative provider state are checked before confirmation.
- Capture, booking confirmation, inventory mutation and notification outbox commit consistently, once. Expired/cancelled holds never regain released stock.
- Late/extra/partial/mismatched receipts remain auditable and enter refund/manual-review handling rather than disappearing or pretending to be refunded.
- Demo ledger and real-money records remain separate. Real transactions cannot invoke demo settlement or display fake 10% commission/net/payout.
- UI, history and notifications distinguish actual payment, simulation, pay-at-property, pending verification and refund-required.

Out of scope: automatic refunds, partner payout/split payment, real-money commission, wallet/cards, guide or restaurant bookings. Refund-required means manual handling outside TripSense, not money already returned. Live activation requires merchant readiness and an operator responsible for reconciliation/refunds.

## 2. Architecture and reuse

Use existing trip-service and its PostgreSQL/Flyway data. No new microservice, cross-service DB access, JPA relationships or Kafka topic. Reuse hotel outbox and job infrastructure.

Inspected reuse points:
- `HotelService`: `hold`, `transitionLocked`, `expireProperty`, `adjust`, `propertyCancel`, `bookingDetail`, `event`, `commerce`.
- `HotelJobs.tick`, `dispatch`, and lease/retry pattern in `deliver`.
- `HotelController`/`HotelResponseAdvice` standard `{success,data}` responses.
- `GatewayRoutesConfig`: `/api/hotels/**` already routes to trip-service with no-store and rate limiting.
- Web `HotelCheckoutReview`, `hotelApi`/`apiClient`, `bookingIntentKey`/`clearBookingIntent`, `getSafeErrorMessage`, i18n.
- Existing `HotelReservationIntegrationTest` uses Testcontainers/MockMvc.

One concrete payOS client/service, not a payment framework. Prefer official Java SDK for provider signing/canonicalization; pin a verified compatible version rather than inventing the protocol.

### Mandatory provider-contract verification before application code

Read official `https://payos.vn/docs/` and Java SDK sources/docs; record exact source/version here. Verify create/get/cancel payment-link contracts, amount/orderCode limits and uniqueness, expiration, duplicate orderCode semantics, webhook verification/canonicalization, registration validation callback, ACK/retry behavior, checkout host and transaction reference representations. On 2026-09-30, the user fetched official `https://payos.vn/docs/api/` successfully. Inspected HTML confirms production origin `https://api-merchant.payos.vn`, create `/v2/payment-requests`, lookup `/v2/payment-requests/{id}` (order code or link ID), cancellation `/v2/payment-requests/{id}/cancel`, integer orderCode/amount, expiredAt as Unix timestamp Int32, and create HMAC_SHA256 input sorted as `amount=...&cancelUrl=...&description=...&orderCode=...&returnUrl=...`. It also documents `/confirm-webhook` sending a sample transaction to validate the callback. Java SDK version, full webhook verification/ACK behavior, recovery semantics and numeric limits remain unverified; network tools still fail because the permission classifier is unavailable. Do not implement from guesses; reopen planning if verified contracts invalidate this design.

### Configuration

Backend-only placeholders: `PAYOS_ENABLED=false`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_RETURN_BASE_URL`.

- Credentials shared in chat must be rotated; never copy values to tracked files, logs, frontend, commands or docs.
- Validate required secrets/origin when enabled, fail closed rather than silently switch to demo.
- Do not enable payOS and creation of demo bookings simultaneously. Method is snapshotted on each booking; configuration changes never reclassify old bookings.
- Return/cancel URLs derive from trusted configured web origin plus booking UUID, not request body/Host headers.
- Disabling new payOS sales must preserve callback/reconciliation capability for existing links. Retain backend credentials while financial obligations remain unresolved.
- Compose defaults preserve current demo setup; sample config has placeholders only. No automatic webhook registration, production deployment or live-money smoke test.

## 3. API and event contracts

All public requests go through Gateway, no-store.

| Endpoint | Authorization | Contract |
| --- | --- | --- |
| POST `/api/hotels/bookings/{id}/payos-payment` | JWT, owning customer | No client amount/outcome/return URL. Create/retrieve single persisted payment link for booking; booking ID is natural idempotency identity. |
| GET `/api/hotels/bookings/{id}/payment` | Owning customer; authorized business manager/Admin read-only | Read local reconciled status, not provider HTTP call per UI poll; checkout URL visible only to customer. |
| POST `/api/hotels/payments/payos/webhook` | No JWT; mandatory provider authentication/signature | Durable idempotent receipt handling; provider-specific ACK, not TripSense envelope. |
| GET `/api/hotels/commerce/config` | Existing auth | Add `onlineProvider: "PAYOS" | null`; retain old fields. |
| GET `/api/hotels/commerce` | Existing customer/member/Admin ownership checks | Add provider discriminator and real received amount; no simulated commission/payout for payOS. |

Application response under `{success,data}`:
```json
{
  "booking": "existing HotelBooking DTO",
  "payment": {
    "provider": "PAYOS",
    "state": "PENDING",
    "amount": 1000000,
    "currency": "VND",
    "checkoutUrl": "validated provider URL or null",
    "expiresAt": "ISO timestamp",
    "resolution": "NONE",
    "lastCheckedAt": "ISO timestamp or null"
  }
}
```

Domain state: `CREATING | PENDING | PAID | CANCELLED | EXPIRED | FAILED`. Resolution: `NONE | REFUND_REQUIRED | REVIEW_REQUIRED`. Explicit mapping from verified provider contract; do not assume provider enums match.

POST: 200 established result, 202 creation unknown/reconciling, 400 invalid input, 401 authentication, 404 foreign booking, 409 hold/method conflict, 503 configuration/provider unavailable. UI must distinguish pending verification from proof of non-payment.

Webhook controller separate from HotelController so HotelResponseAdvice does not wrap ACK. Permit only exact webhook POST in trip-service SecurityConfig. Existing Gateway route is sufficient unless provider callback/rate-limit verification requires a dedicated POST route; do not open all hotel endpoints. Provider registration test callbacks must not create real payment/booking data.

Reuse local booking outbox events; add explicit paid/refund-required notification types only as needed. No Kafka integration introduced.

## 4. Data model and migration

New additive Flyway migration; do not edit applied migrations or convert demo rows.

```sql
CREATE SEQUENCE hotel_payos_order_code_seq;
CREATE TABLE hotel_payos_payment (
  booking_id uuid PRIMARY KEY REFERENCES hotel_booking(id),
  order_code bigint NOT NULL UNIQUE DEFAULT nextval('hotel_payos_order_code_seq'),
  payment_link_id varchar(128) UNIQUE,
  amount bigint NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL CHECK (currency = 'VND'),
  state varchar(20) NOT NULL CHECK (state IN
    ('CREATING','PENDING','PAID','CANCELLED','EXPIRED','FAILED')),
  resolution varchar(24) NOT NULL DEFAULT 'NONE' CHECK (resolution IN
    ('NONE','REFUND_REQUIRED','REVIEW_REQUIRED')),
  checkout_url text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  last_checked_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error_code varchar(64)
);
CREATE INDEX hotel_payos_payment_reconcile
  ON hotel_payos_payment(next_attempt);
CREATE TABLE hotel_payos_receipt (
  id uuid PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES hotel_payos_payment(booking_id),
  provider_reference varchar(128) NOT NULL UNIQUE,
  received_amount bigint NOT NULL CHECK (received_amount > 0),
  currency varchar(3) NOT NULL,
  received_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
```

Before implementation, complete sequence upper bound/reference lengths from official contract. Never reset order sequence while merchant history exists; deployments sharing a merchant need disjoint order-code allocation.

Receipt is append-only verified evidence without raw webhook/PII. Unique provider reference distinguishes replay from additional transfers. Partial/extra/mismatched money enters manual review; compare authoritative link status and cumulative received amount before fulfilment rather than assuming each callback equals entire invoice.

Rollback: disable issuing links, preserve historical tables/records, continue callbacks/reconciliation; no destructive drops or method conversion.

## 5. Security, concurrency and failure handling

### Creation and crash recovery

Short local transaction validates ownership, booking method/hold, eligibility and amount, then reserves payment row/orderCode. Provider HTTP happens outside row locks with bounded timeouts. Persist result under a second transaction without overwriting an earlier PAID webhook result.

Requests/workers claim existing payment work with persisted lease, not in-memory idempotency. All retries use same orderCode. After crash/timeout, query existing provider link before retrying creation. Never generate a fresh code to escape uncertain results; if provider cannot support safe recovery, keep pending/review.

Provider expiry never exceeds existing ten-minute hold; retries do not extend hold.

### Finalization and cancellation

- Webhook and reconciliation call one shared idempotent finalizer.
- Reuse HotelService guard/inventory/outbox logic through minimal internal methods, not forged AuthenticatedUser or demoCapture bypass.
- Affected mutation paths use consistent lock order: property, business where needed, booking, payment. Never lock payment first then call HotelService in reverse order.
- Paid plus valid HELD booking: receipt/payment + confirmation + stock + outbox in one local transaction.
- Paid after expiry/cancel or invalid safety/availability: commit money evidence and refund-required, do not resurrect booking. Invalid still-held booking ends/releases stock once.
- Business validation cannot erase evidence of receipt via transaction rollback. Infrastructure errors retry; ACK only after durable processing.
- Customer/property cancellation retains current policy. PAYOS marks refund-required instead of calling refundDemo; cancellation of a provider link is not refunding a transfer.
- Unpaid cancel/expiry queues provider cancellation/reconciliation. Late paid can supersede local cancelled/expired payment state; stale pending/cancel responses cannot downgrade PAID.

### Reconciliation

Reuse HotelJobs scheduler and lease/backoff pattern, small bounded batches, all external calls outside DB transactions. Include uncertain creation and links whose local booking has ended but provider outcome remains unknown. Exhausted retries create REVIEW_REQUIRED and operator signal, not silent loss. Valid callbacks remain processable. payOS failures must not block expiry/mail work.

No raw provider exception/credentials/SQL in API or logs. Validate webhook size/shape and signature before business handling; ownership enforced server-side on every customer action. Checkout URLs HTTPS and restricted to officially verified provider host; return origins trusted. Rate-limit without preventing legitimate callback retries.

## 6. Web and notification changes

- HotelCheckoutReview branches explicitly on PAYOS, DEMO_ONLINE, PAY_AT_PROPERTY. Unknown method fails closed rather than defaulting to `/confirm`.
- Use hosted checkout redirect, not embedded SDK/custom QR renderer.
- New `/hotels/payment-result/[bookingId]` under main route group: recover auth using existing login flow, retrieve booking/payment through hotelApi, bounded polling with cleanup, refresh/retry and safe inline status/error.
- Browser query parameters never mutate booking/payment. Return and cancel can land on same route; cancellation needs existing authenticated action.
- History reopens unexpired checkout and reads persisted result after reload. No dependence on lost modal state.
- HotelCommerce uses provider discriminator; actual received amount and pending review/refund state for payOS, no demo settlement action or fabricated commission/net.
- HotelJobs.dispatch explicitly distinguishes PAYOS confirmation from pay-at-property, plus refund-required messaging.
- en/vi parity, trip.commerce/common namespaces, getSafeErrorMessage, accessible status/alert/loading controls. Read local Next.js docs before route implementation.

## 7. Implementation tasks and verification

1. Verify official contract/SDK, fill confirmed references/version and limits in this spec; revise approved plan if contract changes alter scope.
2. Add migration/client/payment lifecycle/webhook/security/reconciliation, extend shared cancellation/confirmation without regressions.
3. Add backend tests using existing infrastructure; no new testing framework.
4. Update shared checkout, result route, history/commerce/notifications, bilingual strings and tests.
5. Architecture/database/security/PR review using repo review skills; execute checks and record actual results before DONE.

Files: hotel package (HotelService, HotelController/DTOs, HotelJobs, new concrete PayOsClient/PayOsPaymentService/webhook controller); trip-service SecurityConfig, pom/config and Flyway; compose placeholder environment; web hotel-checkout-review/hotel-commerce/hotel-search/types; new result page; en/vi locales and targeted backend/frontend tests. Gateway code only if verified route behavior requires it.

Backend cases: auth/IDOR, unpaid confirm bypass, valid/invalid/tampered signatures, replay, order/link/amount mismatch, integer validation, concurrent create, crash/timeout recovery, webhook before create response, expiry/cancel/capture races, business suspension, extra/partial receipts, stale reconcile, validation callbacks, disabled/missing configuration, demo isolation, worker failure isolation. Signing tests use official vectors/SDK, not self-consistent invented algorithms.

Frontend cases: both checkout callers; PAYOS never posts demo/confirm; reload result; forged-success URL remains pending; pending/unavailable/expired/refund-required UI; lost auth; safe errors; demo settlement unavailable for real transactions.

Commands in corresponding service/app directories:
```bash
# services/trip-service (JDK21, isolated Testcontainers DB)
./mvnw test
# services/api-gateway, if touched
./mvnw test
# apps/web/tripsense
npm run i18n:check
npm run type-check
npm test
npm run lint -- --quiet
npm run build
```
Windows may use `mvnw.cmd test`. Existing integration tests truncate tables; never target user/shared DB.

Browser E2E against stub provider first, through Gateway and both UI entry points. Live test only after fresh secrets configured privately, public HTTPS webhook ready and separate explicit approval for real transaction. No external registration/deployment or payment authorized by this planning approval alone.

## Progress / blockers

- Approved design saved; application code unchanged.
- 2026-09-30: official-doc fetches and agent calls returned classifier-unavailable errors. Provider protocol/SDK verification remains blocking. No API calls using supplied credentials, no real transactions, no tests executed for this unimplemented feature.
