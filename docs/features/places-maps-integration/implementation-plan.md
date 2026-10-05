# Implementation Record: Place Search & Map Application

The approved feature is implemented and the 2026-08-21 remediation review is complete.

## Backend

- `PlaceController` exposes search, autocomplete, details, and nearby read endpoints.
- Service contracts live under `service`; concrete Spring beans live under `service/impl` and use the `*ServiceImpl` naming convention shared with `user-service`.
- `PlaceSearchServiceImpl` coordinates cache/local/provider search behind `PlaceSearchService`.
- `PlaceDetailsServiceImpl` owns detail lookup and refresh behavior behind `PlaceDetailsService`.
- `PlacePersistenceServiceImpl` owns idempotent provider upsert and DTO/entity mapping behind `PlacePersistenceService`.
- `PlaceRankingServiceImpl` keeps deterministic ranking isolated behind `PlaceRankingService`.
- `PlaceCacheServiceImpl` isolates Redis behind `PlaceCacheService`.
- `PlaceProvider` and `PlaceEnrichmentProvider` decouple application services from `ZioMapProvider`.
- `ZioMapClientConfig` owns provider HTTP client construction and timeouts.
- `PlaceProviderException` maps unavailable provider flows to HTTP `503` when no local fallback exists.
- MongoDB and Redis remain exclusively owned by `place-service`.

## Gateway and Frontend

- API Gateway routes `/api/places/**` to `place-service`.
- Next.js uses only the generic `/api/**` Gateway rewrite.
- `places-api.ts` calls only relative TripSense endpoints and preserves structured API errors.
- `MapVinaContainer` renders the map and coordinates selection; popup construction is isolated in `mapvina-popup.ts`.
- Popup provider data uses `textContent`, validated URLs, and safe external-link attributes.
- Missing ratings/status/review counts are not invented.
- MapVina style token fallback is removed; CARTO/OSM style is used when the public style token is absent.

## Configuration

- `ZIOMAP_API_KEY`: backend deployment secret.
- `ZIOMAP_BASE_URL`, `ZIOMAP_TIMEOUT_MS`: provider configuration.
- `NEXT_PUBLIC_MAPVINA_API_KEY`: optional restricted public style token.
- `API_GATEWAY_URL`: server-side Next.js rewrite target.
- `TRUSTED_PROXY_CIDRS`: comma-separated CIDRs for the Next.js/reverse-proxy peers whose forwarded client chain Gateway may trust.

## Deferred, Not Claimed

- Native marker clustering.
- Authenticated place mutation/curation.
- Asynchronous background enrichment.
