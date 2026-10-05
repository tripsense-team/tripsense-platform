CREATE TABLE onboarding_profiles (id UUID PRIMARY KEY, user_id UUID NOT NULL UNIQUE, version BIGINT NOT NULL DEFAULT 0, status VARCHAR(16) NOT NULL, schema_version INTEGER NOT NULL, consent_revision INTEGER NOT NULL DEFAULT 0, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
CREATE TABLE onboarding_selections (profile_id UUID NOT NULL REFERENCES onboarding_profiles(id) ON DELETE CASCADE, dimension_code VARCHAR(64) NOT NULL, value_code VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(profile_id, dimension_code, value_code));
CREATE TABLE preference_dimensions (code VARCHAR(80) PRIMARY KEY, cardinality VARCHAR(20) NOT NULL, sensitivity_class VARCHAR(20) NOT NULL DEFAULT 'STANDARD', schema_version INTEGER NOT NULL DEFAULT 1, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE onboarding_attributes (profile_id UUID NOT NULL REFERENCES onboarding_profiles(id) ON DELETE CASCADE, attribute_code VARCHAR(80) NOT NULL, value_json JSONB NOT NULL, value_schema_version INTEGER NOT NULL, sensitivity_class VARCHAR(20) NOT NULL DEFAULT 'STANDARD', updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(profile_id, attribute_code));
CREATE TABLE onboarding_free_text (profile_id UUID PRIMARY KEY REFERENCES onboarding_profiles(id) ON DELETE CASCADE, ciphertext BYTEA NOT NULL, encryption_key_ref VARCHAR(160) NOT NULL, purpose_consent_revision VARCHAR(80) NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE onboarding_places (profile_id UUID NOT NULL REFERENCES onboarding_profiles(id) ON DELETE CASCADE, place_ref VARCHAR(128) NOT NULL, intent VARCHAR(16) NOT NULL, created_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(profile_id, place_ref, intent));
CREATE TABLE preference_signals (id UUID PRIMARY KEY, user_id UUID NOT NULL, dimension_code VARCHAR(64) NOT NULL, value_code VARCHAR(128) NOT NULL, confidence NUMERIC(3,2) NOT NULL, source VARCHAR(32) NOT NULL, source_version BIGINT NOT NULL, updated_at TIMESTAMPTZ NOT NULL, UNIQUE(user_id, dimension_code, value_code, source));
CREATE TABLE context_outbox (id UUID PRIMARY KEY, aggregate_id UUID NOT NULL, event_type VARCHAR(80) NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, published_at TIMESTAMPTZ);
CREATE INDEX preference_signals_user_dimension_idx ON preference_signals(user_id, dimension_code, updated_at DESC);
CREATE INDEX onboarding_selections_profile_dimension_idx ON onboarding_selections(profile_id, dimension_code);
CREATE INDEX onboarding_places_profile_intent_idx ON onboarding_places(profile_id, intent);
INSERT INTO preference_dimensions (code, cardinality, sensitivity_class) VALUES
('TRAVEL_PARTY', 'SINGLE', 'STANDARD'), ('BUDGET_TIER', 'SINGLE', 'STANDARD'),
('SPLURGE_CATEGORY', 'MULTI', 'STANDARD'), ('STAY_STYLE', 'MULTI', 'STANDARD'),
('LOYALTY_PROGRAM', 'MULTI', 'SENSITIVE'), ('FOOD_STYLE', 'MULTI', 'STANDARD'),
('DIETARY_RESTRICTION', 'MULTI', 'SENSITIVE'), ('ACTIVITY_INTEREST', 'MULTI', 'STANDARD');
