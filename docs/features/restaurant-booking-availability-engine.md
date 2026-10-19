# Restaurant Booking Availability Engine — Specification & Implementation Plan

`STATUS: APPROVED`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `services/trip-service`, `services/api-gateway`, `apps/web/tripsense`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: Phase 1 (availability settings and capacity rules), Phase 2 (reservation transaction and API), Phase 3 (Partner and Traveller UI)
- **Related Existing Feature**: [Restaurant Menu AI Extraction & Reservation Integration](./restaurant-menu-ai-extraction-and-reservation-integration.md)

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Restaurant reservations currently store a requested start time and guest count. The API checks basic validity (future time, maximum 20 guests, and a hard-coded 180-day horizon), but it does not know the restaurant's opening hours, seating capacity, or how long a table is occupied. Multiple requests can therefore fit the current API rules while collectively exceeding capacity. Partner confirmation currently transitions a request without rechecking availability.

Add a deterministic availability engine owned by `trip-service`. Partners configure operating hours, reservation duration, booking capacity, and booking window rules. Travellers can see available start times; creating a request and confirming it both revalidate capacity inside a serialized database transaction.

### 1.2 User Flows & Journey

1. An authorized restaurant Partner configures its IANA time zone, weekly opening intervals, reservation duration, slot interval, guest capacity, minimum lead time, and maximum advance-booking window.
2. A Traveller selects a date and party size. The web app requests available start times for that restaurant and date.
3. The Traveller selects a returned time and submits a reservation. `trip-service` locks the restaurant's availability row, rechecks hours, booking window, and capacity, then creates a temporary capacity hold in `REQUESTED` state. If no longer available, the API returns a conflict and creates no reservation.
4. An OWNER or MANAGER reviews the request. Confirmation locks the same availability row, checks that the hold has not expired and revalidates the reservation against current settings and capacity before transitioning it to `CONFIRMED`.
5. Rejection, cancellation, or expiry releases the held capacity. The Traveller sees a safe message and can choose another available time after a conflict.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Partner management of weekly opening intervals, time zone, seating capacity (guest count), reservation duration, start-time slot interval, minimum booking lead time, maximum days in advance, and pending-request hold duration.
  - Public availability lookup by restaurant, local date, and party size. Return bookable start times and end times, without exposing exact remaining inventory.
  - Transactional availability validation before creating a request and again before Partner confirmation.
  - Temporary capacity holds for `REQUESTED` reservations with an expiry timestamp and an `EXPIRED` terminal state.
  - Capacity accounting across overlapping reservation intervals, using adults + children as occupied seats and half-open intervals `[start, end)`.
  - A consistent lock order for reservation creation, confirmation, cancellation/decision, expiry, and availability-setting updates.
  - Partner settings UI and Traveller time selection integrated into existing restaurant and reservation pages/API clients.
- **Out-of-Scope**:
  - Assigning physical table numbers, combining tables, table-specific capacities, floor plans, or inventory by seating section.
  - Special holiday/one-off closures, seasonal schedules, split shifts across overnight boundaries, waitlists, deposits/payments, SMS/email, and automated staffing estimates.
  - Availability or inventory for hotels, tours, guides, or non-restaurant businesses.
  - Predictive/AI-based capacity or ranking.

### 1.4 Acceptance Criteria

- [ ] **AC-1**: Partner settings accept valid IANA time zones and one or more non-overlapping local opening intervals for each weekday; invalid or overnight intervals are rejected with field-level validation.
- [ ] **AC-2**: Availability lookup returns only start times whose full configured reservation duration fits within opening hours and the lead-time/advance-booking window for the requested party size.
- [ ] **AC-3**: Creating a reservation outside opening hours, outside the booking window, or above overlapping guest capacity returns HTTP `409` with a stable code and creates no reservation or transition record.
- [ ] **AC-4**: Concurrent requests for the final seats cannot both acquire capacity; the database lock and transaction serialize competing creates.
- [ ] **AC-5**: `REQUESTED` and `CONFIRMED` reservations consume capacity while active; `REJECTED`, `CANCELLED`, and `EXPIRED` reservations do not.
- [ ] **AC-6**: A Partner confirmation rechecks hold expiry, current hours, and capacity, and cannot confirm an invalid or stale request.
- [ ] **AC-7**: Pending requests expire after the configured hold duration, release capacity, record an auditable transition, and notify the customer through the existing notification mechanism.
- [ ] **AC-8**: Availability configuration updates cannot silently invalidate future active reservations; invalidating updates fail with a conflict that identifies the affected date/time without exposing other customers' personal data.
- [ ] **AC-9**: Existing idempotency behavior, ownership checks, reservation history, and safe frontend error handling remain intact.
- [ ] **AC-10**: Public availability does not reveal customer identity, reservation details, or exact remaining seat counts.

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Partner / Traveller Web]
        | REST
        v
