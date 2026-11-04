# Durable Verified Place Media Coverage — Specification & Implementation Plan

`STATUS: IMPLEMENTING; CODE_AND_AUTOMATED_CHECKS_COMPLETE; LIVE_CLOUDINARY_AND_PROVIDER_RIGHTS_ACCEPTANCE_PENDING`

- **Owner Service**: `services/place-service`
- **Affected Components**: `services/place-service`, `services/api-gateway`, `services/recommendation-service`, `apps/web/tripsense`, Cloudinary-compatible object storage
- **Created Date**: 2026-11-03
- **Approved Date**: 2026-11-03
- **Target PR Boundaries**: Phase 1 (durable media domain and storage), Phase 2 (coverage/backfill and publication gate), Phase 3 (web integration and observability)
- **Related Features**: [Hotel Live Place Photos](./hotel-live-place-photos.md), [Place Batch Enrichment & ZioMap Settings](./place-batch-enrichment-and-ziomap-settings.md), [Provider API Key Management](./provider-api-key-management.md)

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

TripSense currently renders short-lived provider photo URLs. ZioMap/provider credentials can expire or exhaust quota, and the returned media URL itself is treated as valid for only five minutes. Replacing the key cannot repair an already expired browser URL, so cards can fall back to “no licensed photo”.

The user goal is that every **publicly displayed curated place** always has a correct, loadable image for that exact place. The durable guarantee cannot be made for every arbitrary third-party place on the internet: a provider may have no image, may revoke access, or may prohibit copying its media. TripSense therefore enforces the guarantee at its own publication boundary:

1. A place may enter curated Explore/recommendation feeds only when it has at least one approved durable media asset.
2. Durable assets are stored in TripSense-controlled object storage only when TripSense has explicit storage/display rights.
3. Live search may discover a place before durable media is ready, but it must not present a broken URL as a valid photo. It shows a clearly labelled non-photo location/category fallback while ingestion is pending.
4. Generic stock images must never be represented as photos of a specific place.

### 1.2 User and Operator Flows

#### Curated Explore/recommendation flow

1. Place Service resolves the place's approved primary durable asset.
2. Recommendation Service receives only media-ready candidates for public curated feeds.
3. Web renders the stable CDN URL and retries a second approved asset on delivery failure.
4. If all approved assets fail health checks, Place Service changes the place to `MEDIA_DEGRADED`; the place is removed from newly generated curated feeds until repaired.

#### Ingestion/backfill flow

1. An operator runs a bounded media coverage job for places in `PENDING`, `DEGRADED`, or `UNAVAILABLE` state.
2. Place Service attempts sources in deterministic order: existing rights-approved TripSense asset, partner-owned upload, approved community submission, then provider media that explicitly permits durable storage.
3. The service validates identity, license evidence, MIME/file signature, dimensions, byte size, checksum and safe decoding before uploading to the Place Service storage namespace.
4. A moderator approves/rejects ambiguous assets. Approval atomically sets the place's primary asset and `mediaState=READY`.
5. Coverage metrics report which places remain blocked and why; retries use exponential backoff and never rotate through all provider keys in a tight loop.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Place Service-owned durable media metadata and Cloudinary-compatible storage adapter.
  - A rights/license gate before copying any third-party media.
  - Admin upload, review, primary selection, coverage reporting and bounded backfill APIs.
  - A publication invariant for curated Explore/recommendation results: `mediaState=READY` and at least one approved asset.
  - Stable derived CDN URLs, a secondary-asset retry, scheduled health verification and degraded-state recovery.
  - Backward-compatible `PlaceDto` media fields while clients migrate from transient `photos` URLs.
  - Web UI rendering that never exposes raw provider errors and never substitutes an unrelated photo.
  - English/Vietnamese parity under the `places` namespace.
- **Out-of-Scope**:
  - Scraping Google, ZioMap, social networks, or arbitrary websites.
  - Copying provider photos when terms or license evidence do not permit persistent storage.
  - Claiming 100% real-photo coverage for arbitrary live-search results that have no licensed image source.
  - AI-generated images presented as real photographs of a place.
  - A new media microservice or cross-service database access.
  - Reusing Social Service or Trip Service media tables/entities; each service retains its own data ownership.

### 1.4 Domain Invariants

