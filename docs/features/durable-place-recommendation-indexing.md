# Durable Place Recommendation Indexing — Specification & Implementation Plan

`STATUS: IMPLEMENTING — core delivery/indexing flow and automated regression complete; operational metrics remain`

- **Owner Services**: `services/place-service`, `services/recommendation-service`
- **Affected Components**: `services/place-service`, `services/recommendation-service`, Place-owned MongoDB, Qdrant, deployment configuration
- **Created Date**: 2026-11-12
- **Approved Date**: 2026-11-12
- **Related Baseline**: [Place Search Embedding Sync](./place-search-embedding-sync.md), [Recommendation Engine V2](./recommendation-engine-v2.md), [Admin Shared Place Catalog CRUD](./admin-shared-place-catalog-crud.md)
- **Target PR Boundaries**: Phase 1 durable Place delivery; Phase 2 bounded Recommendation indexing; Phase 3 reconciliation, observability, and verification

---

## 1. Goal & Requirements

### 1.1 Problem Statement

The current Place-to-Recommendation semantic indexing path is fire-and-forget. A successful Place read schedules `CompletableFuture.runAsync`, the client waits on a blocking HTTP call in the common pool, and any failure is logged then discarded. Recommendation indexing uses `parallelStream`, performs per-place Qdrant and embedding calls, and reports failures together with unchanged documents as `skipped`.

This creates four correctness and operations problems:

1. A read-only `GET /api/places/{id}` can generate cross-service and Qdrant traffic even when canonical content did not change.
2. A temporary Recommendation, embedding-provider, Qdrant, authentication, or network failure can leave the derived index stale indefinitely.
3. The caller cannot distinguish an unchanged document from a failed index attempt and therefore cannot retry safely.
4. Common-pool concurrency and per-item remote calls can exceed downstream capacity during enrichment or backfill.

The goal is a durable, bounded, idempotent, eventually consistent projection from canonical Place data to the Recommendation-owned Qdrant index. User-facing Place reads and writes must not wait for embedding generation.

### 1.2 Final Flow

```text
Place create/update/enrichment/archive/restore commits
        |
        v
PlaceIndexJob enqueue/coalesce in Place MongoDB
        |
        v
bounded Place dispatcher claims due jobs
        |
        +-- read current canonical Place state and version
        |
        +-- ACTIVE  -> POST /api/recommendations/internal/places/index
        |               -> content hash / source revision check
        |               -> bounded embedding work
        |               -> Qdrant upsert
        |
        `-- ARCHIVED/missing -> DELETE /api/recommendations/internal/places/{placeId}
        |
        +-- success/unchanged -> complete only the dispatched revision
        `-- retryable failure -> exponential backoff -> dead letter after limit

scheduled reconciliation
        -> checkpointed scan of current Place states
        -> re-enqueue bounded ACTIVE/ARCHIVED batches
        -> Recommendation idempotency skips already-current points
```

### 1.3 In Scope

- Remove semantic indexing from the read-only Place detail return path.
- Enqueue indexing only after a durable canonical Place mutation that may affect the semantic document, plus archive/restore lifecycle changes.
- Add a Place-owned durable Mongo job collection and bounded scheduled dispatcher.
- Coalesce repeated changes by canonical `placeId`; the latest canonical version wins.
- Add retry with exponential backoff, lease recovery, terminal dead-letter state, and safe manual/automatic replay.
- Preserve Place as canonical owner; Recommendation must not access Place MongoDB.
- Extend the existing internal index request/response additively with source revision and per-item outcome.
- Bound internal batch size, worker concurrency, queue size, payload size, and downstream timeouts.
- Initialize/validate the Qdrant collection once rather than once per changed Place.
- Add reconciliation and indexing metrics.
- Fail configuration validation when semantic synchronization is enabled but the shared internal key is blank.
- Replace asynchronous tests that do not await completion with deterministic dispatcher/client tests.

### 1.4 Out of Scope