[API Gateway :8080] -> [Trip Service :8083] -> [Trip DB]
                              |                    |
                              | transaction + row lock
                              +--------------------+-- availability settings,
                                                       reservations, transitions
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Reuse existing Partner restaurant and Traveller reservation views; configure availability and show returned time slots | HTTP REST through API Gateway |
| `services/api-gateway` | Route existing `/api/restaurants/**` and `/api/partners/**` paths to Trip Service; preserve gateway authentication and rate-limit policy | Spring Cloud Gateway |
| `services/trip-service` | Own restaurant availability rules, capacity validation, holds, reservation state transitions, and authorization | Synchronous REST; local database transaction |
| Trip Service database | Persist settings, weekly intervals, reservations, and audit transitions | PostgreSQL / Flyway |

### 2.3 Architecture Guardrails Verification

- [x] Public traffic goes through the API Gateway.
- [x] Reservation and Partner business data are already owned by `trip-service`; no new service or cross-service database access is needed.
- [x] Do not add cross-service JPA relationships. `business_id` remains an ID/FK within Trip Service's own database.
- [x] Availability checks need an immediate, authoritative response, so the rule evaluation and reservation mutation are synchronous and transactional. No Kafka event is needed for the core invariant.
- [x] Use the restaurant's configured IANA time zone for local opening-hour and booking-window calculations; persist reservation instants as `TIMESTAMPTZ` as today.

## 3. API & Event Contracts

All public paths below are accessed through API Gateway. Existing gateway patterns already route `/api/restaurants/**` and `/api/partners/**` to Trip Service; add an explicit route only if route tests show the new path is not covered.

### 3.1 REST Endpoints

