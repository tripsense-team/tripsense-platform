CREATE TABLE email_verification_codes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    verified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_verification_codes_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
