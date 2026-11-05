# Admin Place Map Reverse Geocoding — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Owner Service**: `services/place-service` (existing)
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway` (existing route), `services/place-service`
- **Created Date**: 2026-11-04
- **Approved Date**: 2026-11-04 (user approval in chat)
- **Implementation Note**: CI ambiguity remediation and local backend regression suites pass; CI rerun, live provider acceptance and service deployment remain pending.
- **Related Plan**: [Admin Shared Place Catalog CRUD](./admin-shared-place-catalog-crud.md) — address geocoding was explicitly out of scope there
- **Provider reference**: [MapVina Reverse Geocoding v2](https://docs.mapvina.com/api-integration/reverse-geocoding/v2/)

## 1. Goal & Requirements

When an admin clicks a new position on the add/edit place map, update the location coordinates immediately and look up a human-readable address for the selected point. On a sufficiently precise match, fill the existing **Address** field automatically; the admin can review and edit it before saving. Do not add fields to the Place mutation or write to MongoDB until the existing Save action succeeds.

**In scope**: map-click reverse lookup; loading, no-match and safe error feedback; stale-response protection; English/Vietnamese text; tests. **Out of scope**: forward geocoding from typed address, bulk enrichment, automatic place-name/category changes, and public search changes.

Acceptance criteria:

1. A map click updates the marker and coordinates immediately, then populates the Address field from a verified street-address result near the clicked point.
2. The existing address is not cleared or replaced on timeout, provider failure, no precise result, or a result beyond the configured proximity limit. The UI asks for manual entry in these cases.
3. A response to an older map click cannot overwrite a newer selection. A response cannot overwrite an address edited manually after that click. Closing/reopening the form cannot apply an old response to another place.
4. Opening an edit form never triggers a lookup or silently changes the stored address. Manual coordinate input remains available and does not trigger lookup until an explicit map click.
5. Save uses the existing catalog mutation payload and validation; address and coordinates are persisted only by the existing Create/Update endpoint after user confirmation.
6. The provider key, raw provider errors and full provider response never reach the browser or application logs. EN/VI parity, backend tests, frontend tests and responsive form checks pass.

## 2. Architecture & Service Boundaries

```text
Admin web map click -> apiClient -> API Gateway -> Place Service -> MapVina reverse API
                                      (JWT ADMIN)     (server-side key)
