-- ==============================================================================
-- V20261027170000__create_trip_domain_outbox_and_notification.sql
-- 1. Create unified polymorphic outbox (trip_domain_outbox) consolidating:
--    - hotel_outbox
--    - partner_outbox
--    - notification_realtime_outbox
-- 2. Create unified in-app notification table (trip_app_notification) consolidating:
--    - hotel_notification
--    - partner_notification
-- ==============================================================================

-- 1. Create unified trip_domain_outbox
CREATE TABLE IF NOT EXISTS trip_domain_outbox (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(32) NOT NULL, -- 'HOTEL', 'PARTNER', 'REALTIME', 'TRIP'
    aggregate_id UUID,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt TIMESTAMPTZ NOT NULL DEFAULT now(),
    dead_letter BOOLEAN NOT NULL DEFAULT false,
    last_error VARCHAR(255),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_domain_outbox_pending
    ON trip_domain_outbox (created_at ASC)
    WHERE published_at IS NULL AND dead_letter = false;

CREATE INDEX IF NOT EXISTS idx_trip_domain_outbox_due
    ON trip_domain_outbox (next_attempt ASC)
    WHERE published_at IS NULL AND dead_letter = false;

-- Backfill from hotel_outbox
INSERT INTO trip_domain_outbox (id, aggregate_type, aggregate_id, event_type, payload, attempts, next_attempt, dead_letter, last_error, published_at, created_at)
SELECT id, 'HOTEL', aggregate_id, event_type, payload, attempts, next_attempt, dead_letter, last_error, processed_at, created_at
FROM hotel_outbox
ON CONFLICT (id) DO NOTHING;

-- Backfill from partner_outbox
INSERT INTO trip_domain_outbox (id, aggregate_type, aggregate_id, event_type, payload, attempts, next_attempt, dead_letter, last_error, published_at, created_at)
SELECT id, 'PARTNER', aggregate_id, event_type, payload, attempts, next_attempt, dead_letter, last_error, processed_at, created_at
FROM partner_outbox
ON CONFLICT (id) DO NOTHING;

-- Backfill from notification_realtime_outbox
INSERT INTO trip_domain_outbox (id, aggregate_type, aggregate_id, event_type, payload, attempts, next_attempt, dead_letter, last_error, published_at, created_at)
SELECT id, 'REALTIME', notification_id, event_type, jsonb_build_object('recipient_id', recipient_id), attempts, next_attempt_at, false, last_error_code, published_at, created_at
FROM notification_realtime_outbox
ON CONFLICT (id) DO NOTHING;

-- 2. Create unified trip_app_notification
CREATE TABLE IF NOT EXISTS trip_app_notification (
    id UUID PRIMARY KEY,
    target_type VARCHAR(32) NOT NULL, -- 'HOTEL', 'PARTNER', 'USER'
    recipient_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    business_id UUID,
    message VARCHAR(1000) NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_app_notification_recipient
    ON trip_app_notification(recipient_id, created_at DESC);

-- Backfill from hotel_notification
INSERT INTO trip_app_notification (id, target_type, recipient_id, event_type, message, read_at, created_at)
SELECT id, 'HOTEL', recipient_id, event_type, message, read_at, created_at
FROM hotel_notification
ON CONFLICT (id) DO NOTHING;

-- Backfill from partner_notification
INSERT INTO trip_app_notification (id, target_type, recipient_id, event_type, business_id, message, read_at, created_at)
SELECT id, 'PARTNER', recipient_id, event_type, business_id, message, read_at, created_at
FROM partner_notification
ON CONFLICT (id) DO NOTHING;
