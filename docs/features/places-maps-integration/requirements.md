# Requirements: Place Search & Map Application

## User Goal

Travelers can search for places around Da Nang, view normalized results in cards and on a MapVina GL map, and keep card/marker selection synchronized.

## Functional Requirements

1. Search, autocomplete, nearby, and detail requests use the TripSense `/api/places/**` contract through API Gateway.
2. `place-service` checks Redis, searches its MongoDB collection, and calls ZioMap only when provider data is required.
3. ZioMap results are normalized and idempotently upserted by `(provider, providerPlaceId)`.
4. Cards and markers share selection state; result changes fit the map bounds and explicit selection focuses one place.
5. Missing optional data is omitted or rendered with an honest empty state. Ratings, review counts, and business status are never fabricated.
6. Autocomplete is debounced by 300 ms and cancels stale requests.
7. MapVina GL renders the map. A restricted public MapVina style token is optional; a token-free fallback basemap remains available.

## Business Rules

- Ranking is deterministic: text relevance, proximity, rating, review count, and freshness are explicit/testable inputs.
- Redis is disposable; failure falls through to MongoDB/provider.
- Provider outage returns cached/local data when available, otherwise a structured `503`.
- Search returns lightweight summaries; full detail/enrichment is requested on demand.
- Default city/country and cache/provider timeouts are configuration, not hard-coded deployment decisions.

## Acceptance Criteria

- Public application traffic does not directly address `place-service` or provider place APIs.
- ZioMap credentials are backend-only and absent from versioned Compose values.
- Provider-controlled popup content cannot create executable HTML or unsafe links.
- Invalid query, coordinates, radius, and limit return `400`.
- Missing place returns `404`; provider outage without fallback returns `503`.
- Redis/Mongo/provider search behavior and detail refresh are covered by backend tests.
- Browser API routing, structured errors, and popup sanitization are covered by frontend tests.
- Frontend lint, TypeScript, tests, and production build pass; backend Maven tests pass on Java 21.

## Out of Scope

- AI/LLM query rewriting or ranking.
- Route navigation, booking, user-created reviews, and account-synchronized favorites.
- Browser-direct MapVina/ZioMap place search.
- Native GeoJSON marker clustering.
