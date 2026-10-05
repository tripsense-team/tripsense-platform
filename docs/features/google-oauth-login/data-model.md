# Data Model & Migration: Support OAuth Providers

## Owning Service: `user-service`

The `users` table holds user credentials and account status. To support social/OAuth logins (specifically Google/Gmail), the schema requires modifications to accommodate users who authenticate through an identity provider rather than a local password.

## Schema Modifications

### 1. Make `password` Nullable

- **Reason**: Users authenticating via Google do not possess a local password.
- **SQL**:
  ```sql
  ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
  ```

### 2. Add `auth_provider` Column

- **Type**: `VARCHAR(50) NOT NULL DEFAULT 'LOCAL'`
- **Values**: `'LOCAL'`, `'GOOGLE'` (expandable to `'APPLE'`, `'FACEBOOK'` etc.).
- **Default**: Existing rows automatically become `'LOCAL'`.
- **SQL**:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) NOT NULL DEFAULT 'LOCAL';
  ```

### 3. Add `provider_id` Column

- **Type**: `VARCHAR(255)`
- **Reason**: Stores the Google unique user identifier (`sub` claim in Google ID Token, e.g. `108204928193810293812`).
- **SQL**:
  ```sql
  ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);
  ```

### 4. Create Partial Unique Index

- **Index**: `uq_users_provider` on `(auth_provider, provider_id)` WHERE `provider_id IS NOT NULL`.
- **Reason**: Fast O(1) user lookup during OAuth callback, preventing multiple user accounts from binding to the exact same Google account while allowing multiple `'LOCAL'` users to have `provider_id = NULL`.
- **SQL**:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS uq_users_provider ON users(auth_provider, provider_id) WHERE provider_id IS NOT NULL;
  ```

## Target Migration File

- Path: `services/user-service/src/main/resources/db/migration/V202609221330__support_oauth_providers.sql`

## Compatibility & Safety

- **Zero Downtime**: Adding columns with defaults and dropping `NOT NULL` are non-locking / low-impact DDL operations in PostgreSQL.
- **Data Integrity**: Existing users retain their passwords and become `auth_provider = 'LOCAL'`.
- **Rollback Strategy**:
  ```sql
  DROP INDEX IF EXISTS uq_users_provider;
  ALTER TABLE users DROP COLUMN IF EXISTS provider_id;
  ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;
  -- Note: Re-enforcing NOT NULL on password requires verifying no NULL records exist.
  ```
