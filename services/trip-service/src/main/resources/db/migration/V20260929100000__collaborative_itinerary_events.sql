CREATE TABLE collaboration_change_events (
    event_id UUID PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    actor_user_id UUID NOT NULL,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_collaboration_event_trip_revision UNIQUE (trip_id, revision),
    CONSTRAINT ck_collaboration_event_revision CHECK (revision > 0),
    CONSTRAINT ck_collaboration_event_payload_size
        CHECK (octet_length(payload::text) <= 262144)
);

CREATE INDEX idx_collaboration_event_replay
    ON collaboration_change_events (trip_id, revision);

CREATE INDEX idx_collaboration_event_expiry
    ON collaboration_change_events (expires_at);
