-- Compatibility schema for partner entities and subscription migration
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

CREATE TABLE IF NOT EXISTS restaurant_reservation_request (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id),
    customer_id UUID NOT NULL,
    customer_email VARCHAR(160),
    customer_name VARCHAR(120),
    business_name_snapshot VARCHAR(160) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    hold_expires_at TIMESTAMPTZ,
    time_zone VARCHAR(80) NOT NULL,
    adults INTEGER NOT NULL CHECK (adults >= 1 AND adults <= 20),
    children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0 AND children <= 20),
    notes VARCHAR(1000),
    state VARCHAR(16) NOT NULL CHECK (state IN ('REQUESTED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
    cancellation_reason VARCHAR(500),
    decision_reason VARCHAR(500),
    request_key VARCHAR(100),
    request_hash VARCHAR(64),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_total_guests CHECK ((adults + children) <= 20),
    CONSTRAINT uq_customer_request_key UNIQUE (customer_id, request_key)
);

CREATE TABLE IF NOT EXISTS restaurant_reservation_transition (
    id UUID PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES restaurant_reservation_request(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    from_state VARCHAR(16) NOT NULL,
    to_state VARCHAR(16) NOT NULL,
    reason VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_booking (
    id UUID PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES hotel_property(id),
    room_type_id UUID NOT NULL REFERENCES hotel_room_type(id),
    customer_id UUID NOT NULL,
    customer_email VARCHAR(254) NOT NULL,
    request_key VARCHAR(100) NOT NULL,
    property_name VARCHAR(160) NOT NULL,
    room_name VARCHAR(160) NOT NULL,
    time_zone VARCHAR(80) NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10),
    guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 200),
    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    total NUMERIC(18,2) NOT NULL CHECK(total >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'VND',
    payment_method VARCHAR(30) NOT NULL DEFAULT 'PAY_AT_PROPERTY',
    cancellation_policy VARCHAR(100) NOT NULL DEFAULT 'FREE_BEFORE_CHECK_IN',
    status VARCHAR(20) NOT NULL CHECK(status IN ('HELD','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','EXPIRED','NO_SHOW')),
    expires_at TIMESTAMPTZ NOT NULL,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    free_cancellation_until TIMESTAMPTZ,
    no_show_after TIMESTAMPTZ,
    cancellation_reason VARCHAR(500),
    cancelled_by VARCHAR(30),
    business_id UUID REFERENCES partner_business(id) ON DELETE SET NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK(check_out > check_in),
    UNIQUE(customer_id, request_key)
);

CREATE TABLE IF NOT EXISTS hotel_payos_payment (
    booking_id UUID PRIMARY KEY REFERENCES hotel_booking(id),
    order_code BIGINT NOT NULL,
    amount BIGINT NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    payment_link_id VARCHAR(100),
    checkout_url TEXT,
    qr_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

