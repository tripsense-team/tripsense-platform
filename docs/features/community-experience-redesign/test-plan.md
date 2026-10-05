# Test Plan

## Phase A — containment

- Inventory and migration tests cover active, removed, deleted, empty, malformed and oversized legacy JSON.
- Post-migration queries prove old raw JSON is empty and cannot be reintroduced by the supported rollback binary.
- API serialization fails on forbidden field names such as notes, address, latitude/longitude, source day/item IDs, booking, participant, budget and status.
- Anonymous/owner/signed-in-other/moderator matrix covers PUBLIC, UNLISTED, PRIVATE and removed shares across feed, detail, comments and reactions.
- Gateway-routed Social-to-Trip connectivity, timeout, `401/404/429/503` and production rate-limit behavior.

## Phase B — Community shell

- Component tests for hero, dual composer, standard/trip cards, media mosaic, clamping, filters, load-more and rail guidance.
- Repository/integration tests prove type filtering occurs before pagination/count and preserves deterministic ordering.
- Existing text-only, image-only, mixed, legacy-metadata and typed summary cards remain supported.
- Like rollback, comment/reply, share link, deletion, modal/direct route/back navigation and author pages do not regress.
- `/chat` compatibility redirect and preselected-trip composer entry work.
- Network assertions prove no per-card profile, Trip or Place requests and no snapshot JSON load on feed.

## Phase C — detailed publication

- Snapshot mapper golden/contract tests cover every V1 allowed field and fail on every forbidden field.
- Ended versus future/ongoing trips enforce date/time precision deterministically.
- HOTEL, FLIGHT, TRANSFER and NOTE redaction/exclusion behavior is tested.
- Preview and publish canonical fingerprint match; any relevant source/cover change returns `409 PUBLICATION_PREVIEW_STALE`.
- Maximum 60 days, 50 items/day, 300 total items, three highlights, field lengths and 512 KiB payload are enforced.
- Initial publish and concurrent duplicate create map to deterministic success/`409`, never partial rows or `500`.
- Refresh appends one immutable version and atomically switches the pointer; caption/visibility changes do not create versions.
- Summary-only legacy share republish preserves post ID, likes and comments.
- Typed detail authorizes before JSON load; generic detail never leaks the snapshot.
- Source edit/archive/delete does not silently mutate/delete the publication.
- Web preview displays the exact final public fields and the timeline handles long/empty/redacted items accessibly.

## Phase D — reporting

- Report auth, allowed reasons, bounded description, dedup, throttling and reporter privacy.
- Moderator-only read/action and immutable audit trail.
- Removed content disappears from feed and direct viewer detail while remaining available only through the approved audit path.
- Detailed PUBLIC is disabled before the gate and available to signed-in members after it.

## Responsive/accessibility/manual

- Desktop >=1024: two columns/sticky rail; tablet: compact rail; mobile <768: one column, stacked composer and full-screen detail modal behavior.
- Keyboard-only navigation, visible focus, focus trap/return, semantic tabs/buttons, live announcements, meaningful alt text and reduced motion.
- Initial skeleton, empty feed, filtered empty, loading more, recoverable upload/publish error with retained draft, stale preview, duplicate share, unavailable/private post, missing cover and summary-only legacy state.

## Release rule

No phase is complete with controller/unit mocks alone. Its migration/integration path must pass through Gateway with representative persisted data.
