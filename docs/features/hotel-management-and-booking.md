# Hotel Management & Booking

`STATUS: SUPERSEDED — IMPLEMENTATION PAUSED FOR REPLANNING`

2026-09-28: User requested a shared Partner role and business-specific onboarding/approval for hotels, restaurants and tour guides. [Partner Onboarding & Business Approval](./partner-onboarding-and-business-approval.md) is the current proposal. This document retains the earlier hotel reservation details for reuse; its old role/approval assumptions no longer authorize further implementation. Working-tree code is incomplete and has not been released.

Date: 2026-09-27. Implementation authorized by the user's attached instruction: “Sau đó triển khai trực tiếp trên codebase theo convention hiện tại.” This replaces the OTA-first feature scope; the earlier OTA plan is not the implementation contract.

## 1. Current architecture and scope

The Maven reactor contains discovery, gateway, place, mail, user, trip, social, context and recommendation services; AI is FastAPI and web is Next.js. PostgreSQL/Flyway are already used by Trip, User, Social, Context and Recommendation; Place uses MongoDB. Trip already has JWT authentication, property-independent trip ownership checks, Redis cache, transactions and real PostgreSQL tests. JWT carries user UUID/email/role; roles must never substitute for resource ownership. Mail uses Resend. Social realtime is conversation-specific SSE/FCM, not a generic notification inbox. Context/Recommendation already write transactional outboxes. No configured Kafka broker, Kafka client/consumer or payment implementation was found in the source/config audit.

Reuse Trip's PostgreSQL, security, exception/DTO conventions, Gateway routing, mail service and outbox approach. Add a bounded `hotel` module to **trip-service**: reservation lifecycle and its inventory must share one transaction. Hotel catalog is allocated inventory owned by this module, distinct from canonical POIs in Place. No new service, database, Redis instance, broker or Kafka topic. This is a pragmatic extension of reservation ownership, not cross-service data sharing.

Customer = existing authenticated user. Hotel Owner = authenticated user owning a registered property, not a client-selected global role. Admin = signed ADMIN role. Delegated staff management is deferred rather than granting broad permissions. Only verified ACTIVE properties sell; owner registration starts PENDING. Owner edits to public property identity return it to PENDING. Existing bookings remain cancellable. Admin can suspend/reactivate.

Initial payment method: PAY_AT_PROPERTY, with explicit confirmation and no claim of online payment. No payment callback or paid state is fabricated. A real payment provider requires its own verified integration; OTA/PMS/channel-manager integrations remain future work.

## 2. Invariants and lifecycle

- Inventory per `(room_type_id, stay_date)` stores allocation, held, booked, nightly price and stop-sell. CHECK constraints enforce nonnegative values and held + booked <= allocated.
- Stay interval is `[checkIn, checkOut)`; 1–30 nights, 1–10 rooms; capacity checked for all guests. Missing daily inventory means unavailable. Hotel timezone governs dates; check-in/out times are policy only.
- Lifecycle: HELD (10 minutes) -> CONFIRMED, EXPIRED or CANCELLED; CONFIRMED -> CANCELLED before check-in. Cancellation policy in this increment is free cancellation before check-in; explicitly displayed/snapshotted. No hourly booking.
- Lock property, then room type, then booking where applicable. This serializes reservations within one property and prevents inventory/management/expiration races. All daily changes occur in one local transaction; no cache decision controls a write. Availability revalidation at confirm verifies the hold remains counted and property is active, rows exist and capacity constraints hold. Stop-sell blocks new sales; an existing valid hold is honored.
- Hold idempotency `(customer_id, request_key)` is durable; changed input with same key yields 409. A user row in an idempotency lock table serializes concurrent retries even across properties. Confirm/cancel are naturally idempotent by locked lifecycle. Expired holds release once in the same transaction that changes state.
- Prices are computed server-side from every date and snapshotted on hold. Currency fixed VND for this increment. No trusting client prices, availability booleans or LLM totals.

## 3. API contracts

All public requests go through Gateway `/api/hotels/** -> trip-service`, authenticated with existing JWT. JSON DTOs follow Trip's direct response objects and ErrorResponse (`code/message/details`). Hotel management checks owner UUID; approval checks ADMIN server-side.

