# Architecture: Place Search & Map Application

## Affected Services

1. **`services/place-service`**:
   - Primary domain owner for place entities, search coordination, caching, and provider integration.
   - Built on Spring Boot 3.x with Spring Data MongoDB and Spring Data Redis.
   - Contains `PlaceController`, `PlaceSearchService`, `PlaceRankingService`, `PlaceRepository`, `PlaceCacheService`, and `ZioMapProvider`.
2. **`services/api-gateway`**:
   - Routes public endpoint `/api/places/**` to `place-service`.
   - Handles global CORS and rate limiting filters.
3. **`apps/web/tripsense`**:
   - Next.js 16 (App Router) frontend.
   - Features `src/features/places` and `src/features/map/components/mapvina-container.tsx`, backed by the `mapvina-gl` package.

## Service Ownership & Boundaries

- `place-service` strictly owns the `places` collection in MongoDB and `place:*` cache keys in Redis.
- No other service accesses `place-service`'s MongoDB database directly.
- The frontend tries API Gateway -> `place-service` first for search and details.
- The current frontend then calls MapVina Cloud directly as a fallback; autocomplete currently calls MapVina directly.
- MapVina GL renders the map and exposes base-map POIs. ZioMap remains the backend enrichment provider.

## Component Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Web as Web Frontend (MapVina GL + React)
    participant GW as API Gateway
    participant PS as Place Service
    participant Redis as Redis Cache
    participant Mongo as MongoDB (places)
    participant Zio as ZioMap API
    participant MV as MapVina Cloud

    User->>Web: Type search query ("quán cafe chill gần biển")
    Web->>GW: GET /api/places/search?q=quán cafe chill gần biển
    GW->>PS: Proxy request
    PS->>PS: Normalize query (hash key)
    PS->>Redis: GET place:search:{hash}
    alt Cache Hit
        Redis-->>PS: Return cached NormalizedPlace[]
        PS-->>GW-->>Web: Return 200 OK (PlaceList)
    else Cache Miss
        PS->>Mongo: Local text & geo search query
        alt Sufficient Local Results (>= minThreshold)
            Mongo-->>PS: Return local Place documents
            PS->>Redis: SETEX place:search:{hash} 1800s
            PS-->>GW-->>Web: Return 200 OK (PlaceList)
        else Insufficient Local Results (< minThreshold)
            PS->>Zio: GET /api/place/text-search?query=...
            Zio-->>PS: Raw ZioMap response
            PS->>PS: Normalize to Internal Place Model
            PS->>Mongo: Bulk Idempotent Upsert (provider + providerPlaceId)
            PS->>Redis: SETEX place:search:{hash} 1800s
            PS-->>GW-->>Web: Return 200 OK (PlaceList)
        end
    end
    Web->>Web: Render PlaceCards and MapVina markers
    opt Backend unavailable or returns no usable search result
        Web->>MV: GET /api/v1/search?text=...&key=publicToken
        MV-->>Web: GeoJSON features
    end
```

## Synchronous Communication

- `apps/web/tripsense` -> `api-gateway` -> `place-service`: Synchronous HTTP REST for search, autocomplete, and place details.
- `place-service` -> `ZioMap API`: Synchronous HTTP via Spring `RestClient`; the current `ZIOMAP_TIMEOUT_MS` value (default 8000ms) is applied to both connect and read timeouts.
- `apps/web/tripsense` -> `MapVina Cloud`: Synchronous browser HTTP for the implemented fallback and autocomplete paths.

## Asynchronous Events

- Not required for Phase 1 search flow. Background place enrichment or data refreshing can be queued asynchronously in later phases if required.

## Rejected Alternatives

1. **Calling ZioMap directly from Frontend**:
   - *Rejected*: ZioMap remains backend-only so its credential and enrichment flow stay behind `place-service`.
2. **Using Google Maps JS SDK / Places API**:
   - *Rejected*: The implemented map renderer and browser place fallback use MapVina.
3. **AI / LLM-based query rewriting in Phase 1**:
   - *Rejected*: Adds latency, cost, and non-determinism. Deterministic ZioMap + MongoDB text scoring is simpler, faster (<300ms), and meets all current product goals.

## Related

- [TripSense Architecture](../../architecture/tripsense-architecture.md)
- [Service Boundaries](../../architecture/service-boundaries.md)
