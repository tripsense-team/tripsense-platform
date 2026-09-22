ALTER TABLE trips ADD COLUMN IF NOT EXISTS destination_place_ref VARCHAR(200);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS aggregate_revision BIGINT NOT NULL DEFAULT 0;
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS place_ref VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_itinerary_items_place_ref ON itinerary_items(place_ref);

CREATE TABLE IF NOT EXISTS itinerary_commit_receipts (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    proposal_id VARCHAR(36) NOT NULL,
    proposal_hash VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(120) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_itinerary_commit_owner_key UNIQUE(owner_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_itinerary_commit_trip_created ON itinerary_commit_receipts(trip_id, created_at DESC);
