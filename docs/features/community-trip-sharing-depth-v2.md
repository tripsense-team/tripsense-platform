# Community Trip Sharing Depth V2 — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Primary owner services**: `services/social-service`, `services/trip-service`
- **Affected components**: `apps/web/tripsense`, `services/api-gateway`, `services/social-service`, `services/trip-service`
- **Created date**: 2026-10-29
- **Depends on**: `trip-sharing` and Community redesign Phases A–D reaching their release gates
- **Target PR boundaries**: P0 current-flow hardening; P1 saved posts; P2 atomic import to My Trips; P3 UX/observability and release verification

---

## 1. Goal & Requirements

### 1.1 Problem and product direction

The current Community experience already supports publishing an immutable, privacy-filtered trip snapshot, reading its itinerary, reactions, comments, visibility and moderation. The remaining product gap is the value loop after discovery: a useful shared trip can be viewed, but it cannot yet be saved for later or safely turned into the viewer's own editable plan.

V2 deepens Trip Sharing around this loop:

```text
discover -> evaluate a detailed public snapshot -> save -> import a safe copy
-> choose own dates -> edit independently in My Trips
```

This plan deliberately prioritizes reuse over more decorative rail widgets, fabricated engagement, opaque AI ranking, or exposing more source-trip data.

### 1.2 User journeys

#### A. Save for later

1. An authenticated viewer opens an accessible `TRIP_SHARE` post.
2. The viewer selects **Save**; the post is stored in a private Saved list.
3. The viewer can remove it or open it later while it remains accessible.
4. If the author removes or privatizes the post, it no longer appears in the viewer's Saved list; saving never grants permanent access.

#### B. Use this trip as a starting point

1. From an accessible detailed Trip Share, the viewer selects **Use this trip**.
2. The UI explains that only the published safe snapshot will be copied. Private notes, bookings, participants, budgets, exact locations and source IDs cannot be recovered.
3. The viewer chooses a new trip name and a required date range. The server validates that the inclusive day count matches the published snapshot day count.
4. `trip-service` retrieves one authorized immutable publication snapshot from `social-service` and atomically creates a new private trip plus itinerary.
5. The new trip opens in My Trips. It is fully independent: later edits, removal or visibility changes to the Community post do not mutate it.

#### C. Owner management

The author continues using the existing preview, publish/refresh, caption, visibility and delete flows. V2 does not silently refresh imports or reveal who imported a post.

### 1.3 Scope

**In scope**

- Private save/unsave/list for accessible Community posts, with Trip Share as the primary UI.
- Atomic server-side import of `PublicTripSnapshot V1` into a new private trip.
- Reuse only server-authorized published fields; no browser-authored itinerary payload.
- Required user-selected dates whose inclusive range matches the published snapshot day count. The current Trip schema and `CreateTripRequest` require non-null dates; flexible-date import is deferred.
- Generic conversion of published `HOTEL`, `FLIGHT` and `TRANSFER` entries; no attempt to reconstruct redacted details.
- Stable, bounded Saved pagination; pending, empty, stale-access and retry states.
- EN/VI i18n parity, accessible controls, sanitized errors and production-safe metrics.

**Out of scope**

- Copying from a `STANDARD` or `GUIDE_PROMOTION` post.
- Item-by-item import selection, collaboration invitation, automatic booking, payments, budget copying or AI rewriting.
- Public identity attribution embedded inside the new private trip; the source post remains the attribution surface while accessible.
- Personalized feed ranking, follower-only visibility, anonymous importing, public search/SEO, map/coordinate restoration or destination taxonomy changes.
- Notifications to the author or public import counters. Import activity is private.
- Replacing the existing `PublicTripSnapshot V1` field policy.

### 1.4 Acceptance criteria