- Public recommendation API, ranking weights, RRF, filters, feature extraction, MMR, impressions, or feedback behavior.
- Context/Trip resolution parallelization and Explore exact/relaxed candidate reuse; these require separate measured latency work.
- A new microservice.
- Kafka infrastructure. No operational broker/client/consumer is proven in the repository; the durable job boundary permits a later transport replacement.
- Cross-service database access, distributed transactions, or cross-service JPA relationships.
- A web UI for dead letters. Initial operations use metrics, logs, and a protected maintenance mechanism.
- Re-embedding because of photos, rating, review count, opening hours, or other fields excluded from the semantic document.

### 1.5 Domain Invariants

1. `place-service` owns canonical Place state and the delivery job.
2. `recommendation-service` owns embedding generation and Qdrant.
3. A Place read with no persisted semantic-content mutation never enqueues indexing.
4. Only committed ACTIVE Place state may be upserted; ARCHIVED state must converge to deletion.
5. Completion for revision `N` must not complete or discard a newer pending revision `N+1`.
6. A retry must be idempotent and must not consume a new embedding when content hash/model version are unchanged.
7. User-facing Place requests never wait for Recommendation, embedding, or Qdrant availability.
8. An empty or mismatched internal API key must be observable and must never silently degrade into successful-looking delivery.
9. Qdrant is a derived index and is repairable from canonical Place data.

### 1.6 Acceptance Criteria

- [x] AC-1: Repeated cached or database-only Place detail reads create zero index jobs and zero Recommendation indexing calls.
- [x] AC-2: A committed create/update/enrichment/restore affecting semantic content creates or advances one coalesced job for that canonical Place.
- [x] AC-3: Archive schedules deletion and the corresponding Qdrant point is eventually absent.
- [x] AC-4: If Recommendation/Qdrant/embedding is unavailable, the Place request succeeds and the job remains retryable with bounded exponential backoff.
- [x] AC-5: A service restart recovers expired leases without losing jobs.
- [x] AC-6: When revision `N+1` arrives during processing of `N`, completion of `N` leaves `N+1` pending.
- [x] AC-7: Recommendation returns distinct `INDEXED`, `UNCHANGED`, `RETRYABLE_FAILURE`, and `PERMANENT_FAILURE` per-item outcomes.
- [x] AC-8: Invalid payloads are permanent failures; authentication, timeout, `429`, and `5xx` failures are retryable without leaking raw errors.
- [x] AC-9: Internal batches above 100 items or over the configured body limit are rejected safely.
- [x] AC-10: Embedding and Qdrant concurrency are bounded and do not use the JVM common ForkJoinPool.
- [x] AC-11: Qdrant collection existence/vector-size validation occurs at startup/readiness, not once per point upsert.
- [x] AC-12: A bounded checkpointed/full reconciliation sweep can repair a missed upsert/delete without querying another service database or requiring Place to access Qdrant.
- [x] AC-13: Semantic synchronization enabled with a blank shared internal key fails startup/readiness with a sanitized configuration error.
- [x] AC-14: Existing public Place and Recommendation APIs remain backward-compatible.
- [x] AC-15: Offline automated tests make no real Gemini or cloud Qdrant mutation.

---

## 2. Architecture & Service Boundaries

### 2.1 Ownership and Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `place-service` | Canonical Place, mutation detection, durable delivery jobs, retries, reconciliation source scan | Place MongoDB; internal REST client |
| `recommendation-service` | Validate internal request, idempotency/revision policy, embedding, Qdrant projection, per-item outcome | Internal REST; embedding API; Qdrant |
| API Gateway | Continue blocking `/api/recommendations/internal/**` from public traffic | No route change |
| Place MongoDB | Canonical Places and Place-owned delivery jobs | Accessed only by `place-service` |
| Qdrant | Recommendation-owned derived vector projection | Accessed only by `recommendation-service` |

### 2.2 Mutation Admission

The enqueue boundary belongs after a successful canonical mutation. Implementation must cover:

- `AdminPlaceCatalogService`: create, update, archive, restore.
- `PlacePersistenceServiceImpl`: new provider Place, changed provider fields, and successful deep enrichment.
- Batch enrichment/category mutation paths that persist semantic fields.

