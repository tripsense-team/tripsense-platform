# Requirements

## User Goal

Build the TripSense web application as a real travel planning platform with persistent trips, itineraries, places, maps, routes, ratings, saved places, and AI-ready place candidate data. Before Trip CRUD or Itinerary CRUD, implement an approved Map / Place Provider POC to validate VietMap search/routing and OpenTripMap/Wikimedia place enrichment around Da Nang.

## Use Cases

- Render `/explore` with VietMap Web GL centered on Da Nang.
- Search real VietMap places through `Next.js -> API Gateway -> place-service -> VietMap`.
- Normalize VietMap results into TripSense DTOs with `id`, `externalId`, `name`, `address`, `category`, `latitude`, and `longitude`.
- Render search results as synchronized list cards and map markers.
- Display a rich click popup using cached OpenTripMap/Wikimedia enrichment data when available.
- Match selected VietMap places to OpenTripMap places when `OPENTRIPMAP_API_KEY` exists.
- Use Wikimedia/Wikipedia as a fallback image and description source when OpenTripMap has a confident match without a usable image.
- Report OpenTripMap/Wikimedia availability, images, descriptions, tourism metadata, and match confidence for at least 20 Da Nang places.
- Do not implement Trip CRUD or Itinerary CRUD during Milestone 0.
- Explore places in synchronized list/map views.
- Render VietMap maps, markers, selected-place state, and route polylines.
- Enrich selected place details with OpenTripMap/Wikimedia data when available.
- Capture TripSense-owned place feedback and display feedback summaries separately from external ratings.
- Save favorite places and organize places into collections.
- Expose an internal AI-ready place candidate API that returns facts only.

## Acceptance Criteria

- `/explore` renders a real VietMap map using the public tile key.
- Users can zoom and pan the map.
- Desktop layout shows a place list on the left and map on the right.
- Searching `coffee` returns real Da Nang places from VietMap through the gateway and place-service.
- Returned places render as list cards and map markers.
- Card hover/click highlights the marker and centers the map.
- Marker click highlights the card and shows a rich popup.
- Marker/card hover only changes visual highlight and does not fetch provider data.
- One shared selected-place state drives card and marker selection.
- Hover/enrichment calls are cached and are not repeated on every mouse enter/leave.
- At least 20 real Da Nang places are tested and documented in a verification table.
- Trip CRUD and Itinerary CRUD remain unimplemented until the POC is complete and approved.
- Place IDs are TripSense-owned; VietMap, OpenTripMap, and Wikimedia IDs are external references only.
- Provider responses are normalized before reaching frontend code.
- OpenTripMap/Wikimedia failures do not break VietMap search, maps, place detail, routing, trips, or itineraries.
- External ratings/photos/tips are not fabricated and are omitted when unavailable.
- Client-side search uses debounce and request cancellation.
- Provider access has server-side caching, timeout budgets, and rate limiting.
- Secrets are never exposed to browser code, logs, commits, or client responses.
- Major surfaces have loading, empty, and error states.
- Critical business logic and API validation are covered by tests using provider mocks.

## Business Rules

- Implement approved Milestone 0 first: VietMap map, real VietMap search, markers, list/map sync, click popup, OpenTripMap/Wikimedia matching/enrichment, provider coverage report.
- After Milestone 0, stop and wait for approval before Trip CRUD.
- Public backend traffic goes through API Gateway.
- Durable domain data is owned by backend services, not the Next.js web app.
- Next.js may provide UI and optional thin BFF/proxy handlers, but must not own platform persistence.
- `ownerId` and `userId` must come from a trusted authentication context, never from arbitrary browser input.
- `Trip.startDate` must be less than or equal to `Trip.endDate`.
- `ItineraryItem.placeId` may be null for custom activities.
- Do not fabricate external photos, descriptions, tourism metadata, Wikipedia references, or Wikidata references.
- Do not interpret OpenTripMap `rate` as a TripSense or user star rating.
- AI recommendation, LLM intent parsing, AI itinerary generation, AI re-optimization, and AI ranking are out of scope.

## Edge Cases

- Invalid coordinates, route not found, provider timeout, quota exceeded, provider unavailable, or missing provider configuration.
- Place detail with no photo, description, tourism metadata, or enrichment match.
- User denies location permission.
- OpenTripMap API key missing.
- OpenTripMap or Wikimedia authentication, quota, entitlement, timeout, or response-shape errors.
- VietMap authentication, quota, entitlement, timeout, or response-shape errors.

## Out Of Scope

- AI recommendation engine.
- AI-generated itineraries.
- Trip CRUD during Milestone 0.
- Itinerary CRUD during Milestone 0.
- Weather-based AI decisions.
- Automatic recommendation scoring formula.
- Public access to internal candidate APIs.
- Authoritative Prisma persistence in the Next.js app.

## Open Questions

- Which VietMap provider endpoints and fields are available under the current key entitlement?
- Does OpenTripMap plus Wikimedia provide enough Da Nang image/description coverage to keep it as the enrichment stack?
- For the post-POC MVP, should itinerary ownership be a separate `itinerary-service`, or should Trip + Itinerary be temporarily combined into a single `trip-service` planning boundary?
- What temporary authentication mechanism should provide trusted `ownerId` and `userId` before `identity-service` exists?
- Should trip deletion be hard delete or archive-by-default?
- Is the first geographic scope Vietnam-wide, Da Nang-first, or provider-supported global search?
- Should `PlaceIntelligence` be owned by `place-service` initially or deferred to `context-service`?
- Should favorites/collections wait for `user-service`, or should an approved saved-place boundary be created first?
