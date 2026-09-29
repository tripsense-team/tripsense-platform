ALTER TABLE users
    ADD COLUMN partner_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN partner_enrolled_at TIMESTAMP,
    ADD COLUMN partner_terms_version VARCHAR(50);

CREATE INDEX idx_users_partner_enrolled ON users(partner_enrolled) WHERE partner_enrolled = TRUE;