The semantic material remains versioned and centralized:

```text
name
primaryType
categories
description
address
city
district
```

Mutation code compares the pre-save and committed post-save semantic material. Non-semantic changes such as photos, rating, review count, price evidence, quietness evidence, media state, or last-fetched time do not enqueue a semantic rebuild. Archive/restore always enqueue lifecycle convergence.

The unconditional call at the end of `PlaceDetailsServiceImpl.getDetails(...)` is removed. If that request performs an actual provider enrichment mutation, the persistence boundary enqueues it.

### 2.3 Consistency Model

MongoDB and Qdrant do not share a transaction. The design uses at-least-once delivery plus reconciliation:

- The canonical mutation commits first.
- The job enqueue is attempted immediately afterward.
- If process termination occurs between those writes, scheduled reconciliation re-enqueues the missing/stale projection.
- The dispatcher re-reads canonical Place state before delivery, so a stale queued payload cannot overwrite newer state.
- Job completion uses compare-and-set on the dispatched `desiredVersion` and lease token.

This explicitly accepts bounded eventual consistency and avoids a distributed transaction. If the deployed MongoDB topology later guarantees multi-document transactions, mutation plus job enqueue may be combined, but correctness must not depend solely on that topology.

### 2.4 Concurrency and Capacity

- Dedicated dispatcher executor; no `CompletableFuture.runAsync()` without an executor and no `parallelStream()`.
- Defaults: batch size `50`, worker threads `2`, queue capacity `100`, maximum batch `100`.
- All values are validated configuration with conservative upper bounds.
- Jobs are claimed using atomic `findAndModify` with `leaseToken` and `leaseUntil`.
- One logical job document per canonical Place coalesces bursts.
- Backoff defaults: `5s`, `30s`, `2m`, `10m`, `30m`; maximum attempts `8`, with jitter.
- HTTP `401/403` caused by service authentication is retryable only for a short bounded count and raises a dedicated alert; malformed Place payload is permanent.

### 2.5 Architecture Guardrails

- [x] No public endpoint or Gateway route is added.
- [x] No service reads another service's database.
- [x] No cross-service entity/JPA relationship.
- [x] Place and Recommendation exchange IDs, versions, DTOs, and outcomes only.
- [x] Eventual work is asynchronous and durable; synchronous internal REST occurs only inside the background dispatcher.
- [x] No new microservice or unproven Kafka dependency.
- [x] Ranking remains deterministic and unchanged.

---

## 3. API and Internal Contract

### 3.1 Existing Internal Upsert Endpoint — Additive Revision

```http
POST /api/recommendations/internal/places/index
X-Internal-Api-Key: <secret>
Content-Type: application/json
```

The request remains an array for backward compatibility. Add nullable fields:

```json
[
  {
    "id": "canonical-place-id",
    "sourceVersion": 12,
    "sourceUpdatedAt": "2026-11-12T08:00:00Z",
    "name": "Cà phê ví dụ",
    "primaryType": "cafe",
    "categories": ["cafe"],
    "description": "Không gian yên tĩnh",
    "address": "Đà Nẵng",
    "city": "Da Nang",
    "district": "Hai Chau"
  }
]
```

Rules:

- Array size `1..100`; empty remains a successful no-op only for legacy compatibility.
- `sourceVersion >= 0` when present.
- `sourceUpdatedAt` cannot be unreasonably future-dated.
- Existing callers without revision remain supported during rollout and use content-hash idempotency only.
- Semantic fields retain existing length/list bounds.
- Unknown raw exceptions and provider payloads are never returned.

### 3.2 Additive Response Outcome

Existing aggregate fields remain. `skipped = unchanged + failed` remains temporarily for old callers and is deprecated.

