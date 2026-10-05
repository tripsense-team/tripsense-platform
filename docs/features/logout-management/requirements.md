# Requirements: Logout & Multi-Device Session Management

## User Goals

Users can safely terminate their active session on their current device or revoke all active sessions across all devices (mobile, web, tablet) if a device is lost or compromised.

## Functional Requirements

1. **Logout Confirmation Dialog**:
   - When a user clicks "Log out" in `UserMenu` or `AdminHeader`, display a Logout Dialog with two distinct options:
     - **"Log out of this device"** (Đăng xuất khỏi thiết bị này)
     - **"Log out of all devices"** (Đăng xuất khỏi tất cả các thiết bị)
2. **Current Device Logout**:
   - Calls `POST /api/auth/logout`.
   - Clears the HttpOnly `refreshToken` cookie for the current client.
   - Clears RAM Access Token in Zustand store (`useAuthStore.getState().clearAuth()`).
   - Redirects to home page `/`.
3. **Multi-Device Logout (Logout All)**:
   - Calls `POST /api/auth/logout-all`.
   - Invalidates all refresh tokens / session hashes for the user in `user-service`.
   - Clears the HttpOnly `refreshToken` cookie on the active device.
   - Forces all other devices using the user's account to fail their next silent token refresh and trigger re-authentication.

## Non-Functional Requirements

- **Security**: Invalidation must be immediate. Revoked tokens cannot be used to refresh access tokens.
- **User Experience**: Clear user modal with loading states during execution.
