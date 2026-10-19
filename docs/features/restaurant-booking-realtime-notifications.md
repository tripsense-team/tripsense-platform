# Restaurant Booking Real-time Notifications — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `services/trip-service`, `services/api-gateway`, `apps/web/tripsense`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: Phase 1 (transactional notification/outbox), Phase 2 (authenticated SSE and Gateway), Phase 3 (notification center integration and recovery)
- **Related Features**: [Unified Notification Center](./unified-notification-center.md), [Restaurant Menu and Reservation](./restaurant-menu-ai-extraction-and-reservation-integration.md), [Restaurant Booking Availability Engine](./restaurant-booking-availability-engine.md)

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

TripSense already persists Partner notifications in `partner_notification`, exposes APIs to list and mark them read, and maps restaurant reservation event types in the unified notification center. Restaurant request creation creates a Partner notification; Partner confirmation/rejection creates a Traveller notification. The current web hook refreshes notification data by polling, so updates can be delayed and event delivery is not coordinated with database persistence.

Deliver new restaurant booking notifications promptly to online users while keeping the existing persisted inbox authoritative. A Traveller must receive a durable notification when a Partner confirms or rejects their reservation. Active OWNER/MANAGER members must receive a durable notification when a Traveller submits a request. SSE is an invalidation/delivery hint; REST remains the recovery path after reconnect or offline time.

### 1.2 User Flows & Journey

1. A Traveller submits a restaurant reservation. In the same Trip Service database transaction, the service persists the reservation transition, one notification for the Traveller, one notification per active OWNER/MANAGER, and corresponding outbox records.
2. When the transaction commits, an outbox publisher sends recipient-scoped notification-change events through existing Redis pub/sub to Trip Service instances.
3. An authenticated SSE connection delivers a minimal `notification.changed` signal to that user's active browser sessions. The web notification center refetches the existing REST notification feeds and updates the bell badge/list.
4. If a user is offline, Redis is unavailable, a stream reconnects, or an event is duplicated, the committed `partner_notification` record remains available through REST. The client performs a full REST reconciliation at initial load, after reconnect/focus, and on a bounded fallback interval.
5. The Traveller or Partner opens/marks a notification read through existing APIs. Authorization remains recipient-specific.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Real-time notification updates for `RESTAURANT_RESERVATION_REQUESTED`, `RESTAURANT_RESERVATION_CONFIRMED`, and `RESTAURANT_RESERVATION_REJECTED`.
  - Atomic persistence of reservation transitions, notification rows, and notification outbox records in Trip Service.
  - Idempotent outbox publishing and recipient-scoped SSE delivery across Trip Service instances using existing Redis infrastructure.
  - Reuse the current `partner_notification` table, notification list/read endpoints, notification center, authenticated fetch-stream helper, and booking event mappings wherever possible.
  - Reconnect, duplicate-event, offline, and fallback REST reconciliation behavior.
- **Out-of-Scope**:
  - Creating the planned `notification-service` or moving existing notification tables across services.
  - WebSocket, mobile push/FCM, browser push permission, email/SMS delivery, notification preferences, and marketing notifications.
  - Realtime delivery for every notification category (trip invitations, hotel, chat, admin, reviews); existing sources and their update behavior remain as-is.
  - Sending reservation or customer details in SSE payloads.

### 1.4 Acceptance Criteria

