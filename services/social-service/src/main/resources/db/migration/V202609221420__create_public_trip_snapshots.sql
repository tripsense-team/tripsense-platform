ALTER TABLE social_trip_shares
    ADD COLUMN IF NOT EXISTS current_snapshot_version INTEGER NULL,
    ADD COLUMN IF NOT EXISTS detail_availability VARCHAR(48) NOT NULL DEFAULT 'SUMMARY_ONLY_REPUBLISH_REQUIRED',
    ADD COLUMN IF NOT EXISTS date_precision VARCHAR(24) NOT NULL DEFAULT 'DAY_NUMBER_ONLY',
    ADD COLUMN IF NOT EXISTS publication_revision BIGINT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_trip_shares_snapshot_version_positive_chk'
          AND conrelid = 'social_trip_shares'::regclass
    ) THEN
        ALTER TABLE social_trip_shares
            ADD CONSTRAINT social_trip_shares_snapshot_version_positive_chk
            CHECK (current_snapshot_version IS NULL OR current_snapshot_version > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_trip_shares_detail_availability_chk'
          AND conrelid = 'social_trip_shares'::regclass
    ) THEN
        ALTER TABLE social_trip_shares
            ADD CONSTRAINT social_trip_shares_detail_availability_chk
            CHECK (detail_availability IN ('PUBLIC_SNAPSHOT', 'SUMMARY_ONLY_REPUBLISH_REQUIRED'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_trip_shares_date_precision_chk'
          AND conrelid = 'social_trip_shares'::regclass
    ) THEN
        ALTER TABLE social_trip_shares
            ADD CONSTRAINT social_trip_shares_date_precision_chk
            CHECK (date_precision IN ('EXACT', 'DAY_NUMBER_ONLY'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS social_trip_share_snapshots (
    post_id UUID NOT NULL,
    snapshot_version INTEGER NOT NULL,
    schema_version SMALLINT NOT NULL,
    source_publication_revision BIGINT NOT NULL,
    payload_json JSONB NOT NULL,
    payload_sha256 VARCHAR(64) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    refresh_idempotency_key UUID NULL,
    PRIMARY KEY (post_id, snapshot_version),
    CONSTRAINT social_trip_share_snapshots_post_fk
        FOREIGN KEY (post_id) REFERENCES social_trip_shares(post_id) ON DELETE CASCADE,
    CONSTRAINT social_trip_share_snapshots_version_positive_chk CHECK (snapshot_version > 0),
    CONSTRAINT social_trip_share_snapshots_schema_positive_chk CHECK (schema_version > 0),
    CONSTRAINT social_trip_share_snapshots_payload_object_chk CHECK (jsonb_typeof(payload_json) = 'object')
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'social_trip_shares_current_snapshot_fk'
          AND conrelid = 'social_trip_shares'::regclass
    ) THEN
        ALTER TABLE social_trip_shares
            ADD CONSTRAINT social_trip_shares_current_snapshot_fk
            FOREIGN KEY (post_id, current_snapshot_version)
            REFERENCES social_trip_share_snapshots(post_id, snapshot_version)
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS social_trip_share_snapshots_refresh_key_idx
    ON social_trip_share_snapshots (post_id, refresh_idempotency_key)
    WHERE refresh_idempotency_key IS NOT NULL;
