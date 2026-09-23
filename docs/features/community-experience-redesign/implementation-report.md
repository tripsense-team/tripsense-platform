# Implementation Impact and Verification

**STATUS: CODE COMPLETE — AUTHENTICATED RELEASE CHECK PENDING**

The approved Community redesign is implemented across Web, Social, Trip and Gateway. PostgreSQL migrations and unauthenticated Gateway checks have passed on the local terminal-managed stack. It remains `IMPLEMENTING` until the authenticated publication/refresh flow and manual accessibility checks run.

## Before and after

| Area                    | Before                                                                                                      | After                                                                                                                                                 | User impact                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Community shell         | A plain social feed and a separate sharing workspace under `/chat`.                                         | `test.html`-aligned hero, two-intent composer, filtered feed, distinct post/trip cards and contextual guidance rail.                                  | Existing update, image, like, comment, reply, link and delete actions remain. `/chat` redirects to the Community trip composer. |
| Trip share entry        | My Trips called `PATCH /api/trips/{id}/share` and made the canonical Trip broadly public.                   | My Trips opens `/community?composer=trip&tripId=...`; no canonical Trip entity is exposed.                                                            | Sharing still exists, but now requires preview, visibility and confirmation. Old broad share/list APIs are removed.             |
| Shared itinerary data   | Social could persist and return raw itinerary JSON containing fields the owner had not explicitly approved. | Trip builds a strict `PublicTripSnapshot V1`; Social stores only the fingerprint-bound immutable public copy.                                         | Notes, budget, participants, booking data, addresses, coordinates and internal IDs cannot appear in the public response.        |
| Dates and times         | Legacy data could include precise schedule details without a stable disclosure rule.                        | Ended trips may show previewed exact dates/times; future and ongoing trips show day numbers only.                                                     | Active travel schedules are not exposed accidentally.                                                                           |
| Existing trip posts     | Old posts depended on unsafe raw JSON.                                                                      | Old posts keep their post ID, caption, likes, comments and safe summary, with `SUMMARY_ONLY_REPUBLISH_REQUIRED`.                                      | Their old detailed timeline is intentionally unavailable until the owner previews and republishes it safely.                    |
| Source trip edits       | Publication semantics were ambiguous.                                                                       | A Community share is frozen. Source edits, archive or deletion do not silently mutate/delete it; explicit refresh creates a new version.              | Readers see a stable story; owners control refresh and deletion separately.                                                     |
| Visibility              | Behavior was inconsistent across feed/detail/interactions.                                                  | `PUBLIC` is signed-in discoverable, `UNLISTED` is signed-in direct link, and `PRIVATE` is owner-only; inaccessible resources return privacy-safe 404. | Comments, likes, detail and reports reuse the same access decision.                                                             |
| Moderation              | Report controls had no complete backend outcome.                                                            | Signed-in non-owners can report posts/comments; only `ROLE_MODERATOR` can review, dismiss or remove, and every decision is audited.                   | Removed content disappears from normal feed/detail paths.                                                                       |
| Prototype-only features | Weather, Follow, Save and suggested creators could look functional without backend truth.                   | They are not rendered; only real guidance content ships in the rail.                                                                                  | No fabricated counters, weather or toast-only actions. These remain future feature slices.                                      |

## What is deliberately removed or degraded

- Migration `V5` irreversibly clears legacy `itinerary_json`, unproven legacy highlights and legacy traveler count from Social. It does **not** delete the canonical trip in Trip Service.
- Old summary-only Community posts temporarily lose their detailed timeline, but retain post identity and interactions; the owner can republish in place.
- The competing Trip `PATCH /{tripId}/share` and `GET /shared/{userId}` APIs are removed. Web now uses the Community publication flow.
- The route map is absent from V1 because current Place IDs and public/private location policy are not safe enough for publication.
- Follow, Save, Weather, Suggested Creators and Recent Destinations are not part of this approval and were not faked.

## Verification completed locally

- Social Service: 40 tests pass, including snapshot integrity, visibility, refresh idempotency, concurrent duplicate handling, reporting and moderation.
- Trip public projection: 3 deterministic/redaction, ended-date/time and media-policy tests pass.
- Web: 33 tests pass; TypeScript, scoped ESLint and production Next.js build pass.
- API Gateway: 8 tests pass, including Social discovery route and rate-limit wiring.
- `git diff --check` is clean for feature-owned files; an unrelated pre-existing blank line remains in User Service configuration.

## Remaining release gate

Verified on local PostgreSQL:

- Flyway Social `V202609221419`–`V202609221422` and the Trip publication revision migration completed successfully.
- `payload_sha256` is `VARCHAR(64)`, matching Hibernate.
- Legacy raw `itinerary_json` count is zero; the legacy-empty and current-snapshot constraints exist.
- Gateway routes Community feed successfully (`200`) and rejects unauthenticated Trip/preview requests (`401`).

Still required:

- Use a disposable, already-verified test account to publish and refresh a share through Gateway.
- Exercise `401/404/409/422/429/503` authenticated error paths and the persisted concurrency scenarios.
- Complete manual responsive, keyboard and focus verification in a functioning browser automation environment.

For service startup without Docker:

```bash
./scripts/start.sh
```

Do not change the feature status to `DONE` until the authenticated persisted release-gate scenarios in `test-plan.md` pass.
