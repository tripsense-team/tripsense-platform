# Collaborative Itinerary Editing — Specification & Implementation Plan

`STATUS: APPROVED`

- **Feature Name**: `collaborative-itinerary-editing`
- **Jira Tasks**: TF-83, TF-84, TF-85, TF-86, TF-87, TF-88, TF-89, TF-90, TF-91, TF-92, TF-93, TF-94
- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, PostgreSQL, Redis
- **Depends On**: `trip-collaboration` (TF-76–TF-81), `manage-trip-itinerary` (TF-47)
- **Created Date**: 2026-09-29
- **Approved Date**: 2026-09-29
- **Approval Constraint**: Preserve the existing cross-day item-move behavior exactly; collaboration, revision, and synchronization code may wrap it but must not change its ordering, time, or day-assignment logic.
- **Target PR Boundaries**: Phase 1 contracts/data, Phase 2 mutation core, Phase 3 live synchronization, Phase 4 web workspace, Phase 5 verification

---

## 1. Goal & Requirements

### 1.1 Problem and Current-State Assessment

Authorized members of one trip must edit the same canonical itinerary and see committed changes without silently overwriting each other.

The repository already contains reusable foundations:

- `TripServiceImpl` and `/api/trips/{tripId}/itinerary/**` implement add, edit, delete, and same-day reorder.
- `ItineraryItem` and `ItineraryDay` use JPA `@Version`.
- `Trip.aggregateRevision` exists but normal itinerary/member mutations do not consistently increment it.
- `TripCollaborationService` implements `OWNER`, `EDITOR`, and `VIEWER` membership rules.
- Redis is already configured for `trip-service` caching.
- The web app already has itinerary dialogs, REST clients, collaboration hooks, and two trip-workspace implementations that currently duplicate mutation orchestration.

The missing work is a single reusable mutation/access layer, cross-day movement, a durable ordered change feed, realtime delivery/replay, permission-aware UI, and reconnect/conflict behavior.

### 1.2 Task Mapping

| Task | Required behavior |
| --- | --- |
| TF-83 | `OWNER` or `EDITOR` adds a place/manual destination to a selected itinerary day and receives the committed item plus revision. |
| TF-84 | `OWNER` or `EDITOR` deletes an item using item and trip revision preconditions. |
| TF-85 | `OWNER` or `EDITOR` edits item type, title, place, status, duration, or notes. |
| TF-86 | Time editing validates `startTime < endTime`, preserves/derives duration consistently, and returns overlap warnings. |
| TF-87 | Reorder within a day and move across days are atomic and produce contiguous stable ordering. |
| TF-88 | Every successful edit is persisted before success is returned; failed/conflicting writes are rolled back as a unit. |
| TF-89 | Other connected members receive `ITEM_ADDED`. |
| TF-90 | Other connected members receive `ITEM_UPDATED`. |
| TF-91 | Other connected members receive `ITEM_DELETED`. |
| TF-92 | Other connected members receive `ITEM_REORDERED` or `ITEM_MOVED`. |
| TF-93 | Connected workspaces receive member join, leave, removal, and role-change events. |
| TF-94 | A disconnected workspace reconnects with its last applied revision, replays missed events, deduplicates them, then resumes live updates. |

### 1.3 User Flow

1. A trip member opens `/trips/{tripId}`; web loads trip, itinerary, and collaboration summary over REST.
2. Web opens an authenticated Server-Sent Events (SSE) stream using the itinerary's current `revision` as its resume cursor.
3. `OWNER`/`EDITOR` adds, edits, deletes, reorders, or moves an item. `VIEWER` sees read-only controls.
4. `trip-service` validates membership and nested resource ownership, locks the trip aggregate, checks expected versions, applies the change, increments `aggregateRevision`, and stores one change event in the same transaction.
5. The caller replaces optimistic/local state with the authoritative mutation response. Other clients reduce the event into the same normalized itinerary state.
6. If a version is stale, the service returns `409`; web rolls back the optimistic state, refetches canonical data, and displays a localized conflict notice.
7. After network loss, web reconnects with `Last-Event-ID`/`afterRevision`; the service replays retained events. If the cursor is too old, it emits `RESYNC_REQUIRED` and web performs one full REST refresh.

