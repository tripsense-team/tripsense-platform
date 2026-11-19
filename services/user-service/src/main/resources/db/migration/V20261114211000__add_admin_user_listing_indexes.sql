CREATE INDEX IF NOT EXISTS idx_users_created_at_desc ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);
CREATE INDEX IF NOT EXISTS idx_users_email_lower_pattern ON users (lower(email) text_pattern_ops);

