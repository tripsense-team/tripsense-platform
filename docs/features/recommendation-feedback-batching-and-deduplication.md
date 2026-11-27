# Recommendation Feedback Batching And Deduplication — Specification & Implementation Plan

`STATUS: IMPLEMENTING; CODE AND AUTOMATED CHECKS COMPLETE, MANUAL BEFORE/AFTER EVIDENCE PENDING`

- **Owner Service**: `services/recommendation-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/recommendation-service`, Recommendation PostgreSQL
- **Created Date**: 2026-11-16
- **Target PR Boundaries**: Phase 1 (Backend Contract & Persistence), Phase 2 (Web Buffer & Detail-View Quality), Phase 3 (Metrics & Verification)

---

## 1. Goal & Requirements

### 1.1 Current-State Audit

The current implementation already protects recommendation scoring from unlimited repeated-event amplification:

- `ObservedSignalReducer` reduces a bounded recent history and retains the strongest/latest evidence per place.
- Existing tests cover repeated clicks, including the equivalent of 100 duplicate clicks versus one click.
- `SAVE`/`UNSAVE` and `ADD_TO_TRIP`/`REMOVE_FROM_TRIP` use last-state semantics.

However, ingestion is not yet optimized end to end:

- The web client sends each accepted feedback event immediately and creates a new idempotency UUID each time.
- Client-side deduplication only lives in memory for the currently rendered recommendation snapshot; refresh/remount loses it.
- The backend idempotency constraint only deduplicates retries that reuse the same key.
- Every newly accepted feedback currently creates one `recommendation_feedback_event` row and one `recommendation_outbox` row.
- There is no batch feedback endpoint and no meaningful-view dwell threshold for `DETAIL_VIEW`.

Therefore, 100 UI events may still cause 100 HTTP calls, 100 feedback rows, and 100 outbox rows even though the final scoring contribution is capped.

### 1.2 Problem Statement & User Goal

Reduce feedback transport, database, and outbox amplification while preserving useful recency signals, current recommendation scoring semantics, and immediate correctness for user state changes such as save/unsave.

### 1.3 User Flows & Journey

1. A user views, clicks, or opens details for recommended places.
2. The web client queues weak telemetry (`IMPRESSION`, `CLICK`, `DETAIL_VIEW`) with a stable event UUID.
3. The client flushes a bounded batch by size, timer, or page lifecycle event.
4. Recommendation Service authenticates the user and validates every event against the recommendation impression, place, and position owned by that user.
5. The service rejects invalid items, deduplicates retry IDs and repeated weak semantics, and bulk-persists accepted feedback plus matching outbox entries.
6. Strong state-changing events (`SAVE`, `UNSAVE`, `ADD_TO_TRIP`, `REMOVE_FROM_TRIP`, `LIKE`, `DISLIKE`) continue through the existing immediate endpoint; their UI/business action is never blocked by telemetry batching.
7. `DETAIL_VIEW` is emitted only after the detail surface remains visible for the configured dwell threshold.

### 1.4 Scope Boundaries

- **In-Scope**:
  - Add an authenticated, bounded batch feedback endpoint.
  - Preserve the current single-event endpoint for compatibility and strong signals.
  - Batch weak telemetry in the web client with stable retry IDs and bounded retry behavior.
  - Add server-side semantic deduplication for weak events within one recommendation impression.
  - Add a detail-view visibility/dwell threshold before emitting `DETAIL_VIEW`.
  - Bulk validation/persistence without an N+1 database query pattern.
  - Add operational metrics and before/after verification evidence.
- **Out-of-Scope**:
  - Changing event weights, ranking formulas, or `ObservedSignalReducer` policy.
  - Global lifetime deduplication across different recommendation impressions; legitimate revisits must still refresh recency.
  - Kafka, a new microservice, browser local storage, or offline telemetry synchronization.
  - Changing the favorite/trip business transaction owned by another service.

### 1.5 Acceptance Criteria