| Method | Gateway Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/restaurants/{businessId}/availability?date=YYYY-MM-DD&partySize=N` | Public | Return bookable start/end instants for one local date and party size |
| `GET` | `/api/partners/businesses/{businessId}/restaurant-availability` | OWNER/MANAGER | Read current restaurant availability settings |
| `PUT` | `/api/partners/businesses/{businessId}/restaurant-availability` | OWNER/MANAGER | Replace settings using an expected version; reject updates conflicting with future active reservations |
| `POST` | `/api/restaurants/{businessId}/reservation-requests` | Authenticated Traveller | Existing request endpoint; now validates and creates a capacity hold atomically |
| `POST` | `/api/partners/businesses/{businessId}/reservation-requests/{id}/decision` | OWNER/MANAGER | Existing decision endpoint; `CONFIRM` revalidates availability and hold expiry |

#### Availability Response

```json
{
  "businessId": "uuid",
  "date": "2026-10-22",
  "timeZone": "Asia/Ho_Chi_Minh",
  "partySize": 4,
  "slots": [
    {
      "startsAt": "2026-10-22T11:00:00+07:00",
      "endsAt": "2026-10-22T12:30:00+07:00",
      "available": true
    }
  ]
}
```

Return no slots for a closed date or a party size above configured capacity. Validate date range and party size at the API boundary. To limit load, availability lookup accepts one local date per request; a later multi-day calendar is out of scope.

#### Partner Settings Request

```json
{
  "expectedVersion": 3,
  "timeZone": "Asia/Ho_Chi_Minh",
  "capacityGuests": 40,
  "reservationDurationMinutes": 90,
  "slotIntervalMinutes": 30,
  "minimumLeadMinutes": 60,
  "maximumAdvanceDays": 90,
  "pendingHoldMinutes": 30,
  "openingIntervals": [
    { "dayOfWeek": 1, "opensAt": "10:00", "closesAt": "14:00" },
    { "dayOfWeek": 1, "opensAt": "17:00", "closesAt": "22:00" }
  ]
}
```

`dayOfWeek` uses ISO-8601 values 1 (Monday) through 7 (Sunday). Intervals are local wall-clock times and must satisfy `opensAt < closesAt`; overlapping intervals on the same weekday are invalid. `expectedVersion` protects Partner edits from lost updates.

#### Reservation Contract Changes

- Keep the existing create request DTO and idempotency key contract. Treat `startAt` as an instant and validate it in the restaurant's persisted time zone. Keep the current client `timeZone` field for wire compatibility, but do not use it to decide opening hours or booking windows; return the restaurant time zone in reservation DTOs.
- Add `endsAt` and `holdExpiresAt` to reservation response DTOs. Add `EXPIRED` to the documented state enum.
- Keep existing `REQUESTED`, `CONFIRMED`, `REJECTED`, `CANCELLED` states and transition endpoint. `REQUESTED` reserves capacity until rejection, cancellation, or expiry.
- Return HTTP `409` with stable domain codes such as `RESTAURANT_SLOT_UNAVAILABLE`, `RESTAURANT_BOOKING_WINDOW_CLOSED`, `RESERVATION_HOLD_EXPIRED`, `RESTAURANT_SETTINGS_CONFLICT`, and `VERSION_CONFLICT`. Do not expose raw exceptions.
- Idempotent retries with the same key and payload return the original reservation state and hold expiry; an expired request is not silently recreated.

### 3.2 Kafka Events

No new Kafka events. Existing Partner notifications and reservation transition records are updated in the same Trip Service workflow. The expiry worker uses existing notification persistence so it does not introduce a new service dependency.

## 4. Data Model & Migrations

### 4.1 Schema Definition

Use additive Flyway migrations in `services/trip-service`:

```sql
CREATE TABLE restaurant_availability (
    business_id UUID PRIMARY KEY REFERENCES partner_business(id),
    time_zone VARCHAR(80) NOT NULL,
    capacity_guests INTEGER NOT NULL CHECK (capacity_guests BETWEEN 1 AND 500),
    reservation_duration_minutes INTEGER NOT NULL CHECK (reservation_duration_minutes BETWEEN 15 AND 480),
    slot_interval_minutes INTEGER NOT NULL CHECK (slot_interval_minutes BETWEEN 5 AND 240),
    minimum_lead_minutes INTEGER NOT NULL CHECK (minimum_lead_minutes >= 0),
    maximum_advance_days INTEGER NOT NULL CHECK (maximum_advance_days BETWEEN 1 AND 365),
    pending_hold_minutes INTEGER NOT NULL CHECK (pending_hold_minutes BETWEEN 5 AND 1440),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restaurant_opening_interval (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES restaurant_availability(business_id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    CHECK (opens_at < closes_at)
);

ALTER TABLE restaurant_reservation_request
    ADD COLUMN ends_at TIMESTAMPTZ,
    ADD COLUMN hold_expires_at TIMESTAMPTZ;
```

Migration must backfill reservations safely: settings are created when a Partner first configures availability; existing reservations remain readable. For any restaurant with reservations but no settings, do not invent opening hours or capacity. Require Partner setup before accepting new requests and retain existing reservation decisions; confirmation of legacy requests must follow an explicit compatibility rule in implementation (recommended: allow confirmation only after settings exist and the request passes current rules). Extend the reservation state constraint to include `EXPIRED`; update the `ends_at` and `hold_expires_at` rules for newly created requests.

Add indexes supporting capacity overlap queries and expiry scans, e.g. `(business_id, state, start_at, ends_at)` and a partial index on `hold_expires_at WHERE state = 'REQUESTED'`. Verify PostgreSQL query plans before choosing a range/exclusion index; a simple index is adequate for MVP scale.

### 4.2 Capacity and Lifecycle Invariants

1. Party size equals `adults + children`; it consumes one seat per person. Existing per-request max of 20 remains.
2. A reservation occupies `[start_at, ends_at)`, with `ends_at = start_at + reservation_duration_minutes` captured at request creation. Adjacent bookings where one ends exactly as the next starts do not overlap.
3. To validate a candidate, calculate the peak sum of guests from active overlapping requests at every boundary within the candidate interval, then add the candidate party size; it must not exceed `capacity_guests`.
4. `REQUESTED` counts only while `hold_expires_at > now()`. A background worker marks elapsed requested holds `EXPIRED`, records the transition, and releases capacity. The transactional capacity query also ignores already elapsed holds so delayed worker execution does not block inventory.
5. A single `restaurant_availability` row is locked for update before evaluating capacity and mutating a reservation. Use the same lock order (availability row, then reservation row) for create, Partner decision, customer cancellation, expiry, and settings updates to avoid races/deadlocks. When confirming an existing request, exclude that request from the competing-load calculation before adding its party size, so its already-held capacity is not counted twice. Retry/idempotency lookup must remain safe under this lock.
6. Settings updates are rejected if they would make any future, unexpired `REQUESTED` or `CONFIRMED` reservation fall outside opening hours, exceed capacity, or violate the new booking window. Partner must resolve impacted requests first.

### 4.3 Migration Strategy

- Use a new additive Flyway migration; do not edit previously applied migration files.
- Preserve existing reservation rows, request keys, transitions, and API paths.
- Rollback is forward-only in normal environments: disable new availability endpoints/creation enforcement behind a configuration flag if rollback is required; do not drop data or silently restore capacity-blind accepts.

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| Authentication | Availability lookup is public only for published, eligible restaurants; settings and decisions require authenticated OWNER/MANAGER membership. |
| Authorization / IDOR | Resolve `businessId` and membership in `trip-service`; never trust client claims or a business role alone. Return not-found semantics for foreign reservation IDs. |
| Input validation | Validate IANA `ZoneId`, ISO day values, interval order/non-overlap, limits, date range, party size, and expected version. Use bounded API parameters to prevent expensive availability scans. |
| Capacity tampering | Compute duration, time zone, capacity, and hold expiry from persisted Partner settings. Do not accept these values from a Traveller request. |
| Public inventory leakage | Return bookable slots only; do not return remaining seats, other reservation data, customer details, or internal capacity calculations. |
| Error handling | Map domain conflicts to stable codes and safe messages; follow `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`; never expose SQL/JDBC or stack traces. |
| Abuse | Apply existing Gateway authentication/rate limits and cap availability lookups to one restaurant/date and a validated party size. |

## 6. Devil's Advocate & Technical Trade-offs

| Concern | Decision / Trade-off |
| --- | --- |
| Pending request holds may block capacity if Partners do not respond | Hold `REQUESTED` inventory for a bounded configurable duration (recommended default 30 minutes); expire automatically and notify the Traveller. This avoids indefinite holds while giving the current manual-confirmation workflow time to respond. |
| Capacity versus physical tables | MVP capacity is aggregate guests, not a table-allocation solver. This prevents overbooking by seats but cannot guarantee a particular table layout. |
| Concurrent last-seat requests | A check without a lock is unsafe. Serialize all capacity-affecting operations on the restaurant availability row inside the same database transaction; retain unique idempotency constraints as a separate retry guarantee. |
| Time-zone/DST edge cases | Store opening intervals as local time plus IANA zone and reservations as instants. Reject ambiguous/nonexistent local instants or define a deterministic conversion rule in the API adapter; test DST transitions even if Vietnam has no current seasonal DST. |
| Settings updates versus existing bookings | Reject changes that invalidate future active reservations. This is more restrictive for Partners but avoids silently breaking accepted commitments. |
| Old C06 design allowed multiple requests at the same time and had Partner manually check capacity | This feature intentionally supersedes that capacity-blind behavior for new requests. Update the old feature document's current-state note only after this plan is approved and implemented; until then it remains historical reference. |
| Opening interval exceptions | Weekly repeating hours keep MVP simple. Holidays, temporary closures, and overnight intervals are deferred and should be considered before production launch if restaurants need them. |

## 7. Phased Implementation Tasks & Verification

### Phase 1: Data Model & Availability Domain

- [ ] Add Flyway migration for availability settings, weekly opening intervals, reservation end/hold expiry, and `EXPIRED` state.
- [ ] Add Trip Service entities/repositories/DTOs with optimistic settings versioning and a pessimistic lock query for the availability row.
- [ ] Implement a pure deterministic interval/capacity evaluator and boundary tests for adjacency, overlaps, party-size sums, local opening hours, lead time, advance window, and DST cases.
- [ ] Decide and implement compatibility for existing reservations lacking availability settings; do not silently fabricate capacity.

### Phase 2: Reservation Transaction, API & Expiry

- [ ] Add Partner settings GET/PUT and public date availability GET endpoints.
- [ ] Update reservation create to validate availability, hold capacity, preserve idempotency, and return safe conflict codes.
- [ ] Update Partner confirm, cancellation, rejection, and settings update to use the shared lock order and revalidation rules.
- [ ] Add expiry worker with bounded batches, transition audit, and existing customer notification persistence; make processing idempotent across multiple service instances.
- [ ] Add/verify Gateway route and controller/service integration tests using PostgreSQL/Testcontainers for concurrent requests and migrations.

### Phase 3: Web Integration

- [ ] Reuse existing Partner restaurant reservation/settings surfaces to edit weekly hours, duration, capacity, and advance/hold limits.
- [ ] Reuse existing reservation dialog/API client to fetch available slots after date and party-size selection; submit through the existing create endpoint and handle `409` with refresh guidance.
- [ ] Display hold expiry to Partner and Traveller; handle `EXPIRED` in existing reservation lists and localization.
- [ ] Keep UI errors sanitized and add parity entries for English and Vietnamese locale namespaces.

### Verification Commands

```bash
# Backend unit + integration tests (including PostgreSQL/Testcontainers capacity races)
./mvnw -pl services/trip-service test

# Gateway route tests
./mvnw -pl services/api-gateway test

# Frontend checks
cd apps/web/tripsense && npm run i18n:check && npm test -- --runInBand
```

## Human Approval Gate

```text
STATUS: APPROVED
```

Kế hoạch này đã được người dùng duyệt triển khai vào ngày 2026-10-19. Tiến hành triển khai theo các pha đã định nghĩa.
