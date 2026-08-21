# Place Search & MapVina Integration

- **Status**: DONE
- **Feature Name**: `places-maps-integration`
- **Affected Services**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`
- **Last Reviewed**: 2026-08-21

## Overview

TripSense provides deterministic place discovery for Da Nang with synchronized place cards and an interactive map. Public place requests flow through API Gateway to `place-service`. The service applies Redis cache-aside, MongoDB local search, and ZioMap provider fallback/enrichment.

MapVina GL is the browser map renderer. Its public, origin-restricted style token may be exposed to the browser, but place search, autocomplete, nearby lookup, and details never call a provider directly from the web client.

## Provider Matrix

| Concern | Provider / implementation |
| --- | --- |
| Basemap and map interaction | `mapvina-gl`; MapVina style when a public token is configured, CARTO/OSM fallback otherwise |
| Place search, autocomplete, details, enrichment | ZioMap through `place-service` |
| Public application API | API Gateway route `/api/places/**` |
| Persistence and cache | MongoDB and Redis owned exclusively by `place-service` |

## Documentation Index

- [Requirements](./requirements.md)
- [Architecture](./architecture.md)
- [API Specifications](./api.md)
- [Data Model & Persistence](./data-model.md)
- [Security & Trust Boundaries](./security.md)
- [Decisions & Tradeoffs](./decisions.md)
- [Implementation Plan](./implementation-plan.md)
- [Test Plan](./test-plan.md)
- [PR Review](./pr-review.md)

## Related

- [TripSense Architecture](../../architecture/tripsense-architecture.md)
- [Service Boundaries](../../architecture/service-boundaries.md)
- [Feature Index](../index.md)
