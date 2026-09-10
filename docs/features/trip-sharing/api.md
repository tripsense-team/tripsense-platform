# API

## Endpoints

All endpoints are public only through API Gateway.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/social/trip-shares` | Create a `TRIP_SHARE` social post for an owned trip. |
| `GET` | `/api/social/trip-shares/{postId}` | Get shared trip post detail and access state. |
| `PATCH` | `/api/social/posts/{postId}/visibility` | Update visibility for a trip-share post. |
| `DELETE` | `/api/social/posts/{postId}` | Remove the shared post using existing delete behavior. |
| `GET` | `/api/social/posts` | Feed includes only active `PUBLIC` trip-share posts. |
| `GET` | `/api/social/posts/{postId}` | Existing post detail returns trip-share fields when applicable. |
| `GET` | `/api/trips/{tripId}/share-snapshot` | Permission-checked source trip snapshot for share creation. |

## Request DTOs

`CreateTripShareRequest`

```json
{
  "tripId": "3f977979-9730-4b15-a09b-c623889bb9a4",
  "caption": "Four days in Da Nang with beaches, bridges, and food stops.",
  "visibility": "PUBLIC"
}
```

`UpdatePostVisibilityRequest`

```json
{
  "visibility": "UNLISTED"
}
```

`Idempotency-Key` is required for `POST /api/social/trip-shares`.

## Response DTOs

`SocialPostResponse` remains backward compatible and gains nullable fields:

```json
{
  "id": "post-uuid",
  "type": "TRIP_SHARE",
  "author": {
    "id": "user-uuid",
    "name": "Phat Nguyen"
  },
  "content": "Four days in Da Nang with beaches, bridges, and food stops.",
  "mediaUrls": [],
  "visibility": "PUBLIC",
  "trip": {
    "tripId": "trip-uuid",
    "name": "Da Nang Summer Trip",
    "destinationName": "Da Nang",
    "startDate": "2026-09-07",
    "endDate": "2026-09-10",
    "coverImageUrl": "https://example.com/cover.jpg",
    "travelerCount": 2,
    "dayCount": 4,
    "itineraryItemCount": 12,
    "highlights": [
      {
        "title": "Dragon Bridge",
        "placeName": "Dragon Bridge",
        "dayNumber": 1
      }
    ]
  },
  "createdAt": "2026-09-05T10:00:00Z",
  "updatedAt": "2026-09-05T10:00:00Z",
  "likeCount": 0,
  "commentCount": 0,
  "isLiked": false
}
```

For standard posts, `type` is `STANDARD`, `visibility` may be omitted or `PUBLIC`, and `trip` is `null`.

`TripShareDetailResponse`

```json
{
  "post": {},
  "canOpenTrip": false,
  "tripUnavailableReason": "SNAPSHOT_ONLY"
}
```

`tripUnavailableReason` values: `SNAPSHOT_ONLY`, `SOURCE_TRIP_ARCHIVED`, `SOURCE_TRIP_DELETED`, `SOURCE_TRIP_UNAVAILABLE`, `VISIBILITY_REVOKED`, `TRIP_SERVICE_UNAVAILABLE`.

`TripShareSnapshotResponse`

```json
{
  "tripId": "trip-uuid",
  "name": "Da Nang Summer Trip",
  "destinationName": "Da Nang",
  "startDate": "2026-09-07",
  "endDate": "2026-09-10",
  "coverImageUrl": "https://example.com/cover.jpg",
  "travelerCount": 2,
  "dayCount": 4,
  "itineraryItemCount": 12,
  "highlights": [],
  "status": "DRAFT",
  "updatedAt": "2026-09-05T10:00:00Z"
}
```

## Validation

- `tripId` must be a UUID.
- `caption` is trimmed, can be blank, and must be at most 5,000 characters.
- `visibility` must be `PUBLIC`, `UNLISTED`, or `PRIVATE`; default is `PUBLIC`.
- User identity comes from JWT only.
- Client-submitted trip snapshot fields are rejected or ignored.
- Share creation requires an `Idempotency-Key` UUID.
- One owner may have only one active shared post per source trip.
- `share-snapshot` returns only safe fields and excludes notes, budget, lodging, participant data, private comments, and full itinerary details.
- `UNLISTED` means hidden from feed/search/count discovery, but visible by direct `postId` link to authenticated users.
- `PRIVATE` means owner-only and returns `404` to non-owners.

## Error Cases

Recommended codes:

- `400 VALIDATION_FAILED`
- `400 INVALID_VISIBILITY`
- `400 INVALID_IDEMPOTENCY_KEY`
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 POST_NOT_FOUND`
- `404 TRIP_NOT_FOUND`
- `409 DUPLICATE_ACTIVE_TRIP_SHARE`
- `409 IDEMPOTENCY_KEY_CONFLICT`
- `409 TRIP_NOT_SHAREABLE`
- `422 TRIP_SNAPSHOT_UNAVAILABLE`
- `503 TRIP_SERVICE_UNAVAILABLE`

Private, removed, deleted, or inaccessible posts should return `404` for non-owners when revealing existence would leak data.

## Backward Compatibility

- Existing `POST /api/social/posts` standard post behavior remains unchanged.
- Existing feed, detail, likes, comments, and delete APIs continue to work.
- Existing web clients can ignore unknown `type`, `visibility`, and `trip` fields.
- Gateway routes remain additive.
- Future anonymous/public links should use an opaque `shareSlug` or `publicShareToken`, not raw `postId`.

## Service Calls

`social-service` calls `trip-service` only on create and future explicit refresh:

```text
GET /api/trips/{tripId}/share-snapshot
Authorization: Bearer <user access token>
```

`social-service` defines local client DTOs and must not import `trip-service` entity classes.
