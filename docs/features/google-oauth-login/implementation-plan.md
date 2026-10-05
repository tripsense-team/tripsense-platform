# Implementation Plan: Google OAuth & Gmail Login

## Phased Rollout Strategy

To ensure stability and verify each layer independently, this feature is implemented across three sequential phases:

### Phase 1: Database Migration (Current Step)

- **Target Service**: `services/user-service`
- **Actions**:
  1. Add Flyway migration script `V202609221330__support_oauth_providers.sql` under `services/user-service/src/main/resources/db/migration/`.
  2. Test migration execution on PostgreSQL database.
  3. Validate table schema and index creation.
  4. Human approval checkpoint.

### Phase 2: Backend Implementation (`user-service`)

- **Target Service**: `services/user-service`
- **Actions**:
  1. Update `User` entity to map `authProvider`, `providerId`, and optional `password`.
  2. Add Google API Client dependency (`google-api-client`).
  3. Add `GoogleLoginRequest` DTO and `loginWithGoogle` endpoint in `AuthController`.
  4. Implement Google ID token verification and user registration/login in `AuthServiceImpl`.
  5. Add unit and integration tests for Google auth flow.
  6. Human approval checkpoint.

### Phase 3: Frontend Integration (`apps/web/tripsense`)

- **Target App**: `apps/web/tripsense`
- **Actions**:
  1. Add `@react-oauth/google` SDK or Google GIS script integration.
  2. Bind "Continue with Google" button in `auth-modal.tsx`.
  3. Implement `authApi.loginGoogle()` and connect to Zustand `useAuthStore`.
  4. Human approval and end-to-end verification.