```json
{
  "success": true,
  "data": {
    "submitted": 2,
    "indexed": 1,
    "unchanged": 0,
    "failed": 1,
    "skipped": 1,
    "semanticEnabled": true,
    "results": [
      {
        "placeId": "place-1",
        "sourceVersion": 12,
        "status": "INDEXED",
        "errorCode": null
      },
      {
        "placeId": "place-2",
        "sourceVersion": 7,
        "status": "RETRYABLE_FAILURE",
        "errorCode": "EMBEDDING_UNAVAILABLE"
      }
    ]
  }
}
```

Allowed statuses:

- `INDEXED`: Qdrant now represents this source version/content/model.
- `UNCHANGED`: existing Qdrant payload already matches.
- `RETRYABLE_FAILURE`: timeout, `429`, embedding/Qdrant/service availability, or transient collection readiness failure.
- `PERMANENT_FAILURE`: invalid semantic input that retry cannot repair without a newer Place mutation.

### 3.3 Existing Delete Endpoint

```http
DELETE /api/recommendations/internal/places/{placeId}
X-Internal-Api-Key: <secret>
```

- Remains idempotent: deleting an absent point returns `204`.
- Dispatcher confirms the current canonical Place is archived/missing before calling it.
- Restore produces a newer upsert job; reconciliation repairs any delete/restore race.

### 3.4 Kafka Events

No Kafka topic is introduced. The durable job document is an internal Place delivery mechanism, not a shared domain event. A future publisher may transport the same logical fields `{eventId, placeId, sourceVersion, operation, occurredAt}` after Kafka infrastructure and delivery semantics are separately approved.

---

## 4. Data Model and Migration

### 4.1 Place-Owned Mongo Collection

Collection: `place_recommendation_index_jobs`

```javascript
{
  _id: "<canonical-place-id>",
  desiredVersion: NumberLong(12),
  operationHint: "UPSERT|DELETE",
  status: "PENDING|IN_PROGRESS|DEAD_LETTER",
  attempts: 0,
  nextAttemptAt: ISODate("..."),
  leaseToken: "<uuid>|null",
  leaseUntil: ISODate("...") | null,
  lastErrorCode: "RECOMMENDATION_UNAVAILABLE|null",
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

`_id = placeId` is the coalescing key. Enqueue performs an atomic update only when the incoming desired version is newer or lifecycle intent requires convergence. The dispatcher always derives the final operation from current canonical state; `operationHint` is diagnostic, not authoritative.

Indexes installed by an idempotent Place Mongo migration:

```javascript
db.place_recommendation_index_jobs.createIndex(
  { status: 1, nextAttemptAt: 1, leaseUntil: 1, updatedAt: 1 },
  { name: "place_rec_index_due_idx" }
)