- [ ] **AC-1**: A committed restaurant request creates a durable `RESTAURANT_RESERVATION_REQUESTED` notification for each active OWNER/MANAGER member and the existing `RESTAURANT_RESERVATION_PLACED` acknowledgement for the Traveller.
- [ ] **AC-2**: A committed Partner confirmation or rejection creates exactly one durable notification for the reservation's Traveller with the matching event type.
- [ ] **AC-3**: A failed reservation/transition transaction creates neither a visible notification nor a publishable outbox event; notification persistence errors are not swallowed while booking state commits partially.
- [ ] **AC-4**: When a recipient has an active stream and the service/Redis path is healthy, the web notification center refreshes its REST feed promptly (target p95 <= 3 seconds after commit).
- [ ] **AC-5**: SSE is recipient-scoped from the authenticated principal. A client cannot subscribe to another user's ID or business ID.
- [ ] **AC-6**: SSE data contains only a minimal invalidation envelope and no reservation notes, customer contact details, Partner private data, or raw exception content.
- [ ] **AC-7**: Redis outage, publisher restart, disconnected browser, duplicate event, or expired stream cannot delete a committed notification. Reconnect and REST reconciliation restore the correct list/unread state.
- [ ] **AC-8**: Mark-read and mark-all remain durable and recipient-authorized; refreshing after SSE does not mark notifications read implicitly.
- [ ] **AC-9**: Outbox processing is at-least-once and safe to retry; duplicate SSE invalidations only cause a bounded/refetch-coalesced update.
- [ ] **AC-10**: Gateway does not buffer/cache the SSE response, and frontend follows existing safe error handling and i18n rules.

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Traveller / Partner Web]
   | REST list/read + authenticated SSE
   v
[API Gateway :8080] -> [Trip Service :8083] -> [Trip DB]
                              |                    |
                              | commit transaction +-- reservation transition
                              |                       partner_notification
                              |                       notification_outbox
                              v
                         [Redis Pub/Sub]
                              |
                              v
                    [Trip Service SSE sessions]
                              |
                              +---- notification.changed to authenticated recipient
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Keep existing inbox as source of rendered notifications; subscribe to SSE and refetch feeds on invalidation/reconnect | Authenticated fetch-stream + existing JSON REST via Gateway |
| `services/api-gateway` | Route and stream `/api/partners/notifications/events`; pass through streaming headers and disable response buffering/cache | Spring Cloud Gateway |
| `services/trip-service` | Own restaurant booking transitions, durable notification rows/outbox, recipient checks, publisher, and SSE sessions | PostgreSQL transaction, Redis Pub/Sub, REST/SSE |
| Redis | Fan out ephemeral invalidation messages between Trip Service instances | Pub/Sub; not a durable source of truth |

`notification-service` remains planned and is not introduced by this feature. `social-service` chat SSE remains chat-specific and will not be repurposed for booking notifications.

### 2.3 Architecture Guardrails Verification

- [x] Public requests go through the API Gateway.
- [x] Booking and the existing recipient notification table are owned by Trip Service; no cross-service database access or new JPA relationship is needed.
- [x] The reservation state, notification rows, and outbox records commit in one local transaction.
- [x] SSE/Redis are delivery mechanisms only. PostgreSQL remains the source of truth; missed realtime signals are repaired through existing REST feeds.
- [x] No Kafka topic or new microservice is needed for this bounded notification flow.

## 3. API & Event Contracts

### 3.1 REST and SSE Endpoints

