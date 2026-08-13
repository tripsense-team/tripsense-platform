# Data Model: Logout & Multi-Device Session Management

## Invalidation Approaches

### Approach Chosen: `token_version` on `User` entity / `RefreshTokens` Revocation Table

1. **`User` Entity Attribute**:
   - Add `token_version` (BIGINT / INT, default `1`) to `users` table.
   - Embed `token_version` claim inside issued Refresh Tokens and Access Tokens.
   - When user executes `logout-all`:
     - `UPDATE users SET token_version = token_version + 1 WHERE id = :userId`
     - Revokes all issued refresh tokens instantly across every device!

2. **Single Device Invalidation (`logout`)**:
   - Revoke specific refresh token by `jti` or hash in `email_verification_codes` / `refresh_tokens` table.

```sql
-- Migration snippet for user-service DB
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version BIGINT NOT NULL DEFAULT 1;
```