### 1.4 Scope

**In scope**

- Shared itinerary CRUD, time edits, same-day reorder, and cross-day move.
- Role enforcement: `OWNER` and `EDITOR` mutate; `VIEWER` reads only.
- Aggregate-level optimistic concurrency plus existing item/day versions.
- Durable ordered change events, authenticated SSE delivery, heartbeat, reconnect, replay, and full-refetch fallback.
- Member lifecycle synchronization for existing collaboration operations.
- One reusable web controller/hook and normalized reducer shared by trip screens.
- English/Vietnamese i18n, accessible connection/conflict states, safe errors, unit/integration/component tests.

**Out of scope**

- Google-Docs-style character diffing, cursors, typing presence, comments, likes, chat, offline editing queue, or CRDT/OT merging.
- Anonymous/public editing, new roles, ownership transfer, mobile implementation, or creating a new itinerary microservice.
- Kafka publication to other domains; these collaboration events are private trip-stream transport, not public integration events.

### 1.5 Domain Invariants

- `trip-service` is the only writer and source of truth for private trip/member/itinerary state.
- A mutation belongs to exactly one non-archived trip and commits atomically with exactly one revision/event.
- Trip revisions are strictly increasing per trip; `(trip_id, revision)` is unique.
- IDs supplied together (`tripId`, `dayId`, `itemId`) must resolve to the same trip; nested IDOR attempts fail closed.
- `VIEWER`, removed members, and non-members cannot mutate. Removed members lose stream access.
- Within a day, `sort_order` is unique and normalized to `1000, 2000, ...` after reorder/move.
- Reorder payloads contain each current item exactly once. Cross-day move locks both affected days in deterministic UUID order.
- Existing cross-day item-move behavior is frozen by approval and must not be changed during this implementation.
- Event payloads contain only the minimum safe DTO needed by the private workspace; no tokens, invitation secrets, raw exceptions, or free-text server logs.

### 1.6 Acceptance Criteria

- [ ] AC-83/84/85/86: `OWNER` and `EDITOR` can add/delete/edit/time-edit; `VIEWER` receives `403`; non-members receive non-enumerating `404`.
- [ ] AC-87: Same-day reorder and cross-day movement persist exactly once with valid stable order and no duplicate/lost items.
- [ ] AC-88: A success response contains the authoritative result and new trip revision; any validation, persistence, or event-write failure rolls back the whole mutation.
- [ ] AC-89–92: A committed itinerary change appears on another connected member's workspace once and in revision order without manual refresh.
- [ ] AC-93: Join/leave/remove/role updates refresh the member UI; a removed/downgraded user's capabilities update immediately, and a removed user stream closes.
- [ ] AC-94: Reconnect replays all retained revisions after the client's cursor with no duplicates; an expired cursor triggers one full resync.
- [ ] AC-CONFLICT: Stale `expectedTripRevision`, item version, or day version returns `409 CONFLICTING_UPDATE` and never silently overwrites newer data.
- [ ] AC-SECURITY: SSE and all REST mutations authenticate through the Gateway and reauthorize against trip membership.
- [ ] AC-UX: Connection states are non-blocking and localized; raw backend/SQL/JDBC errors never reach UI or client logs.

---

## 2. Architecture & Service Boundaries

### 2.1 Data Flow

```text
Next.js collaborative workspace
  |-- REST mutation + expected revision -------------------------|
  |-- authenticated SSE (Last-Event-ID / afterRevision) --------|
                                                                 v
API Gateway ----------------------------------------------> trip-service
                                                           |  TripAccessService
                                                           |  ItineraryMutationService
                                                           |  one PostgreSQL transaction:
                                                           |    domain write
                                                           |    trip revision + 1
                                                           |    collaboration_change_event insert
                                                           |
                                                           |-- afterCommit -> Redis Pub/Sub
                                                           |                  |
                                                           +<-----------------+
                                                             local SSE subscribers
```

### 2.2 Ownership and Reuse

