CREATE TABLE IF NOT EXISTS trip_community_import_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    idempotency_key UUID NOT NULL,
    request_fingerprint VARCHAR(64) NOT NULL,
    source_post_id UUID NOT NULL,
    source_snapshot_sha256 VARCHAR(64) NOT NULL,
    destination_trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    imported_day_count INTEGER NOT NULL,
    imported_item_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_trip_community_import_actor_key UNIQUE (user_id, idempotency_key),
    CONSTRAINT ck_trip_community_import_days CHECK (imported_day_count > 0),
    CONSTRAINT ck_trip_community_import_items CHECK (imported_item_count >= 0)
);

CREATE INDEX IF NOT EXISTS trip_community_import_source_idx
    ON trip_community_import_receipts (source_post_id, created_at DESC);