- [ ] AC-1: Repeating the same weak event 100 times for the same user, recommendation, place, and event type creates at most one accepted feedback row and one corresponding outbox row.
- [x] AC-2: One hundred distinct eligible weak events require no more than five HTTP calls when flushed at a batch size of 20 without intervening timer/lifecycle flushes.
- [x] AC-3: Closing the place detail before the dwell threshold creates no `DETAIL_VIEW`; keeping it visibly open beyond the threshold creates exactly one for that recommendation/place.
- [ ] AC-4: `SAVE` followed by `UNSAVE` remains immediate and ordered, and the final favorite state is correct even if weak-event batch delivery fails.
- [ ] AC-5: Retrying a batch with the same event IDs creates no duplicates; reusing an event ID for a different payload returns a stable conflict/rejection result.
- [x] AC-6: Every batch item is checked for authenticated ownership and exact recommendation/place/position membership.
- [x] AC-7: The existing single-event API remains backward compatible.
- [x] AC-8: For an equivalent accepted signal set, recommendation reducer/ranking output remains unchanged.
- [x] AC-9: Batch count, request size, timestamp skew, event type, and per-user rate limits are enforced.
- [ ] AC-10: Automated tests cover batching, deduplication, retry, invalid ownership, mixed valid/invalid items, dwell cancellation, and strong-event immediacy.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Next.js Explore UI]
        | weak events: buffered batch
        | strong events: existing immediate request
        v
[API Gateway]
        v
[Recommendation Service]
        | authenticate + validate impression membership
        | server semantic dedup + idempotency
        | bounded bulk insert in one transaction
        v
[Recommendation PostgreSQL]
        |- recommendation_feedback_event
        `- recommendation_outbox
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Queue weak signals, enforce dwell threshold, flush bounded batches, send strong signals immediately | HTTP REST through Gateway |
| `services/api-gateway` | Preserve public routing, JWT/security policy, and request limits | Spring Cloud Gateway |
| `services/recommendation-service` | Validate recommendation ownership/membership, deduplicate, persist feedback/outbox, expose metrics | Synchronous Spring Boot + owned PostgreSQL |

No cross-service database access is introduced. No new service or Kafka topic is required because this telemetry is already owned and processed by Recommendation Service through its durable outbox.

### 2.3 Event Classification

| Class | Events | Delivery policy |
| --- | --- | --- |
| Weak observation | `IMPRESSION`, `CLICK`, `DETAIL_VIEW` | Queue and batch; one semantic event per recommendation/place/type |
| Strong/state-changing | `SAVE`, `UNSAVE`, `ADD_TO_TRIP`, `REMOVE_FROM_TRIP`, `LIKE`, `DISLIKE` | Existing immediate endpoint; never debounce away transitions |
| Other integration event | `BOOKING_CLICK` | Keep immediate initially; reconsider only with measured volume and explicit product semantics |

---

## 3. API Contracts

### 3.1 Existing Endpoint — Preserved

| Method | Gateway Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/recommendations/{recommendationId}/events` | Bearer JWT | Existing single-event API; retained for compatibility and immediate strong signals |

The existing `Idempotency-Key` behavior and request schema remain backward compatible.

### 3.2 New Batch Endpoint

| Method | Gateway Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/recommendations/events/batch` | Bearer JWT | Submit up to 50 weak feedback events from one authenticated user |

Request:

```json
{
  "events": [
    {
      "eventId": "7aa02d91-46d8-4ccd-9782-b3347148887b",
      "recommendationId": "59676ec4-d3ec-48c2-8a33-bd15955ed03f",
      "placeId": "place-123",
      "eventType": "CLICK",
      "position": 3,
      "occurredAt": "2026-11-16T03:30:00Z"
    }
  ]
}
```

Response (`202 Accepted` for an authenticated, structurally valid batch):

```json
{
  "submitted": 1,
  "accepted": 1,
  "duplicate": 0,
  "rejected": 0,
  "results": [
    {
      "eventId": "7aa02d91-46d8-4ccd-9782-b3347148887b",
      "status": "ACCEPTED",
      "errorCode": null
    }
  ]
}
```

Per-item statuses are `ACCEPTED`, `DUPLICATE`, or `REJECTED`. Rejections expose only stable codes such as `INVALID_EVENT`, `STALE_EVENT`, or `IDEMPOTENCY_CONFLICT`; they never reveal another user's recommendation data. Authentication failure rejects the whole request.

### 3.3 Validation and Transaction Semantics

- Maximum 50 events and configured maximum request body of 64 KiB.
- `eventId` must be a UUID and unique within the request.
- Initial batch contract accepts only `IMPRESSION`, `CLICK`, and `DETAIL_VIEW`.
- Existing timestamp skew and positive-position validation remain in force.
- Valid items may succeed when another item is rejected; response is deterministic per item.
- All accepted items and their outbox records are inserted in one bounded transaction.
- Validation must use a set-based query for recommendation/item membership rather than one query per item.
- Client retries reuse the original event IDs.

---

## 4. Data Model & Migrations

### 4.1 Additive Schema Change

Add a nullable server-derived semantic deduplication key to `recommendation_feedback_event`:

```sql
ALTER TABLE recommendation_feedback_event
    ADD COLUMN dedup_key VARCHAR(160);