| Component | Responsibility |
| --- | --- |
| `trip-service` | Own trips, membership, itinerary writes, revisions, retained collaboration events, authorization, and SSE subscriptions. |
| PostgreSQL | Canonical itinerary/member data plus durable replay log. |
| Redis Pub/Sub | Best-effort fan-out between `trip-service` instances after DB commit; never source of truth. |
| API Gateway | Existing `/api/trips/**` authenticated route; preserve streaming response and disable response buffering for SSE if required by deployment. |
| Web app | One normalized reducer/store, mutation hooks, connection state, retry/backoff, optimistic rollback, permission-aware controls. |

No service queries another service database and no cross-service JPA relationship is added. Place validation continues through the existing `PlaceClient` before the write transaction where practical.

### 2.3 Clean-Code Boundaries

- Extract `TripAccessService` with `requireReadableTrip`, `requireEditableTrip`, and `requireOwner`; both itinerary and collaboration services reuse it.
- Extract `ItineraryMutationService`; controllers stay thin, and add/update/delete/reorder/move share one transaction/revision/event pipeline.
- Keep mapping/validation in focused collaborators (`ItineraryMapper`, `ItineraryValidator`, `ItineraryOrderingService`) rather than duplicating it in controllers or React components.
- Add one `useCollaborativeItinerary(tripId)` hook and one pure `collaborativeItineraryReducer`; both current trip workspaces consume them.
- Existing endpoint paths remain valid. Do not create parallel “collaborative CRUD” endpoints.

---

## 3. API & Event Contracts

### 3.1 Read and Stream Contracts

| Method | Gateway/service path | Auth | Result |
| --- | --- | --- | --- |
| `GET` | `/api/trips/{tripId}/itinerary` | any active trip member | `ItineraryResponse` including `revision` and caller `capabilities`. |
| `GET` | `/api/trips/{tripId}/collaboration/events?afterRevision={n}` | any active trip member | `text/event-stream`; replays retained events after `n`, then stays live. |

The web stream client uses authenticated `fetch` so it can send the Bearer token and `Last-Event-ID`. Query `afterRevision` is the explicit fallback because native `EventSource` cannot set the project's Authorization header. The server prefers the greatest valid cursor from the header/query and rejects a cursor greater than the current revision.

```json
{
  "tripId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "revision": 42,
  "capabilities": { "canView": true, "canEdit": true, "canManageMembers": false },
  "days": []
}
```

SSE frames use `id: <revision>`, `event: trip-change`, and a JSON `data` body. A comment heartbeat is sent every 20 seconds. The connection is capped (default 30 minutes) and clients reconnect with exponential backoff plus jitter (1s, 2s, 4s, 8s, max 30s).

### 3.2 Existing Mutation Contracts (Extended, Not Duplicated)

All mutation requests require `expectedTripRevision`. Update/delete also require `expectedItemVersion`; reorder requires affected day versions. During rollout, backend may accept the legacy `version` alias for one compatibility release, but the web must move to the explicit names.

| Method | Path | Request change | Success |
| --- | --- | --- | --- |
| `POST` | `/api/trips/{tripId}/itinerary/days/{dayId}/items` | add `expectedTripRevision` | `201 ItineraryMutationResponse` |
| `PATCH` | `/api/trips/{tripId}/itinerary/items/{itemId}` | `expectedTripRevision`, `expectedItemVersion` | `200 ItineraryMutationResponse` |
| `DELETE` | `/api/trips/{tripId}/itinerary/items/{itemId}?expectedTripRevision={r}&expectedItemVersion={v}` | required preconditions | `200 ItineraryMutationResponse` with deleted ID/tombstone |
| `PUT` | `/api/trips/{tripId}/itinerary/days/{dayId}/items/reorder` | `orderedItemIds`, `expectedTripRevision`, `expectedDayVersion` | `200 ItineraryMutationResponse` |
| `PUT` | `/api/trips/{tripId}/itinerary/items/{itemId}/position` | new atomic same/cross-day position contract | `200 ItineraryMutationResponse` |

`PUT .../position` request:

```json
{
  "targetDayId": "9d7602d4-3afd-4ca3-a69f-fd213c47d728",
  "targetIndex": 2,
  "expectedTripRevision": 42,
  "expectedItemVersion": 3,
  "expectedSourceDayVersion": 7,
  "expectedTargetDayVersion": 5
}
```

