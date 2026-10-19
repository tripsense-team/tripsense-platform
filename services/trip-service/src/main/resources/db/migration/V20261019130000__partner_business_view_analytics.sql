CREATE TABLE partner_business_view_daily_dedupe (
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    view_date DATE NOT NULL,
    session_key_hash CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (business_id, view_date, session_key_hash)
);

CREATE INDEX idx_business_view_dedupe_created_at
    ON partner_business_view_daily_dedupe(created_at);

CREATE INDEX idx_res_req_business_created
    ON restaurant_reservation_request(business_id, created_at);

CREATE INDEX idx_res_trans_analytics_created_state
    ON restaurant_reservation_transition(created_at, from_state, to_state, reservation_id);