- [ ] AC-1: Save/unsave is idempotent and only succeeds after the same visibility/access decision used by post detail.
- [ ] AC-2: Saved lists never return removed, moderated, `PRIVATE`, or otherwise inaccessible posts to a non-owner.
- [ ] AC-3: Only an authenticated viewer who can read `PUBLIC_SNAPSHOT` detail can import it; `SUMMARY_ONLY_REPUBLISH_REQUIRED` returns `409 SHARE_REPUBLISH_REQUIRED`.
- [ ] AC-4: The browser sends only `postId`, name, required dates and an idempotency key; it never submits snapshot days/items as authoritative input.
- [ ] AC-5: One successful request creates one private trip and complete itinerary in one local `trip-service` transaction. Validation or item conversion failure creates neither.
- [ ] AC-6: Replaying the same actor/key/request returns the same destination trip. Reusing the key with a different request returns `409 IDEMPOTENCY_KEY_CONFLICT`.
- [ ] AC-7: Imported content contains no source trip/day/item IDs, notes, booking/payment/contact/budget/participant data, exact address or coordinates.
- [ ] AC-8: Removing or refreshing the source publication after import does not mutate or delete the imported trip.
- [ ] AC-9: The UI distinguishes Save from Use this trip, explains redaction, preserves the draft on `401/409/422/429/503`, and never displays raw backend errors.
- [ ] AC-10: Existing publishing, likes, comments, moderation, visibility, standard posts and owner-side personal trip cloning do not regress.
- [ ] AC-11: All new user-facing text is under `social` or `trip` namespaces with EN/VI schema parity; no email is used as a display-name fallback.
- [ ] AC-12: Feed/detail do not add N+1 calls. The Social-to-Trip publish path and new Trip-to-Social import path are never called while holding a database transaction.

### 1.5 P0 optimizations before expansion

These are release prerequisites, not authorization to rewrite the existing approved Community scope:

1. Finish the existing authenticated Trip Share release gate and measure feed/detail latency before adding import traffic.
2. Remove remaining hardcoded viewer strings from Trip Share components and use locale-aware date formatting.
3. Remove email-derived author display names and production mock fallbacks from Community paths; render truthful unavailable/empty states.
4. Keep detailed snapshot JSON out of feed DTOs and load it once only on typed detail/import.
5. Preserve draft text and selection across login, stale-preview and transient-service failures.

---

## 2. Architecture & Service Boundaries

### 2.1 Ownership

| Component | Responsibility | Does not own |
| --- | --- | --- |
| `social-service` | Saved-post records, post visibility/access, immutable public snapshot export | Canonical or imported trips |
| `trip-service` | Import command, destination trip/itinerary creation, local transaction and import idempotency receipt | Social visibility, likes, saves or source snapshot persistence |
| `apps/web/tripsense` | Consent UI, form state and navigation through Gateway | Snapshot trust, authorization or cross-service composition |
| `api-gateway` | Sole public ingress, JWT/rate-limit routing | Domain authorization |

There is no cross-service database access, shared table, cross-service JPA relationship or new microservice.

### 2.2 Import sequence

```text
Web
  -> Gateway
    -> trip-service: POST /api/trips/imports/community-shares/{postId}
      -> social-service: GET /internal/community/trip-shares/{postId}/import-projection
         (forward user bearer token + trusted service authentication)
      <- exact authorized immutable PublicTripSnapshot V1 + payloadSha256
      -> validate limits and conversion outside DB transaction
      -> one local transaction: idempotency receipt + trip + itinerary + items
    <- 201 ImportedTripResponse
```

The synchronous call is justified because the user needs an immediate new trip ID. Timeouts are bounded. `trip-service` must not retry the Social read indefinitely; the web may retry the command with the same idempotency key.

The new reverse dependency (`trip-service -> social-service`) is restricted to one read-only import port. It must not be reused for feed or generic trip reads. A Kafka event is rejected because import is an immediate command and would complicate success/failure UX.

### 2.3 Snapshot conversion

- `PLACE`, `MEAL`, `ACTIVITY`: copy published title/type, time/duration when present, and safe place display label only.
- `HOTEL`: create a generic accommodation item; no hotel identity, address or booking details.
- `FLIGHT`, `TRANSFER`: create generic movement items; no carrier, route, pickup or booking data.
- No `NOTE` is present in the public snapshot and none is synthesized.
- Snapshot-local day/item order becomes canonical order in the imported itinerary.
- A copied display label is plain text, not a canonical `placeId`; users may explicitly relink a place later.
- If new dates are supplied, day numbers map sequentially from `startDate`. Published exact historical dates/times are not silently reused for a new future trip.

### 2.4 Failure boundaries

- Social unavailable/timeout: `503 COMMUNITY_SHARE_UNAVAILABLE`; no Trip transaction opens.
- Visibility changes before Social authorization completes: privacy-safe `404 SHARE_NOT_FOUND`.
- Snapshot exceeds V1 bounds or fails schema/hash checks: `422 SHARE_NOT_IMPORTABLE`; no partial trip.
- Duplicate concurrent import with one actor/key: unique receipt constraint elects one result; both successful replays return the same trip.
- Post removal after Social returns but before Trip commits is an accepted narrow race: the copied content was authorized at read time. Audit stores the publication hash and read timestamp, never private source data.

