# Security Specifications: Google OAuth Login

## Trust Boundaries & Threat Analysis

### 1. Google ID Token Verification

- **Cryptographic Signature Verification**: Validated against Google's public keys (`https://www.googleapis.com/oauth2/v3/certs`) via `GoogleIdTokenVerifier`.
- **Audience (`aud`) Checking**: The verifier verifies that `aud` strictly equals the project's `GOOGLE_CLIENT_ID`. This prevents tokens minted for other apps from being accepted (token substitution attack).
- **Issuer (`iss`) Checking**: Verifies issuer is `https://accounts.google.com` or `accounts.google.com`.
- **Expiry (`exp`) Checking**: Verifier ensures `exp` has not expired with a small clock-skew window.

### 2. Account Linking Security

- **Email Verification**: Google certifies `email_verified: true` in the ID token.
- **Linking Strategy**: If a user previously registered with email/password (`auth_provider = 'LOCAL'`), we link their Google account by updating `provider_id = sub` and marking `status = ACTIVE` if it was `UNVERIFIED`.
- **Pre-existing Password**: The user's existing encrypted password hash is preserved, allowing the user to log in via either email/password or Google in the future.

### 3. Session & Token Security

- **HttpOnly Refresh Token Cookie**: `Path=/`, `HttpOnly`, `SameSite=Lax`, with automatic rotation on refresh and single-use revocation.
- **Short-Lived Access Token**: 15-minute lifespan stored in Next.js in-memory Zustand store.
- **Rate Limiting**: Public `/api/auth/**` requests go through API Gateway client-IP tracking.
