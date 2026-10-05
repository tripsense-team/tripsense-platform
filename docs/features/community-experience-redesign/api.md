# API

## Feed and post contracts

Extend the existing feed without changing its default behavior:

```http
GET /api/social/posts?type=ALL|STANDARD|TRIP_SHARE&page=0&size=10
```

- Default `type=ALL` preserves existing clients.
- Filtering occurs before pagination and count.
- Stable order is `createdAt DESC, id DESC`.
- `SocialPostResponse.trip` is a bounded `PublicTripSummary`; it never contains `days` or `items`.
- Unknown type returns `400 INVALID_POST_TYPE`.

Generic `GET /api/social/posts/{postId}` returns standard detail or a typed post with summary only. For `TRIP_SHARE`, the web then calls the typed detail endpoint.

## Public DTOs

### `PublicTripSummary`

```text
name, destinationName, dateLabel?, coverImageUrl?
dayCount, itineraryItemCount
highlights[0..3]
publicationRevision, publishedAt, refreshedAt?
detailAvailability = PUBLIC_SNAPSHOT | SUMMARY_ONLY_REPUBLISH_REQUIRED
```

It never returns `sourceTripId`, canonical day/item IDs, Place IDs or detailed itinerary arrays.

### `PublicTripSnapshotV1`

```text
schemaVersion = 1
publicationRevision
publishedAt / refreshedAt?
datePrecision = DAY_NUMBER_ONLY | EXACT
timePrecision = NONE | EXACT
summary
days[]
  dayNumber
  date?                  // ended trips only
  items[]
    order
    title
    type
    startTime? / endTime? / durationMinutes?  // ended trips only
    placeName?
```

The forbidden field policy is defined in [Requirements](requirements.md).

## Preview and publication

The public workflow is Social-owned; Social delegates projection to Trip.

```http
POST /api/social/trip-shares/preview
Authorization: Bearer ...
Content-Type: application/json

{ "tripId": "..." }
```

Response:

```text
snapshot: PublicTripSnapshotV1
snapshotFingerprint: sha256 of canonical safe projection
consentVersion: "PUBLIC_TRIP_V1"
warnings[]
```

The internal Trip endpoint is owner-authorized and intended for the Social orchestration call:

```http
POST /api/trips/{tripId}/publication-snapshot
```

It deterministically rebuilds the projection and returns the same snapshot/fingerprint. The existing `/share-snapshot` is deprecated and made safe during transition.

Create remains the single typed publication endpoint:

```http
POST /api/social/trip-shares
Idempotency-Key: <uuid>

{
  "tripId": "...",
  "caption": "...",
  "visibility": "PUBLIC|UNLISTED|PRIVATE",
  "expectedSnapshotFingerprint": "...",
  "consentVersion": "PUBLIC_TRIP_V1"
}
```

The request never accepts titles, notes, dates, places, coordinates or snapshot JSON. Social calls Trip outside its database transaction; mismatched reconstruction returns `409 PUBLICATION_PREVIEW_STALE`.

## Typed detail and republish

```http
GET /api/social/trip-shares/{postId}
```

Returns:

```text
post: SocialPostResponse with summary
publication: PublicTripSnapshotV1?        // null for legacy summary-only
detailAvailability
canManagePublication
```

Owner republish/refresh preserves the post, reactions and comments:

```http
PUT /api/social/trip-shares/{postId}/publication

{
  "expectedSnapshotFingerprint": "...",
  "consentVersion": "PUBLIC_TRIP_V1"
}
```

The owner first obtains a preview for the source trip through an owner-only management path. The source trip ID is never included in a non-owner response. Caption/visibility update and post deletion retain their existing endpoints.

## Transaction flow

1. Validate input, authentication and idempotency syntax.
2. Call Trip and compare the rebuilt fingerprint outside any Social transaction.
3. Validate downstream DTO shape and size defensively.
4. Open a short local writer transaction.
5. Recheck idempotency/active-share uniqueness, insert or lock the publication, append the immutable snapshot, update feed summary/current pointer, and commit.

Refresh uses the same split; no HTTP call occurs while holding a database transaction or row lock.

## Visibility

- Anonymous mixed feed may retain compatible public `STANDARD` posts but excludes typed detailed shares.
- Signed-in `PUBLIC`: feed/detail eligible after Phase D.
- `UNLISTED`: excluded from feeds/search/counts; signed-in direct-link access.
- `PRIVATE`: owner only.
- Inaccessible/deleted resources return privacy-safe `404 POST_NOT_FOUND`.
- Comments, reactions, future saves and reports reuse the same post access decision.

## Errors

| Status | Code/use                                                                                     |
| ------ | -------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_FAILED`, `INVALID_VISIBILITY`, `INVALID_CONSENT_VERSION`, `INVALID_POST_TYPE`    |
| `401`  | Sign-in required; preserve draft                                                             |
| `403`  | Authenticated actor lacks a permitted mutation                                               |
| `404`  | Privacy-safe trip/post/item unavailable                                                      |
| `409`  | `DUPLICATE_ACTIVE_TRIP_SHARE`, `PUBLICATION_PREVIEW_STALE`, idempotency fingerprint conflict |
| `422`  | `TRIP_NOT_PUBLISHABLE`, `PUBLICATION_LIMIT_EXCEEDED`                                         |
| `429`  | Rate limited; do not auto-retry writes                                                       |
| `503`  | `TRIP_SERVICE_UNAVAILABLE`; preserve draft                                                   |

## Compatibility

1. Deploy web readers that tolerate `SUMMARY_ONLY_REPUBLISH_REQUIRED` and stop using legacy `itineraryDays`/source IDs.
2. Deploy safe Trip producer and Social compatibility readers/writers.
3. Expand Social schema and enable V1 publication behind a feature flag.
4. Scrub unsafe old JSON after old writers are drained.
5. Remove old DTO mappings and drop the legacy column after the rollback window.

Legacy client-authored `TRIP_METADATA` remains sanitized, read-only display fallback and is never promoted to a verified publication.
