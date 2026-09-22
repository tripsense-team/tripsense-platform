# Google OAuth & Gmail Authentication

- **Status**: DONE
- **Feature Name**: google-oauth-login
- **Affected Services**: `services/user-service`, `apps/web/tripsense`, `services/api-gateway`

## Overview

Enable users to sign in and register seamlessly using their Google / Gmail accounts via the Google ID Token Exchange pattern (OIDC).
This feature is implemented step-by-step:

1. **Phase 1 (Current)**: Flyway Database Migration in `user-service` to support OAuth providers (nullable passwords, `auth_provider`, `provider_id`, and partial unique index).
2. **Phase 2**: Backend `user-service` implementation (`GoogleLoginRequest`, `GoogleIdTokenVerifier`, user lookup/creation, session & JWT generation).
3. **Phase 3**: Frontend Next.js integration in `apps/web/tripsense` (`auth-modal.tsx`, `@react-oauth/google`, `authApi.loginGoogle`).

## Documentation Index

- [Requirements](./requirements.md)
- [Architecture](./architecture.md)
- [Data Model & Migration](./data-model.md)
- [Decisions & Tradeoffs](./decisions.md)
- [Implementation Plan](./implementation-plan.md)