---

## 3. API Contracts

All browser traffic uses API Gateway.

### 3.1 Saved posts (`social-service`)

| Method | Path | Auth | Result |
| --- | --- | --- | --- |
| `PUT` | `/api/social/posts/{postId}/save` | JWT | Idempotently save an accessible post; `200` |
| `DELETE` | `/api/social/posts/{postId}/save` | JWT | Idempotently unsave; `204` |
| `GET` | `/api/social/me/saved-posts?type=TRIP_SHARE&cursor=&size=20` | JWT | Private keyset-paginated accessible saves |

```json
{
  "items": [{ "post": "SocialPostResponse", "savedAt": "2026-10-29T02:00:00Z" }],
  "nextCursor": "opaque-or-null"
}
```

- `size`: `1..50`; default `20`.
- Order: `savedAt DESC, postId DESC`.
- Cursor is opaque, versioned and bounded to 512 characters; invalid/tampered cursors return `400 INVALID_CURSOR`.
- List queries authorize/filter before returning items. Total count is omitted because inaccessible saves may disappear.
- `SocialPostResponse` may include viewer-specific `isSaved`; anonymous responses use `false`/absent.

### 3.2 Import command (`trip-service`)

```http
POST /api/trips/imports/community-shares/{postId}
Authorization: Bearer <access-token>
Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "name": "Đà Lạt 4 ngày của tôi",
  "startDate": "2026-12-10",
  "endDate": "2026-12-13"
}
```

`startDate` and `endDate` are both required because the current `trips.start_date`, `trips.end_date`, `itinerary_days.day_date`, and `CreateTripRequest` contracts are non-null. Their inclusive day count must equal `snapshot.summary.dayCount`; V2 does not compress or expand the itinerary. Flexible-date imports require a separate Trip data-model plan.

```json
{
  "tripId": "a0f61f61-4266-47f5-bb91-e5f843ca53ef",
  "sourcePostId": "0eddb08f-88ca-4987-b53f-615f80ccb5ea",
  "name": "Đà Lạt 4 ngày của tôi",
  "dayCount": 4,
  "itemCount": 12,
  "importedAt": "2026-10-29T02:01:00Z"
}
```

Validation:

- `name`: trimmed plain text, `1..160` characters, matching the existing Trip schema.
- `postId` and `Idempotency-Key`: UUID.
- Dates: valid ISO dates, `endDate >= startDate`, range matches published day count and current Trip limits.
- Destination and cover come only from the authorized snapshot; client cannot override them in V2.

Errors:

| HTTP | Code |
| --- | --- |
| `400` | `VALIDATION_FAILED`, `INVALID_DATE_RANGE`, `INVALID_IDEMPOTENCY_KEY`, `INVALID_CURSOR` |
| `401` | `UNAUTHENTICATED` |
| `404` | `POST_NOT_FOUND`, `SHARE_NOT_FOUND` (privacy-safe) |
| `409` | `SHARE_REPUBLISH_REQUIRED`, `IDEMPOTENCY_KEY_CONFLICT` |
| `422` | `SHARE_NOT_IMPORTABLE`, `IMPORT_LIMIT_EXCEEDED` |
| `429` | `RATE_LIMITED` |
| `503` | `COMMUNITY_SHARE_UNAVAILABLE` |

### 3.3 Internal Social contract

```http
GET /internal/community/trip-shares/{postId}/import-projection
Authorization: Bearer <original-user-token>
X-TripSense-Service-Auth: <backend-only credential or approved mTLS identity>
```

Response contains `schemaVersion`, `payloadSha256`, `postId`, `publishedAt`, and the same bounded `PublicTripSnapshot V1` already authorized for typed detail. It never includes `sourceTripId`, source entity IDs, private fields or author contact data.

The internal endpoint requires both a valid end-user access token and trusted service authentication. Plain `X-User-Id` is not trusted. Logs exclude tokens, snapshot JSON, captions and activity titles.

### 3.4 Events

No Kafka event is required for MVP. Future aggregate analytics may consume a minimal `CommunityTripImportedV1` outbox event only after privacy/retention approval; it is not authorized by this plan.

