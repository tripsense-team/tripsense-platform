# Architecture: Place Search & Map Application

## Ownership

- `place-service` owns place search orchestration, provider integration, normalization, ranking, persistence, and place cache keys.
- API Gateway is the only public backend entry point for `/api/places/**`.
- The Next.js application owns presentation and map interaction. It does not own provider data or call ZioMap/MapVina place APIs directly.
- MapVina GL renders the basemap. `NEXT_PUBLIC_MAPVINA_API_KEY` is only a restricted public style token; if absent, the map uses the configured CARTO/OSM fallback style.

## Backend Responsibilities

| Component | Responsibility |
| --- | --- |
| `PlaceController` | HTTP validation and response envelope only |
| `PlaceSearchService` / `PlaceSearchServiceImpl` | Search, autocomplete, nearby contract and implementation |
| `PlaceDetailsService` / `PlaceDetailsServiceImpl` | Detail contract, stored/provider retrieval, and refresh policy |
| `PlacePersistenceService` / `PlacePersistenceServiceImpl` | Persistence contract, provider upsert, merge, and entity/DTO mapping |
| `PlaceRankingService` / `PlaceRankingServiceImpl` | Deterministic ranking contract and implementation |
| `PlaceCacheService` / `PlaceCacheServiceImpl` | Cache contract and Redis-backed implementation |
| `PlaceProvider` | Search/autocomplete/detail provider abstraction |
| `PlaceEnrichmentProvider` | Optional enrichment abstraction |
| `ZioMapProvider` | ZioMap HTTP adapter and payload normalization |

Interfaces live in `service`; Spring implementations live in `service/impl`, matching the `user-service` convention. Controllers and collaborating services depend on interfaces. This split keeps HTTP, application orchestration, persistence mapping, cache, ranking, and external-provider concerns separate.

## Request Flow

```mermaid
sequenceDiagram
    actor User
    participant Web as Next.js + MapVina GL
    participant GW as API Gateway
    participant PS as Place Service
    participant Redis
    participant Mongo
    participant Zio as ZioMap API

    User->>Web: Search places
    Web->>GW: GET /api/places/search
    GW->>PS: Route request
    PS->>Redis: Read search cache
    alt Cache hit
        Redis-->>PS: Normalized places
    else Cache miss
        PS->>Mongo: Local text/geo search
        alt Local result is insufficient
            PS->>Zio: Provider search
            Zio-->>PS: Provider payload
            PS->>Mongo: Idempotent upsert
        end
        PS->>Redis: Cache normalized result
    end
    PS-->>GW-->>Web: Normalized response
    Web->>Web: Render cards and markers
```

If ZioMap fails, cached or local MongoDB results are returned when available. If no fallback exists, `PlaceProviderException` is translated to `503 Service Unavailable`; an outage is not disguised as an empty successful result.

## Communication and Boundaries

- Web -> Gateway -> Place Service: synchronous HTTP because search/details are needed immediately for the user flow.
- Place Service -> ZioMap: synchronous HTTP with configured connect/read timeout.
- No asynchronous event is required for phase 1.
- No cross-service database access, shared writable collection, or cross-service ORM relationship is introduced.
- Provider credentials remain backend-side; only the restricted basemap style token is browser-visible.

## Rejected Alternatives

1. Browser-direct place provider calls: bypass Gateway policies, persistence, caching, consistent errors, and provider isolation.
2. Concrete ZioMap dependencies in application services: makes substitution and testing harder; services use provider interfaces.
3. AI query rewriting/ranking in phase 1: deterministic rules remain explicit and testable.