CREATE UNIQUE INDEX uq_recommendation_feedback_user_dedup_key
    ON recommendation_feedback_event (user_id, dedup_key)
    WHERE dedup_key IS NOT NULL;
```

For weak events, Recommendation Service derives the key from the immutable tuple:

```text
recommendationId + placeId + eventType
```

The client cannot provide `dedup_key`. Strong events keep it null so state transitions are never collapsed. Existing rows remain null; no destructive cleanup or historical backfill is required. The existing unique `(user_id, idempotency_key)` constraint remains the retry-safety mechanism.

### 4.2 Persistence Rules

- Accepted feedback and its outbox row remain one-to-one.
- An idempotency or semantic conflict produces no feedback row and no outbox row.
- Same event ID plus same payload is `DUPLICATE`.
- Same event ID plus different payload is `IDEMPOTENCY_CONFLICT`.
- Bulk inserts use database conflict handling and returned inserted IDs so only newly inserted feedback receives outbox rows.

### 4.3 Migration and Rollback Strategy

- Use the existing Recommendation Service migration mechanism and the next available version.
- Deployment is backward compatible because the new column is nullable and the single endpoint continues to work.
- Rollback application behavior by stopping `dedup_key` writes; retaining the nullable column/index is safe. A later reviewed migration may remove them if required.

---

## 5. Web Buffer & Signal Quality

### 5.1 Buffer Policy

- Generate the UUID when an event enters the queue and preserve it across retries.
- Flush when the queue reaches 20 events, after 5 seconds, or on `visibilitychange`/`pagehide` when authenticated delivery with `keepalive` is supported.
- Keep at most 50 queued events; drop/coalesce duplicate weak semantic keys before overflow.
- Retry transient failures once with bounded backoff while the page is active; never retry indefinitely.
- Keep the buffer in memory only to avoid stale events or cross-account leakage from browser storage.
- Telemetry delivery failures remain silent to users but are observable through sanitized operational metrics.

### 5.2 Detail-View Rule

- Start a 2-second timer only while the detail surface is open and `document.visibilityState === "visible"`.
- Cancel the timer on close, selected-place change, hidden document, or component unmount.
- Emit at most one `DETAIL_VIEW` for the same recommendation/place.
- A later distinct recommendation impression may create a new detail-view signal, preserving useful recency.

---

## 6. Security & Trust Boundaries

| Risk Area | Mitigation |
| --- | --- |
| Authentication | Require the existing authenticated principal through Gateway and Recommendation Service; do not accept `userId` from the client |
| IDOR/ownership | Validate every recommendation belongs to the current user and every place/position belongs to that shown impression |
| Event forgery | Treat all event fields as untrusted; allowlist batch event types and derive dedup keys server-side |
| Resource exhaustion | Enforce 50-item/64-KiB limits, timestamp skew, configured per-user rate limit, and bounded transaction/query sizes |
| Replay | Preserve existing idempotency uniqueness and add semantic weak-event uniqueness |
| Information leakage | Return generic per-item error codes; never log JWTs, raw request bodies, user IDs, place IDs, or internal exceptions in client-visible output |

Initial configurable rate-limit target: 120 weak events per authenticated user per minute, subject to load-test evidence before production rollout.

---

## 7. Devil's Advocate & Trade-offs

| Decision | Risk / Alternative | Resolution |
| --- | --- | --- |
| Batch weak events only | Batching all events reduces more calls but could collapse or reorder save/unsave transitions | Preserve immediate strong-event delivery; optimize only observational telemetry first |
| Dedup within recommendation impression | Global/time-window dedup saves more storage but can erase legitimate revisit recency | Key by recommendation/place/type; a new impression can produce a new signal |
| Nullable `dedup_key` without backfill | Historical duplicates remain | Avoid destructive migration and index-creation failures; reducer already bounds old duplicate influence |
| In-memory buffer | Page close can lose best-effort telemetry | Use lifecycle flush where authenticated keepalive works; avoid local storage privacy/account-mixing risks |
| No Kafka/new service | Very high future throughput might outgrow synchronous ingestion | Existing ownership and outbox are sufficient now; revisit only with measured saturation |
| Partial per-item acceptance | More response complexity than all-or-nothing | Prevent one malformed event from losing/retrying the entire valid batch while returning only non-sensitive codes |

---

## 8. Phased Implementation Tasks & Verification

### Phase 1: Backend Contract, Deduplication, and Bulk Persistence

- [x] Add the backward-compatible migration and entity/repository mapping for nullable `dedup_key`.
- [x] Add batch request/response DTOs with Bean Validation and stable per-item statuses.
- [x] Implement set-based ownership/membership validation and bounded bulk feedback/outbox insertion.
- [x] Preserve the current single-event endpoint and strong-event behavior.
- [ ] Add controller/service/repository tests for limits, retries, conflicts, ownership, mixed batches, and one-to-one outbox creation.

### Phase 2: Web Buffer and Detail-View Quality

- [x] Add a typed batch API client through the existing Gateway path.
- [x] Add the in-memory weak-event buffer, semantic coalescing, stable event IDs, flush triggers, and bounded retry.
- [x] Add visible 2-second dwell tracking and timer cleanup for `DETAIL_VIEW`.
- [x] Keep strong event callbacks immediate and independent of telemetry batch health.
- [x] Add frontend unit tests using fake timers and mocked API responses.

### Phase 3: Observability and Before/After Evidence

- [ ] Add sanitized metrics for batch size, flush reason, accepted/duplicate/rejected counts, events per request, feedback/outbox inserts, and rate-limit outcomes.
- [ ] Run the same Postman/Mockoon scenario before and after with 100 repeated interactions.
- [ ] Capture evidence showing HTTP request count, accepted row/outbox count, success/error rate, and latency without relying on generated results.
- [x] Verify the reducer produces unchanged output for equivalent accepted signals.

### Verification Commands

```bash
./mvnw -pl services/recommendation-service test

