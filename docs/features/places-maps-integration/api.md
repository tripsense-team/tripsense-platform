# API Specifications: Place Search & Map Application

All TripSense place endpoints are public read endpoints served under `/api/places` through API Gateway. The browser does not call ZioMap or MapVina place APIs directly.

## Endpoints

| Method | Path | Parameters | Success |
| --- | --- | --- | --- |
| GET | `/api/places/search` | `q` required; optional `lat`, `lng`, `radius`, `limit` | `200` place list |
| GET | `/api/places/autocomplete` | `q` required; optional `lat`, `lng`, `limit` | `200` suggestions |
| GET | `/api/places/{id}` | internal/provider ID; optional fallback `name`, `lat`, `lng` | `200` detail or `404` |
| GET | `/api/places/nearby` | `lat`, `lng` required; optional `radius`, `category`, `limit` | `200` place list |

The web client uses relative `/api/places/**` URLs. Next.js routes `/api/**` to the configured API Gateway; it has no place-service-specific rewrite.

## Provider Mapping

| TripSense operation | ZioMap adapter call |
| --- | --- |
| Search | `/api/place/text-search` |
| Autocomplete | `/api/place/autocomplete`, with text-search fallback in the adapter |
| Details | `/api/place/details` |
| Nearby fallback | text search constrained by location/radius |

Provider endpoints and credentials are implementation details and are never returned as browser contracts.

## Normalized Place

```json
{
  "id": "66c4a1b2e4b01234567890ab",
  "provider": "ziomap",
  "providerPlaceId": "zm_dn_01",
  "name": "Madame Lan Restaurant",
  "location": { "lat": 16.0678, "lng": 108.2208 },
  "address": "04 Bach Dang, Hai Chau, Da Nang",
  "categories": ["restaurant", "vietnamese"],
  "rating": 4.6,
  "userRatingCount": 1200,
  "photos": [],
  "openingHours": "06:30 - 21:30"
}
```

Optional provider values such as `rating`, `userRatingCount`, `businessStatus`, and `openingHours` remain absent when the provider does not supply them. The backend and frontend must not fabricate defaults.

## Validation

- `q`: non-blank, maximum 200 characters.
- `lat`: `[-90, 90]`; `lng`: `[-180, 180]`.
- `radius`: `100..50000` metres.
- `limit`: `1..50` (autocomplete may use a lower endpoint maximum).

## Errors

```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Place provider is temporarily unavailable"
  }
}
```

- `400`: validation failure.
- `404`: place not found.
- `503`: provider failed and neither cache nor local persisted data can satisfy the request.
- `500`: sanitized unexpected server error.
