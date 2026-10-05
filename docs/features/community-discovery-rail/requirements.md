# Requirements

## User goal

Make Community feel as complete as `test.html`, but every card and interaction must use real, privacy-safe backend data.

## Use cases

- A signed-in owner chooses one of their trips, previews it, and publishes it without losing a caption on recoverable failure.
- A member sees an email-free author identity, follows or unfollows an eligible creator, and receives a bounded creator suggestion list.
- A member sees a current-weather card for an explicitly selected public destination, including freshness and an unavailable state.
- A signed-in member sees a bounded, privacy-safe list headed **“Điểm đến được cộng đồng chia sẻ nhiều hôm nay”**. It comes from qualifying public shares, not anyone's real-time location or travel.

## Acceptance criteria

- My Trips distinguishes list-load failure from public-preview failure; both offer retry and retain the draft.
- The picker supports all eligible trips, not a silent first-20 truncation; URL `tripId` preselects only an owned returned trip.
- Public creator data contains only an automatically available Community display name and avatar, never email, location, social links or private profile fields.
- Follow persists across reload, rejects self/duplicates safely, and never changes `PUBLIC`/`UNLISTED`/`PRIVATE` post visibility.
- Suggestions exclude self, followed, inactive, blocked and non-public accounts; the initial ordering is deterministic and bounded.
- Weather has a selected canonical destination, provider/fetched/expiry metadata and `FRESH`, `STALE` or `UNAVAILABLE` state. A provider failure never fails the feed.
- Creator discovery excludes self, already-followed and unavailable profiles; `Xem thêm` is cursor-paginated with a deterministic order that prioritizes follower count, then latest eligible public activity, then user ID.
- The destination rail returns only canonical public destinations with enough distinct public authors for the configured minimum cohort. It exposes no contributor, trip, source-place ID, coordinate or low-volume count.
- “Today” is `Asia/Ho_Chi_Minh` for the initial aggregate and uses active, moderated-safe `PUBLIC` trip shares created during that business day. The UI does not show an exact count in V1.

## Business rules

- Reuse the existing authenticated owner-scoped `GET /api/trips` unless P0 evidence proves a dedicated eligible-trip DTO is necessary.
- `trip-service` remains the authority for owner validation and publication eligibility.
- `user-service` owns the automatically available Community display name and avatar; `social-service` owns following, follower counts and suggestion eligibility.
- Follow does not confer any access right to posts or source trips.
- Weather is only for a user-selected canonical public destination; it must not infer a location from a private/future trip or free-text post.
- `social-service` may aggregate qualifying public-share destinations only after the canonical public-destination contract exists. It uses distinct authors, a fixed minimum cohort of 5, stable ranking and daily reconciliation; publication is never treated as a confirmed arrival or live visit.

## Out of scope

- Personalized/AI-ranked recommendations, follower notifications, direct messages, map restoration, saving posts, browser weather keys, device location and changes to Trip Share snapshot fields.
- Actual visits, arrivals, check-ins, live location and “đang đi đến” ranking. These require explicit opt-in, a separately approved Trip event contract and a Context-owned aggregate.

## Open questions

1. Should the weather selector offer only approved TripSense Places, or an approved city-level destination catalogue too?
2. Which public profile fields are product-approved: display name and avatar only (recommended), or optional short bio as well?
3. Does the product require a public creator page in this slice, or only cards in the Community rail?
4. Legacy accounts without an explicit display name render as a generated non-email Community handle until they set one.
5. Is the product-approved minimum cohort exactly five distinct authors, or should it be higher before launch?
