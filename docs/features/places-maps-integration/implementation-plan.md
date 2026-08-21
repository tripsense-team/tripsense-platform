# Implementation Plan: Place Search & Map Application

Implementation may start only when the feature status is `APPROVED`.

## Tasks

### Phase 1: Backend Infrastructure & Service Foundation (`services/place-service`)
1. **Dependencies & Config**:
   - Add Spring Data MongoDB, Spring Data Redis, WebClient/RestClient dependencies to `services/place-service/pom.xml`.
   - Configure `application.yaml` for MongoDB connection, Redis connection, and ZioMap API client (`ziomap.api-key`, `ziomap.base-url`, `ziomap.timeout-ms`, cache TTLs, default city/country).
2. **Domain Models & Repositories**:
   - Implement `Place` MongoDB entity with 2dsphere and text indexes.
   - Implement `PlaceRepository` with text query and geospatial `$nearSphere` methods.
3. **Provider Abstraction & ZioMap Client**:
   - Define `PlaceProvider` interface (`textSearch`, `autocomplete`, `getDetails`, `nearbySearch`).
   - Implement `ZioMapProvider` with HTTP client calls to ZioMap Places API and response mapping to internal models.
4. **Ranking & Local Search Logic**:
   - Implement `PlaceRankingService` (deterministic scoring formula: text match + distance + rating + reviews + freshness).
   - Implement `PlaceCacheService` (Redis hash keying, TTL management, graceful cache-miss handling).
   - Implement `PlaceSearchService` (cache-aside workflow: Redis -> MongoDB -> ZioMap fallback -> Idempotent Mongo upsert -> Redis write).
5. **Controllers & Gateway Route**:
   - Implement `PlaceController` with `GET /api/places/search`, `GET /api/places/autocomplete`, `GET /api/places/{id}`, `GET /api/places/nearby`.
   - Update `services/api-gateway` configuration to route `/api/places/**` to `place-service`.

### Phase 2: Frontend Architecture & MapVina Integration (`apps/web/tripsense`)
1. **MapVina Engine & Provider**:
   - Install `mapvina-gl` in `apps/web/tripsense`.
   - Implement `MapVinaContainer` under `src/features/map` with the MapVina streets style and `NEXT_PUBLIC_MAPVINA_API_KEY`.
   - Implement marker hover/click interactions, base-map POI selection, and viewport fitting. Keep `MapLibreContainer` only as a temporary compatibility alias.
2. **Places Feature Module**:
   - Create types in `src/features/places/types/index.ts`.
   - Implement API client in `src/features/places/services/places-api.ts`.
   - Build UI components:
     - `SearchBar` with 300ms debounced autocomplete dropdown.
     - `PlaceCard` (responsive, Mindtrip-inspired design with photos, rating, categories, address, opening hours).
     - `PlaceList` with loading skeletons, empty states, and error handling.
     - `PlaceDetailModal` / `PlaceDetailSheet` for on-demand rich place views.
3. **SplitView Layout & State Synchronization**:
   - Build `PlaceDiscoveryView` integrating SearchBar, PlaceList, and MapVina GL.
   - Wire `selectedPlaceId` state to synchronize list item highlight and map marker focus.
   - Create page route at `src/app/(main)/places/page.tsx` or update explore experience.

---

## Sequencing

1. Phase 1 (Backend: Place Service MongoDB + Redis + ZioMap client + Gateway routing)
2. Phase 2 (Frontend: MapVina container + Places UI components + state synchronization)
3. Phase 3 (End-to-end verification, responsive testing, and test suite execution)

---

## Files Likely Affected

- `services/place-service/pom.xml`
- `services/place-service/src/main/resources/application.yaml`
- `services/place-service/src/main/java/fu/tripsense/placeservice/domain/model/Place.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/domain/repository/PlaceRepository.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/providers/PlaceProvider.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/providers/ziomap/ZioMapProvider.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/service/PlaceSearchService.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/service/PlaceRankingService.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/service/PlaceCacheService.java`
- `services/place-service/src/main/java/fu/tripsense/placeservice/controller/PlaceController.java`
- `services/api-gateway/src/main/resources/application.yaml`
- `apps/web/tripsense/package.json`
- `apps/web/tripsense/src/features/map/**`
- `apps/web/tripsense/src/features/places/**`
- `apps/web/tripsense/src/app/(main)/places/page.tsx`

---

## Stop Conditions

Stop and request a planning revision if implementation requires architecture, API, data ownership, or security changes that were not approved.

## Documentation-Verified Follow-ups

- Remove the hard-coded MapVina token fallback and supply a domain/referer-restricted browser token through deployment configuration.
- Remove and rotate the inline ZioMap credential in `docker-compose.yml`; load it from the service `.env` or a deployment secret.
- Decide whether direct MapVina browser search/details remain an intentional resilience path or move behind `place-service`; update the security boundary accordingly.
- Add GeoJSON clustering before claiming clustered-marker support.
