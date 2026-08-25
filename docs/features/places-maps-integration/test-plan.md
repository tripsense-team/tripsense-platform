# Test Plan and Verification: Place Search & Map Application

## Automated Coverage

### Backend

- Controller success, validation, and not-found behavior.
- Search cache hit, provider persistence, provider failure with local fallback, and provider failure without fallback.
- Detail cache/storage behavior, stale refresh through the enrichment abstraction, and provider failure with stored fallback.
- Gateway client-IP resolution ignores spoofed forwarded headers from untrusted peers and selects the nearest untrusted hop behind configured trusted proxies.
- Ranking behavior, provider blank-input behavior, existing service/mapper behavior, and Spring context.

### Frontend

- API search/autocomplete/details remain on relative `/api/places/**` routes.
- Structured backend errors retain status, code, and message.
- Provider-controlled popup strings render as text, not HTML.
- Unsafe website, social, and telephone URLs are rejected.

## Verification Commands

From `services/place-service` with Java 21:

```powershell
./mvnw test
```

From `apps/web/tripsense`:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

From `services/api-gateway` with Java 21:

```powershell
./mvnw test
```

## Manual Checks

1. Run Discovery, Gateway, Place Service, MongoDB, Redis, and web application.
2. Search and autocomplete while confirming browser requests target `/api/places/**` only.
3. Verify card-to-marker and marker-to-card selection.
4. Remove `NEXT_PUBLIC_MAPVINA_API_KEY` and confirm the fallback basemap renders.
5. Stop ZioMap: confirm local/cached results remain available and uncached misses return sanitized `503`.
6. Inspect place cards/details with missing ratings and hours; confirm no invented values appear.

## Remaining Test Depth

Gateway route integration and browser-level map interaction are recommended CI additions. They are not replaced by the current unit/component tests.
