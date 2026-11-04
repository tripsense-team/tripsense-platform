# Admin Shared Place Catalog CRUD — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Owner Service**: `services/place-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`, `services/recommendation-service`
- **Created Date**: 2026-11-03
- **Approved Date**: 2026-11-03
- **Target PR Boundaries**: Phase 1 (Mongo domain and admin contracts), Phase 2 (provider-safe mutation and recommendation consistency), Phase 3 (admin web UI), Phase 4 (deployment and shared-database acceptance)
- **Related Features**: [Place Batch Enrichment & ZioMap Settings](./place-batch-enrichment-and-ziomap-settings.md), [Durable Verified Place Media Coverage](./durable-verified-place-media-coverage.md), [Explore Category Discovery & Pagination](./explore-category-discovery-and-pagination.md)

---

## 1. Goal & Requirements

### 1.1 Problem Statement

The existing `/admin/places` page is only a local prototype: it renders five hardcoded records and toggles verification in React state. Refreshing the browser loses every change, and no mutation reaches Place Service or MongoDB.

Replace that prototype with an ADMIN-only catalog editor whose source of truth is the Place Service-owned MongoDB database configured on the deployed server. No place record, edit, archive state, draft, or fake success state may be stored in `localStorage`, mock repositories, module globals, or a browser-only array.

The deployment requirement is explicit:

```text
Admin browser
  -> API Gateway
    -> place-service
      -> MONGODB_URI / MONGODB_DATABASE configured for the shared server environment
```

Two admins using different browsers and application instances must observe the same committed data. Place Service restart or web redeploy must not lose it.

### 1.2 Admin Flows

#### Browse and inspect

1. Admin opens **Điểm đến & Địa danh** at `/admin/places`.
2. Web loads a server-paginated catalog through API Gateway, with search and filters for lifecycle, source, city, and discovery category.
3. Admin opens a place to inspect canonical fields, durable media status, source, revision, and sanitized audit metadata.

#### Create manually

1. Admin selects **Thêm địa điểm** and enters canonical place data.
2. Backend validates taxonomy, coordinates, URLs, field lengths, and likely duplicates.
3. Place Service creates a MongoDB document with `provider=MANUAL`, a server-generated stable provider ID, audit metadata, and revision `0`.
4. UI displays the server response only after commit. A browser refresh or another admin session sees the new place.
5. Media is uploaded/approved through the existing durable media endpoints; the core CRUD request never accepts an arbitrary cover URL as verified media.

#### Edit

1. Admin edits supported canonical fields and submits the revision returned by the server.
2. Place Service performs an optimistic-lock update, records atomic actor/action/request metadata on the aggregate, invalidates relevant caches, and schedules recommendation re-indexing.
3. If another admin changed the record first, the request returns `409 PLACE_VERSION_CONFLICT`; the UI preserves the draft and offers reload/compare, never silently overwriting.

For provider-sourced places, edited canonical fields are added to `manualOverrideFields`. Subsequent ZioMap/provider enrichment may update non-overridden fields but must not overwrite explicit admin corrections.

#### Archive and restore

1. Delete is a soft archive, not physical deletion. Admin confirms the place name and current revision.
2. Archived places are excluded from public search, autocomplete, nearby, browse, recommendation candidates, and normal public detail reads.
3. Existing cross-service ID references are not broken. Admin can filter archived records and restore one through an explicit action.

### 1.3 Scope

**In scope**

- Replace hardcoded `/admin/places` data with Place Service API data.
- ADMIN-only server-side list, detail, create, update, archive, and restore.
- Shared server MongoDB persistence using `MONGODB_URI` and `MONGODB_DATABASE` deployment secrets/configuration.
- Canonical fields: name, normalized name, location, address, old address, city, district, categories, primary type, phone, website, social links, opening hours, business status, and description.
- Source/lifecycle/revision/audit metadata and provider-safe manual field overrides.
- Server-side search, bounded filters, stable pagination, loading/empty/error/conflict states.
- Cache invalidation and recommendation index/update cleanup behavior.
- Reuse of existing rights-approved Place Media admin APIs.
- English/Vietnamese parity under `admin.places`, shared actions under `common`.

