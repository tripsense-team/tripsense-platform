# API Specifications: Place Search & Map Application

TripSense backend endpoints are served under `/api/places` through API Gateway. The current browser client also has direct MapVina Cloud calls; those are provider APIs, not TripSense-owned contracts.

### Backend vs ZioMap Provider Mapping

| TripSense Internal Endpoint | ZioMap External Endpoint | Parameters Mapping |
| --- | --- | --- |
| `GET /api/places/search?q={query}` | `GET /api/place/text-search` | `query={q}`, `languageCode=vi`, `regionCode=vn`, `location={lat},{lng}`, `maxResultCount={limit}` |
| `GET /api/places/autocomplete?q={query}` | `GET /api/place/autocomplete` | `input={q}`, `language=vi`, `region=vn`, `location={lat},{lng}` |
| `GET /api/places/{id}` | `GET /api/place/details` | `placeId={providerPlaceId}`, `language=vi` |
| `GET /api/places/nearby?lat={lat}&lng={lng}` | `GET /api/place/text-search` | `query=*`, `location={lat},{lng}`, `rankPreference=DISTANCE` |

### Current Browser-to-MapVina Calls

| Web operation | MapVina endpoint | Notes |
| --- | --- | --- |
| Search fallback | `GET https://maps.mapvina.com/api/v1/search` | Uses `text`, focus point, `size`, and public `key` parameters after an empty/failed backend search. |
| Autocomplete | `GET https://maps.mapvina.com/api/v2/place/autocomplete/json` | Called directly by the browser with `input`, `location`, `size`, and public `key`. |
| Details fallback | `GET https://maps.mapvina.com/api/v2/place/details/json` | Called after backend details fail; `/api/v1/search` is the final fallback. |

MapVina fallback results are normalized in the web client and are not persisted to MongoDB. Backend ZioMap results use the cache/persistence flow below.

---

## TripSense Internal Endpoints

### 1. Place Search
- **Method**: `GET`
- **Path**: `/api/places/search`
- **Query Parameters**:
  - `q` (string, required): Search query (e.g., `"top quán ăn ngon ở Đà Nẵng"`).
  - `lat` (double, optional): Reference latitude (default Da Nang: `16.0544`).
  - `lng` (double, optional): Reference longitude (default Da Nang: `108.2022`).
  - `radius` (integer, optional): Search radius in meters (default: `15000`).
  - `limit` (integer, optional, default: `20`, max: `50`).
- **Response**: `200 OK`

### 2. Autocomplete Suggestions
- **Method**: `GET`
- **Path**: `/api/places/autocomplete`
- **Query Parameters**:
  - `q` (string, required): Partial query text.
  - `lat` (double, optional): Reference latitude.
  - `lng` (double, optional): Reference longitude.
  - `limit` (integer, optional, default: `5`, max: `10`).
- **Response**: `200 OK`

### 3. Place Details
- **Method**: `GET`
- **Path**: `/api/places/{id}`
- **Path Parameters**:
  - `id` (string, required): Internal place ID or provider lookup ID.
- **Optional Query Parameters**: `name`, `lat`, and `lng` provide fallback context for backend enrichment.
- **Response**: `200 OK` (or `404 Not Found`)

### 4. Nearby Places
- **Method**: `GET`
- **Path**: `/api/places/nearby`
- **Query Parameters**:
  - `lat` (double, required): Latitude.
  - `lng` (double, required): Longitude.
  - `radius` (integer, optional, default: `5000` meters).
  - `category` (string, optional): Filter by category.
  - `limit` (integer, optional, default: `20`).
- **Response**: `200 OK`

---

## Request & Response DTOs

### Normalized Place DTO (Search Response Item)

```json
{
  "id": "66c4a1b2e4b01234567890ab",
  "provider": "ziomap",
  "providerPlaceId": "zm_dn_madame_lan_01",
  "name": "Madame Lan Restaurant",
  "location": {
    "lat": 16.0678,
    "lng": 108.2208
  },
  "address": "04 Bạch Đằng, Thạch Thang, Hải Châu, Đà Nẵng, Vietnam",
  "categories": [
    "restaurant",
    "vietnamese"
  ],
  "rating": 4.6,
  "userRatingCount": 1200,
  "photos": [
    "https://images.ziomap.com/photos/zm_dn_madame_lan_01_main.jpg"
  ],
  "phone": "+84 905 697 555",
  "website": "https://madamelan.vn",
  "openingHours": "06:30 - 21:30"
}
```

### Search Response Wrapper

```json
{
  "success": true,
  "data": [
    {
      "id": "66c4a1b2e4b01234567890ab",
      "name": "Madame Lan Restaurant",
      "location": { "lat": 16.0678, "lng": 108.2208 },
      "address": "04 Bạch Đằng, Hải Châu, Đà Nẵng",
      "categories": ["restaurant", "vietnamese"],
      "rating": 4.6,
      "userRatingCount": 1200,
      "photos": ["https://images.ziomap.com/..."],
      "openingHours": "06:30 - 21:30"
    }
  ],
  "meta": {
    "query": "top quán ăn ngon ở Đà Nẵng",
    "total": 1,
    "source": "cache|local|external",
    "city": "Da Nang"
  }
}
```

### Autocomplete Response DTO

```json
{
  "success": true,
  "data": [
    {
      "id": "zm_dn_madame_lan_01",
      "title": "Madame Lan Restaurant",
      "subtitle": "04 Bạch Đằng, Thạch Thang, Hải Châu, Đà Nẵng",
      "category": "restaurant"
    }
  ]
}
```

---

## Validation Rules

- `q` parameter must not be empty or exceed 200 characters.
- `lat` must be within `[-90, 90]`; `lng` must be within `[-180, 180]`.
- `radius` must be between `100` and `50000` meters.
- `limit` must be between `1` and `50`.

## Error Responses

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "Query parameter 'q' must not be blank"
  }
}
```

HTTP Status Codes:
- `200 OK`: Successful response.
- `400 Bad Request`: Invalid parameters / coordinates out of range.
- `404 Not Found`: Place ID not found.
- `503 Service Unavailable`: External provider unavailable and no cached fallback exists.
