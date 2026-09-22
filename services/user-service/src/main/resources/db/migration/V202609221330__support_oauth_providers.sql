-- 1. Allow password to be NULL for OAuth/Social registered users
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- 2. Add auth_provider to identify authentication source (LOCAL, GOOGLE, etc.)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL';

-- 3. Add provider_id to store provider unique identifier (e.g. Google 'sub' claim)
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- 4. Partial unique index: each provider_id must be unique per provider (allows multiple LOCAL users with NULL provider_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_provider ON users(auth_provider, provider_id) WHERE provider_id IS NOT NULL;