**Out of scope**

- Editing provider ratings, provider review counts, provider reviews, quietness evidence, price evidence, or raw `sourceData` through the generic form.
- Accepting arbitrary image URLs or presenting stock images as a specific place. Media upload/moderation remains owned by the approved durable media flow.
- Bulk CSV import/export, bulk delete, address geocoding, AI-generated descriptions, new microservices, or direct browser access to MongoDB.
- Hard deletion of place documents or cross-service cleanup of historical trip/social snapshots.
- Changing ZioMap credentials, batch enrichment, or API-key management behavior.

### 1.4 Domain Invariants

- Place Service and its MongoDB are the only source of truth for the catalog.
- Browser state is a view/draft cache only; success is shown only after the server confirms persistence.
- `provider` and `providerPlaceId` are server-owned identity fields and cannot be changed by the client.
- Manual records use `provider=MANUAL` and `providerPlaceId=manual:<UUID>` generated server-side.
- `primaryType` is a normalized specific code owned by the existing `DiscoveryCategory` policy; the UI presents supported groups (`ATTRACTION`, `FOOD`, `CAFE`, `STAY`) but sends the selected concrete code.
- Latitude is `[-90, 90]`, longitude is `[-180, 180]`, and both are required together.
- Provider-derived rating/review fields are read-only.
- Provider refresh cannot overwrite fields listed in `manualOverrideFields`.
- Archive is reversible and public reads fail closed for archived records.
- A place is eligible for curated publication only under the existing durable-media gate; CRUD creation alone does not make an unlicensed image or incomplete place media-ready.

### 1.5 Acceptance Criteria

- [ ] **AC-1**: `/admin/places` contains no hardcoded catalog or local-only mutation path; all list and mutation operations use `apiClient` through API Gateway.
- [ ] **AC-2**: Create/update/archive/restore persists in the deployed Place MongoDB and remains visible after browser refresh, web redeploy, and Place Service restart.
- [ ] **AC-3**: A change made by one admin is visible to another admin session connected to the same server environment.
- [ ] **AC-4**: Non-admin and anonymous callers receive `403`/`401`; client-supplied roles, actor IDs, provider IDs, audit fields, and revisions are never trusted.
- [ ] **AC-5**: Duplicate manual creation is rejected with `409 PLACE_DUPLICATE` when normalized name/address and coordinates identify one existing canonical place; the response includes only the safe existing place ID.
- [ ] **AC-6**: Concurrent stale edits/archive/restore return `409 PLACE_VERSION_CONFLICT` without losing the newer committed state.
- [ ] **AC-7**: Provider enrichment preserves admin-overridden fields while continuing to refresh non-overridden provider fields.
- [ ] **AC-8**: Archived records disappear from all public Place/recommendation paths, while admin detail and restore remain available and historical foreign IDs are not physically broken.
- [ ] **AC-9**: Core CRUD never accepts arbitrary `photos`, `rating`, `reviewCount`, reviews, raw provider payload, media state, or storage references.
- [ ] **AC-10**: UI preserves form drafts on validation, conflict, network, `429`, and `503` errors and never renders raw backend/provider/Mongo errors.
- [ ] **AC-11**: EN/VI schema parity, keyboard/focus behavior, confirmation dialogs, loading/empty states, and mobile/desktop layout pass verification.
- [ ] **AC-12**: Server deployment validation proves `MONGODB_URI` is explicitly configured for non-local environments; secrets and full connection strings never reach the browser or logs.

---

## 2. Architecture & Service Boundaries

### 2.1 Data Flow

