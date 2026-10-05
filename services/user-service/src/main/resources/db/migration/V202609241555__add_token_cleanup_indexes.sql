-- Indexes to optimize background token & session cleanup queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at
    ON refresh_tokens (revoked_at)
    WHERE revoked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_absolute_expires_at
    ON sessions (absolute_expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_idle_expires_at
    ON sessions (idle_expires_at);
