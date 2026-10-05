# Security

## Authentication and authorization

- My Trips and preview remain authenticated and owner-scoped in Trip; a query-string `tripId` is only a UI hint.
- Follow derives the follower solely from JWT and never accepts it in a request body. It rejects self-follow and ineligible/deactivated/blocked targets.
- A Following feed reevaluates each post's canonical visibility; following never reveals `UNLISTED` or `PRIVATE` posts.
- New Social GET routes must not inherit the broad anonymous Social GET rule by accident; authorization is explicit per route.
- The current `GET /api/social/**` anonymous rule is a blocker: follow state, creator suggestions, Following scope and destination trends must be matched as authenticated before the broad public-feed matcher.

## Privacy

- Do not reuse the current profile endpoint for Community discovery: it exposes email and other non-public fields.
- Public profiles return privacy-safe `404` for unavailable users and do not permit UUID/email enumeration.
- Weather accepts only a validated canonical destination reference, never free-text URLs, private trip data, raw coordinates or device location.
- Destination trends use only qualifying public-share aggregates and a canonical public reference. They must not include private/future trips, source-trip IDs, contributor IDs, raw Place IDs, coordinates, real-time location or counts below the minimum cohort.

## Abuse and secrets

- Apply actor and trusted-client-IP limits to follow/unfollow, discovery and weather; return `429` without automatic write retry.
- Gateway IP limits are insufficient on their own: use JWT-derived actor limits for follow writes, with trusted proxy IP as secondary protection. Bound cursors, limits and batch profile reads.
- Weather provider credentials stay server-side; use HTTPS allowlists, timeouts, response-size limits, cache/backoff and redacted logs.
- Validate gateway/service JWT issuer, audience, expiry and signature; do not introduce a broad service-account bypass.

## Required security tests

Test guessed IDs, self/duplicate/racing follows, account deactivation, visibility changes after following, forbidden-field serialization, provider failures and `401/403/404/409/429/503` through Gateway. Also test anonymous GET regression, public-profile opt-out/event lag, low-cohort suppression, duplicate-author deduplication, timezone boundaries and that trend responses contain no private/source identifiers.
