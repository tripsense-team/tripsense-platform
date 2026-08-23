CREATE TABLE trips (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL,
    name VARCHAR(160) NOT NULL,
    destination_name VARCHAR(255) NOT NULL,
    destination_place_id UUID,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL,
    traveler_count INTEGER,
    budget_amount NUMERIC(14, 2),
    budget_currency VARCHAR(3),
    notes TEXT,
    cover_image_url VARCHAR(1024),
    version BIGINT NOT NULL DEFAULT 0,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_trips_date_range CHECK (start_date <= end_date),
    CONSTRAINT ck_trips_status CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'ARCHIVED')),
    CONSTRAINT ck_trips_traveler_count CHECK (traveler_count IS NULL OR traveler_count > 0)
);

CREATE TABLE itinerary_days (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_date DATE NOT NULL,
    day_number INTEGER NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_itinerary_days_day_number CHECK (day_number > 0),
    CONSTRAINT uq_itinerary_days_trip_date UNIQUE (trip_id, day_date),
    CONSTRAINT uq_itinerary_days_trip_number UNIQUE (trip_id, day_number)
);

CREATE TABLE itinerary_items (
    id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
    place_id UUID,
    title VARCHAR(200) NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    start_time TIME,
    end_time TIME,
    duration_minutes INTEGER,
    sort_order INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    notes TEXT,
    place_name_snapshot VARCHAR(255),
    place_address_snapshot VARCHAR(512),
    lat_snapshot NUMERIC(10, 7),
    lng_snapshot NUMERIC(10, 7),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_itinerary_items_time_range CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time),
    CONSTRAINT ck_itinerary_items_duration CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CONSTRAINT ck_itinerary_items_type CHECK (item_type IN ('PLACE', 'MEAL', 'HOTEL', 'FLIGHT', 'TRANSFER', 'NOTE', 'ACTIVITY')),
    CONSTRAINT ck_itinerary_items_status CHECK (status IN ('PLANNED', 'DONE', 'SKIPPED', 'CANCELLED')),
    CONSTRAINT uq_itinerary_items_day_order UNIQUE (day_id, sort_order)
);

CREATE INDEX idx_trips_owner_status_start ON trips(owner_user_id, status, start_date);
CREATE INDEX idx_trips_owner_archived_start ON trips(owner_user_id, archived_at, start_date);
CREATE INDEX idx_itinerary_items_trip_day ON itinerary_items(trip_id, day_id);
CREATE INDEX idx_itinerary_items_place ON itinerary_items(place_id);
