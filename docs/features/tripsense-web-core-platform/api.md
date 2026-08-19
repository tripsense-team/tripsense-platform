# API

## Endpoints

Milestone 0, Map / Place Provider POC:

| Method | Path | Owner |
| --- | --- | --- |
| `GET` | `/api/places/search?q={query}&lat={latitude}&lng={longitude}` | `place-service` |
| `GET` | `/api/places/{externalId}/enrichment` | `place-service` |
| `POST` | `/api/routes` | `place-service` |

Later approved milestones:

| Method | Path | Owner |
| --- | --- | --- |
| `POST` | `/api/trips` | `trip-service` |
| `GET` | `/api/trips` | `trip-service` |
| `GET` | `/api/trips/{tripId}` | `trip-service` |
| `PUT` | `/api/trips/{tripId}` | `trip-service` |
| `DELETE` | `/api/trips/{tripId}` | `trip-service` |
| `POST` | `/api/trips/{tripId}/days` | `itinerary-service` or approved combined owner |
| `GET` | `/api/trips/{tripId}/days` | `itinerary-service` or approved combined owner |
| `GET` | `/api/trips/{tripId}/days/{dayId}` | `itinerary-service` or approved combined owner |
| `PUT` | `/api/trips/{tripId}/days/{dayId}` | `itinerary-service` or approved combined owner |
| `DELETE` | `/api/trips/{tripId}/days/{dayId}` | `itinerary-service` or approved combined owner |
| `POST` | `/api/trips/{tripId}/days/{dayId}/items` | `itinerary-service` or approved combined owner |
| `GET` | `/api/trips/{tripId}/days/{dayId}/items` | `itinerary-service` or approved combined owner |
| `PUT` | `/api/trips/{tripId}/days/{dayId}/items/{itemId}` | `itinerary-service` or approved combined owner |
| `DELETE` | `/api/trips/{tripId}/days/{dayId}/items/{itemId}` | `itinerary-service` or approved combined owner |
| `PATCH` | `/api/trips/{tripId}/days/{dayId}/items/reorder` | `itinerary-service` or approved combined owner |
| `PATCH` | `/api/trips/{tripId}/items/{itemId}/move` | `itinerary-service` or approved combined owner |
| `GET` | `/api/places/search` | `place-service` |
| `GET` | `/api/places/{placeId}` | `place-service` |
| `POST` | `/api/places/{placeId}/feedback` | `review-service` |
| `PUT` | `/api/places/{placeId}/feedback` | `review-service` |
| `DELETE` | `/api/places/{placeId}/feedback` | `review-service` |
| `GET` | `/api/places/{placeId}/feedback` | `review-service` |
| `GET` | `/api/places/{placeId}/feedback-summary` | `review-service` |
| `POST` | `/api/favorites/{placeId}` | `user-service` |
| `DELETE` | `/api/favorites/{placeId}` | `user-service` |
| `GET` | `/api/favorites` | `user-service` |
| `POST` | `/api/internal/places/candidates` | internal backend contract |

## Request DTOs

Place search query fields:

- `q`: required string, minimum 2 characters.
- `lat`: optional latitude, defaults to Da Nang for POC.
- `lng`: optional longitude, defaults to Da Nang for POC.

Normalized POC place response fields:

- `id`: stable TripSense POC ID derived by the service, not a provider primary key.
- `externalId`: VietMap place reference.
- `name`, `address`, `category`.
- `latitude`, `longitude`.
- `enrichment`: optional cached OpenTripMap/Wikimedia data, omitted when unavailable.

Later Trip create/update fields:

- `name`: required string.
- `destination`: required string.
- `startDate`: required ISO date.
- `endDate`: required ISO date.
- `status`: optional enum for update, one of `DRAFT`, `PLANNED`, `ONGOING`, `COMPLETED`, `ARCHIVED`.

Itinerary item fields:

- `placeId`: nullable TripSense place ID.
- `title`: required string.
- `description`: nullable string.
- `startTime`, `endTime`: time values.
- `visitDurationMinutes`: positive integer.
- `sequence`: positive integer.
- `note`: nullable string.
- `status`: one of `PLANNED`, `COMPLETED`, `SKIPPED`, `CANCELLED`.

Provider and route DTOs must be based on current official VietMap, OpenTripMap, and Wikimedia documentation at implementation time.

## Response DTOs

Service responses must return DTOs rather than persistence entities. Error responses use:

```json
{
  "error": {
    "code": "TRIP_NOT_FOUND",
    "message": "Trip not found",
    "details": {},
    "requestId": "..."
  }
}
```

## Validation

- Validate IDs, dates, time ranges, coordinates, travel modes, enum values, sequence values, pagination, string length, and provider names.
- Validate `startDate <= endDate`.
- Validate itinerary days belong to the requested trip.
- Validate moved items and target days belong to the same authorized trip.
- Reject ambiguous or geographically unreasonable external place matches.

## Error Cases

- `400`: invalid request syntax or validation failure.
- `401`: unauthenticated.
- `403`: authenticated but not allowed to access the resource.
- `404`: missing or inaccessible resource.
- `409`: ordering/version conflict.
- `422`: ambiguous provider match or valid request that cannot be processed.
- `503`: provider unavailable, provider timeout, quota exceeded, or database unavailable.

## Backward Compatibility

No existing TripSense web API contracts are present. Gateway changes must preserve the existing `/api/places/**` route and add new routes only when their services exist.

## Service Calls

- Web UI or BFF calls API Gateway.
- API Gateway keeps `/api/places/**` routed to `place-service`.
- API Gateway routes `/api/routes` to `place-service` for the POC.
- API Gateway routes `/api/trips/**` to `trip-service` only in a later approved milestone.
- Provider calls are made only from `place-service`.
- Internal candidate APIs must be blocked from public clients until service-to-service authentication exists.
