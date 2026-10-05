# API

## P0 existing contracts and correction

The current API already supplies the picker:

```http
GET /api/trips?page=&size=
Authorization: Bearer ...
```

It returns `{ content, page, size, totalElements, totalPages }`, which matches the Web type. P0 first captures authenticated browser/Gateway/Trip evidence. It separates `tripListError` from `previewError`, adds retry and paged/search loading. No new picker endpoint is added unless evidence shows normal Trip-list fields are unsafe or insufficient.

Social maps downstream Trip status accurately: `401`, privacy-safe `404`, `409`, `422` and `503`; it must not convert a valid downstream client response into generic `TRIP_SERVICE_UNAVAILABLE`.

## Future additive contracts

```http
GET  /api/users/public-profiles/{userId}
POST /api/users/public-profiles:batch       # max 50 IDs
PUT  /api/social/follows/{targetUserId}     # idempotent
DELETE /api/social/follows/{targetUserId}   # idempotent
GET  /api/social/follows/{targetUserId}     # viewer state + bounded counts
GET  /api/social/creator-suggestions?limit=5&cursor=...
GET  /api/social/posts?scope=FOLLOWING&page=&size=
GET  /api/social/destinations/trending?window=TODAY&limit=5
GET  /api/context/weather?destinationRef=...
```

`PublicProfileResponse` is allowlisted: `userId`, `displayName`, `avatarUrl?`, and only a separately approved `bio?`. It never contains email, social URLs, location, cover URL, role, account state or contact data.

Weather response is bounded to: public destination label, condition, temperature/unit, provider, `observedAt`, `expiresAt`, and freshness state. It contains no coordinates or source-trip reference.

`GET /api/social/destinations/trending` is authenticated in V1 and permits only `window=TODAY`, `limit=1..20`. Its response has `businessDate`, `timeZone`, `generatedAt` and a bounded item list of `{ displayName, imageUrl?, destinationSlug? }`; it has no exact counts, contributor IDs, source-trip IDs, raw `placeId` or coordinates. It returns an empty successful list when no destination meets the cohort threshold. Its product label is “shared publicly today”, not “visited today”.

## Errors and compatibility

- P0: `401 UNAUTHENTICATED`, privacy-safe `404 TRIP_NOT_FOUND`, `409 PUBLICATION_PREVIEW_STALE`, `422 TRIP_NOT_PUBLISHABLE`, `503 TRIP_SERVICE_UNAVAILABLE`.
- Follow: `400` invalid/self UUID, `401`, privacy-safe `404`, `409` only if a non-idempotent race cannot be normalized, `429` throttled.
- Weather: `400` invalid destination, `401` if product requires sign-in, `429`, and successful bounded `UNAVAILABLE`/`STALE` response for provider outage.
- Creator suggestions and trending: `401` for absent/invalid authentication, `400` invalid cursor/limit/window and `429` when rate-limited. Follow target eligibility failures remain privacy-safe `404`.
- Existing private-profile and post APIs retain their response shapes.
