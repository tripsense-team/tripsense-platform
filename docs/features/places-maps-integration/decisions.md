# Decisions & Tradeoffs: Place Search & Map Application

## Current Decisions

| Decision | Rationale |
| --- | --- |
| MapVina GL is the map renderer, not a browser place-data fallback | Keeps map capability while preserving Gateway policy, normalization, cache, and provider isolation. |
| All browser place requests use relative `/api/places/**` URLs | Next.js forwards generic `/api/**` traffic to API Gateway; no service-specific bypass exists. |
| ZioMap is behind `PlaceProvider` and `PlaceEnrichmentProvider` | Application services follow Dependency Inversion and can be tested/substituted without concrete adapter coupling. |
| Search, details, and persistence use separate services | Keeps orchestration, refresh, and mapping/upsert responsibilities cohesive (SRP). |
| Provider outages use local fallback or explicit `503` | Empty `200` responses must not hide an infrastructure failure. |
| Optional provider facts remain optional | Fabricated ratings, counts, and open status mislead users and corrupt ranking. |
| Popup content uses DOM construction and URL allowlists | Provider payloads are untrusted and must not become executable markup. |
| Current markers use `mapvinagl.Marker` instances | Native clustering is not claimed until implemented. |

## Tradeoffs

- A browser-visible MapVina style token cannot be secret. Deployment must restrict it; the fallback basemap allows the application to render without one.
- Synchronous ZioMap calls add latency but are required for immediate results. Cache/local lookup and configured timeouts bound the impact.
- Provider abstractions add small interface/configuration overhead but remove application coupling and improve focused tests.
- `MapVinaContainer` remains the map orchestration boundary and is still relatively large; popup DOM construction has been extracted. Further extraction should be driven by new behavior, not arbitrary file-size splitting.

## Rejected Alternatives

- Direct browser calls to MapVina/ZioMap place endpoints.
- Hard-coded provider credentials or tokens.
- Returning invented UI-friendly provider values.
- A single service responsible for search, detail refresh, persistence mapping, ranking, cache, and provider transport.
