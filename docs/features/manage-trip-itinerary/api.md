# API

## Endpoints

All endpoints are public only through API Gateway.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/trips` | Create an owned trip and generated itinerary days. |
| `GET` | `/api/trips?status=&from=&to=&page=&size=` | List owned trips. |
| `GET` | `/api/trips/{tripId}` | Get trip metadata. |
| `PATCH` | `/api/trips/{tripId}` | Update trip metadata. |
| `DELETE` | `/api/trips/{tripId}` | Archive trip by default. |
| `GET` | `/api/trips/{tripId}/itinerary` | Get itinerary days and items. |
| `GET` | `/api/trips/{tripId}/itinerary/days/{dayId}` | Get one itinerary day. |
| `POST` | `/api/trips/{tripId}/itinerary/days/{dayId}/items` | Add an itinerary item. |
| `PATCH` | `/api/trips/{tripId}/itinerary/items/{itemId}` | Update an itinerary item. |
| `DELETE` | `/api/trips/{tripId}/itinerary/items/{itemId}` | Remove or archive an itinerary item. |
| `PUT` | `/api/trips/{tripId}/itinerary/days/{dayId}/items/reorder` | Rewrite day item order. |

AI draft import is deferred to a later phase.

## Request DTOs

`CreateTripRequest`

```json
{
  "name": "Da Nang Summer Trip",
  "destinationName": "Da Nang",
  "destinationPlaceId": null,
  "startDate": "2026-08-20",
  "endDate": "2026-08-24",
  "travelerCount": 2,
  "budgetAmount": 5000000,
  "budgetCurrency": "VND",
  "notes": "Beach and food focus"
}
```

`UpdateTripRequest`

```json
{
  "name": "Da Nang Food Weekend",
  "destinationName": "Da Nang",
  "startDate": "2026-08-20",
  "endDate": "2026-08-23",
  "dateChangePolicy": "BLOCK_IF_ITEMS_OUTSIDE_RANGE",
  "travelerCount": 2,
  "budgetAmount": 4500000,
  "budgetCurrency": "VND",
  "notes": "Relaxed pacing"
}
```

`CreateItineraryItemRequest`

```json
{
  "placeId": null,
  "type": "TRANSFER",
  "title": "Airport pickup",
  "startTime": "08:30",
  "endTime": "09:15",
  "durationMinutes": 45,
  "notes": "Driver meets at arrivals"
}
```

`ReorderItemsRequest`

```json
{
  "orderedItemIds": ["item-1", "item-2", "item-3"],
  "version": 4
}
```

## Response DTOs

`TripResponse`

```json
{
  "id": "trip-123",
  "name": "Da Nang Summer Trip",
  "destinationName": "Da Nang",
  "destinationPlaceId": null,
  "startDate": "2026-08-20",
  "endDate": "2026-08-24",
  "status": "DRAFT",
  "displayStatus": "UPCOMING",
  "ownerId": "user-123",
  "travelerCount": 2,
  "budgetAmount": 5000000,
  "budgetCurrency": "VND",
  "notes": "Beach and food focus",
  "version": 1,
  "createdAt": "2026-08-19T10:00:00Z",
  "updatedAt": "2026-08-19T10:00:00Z"
}
```

`ItineraryResponse`

```json
{
  "tripId": "trip-123",
  "days": [
    {
      "id": "day-1",
      "date": "2026-08-20",
      "dayNumber": 1,
      "items": []
    }
  ]
}
```

## Validation

- All endpoints require authentication.
- `ownerId` is derived from authenticated claims and is ignored or rejected if supplied by the client.
- `startDate <= endDate`.
- Trip duration, traveler count, notes length, and item count must respect configured MVP limits.
- Updating dates with out-of-range existing items is rejected unless a later approved policy is added.
- `startTime < endTime` when both are supplied.
- Overlapping item times are allowed with warnings, not hard-blocked.
- Reorder payload must contain exactly the current item IDs for the requested owned day.
- Place-based items validate `placeId` through `place-service`; manual items require `title` and `type`.

## Error Cases

Use a consistent JSON error body:

```json
{
  "code": "TRIP_NOT_FOUND",
  "message": "Trip not found",
  "details": {}
}
```

Recommended codes: `UNAUTHENTICATED`, `TRIP_NOT_FOUND`, `ITINERARY_DAY_NOT_FOUND`, `ITINERARY_ITEM_NOT_FOUND`, `INVALID_TRIP_DATE_RANGE`, `DATE_CHANGE_BLOCKED`, `ITEM_OUTSIDE_TRIP_RANGE`, `INVALID_ITEM_TIME_RANGE`, `INVALID_REORDER_PAYLOAD`, `PLACE_NOT_FOUND`, `PLACE_SERVICE_UNAVAILABLE`, `CONFLICTING_UPDATE`, `VALIDATION_FAILED`.

For IDOR protection, requests for another user's trip/day/item should return `404` rather than reveal resource ownership.

## Backward Compatibility

There is no existing `/api/trips/**` backend route in the current API Gateway, so routing is additive. Existing mock-driven web trip screens can migrate incrementally to this API.

## Service Calls

- `trip-service` calls `place-service` only to validate present `placeId` values or capture display snapshots.
- `trip-service` does not call `ai-service` for normal CRUD.
- Direct database reads across service boundaries are prohibited.