Common response:

```json
{
  "tripId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "revision": 43,
  "eventId": "d82f07f4-955b-4309-b8c3-6f6d22e0302b",
  "changeType": "ITEM_MOVED",
  "changedItem": { "id": "...", "dayId": "...", "version": 4 },
  "changedDays": [
    { "id": "source-day", "version": 8, "items": [] },
    { "id": "target-day", "version": 6, "items": [] }
  ],
  "deletedItemId": null,
  "committedAt": "2026-09-29T08:15:30Z"
}
```

Only relevant nullable fields are populated. Returning authoritative changed days for reorder/move prevents clients from reimplementing ordering/time-chain rules.

### 3.3 Private Collaboration Event Schema

```json
{
  "eventId": "d82f07f4-955b-4309-b8c3-6f6d22e0302b",
  "schemaVersion": 1,
  "tripId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "revision": 43,
  "type": "ITEM_UPDATED",
  "actorUserId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "occurredAt": "2026-09-29T08:15:30Z",
  "payload": {
    "item": { "id": "...", "dayId": "...", "version": 4 }
  }
}
```

Allowed `type` values:

- `ITEM_ADDED`, `ITEM_UPDATED`, `ITEM_DELETED`, `ITEM_REORDERED`, `ITEM_MOVED`
- `MEMBER_JOINED`, `MEMBER_LEFT`, `MEMBER_REMOVED`, `MEMBER_ROLE_CHANGED`
- transport-only `RESYNC_REQUIRED` (not stored as a domain event)

Member events contain `memberId`, `userId`, and `role`; invitation tokens/emails are excluded. `ITEM_DELETED` carries the tombstone `{itemId, dayId}`. Reorder/move carries complete authoritative affected-day DTOs. Clients ignore `revision <= lastAppliedRevision`; a gap (`revision > lastAppliedRevision + 1`) triggers replay/refetch instead of applying out of order.

### 3.4 Error Contract

| HTTP | Code | Meaning/client behavior |
| --- | --- | --- |
| `400` | `INVALID_REORDER_PAYLOAD`, `INVALID_ITEM_TIME_RANGE`, `INVALID_POSITION` | Show localized validation feedback; do not retry automatically. |
| `401` | `UNAUTHENTICATED` | Stop stream and enter existing auth refresh/logout flow. |
| `403` | `PERMISSION_DENIED` | Disable edit controls and refetch collaboration summary. |
| `404` | `TRIP_NOT_FOUND`, `ITINERARY_*_NOT_FOUND` | Non-enumerating missing/inaccessible resource. |
| `409` | `CONFLICTING_UPDATE` | Roll back optimistic change, refetch, show localized conflict state. |
| `410` | `EVENT_CURSOR_EXPIRED` | Full itinerary/member refetch, then reconnect from returned current revision. |
| `429` | `STREAM_LIMIT_EXCEEDED` | Back off; do not open parallel streams for the same workspace. |

---

## 4. Data Model & Migrations

### 4.1 Existing Columns Reused

- `trips.aggregate_revision BIGINT NOT NULL` becomes the canonical collaboration revision.
- `itinerary_items.version` and `itinerary_days.version` remain fine-grained optimistic-lock versions.
- `trip_members` remains the authorization source.

Normal CRUD, reorder/move, and member lifecycle mutations must increment `aggregate_revision`; `publication_revision` remains separate and continues to track public snapshot changes.

### 4.2 Durable Replay Table

Add one migration after the existing `V20260924222730` collaboration migration:

```sql
CREATE TABLE collaboration_change_events (
    event_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    actor_user_id UUID NOT NULL,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_collaboration_event_trip_revision UNIQUE (trip_id, revision),
    CONSTRAINT ck_collaboration_event_revision CHECK (revision > 0),
    CONSTRAINT ck_collaboration_event_payload_size
      CHECK (octet_length(payload::text) <= 262144)
);

CREATE INDEX idx_collaboration_event_replay
  ON collaboration_change_events (trip_id, revision);
CREATE INDEX idx_collaboration_event_expiry
  ON collaboration_change_events (expires_at);
```

