# Test Plan

Define the tests required before the feature is PR-ready.

## Unit Tests

- Trip date range validation.
- Itinerary day generation from date range.
- Date shrink blocking when out-of-range items exist.
- Lifecycle status transition validation.
- Display status derivation from dates.
- Manual item validation with `placeId = null`.
- Place-based item validation with `placeId`.
- Time range validation and overlap warning generation.
- Reorder payload validation.
- Sort order rewrite with version conflict handling.

## Integration Tests

- Create trip persists trip and generated itinerary days in one transaction.
- List trips filters by owner, status, date range, archived state, and pagination.
- Trip update preserves valid days and blocks unsafe date shrink.
- Item create/update/delete/reorder works only inside the owned trip/day.
- Reorder under conflicting version returns `CONFLICTING_UPDATE`.
- Place Service unavailable blocks new place-based item creation but does not block reading existing saved itinerary.
- Archive trip excludes it from default trip list queries.

## Contract Tests

- API Gateway routes `/api/trips/**` to `lb://trip-service`.
- Trip DTOs match web client expectations for list and detail views.
- Error response shape and codes match `api.md`.
- Place validation request/response contract uses IDs and DTOs only.

## Security Tests

- Unauthenticated requests are rejected.
- User A cannot read, update, archive, or reorder User B's trips/items.
- Nested IDOR attempts using mixed trip/day/item IDs are rejected with `404`.
- Client-supplied `ownerId` is ignored or rejected.
- Oversized notes/titles and malicious HTML are rejected or sanitized.
- Invalid dates, invalid times, invalid status transitions, and oversized reorder payloads are rejected.
- Direct service access without valid service-side authentication is rejected where the test environment supports it.

## Manual Verification

- Create a trip from the web UI and confirm generated days.
- Add manual and place-based items.
- Edit item title, time, duration, notes, and status.
- Reorder items and refresh to confirm order persists.
- Attempt to shorten a trip with items outside the new range and confirm the UI blocks with a clear error.
- Archive a trip and confirm it disappears from the default list.
- Test empty, loading, error, and retry states.

## Regression Risks

- Existing authentication and logout flows must remain unaffected.
- Existing Place Service routes must remain unaffected by gateway route changes.
- Mock-driven web pages must not regress navigation while API integration is incomplete.
- Docker and CI changes for new service must not break existing service builds.
