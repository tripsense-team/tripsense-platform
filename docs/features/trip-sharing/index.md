# Trip Sharing

**STATUS: WAITING_FOR_APPROVAL**

Plan a Mindtrip-inspired trip sharing flow where a traveler can share one saved trip as a Community post with a caption, a compact trip preview, visibility controls, and a removable shared post.

The Mindtrip chat link was not accessible from this environment, so this plan uses the Jira screenshot and the listed subtasks as the source of scope:

- TF-56 Share a trip as a social post
- TF-57 Add a caption or description
- TF-58 Display basic trip information in the shared post
- TF-59 View a shared trip
- TF-60 Manage trip-sharing visibility
- TF-61 Remove a shared trip post

## Scope

- Add `TRIP_SHARE` as a specialized social post type owned by `social-service`.
- Store a denormalized, safe trip snapshot with the social post so feed/detail reads do not call `trip-service` per item.
- Add a `trip-service` share snapshot endpoint that validates the authenticated user owns the trip before exposing shareable summary data.
- Add web UI entry points from trip detail and Community feed/detail using existing TripSense social post patterns.
- Keep all public traffic through API Gateway.

## Documents

- [Requirements](requirements.md)
- [Architecture](architecture.md)
- [API](api.md)
- [Data model](data-model.md)
- [Security](security.md)
- [Decisions and review findings](decisions.md)
- [Implementation plan](implementation-plan.md)
- [Test plan](test-plan.md)

## Planning Mode

REAL SUBAGENT DELEGATION was used for Product, Domain, Architecture, API/Backend, Database, Security, and Devil's Advocate review. Final synthesis is documented in the files above.

STATUS: WAITING_FOR_HUMAN_APPROVAL
