CREATE TABLE IF NOT EXISTS travel_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    personalization_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    consented_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_travel_preferences_personalization
    ON travel_preferences(personalization_enabled) WHERE personalization_enabled = TRUE;
