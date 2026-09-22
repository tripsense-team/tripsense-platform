# `test.html` Production Mapping

## Verdict

`test.html` is the target composition and visual direction, not a promise that every demo control ships in the first release. Production should be recognizably the same page while every visible action is backed by real persisted behavior.

## Ship in the Community shell

| Prototype block              | Production behavior                                                          |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Hero and “Bảng tin mới nhất” | Static Community identity and truthful newest-feed label; no realtime claim. |
| 8/4 layout                   | Feed plus sticky desktop rail; compact tablet blocks; single-column mobile.  |
| Dual composer                | Real standard update and typed Trip Share publication preview.               |
| All / Updates / Shared trips | Server-side post-type filter before pagination.                              |
| Standard card                | Author snapshot, body clamp, media mosaic, reactions/comments/link/menu.     |
| Trip card                    | Caption plus bounded `PublicTripSummary`, highlights and **Xem chia sẻ**.    |
| Trip detail                  | Separate typed response with day-by-day `PublicTripSnapshot V1`.             |
| Load more                    | Existing server pagination.                                                  |
| Guidelines                   | Static, accurate Community rules.                                            |

The prototype uses a headline in standard cards, but the current post model has no title. V1 uses the clamped post body rather than adding a speculative title column.

## Render only after its feature ships

| Prototype block     | Required feature                                                             |
| ------------------- | ---------------------------------------------------------------------------- |
| Follow buttons      | Public profile plus Follow and Following Feed.                               |
| “Lưu cảm hứng”      | Private post bookmark and saved list; never itinerary clone.                 |
| Weather card        | Provider-backed destination weather, cache, timestamps and failure state.    |
| Suggested creators  | Safe public profiles, Follow, moderation and deterministic suggestion rules. |
| Recent destinations | Canonical opaque destination identity and eligible public Trip Shares.       |
| Report menu         | Minimum report/moderation in Phase D.                                        |

No production button may retain `data-demo-action`, local-only fake persistence, hardcoded weather, sample metrics or fabricated ranking.

## Detailed itinerary adaptation

- Feed deliberately keeps the compact trip artifact shown in the prototype.
- **Xem chia sẻ** opens the public timeline; it never opens another user's `/trips/{sourceTripId}`.
- Existing notes, addresses, coordinates and internal IDs are not part of the public detail contract.
- V1 has no route map. The map returns in a separately approved slice using canonical opaque Place IDs and a safe public-POI batch projection.
- Old shares show a clear summary-only state; owners receive **Xem trước và công bố lại**, not a misleading empty itinerary.

## Visual implementation rules

- Rebuild with repository components, Lucide icons and semantic theme tokens; do not copy external prototype assets, CDN styling or hardcoded sample data.
- Preserve real aspect ratios, lazy/responsive images and layout reservation.
- Comments stay in detail rather than expanding under every feed card.
- Unsupported rail sections are replaced by guidelines/sharing tips so the desktop layout remains balanced without fake capabilities.

## Accessibility

Use semantic tabs/buttons, `aria-pressed` only for real persistent toggles, labelled icon controls, visible focus, approximately 44px targets, dialog focus trap/return, `aria-live` feedback, meaningful image alt text, non-color state cues and reduced-motion support.
