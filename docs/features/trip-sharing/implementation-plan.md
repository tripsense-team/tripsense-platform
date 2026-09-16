# Implementation Plan

Implementation may start only when the feature status is `APPROVED`.

## Tasks

1. TF-56 Share a trip as a social post
   - Add `TRIP_SHARE` post type in `social-service`.
   - Add `POST /api/social/trip-shares`.
   - Add `GET /api/trips/{tripId}/share-snapshot`.
   - Add `TripShareClient` in `social-service` with forwarded bearer token and timeout handling.

2. TF-57 Add a caption or description
   - Use `social_posts.content` as the caption.
   - Add share dialog caption input in web trip detail.
   - Support caption edit only if existing social post edit patterns exist; otherwise defer edit and document create-time caption for MVP.

3. TF-58 Display basic trip information in the shared post
   - Add nullable `type`, `visibility`, and `trip` fields to web social post types.
   - Render trip-share preview cards in feed/detail with cover, title, destination, dates, counts, and highlights.

4. TF-59 View a shared trip
   - Add `GET /api/social/trip-shares/{postId}` or use enriched `GET /api/social/posts/{postId}`.
   - Add web route or modal state for shared trip snapshot detail based on existing Community post detail patterns.
   - Defer full itinerary browsing unless approved as a separate scope expansion.

5. TF-60 Manage trip-sharing visibility
   - Add `PATCH /api/social/posts/{postId}/visibility`.
   - Add owner-only web controls for `PUBLIC`, `UNLISTED`, and `PRIVATE`.

6. TF-61 Remove a shared trip post
   - Reuse existing delete endpoint with trip-share-specific UI copy.
   - Ensure delete soft-removes the post and marks `social_trip_shares.removed_at`.

## Sequencing

1. Backend schema and entity/DTO additions in `social-service`.
2. Trip snapshot endpoint in `trip-service`.
3. Social trip-share create/read/visibility service logic.
4. Web API client/types/hooks.
5. Web share dialog and Community trip-share rendering.
6. Tests and manual verification through Gateway.

## Files Likely Affected

- `services/social-service/src/main/resources/db/migration/`
- `services/social-service/src/main/java/fu/tripsense/socialservice/entity/`
- `services/social-service/src/main/java/fu/tripsense/socialservice/dto/`
- `services/social-service/src/main/java/fu/tripsense/socialservice/controller/SocialPostController.java`
- `services/social-service/src/main/java/fu/tripsense/socialservice/service/`
- `services/trip-service/src/main/java/fu/tripsense/tripservice/controller/TripController.java`
- `services/trip-service/src/main/java/fu/tripsense/tripservice/service/`
- `apps/web/tripsense/src/features/social-post/`
- `apps/web/tripsense/src/features/trip-management/`

## Stop Conditions

Stop and request a planning revision if implementation requires:

- Anonymous public sharing.
- Full itinerary public view.
- Cross-service database access.
- New service-to-service auth mechanism beyond approved forwarded JWT behavior.
- Multiple active shares per owner/trip.
- New moderation, notification, analytics, or follower-graph behavior.
- A requirement to copy Mindtrip behavior not captured by the Jira subtasks or this feature plan.