db.place_recommendation_index_jobs.createIndex(
  { status: 1, updatedAt: 1 },
  { name: "place_rec_index_dead_letter_idx" }
)
```

Successful completion deletes the job only when `_id`, `desiredVersion`, and `leaseToken` still match. A newer desired version therefore survives an older completion.

### 4.2 Qdrant Payload Additions

```json
{
  "placeId": "canonical-place-id",
  "sourceVersion": 12,
  "sourceUpdatedAt": "2026-11-12T08:00:00Z",
  "embeddingModel": "gemini-embedding-001",
  "embeddingVersion": "gemini-embedding-001",
  "contentHash": "sha256"
}
```

`contentHash + embeddingVersion` determines semantic equality. `sourceVersion` protects ordering and supports reconciliation diagnostics. Qdrant remains disposable derived state.

### 4.3 Migration and Rollback

- Mongo collection/index creation is additive and idempotent.
- Qdrant payload additions are nullable for existing points; existing points are lazily upgraded or repaired by reconciliation.
- Rollout order: Recommendation additive contract first, then Place durable dispatcher, then remove read-trigger, then enable reconciliation.
- During rollback, stop the dispatcher, restore the legacy client only if necessary, and retain job documents for replay. Do not drop jobs until the prior behavior is confirmed.
- No PostgreSQL/Flyway migration is required.

---

## 5. Security and Trust Boundaries

| Risk | Required Control |
| --- | --- |
| Public access to internal indexing | Gateway continues returning `403` for `/api/recommendations/internal/**`; Recommendation also validates the internal key in constant time |
| Blank/default secret | No committed production-capable default; when sync is enabled, both services validate nonblank key at startup/readiness |
| Payload abuse | Maximum 100 items, bounded body size, Bean Validation, string/list limits, finite coordinates, no arbitrary Qdrant payload map |
| Secret leakage | Never log header/key; configuration errors name only the missing property |
| Raw downstream errors | Return stable internal `errorCode`; logs contain correlation ID and exception type only |
| Stale/out-of-order delivery | Re-read canonical state, source revision, content hash/model version, conditional job completion |
| Retry storm | Bounded worker/queue, jittered backoff, circuit-aware retry, authentication alerting |
| Internal endpoint bypasses JWT | Accepted only for the blocked internal route with service key; no user identity is involved |

Internal service URL must be explicit configuration or a reviewed load-balanced service client. Production must not silently fall back to `localhost`; local development may define localhost in a local profile.

---

## 6. Devil's Advocate and Trade-offs

| Decision | Risk / Trade-off | Resolution |
| --- | --- | --- |
| Durable Mongo job instead of Kafka | Place mutation and job are not always one transaction | Immediate enqueue plus reconciliation; transport boundary remains replaceable |
| One coalesced job per Place | Intermediate revisions are not embedded | Desired behavior: only latest canonical state matters for a derived search index |
| Re-read canonical Place before send | Adds Place Mongo read per claimed job/batch | Prevents stale payload overwrite; batch `findAllById` bounds calls |
| Internal REST worker | Recommendation outage creates backlog | Expected eventual consistency; backoff, metrics, dead letter, and replay make it visible/recoverable |
| Remove index-on-read | A legacy Place that never mutates may not be indexed immediately | Reconciliation/backfill provides deliberate coverage without coupling index work to user reads |
| Fail blank-key configuration | Local startup may require new environment setup | Prefer explicit, observable configuration over silent permanent index failure |
| Per-item outcomes | Slightly larger response contract | Required so Place can retry only failed items and distinguish unchanged data |
| No online-path tuning in this plan | Context/Explore latency remains | Avoids mixing projection correctness with user-facing ranking performance; optimize from measured traces separately |

Rejected alternatives:

- Keep fire-and-forget plus logs: loses work and cannot prove convergence.
- Trigger on every read: converts user traffic into indexing load and hides missing mutation hooks.
- Let Recommendation read Place MongoDB: violates data ownership.
- Store full Place snapshots durably in Recommendation DB: duplicates canonical truth and complicates deletion/privacy/freshness.
- Add Kafka only for this feature: repository has no proven operational broker pipeline; disproportionate infrastructure expansion.
- Use unbounded virtual/common-pool concurrency: does not enforce embedding/Qdrant quotas or backpressure.

---

## 7. Phased Implementation and Verification

### Phase 1 — Durable Place Delivery

- [ ] Add `PlaceRecommendationIndexJob`, repository, idempotent Mongo index migration, validated properties, and a clock-injectable backoff policy.
- [ ] Add an enqueue port/service called after committed semantic/lifecycle mutations.
- [ ] Integrate provider upsert/enrichment, admin create/update/archive/restore, and batch semantic mutations.
- [ ] Remove unconditional indexing from `PlaceDetailsServiceImpl` read completion.
- [ ] Replace `RecommendationIndexerClient` fire-and-forget methods with synchronous worker-facing batch methods using configured timeouts and no localhost production fallback.
- [ ] Add bounded scheduled dispatcher with atomic lease, batch canonical read, conditional completion, retry, lease recovery, and dead letter.
- [ ] Validate nonblank matching internal-key configuration when synchronization is enabled.
- [ ] Unit-test mutation admission, semantic diff, coalescing, lease races, restart recovery, backoff, and no-index-on-read.

### Phase 2 — Bounded Recommendation Indexing

- [ ] Add `sourceVersion/sourceUpdatedAt` request fields and additive per-item response outcomes.
- [ ] Enforce internal batch/body bounds and classify stable retryable/permanent failures.
- [ ] Replace `parallelStream()` with a dedicated bounded indexing executor.
- [ ] Validate/create Qdrant collection once at startup/readiness and verify vector dimension/distance.
- [ ] Persist source revision/model/content hash in Qdrant payload and ignore older revisions.
- [ ] Add batch Qdrant retrieval/upsert/delete where supported; add embedding batch input behind the `EmbeddingClient` port where the configured provider supports it.
- [ ] Preserve single-item fallback with the same bounds if provider batch embedding is unavailable.
- [ ] Contract-test legacy request compatibility and all new outcomes.

### Phase 3 — Reconciliation and Operations

- [ ] Add a bounded, checkpointed Place sweep that re-enqueues current ACTIVE/ARCHIVED state; Recommendation content-hash/model/revision idempotency skips already-current Qdrant points. Include a slower resumable full sweep so a lost checkpoint cannot create a permanent gap.
- [ ] Add counters/timers/gauges for pending, leased, retry, dead-letter, authentication failure, delivery latency, embedding items, Qdrant batch size, stale/missing projections, and reconciliation repairs.
- [ ] Add a protected maintenance operation or startup tool to replay dead letters by explicit Place IDs; no broad unauthenticated endpoint.
- [ ] Update runbooks/environment examples with required keys, worker limits, reconciliation schedule, and rollback steps.
- [ ] Run offline regression, local fake downstream integration, and an explicitly opted-in cloud smoke test.

### Test Matrix

| Scenario | Expected Result |
| --- | --- |
| Detail cache hit / unchanged DB read | No job and no internal call |
| Provider enrichment changes description/category | One latest-version pending job |
| Rating/photos-only mutation | No semantic re-index job |
| Recommendation `503` / timeout / `429` | Retryable job with backoff |
| Invalid Place semantic payload | Dead letter with stable code |
| Worker dies after claim | Lease expiry makes job claimable |
| New revision arrives during old in-flight request | Old completion cannot delete new job |
| Duplicate delivery | `UNCHANGED`, no second embedding call |
| Older source revision arrives after newer | No Qdrant rollback |
| Archive then restore race | Converges to latest ACTIVE upsert |
| Empty internal key with sync enabled | Startup/readiness failure |
| Reconciliation finds missing point | Re-enqueue and repair |

### Verification Commands

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  mvn -B -ntp -pl services/place-service,services/recommendation-service -am test \
  '-Dtest=*,!SemanticCloudIntegrationTest' \
  -Dsurefire.failIfNoSpecifiedTests=false

JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
  mvn -B -ntp -pl services/place-service,services/recommendation-service -am verify \
  -DskipTests
```

Cloud mutation verification remains opt-in and must use a disposable test collection and explicit credentials. It must never run in the default test suite.

---

## 8. Implementation Status

Approved by the user on 2026-11-12.

Core implementation completed on 2026-11-12:

- Place reads no longer trigger indexing; committed semantic/lifecycle writes enqueue a coalesced Mongo job.
- Dispatcher claims jobs with leases, re-reads canonical state, retries with jittered backoff, dead-letters terminal work, and completes with revision-and-lease CAS.
- Recommendation indexing is bounded and returns per-item outcomes; Qdrant stores revision/hash/model metadata and validates collection size/distance at startup.
- Internal payloads contain only semantic/revision data; blank internal key or service URL fails startup when synchronization is enabled.
- Reconciliation re-enqueues paged canonical state and automatically replays stale/dead-letter revisions idempotently.
- Docker Maven regression: `place-service` 180 tests (1 skipped), `recommendation-service` 243 tests (1 skipped), zero failures; ArchUnit passes. Cloud semantic mutation tests remain opt-in.

The feature remains `IMPLEMENTING` until the Phase 3 Micrometer gauges/counters and production-facing operational dashboard/alert wiring are added. These do not block the corrected indexing flow, but they are part of the approved operations scope and therefore prevent marking the feature `DONE`.
