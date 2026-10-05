# Requirements

## User goal

Make Community look and behave like the approved `test.html` direction while preserving real social interactions and making detailed itinerary sharing a safe, intentional publication workflow.

## Core use cases

- Browse a newest-first feed and distinguish a standard update from a shared itinerary immediately.
- Create a text/photo update without entering the Trip Share flow.
- Select an owned trip, preview the exact public representation, choose visibility explicitly, and publish it.
- Open a trip post and read the published itinerary in ordered days and activities without obtaining access to the private source trip.
- Like, comment, reply, copy a link, visit an author, edit permitted trip-share metadata, and delete an owned post through the existing routes.
- For an old summary-only Trip Share, the owner can preview and republish a safe detailed snapshot without losing the post, likes or comments.

## `PublicTripSnapshot V1` field policy

This table is normative; implementation must not make new disclosure decisions ad hoc.

| Field                                              | V1 behavior                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Trip/day/item internal IDs                         | Excluded from viewer DTOs. Snapshot-local order is used for rendering.                                |
| Source trip ID                                     | Stored by Social for owner management; never returned to non-owner viewers.                           |
| Trip name, destination label, cover                | Included after preview. Cover must pass the approved media policy.                                    |
| Day number and item order                          | Included.                                                                                             |
| Exact day dates                                    | Included only when the trip has ended. Future/ongoing publications use `Day 1`, `Day 2`, etc.         |
| Activity title and type                            | Included as plain text for safe types `PLACE`, `MEAL`, and `ACTIVITY`.                                |
| Item start/end time and duration                   | Included only for ended trips; future/ongoing publications omit exact time.                           |
| Public place name/locality                         | Included as a display snapshot when available.                                                        |
| Place ID, exact address, raw latitude/longitude    | Excluded from V1. Route map is a dependent slice after the Place ID/public-POI contract is corrected. |
| `HOTEL`                                            | Rendered as the generic label `Nơi lưu trú`; hotel name, address and coordinates are excluded.        |
| `FLIGHT` / `TRANSFER`                              | Rendered as generic movement entries; booking, carrier, pickup and route details are excluded.        |
| `NOTE`                                             | Excluded from V1.                                                                                     |
| Private notes                                      | Always excluded; never copied automatically into public prose.                                        |
| Booking, payment, budget, participant/contact data | Always excluded.                                                                                      |
| Internal item/trip status and sort fields          | Excluded.                                                                                             |
| Traveler count                                     | Excluded from V1.                                                                                     |
| Highlights                                         | Up to three in feed, derived only from the published safe subset.                                     |

V1 includes all server-eligible safe activities in their canonical order. Item-by-item selection and an owner-authored `publicDescription` are deferred to avoid a larger consent and digest surface. The preview remains mandatory.

For V1, an **ended trip** means its canonical `endDate` is strictly before the server's current local date. Every other trip is treated as future/ongoing for date/time disclosure, independent of the current `TripStatus` enum.

## Product rules

- A Trip Share is a frozen publication. Editing or deleting/archiving the source trip does not silently change or delete its Community post.
- Caption and visibility may change without creating a snapshot version.
- Explicit republish/refresh creates a new immutable snapshot version and atomically makes it current.
- The preview is produced deterministically by `trip-service` and bound to publication with a server-computed fingerprint. A changed trip produces `409 PUBLICATION_PREVIEW_STALE`.
- The browser never submits itinerary titles, place data, dates, times or snapshot JSON as authoritative data.
- `PUBLIC` detailed shares are visible to signed-in TripSense members after Phase D. `UNLISTED` requires sign-in and the direct link. `PRIVATE` is owner-only.
- Until Phase D report/moderation is ready, detailed publication may be feature-gated to `PRIVATE`/`UNLISTED` while summary-only public posts remain compatible.
- Follow never grants access to `UNLISTED` or `PRIVATE` content. Save later means a private post bookmark, not trip cloning.

## UI acceptance criteria

- Desktop is recognizably the `test.html` 8/4 composition with a sticky contextual rail; tablet compacts the rail; mobile is a single usable column.
- The composer exposes exactly two primary intents: **Chia sẻ cập nhật** and **Chia sẻ chuyến đi**.
- Feed filters are applied by the server before pagination; an empty filtered page is truthful.
- Standard and trip cards have distinct visual language. Trip feed cards show only bounded summary/highlights and a **Xem chia sẻ** CTA.
- Typed detail loads the current public snapshot once and renders an accessible day-by-day timeline. It does not reconstruct missing places through client search.
- Every visible action has a real outcome, pending/error state and refresh persistence. Unsupported prototype controls are absent, not disabled or toast-only.
- Existing modal/direct-detail/back behavior, author routes, media, likes, comments/replies, link sharing, deletion and pagination continue to work.
- Loading, initial empty, filtered empty, unavailable, unauthenticated, upload failure, stale preview, duplicate share and summary-only legacy states are distinct.
- Approximately 44px touch targets, visible focus, semantic buttons/tabs, focus return, `aria-live`, meaningful alt text and reduced motion are supported.

## Concrete limits

- Standard content/caption: 5,000 characters; images: 10.
- Public snapshot: at most 60 days, 300 total published items, 50 items per day, three feed highlights and 512 KiB serialized JSON.
- Public item title: 200 characters; public place label: 255 characters; cover URL: 2,048 characters.
- Feed default size remains 10 and must respect the current backend maximum.
- Social-to-Trip calls use bounded connection/read timeouts; proposed initial values are 2 seconds connect and 5 seconds read, verified in deployment tests.

## Out of scope for this approval

- Item-by-item publication selection, public descriptions, snapshot-history UI and itinerary cloning.
- V1 route map and coordinates until canonical opaque Place IDs and public-POI classification are approved.
- Follow, Following Feed, Save, Weather, Suggested Creators, Recent Destinations and notifications.
- Video, check-in, online status, verified badges, ranking/trending, direct messages and AI-personalized feeds.
