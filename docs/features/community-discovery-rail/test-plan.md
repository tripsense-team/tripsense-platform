# Test Plan

## P0 picker

- Authenticated owner lists zero, one, >20 and paged trips; an unowned URL `tripId` never preselects or publishes.
- List error, preview error, stale preview, expired auth and dependency outage show distinct recovery and preserve caption/draft.
- Browser E2E covers login -> select trip -> preview -> publish through Gateway.
- Social client maps downstream `401/404/409/422/503` exactly.

## Public profile and follow

- Contract tests reject email, location, social links and other forbidden fields.
- Follow/unfollow/self/duplicate/concurrent requests, deactivated target and rate limits behave deterministically.
- Following feed uses the same visibility policy after a post changes to unlisted/private/removed.
- Suggestions exclude self/followed/ineligible users and remain bounded with stable pagination.
- Anonymous requests to personalized Social routes return `401` even though public-feed reads remain available.
- Legacy/opted-out/deactivated authors never serialize email-derived or private profile fields in discovery responses.

## Public-share destination trend

- Only active, moderated-safe `PUBLIC` shares with an approved canonical destination ref contribute; private, unlisted, removed and free-text-only data never contribute.
- A single author contributes once per destination/day; low cohorts are suppressed, tie ordering is stable and no contributor/source identifiers or exact count reach Web.
- Visibility/removal mutations and the daily reconciliation produce the same result; test `Asia/Ho_Chi_Minh` midnight boundaries, place rename/deactivation and empty state.
- Verify the copy says public shares, never visits/arrivals/current location. Actual-travel trend tests are deferred with that separately approved feature.

## Weather

- Canonical destination validation, cache hit/miss, expiry, stale and provider timeout/error paths.
- No source trip ID, coordinates, private itinerary data, provider key or raw provider payload reaches browser/logs.
- Weather failure does not break feed rendering; accessibility and responsive rail checks pass.

## Regression risks

Existing standard posts, public trip sharing, comments, likes, profile editing and Gateway routes must retain their API behavior.
