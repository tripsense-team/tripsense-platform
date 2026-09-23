# Community Feature Roadmap

**STATUS: WAITING_FOR_HUMAN_APPROVAL**

The current approval scope is Phases A–D of the Community redesign. Later rows require their own complete feature plan and approval.

| Order | Slice                              | Outcome                                                                                       | Dependency |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| A     | Legacy containment                 | Unsafe raw itinerary data can no longer be written/read; old shares remain as safe summaries. | None       |
| B     | `test.html` Community shell        | Supported hero, dual composer, typed cards, real type filters and static rail.                | A          |
| C     | Detailed public itinerary          | Preview-bound immutable `PublicTripSnapshot V1`, typed timeline and old-share republish.      | A, B       |
| D     | Minimum reporting/public readiness | Report, audited removal and signed-in PUBLIC detailed sharing.                                | C          |
| E     | Public social profile              | Email-free display name/avatar and safe profile page/batch contract.                          | D          |
| F     | Follow + Following Feed            | End-to-end follow loop; only then reveal Follow buttons and creator suggestions.              | E          |
| G     | Bookmark posts                     | Private Save/Unsave/list; no clone or place collection.                                       | B          |
| H     | Place contract and route map       | Opaque Place reference migration, public-POI projection and safe map restoration.             | C          |
| I     | Recent destinations                | Real public destination aggregation; no free-text grouping or fake trends.                    | D, H       |
| J     | Contextual weather                 | Explicit canonical destination, provider/cache and stale/error states.                        | H          |
| K     | Notifications                      | Async delivery/preferences with viewer reauthorization.                                       | F, D       |

## Future persistence sketches

Follow remains in `social-service` as `(follower_user_id, followed_user_id, created_at)` with no cross-service user FK. Save remains `(user_id, post_id, created_at)` with a local post FK and visibility reauthorization on read. These sketches are not migrations and must not be implemented under the current approval.

## Sequence rule

For every later slice:

```text
approve product invariants
-> design its migration/API/security
-> implement backend and frontend together
-> run acceptance/integration tests
-> mark complete
-> start the next slice
```

Weather, discovery and the route map never take priority over containment, detailed publication integrity or moderation.
