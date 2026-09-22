# Architecture: Google OAuth Login

## Component Overview

Google OAuth uses the **ID Token Verification / OIDC Exchange** pattern between Next.js (client) and `user-service` (backend).

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant FE as Next.js (apps/web/tripsense)
    participant Google as Google Identity Services
    participant GW as API Gateway
    participant US as user-service
    participant DB as PostgreSQL (tripsense_user)

    User->>FE: Click "Continue with Google"
    FE->>Google: Open Google Sign-In Popup
    Google-->>FE: Return ID Token (JWT)
    FE->>GW: POST /api/auth/google { idToken }
    GW->>US: Forward /api/auth/google
    US->>US: GoogleIdTokenVerifier.verify(idToken)
    Note over US: Checks signature, issuer, exp, audience
    US->>DB: findByEmail(email)
    alt Email Exists in DB
        alt Account is Standard Account (LOCAL / has password)
            US-->>GW: Return 409 Conflict ("Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường.")
            GW-->>FE: Return 409 Conflict
            FE->>User: Display error message & switch to standard password login
        else Account is Google OAuth User (matches sub)
            US->>DB: INSERT Session & RefreshToken
            US-->>GW: Return AccessToken + Set-Cookie (refreshToken)
            GW-->>FE: Return 200 OK + Set-Cookie
            FE->>FE: useAuthStore.setAuth(user, accessToken)
            FE->>User: Redirect /explore
        end
    else Email Does Not Exist
        US->>DB: INSERT User (status=ACTIVE, authProvider=GOOGLE, providerId=sub)
        US->>DB: INSERT UserProfile (avatarUrl=picture, etc.)
        US->>DB: INSERT Session & RefreshToken
        US-->>GW: Return AccessToken + Set-Cookie (refreshToken)
        GW-->>FE: Return 200 OK + Set-Cookie
        FE->>FE: useAuthStore.setAuth(user, accessToken)
        end
```

## Service Boundaries & Guardrails

- **Zero Cross-Service Coupling**: `user-service` directly manages user credentials, sessions, and user profiles in its own database (`tripsense_user`).
- **Standard Routing**: Requests route via Spring Cloud Gateway (`/api/auth/**`) directly to `user-service`.
- **Stateless Tokens**: The returned Access Token is signed by `user-service`'s internal JWT secret and used across downstream services (e.g. `trip-service`, `social-service`) via HTTP `Authorization: Bearer <token>`.
