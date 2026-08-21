# Place Search & MapVina Integration

- **Status**: DONE
- **Feature Name**: `places-maps-integration`
- **Affected Services**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`

## Overview

A Mindtrip/TripSense-style place discovery application focused initially on Da Nang, Vietnam.
The feature enables natural-language place search around Da Nang, a local-first cache-aside backend (Redis -> MongoDB -> ZioMap Places API), and an interactive map rendered with the `mapvina-gl` SDK and MapVina styles. Place cards and map markers share selection state in both directions.

### Key Tenets
1. **Provider responsibilities**: MapVina GL renders the basemap, POIs, and markers. `place-service` uses ZioMap for persisted search/enrichment. The current web client also falls back directly to MapVina Cloud for search, autocomplete, and details when the backend does not return usable data.
2. **Local-First & Data Persistence**: Discovered places from ZioMap are idempotently persisted to MongoDB and cached in Redis. Redis is disposable; MongoDB is the durable source of truth.
3. **No AI in Phase 1**: Search uses provider APIs and deterministic local text/geo queries.
4. **Normalized core model**: Backend and frontend map provider payloads into the internal `Place` shape.

## Current Provider Matrix

| Concern | Current provider / implementation |
| --- | --- |
| Basemap and map interaction | MapVina GL (`mapvina-gl`) with a MapVina style URL |
| Backend place search and enrichment | ZioMap through `place-service` |
| Browser fallback search/autocomplete/details | MapVina Cloud API |
| Persistence and cache | MongoDB and Redis owned by `place-service` |

## Documentation Index

- [Requirements](./requirements.md)
- [Architecture](./architecture.md)
- [API Specifications](./api.md)
- [Data Model & Persistence](./data-model.md)
- [Security & Trust Boundaries](./security.md)
- [Decisions & Tradeoffs](./decisions.md)
- [Implementation Plan](./implementation-plan.md)
- [Test Plan](./test-plan.md)

## Related

- [TripSense Architecture](../../architecture/tripsense-architecture.md)
- [Service Boundaries](../../architecture/service-boundaries.md)
- [Feature Index](../index.md)
