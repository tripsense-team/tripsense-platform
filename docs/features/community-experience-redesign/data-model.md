# Data Model

## Ownership

`trip-service` owns canonical Trip/Day/Item data and a monotonic publication revision. `social-service` owns the Community publication, its feed projection and immutable public snapshots. No cross-service foreign keys or database reads are allowed.

## Social schema

Keep `social_posts` and `social_trip_shares` as the post/publication head. Existing safe top-level columns remain the feed summary projection and must describe only the published subset.

Add to `social_trip_shares`:

```text
current_snapshot_version INTEGER NULL
detail_availability VARCHAR(...) NOT NULL
date_precision VARCHAR(...) NOT NULL
date_label VARCHAR(...) NULL
```

When exact dates are not permitted, `start_date` and `end_date` are `NULL`; Social must not persist hidden exact dates.

Add an append-only table:

```sql
CREATE TABLE social_trip_share_snapshots (
    post_id UUID NOT NULL,
    snapshot_version INTEGER NOT NULL,
    schema_version SMALLINT NOT NULL,
    source_publication_revision BIGINT NOT NULL,
    payload_json JSONB NOT NULL,
    payload_sha256 VARCHAR(64) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    refresh_idempotency_key UUID,
    PRIMARY KEY (post_id, snapshot_version),
    FOREIGN KEY (post_id) REFERENCES social_trip_shares(post_id) ON DELETE CASCADE,
    CHECK (snapshot_version > 0),
    CHECK (schema_version > 0),
    CHECK (jsonb_typeof(payload_json) = 'object')
);
```

Add a deferred composite foreign key from `(post_id,current_snapshot_version)` to the snapshot primary key. A nullable pointer represents an old summary-only share. Add a partial unique index for `(post_id,refresh_idempotency_key)` when the key is not null.

Do not add a JSON GIN index: the application reads one bounded aggregate as a whole and has no approved query inside itinerary JSON.

## Trip publication revision

Add a `publication_revision BIGINT NOT NULL DEFAULT 0` owned by `trip-service`. Increment it in the same local transaction for every mutation that can change the public projection, including day/item changes. `Trip.version` alone is insufficient because current child mutations do not reliably increment it.

The final fingerprint is SHA-256 over canonical serialization of the safe projection, including ordering and disclosure precision. It is computed by Trip, not from arbitrary client JSON.

## Legacy migration

Use expand–migrate–contract in separate Flyway versions:

1. Inventory active/removed rows with non-empty `itinerary_json`; document backup retention and expected summary-only degradation.
2. Deploy readers that tolerate no current snapshot and never deserialize old JSON for viewers.
3. Create the snapshot table and nullable head pointer.
4. Deploy the safe writer; drain every old writer node. New writes leave legacy JSON empty.
5. Irreversibly clear `itinerary_json` and unproven legacy highlights for active, removed and deleted shares. Do not copy old raw itinerary into V1.
6. Add/validate a check that legacy JSON remains null/empty, then verify forbidden-key and API queries.
7. Remove entity mappings and drop the legacy column only after the compatibility window.

Old shares keep safe summary fields and `detail_availability=SUMMARY_ONLY_REPUBLISH_REQUIRED`. The owner uses the new preview/republish flow to create V1 while preserving the original post, likes and comments.

Rollback may return only to a safety-patched binary that cannot write raw itinerary JSON. Scrubbed private data is never restored.

## Flyway migration convention

Applied versioned migrations are immutable: do not rename, move, delete or edit them after any environment has recorded them in `flyway_schema_history`. The former local-only Social entries `V5`–`V8` were deliberately replaced before promotion with the timestamped `V202609221419`–`V202609221422` series. All other applied migrations, including `V202609221210` in Trip, retain their filenames.

Every new Community migration uses the timestamp format `VyyyyMMddHHmm__short_description.sql` (for example, `V202609221430__add_snapshot_retention.sql`). Before committing it:

- Use `IF EXISTS` / `IF NOT EXISTS` for PostgreSQL operations that support them, such as tables, columns and indexes.
- For constraints, which PostgreSQL cannot add with `IF NOT EXISTS`, use a guarded `DO $$ ... $$` block that checks `pg_constraint` before adding the exact named constraint.
- For type or data transformations, query the catalog first and alter only when the current state needs the change; do not silently conceal an incompatible schema.
- Never edit an applied migration merely to add guards. Add a new forward-only timestamped migration instead.

## Transaction boundaries

- Trip preview/projection is a read operation in Trip and completes before a Social write transaction opens.
- Initial publish atomically inserts post, publication head, snapshot V1, safe summary and current pointer.
- Refresh obtains a safe snapshot first, then locks the head, rechecks owner/state/idempotency, inserts V(n+1), updates summary/pointer and commits.
- Caption and visibility changes do not create a snapshot version.
- There is no distributed transaction.

## Place compatibility blocker

`place-service` exposes opaque string IDs, while Trip currently persists `destination_place_id` and itinerary `place_id` as UUID. Do not add new Social UUID place columns. V1 stores safe display labels only.

Map, destination discovery and weather require a separate compatibility plan: introduce opaque string references in Trip, dual-read/write during migration, resolve through application/API jobs rather than Flyway, and add a public-POI projection/batch contract. Until then, no Place ID, exact address or coordinates enter V1.

## Retention

Superseded snapshots remain immutable but need an explicit retention policy before refresh history is broadly enabled. Post removal hides all versions immediately. Hard purge timing follows the approved moderation/privacy retention policy; moderator evidence may only use already-published snapshots, never the source trip.
