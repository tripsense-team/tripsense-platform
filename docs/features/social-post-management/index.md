# Social Post Management

**STATUS: DONE**

Approved by the human on 2026-09-05 and implemented. Deployment still requires the documented PostgreSQL, JWT, and Cloudinary environment variables.

The existing Community UI is the contract source. This plan adds a real Social Post backend and removes automatic mock selection without redesigning the UI.

## Scope

- Feed, post detail, create/delete post, post likes, flat comment/reply tree, comment likes, user-filtered posts, and Cloudinary direct upload.
- Real API loading, empty, error, not-found, unauthorized, and forbidden states.
- No repost/share persistence; sharing remains the existing client-side URL share.

## Approval blockers

1. Approve a new, independently deployed `social-service` with its own PostgreSQL database and gateway route.
2. Select the authoritative source for required author `name` (and optional avatar): user-profile API, profile event/read model, or an explicitly accepted immutable snapshot/degraded email display.
3. Confirm public versus authenticated-only reads for feed, detail, and comments.
4. Provision Cloudinary credentials and approve upload restrictions, verification, and orphan-cleanup policy.
5. Confirm comment retrieval/deletion policy: proposed v1 is complete flat thread retrieval, unlimited stored depth, visual clamp only, and future tombstone deletion.

## Documents

- [Requirements](requirements.md)
- [Architecture](architecture.md)
- [API](api.md)
- [Data model](data-model.md)
- [Security](security.md)
- [Decisions and review findings](decisions.md)
- [Implementation plan](implementation-plan.md)
- [Test plan](test-plan.md)
