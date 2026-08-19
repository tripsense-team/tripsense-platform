# Security

## Authentication

Persisted user-owned operations require an authenticated principal. Until `identity-service` exists, implementation must define an explicit temporary principal propagation contract, preferably through trusted API Gateway headers in local development.

Browser-supplied `ownerId` and `userId` must not be trusted.

## Authorization

- Trip operations require owner or member authorization.
- Itinerary operations require authorization on the parent trip.
- Moving itinerary items requires both source and target day to belong to the same authorized trip.
- Feedback, favorites, and collections require the authenticated user to own the affected user-specific record.
- Place records may be global, but user actions against places remain authorization checked.

## Ownership Validation

Every resource lookup must combine resource identity with ownership or membership checks. Existence alone is not authorization.

## Input Validation

Validate:

- UUIDs and path parameters.
- Date ranges and time ranges.
- Coordinates and travel modes.
- Enum values and provider names.
- String lengths for names, notes, comments, and descriptions.
- Reorder/move item lists for duplicates, missing IDs, cross-trip IDs, and invalid sequences.
- Pagination and sort inputs.

## Secret Handling

- `VIETMAP_SERVICE_KEY`, `OPENTRIPMAP_API_KEY`, and database credentials stay server-side.
- Only `NEXT_PUBLIC_VIETMAP_TILE_KEY` may be exposed to browser code.
- Do not log API keys, auth headers, full provider URLs containing secrets, stack traces, SQL internals, or raw provider error bodies.
- `.env`, `.env.local`, and `.env*.local` are already ignored by the root `.gitignore`.

## Abuse Cases

- Search and routing endpoint scraping.
- Provider quota exhaustion.
- Cross-user IDOR attempts.
- Unauthorized public access to internal candidate APIs.
- Feedback spam or abusive comments.
- Reorder/move payloads designed to corrupt sequence state.

## IDOR Review

High-risk IDs include trip IDs, day IDs, item IDs, place IDs, feedback IDs, favorite IDs, collection IDs, and internal candidate request contexts. All user-owned operations must enforce ownership server-side.

## Trust Boundaries

- Browser/client code is untrusted.
- Next.js BFF, if used, adapts frontend requests but does not own security decisions alone.
- API Gateway is public ingress and should become the enforcement point for authentication once identity is available.
- Backend services remain authoritative for domain authorization.
- Provider APIs are external and failure-prone.
- Internal APIs must be inaccessible from public clients until service-to-service protection exists.
