# Test Plan: Place Search & Map Application

Define the tests required before the feature is PR-ready.

## Unit Tests

### `services/place-service`
1. **`PlaceRankingServiceTest`**:
   - Verify deterministic scoring weights (text relevance, distance penalty/bonus, rating boost, review count log scale, freshness).
2. **`ZioMapProviderTest`**:
   - Mock external ZioMap HTTP responses and verify normalization into internal `Place` DTO.
   - Verify handling of missing fields (no photos, null phone, null hours).
3. **`PlaceSearchServiceTest`**:
   - Cache-hit scenario: returns Redis results without hitting MongoDB or ZioMap.
   - Cache-miss + sufficient local Mongo results: returns Mongo results and writes to Redis.
   - Cache-miss + insufficient local results: calls ZioMap, executes idempotent upsert in Mongo, writes to Redis, returns merged list.
   - Idempotency test: repeated search upserts existing records without duplicate keys or errors.

### `apps/web/tripsense`
1. **`PlaceCardTest`**:
   - Verify correct rendering of photo, rating, price, badges, address.
   - Verify omission of `null`/`undefined` fields.
2. **`SearchBarTest`**:
   - Verify 300ms debounce before invoking `apiClient` autocomplete.
3. **Map State Synchronizer**:
   - Verify setting `selectedPlaceId` triggers card highlight and map focus event.
4. **`MapVinaContainer`**:
   - Verify MapVina GL is initialized with the configured style and attribution.
   - Verify POI/marker selection updates the selected place without relying on the legacy MapLibre alias.
5. **MapVina fallback client**:
   - Verify backend search/details are attempted first, then MapVina fallback mapping is used only on failure or unusable data.
   - Verify autocomplete maps MapVina V2 predictions into `AutocompleteSuggestion`.

---

## Integration Tests

1. **`PlaceControllerIT`**:
   - Test `GET /api/places/search?q=cafe` through Spring MockMvc / WebTestClient.
   - Test `GET /api/places/autocomplete?q=madame`.
   - Test `GET /api/places/{id}` with valid and invalid IDs.
   - Test parameter validations (out-of-bounds coordinates, blank query strings).
2. **API Gateway Route Integration**:
   - Verify proxying of `/api/places/**` requests to `place-service`.

---

## Security Tests

1. **Secret Leakage Prevention**:
   - Run a static check to ensure `ZIOMAP_API_KEY` is not present in frontend bundles or public responses.
   - Verify no concrete ZioMap credential is committed in `docker-compose.yml` or other tracked configuration.
   - Verify deployment supplies a restricted `NEXT_PUBLIC_MAPVINA_API_KEY` and that no hard-coded MapVina token remains.
2. **Input Validation & Injection Prevention**:
   - Test SQL/NoSQL injection payloads in `q` search parameter.
   - Test extreme values for `lat`, `lng`, and `radius`.

---

## Manual Verification

1. Start API Gateway, Discovery Server, Place Service, Redis, and Web App.
2. Search `"top quán ăn ngon ở Đà Nẵng"`:
   - Observe loading indicator.
   - Check place cards list rendered with images, ratings, tags.
   - Check the MapVina map loads centered on Da Nang with markers and correct attribution.
   - Check map bounds automatically fitted to markers.
3. Click a place card in the list -> map pans and zooms to marker, marker turns selected/active.
4. Click a marker on the map -> corresponding place card scrolls into view and highlights.
5. Search a second time with the exact same query -> response latency < 50ms (served from Redis).
6. Flush Redis cache -> search is served from MongoDB (< 200ms) without contacting ZioMap.

---

## Regression Risks

- Gateway routing conflicts with other `/api/**` service paths.
- `mapvina-gl` bundle size impact on initial Next.js page load (mitigated via `next/dynamic` with `ssr: false`).
- Direct MapVina browser fallback bypasses backend cache, persistence, and gateway controls.
