# Implementation Plan

STATUS: APPROVED

Implementation is approved for Milestone 0 only.

## Tasks

1. Milestone 0: Map / Place Provider POC
   - Build `/explore` in the Next.js web app.
   - Render a real VietMap map centered on Da Nang using `NEXT_PUBLIC_VIETMAP_TILE_KEY`.
   - Add responsive desktop split layout with place list left and map right.
   - Implement `GET /api/places/search` in `place-service` using backend-only `VIETMAP_SERVICE_KEY`.
   - Normalize VietMap provider responses before returning them.
   - Add API Gateway routing for provider POC endpoints.
   - Render returned places as markers and synchronized list cards.
   - Implement hover/click selection with one shared selected-place state.
   - Implement rich click popup with optional cached enrichment.
   - Implement `OpenTripMapPlaceEnrichmentProvider`, `WikimediaPlaceImageProvider`, and `PlaceImageResolver`.
   - Add provider timeouts, sanitized errors, and in-memory POC cache.
   - Verify at least 10 real Da Nang places and document coverage.
   - Stop after the POC.

2. Later Milestone 1: Database, Trip CRUD, Trip UI
   - Create or update `trip-service` as an approved Spring service module.
   - Add service-local PostgreSQL persistence and migrations for `trips`.
   - Add DTOs, validation, error handling, ownership checks, and tests.
   - Add `/api/trips/**` gateway routing.
   - Replace the starter web home/trip pages with TripSense trip list, empty/loading/error states, create/edit/delete, and trip detail navigation.
   - Verify lint, type checks, tests, service startup, gateway routing, and web startup.

3. Later Milestone 2: Itinerary CRUD
   - Implement itinerary ownership in either `itinerary-service` or the approved combined owner.
   - Add day/item persistence, APIs, validation, transactions, reorder, and move-between-days.
   - Build trip detail day tabs, item editor, notes, time editing, reorder controls, move controls, and persistence checks.
   - Verify the required pre-map demo flow end to end.

4. Later Milestone 3: Place Domain, VietMap Search, Place Detail, Add Place to Itinerary
   - Extend `place-service` with internal `Place`, provider references, normalized DTOs, and VietMap provider abstraction.
   - Verify current official VietMap API docs before coding provider calls.
   - Add debounced/cancellable frontend search and add-to-itinerary flows that call the real itinerary API.

5. Later Milestone 4: VietMap Interactive Map
   - Add VietMap GL JS rendering in the web app.
   - Implement list/map synchronization with one selected-place state.
   - Support desktop split layout and mobile list/map toggle.

6. Later Milestone 5: VietMap Routing
   - Add routing provider abstraction in `place-service`.
   - Add `/api/routes`, validation, normalized route results, polyline rendering, and cost controls.

7. Later Milestone 6: External Enrichment Hardening
   - Verify current official OpenTripMap and Wikimedia provider docs before expanding provider calls.
   - Add persisted provider references, cache refresh rules, richer attribution, mock provider mode, and graceful failure behavior.

8. Later Milestone 7: TripSense Ratings and Place Intelligence
   - Implement feedback and rating summaries in the approved owner.
   - Implement `PlaceIntelligence` in the approved owner or defer to `context-service`.

9. Later Milestone 8: Favorites, Collections, AI-ready Place Candidate API
   - Implement favorites and collections in the approved user-owned boundary.
   - Implement protected internal place candidate API returning structured facts only.

## Sequencing

Do not start Trip CRUD until Milestone 0 passes verification and receives follow-up approval.

## Files Likely Affected

- `apps/web/tripsense/`
- `services/api-gateway/`
- `services/place-service/`
- `services/trip-service/` if approved and created
- `services/itinerary-service/` if approved and created
- `services/review-service/` if approved and created
- `services/user-service/` if approved and created
- `pom.xml`
- `docs/adr/` if an ADR is approved

## Stop Conditions

Stop and request a planning revision if implementation requires architecture, API, data ownership, service boundary, provider, or security changes that were not approved.

Stop immediately if provider documentation contradicts the planned endpoint, authentication, or response mapping.

Stop before implementing AI recommendation, generated itinerary, LLM parsing, AI ranking, or weather-based AI decision behavior.
