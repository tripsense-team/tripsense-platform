# API Specification: Logout & Multi-Device Session Management

## 1. Single Device Logout

- **Endpoint**: `POST /api/auth/logout`
- **Headers**:
  - `Cookie: refreshToken=<JWT_REFRESH_TOKEN>`
  - `Authorization: Bearer <ACCESS_TOKEN>` (Optional/Recommended)
- **Response**: `200 OK`
  - `Set-Cookie`: `refreshToken=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  - **Body**:
    ```json
    {
      "success": true,
      "message": "Logged out of current device successfully",
      "data": null,
      "timestamp": "2026-08-13T23:35:00Z"
    }
    ```

## 2. Multi-Device Logout (Logout All Devices)

- **Endpoint**: `POST /api/auth/logout-all`
- **Headers**:
  - `Cookie: refreshToken=<JWT_REFRESH_TOKEN>`
  - `Authorization: Bearer <ACCESS_TOKEN>` (Required to verify user identity)
- **Response**: `200 OK`
  - `Set-Cookie`: `refreshToken=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  - **Body**:
    ```json
    {
      "success": true,
      "message": "Logged out of all devices successfully",
      "data": null,
      "timestamp": "2026-08-13T23:35:00Z"
    }
    ```
