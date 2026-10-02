CREATE TABLE trip_places (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    place_ref VARCHAR(200) NOT NULL,
    place_name_snapshot VARCHAR(255) NOT NULL,
    place_address_snapshot VARCHAR(512),
    lat_snapshot NUMERIC(10, 7),
    lng_snapshot NUMERIC(10, 7),
    added_by_user_id UUID NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_trip_places_trip_ref UNIQUE (trip_id, place_ref)
);

CREATE INDEX idx_trip_places_trip_created ON trip_places(trip_id, created_at DESC);
CREATE INDEX idx_trip_places_ref ON trip_places(place_ref);
