CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY,
    avatar_url TEXT,
    bio TEXT,
    location VARCHAR(255),
    cover_url TEXT,
    social_ports JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
