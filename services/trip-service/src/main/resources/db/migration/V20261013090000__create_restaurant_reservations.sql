CREATE TABLE IF NOT EXISTS restaurant_reservation_request (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id),
    customer_id UUID NOT NULL,
    customer_email VARCHAR(160),
    customer_name VARCHAR(120),
    business_name_snapshot VARCHAR(160) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    time_zone VARCHAR(80) NOT NULL,
    adults INTEGER NOT NULL CHECK (adults >= 1 AND adults <= 20),
    children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0 AND children <= 20),
    notes VARCHAR(1000),
    state VARCHAR(16) NOT NULL CHECK (state IN ('REQUESTED', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
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

CREATE INDEX IF NOT EXISTS idx_res_req_customer ON restaurant_reservation_request (customer_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_res_req_business ON restaurant_reservation_request (business_id, state, start_at, id);

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

CREATE INDEX IF NOT EXISTS idx_res_trans_reservation ON restaurant_reservation_transition (reservation_id, created_at);
