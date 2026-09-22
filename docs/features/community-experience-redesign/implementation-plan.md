# Implementation Plan

Implementation may start only after status becomes `APPROVED`. Each phase must pass its gate before the next one is enabled.

## Progress (2026-09-22)

- Phase A containment is implemented in code: summary-only legacy reads/writes, explicit visibility, typed-share access checks, server timeouts, rate-limit enablement and irreversible legacy JSON scrub migration. The migration has not been applied to a shared environment from this workspace.
- Phase B supported shell is implemented: Community hero, responsive feed/rail, split composer, server-side type filtering, summary-only Trip cards, removal of per-card profile calls and `/chat` redirect.
- Phase C is implemented in code: deterministic owner-only preview, fingerprint-bound consent, immutable versioned snapshots, typed detail timeline, in-place refresh and summary-only legacy republish.
- Phase D is implemented in code: bounded post/comment reporting, duplicate/rate-limit handling, dedicated moderator authorization, audited removal endpoints and moderation UI.
- Local verification passes for Social, Trip projection, Web and Gateway. PostgreSQL/Flyway migration verification now passes on the local terminal-managed stack; authenticated publish/refresh and manual accessibility checks remain before the feature can move to `DONE`.

## Phase A — immediate containment

1. Inventory non-empty legacy `itinerary_json`, active/removed rows, current caches/logs/fixtures and backup retention.
2. Patch web and Social readers so old typed shares can render summary-only without deserializing or returning raw itinerary.
3. Stop new raw itinerary writes; make the deprecated Trip `/share-snapshot` producer fail closed to the approved temporary safe summary.
4. Run separate Flyway migrations to clear unsafe JSON/highlights and enforce legacy JSON remains null/empty; verify forbidden fields are absent.
5. Enforce typed-share PUBLIC/UNLISTED/PRIVATE behavior across mixed feed, detail, comments and reactions.
6. Move Social-to-Trip HTTP calls outside local transactions; configure production service URL, 2s/5s timeout proposal and rate limits.
7. Contain/deprecate the competing Trip public-share/list surface and stop returning broad `TripResponse` to public viewers.

**Gate A:** unsafe JSON cannot be returned or rewritten; auth matrix, migration verification, production connectivity and rate-limit tests pass.

## Phase B — supported `test.html` shell

8. Build `CommunityHero` and the responsive 8/4 `CommunityHubScreen` with existing TripSense tokens/primitives.
9. Split the composer into Update and Trip modes; standard creation retains text/images, while Trip mode opens the publication flow.
10. Remove new legacy `TRIP_METADATA` creation and preserve historical sanitized reading only.
11. Add server-side `type=ALL|STANDARD|TRIP_SHARE` filtering before pagination.
12. Refactor standard and Trip Share feed cards to match the prototype density, media mosaic, summary artifact and **Xem chia sẻ** CTA.
13. Preserve modal/direct routes, author links, reactions, comments/replies, link share, owner/admin deletion, pagination and all loading/error/empty states.
14. Remove per-card profile/trip/place calls; use the Social author snapshot/fallback.
15. Ship only guidelines/sharing tips in the rail. Reserve component slots but do not render Follow, Save, Weather, creators or destinations.
16. Redirect `/chat` to `/community?composer=trip`; update existing share entry links and support a preselected trip query/state.

**Gate B:** the page visually matches the supported portions of `test.html`; every visible control works against real state; no N+1 or route regression exists.

## Phase C — safe detailed publication

17. Add `trip-service.publication_revision` and increment it for every shareable Trip/Day/Item mutation.
18. Implement deterministic `PublicTripSnapshotV1` projection, canonical serialization, SHA-256 fingerprint, limits and contract tests.
19. Add Social-orchestrated preview with warnings and consent version; do not accept client snapshot data.
20. Expand Social schema with immutable snapshot table, head pointer and `detailAvailability`.
21. Implement create/republish orchestration and a separate short transactional writer; bind idempotency to the request fingerprint.
22. Split feed summary DTO from typed detail DTO and make `GET /api/social/trip-shares/{postId}` canonical for itinerary detail.
23. Add `SUMMARY_ONLY_REPUBLISH_REQUIRED` owner UI and in-place preview/republish preserving reactions/comments.
24. Replace the current raw `SharedTripDetailView` model with `TripShareHero`, summary stats and accessible `PublicItineraryTimeline`.
25. Explain immutable semantics in UI: source edits/deletion do not update/remove the Community post; refresh and delete are explicit.
26. Keep the route map absent in V1 and remove viewer-side Place-search reconstruction.

**Gate C:** preview equals persisted/public output, stale preview fails, forbidden fields cannot serialize, feed does not read snapshot JSON, limits/transactions/idempotency pass, and legacy shares degrade safely.

## Phase D — public readiness

27. Define bounded post/comment report reasons, duplicate/throttle behavior, reporter privacy and evidence retention.
28. Add minimum report submission plus moderator-only audited review/removal endpoints and UI.
29. Ensure moderated content disappears from feed and future discovery without querying the source trip.
30. Enable detailed `PUBLIC` publication for signed-in members after report and authorization tests pass.

**Gate D:** report/moderator authorization, audit, removal propagation and PUBLIC abuse/security tests pass.

## Likely files

- `apps/web/tripsense/src/app/(main)/community/**`
- `apps/web/tripsense/src/app/(main)/chat/page.tsx`
- `apps/web/tripsense/src/features/social-post/components/**`
- `apps/web/tripsense/src/features/social-post/hooks/**`
- `apps/web/tripsense/src/features/social-post/types/post.ts`
- `apps/web/tripsense/src/features/social-post/services/**`
- `services/trip-service` publication DTO/mapper/revision/migrations/tests
- `services/social-service` DTO/orchestration/writer/entity/migrations/security/tests
- `services/api-gateway` production rate-limit/integration configuration

## Stop conditions

Stop and revise before proceeding if implementation requires raw canonical Trip entities in Social, client-authored publication fields, cross-service database access, exact future schedule publication, arbitrary coordinates, an unapproved service, automatic legacy conversion, or a UI control without a real backend outcome.
