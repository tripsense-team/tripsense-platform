# Security

## Publication model

```text
Private itinerary
-> deterministic server allowlist
-> owner-visible preview
-> fingerprint-bound explicit consent
-> immutable versioned public snapshot
-> authorized summary/detail delivery
```

Hiding fields in React is not a privacy control. Trip produces the allowlist, Social persists only that public projection, and every read is authorized server-side.

## Preview and consent

- Preview requires the authenticated trip owner.
- It returns the exact safe projection, `PUBLIC_TRIP_V1` consent version, warnings and a server-computed fingerprint.
- Publish/refresh sends the fingerprint, not snapshot fields. Trip rebuilds canonical output and mismatch returns `409 PUBLICATION_PREVIEW_STALE`.
- The fingerprint covers every public field, ordering, disclosure precision and cover-media identity.
- Logs may contain a shortened correlation hash but never the snapshot JSON, bearer token, caption or private item names.

V1 publishes every server-eligible activity, so no client item-selection IDs are accepted. A future selection feature requires separate ownership/membership validation and approval.

## Safe defaults

- No implicit `PUBLIC`; the user must choose visibility.
- Future/ongoing trips omit exact dates and times. Ended trips may include them because the exact preview makes the disclosure explicit.
- `NOTE` is excluded. Accommodation and transport are generic. Notes, exact address, arbitrary coordinates, booking, participant, budget and contact data are never publishable options.
- Traveler count is excluded.
- Titles/place labels render as plain text, never HTML.
- Viewer-side Place search must not reconstruct redacted locations.
- Source trip ID and navigation are owner-only.

## Authorization

- Anonymous users cannot receive typed detailed shares.
- Signed-in `PUBLIC` is discoverable after Phase D; `UNLISTED` is signed-in direct-link only; `PRIVATE` is owner-only.
- Link possession does not bypass authorization.
- Generic admin role does not imply trip ownership. Moderator evidence/actions use dedicated audited endpoints.
- Detail is authorized before snapshot JSON is loaded.
- Generic post detail cannot return detailed data that the typed endpoint would deny.
- Comments, reactions, future save and report operations reuse the same visibility decision.
- Visibility downgrade/removal invalidates viewer caches. Private/unlisted responses use private/no-store caching unless a viewer-aware cache is designed.

## Old data repair

- Stop all raw writers before cleanup.
- Clear old JSON for active, removed and deleted shares and verify with database queries and API forbidden-key tests.
- Review caches, logs, fixtures and backup retention; Flyway cannot erase old backups.
- Never auto-convert old raw JSON into a consented V1 snapshot.
- Rollback cannot restore unsafe JSON.

## Media

- HTTPS and approved provider hosts only; verify the asset identity/ownership, not only a URL prefix.
- Image MIME sniffing, byte/pixel limits, no SVG, and EXIF/GPS removal are required.
- Preview and final projection cover identity are fingerprint-bound; replacement causes stale preview.
- Failed publish/upload has an orphan-cleanup path and never accepts arbitrary remote-fetch URLs.

## Abuse controls

Apply actor and trusted-client-IP limits separately for preview, publish/republish, visibility changes, feed/detail reads, media signatures, comments/reactions and reports. Enforce the limits in [Requirements](requirements.md), bind idempotency keys to request fingerprints, and map duplicate races to `409`, not `500`.

## Public readiness

Detailed `PUBLIC` sharing is feature-gated until minimum reporting and audited moderator removal are available. Reporting targets the post, not private itinerary items; moderator evidence is the already-published snapshot. Reporter identity remains private, and removed content disappears from feed and later discovery.

## Required security tests

- Preview/publish with valid, expired, malformed and wrong-token-type credentials.
- Guessed trip/post IDs, foreign ownership and stale fingerprint.
- PUBLIC/UNLISTED/PRIVATE across anonymous, owner, signed-in other and moderator.
- Visibility changed during read, removed share and summary-only legacy share.
- Maximum/over-limit snapshots, malformed downstream DTO and concurrent publication/refresh.
- Serialization tests fail when any forbidden field appears.
- Gateway-routed `401/404/409/422/429/503` behavior.
- No feed hydration of detail JSON and no per-card Trip/Place/User calls.

Detailed publication is no-go until preview output exactly matches the persisted/public response in an integration test.