| Method / path relative to `/api/hotels` | Behavior |
| --- | --- |
| GET `/search?destination=&checkIn=&checkOut=&guests=&quantity=` | DB aggregate query: active property + all requested nights + sufficient inventory/capacity, bounded 50 results. |
| GET `/properties/{id}` | Active public details, or owner/admin view. |
| GET/POST `/properties` | Owner list / register `{name,destination,address,timeZone,checkInTime,checkOutTime}`. |
| PUT `/properties/{id}` | Owner updates identity/policy, re-verification required. |
| GET `/admin/properties` | Admin queue. |
| POST `/properties/{id}/status` | Admin `{status:ACTIVE|REJECTED|SUSPENDED}`. |
| GET/POST `/properties/{id}/rooms` | Owner room list/create `{name,capacity}`. |
| PUT `/properties/{id}/rooms/{roomId}/inventory` | Owner `{from,to,allocation,nightlyPrice,stopSell}`; exclusive end, max 366 days, cannot reduce below commitments. |
| GET `/properties/{id}/rooms/{roomId}/inventory?from=&to=` | Owner daily calendar. |
| POST `/holds` | Header `Idempotency-Key`, body `{roomTypeId,checkIn,checkOut,quantity,guests}` -> booking with server total, expiry, policy. |
| POST `/bookings/{id}/confirm` | Customer only; commits held inventory to booked, PAY_AT_PROPERTY. |
| POST `/bookings/{id}/cancel` | Customer or that property's owner; releases commitments once. |
| GET `/bookings` | Customer history. |
| GET `/properties/{id}/bookings` | Owner reservations. |
| GET `/notifications`, POST `/notifications/{id}/read` | Recipient-scoped inbox and idempotent read. |
| GET `/admin/deliveries` | Admin dead-letter inspection without email addresses/payload. |

## 4. Persistence and async side effects

One additive Flyway migration in Trip creates `hotel_property`, `hotel_room_type`, `hotel_inventory`, `hotel_booking`, `hotel_request_lock`, `hotel_outbox`, `hotel_notification`, `hotel_email_delivery`. UUID relationships stay inside Trip DB; user UUIDs have no foreign key to user-service. Query-driven indexes: destination/status, room/property, inventory composite PK, customer bookings, property bookings, held expiry, due outbox/email work and recipient unread notifications.

Booking status updates and outbox insert commit together. Event types: BOOKING_CONFIRMED, BOOKING_CANCELLED, BOOKING_EXPIRED, INVENTORY_LOW, PROPERTY_STATUS_CHANGED. Payload contains aggregate ID and recipient snapshots; owner/customer notifications are deduplicated by `(event_id,recipient_id)`. Worker claims with `FOR UPDATE SKIP LOCKED`, creates inbox entries and email jobs in a separate transaction. Email calls happen after booking commit and outside outbox DB transaction. No in-process fire-and-forget as the sole event record.

Email worker leases jobs, bounded retry (max 6 attempts; delays up to 1 hour); expired leases may retry with the SAME provider idempotency key and immutable payload. Failures never roll back a booking. Dead-letter state is durable and visible to Admin/logs/metrics. Never retry after 23 hours from first attempt: Resend deduplicates only within 24 hours ([official documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)). Ambiguous deliveries outside that window require manual reconciliation, not blind resend. Internal hotel-mail endpoint requires shared service secret, is outside Gateway routes, validates templates and never simulates success without credentials. No real email is sent during automated tests.

Rollback: disable routes/workers/UI, retain reservation tables and commitments for reconciliation. Do not drop live inventory or booking tables. No changes to existing Trip tables.

## 5. Security, performance and AI

Authenticate all endpoints; ownership checks on every property/room/reservation operation. Foreign IDs return 404; customer management attempts fail. Server supplies owner/customer IDs and email from verified JWT; clients cannot set these. Bounded strings/dates/quantities, allowlisted statuses, validated timezone/time and parameterized SQL. No secret/payment/raw provider payload logging. In-app inbox uses polling; existing chat SSE is not repurposed for hotel events.

Search uses one aggregate SQL query and bounded result set, no per-hotel ORM fetch. Initially no availability cache: optimize from measured query plans first. Booking always uses locked database rows. Property-level serialization favors correctness; finer room-level locks are a future optimization after measurement. Expiry batch bounded to prevent long transactions. Micrometer counters/logs track conflicts, expiry, dispatch failures, retries and dead letters with booking/event IDs, no PII. Kafka lag/DLQ metrics are not applicable until Kafka exists.

AI `search_hotels` calls actual Gateway-backed hotel search with destination/dates/guests/quantity; returns typed evidence and HOTEL_LIST artifact. AI never books automatically, guesses inventory, creates POI IDs or manufactures prices. Hotel cards link to the booking UI with request criteria. Historical hotel evidence is marked as a past observation; booking always rechecks database. Missing criteria causes clarification rather than invented defaults.

## 6. Implementation and acceptance

1. Add migration, validated DTOs, transactional catalog/inventory/reservation service and authenticated endpoints.
2. Add expiry/outbox/inbox/mail delivery worker and authenticated internal mail adapter.
3. Add Gateway route; frontend customer search/hold/confirm/cancel, owner property/room/calendar/reservations and Admin verification; notification inbox and localized errors.
4. Add AI search tool and grounded artifact rendering, preserving existing place/chat flow.
5. Verify real PostgreSQL concurrent last-room holds, missing date, rollback, expiry/confirm race, duplicate request, idempotent cancel/release, foreign-owner access, event dedupe and email retry. Run service tests, web type/i18n/tests/lint, AI tests. Review architecture/database/security/PR using repository skills.

Completion evidence and actual limitations will be recorded below; APPROVED does not mean implementation is already complete.
