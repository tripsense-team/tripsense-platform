# Test Plan

## Backend

- Create post: authenticated, unauthenticated, validation, verified media, and no trusted author ID.
- Feed: empty, ordered pages, user filter, detail success/404, and bulk-query/N+1 regression coverage.
- Delete: owner success, admin success, other actor 403.
- Likes: like, duplicate/race, unlike, deleted target.
- Comments: root/reply/nested reply, invalid/missing/cross-post parent, flat exact parent IDs.
- Comment likes: like/unlike/race and route/comment mismatch.
- Cloudinary: signature authentication/expiry, tampered folder/public ID/URL/type rejection, no secret exposure, orphan cleanup behavior.

## Frontend

- `[]` feed/comments => EmptyState and no sample card.
- 500/network timeout/unavailable => ErrorState only and no sample card.
- Detail 404 => Not Found; 401 => authentication state; 403 => permission state.
- Explicit mock flag true selects mock; unset/false selects real API in development and production.
- Existing comment-tree tests retain unlimited true parent hierarchy and visual depth clamp.

## Integration and Manual

- Gateway route, JWT forwarding/validation, error envelope, Cloudinary direct upload, create/feed/detail/like/comment/delete end-to-end.
- Confirm each successful/empty/error state is visually distinct without a UI redesign.

## Executed Verification

- `mvn -pl services/social-service -am test`: 10 tests passed.
- `mvn -pl services/api-gateway -am test`: 8 tests passed, including the social discovery/rate-limit route.
- Frontend `tsc --noEmit`, ESLint for the Social Post feature, and Vitest: 15 tests passed.
- `next build --webpack`: succeeded. The default Turbopack path cannot run in this sandbox because `mapvina-gl` attempts a prohibited local port bind.