```text
Admin Web (/admin/places)
  -> Authorization: Bearer <JWT>
  -> API Gateway /api/places/admin/catalog/**
  -> Place Service ADMIN security matcher
  -> AdminPlaceCatalogService
  -> Place Service-owned MongoDB: places
  -> cache invalidation
  -> existing async RecommendationIndexerClient (create/update)
     or de-index notification (archive)
```

No web route, Gateway process, Recommendation Service, or other service may query the Place MongoDB directly.

### 2.2 Ownership

| Component | Responsibility | Does not own |
| --- | --- | --- |
| `apps/web/tripsense` | Admin list/form/detail UI, client validation, draft preservation, sanitized feedback | Place identity, authorization, persistence, verification, media approval |
| `services/api-gateway` | Sole public ingress, route, body/rate limits, JWT forwarding | Place authorization or Mongo access |
| `services/place-service` | Validation, RBAC defense in depth, place lifecycle, manual overrides, mutation metadata, Mongo persistence, public visibility | Recommendation vectors or browser state |
| `services/recommendation-service` | Derived index/vector update and stale-result exclusion | Canonical place document |
| MongoDB | Shared durable Place Service data selected by server environment variables | Client-side storage |

### 2.3 Consistency

- Place Mongo commit is authoritative and synchronous for admin mutations.
- Search/detail/category caches are invalidated after commit by place ID and affected normalized location/category keys.
- Recommendation indexing is derived and may be eventually consistent. Create/update uses the existing authenticated internal indexing contract. Archive adds a bounded internal de-index contract or equivalent tombstone handling.
- Recommendation hydration must still reject archived/missing Place records so a stale vector cannot republish an archived place.
- If derived indexing fails, the CRUD response remains committed and Place Service records a sanitized retry signal; it must not roll back valid Mongo data.

### 2.4 Deployment Contract for a Shared Server Database

- Local development may retain the localhost default.
- Staging/production deployment must explicitly supply `MONGODB_URI` and `MONGODB_DATABASE` through backend secret/config management.
- CI/deployment smoke checks must fail if a non-local profile resolves the Place Mongo host to `localhost`, `127.0.0.1`, or an ephemeral test container.
- `NEXT_PUBLIC_API_GATEWAY_URL` points the web app to the deployed Gateway; it never contains Mongo credentials.
- Mongo credentials, connection strings, and database topology are redacted from logs and API responses.

---

## 3. API & Event Contracts

All browser traffic uses API Gateway. Every endpoint below requires a valid `ROLE_ADMIN` token at Place Service as well as normal Gateway authentication behavior. Responses use the existing `ApiResponse<T>` envelope and `Cache-Control: private, no-store`.

### 3.1 Endpoints

| Method | Gateway/Service Path | Purpose | Success |
| --- | --- | --- | --- |
| `GET` | `/api/places/admin/catalog` | Search/filter/keyset-page admin catalog | `200` |
| `GET` | `/api/places/admin/catalog/{placeId}` | Admin detail, including archived metadata | `200` |
| `POST` | `/api/places/admin/catalog` | Create one manual place | `201` + `Location` + `ETag` |
| `PUT` | `/api/places/admin/catalog/{placeId}` | Replace supported editable fields | `200` + new `ETag` |
| `DELETE` | `/api/places/admin/catalog/{placeId}` | Soft archive | `204` |
| `POST` | `/api/places/admin/catalog/{placeId}/restore` | Restore an archived place | `200` + new `ETag` |

Existing media endpoints under `/api/places/admin/{placeId}/media/**` remain the only image upload/approval path.

### 3.2 List Contract

```http
GET /api/places/admin/catalog?q=dragon&lifecycle=ACTIVE&source=MANUAL&category=ATTRACTION&city=Da%20Nang&cursor=&size=24
```

- `q`: optional, trimmed, `1..120`; server escapes regex/metacharacters and searches normalized name/address/provider ID.
- `lifecycle`: `ACTIVE|ARCHIVED|ALL`, default `ACTIVE`.
- `source`: `MANUAL|PROVIDER|ALL`, default `ALL`.
- `category`: existing discovery group or absent.
- `city`: optional normalized exact filter, max 120.
- `size`: `1..50`, default `24`.
- Cursor is opaque/versioned, max 512 characters, ordered by `updatedAt DESC, id DESC`; malformed cursors return `400 INVALID_CURSOR`.