Retention defaults to 24 hours and is configurable. A scheduled bounded delete removes expired rows in batches. If the requested revision precedes the earliest retained event and current revision is newer, return `410 EVENT_CURSOR_EXPIRED`; do not pretend replay is complete.

### 4.3 Transaction and Publication Rules

1. Resolve remote place snapshot before opening the DB transaction when needed.
2. Lock the trip row (`PESSIMISTIC_WRITE`) and verify `expectedTripRevision`.
3. Lock affected item/day rows in deterministic order and verify entity versions.
4. Apply mutation and normalize ordering.
5. Increment trip revision and insert exactly one change event in the same local transaction.
6. Publish only the event ID/revision to Redis using `afterCommit`; subscribers load the canonical event from PostgreSQL.
7. If Redis is unavailable, the REST mutation still succeeds because the DB is canonical; connected clients recover through heartbeat/reconnect replay. A bounded local retry may fan out after commit but must not duplicate DB events.

Rollback is application rollback to the preceding binary while leaving the additive table/column semantics intact. Do not drop replay data during production rollback.

---

## 5. Security & Trust Boundaries

| Risk | Required control |
| --- | --- |
| IDOR/nested IDOR | `TripAccessService` checks membership, then repositories constrain every day/item query by `tripId`; mismatched nested IDs never mutate. |
| Unauthorized editing | Only `OWNER`/`EDITOR`; UI capability flags are convenience only, never authorization. |
| Open stream after removal | On `MEMBER_REMOVED`, close matching user's emitters; reauthorize all emitters on heartbeat and reconnect. |
| Role downgrade | Emit role event, update UI capabilities, and enforce backend role on every later mutation. |
| Stale overwrite | Required trip/item/day preconditions and `409`; no last-write-wins fallback. |
| Event data leak | Events are fetched only after membership validation, private per trip, size bounded, and exclude tokens, email, raw exceptions, and credentials. |
| Resource exhaustion | Limit active streams per user/trip, emitter duration, replay page size (max 500), payload size, mutation rate, and backoff retries. |
| Cache leakage/staleness | Cache keys remain user+trip scoped; every committed mutation/member change evicts affected trip/itinerary/collaboration keys. |
| Frontend leakage | Use `apiClient`/shared safe error mapping; never display raw server messages or log payload/free-text/token data. |

All public traffic continues through API Gateway. SSE uses the same JWT validation/trust model as REST; no token in query strings.

---

## 6. Devil's Advocate & Trade-offs

| Decision | Rationale | Rejected alternative |
| --- | --- | --- |
| SSE + REST mutations | Server-to-client updates are one-way; simpler than bidirectional WebSocket and works with existing HTTP mutation APIs. | WebSocket/STOMP adds protocol/state complexity with no approved client-to-server realtime message need. |
| PostgreSQL replay log + Redis fan-out | Durable reconnect and multi-instance delivery without making Redis canonical. | Redis Pub/Sub only loses events during disconnect; polling adds latency/load; Kafka is excessive for private, owner-local ephemeral UI updates. |
| Aggregate revision plus entity versions | Provides total order for sync and precise conflict checks. | Entity versions alone cannot order member and multi-entity events; last-write-wins silently loses work. |
| Authoritative changed-day payload | Clients do not duplicate reorder/time-chain business rules. | Tiny patch-only events are smaller but fragile and harder to recover correctly. |
| Immediate persistence per action | Satisfies TF-88 and keeps all clients convergent. | Client-side draft batches risk data loss and require a second merge protocol. |
| One owner service | Current trip-service already owns both membership and itinerary and can commit atomically. | New itinerary/collaboration service introduces distributed authorization and transactions prematurely. |

Failure modes explicitly handled:

- REST response lost after commit: refetch/replay finds the committed revision; retries with stale revision conflict instead of duplicating silently.
- Caller receives its own SSE event: reducer deduplicates by revision/event ID.
- Redis or one app instance fails: DB event persists; client reconnects to any instance and replays.
- Event arrives during initial load: stream subscribes, replays from loaded revision, and reducer deduplicates.
- Slow consumer: bounded emitter queue closes with reconnect; do not keep unbounded per-client memory.
- Concurrent reorder/move: trip lock serializes aggregate mutation; stale request gets `409` and must refetch.

