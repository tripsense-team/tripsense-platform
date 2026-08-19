# Architecture: Logout & Multi-Device Session Management

## Affected Services

- `apps/web/tripsense`: Next.js Web App (UI Logout Modal, Zustand store update, API client calls).
- `services/api-gateway`: Routes `/api/auth/logout` and `/api/auth/logout-all` to `user-service`.
- `services/user-service`: Owns user session persistence, refresh token revocation logic, and database persistence.

## System Flow Diagram

```text
[ Web UI (Next.js) ]
       │
       ├─► Option A: Click "Log out of this device" 
       │      └──► POST /api/auth/logout
       │
       └─► Option B: Click "Log out of all devices"
              └──► POST /api/auth/logout-all
                      │
                      ▼
            [ API Gateway (8080) ]
                      │
                      ▼
           [ User Service (8081) ]
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   (Option A)             (Option B)
   Revoke 1 Token         Revoke ALL Tokens
   for current JTI        for User ID / Token Version
```

## Architectural Guardrails

- `user-service` solely owns user authentication and token revocation persistence.
- Communication between Web UI and `user-service` flows exclusively through `api-gateway`.
- No cross-service JPA dependencies created.