Admin Save -> existing catalog mutation -> Place Service MongoDB
```

- Place Service owns place/location metadata and provider integration. The existing Gateway path `/api/places/admin/catalog/**` routes the new read endpoint; add explicit route/auth tests, no new microservice.
- Synchronous HTTP is required because the editor needs an immediate address. No Kafka event and no database write for a lookup.
- MapVina GL remains the browser map renderer. Its browser-visible *style* token must not be reused as a reverse-geocoding credential. Resolve an active `MAPVINA` key from the existing backend key pool or server environment. The existing hardcoded MapVina key default must not be relied on for this endpoint and should be removed during implementation.

## 3. API & Event Contracts

| Method | Gateway/service path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/places/admin/catalog/reverse-geocode?lat=16.08706&lng=108.21754` | ADMIN JWT | Look up a candidate address; no mutation |

Successful envelope, following the existing `ApiResponse` convention:

```json
{
  "success": true,
  "data": {
    "matched": true,
    "address": "Đường ..., Sơn Trà, Đà Nẵng, Việt Nam",
    "distanceMeters": 24,
    "source": "MAPVINA"
  }
}
```

`200` with `matched:false`, `address:null`, `distanceMeters:null` means no suitable result. Validate finite latitude `[-90,90]` and longitude `[-180,180]` (`400` for invalid input). Use `401/403` for auth, `429` for throttling, `503` for no configured backend key/provider unavailable, and a bounded upstream timeout with a safe `502/503` response. Add `Cache-Control: no-store`; never return provider IDs, key, raw errors, full payload, or provider URL. No event contract.

Provider adapter calls MapVina v2 `/api/v2/geocode/json` with `latlng={lat},{lng}`, `result_type=street_address`, `new_admin=true`, `size=5`, and a bounded radius (initially 100 m). Select a nonblank `formatted_address` only when its geometry is within 100 m of the clicked point; otherwise return no match. Parse provider `status=ZERO_RESULTS` as no match and treat other failure statuses as provider errors. Do not fabricate an address from map labels or a nearby business name. The provider API and response shape are documented by [MapVina](https://docs.mapvina.com/api-integration/reverse-geocoding/v2/).

## 4. Data Model & Migrations

No new collection, field, index, or migration. The existing `address` and `location` fields in the Place document remain authoritative after Save. Reverse-lookup results are ephemeral form suggestions, not persisted lookup records. Rollback removes the read endpoint and client call without a data migration.

## 5. Security & Trust Boundaries

- Gateway and Place Service both enforce ADMIN authorization, consistent with catalog endpoints. Validate input on the service, not only the browser.
- Server key comes from the existing encrypted `MAPVINA` key pool or environment; never from `NEXT_PUBLIC_*` or a request parameter. No hardcoded fallback credential. Restrict outbound URL to configured MapVina host and bound timeout/response size.
- Reuse Gateway rate limiting or add a dedicated per-admin lookup limit to prevent quota abuse. Avoid logging query coordinates with identities or provider payload; log only safe request IDs/error categories.
- Web uses `apiClient` and localized, sanitized status messages; never displays raw server/provider errors.

## 6. Failure Modes & Decisions

| Scenario | Behavior |
| --- | --- |
| Two rapid clicks, responses out of order | Abort previous request where possible and apply only the latest request sequence and coordinate pair. |
| Admin edits Address while lookup is pending | Mark field as manually changed; preserve typed value; offer a deliberate “Use suggested address” action if a candidate arrives. |
| Provider no match, approximate result, water/road without precise address | Keep current Address unchanged; show a small manual-entry prompt. |
| Provider timeout/quota/key missing | Keep coordinates and draft; show safe retry/manual-entry status; Save remains possible if Address is valid. |
| Edit form opened or coordinates typed manually | Do not make background provider requests or overwrite the existing Address. |

Reject direct browser reverse-geocoding because it bypasses the Gateway and exposes/uses a provider credential. Reject auto-filling from the nearest POI because it could attach another business's address to the place. Do not automatically change city, district, old address, name or taxonomy from one reverse-lookup result; those remain explicitly editable and require admin review.

## 7. Implementation Tasks & Verification

1. Add a narrow MapVina reverse adapter and DTO in Place Service; reuse backend key-pool resolution, configure timeout, sanitize errors and remove the hardcoded default key dependency.
2. Add the ADMIN-only catalog read endpoint and Gateway auth/rate-limit coverage. Test invalid coordinates, no match, provider failure, key missing, distance threshold and no raw-data leakage.
3. Add an `apiClient` method and map-click state in the admin editor. Keep coordinates immediate; update Address only for the current unedited selection; show localized loading/suggestion/no-match/error feedback.
4. Test rapid clicks, manual-edit race, reopen race, no result, edit-form initial state, and successful Save payload. Verify map and form layout on desktop/mobile.

Verification: Place Service focused Maven tests, Gateway route/security tests, web Vitest tests, `npm run type-check`, `npm run i18n:check`, targeted ESLint, and manual end-to-end acceptance with a configured MapVina backend key. Do not call the provider from automated unit tests.

## Human Approval Gate

`STATUS: APPROVED`

Approved by the user on 2026-11-04; implementation may proceed within this scope.

## Implementation Verification (2026-11-04)

- Added the ADMIN-only, rate-limited Gateway route and Place Service reverse endpoint. The Place Service adapter limits provider response size, validates coordinates, uses only a backend key, and only accepts street addresses within 100 m.
- Added web map-click lookup with abort/sequence guards, manual-edit preservation, localized statuses, and unchanged Create/Update payload.
- Focused Maven tests passed in a temporary offline Java 21 container: 7 reverse-adapter, 3 catalog-security, and 8 Gateway tests; no provider request was made by tests.
- Web full test suite (409 tests), TypeScript, i18n, lint (0 errors; existing unrelated warnings), and production build passed.
- 2026-11-05 CI remediation: isolated `RecommendationIndexerClient` from provider-specific `RestClient` beans so adding `mapVinaRestClient` no longer makes Spring injection ambiguous. The existing `PlaceServiceApplicationTests.contextLoads` regression check passes. Full local suites pass with JDK 25 test-only compatibility overrides: Place Service 169 tests (1 skipped) and User Service 51 tests, with zero failures/errors. CI rerun remains pending on the standard Java 21 environment.
- Live acceptance with a configured backend MapVina key and deployment of rebuilt Place Service/Gateway remains to be performed; do not mark DONE yet.
