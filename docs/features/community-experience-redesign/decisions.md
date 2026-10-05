# Decisions

| Decision                                                                         | Rationale                                                                                                | Rejected alternative                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Use `test.html` as the production composition target                             | Its hero, dual composer, feed/card hierarchy and 8/4 rail express the desired travel identity.           | Keeping the current plain feed.                                         |
| Hide unsupported prototype controls until their vertical slice ships             | Production UI must not use demo toggles or fabricated data.                                              | Shipping disabled/toast-only Follow, Save or Weather.                   |
| Preserve detailed itinerary sharing through `PublicTripSnapshot V1`              | Detailed routes are a core TripSense use case, but canonical private entities are not a public contract. | Summary-only Trip Share or raw Trip DTO publication.                    |
| Split feed summary from typed detail                                             | Keeps feed payload bounded while preserving a rich detail experience.                                    | Returning all days/items in every feed card.                            |
| Social publicly orchestrates preview; Trip produces the projection               | One coherent Community workflow while ownership/field policy stays with Trip.                            | Browser coordinating two public domains or Social rebuilding Trip data. |
| V1 publishes all server-eligible safe items                                      | Avoids item-selection ownership and digest complexity in the first release.                              | Client-selected or client-authored snapshot fields.                     |
| Ended trips may expose previewed exact dates/times; future/ongoing trips may not | Preserves useful historical itineraries without enabling live schedule disclosure.                       | Always exact or always summary-only dates.                              |
| V1 excludes Place IDs/coordinates and defers the route map                       | Current Place IDs are strings while Trip stores UUIDs, and no public/private POI classification exists.  | Copying arbitrary stored coordinates or per-item Place search.          |
| Snapshots are immutable and refresh is explicit                                  | Published stories stay stable and reads do not depend on live Trip availability.                         | Live synchronization or per-detail Trip hydration.                      |
| Old raw itinerary JSON is scrubbed, not auto-converted                           | Old owners did not preview/approve the new public contract.                                              | Whitelist-converting historical raw JSON automatically.                 |
| Republish old shares in place                                                    | Preserves post identity, likes and comments while obtaining new consent.                                 | Requiring deletion and a new post.                                      |
| Minimum report/audited removal gates broad detailed PUBLIC rollout               | Public UGC needs a basic harm-response path.                                                             | Deferring moderation while enabling discovery.                          |
| `/community` becomes the canonical share entry                                   | Removes the accidental `/chat` ownership and keeps the feature discoverable.                             | Maintaining two competing share workspaces.                             |
| Keep current services                                                            | Existing boundaries are sufficient.                                                                      | A new Community, publication or weather service for this slice.         |

## Findings resolved by this revision

- **BLOCKER resolved:** the old plan incorrectly removed itinerary detail; V1 now preserves ordered public days/items.
- **BLOCKER resolved:** exact V1 fields and date/time policy are frozen in requirements.
- **BLOCKER resolved:** old shares have `SUMMARY_ONLY_REPUBLISH_REQUIRED` plus an in-place republish flow.
- **BLOCKER resolved:** preview ownership is Social-orchestrated and Trip-produced.
- **BLOCKER resolved:** detailed PUBLIC rollout is gated by minimum reporting.
- **HIGH acknowledged:** V1 route map is deferred because the Place identity/safety contract is inconsistent; this is an explicit scoped regression, not a claim that maps are impossible.
- **HIGH:** current Social creation calls Trip inside a database transaction; orchestration and local writer must be separated.
- **HIGH:** current feed DTO carries full itinerary JSON; feed/detail DTOs must split.
- **HIGH:** current author lookup exposes email-bearing profile data and makes per-card requests; the shell uses the Social author projection until a safe public-profile slice is approved.
- **MEDIUM:** source deletion does not remove publication; the UI must explain that the Community post is managed separately.

## Human approval meaning

Approval authorizes implementation of Phases A–D in the specified order and with their gates. It does not authorize Follow, Save, Weather, Suggested Creators, Recent Destinations, map restoration or itinerary cloning.
