# Requirements

## User Goal

Travelers can maintain a saved official trip plan, return to it later, and manually organize itinerary days and activities after creation.

## Use Cases

- Create a trip with name, destination, date range, traveler count, budget, and notes.
- List owned trips with filters for lifecycle status and date range.
- Open a trip detail view with generated itinerary days based on the trip date range.
- Add, edit, remove, and reorder itinerary items within a day.
- Add place-based itinerary items using `placeId`.
- Add manual itinerary items without a place, such as flights, hotels, transfers, meals, or notes.
- Archive a trip instead of physically deleting it by default.

## Acceptance Criteria

- A logged-in user can create, read, update, and archive only their own trips.
- Public access to trip APIs goes through API Gateway under `/api/trips/**`.
- Creating a trip generates deterministic itinerary days from `startDate` through `endDate`.
- Trip list supports pagination and filtering by stored lifecycle status and date range.
- Itinerary days preserve stable day number and date ordering.
- Itinerary items preserve stable ordering after create, update, delete, and reorder.
- `placeId` is optional; when present, it is validated by `place-service` before persistence.
- Manual items require a title and type.
- Date and time validation prevents invalid date ranges and invalid time ranges.
- Shortening a trip is blocked when existing itinerary items would fall outside the new date range.
- Overlapping itinerary item times are allowed in MVP but should return/display a warning.
- Empty states are handled for no trips and for itinerary days with no items.

## Business Rules

- `trip-service` owns `Trip`, `ItineraryDay`, and `ItineraryItem` for TF-47 MVP.
- `place-service` owns place metadata; `trip-service` stores only IDs and optional display snapshots.
- `user-service` owns identity, profile, and travel preferences; `trip-service` does not duplicate long-term preferences.
- `ai-service` may generate draft itineraries, but it does not persist canonical trip or itinerary state.
- Stored trip lifecycle status is explicit: `DRAFT`, `CONFIRMED`, `CANCELLED`, `ARCHIVED`.
- Time-relative labels such as upcoming, ongoing, and completed are derived from dates for display.
- Deterministic validation must run on all user and AI-proposed itinerary content.
- Archive is the default delete behavior; hard delete is limited to draft trips without dependencies if approved during implementation.

## Edge Cases

- User changes trip dates after itinerary items exist.
- Two devices reorder the same day concurrently.
- Place Service is unavailable while adding a place-based item.
- A saved item references a place that later becomes unavailable or changes metadata.
- AI-generated draft contains invalid dates, duplicate items, or unsupported item types.
- Long trips with many days and many itinerary items.
- Network retry sends the same mutation more than once.
- User attempts nested IDOR by mixing owned trip IDs with another user's day or item IDs.

## Out Of Scope

- AI conversational planning or modification beyond a later draft-adoption phase.
- Route optimization, traffic-aware scheduling, dynamic re-planning, and weather adaptation.
- Real-time collaboration, invitations, voting, shared editing, and group chat.
- Booking, checkout, payments, travel documents, and notifications.
- Creator itinerary publishing or marketplace flows.
- Full interactive map implementation.
- Separate `itinerary-service` extraction.

## Open Questions

- Should hard delete be exposed for draft trips in the user interface, or should all delete actions archive?
- What exact JWT claim names will `trip-service` trust for authenticated user ID and roles?
