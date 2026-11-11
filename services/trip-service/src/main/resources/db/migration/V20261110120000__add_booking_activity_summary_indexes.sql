-- Indexes supporting lightweight booking activity summary & mark-seen queries

CREATE INDEX IF NOT EXISTS idx_partner_notification_unread_type
    ON partner_notification (recipient_id, event_type, business_id)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_notification_unread
    ON hotel_notification (recipient_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_booking_customer_status
    ON hotel_booking (customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hotel_booking_business_status
    ON hotel_booking (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_res_customer_state
    ON restaurant_reservation_request (customer_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_res_business_state
    ON restaurant_reservation_request (business_id, state, created_at DESC);

