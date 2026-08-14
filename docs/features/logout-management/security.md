# Security: Logout & Multi-Device Session Management

## Security Review Findings

1. **HttpOnly Cookie Invalidation**:
   - Both `/api/auth/logout` and `/api/auth/logout-all` must issue a `Set-Cookie` header with `Max-Age=0` and `Expires` set in the past to force browser cookie deletion.
2. **Immediate Token Revocation**:
   - `logout-all` increments `token_version` on the `User` entity.
   - Subsequent calls to `/api/auth/refresh` from any device check `refreshToken.token_version == user.token_version`. If versions mismatch, the request is rejected with `401 Unauthorized`.
3. **RAM Memory Clearing**:
   - Client-side Zustand store immediately clears `accessToken` from RAM upon triggering logout.
