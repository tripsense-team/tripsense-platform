# Test Plan

Define the tests required before the feature is PR-ready.

## Unit Tests

- VietMap provider DTO mapping with fixtures.
- OpenTripMap disabled behavior when `OPENTRIPMAP_API_KEY` is missing.
- OpenTripMap/Wikimedia matching confidence calculation with name, distance, category, and locality evidence.
- Sanitized provider error mapping.
- Trip validation, including required fields and `startDate <= endDate`.
- Trip status transitions and delete/archive behavior once decided.
- Itinerary day validation and duplicate day/day-number checks.
- Itinerary item validation, time ranges, sequence values, nullable `placeId`, and status transitions.
- Reorder and move-between-days algorithms, including duplicate/missing IDs and resequencing.
- Place normalization and geographic distance calculations.
- Feedback aggregation and separation from external ratings.

## Integration Tests

- `/api/places/search` through API Gateway to `place-service`.
- `/api/routes` through API Gateway to `place-service`.
- Real VietMap smoke test from `place-service` when credentials are configured.
- Trip CRUD through `trip-service`.
- Gateway route for `/api/trips/**`.
- Itinerary day/item CRUD, reorder, and move transactions through the owning service.
- Place search/detail with mocked providers.
- Add place to itinerary through real service APIs.
- Provider timeout/quota/unavailable behavior.

## Contract Tests

- Gateway-to-service routes for trips, places, routes, reviews, favorites, and internal APIs as each milestone is approved.
- DTO compatibility for web UI clients.
- Error response shape across services.
- Provider normalization fixtures pinned to verified provider DTOs.

## Security Tests

- Missing and invalid authentication.
- Cross-user access attempts for trips, days, items, feedback, favorites, and collections.
- Reorder/move requests targeting another user's trip or another trip's day.
- Provider secret non-exposure in client bundles, logs, and API responses.
- Public denial of internal candidate APIs.
- Rate limiting and abuse behavior for provider-backed endpoints.

## Manual Verification

- Milestone 0: open `/explore`, render VietMap, search `coffee`, show real Da Nang places, render markers, click marker/card, show rich popup, verify hover has no provider fetch, verify card/marker synchronization, and test at least 20 places.
- Later Milestone 1: create, list, edit, delete/open a trip, reload, and verify persisted state.
- Milestone 2: create Day 1, add Activity A and B, edit one, reorder, move one to Day 2, reload, and verify persisted state.
- Milestone 3: search for a place, open detail, add it to an itinerary through the real itinerary API.
- Milestone 4: select a place card and marker and verify synchronized selection/scroll/fly-to behavior.
- Milestone 5: request a route and verify distance, duration, and polyline rendering.
- Milestone 6: verify external enrichment hardening and graceful omission when OpenTripMap/Wikimedia are unavailable.
- Milestone 7: rate a place and verify TripSense feedback summary persists separately from external ratings.
- Milestone 8: save places to favorites/collections and verify internal candidate API returns facts only.

## Regression Risks

- Web app bypasses API Gateway or backend service ownership.
- Provider secrets leak into client code.
- Itinerary sequence corruption after reorder or move.
- Cross-user IDOR in nested route handlers.
- OpenTripMap/Wikimedia failures break place or map flows.
- External ratings are displayed as fabricated TripSense ratings.
- Internal candidate APIs become publicly callable.
