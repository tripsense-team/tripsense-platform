# Security

## Authentication

All MVP trip-sharing endpoints require authenticated access JWTs. Anonymous public shared links are deferred.

## Authorization

- Only a trip owner can create a share for that trip.
- Only the post owner can update caption or visibility.
- Owner or `ROLE_ADMIN` can remove a shared post; admin removal is moderation only and never makes the admin the trip owner.
- `PUBLIC` posts are visible in feed and direct detail to authenticated users.
- `UNLISTED` posts are hidden from feed and visible by direct link to authenticated users.
- `PRIVATE` posts are owner-only.
- Raw `postId` links are acceptable only for authenticated MVP routes. Public anonymous links require a future opaque token/slug design.

## Ownership Validation

`social-service` must call `trip-service` to validate ownership and receive the snapshot. `trip-service` derives the user from JWT claims and returns `404` for non-owned, archived, deleted, or unavailable trips.

## Input Validation

- Reject malformed UUIDs and invalid visibility enums.
- Trim captions and cap at 5,000 characters.
- Ignore or reject client identity fields.
- Never accept trip title, destination, dates, itinerary summary, cover image, or highlights from the client for the persisted snapshot.
- Escape caption content in the web UI; sanitize only if rich text is introduced later.

## Secret Handling

No new external secret is required. JWTs and service credentials must not be logged. Existing backend-only credentials remain backend-side.

## Abuse Cases

- Idempotency prevents duplicate posts from retries.
- One active share per owner/source trip reduces feed spam and ambiguous removal.
- Gateway or service rate limits should cover create, visibility update, delete, and detail enumeration attempts.
- Repeated attempts to share non-owned trips should return generic not-found/forbidden behavior without leaking trip existence.
- `UNLISTED` posts are excluded from feed/search/count discovery and do not leak through default list APIs.

## IDOR Review

Treat `tripId`, `postId`, and shared links as untrusted. Private, removed, or inaccessible resources return `404` when revealing existence would leak data.

Security tests must cover:

- Owner can share own trip.
- Non-owner cannot share another user's trip.
- Client-provided `authorId` is ignored or rejected.
- Client cannot spoof share snapshot fields.
- Private/unlisted posts do not appear in feed.
- Non-owner cannot update visibility or remove the post.
- Removed post returns `404`.
- Guessing `tripId` or `postId` does not expose trip details.

## Trust Boundaries

- Browser clients are untrusted.
- API Gateway is the only public ingress.
- `social-service` may store `sourceTripId` and safe snapshot data only.
- `trip-service` remains authoritative for source trip access.
- If service-to-service trust evolves beyond forwarded JWTs, original user identity must be signed or otherwise trusted, not accepted from plain headers.