---

## 7. Phased Implementation & Verification

### Phase 1 — Contracts and Persistence

- [ ] Add migration and `CollaborationChangeEvent` repository/entity with retention query.
- [ ] Add `revision`/`capabilities` to itinerary response and shared mutation/event DTOs.
- [ ] Introduce explicit expected-version fields while preserving one-release request compatibility.
- [ ] Define stable error codes and safe exception mapping.

### Phase 2 — Reusable Mutation Core (TF-83–TF-88)

- [ ] Extract `TripAccessService`; replace duplicated owner/member checks.
- [ ] Extract validation, mapping, and order normalization helpers from `TripServiceImpl`/batch code.
- [ ] Implement one transaction template for lock → validate → mutate → revision → event.
- [ ] Route existing add/update/delete/reorder through it; implement atomic position/move.
- [ ] Reuse the same event writer in member accept/leave/remove/role-update operations.
- [ ] Ensure cache eviction and publication revision behavior remain correct.

### Phase 3 — Live Sync and Reconnection (TF-89–TF-94)

- [ ] Implement authenticated SSE controller, emitter registry, heartbeat, replay, cursor expiry, limits, and cleanup.
- [ ] Implement Redis after-commit notification and DB-backed multi-instance fan-out.
- [ ] Configure Gateway/deployment streaming timeouts and no-buffer headers.
- [ ] Close/reauthorize streams when membership changes.

### Phase 4 — Shared Web Workspace

- [ ] Add typed mutation/event contracts and authenticated streaming client.
- [ ] Add pure normalized reducer and `useCollaborativeItinerary`; dedupe/gap/replay logic lives only there.
- [ ] Refactor both trip workspace screens to reuse the hook, dialogs, and mutation actions.
- [ ] Add edit/time/delete/drag controls by capability; keep `VIEWER` read-only.
- [ ] Add optimistic update with rollback, conflict refetch, reconnect indicator, and accessible live-region status.
- [ ] Add sorted parity keys in `trip`/`common` namespaces in `en.json` and `vi.json`; remove new hardcoded user-facing strings.
- [ ] Use `getSafeErrorMessage`; do not render/log raw SSE/REST errors or sensitive payloads.

### Phase 5 — Tests and Operational Checks

- [ ] Unit: permissions, time validation, ordering/move, revision allocation, reducer idempotency/gaps, retry backoff.
- [ ] Repository/integration: unique revision, transaction rollback, nested IDOR, concurrent mutations, replay window/expiry, cleanup.
- [ ] MockMvc/SSE: auth, heartbeat, ordered replay, live event, removed-member disconnect, stream limits.
- [ ] Multi-instance integration: two trip-service instances with shared PostgreSQL/Redis deliver once and recover after Redis interruption.
- [ ] Web component: owner/editor/viewer controls, optimistic rollback, `409`, add/update/delete/reorder/member events, reconnect/resync.
- [ ] Regression: existing owner-only itinerary flows, trip invitations/membership, public publication revision, cache isolation.

Verification commands:

```bash
# Trip service
./mvnw -pl services/trip-service test

# Gateway regression
./mvnw -pl services/api-gateway test

# Web
cd apps/web/tripsense
npm run i18n:check
npm test
npm run lint
npm run build
```

Manual two-session acceptance:

1. Open the same trip as owner and editor; open a viewer in a third session.
2. Add, edit time, delete, reorder, and cross-day move in alternating sessions.
3. Confirm the peer updates once, viewer is read-only, and revisions stay ordered.
4. Disconnect editor, perform multiple owner changes, reconnect, and confirm exact replay.
5. Remove editor while connected and confirm stream closure plus denied later mutation.
6. Force an expired cursor and confirm full resync without duplicate items.

---

## Human Approval Gate

```text
STATUS: APPROVED
```

Approved by the user on 2026-09-29 with the explicit constraint that existing cross-day item-move logic remains unchanged.
