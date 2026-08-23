# Security

## Authentication

All `/api/trips/**` endpoints require authenticated JWT access through API Gateway. `trip-service` must validate or receive trusted JWT claims consistently; implementation must define exact claim names for user ID and roles before coding begins.

## Authorization

MVP authorization is owner-only. A user can create, read, update, archive, and manage itinerary items only for trips whose `owner_user_id` matches the authenticated user ID.

Future collaboration roles are out of scope and must not be inferred from participant text, shared links, or client-provided fields.

## Ownership Validation

- Validate ownership on every trip read and write.
- Validate itinerary day and item ownership through their parent trip.
- Reorder requests must prove every submitted item belongs to the same owned day.
- Client-provided `ownerId`, `createdBy`, or cross-user filters are ignored or rejected.

## Input Validation

- Enforce date, time, traveler count, budget, note length, title length, and item count limits.
- Sanitize user-entered notes and titles for stored XSS before rendering.
- Validate `placeId` through `place-service` when present.
- Run the same validation for later AI-generated draft imports as for manual edits.

## Secret Handling

- No JWT secrets, DB credentials, external API keys, AI provider keys, or service credentials in frontend code or logs.
- Service-to-service credentials must come from environment or secret management.
- Do not store user tokens in trip records, itinerary notes, or AI prompt history.

## Abuse Cases

- Rate-limit trip creation, item creation, reorder operations, and place validation fan-out.
- Reject oversized payloads and very long trips that exceed configured MVP limits.
- Use optimistic locking or idempotency for retry-prone mutations.
- Avoid logging full free-text notes or sensitive travel details.

## IDOR Review

Treat `tripId`, `dayId`, `itemId`, and `placeId` as untrusted opaque references. Requests for another user's resource should return `404` rather than reveal that the resource exists.

Nested IDOR is a required test category: an attacker may combine their own trip ID with another user's day or item ID.

## Trust Boundaries

- Browser and mobile clients are untrusted.
- API Gateway is the only public ingress.
- `trip-service` owns canonical trip and itinerary state.
- `place-service` owns place facts.
- `ai-service` can propose content only; it cannot bypass validation or ownership checks.