---

## 4. Data Model & Migrations

### 4.1 Social-owned saves

```sql
CREATE TABLE social_post_saves (
    user_id UUID NOT NULL,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE INDEX social_post_saves_user_cursor_idx
    ON social_post_saves (user_id, created_at DESC, post_id DESC);
```

`user_id` is an external identity value with no cross-service FK. Hard-deleted posts cascade locally. Soft-deleted/inaccessible posts are excluded through the same access predicate used by detail.

### 4.2 Trip-owned import receipts

```sql
CREATE TABLE trip_community_import_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    idempotency_key UUID NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    source_post_id UUID NOT NULL,
    source_snapshot_sha256 VARCHAR(64) NOT NULL,
    destination_trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    imported_day_count INTEGER NOT NULL,
    imported_item_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    CHECK (imported_day_count > 0),
    CHECK (imported_item_count >= 0)
);

CREATE INDEX trip_community_import_source_idx
    ON trip_community_import_receipts (source_post_id, created_at DESC);
```

`source_post_id` is an external ID, never a foreign key. The receipt stores hashes and counts, not the snapshot payload or author identity. `destination_trip_id` is a local Trip FK.

### 4.3 Migration and retention

- Additive timestamped Flyway migrations; never edit applied migrations.
- Deploy compatible readers before exposing buttons.
- Save rows follow account deletion/privacy workflows and post hard-delete cascade.
- Import receipts follow the destination trip's operational/audit retention. Deleting a source post does not delete an imported trip or receipt.
- Rollback hides UI/routes first; additive tables can remain. Destructive rollback is unnecessary.

---

## 5. Security & Trust Boundaries

| Risk | Required guard |
| --- | --- |
| IDOR via guessed `postId` | Social evaluates current visibility and typed-detail access; inaccessible resources return privacy-safe `404`. |
| Client injects private itinerary data | Import request has no itinerary/snapshot field; Trip accepts only Social's allowlisted V1 contract. |
| Service impersonation | Internal endpoint requires trusted service authentication plus the original user JWT; no unsigned identity headers. |
| Snapshot schema drift | Strict schema version, size/field allowlist, SHA-256 validation and fail-closed conversion. |
| XSS/content abuse | Names/labels are bounded plain text and rendered as text; never accept HTML. |
| Existence leak through saved list | Reauthorize every returned post; omit inaccessible rows and counts. |
| Import spam/storage abuse | Per-actor rate limits, existing per-user trip limits, V1 size limits and idempotency. |
| Sensitive logging | Use normalized error code, correlation ID and elapsed time only; no JWT, snapshot JSON, caption, activity title or raw exception in client logs. |
| Accidental disclosure after import | New trip defaults `PRIVATE`; no collaborator is copied and no publication is created automatically. |

The web must use `apiClient` and safe localized errors. It must not `console.log` snapshot/import responses. Save is a quiet inline state change; import success may navigate with inline confirmation rather than a noisy global toast.

---

## 6. Devil's Advocate & Trade-offs

| Decision | Trade-off / rationale |
| --- | --- |
| Server-side atomic import | More backend work than reusing the existing client `clone-trip.ts`, but prevents partial copies, hidden-field reuse and browser-authored authority. |
| Trip calls Social synchronously once | Introduces a narrow reverse dependency, but preserves immediate UX and authorization. The port is isolated and never used on feed/general trip reads. |
| Copy public labels without Place IDs | Imported activities may need manual relinking, but V1 intentionally has no safe canonical Place contract. Reconstructing by search could select the wrong place or re-identify redacted data. |
| Saved access is revocable | A removed/private post disappears from Saved. Permanent offline copies would undermine visibility and moderation. |
| Imported trip survives source deletion | The viewer explicitly created an independent private derivative from content they were authorized to read. Deleting it retroactively would violate user ownership and require distributed lifecycle coupling. |
| No public import count/author notification | Avoids privacy leakage, popularity gaming and notification infrastructure before the core reuse loop is validated. |
| No ranking changes in V2 | Save/import signals are not automatically consent for personalized ranking. Ranking needs a separate impression/feedback and policy plan. |

Rejected alternatives:

- Reusing client `clone-trip.ts` with the source canonical trip: viewers do not own or have access to that private object.
- Sending `PublicTripSnapshot` from browser to Trip: allows tampering and bypasses current visibility.
- Social directly writing Trip tables or importing Trip entities: violates service ownership.
- Kafka-only asynchronous import: poor immediate success/failure semantics and unnecessary orchestration.
- Creating a sharing/import service: current Social and Trip boundaries are sufficient.