- A curated/public-feed place is media-ready only when an `APPROVED`, non-deleted asset belongs to the same `placeId`, passes the current health check, and includes acceptable license evidence.
- `primaryMediaAssetId` must reference an approved asset owned by the same Place Service place.
- Provider API keys, storage credentials and raw provider responses remain backend-only.
- A temporary provider URL is evidence for ingestion/refresh, not a durable public asset.
- An unverified, generic, AI-generated, or mismatched image can never satisfy the publication gate.
- A CDN failure must not silently promote an unapproved fallback.

### 1.5 Acceptance Criteria

- [ ] **AC-1**: Every place returned by curated Explore/recommendation endpoints has `media.state=READY` and at least one approved, loadable durable CDN asset.
- [ ] **AC-2**: Expiry, revocation or quota exhaustion of a ZioMap key does not invalidate already approved durable assets.
- [ ] **AC-3**: Provider URLs are never copied unless the recorded rights policy permits persistent storage and required attribution is retained.
- [ ] **AC-4**: A broken primary CDN asset triggers one bounded retry using a different approved asset; repeated failures mark the asset/place degraded and exclude it from newly generated curated feeds.
- [ ] **AC-5**: Live-search places without durable media show an explicitly labelled non-photo fallback and never show an unrelated stock image or broken-image icon.
- [ ] **AC-6**: Admin coverage reports distinguish `READY`, `PENDING`, `DEGRADED`, `UNAVAILABLE`, `RIGHTS_BLOCKED`, and `REVIEW_REQUIRED`, including a sanitized reason code.
- [ ] **AC-7**: Upload/import rejects invalid MIME, mismatched file signatures, oversized files, unsafe dimensions, duplicate bytes and unauthorized place mutations.
- [ ] **AC-8**: Existing consumers of `photos`, `primaryPhoto`, and `photoGallery` remain compatible during migration.
- [ ] **AC-9**: UI strings pass i18n schema parity/sorting checks and no raw server/provider/storage error reaches UI or client logs.
- [ ] **AC-10**: Before enabling the publication gate, a dry-run report shows coverage and the operator explicitly selects the rollout threshold; rollout cannot unexpectedly empty a destination feed.

## 2. Architecture & Service Boundaries

### 2.1 Interaction and Data Flow

```text
Admin / approved ingestion source
  -> API Gateway
  -> Place Service
       -> validate identity + rights + bytes
       -> Place-owned Cloudinary namespace
       -> place_media_assets + places.mediaState

Explore / Recommendation request
  -> API Gateway
  -> Recommendation Service
       -> Place Service candidate contract (mediaReadyOnly=true)
       -> only READY candidates
  -> Web receives stable media DTO
  -> CDN delivery

Scheduled health verifier
  -> HEAD/decoded sample through allowlisted CDN
  -> asset health update
  -> READY <-> DEGRADED publication state transition
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/place-service` | Own places, media metadata, rights evidence, storage adapter, moderation state, health checks, coverage jobs and publication eligibility | MongoDB owned by Place Service; synchronous provider/storage calls; internal DTOs |
| `services/api-gateway` | Route public/admin requests, enforce configured auth/rate/body limits | Existing Spring Cloud Gateway routes |
| `services/recommendation-service` | Request/filter media-ready place candidates; never query Place MongoDB | Existing synchronous Place contract; no shared entities |
| `apps/web/tripsense` | Render stable approved media, bounded secondary retry, accessible labelled fallback and admin coverage controls | HTTP through API Gateway; CDN GET |
| Cloudinary-compatible storage | Store and deliver rights-approved Place Service assets | Backend upload/delete; browser delivery URL only |

No new microservice is introduced. Existing Social/Trip Cloudinary code may inform an adapter pattern, but Place Service uses its own folder namespace, authorization and persistence.

### 2.3 Sync vs Async Decision

- Public reads and admin mutations are synchronous because callers need an immediate authoritative response.
- Initial backfill is an idempotent Place Service job with persisted job/asset state; no Kafka dependency is required.
- Recommendation indexing continues through existing integration. If implementation shows stale eligibility after state changes, add a versioned `tripsense.place.media-state-changed.v1` event only as an approved plan revision.

### 2.4 Rollout Safety

