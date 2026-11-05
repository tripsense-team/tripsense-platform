-- ==============================================================================
-- V20261027160000__consolidate_verification_codes_and_add_profile_fk.sql
-- 1. Consolidate temporary verification codes into unified polymorphic table
-- 2. Add missing foreign key constraint on user_profiles(user_id) to users(id) ON DELETE CASCADE
-- ==============================================================================

-- 1. Create unified auth_verification_codes table
CREATE TABLE IF NOT EXISTS auth_verification_codes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(32) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_user_purpose 
    ON auth_verification_codes(user_id, purpose, created_at DESC);

-- Backfill data from email_verification_codes
INSERT INTO auth_verification_codes (id, user_id, purpose, code_hash, attempt_count, expires_at, consumed_at, created_at)
SELECT id, user_id, 'EMAIL_VERIFICATION', code_hash, attempt_count, expires_at, verified_at, created_at
FROM email_verification_codes
ON CONFLICT (id) DO NOTHING;

-- Backfill data from password_reset_codes
INSERT INTO auth_verification_codes (id, user_id, purpose, code_hash, attempt_count, expires_at, consumed_at, created_at)
SELECT id, user_id, 'PASSWORD_RESET', code_hash, attempt_count, expires_at, NULL, created_at
FROM password_reset_codes
ON CONFLICT (id) DO NOTHING;

-- 2. Foreign Key constraint on user_profiles (prevent orphan profiles)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user_profiles_user_id'
    ) THEN
        -- Clean any orphaned profiles if any exist
        DELETE FROM user_profiles WHERE user_id NOT IN (SELECT id FROM users);

        ALTER TABLE user_profiles
            ADD CONSTRAINT fk_user_profiles_user_id
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;
