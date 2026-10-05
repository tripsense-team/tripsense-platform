# Data Model

## Owning Service

`social-service` owns the persisted shared-trip social representation. `trip-service` owns canonical trip tables and exposes safe DTOs only.

## Schema Changes

Add a post type to `social_posts`:

```sql
ALTER TABLE social_posts
ADD COLUMN post_type VARCHAR(32) NOT NULL DEFAULT 'STANDARD';
```

Add a local extension table:

```sql
CREATE TABLE social_trip_shares (
    post_id UUID PRIMARY KEY REFERENCES social_posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    source_trip_id UUID NOT NULL,
    visibility VARCHAR(32) NOT NULL,
    trip_name VARCHAR(255) NOT NULL,
    destination_name VARCHAR(255),
    start_date DATE,
    end_date DATE,
    cover_image_url TEXT,
    traveler_count INTEGER,
    day_count INTEGER,
    itinerary_item_count INTEGER,
    highlights_json JSONB,
    snapshot_created_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    removed_at TIMESTAMPTZ,
    CHECK (visibility IN ('PUBLIC', 'UNLISTED', 'PRIVATE')),
    CHECK (traveler_count IS NULL OR traveler_count >= 0),
    CHECK (day_count IS NULL OR day_count >= 0),
    CHECK (itinerary_item_count IS NULL OR itinerary_item_count >= 0),
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
```

`source_trip_id` is an external ID, not a foreign key.
`author_id` is duplicated intentionally for the active-share uniqueness constraint and must match the parent `social_posts.author_id` in service-level tests.

## Migrations

- Add `post_type` with default `STANDARD` for existing rows.
- Add `social_trip_shares`.
- Backfill existing rows as `STANDARD` and verify old posts are unaffected.
- Add repository filtering so standard posts remain visible and trip-share posts respect visibility.
- If production table size grows, use a safer multi-step migration: nullable column, backfill, default, then `NOT NULL`.

## Indexes

```sql
CREATE INDEX social_posts_type_feed_active_idx
ON social_posts (post_type, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX social_trip_shares_source_trip_idx
ON social_trip_shares (source_trip_id);

CREATE INDEX social_trip_shares_public_feed_idx
ON social_trip_shares (created_at DESC, post_id)
WHERE visibility = 'PUBLIC' AND removed_at IS NULL;

CREATE UNIQUE INDEX social_trip_shares_author_trip_active_idx
ON social_trip_shares (author_id, source_trip_id)
WHERE removed_at IS NULL;
```

## Transaction Boundaries

Create flow:

1. `social-service` calls `trip-service` for the share snapshot before opening a local DB transaction.
2. In one local transaction, insert the `social_posts` row and the `social_trip_shares` row.
3. On idempotent replay, return the existing post for the same author/key.
4. On conflicting replay payload, return `409 IDEMPOTENCY_KEY_CONFLICT`.

Visibility updates and removals are local `social-service` transactions.

## Data Consistency

The snapshot is eventually stale by design in MVP. The shared post remains renderable even if `trip-service` is temporarily unavailable after creation. Future trip events may refresh snapshots or hide unavailable shares.

## Migration Risks

- Feed queries must filter `PUBLIC` trip shares in repositories, not only in UI.
- Duplicate `author_id` in `social_trip_shares` must match the parent post author.
- Orphaned `source_trip_id` values are possible after trip deletion and must be handled by UI/access state.
- JSON highlights must stay small and preview-only.
- Remove operations must set both `social_posts.deleted_at` and `social_trip_shares.removed_at` in one transaction.

## Prohibited Patterns Check

- No cross-service JPA relationships.
- No direct access to another service database.
- No reuse of `trip-service` entities in `social-service`.