cd apps/web/tripsense
npm test -- --run
npm run lint
npm run build
```

Manual acceptance must also verify request counts in browser DevTools/Mockoon logs and accepted persistence counts using service metrics or read-only database queries.

---

## 9. Human Approval Gate

```text
APPROVAL: GRANTED
```

Approved by the user on 2026-11-16. Application-code implementation is authorized within this specification.

---

## 10. Implementation And Review Evidence

- Recommendation Service Docker build: passed.
- Targeted backend tests: 26 passed (`FeedbackServiceTest`, `ObservedSignalReducerTest`, `JdbcRecommendationStoreTest`, and `FeedbackBatchBodyLimitFilterTest`).
- Targeted web tests: 13 passed (buffer, meaningful-view timer, and discovery-view regression tests).
- Targeted ESLint and repository i18n validation: passed.
- Architecture review: passed; no new service, cross-service database access, or synchronous dependency was introduced.
- Database review: passed; the migration is additive, locally owned, nullable for rollback compatibility, and enforces weak-event uniqueness with a partial index.
- Security review: passed; user identity is server-derived, membership validation is owner-scoped, input/body/rate bounds are enforced, and client-visible errors remain generic.
- PR review: no feature-blocking correctness issue found. The full module Spotless check remains red because of 35 pre-existing formatting violations across the Recommendation Service, outside this feature's files.

Remaining before `DONE`:

- Run the same 100-interaction Postman/Mockoon scenario before and after.
- Capture real HTTP-call, feedback-row, outbox-row, error-rate, and latency evidence against PostgreSQL.
- Add/execute the remaining persistence-level retry/conflict/mixed-batch acceptance evidence required by AC-1, AC-5, and AC-10.