---

## 7. Phased Tasks & Verification

### Phase P0 — current flow hardening

- [ ] Complete existing Community authenticated publication/refresh release gate.
- [ ] Audit Trip Share components for hardcoded text, email-derived names, locale date formatting, mock production fallbacks and raw error display.
- [ ] Capture feed/detail p95 latency and verify no detail JSON/N+1 calls in feed.

### Phase P1 — private saved posts

- [x] Add Social migration, entity/repository, shared access predicate and cursor contract.
- [x] Implement save/unsave/list and `isSaved` without per-card queries (batch/join for current page).
- [ ] Add Saved UI, accessible state, EN/VI keys and race-condition tests.

### Phase P2 — atomic Community import

- [x] Add strict internal Social import-projection port and service authentication.
- [x] Add Trip receipt migration, conversion mapper, local transaction and idempotency handling.
- [ ] Add Gateway route/rate limit and contract tests for every error code.
- [x] Add consent/date dialog and My Trips handoff; do not reuse client clone logic for public shares.

### Phase P3 — release verification

- [ ] Unit tests: visibility matrix, conversion allowlist, date mapping, limits, hashes and idempotency conflicts.
- [ ] Integration tests: Social timeout, removed/private share, summary-only share, concurrent duplicate and transaction rollback.
- [ ] Security tests: guessed IDs, forged service headers, client snapshot injection, forbidden-field serialization and log redaction.
- [ ] Web tests: draft preservation, double-click guards, `401/404/409/422/429/503`, responsive/keyboard/focus and i18n parity.
- [ ] Regression tests: publish/refresh, feed filters, like/comment/report/delete and owner-side clone remain unchanged.

### Verification commands

```bash
cd services/social-service && ./mvnw test
cd services/trip-service && ./mvnw test
cd apps/web/tripsense && npm run i18n:check && npm test && npm run build
```

Manual acceptance must run through API Gateway with two accounts: author publishes, viewer saves/imports, author then changes visibility/removes the post, and the viewer's imported private trip remains complete while the Saved entry disappears.

### Implementation and review checkpoint — 2026-10-29

- Implemented private save/unsave/list, signed keyset cursors, batched `isSaved`, the Saved screen, and optimistic rollback.
- Implemented the authorized Social import projection, bounded Trip client, strict V1 validation/hash check, atomic private-trip conversion, idempotency receipt, and Gateway per-actor import rate limit.
- Hardened the active Trip Share UI by removing production mock fallbacks, email-derived display-name fallbacks, raw feature error messages, fixed-locale dates, and remaining viewer-facing hardcoded strings in the feed/detail artifact path.
- Architecture review: static pass. Service ownership remains local and the only reverse dependency is the approved synchronous read port.
- Database review: static pass. Migrations are additive, contain no cross-service foreign keys, and the local destination receipt cascades with destination-trip deletion.
- Security review: static pass after fail-closed service authentication, signed cursor validation, privacy-safe access checks, safe localized web errors, backend-only Compose secrets, and generic JWT failure logging.
- Verification completed with Maven/JDK 21 in Docker because the host has no Java runtime: API Gateway passes 14/14 tests and Social Service passes 138/138 tests. Trip Service compiles and `CommunityTripImportServiceTest` passes 1/1; its full suite starts 123 tests but 9 Spring context tests cannot initialize Testcontainers without Docker socket access (0 assertion failures).
- Frontend i18n parity, type-check, all 399 tests, lint (no errors), production build, and `git diff --check` pass. PR readiness remains blocked on running the Trip Testcontainers integration tests in a Docker-capable Java environment and manual two-account acceptance through API Gateway.

### Later roadmap requiring separate approval

1. Canonical destination/topic taxonomy and Community search/filter.
2. Public creator profiles and Following feed after profile privacy contracts are complete.
3. Post collections, collaborative curation and optional attribution policy.
4. Impression-aware feed quality/ranking with explicit consent, offline evaluation and anti-gaming controls.
5. Author analytics using aggregated privacy-safe metrics; no viewer identity exposure.

---

## Human Approval Gate

No application code is authorized by this document until a human explicitly approves it and the prerequisite Community release gate is satisfied.

`STATUS: IMPLEMENTING`
