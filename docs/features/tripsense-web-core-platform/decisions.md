# Decisions

## Final Decisions

| Decision | Rationale | Alternatives Rejected |
| --- | --- | --- |
| Approve Milestone 0 Map / Place Provider POC. | The user approved a priority change to validate provider coverage before Trip CRUD. | Starting Trip CRUD first. |
| Use Next.js as UI and optional thin BFF only. | Durable data ownership belongs to backend services behind API Gateway. | Authoritative Next.js Route Handlers plus Prisma persistence. |
| Stop after Milestone 0 and wait for approval before Trip CRUD. | The POC should answer provider viability before more platform investment. | Continuing automatically into Trip or Itinerary CRUD. |
| Keep TripSense place IDs separate from provider IDs. | Provider IDs are external references and may not match each other. | Using VietMap, OpenTripMap, or Wikimedia IDs as primary keys. |
| Use OpenTripMap and Wikimedia for external enrichment. | The current POC needs image, description, and tourism metadata without blocking VietMap search or routing. | Depending on a single enrichment provider for Milestone 0. |
| Keep OpenTripMap/Wikimedia enrichment failure-tolerant. | External quality data should not break core trip/place/routing workflows. | Making search/detail fail when enrichment providers fail. |
| Defer AI behavior. | This phase prepares data contracts only. | LLM recommendations, generated itineraries, AI ranking, or re-optimization. |

## Important Tradeoffs

- The pasted stack requested Prisma in the Next.js app. Following that would be faster for a standalone demo, but would violate the documented platform architecture and create a migration trap.
- Separate `trip-service` and `itinerary-service` preserve clean ownership, but may be heavier than the MVP needs. A temporary combined trip-planning owner is possible only with explicit approval.
- Provider documentation must be checked at implementation time. This slows provider work but avoids hard-coding stale VietMap, OpenTripMap, or Wikimedia assumptions.
- The POC may use in-memory caches instead of persistent database-backed provider caches because it intentionally avoids broader data-layer work before provider viability is known.

## Review Findings

- `RESOLVED`: Milestone 0 POC is approved by the 2026-08-18 priority change.
- `BLOCKER`: Direct Next.js Prisma persistence conflicts with service-owned data rules.
- `HIGH`: Auth/identity is unresolved while `ownerId` and `userId` are central to the feature.
- `HIGH`: Missing `trip-service`, `itinerary-service`, `review-service`, `user-service`, and `identity-service` source modules affect the implementation plan.
- `HIGH`: Internal candidate APIs require service-to-service protection before exposure.
- `MEDIUM`: `docs/features/index.md` was stale and did not list the existing approved `core-platform-setup` plan.
- `MEDIUM`: Provider API fields/endpoints must be verified against current official docs before coding.