```json
{
  "items": [
    {
      "id": "67f...",
      "name": "Cầu Rồng",
      "city": "Đà Nẵng",
      "primaryType": "tourist_attraction",
      "categories": ["tourist_attraction", "landmark"],
      "provider": "MANUAL",
      "lifecycleStatus": "ACTIVE",
      "mediaState": "PENDING",
      "version": 0,
      "updatedAt": "2026-11-03T14:00:00Z"
    }
  ],
  "nextCursor": null
}
```

### 3.3 Create/Update DTO

```json
{
  "name": "Cầu Rồng",
  "primaryType": "tourist_attraction",
  "categories": ["tourist_attraction", "landmark"],
  "location": { "lat": 16.0611, "lng": 108.2276 },
  "address": "Nguyễn Văn Linh, An Hải, Đà Nẵng",
  "oldAddress": null,
  "city": "Đà Nẵng",
  "district": "Sơn Trà",
  "phone": "+84236...",
  "website": "https://example.org",
  "socials": ["https://example.org/official-page"],
  "openingHours": "Open 24 hours",
  "businessStatus": "OPERATIONAL",
  "description": "..."
}
```

Server validation:

- `name`: required, Unicode NFC, trimmed, `1..200`.
- `primaryType`: required, existing normalized taxonomy code, max 80; generic `point_of_interest`/`establishment` alone is rejected.
- `categories`: `1..20`, each normalized value max 80; must be compatible with `primaryType` ownership.
- `location`: required pair with finite coordinate bounds.
- `address`: required, `1..500`; `city`: required, `1..120`; `district`/`oldAddress`: optional, max 200/500.
- `description`: max 4000; `openingHours`: max 2000; `phone`: max 40.
- `website` and `socials`: HTTPS only, no userinfo, max 2048 each, at most 10 social URLs.
- HTML/script markup is treated as plain text or rejected according to the shared validation utility.
- Unknown JSON fields are rejected to prevent mass assignment.

The server ignores no write field silently. It rejects client attempts to send `id`, `provider`, `providerPlaceId`, `rating`, `userRatingCount`, `reviews`, `photos`, `mediaState`, storage IDs, `sourceData`, audit actors/timestamps, `manualOverrideFields`, or `version` inside the body.

`PUT`, `DELETE`, and restore require:

```http
If-Match: "3"
```

Missing precondition returns `428 PRECONDITION_REQUIRED`; stale revision returns `409 PLACE_VERSION_CONFLICT` with safe current `id`, `version`, and `updatedAt` only.

### 3.4 Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_PLACE`, `INVALID_COORDINATES`, `INVALID_TAXONOMY`, `INVALID_CURSOR` | Safe field/cursor validation failure |
| `401` | `UNAUTHENTICATED` | Missing/invalid token |
| `403` | `ADMIN_REQUIRED` | Authenticated non-admin |
| `404` | `PLACE_NOT_FOUND` | Unknown ID |
| `409` | `PLACE_DUPLICATE`, `PLACE_VERSION_CONFLICT`, `PLACE_ALREADY_ARCHIVED`, `PLACE_NOT_ARCHIVED` | Domain conflict |
| `413` | `REQUEST_TOO_LARGE` | Gateway/service body limit |
| `428` | `PRECONDITION_REQUIRED` | Missing `If-Match` |
| `429` | `RATE_LIMITED` | Bounded admin write rate |
| `503` | `PLACE_STORE_UNAVAILABLE` | Sanitized persistence outage |

No exception class, Mongo query, provider payload, connection string, token, or raw server message is returned.

### 3.5 Recommendation Internal Contract

