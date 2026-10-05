# Test Plan

## Unit Tests

- `trip-service` share snapshot maps only safe fields.
- `trip-service` rejects non-owned, archived, deleted, and unavailable trips.
- `social-service` validates caption, visibility, idempotency key, and duplicate active share.
- `social-service` maps downstream trip-service errors correctly.
- Visibility checks return correct access state for owner, authenticated viewer, and admin.
- Trip-share response mapping preserves existing standard post response behavior.

## Integration Tests

- Owner creates a trip-share post through `POST /api/social/trip-shares`.
- Retry with same `Idempotency-Key` returns the existing post.
- Conflicting replay with same `Idempotency-Key` returns conflict.
- Non-owner cannot share another user's trip.
- `PUBLIC` trip share appears in feed.
- `UNLISTED` and `PRIVATE` trip shares do not appear in feed.
- `UNLISTED` direct detail is accessible to authenticated users.
- `PRIVATE` direct detail is owner-only.
- Remove shared post hides it from feed/detail and leaves source trip unchanged.
- Second active share attempt for the same owner/trip returns duplicate conflict.
- Source trip archived/deleted after sharing returns a safe unavailable state.

## Contract Tests

- Web client handles standard posts and `TRIP_SHARE` posts from the same feed response.
- Gateway routes `/api/social/trip-shares`, `/api/social/posts/**`, and `/api/trips/{tripId}/share-snapshot`.
- `social-service` handles `trip-service` `401`, `403`, `404`, `409`, timeout, and `5xx`.
- Default feed repository query excludes `UNLISTED`, `PRIVATE`, removed, and deleted trip shares.

## Security Tests

- Client cannot set `authorId`, `ownerId`, or snapshot fields.
- Guessing `postId`/`tripId` does not expose private data.
- Removed/private/inaccessible resources use `404` where existence leakage matters.
- Caption rendering does not execute markup/script.
- Logs do not contain JWTs, secrets, private trip notes, or full captions.
- Rate-limit behavior returns `429` for abusive share creation attempts when configured.

## Manual Verification

- Create a trip, share it from trip detail, and see it in Community feed.
- Add blank and nonblank captions.
- Open the shared trip post/detail.
- Toggle `PUBLIC`, `UNLISTED`, and `PRIVATE`.
- Remove the shared post and confirm the original trip still exists.
- Confirm mobile and desktop layouts do not overlap and shared cards remain readable.
- Compare against manually observed Mindtrip behavior for entry point, card layout, visibility labels, and detail depth before implementation signoff.

## Regression Risks

- Existing standard social posts must still create, render, like, comment, and delete.
- Existing trip CRUD and itinerary screens must remain unchanged.
- Feed pagination must remain stable when mixing standard and trip-share posts.
- Gateway auth/rate-limit behavior must remain compatible with existing social routes.
