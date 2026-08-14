# Implementation Plan: Logout & Multi-Device Session Management

## Phase 1: Database & Backend (`user-service`)
- Add `token_version` column to `User` entity and Liquibase/Flyway/JPA migration.
- Add `/api/auth/logout` and `/api/auth/logout-all` endpoints in `AuthController.java`.
- Update `AuthService` and `JwtUtils` to validate `token_version`.

## Phase 2: Gateway Configuration (`api-gateway`)
- Ensure `/api/auth/logout-all` is routed cleanly to `user-service`.

## Phase 3: Frontend UI (`apps/web/tripsense`)
- Add `LogoutModal` component with choices "Log out of this device" and "Log out of all devices".
- Connect `logoutAll()` method in `auth-api.ts` and `auth-context.tsx`.
- Wire `UserMenu` and `AdminHeader` to open `LogoutModal`.
