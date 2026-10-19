-- Real-time Notification Outbox migration

CREATE TABLE IF NOT EXISTS notification_realtime_outbox (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES partner_notification(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lease_until TIMESTAMPTZ,
    lease_token UUID,
    last_error_code VARCHAR(60),
    CONSTRAINT uq_notification_outbox UNIQUE (notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
    ON notification_realtime_outbox(next_attempt_at, created_at)
    WHERE published_at IS NULL;
