# API Specification: Google OAuth Login

## Endpoint

### `POST /api/auth/google`

Authenticates a user via a Google ID Token (JWT) acquired from Google Identity Services on the frontend. If the user does not exist in the database, a new user account is automatically provisioned with `status = ACTIVE` and an associated `UserProfile` initialized with Google profile details.

- **Route Gateway**: Handled by `api-gateway` through `/api/auth/**` route to `user-service`.
- **Security**: Public endpoint (in `WHITE_LIST` of `SecurityConfig`).

### Request Headers

- `Content-Type: application/json`

### Request Body

```json
{
  "idToken": "string (Required, Google JWT ID Token signed by Google)"
}
```

### Success Response (200 OK)

- **Headers**:
  - `Set-Cookie: refreshToken=<rawRefreshToken>; Path=/; Max-Age=...; HttpOnly; SameSite=Lax`
- **Body**:

```json
{
  "success": true,
  "message": "Login with Google successful",
  "data": {
    "accessToken": "<stateless_jwt_access_token>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "d3b07384-d113-4f9e-9964-b04000492823",
      "email": "user@gmail.com",
      "role": "ROLE_USER",
      "status": "ACTIVE"
    }
  },
  "timestamp": "2026-09-22T13:30:00.000Z"
}
```

### Error Responses

#### 400 Bad Request

- **Condition**: Missing or blank `idToken`.

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "idToken": "Google ID token is required"
  }
}
```

#### 401 Unauthorized

- **Condition**: Expired, tampered, or mismatched audience in `idToken`.

```json
{
  "success": false,
  "message": "Invalid or expired Google ID token"
}
```

#### 403 Forbidden

- **Condition**: User account exists but is `INACTIVE` or suspended.

```json
{
  "success": false,
  "message": "Account has been deactivated"
}
```

#### 409 Conflict

- **Condition**: Account with the same email already exists in the system as a standard account (registered with password or different provider).

```json
{
  "success": false,
  "message": "Tài khoản đã tồn tại trong hệ thống. Vui lòng đăng nhập bằng tài khoản thường."
}
```