- Create/update: reuse `POST /api/recommendations/internal/places/index` with service authentication and the committed Place snapshot.
- Archive: add `DELETE /api/recommendations/internal/places/{placeId}` (or a reviewed equivalent tombstone endpoint), authenticated with `X-Internal-Api-Key` and inaccessible through Gateway.
- Restore: re-index after commit.
- No Kafka topic is required for the first increment because the repository already uses this internal indexing path. A durable outbox is a later improvement if operational evidence shows unacceptable missed retries.

---

## 4. Data Model & Migration

### 4.1 Additive `places` Fields

```javascript
{
  managementSource: "MANUAL|PROVIDER",
  lifecycleStatus: "ACTIVE|ARCHIVED",
  manualOverrideFields: ["name", "address", "location", "primaryType"],
  version: NumberLong(0),
  manualCreatedBy: "<user UUID>|null",
  lastEditedBy: "<user UUID>|null",
  lastAdminAction: "CREATE|UPDATE|ARCHIVE|RESTORE|null",
  lastAdminRequestId: "<sanitized correlation ID>|null",
  archivedAt: ISODate("...") | null,
  archivedBy: "<user UUID>|null"
}
```

- Existing documents migrate logically to `managementSource=PROVIDER`, `lifecycleStatus=ACTIVE`, empty overrides, version `0`.
- Manual create writes `managementSource=MANUAL`, `provider=MANUAL`, `providerPlaceId=manual:<UUID>`.
- Add Spring Data `@Version` to the canonical Place aggregate; provider and admin update paths must use version-aware atomic operations.
- Provider persistence must exclude `manualOverrideFields`, lifecycle/audit fields, and version from blind field replacement.

Indexes:

```javascript
db.places.createIndex({ lifecycleStatus: 1, updatedAt: -1, _id: -1 })
db.places.createIndex({ lifecycleStatus: 1, managementSource: 1, updatedAt: -1, _id: -1 })
db.places.createIndex({ lifecycleStatus: 1, city: 1, primaryType: 1, updatedAt: -1 })
// Existing unique { provider: 1, providerPlaceId: 1 } remains authoritative.
```

Do not create another place collection for admin data.

### 4.2 Atomic Mutation Metadata

```javascript
{
  lastEditedBy: "<authenticated user UUID>",
  lastAdminAction: "CREATE|UPDATE|ARCHIVE|RESTORE",
  lastAdminRequestId: "<sanitized correlation ID>",
  updatedAt: ISODate("..."),
  version: NumberLong(4)
}
```

Mutation metadata is written in the same atomic Place update as the canonical field changes, so standalone Mongo deployments do not require a cross-document transaction. It never stores JWTs, Mongo URIs, raw request bodies, media bytes, or before/after descriptions. A full append-only historical audit collection is deferred until retention, access, and replica-set transaction requirements are approved separately.

### 4.3 Duplicate and Archive Behavior

- Duplicate detection reuses the existing canonical logic: normalized name + normalized address + coordinates within 100 meters. Zero or multiple matches do not auto-merge.
- Archive changes lifecycle/audit fields only; it does not delete media audit evidence, user collections, trip IDs, or social snapshots.
- All public repository/query paths must add `lifecycleStatus != ARCHIVED`, treating missing legacy status as active during migration.

### 4.4 Migration and Rollback

1. Deploy readers that interpret missing lifecycle/source/version fields as legacy active/provider defaults.
2. Create indexes with the existing Mongo migration pattern; run bounded backfill for explicit defaults.
3. Deploy version-aware provider persistence before enabling admin writes.
4. Enable admin CRUD route behind `PLACE_ADMIN_CATALOG_WRITES_ENABLED=false` by default, then turn on after shared-DB smoke verification.
5. Rollback disables writes/UI actions but retains committed places and mutation metadata. Never mass-delete manual places during rollback.

---

## 5. Security & Trust Boundaries

