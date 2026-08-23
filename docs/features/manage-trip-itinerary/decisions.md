# Decisions

| Decision | Rationale | Alternatives Rejected |
| --- | --- | --- |
| Co-locate itinerary management in `trip-service` for TF-47 MVP. | Trip and itinerary form one user-facing aggregate; splitting now would add tight synchronous calls for every detail view and reorder. | Separate `itinerary-service` for MVP. |
| Create `services/trip-service` as part of approved implementation. | The current source tree has no trip service, so backend persistence cannot be implemented otherwise. | Store trips in `user-service`, `place-service`, or `ai-service`. |
| Allow manual itinerary items with `placeId = null`. | Real trips include flights, hotels, transfers, meals, and notes that may not map to a Place Service record. | Require every itinerary item to reference a place. |
| Defer AI draft import to a later phase. | Import requires its own validation, idempotency, mapping, and partial failure design. | Include `POST /api/trips/{tripId}/itinerary/import-draft` in the MVP. |
| Store explicit lifecycle status only. | Upcoming, ongoing, and completed can be derived from dates and should not conflict with user-controlled status. | Persist date-derived display statuses as canonical status. |
| Block date shrink when items would fall outside the new range. | Prevents silent data loss and orphaned itinerary records. | Automatically delete, archive, or move out-of-range items without explicit user policy. |
| Allow overlapping item times with warnings. | Travelers often draft imperfect plans; hard blocking overlaps would be too strict for MVP. | Reject all overlaps at API or database level. |
| Archive trips by default. | Preserves past-trip history and avoids destructive deletes. | Physical delete as default behavior. |

## Review Findings

- `BLOCKER`: Service ownership conflict between planned `trip-service` and planned `itinerary-service` resolved by co-location in `trip-service` for MVP.
- `BLOCKER`: `trip-service` does not exist; implementation must begin with service scaffold and platform wiring.
- `HIGH`: Date-shrink behavior resolved by blocking when out-of-range items exist.
- `HIGH`: Reorder concurrency must use optimistic versions plus locking or gap-safe ordering.
- `HIGH`: Place Service sync coupling mitigated by strict validation on create/update and snapshot-tolerant reads.
- `HIGH`: Auth claim contract must be finalized before coding.
- `MEDIUM`: AI draft import moved out of MVP.
- `MEDIUM`: Existing web trip pages are mock-driven and need explicit API mapping.
