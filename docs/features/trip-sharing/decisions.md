# Decisions

| Decision | Rationale | Alternatives Rejected |
| --- | --- | --- |
| Use `social-service` as owner of shared trip posts. | Sharing appears in Community and uses likes, comments, feed ordering, visibility, and removal. | Put shares in `trip-service`; create `sharing-service`. |
| Use `TRIP_SHARE` post type plus `social_trip_shares` extension table. | Keeps existing social posts compatible while isolating trip-share metadata. | Add many nullable trip columns directly to `social_posts`. |
| Store a safe denormalized trip snapshot. | Feed/detail can render without N+1 live calls to `trip-service`. | Live trip lookups for every shared post; full itinerary snapshot. |
| Add `GET /api/trips/{tripId}/share-snapshot`. | `trip-service` owns ownership validation and canonical trip summary. | Client submits trip snapshot; social-service reads trip DB. |
| MVP uses `PUBLIC`, `UNLISTED`, and `PRIVATE`. | Covers feed, direct link, and owner-only management without follower graph complexity. | `FOLLOWERS_ONLY`; anonymous public links. |
| MVP allows one active shared post per owner/source trip. | Reduces duplicate spam and makes visibility/removal semantics clear. | Multiple active shares for the same trip. |
| MVP shared reads are authenticated-only. | Reduces privacy and enumeration risk while product scope is still early. | Anonymous public shared-trip pages. |
| Snapshot staleness is accepted for MVP. | Avoids Kafka/event complexity before core share flow is proven. | Immediate event-driven refresh. |
| TF-59 MVP shows post detail plus snapshot, not full itinerary browsing. | Matches current service boundaries and avoids public trip permission complexity. | Trip-like full shared itinerary page in MVP. |

## Review Findings

- `HIGH`: Social feed must not call `trip-service` per feed item.
- `HIGH`: Snapshot must exclude private notes, budget, lodging, participant data, and full itinerary details.
- `HIGH`: `social-service` must never read `trip-service` database or import trip entities.
- `HIGH`: Visibility must be enforced in repository/service reads, not only frontend.
- `MEDIUM`: Service-to-service auth must be explicit; forwarded JWT is acceptable for MVP if both services validate it.
- `MEDIUM`: Duplicate share policy must be enforced by DB constraint and service handling.
- `MEDIUM`: Removed shared post copy must be clear in UI so users do not think the source trip is deleted.
- `MEDIUM`: Mindtrip UX parity needs manual confirmation because the private Mindtrip link was not accessible in this environment.
