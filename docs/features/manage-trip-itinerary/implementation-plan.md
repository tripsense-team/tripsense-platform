# Implementation Plan

Implementation may start only when the feature status is `APPROVED`.

## Tasks

1. Scaffold `services/trip-service` using the current Spring service patterns.
2. Add trip-service database configuration and Flyway migration for trip and itinerary tables.
3. Implement trip domain entities, repositories, services, validators, and error handling.
4. Implement authenticated trip CRUD APIs.
5. Implement generated itinerary day reads.
6. Implement itinerary item create, update, remove, and reorder APIs.
7. Add API Gateway route for `/api/trips/**`.
8. Add Docker, compose, and CI/CD wiring for `trip-service`.
9. Integrate `apps/web/tripsense` trip list and trip detail screens with the new APIs.
10. Replace mock trip data with API-backed loading, empty, error, and mutation states.
11. Add unit, integration, contract, and security tests.

## Sequencing

Phase 1: Trip-service foundation

- Create service skeleton and platform wiring.
- Add database migrations.
- Implement authenticated trip CRUD and itinerary day generation.

Phase 2: Itinerary management

- Add item CRUD, manual items, place-based items, reorder, optimistic locking, and validation warnings.
- Add gateway tests and backend integration tests.

Phase 3: Web integration

- Connect `/trips`, trip creation, and trip detail itinerary screens.
- Handle loading, empty, error, retry, and conflict states.

AI draft adoption is intentionally not part of TF-47 MVP implementation.

## Files Likely Affected

- `services/trip-service/**`
- `services/api-gateway/src/main/java/fu/tripsense/apigateway/GatewayRoutesConfig.java`
- `services/api-gateway/src/test/**`
- `docker-compose.yml`
- `.github/workflows/cd.yml`
- Root `pom.xml`
- `apps/web/tripsense/src/app/(main)/trips/**`
- `apps/web/tripsense/src/features/trip-planner/**`

## Stop Conditions

Stop and request a planning revision if implementation requires:

- Extracting a separate `itinerary-service`.
- Persisting canonical itinerary data in `ai-service`.
- Adding collaboration/member editing.
- Changing auth trust boundaries or JWT claim contracts beyond the approved model.
- Adding AI draft import to the MVP.
