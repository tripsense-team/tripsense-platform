# Requirements

## User Goal

Travelers can share a saved TripSense trip to the Community feed in a Mindtrip-like way: a social post with a caption, a readable trip preview, a direct view path, visibility controls, and a remove action that does not delete the original trip.

## Use Cases

- TF-56: From a trip detail screen, the owner shares the trip as a Community social post.
- TF-57: The owner adds or updates a caption/description for the shared trip post.
- TF-58: Feed and post detail show basic trip information: trip name, destination, date range, cover image when available, day count, itinerary item count, and up to three safe highlights.
- TF-59: A viewer opens a shared trip post and sees the shared trip preview/detail state.
- TF-60: The owner manages sharing visibility.
- TF-61: The owner removes the shared trip post without archiving, deleting, or mutating the source trip.

## Acceptance Criteria

- Only an authenticated trip owner can share a trip.
- Sharing creates a social post linked to one source trip; it does not duplicate the editable trip.
- Caption is trimmed and length-limited; an empty caption is allowed because the trip preview itself is meaningful content.
- Shared post cards preserve existing social actions: likes, comments, post detail, owner delete.
- Shared post cards display a compact trip preview without needing live `trip-service` calls in feed reads.
- Feed shows only `PUBLIC` active shared trip posts.
- `UNLISTED` posts are hidden from feed but accessible by direct post link to authenticated users.
- `PRIVATE` posts are visible only to the owner in management/detail contexts.
- Removed shared posts return not found to non-admin viewers and no longer appear in feed.
- Viewer-facing MVP detail is the social post plus stored trip snapshot, not full itinerary browsing.
- Removing a shared post never deletes or archives the source trip.
- Idempotent retries with the same `Idempotency-Key` do not create duplicate shares.
- MVP allows only one active shared post per owner/source trip.
- A second share attempt for the same active owner/source trip returns `409 DUPLICATE_ACTIVE_TRIP_SHARE`; the UI should route the owner to manage the existing share.

## Business Rules

- `social-service` owns social post content, caption, visibility, reactions, comments, and share removal.
- `trip-service` owns canonical trip data, trip ownership, trip lifecycle, and share snapshot generation.
- The share snapshot comes only from `trip-service`, never from client-submitted trip fields.
- Snapshot staleness is accepted for MVP; future events may refresh or hide shared snapshots after trip changes.
- Archived, deleted, or otherwise unavailable trips cannot be newly shared.
- Shared URLs use `postId` for MVP authenticated routes. Future anonymous/public sharing should add an opaque `shareSlug` or `publicShareToken`.

## Edge Cases

- Non-owner attempts to share a trip.
- Owner retries share creation after a network timeout.
- Owner attempts to share the same trip twice.
- Owner changes a trip after sharing, making the snapshot stale.
- Source trip is archived or deleted after sharing.
- Viewer opens a removed, private, or unlisted post.
- `trip-service` is unavailable during share creation.
- Trip has no cover image or itinerary items.
- Caption is blank, too long, or contains unsafe markup.

## Out Of Scope

- Copy/fork someone else's shared trip into a new itinerary.
- Public SEO pages for anonymous shared trips.
- Real-time trip collaboration.
- Full itinerary publishing by default.
- Reposting or quote-sharing another user's trip share.
- Notifications, moderation queues, analytics, booking, or payments.
- A new `sharing-service`.

## Open Questions

- Should `UNLISTED` shared posts be accessible to anonymous users later, or stay authenticated-only?
- Should users be able to refresh a stale snapshot manually after editing the source trip?
- Should full shared itinerary browsing be added after MVP, and if so through which permission handshake?
- Which exact Mindtrip UX details should be copied after manual review: share entry point, card layout, link behavior, visibility labels, and shared-trip detail depth?
