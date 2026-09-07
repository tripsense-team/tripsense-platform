ALTER TABLE social_posts
    ADD COLUMN post_type VARCHAR(32) NOT NULL DEFAULT 'STANDARD';

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