| Risk | Required control |
| --- | --- |
| Unauthorized catalog mutation | `ROLE_ADMIN` enforced by Place Service security chain for `/api/places/admin/**`; Gateway is not the sole authorization layer |
| IDOR / mass assignment | Service loads the target by path ID and allowlists editable DTO fields; actor/provider/audit/storage fields come only from authenticated server context |
| Lost updates | Required `If-Match` plus Mongo `@Version`; stale mutations fail atomically |
| Stored XSS / unsafe URLs | Length limits, Unicode normalization, plain-text rendering, HTTPS/no-userinfo URL validation, no `dangerouslySetInnerHTML` |
| NoSQL/regex injection | Never accept raw Mongo filters; escape/normalize `q`; allowlist enum filters; bound query length and page size |
| Accidental hard delete | DELETE maps only to archive; repository has no admin hard-delete operation |
| Provider overwrite | Field-level manual override allowlist is respected by every provider upsert/enrichment path |
| Secret leakage | Mongo URI, JWT, internal API key, provider keys, raw exceptions and source payloads remain backend-only and redacted |
| Abuse | Per-admin mutation rate limit, request body limit, audit actor/request ID, bounded list queries |
| Misleading media/rating | Generic form cannot write provider ratings/reviews or unapproved photo URLs; existing media rights gate remains authoritative |

Frontend must use the shared `apiClient`, `getSafeErrorMessage`, inline field validation, and production-safe logging rules. No raw response/error dump is rendered or logged.

---

## 6. Devil's Advocate & Trade-offs

| Decision | Risk / trade-off | Resolution |
| --- | --- | --- |
| Soft archive instead of hard delete | Mongo retains records and storage | Preserves trip/saved/social IDs and auditability; archived records are excluded from public paths and can be restored |
| Edit provider places with field overrides | More complex enrichment merge | Required to prevent admin corrections disappearing; override list is explicit and testable |
| Shared server Mongo via environment configuration | Misconfigured deployment could still point to local Mongo | Add non-local deployment validation and two-session/restart smoke acceptance; never infer production DB from frontend |
| Synchronous Mongo commit, async recommendation index | Short window of stale derived vectors | Place hydration/lifecycle filter fails closed; de-index retries are observable; admin CRUD availability is not coupled to vector service |
| No arbitrary cover URL in CRUD form | One extra media-management step | Preserves licensing, identity, health, and CDN invariants from the approved durable-media feature |
| Full PUT plus optimistic revision | Client must reload/merge conflicts | Contract is deterministic and avoids ambiguous partial-null semantics; draft remains available after conflict |
| Atomic latest-mutation metadata instead of a historical audit collection | Less forensic history | Works safely on current standalone Mongo as one atomic aggregate update; append-only audit requires a separately approved retention/transaction design |

Rejected alternatives:

- Browser `localStorage`, mock repository, or Next.js-only API route: not shared, not durable, and bypasses Place Service ownership.
- Direct browser/Gateway Mongo access: leaks credentials and violates service boundaries.
- Physical DELETE: breaks references and makes operator mistakes difficult to recover.
- Reusing `photos` with arbitrary URLs: violates durable media rights and health guarantees.
- Creating an admin-place microservice: unnecessary; Place Service already owns the domain and Mongo collection.

---

## 7. Phased Implementation Tasks & Verification

### Phase 1 — Place domain, persistence, and admin API

- [x] Add lifecycle/source/version/manual override/mutation-metadata domain types and migration/index installation.
- [x] Implement `AdminPlaceCatalogService` with allowlisted mapping, duplicate detection, optimistic locking, archive/restore, and safe errors.
- [x] Add paginated repository/MongoTemplate queries that include legacy-active behavior and bounded search.
- [x] Add `AdminPlaceCatalogController` and DTOs; require `If-Match` for mutations after create.
- [ ] Add security tests for anonymous, non-admin, forged role/actor fields, mass assignment, NoSQL/regex input, and ID guessing.

### Phase 2 — Provider, public-read, cache, and recommendation consistency