Reuse the current list/read APIs:

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/partners/notifications` | Bearer JWT | Existing durable notification feed for the authenticated recipient |
| `POST` | `/api/partners/notifications/{id}/read` | Bearer JWT | Existing recipient-only mark-read endpoint |
| `POST` | `/api/partners/notifications/read-all` | Bearer JWT | Existing recipient-only mark-all endpoint |
| `GET` | `/api/partners/notifications/events` | Bearer JWT | New authenticated `text/event-stream`; subscription is derived only from the JWT principal |

The SSE endpoint returns `Cache-Control: no-store`, `X-Accel-Buffering: no`, and a bounded connection lifetime (recommended five minutes) with heartbeat comments. Use the web app's existing authenticated fetch-stream path so bearer-token refresh and cancellation work; do not use native `EventSource` if it cannot attach the current authorization header.

#### SSE Envelope

```text
event: notification.changed
data: {"category":"PARTNER","reason":"RESTAURANT_RESERVATION_UPDATED"}
```

The payload is an invalidation hint; it contains no customer/business identifiers. The client refetches existing authorized REST feeds and coalesces bursts. No durable SSE cursor is required because REST reconciliation is authoritative. Redis payloads include recipient routing metadata internally, but the server removes it before writing to the stream.

### 3.2 Durable Notification and Outbox Contract

- Continue using `partner_notification` for reservation notifications consumed by the unified notification center. Keep the existing `event_type`, `business_id`, message, `read_at`, and recipient semantics.
- Use a stable event/transition ID as `partner_notification.event_id`; `(event_id, recipient_id)` remains the deduplication key. Do not generate a fresh event ID when retrying the same business transition.
- Insert one outbox record per notification in the same database transaction. Outbox records contain only notification ID, recipient ID, event type, creation time, retry/lease state, and last delivery metadata; no rendered message or private booking notes are copied into Redis.
- A bounded background publisher claims pending outbox rows with a lease/`SKIP LOCKED`, publishes `notification.changed` to a private Redis channel, and marks the row published only after Redis accepts the publish. Retry with capped exponential backoff; surface repeated failures through existing operational logs/metrics without logging message contents or credentials.
- Delivery is at-least-once. Browser handlers are idempotent invalidations, not notification creation; a duplicate signal cannot duplicate durable inbox rows.

### 3.3 Booking Event Matrix

| Booking transition | Durable recipients | Notification event type | Realtime behavior |
| --- | --- | --- | --- |
| `NONE -> REQUESTED` | Active OWNER/MANAGER members of that business; customer acknowledgement remains available | `RESTAURANT_RESERVATION_REQUESTED`; existing `RESTAURANT_RESERVATION_PLACED` | Publish one invalidation per recipient after commit |
| `REQUESTED -> CONFIRMED` | Reservation customer | `RESTAURANT_RESERVATION_CONFIRMED` | Publish after commit |
| `REQUESTED -> REJECTED` | Reservation customer | `RESTAURANT_RESERVATION_REJECTED` | Publish after commit |

The request/decision transaction remains the source for notification creation. Repeated idempotency requests or stale/invalid decisions must not produce a second notification.

## 4. Data Model & Migrations

### 4.1 Schema Definition

The existing `partner_notification` table already has `UNIQUE(event_id, recipient_id)`, recipient/read timestamps, and a recipient/time index. Preserve that schema unless implementation finds an integrity gap. Add an outbox table in a new additive Flyway migration owned by `trip-service`:

```sql
CREATE TABLE notification_realtime_outbox (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES partner_notification(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_until TIMESTAMPTZ,
    lease_token UUID,
    last_error_code VARCHAR(60),
    UNIQUE(notification_id)
);

CREATE INDEX idx_notification_outbox_pending
    ON notification_realtime_outbox(next_attempt_at, created_at)
    WHERE published_at IS NULL;
```

The outbox is delivery bookkeeping, not a second notification inbox. Retain published rows for an operationally defined window before bounded cleanup, or retain them if volumes remain small. Never delete unread `partner_notification` rows as part of outbox cleanup.

### 4.2 Transaction and Delivery Invariants

1. Validate recipient IDs from the persisted reservation and active business membership; never accept a recipient from the request body.
2. Persist reservation transition, notification, and outbox row atomically. Any database error rolls back the transition rather than being caught and ignored.
3. Publish only committed outbox rows. A crash after commit leaves a retryable row; a crash after Redis publish but before marking it published can cause a duplicate signal, which is safe.
4. Redis is ephemeral. If Redis publishes while no session is active, the notification remains in `partner_notification`; reconnection triggers REST reconciliation.
5. SSE session maps are local to each Trip Service instance; Redis Pub/Sub fans events to all instances, and each instance emits only to local sessions matching the authenticated recipient.
6. Bound concurrent streams per user and service instance; evict/close sessions on completion, timeout, error, logout, and process shutdown.

### 4.3 Migration Strategy

- Add a new Flyway migration; do not edit existing applied migrations.
- Existing notifications remain visible without backfill. Existing restaurant rows keep existing `event_id` values.
- Rollback can disable SSE publishing/endpoint while REST notification list/read APIs continue to work. Do not delete persisted notifications or pending outbox rows during rollback.

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| Authentication | Authenticate SSE before opening the stream using the same verified bearer JWT as JSON APIs. Derive recipient identity from the authenticated principal. |
| Authorization / IDOR | Never accept `userId`, recipient, or business subscription filters in SSE query parameters. Notification read endpoints continue to query by `(notificationId, recipientId)`. |
| Data leakage | SSE contains only a generic category/reason invalidation. Clients fetch message text from existing recipient-scoped REST API. Do not log the payload or rendered notification message. |
| Redis trust boundary | Use an internal channel, service network, and backend-managed Redis credentials. Validate recipient ID and event type before fan-out; Redis is not exposed to clients. |
| Resource exhaustion | Cap stream count per user, use bounded connection lifetime and heartbeat, clean up emitters, and rely on existing Gateway limits without throttling established streams aggressively. |
| Error handling | Expose safe connection errors only; follow `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`. Redis errors do not fail or roll back an already committed booking. |

## 6. Devil's Advocate & Technical Trade-offs

| Concern | Decision / Trade-off |
| --- | --- |
| SSE versus WebSocket | Select SSE: notification delivery is server-to-client and browser writes already use REST. This reuses Spring MVC and the existing authenticated fetch-stream approach. WebSocket adds bidirectional protocol/session complexity without a current need. |
| Durable delivery versus durable inbox | The inbox/outbox rows are durable; SSE and Redis are at-least-once, transient hints. A disconnected user gets the same notification from REST after reconnect. No claim of exactly-once network delivery is made. |
| Redis Pub/Sub loss | The outbox retries publishing when Redis is unavailable. Pub/Sub can still be missed by a browser after publish; initial load, reconnect/focus reconciliation, and bounded polling recover it from PostgreSQL. |
| Existing notification write catches exceptions | Stop swallowing persistence failures for these booking events. Atomicity is required so the booking cannot report success while its durable notification is silently absent. |
| Existing notifications mix Partner and Traveller recipients | Reuse the existing recipient-scoped API/table because the unified center already consumes booking events there; avoid duplicating a second booking inbox. Keep the current `partner_notification` name as a persistence detail. |
| Other categories remain polled | This scope sends realtime updates only for restaurant booking events. A future unified notification transport can extend the event contract after separately planning ownership for trip, hotel, and chat sources. |

## 7. Phased Implementation Tasks & Verification

### Phase 1: Transactional Notification Outbox (`trip-service`)

- [x] Refactor booking request and Partner decision notification creation so reservation transitions, durable notifications, and outbox rows share one transaction.
- [x] Use stable transition/event IDs and preserve the unique `(event_id, recipient_id)` guarantee.
- [x] Add migration, outbox repository, bounded lease/retry publisher, Redis channel contract, metrics, and safe operational logs.
- [x] Verify notification creation for active OWNER/MANAGER members and the reservation customer; verify no notification on rolled-back/stale operations.

### Phase 2: Authenticated SSE & Gateway

- [x] Add recipient-only SSE endpoint in Trip Service with bounded lifetime, heartbeat, cleanup, and concurrent connection limits.
- [x] Add Gateway route for `/api/partners/notifications/events`, `text/event-stream` pass-through, no-store/no-buffer headers, and route coverage tests.
- [x] Fan out Redis payloads only to local sessions for the target recipient and strip routing metadata before SSE serialization.
- [x] Add tests for authentication, foreign-recipient isolation, connection cleanup, multi-instance fan-out contract, Redis outage, and duplicate delivery.

### Phase 3: Web Notification Center & Recovery

- [x] Extend the existing notifications service with authenticated SSE subscription and reconnect/backoff handling; reuse the app's existing authenticated fetch-stream path.
- [x] On booking invalidation, coalesce and refetch the existing Trip/Partner notification REST feeds; keep all list/read APIs unchanged.
- [x] Reconcile on initial load, stream reconnect, tab visibility/focus, and a bounded fallback interval; abort stream on logout/unmount.
- [x] Add tests for real-time refresh, duplicate signals, offline/reconnect recovery, mark-as-read behavior, and safe stream errors. Preserve EN/VI locale parity.

### Verification Commands

```bash
# Backend tests and PostgreSQL migration/integration coverage
./mvnw -pl services/trip-service test

# Gateway SSE route tests
./mvnw -pl services/api-gateway test

# Frontend checks
cd apps/web/tripsense && npm run i18n:check && npm run type-check
```

## Human Approval Gate

```text
STATUS: APPROVED
```

Kế hoạch này đã được người dùng duyệt triển khai vào ngày 2026-10-19. Tiến hành triển khai theo các pha đã định nghĩa.
