# Test Plan: Logout & Multi-Device Session Management

## Unit & Integration Tests
- Test `/api/auth/logout`: verifies cookie `Max-Age=0` and token revocation.
- Test `/api/auth/logout-all`: verifies `token_version` increment in `users` DB table.
- Test `/api/auth/refresh` rejection when `token_version` is outdated.

## Manual Acceptance Criteria
1. User clicks "Log out" $\rightarrow$ Modal displays 2 options.
2. Selecting "Log out of this device" logs out current browser session only.
3. Selecting "Log out of all devices" invalidates all device sessions.