The publication gate starts in `REPORT_ONLY`, then `WARN`, then `ENFORCE` per destination/category. `ENFORCE` is blocked if the configured minimum candidate count would be violated. Existing destination baseline behavior remains available until coverage meets the approved threshold.

## 3. API & Contract Changes

### 3.1 Public Place Media DTO

Existing Place responses add a backward-compatible field:

```json
{
  "media": {
    "state": "READY",
    "primary": {
      "assetId": "pm_01...",
      "url": "https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/<publicId>",
      "width": 1600,
      "height": 1067,
      "alt": "Chùa Pháp Lâm, Đà Nẵng",
      "attribution": [{ "label": "...", "url": "https://..." }]
    },
    "gallery": [],
    "fallbackKind": null
  }
}
```

`url` is server-derived from an approved storage reference. It never contains `key`, `token`, `secret`, or a provider credential. `photos`, `primaryPhoto`, and `photoGallery` remain during one deprecation window and are populated only from the same approved media resolver when durable assets exist.

### 3.2 Admin Endpoints

| Method | Gateway Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/places/admin/media/coverage?destinationId=&state=&cursor=&limit=` | `ROLE_ADMIN` | Coverage counts and paged place issues |
| `POST` | `/api/places/admin/{placeId}/media` | `ROLE_ADMIN`, multipart | Validate and upload one durable asset |
| `POST` | `/api/places/admin/{placeId}/media/{assetId}/approve` | `ROLE_ADMIN` | Approve asset and optionally make primary |
| `POST` | `/api/places/admin/{placeId}/media/{assetId}/reject` | `ROLE_ADMIN` | Reject with bounded reason code |
| `PUT` | `/api/places/admin/{placeId}/media/primary` | `ROLE_ADMIN` | Atomically select an approved primary asset |
| `DELETE` | `/api/places/admin/{placeId}/media/{assetId}` | `ROLE_ADMIN` | Soft-delete metadata; storage deletion is best-effort after reference check |
| `POST` | `/api/places/admin/media/backfill-jobs` | `ROLE_ADMIN` | Start an idempotent bounded dry-run or execution job |
| `GET` | `/api/places/admin/media/backfill-jobs/{jobId}` | `ROLE_ADMIN` | Poll persisted progress and sanitized failures |

Multipart upload fields: `file`, `sourceType`, `licenseType`, `licenseEvidenceUrl`, optional attribution fields, and `makePrimary`. The service accepts only JPEG/PNG/WebP, maximum 10 MB, bounded pixel dimensions, and server-detected file signatures.

Backfill request:

```json
{
  "destinationId": "danang",
  "states": ["PENDING", "DEGRADED", "UNAVAILABLE"],
  "limit": 500,
  "dryRun": true,
  "maxConcurrency": 3,
  "idempotencyKey": "media-backfill-danang-20261103"
}
```

### 3.3 Internal Candidate Contract

Existing Place candidate/search contracts add optional `mediaReadyOnly` (default `false` for backward compatibility). Curated recommendation paths pass `true` after rollout reaches `ENFORCE`. Place Service remains authoritative for eligibility; Recommendation Service must not recreate media-state rules.

## 4. Data Model & Migration

### 4.1 `places` Collection Additions

```javascript
{
  mediaState: "PENDING|READY|DEGRADED|UNAVAILABLE|RIGHTS_BLOCKED|REVIEW_REQUIRED",
  primaryMediaAssetId: "pm_...",
  mediaLastVerifiedAt: ISODate,
  mediaStateReason: "NO_SOURCE|DELIVERY_FAILED|RIGHTS_UNKNOWN|REVIEW_PENDING|null",
  mediaVersion: NumberLong(0)
}
```

Indexes:

```javascript
db.places.createIndex({ mediaState: 1, city: 1, primaryType: 1 })
db.places.createIndex({ primaryMediaAssetId: 1 }, { sparse: true })
```

### 4.2 `place_media_assets` Collection

```javascript
{
  _id: "pm_...",
  placeId: "...",
  storageProvider: "CLOUDINARY",
  storagePublicId: "tripsense/places/<placeId>/<assetId>",
  sourceType: "ADMIN_UPLOAD|PARTNER_APPROVED|COMMUNITY_APPROVED|LICENSED_PROVIDER_IMPORT",
  sourceProvider: "ZIOMAP|null",
  sourceReferenceHash: "sha256|null",
  licenseType: "OWNED|PARTNER_GRANTED|CC_BY|PROVIDER_PERSISTENCE_ALLOWED",
  licenseEvidenceUrl: "https://...",
  attribution: [{ label: "...", url: "https://..." }],
  checksumSha256: "...",
  perceptualHash: "...",
  mimeType: "image/webp",
  byteSize: NumberLong(123456),
  width: 1600,
  height: 1067,
  moderationStatus: "PENDING|APPROVED|REJECTED",
  healthStatus: "HEALTHY|DEGRADED|MISSING",
  verifiedAt: ISODate,
  deletedAt: null,
  createdBy: "userId",
  createdAt: ISODate,
  updatedAt: ISODate,
  version: NumberLong(0)
}
```

Indexes:

```javascript
db.place_media_assets.createIndex({ placeId: 1, moderationStatus: 1, healthStatus: 1 })
db.place_media_assets.createIndex({ checksumSha256: 1 })
db.place_media_assets.createIndex({ storagePublicId: 1 }, { unique: true })
db.place_media_assets.createIndex({ sourceProvider: 1, sourceReferenceHash: 1 }, { sparse: true })
```

### 4.3 Migration Strategy

Mongo changes are additive and backward-compatible:

1. Deploy readers that tolerate missing media fields.
2. Initialize existing places to `PENDING`; do not infer `READY` from stored transient URLs.
3. Run a dry-run audit of existing URLs and rights evidence.
4. Import only assets with proven durable-storage rights; otherwise set `RIGHTS_BLOCKED` or leave `PENDING`.
5. Backfill durable assets and enable the publication gate destination-by-destination.

Rollback disables the gate and new admin routes while retaining asset/license audit records. Storage cleanup must be a separate reference-checked operation; rollback must not mass-delete uploaded assets.

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Provider/storage secret leakage | Backend-only environment configuration; DTOs expose derived HTTPS delivery URLs only; zero-leak logging applies. |
| IDOR/admin abuse | Gateway plus Place Service role enforcement; server loads `placeId`; no client-provided ownership or folder path is trusted. |
| Malicious image/polyglot/decompression bomb | Validate actual bytes, magic signature, decoded dimensions and size; re-encode through the storage image pipeline; reject SVG and arbitrary remote URLs. |
| SSRF | No public “import URL” endpoint. Provider fetches use configured clients and allowlisted hosts only. |
| Wrong-place image | Require stable place binding and source evidence; ambiguous imports enter `REVIEW_REQUIRED`; perceptual/metadata checks assist but never auto-prove identity. |
| Copyright/licensing breach | Persist license type/evidence and attribution; fail closed when durable storage rights are unknown. |
| CDN deletion/race | Optimistic version on primary selection; never delete an asset still referenced as primary; health verifier repairs state deterministically. |
| Cost/quota abuse | Admin-only jobs, idempotency key, rate limits, bounded concurrency, byte/count limits and provider circuit breakers. |

## 6. Devil's Advocate & Trade-offs

| Decision | Trade-off / Rationale |
| --- | --- |
| Guarantee only for places TripSense publishes in curated feeds | This is the only honest enforceable guarantee. “Every place on the internet always has a real photo” is impossible when no licensed photo exists. |
| Store rights-approved assets in Place-owned object storage | Removes runtime dependency on expiring provider URLs/keys but adds storage, moderation, health-check and legal-compliance cost. |
| Exclude non-ready places from curated feeds | Preserves the invariant but can reduce candidate diversity. Report-only rollout and minimum-candidate guard prevent empty feeds. |
| Keep an explicit non-photo fallback for live search | Maintains usable UI without lying. A category illustration or map tile is labelled as a fallback, never as the place's photograph. |
| Do not cache/copy all ZioMap/Google images | Bulk copying may violate provider terms and still risks mismatched images. Only contractually permitted imports are allowed. |
| Reuse Place Service instead of adding a media service | Media is intrinsic to Place publication and the current scale does not justify a new service boundary. |
| No AI-generated “real place” fallback | It could fabricate architecture, branding or conditions and violate the requirement that the image be correct. |

## 7. Phased Implementation Tasks & Verification

### Phase 1 — Durable Media Domain and Storage

- [x] Add additive Mongo models, indexes, enums and optimistic primary-selection logic in Place Service.
- [x] Implement a Place-owned Cloudinary-compatible adapter with derived URLs, upload validation and reference-checked deletion.
- [x] Add public media resolver and backward-compatible DTO projection.
- [x] Add admin upload/approve/reject/primary endpoints and Gateway body/rate limits.
- [ ] Unit/integration tests for rights gate, file validation, IDOR/RBAC, duplicate checks, state invariants and provider/storage failures.

### Phase 2 — Coverage, Backfill and Publication Gate

- [x] Implement persisted, idempotent coverage/backfill jobs with dry-run and globally bounded concurrency. Provider/key retry and circuit-breaking remain delegated to the existing provider client.
- [x] Implement scheduled CDN health verification and deterministic `READY <-> DEGRADED` transitions.
- [x] Extend Place candidate contract with `mediaReadyOnly`; integrate Recommendation Service without cross-database access.
- [ ] Add report-only/warn/enforce rollout configuration and minimum-candidate safety guard.
- [ ] Run coverage audit by destination/category and record rights-blocked/manual-review inventory.

### Phase 3 — Web Integration and Operations

- [x] Migrate place cards/details to the new `media` DTO while retaining legacy compatibility.
- [x] Retry one distinct approved secondary asset on image error; then render the labelled non-photo fallback without raw errors.
- [x] Add admin coverage/job UI with sanitized reason codes and no credential/raw provider output.
- [x] Add English/Vietnamese strings, schema parity and accessibility text in the existing settings/place domains.
- [ ] Add telemetry for ready coverage, delivery failures, degradation, job outcomes and feed candidate impact without logging secrets or full signed URLs.

### Verification Commands

```bash
cd services/place-service && ./mvnw test
cd services/recommendation-service && ./mvnw test
cd services/api-gateway && ./mvnw test
cd apps/web/tripsense && npm run type-check
cd apps/web/tripsense && npm run test
cd apps/web/tripsense && npm run i18n:check
cd apps/web/tripsense && npm run build
```

Manual acceptance must include: provider keys unavailable, primary CDN asset deleted, secondary asset healthy, no licensed source, rights-blocked source, duplicate upload, concurrent primary selection, destination below candidate threshold, and a successful recovery from `DEGRADED` to `READY`.

## 8. Approved Decisions and Preconditions

1. Cloudinary is selected as the Place Service durable storage provider.
2. ZioMap is an ingestion source only when its applicable terms and recorded license evidence permit persistent storage and redistribution; implementation must fail closed until that precondition is verified.
3. Live-search results without a real approved photo remain visible with a clearly labelled non-photo fallback; curated feeds return only `READY` places after enforcement is enabled.
4. Initial `ENFORCE` rollout uses the planned recommended safety threshold: at least 95% destination/category coverage and at least 20 ready candidates per active category, while every curated card actually returned must have approved durable media.

## Human Approval Gate

```text
STATUS: APPROVED
```

Human approval received on 2026-11-03. Application implementation must begin only through the repository's feature implementation workflow.

## Implementation Evidence (2026-11-03)

- Place Service owns durable Cloudinary metadata, license evidence, health state, admin APIs, migration/index creation, idempotent backfill and provider-import rights gating.
- Recommendation/Place contracts support opt-in `mediaReadyOnly` filtering; evidence counts are calculated after the media gate.
- The opt-in recommendation media gate now checks the current Place Service candidate coverage (default 95% and at least 20 READY candidates) before requesting READY-only results. If the threshold or READY-only response fails, it preserves the baseline result and reports `MEDIA_GATE_BELOW_SAFE_THRESHOLD`. This is a request-level safety guard; the planned operator-controlled `REPORT_ONLY`/`WARN`/`ENFORCE` rollout and live destination audit remain pending.
- Web cards consume stable Cloudinary assets, advance past failed approved assets and end in a labelled non-photo state.
- Automated verification passed: Place Service full suite, Recommendation Service 238 tests, API Gateway 14 tests, web 400 tests, TypeScript, i18n parity, lint (warnings only) and production build.
- Live acceptance remains pending because no real Cloudinary credentials or recorded ZioMap persistent-storage/redistribution approval were provided. `ZIOMAP_PHOTO_PERSISTENCE_APPROVED` therefore remains `false` by default and must not be enabled without that evidence.
