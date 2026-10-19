-- Restaurant Booking Availability Engine migration

CREATE TABLE IF NOT EXISTS restaurant_availability (
    business_id UUID PRIMARY KEY REFERENCES partner_business(id) ON DELETE CASCADE,
    time_zone VARCHAR(80) NOT NULL,
    capacity_guests INTEGER NOT NULL CHECK (capacity_guests BETWEEN 1 AND 500),
    reservation_duration_minutes INTEGER NOT NULL CHECK (reservation_duration_minutes BETWEEN 15 AND 480),
    slot_interval_minutes INTEGER NOT NULL CHECK (slot_interval_minutes BETWEEN 5 AND 240),
    minimum_lead_minutes INTEGER NOT NULL CHECK (minimum_lead_minutes >= 0),
    maximum_advance_days INTEGER NOT NULL CHECK (maximum_advance_days BETWEEN 1 AND 365),
    pending_hold_minutes INTEGER NOT NULL CHECK (pending_hold_minutes BETWEEN 5 AND 1440),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_opening_interval (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES restaurant_availability(business_id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    CONSTRAINT chk_opening_interval_times CHECK (opens_at < closes_at)
);

CREATE INDEX IF NOT EXISTS idx_opening_interval_biz ON restaurant_opening_interval (business_id, day_of_week);

-- Alter restaurant_reservation_request to add ends_at, hold_expires_at and allow EXPIRED state
ALTER TABLE restaurant_reservation_request
    ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

-- Drop previous state check constraint if exists and re-add with EXPIRED
ALTER TABLE restaurant_reservation_request DROP CONSTRAINT IF EXISTS restaurant_reservation_request_state_check;
ALTER TABLE restaurant_reservation_request DROP CONSTRAINT IF EXISTS chk_res_req_state;
ALTER TABLE restaurant_reservation_request ADD CONSTRAINT chk_res_req_state
    CHECK (state IN ('REQUESTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED'));

-- Index for capacity overlap queries
CREATE INDEX IF NOT EXISTS idx_res_req_capacity_overlap
    ON restaurant_reservation_request (business_id, state, start_at, ends_at);

-- Partial index for fast scan of active holds needing expiry
CREATE INDEX IF NOT EXISTS idx_res_req_hold_expiry
    ON restaurant_reservation_request (hold_expires_at)
    WHERE state = 'REQUESTED';