- [x] Make provider upsert/enrichment version-aware and preserve manual overrides/lifecycle/mutation metadata fields.
- [x] Apply active-place filtering to search, autocomplete, nearby, browse, batch snapshots, public detail, saved-place projection, category and recommendation candidate paths.
- [x] Invalidate affected Place/Redis caches after commit.
- [x] Trigger existing recommendation indexing on create/update/restore; add authenticated de-index/tombstone handling for archive.
- [ ] Add regression tests proving archived places do not reappear through stale provider/vector/cache paths.

### Phase 3 — Admin web UI

- [x] Replace `initialPlaces` and local `toggleVerified` in `/admin/places` with a feature-scoped typed API client using shared `apiClient`.
- [x] Add server search/filter/keyset pagination, skeleton/loading, empty, retry, archived, and disabled states.
- [ ] Add create/edit drawer or dialog with canonical taxonomy and coordinate validation; preserve draft on errors/conflicts.
- [ ] Add inspect/detail, archive confirmation, restore action, source/media/revision indicators, and conflict reload/compare flow.
- [ ] Integrate the existing durable media upload/approval entry point after place creation; do not duplicate media storage logic.
- [x] Add all UI/error strings under `admin.places` with EN/VI parity.

### Phase 4 — Deployment and acceptance

- [ ] Configure shared server `MONGODB_URI`/`MONGODB_DATABASE` secrets and keep them out of images, web bundles, source control, and logs.
- [ ] Verify create/edit/archive/restore through API Gateway with an admin token; verify non-admin rejection.
- [ ] Verify browser A changes are visible in browser B, survive refresh, Place Service restart, and web redeploy.
- [ ] Verify provider enrichment does not overwrite admin-corrected fields.
- [ ] Verify archived records are absent from public search/autocomplete/nearby/browse/recommendations and can be restored.

### Automated Verification Commands

```bash
cd services/place-service && ./mvnw test
cd services/recommendation-service && ./mvnw test
cd services/api-gateway && ./mvnw test
cd apps/web/tripsense && npm run i18n:check
cd apps/web/tripsense && npm run type-check
cd apps/web/tripsense && npm test
cd apps/web/tripsense && npm run lint
cd apps/web/tripsense && npm run build
git diff --check
```

### Required Tests

- Unit: validation, taxonomy, URL safety, duplicate detection, override merging, lifecycle transitions, cursor parsing, optimistic conflict.
- Repository/integration: Mongo indexes, create/update persistence, atomic mutation metadata, legacy-active migration, archive/restore, concurrent writes.
- Controller/security: `401`, `403`, `404`, `409`, `413`, `428`, `429`, sanitized `503`, forbidden/mass-assignment fields.
- Contract: Gateway route/body/rate limits and recommendation index/de-index authentication.
- Web: server data replaces mocks, search/filter/page, form validation, draft preservation, conflict flow, archive/restore, sanitized errors, keyboard/focus, EN/VI parity.
- Regression: provider enrichment, media approval, public search/detail, saved places, recommendations, batch enrichment, and existing price evidence remain correct.

---

## Implementation Status

```text
STATUS: IMPLEMENTING
```

Core implementation and automated regression checks are complete. Phase 4 shared-environment acceptance remains open because it requires deployed Mongo credentials, two independent admin sessions, and restart/redeploy verification. Production writes remain fail-closed until `PLACE_ADMIN_CATALOG_WRITES_ENABLED=true` is explicitly configured.

Automated verification completed on 2026-11-03:

- Web: lint passed for the feature, TypeScript passed, 403 tests passed, i18n schema/order passed, and the production build passed.
- Services: API Gateway 14 tests passed; Place Service 149 tests passed with 1 optional Mongo integration test skipped; Recommendation Service 239 tests passed with 1 optional cloud integration test skipped.
- Focused additions: 17 catalog/provider/lifecycle tests, 5 shared-Mongo/indexer tests, and 6 recommendation index/de-index tests passed after the final changes.
- `git diff --check` passed.
