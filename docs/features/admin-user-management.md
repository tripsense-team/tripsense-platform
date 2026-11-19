# Admin User Management (Real Neon DB Integration) — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/user-service`
- **Affected Components**: `services/user-service`, `services/trip-service`, `services/api-gateway`, `apps/web/tripsense`
- **Created Date**: 2026-11-14
- **Target PR Boundaries**: Phase 1 (Backend API, Security & Unit Tests in `user-service` & `trip-service`), Phase 2 (Gateway Verification & Integration Tests), Phase 3 (Next.js `/admin/users` Real Data Integration, i18n & Verification)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Trang quản lý người dùng `/admin/users` ([page.tsx](../../apps/web/tripsense/src/app/admin/users/page.tsx)) hiện tại đang **hardcode toàn bộ dữ liệu** bằng mảng tĩnh `initialUsers` (5 user giả lập: `Gia Bao`, `Alex Traveler`, `Hanoi Luxury Suites`, `Sarah Miller`, `Spam Bot 2026`). Mọi thao tác tìm kiếm, lọc, đổi vai trò (`Role`) và tạm khóa/kích hoạt (`Status`) chỉ cập nhật `React.useState` cục bộ trên trình duyệt và mất hoàn toàn khi reload trang, không phản ánh dữ liệu người dùng thật trên Neon PostgreSQL (`tripsense_user`).

Mục tiêu của tính năng này là thay thế hoàn toàn dữ liệu giả trên `/admin/users` bằng hệ thống API thật qua API Gateway, kết nối trực tiếp tới dữ liệu `users` + `user_profiles` trên Neon DB (`services/user-service`) và số lượng chuyến đi thật từ `services/trip-service` mà vẫn giữ nguyên ranh giới dữ liệu giữa các microservice.

### 1.2 User Flows & Journey
1. Admin truy cập `/admin/users` trên Web Admin.
2. Frontend gửi `GET /api/users/admin/users?page=0&size=20&search=&role=&status=` kèm JWT Admin qua API Gateway (`:8080`) tới `user-service`.
3. Khi nhận danh sách `userIds` của trang hiện tại, frontend gọi song song `GET /api/admin/analytics/user-trip-counts?userIds=...` tới `trip-service` để hiển thị cột `Trips` (nếu `trip-service` lỗi hoặc timeout, bảng vẫn hiển thị bình thường với fallback `—`).
4. Admin gõ từ khóa tìm kiếm (tên hiển thị hoặc email), chọn bộ lọc `Role` (`ALL` / `USER` / `PARTNER` / `ADMIN`), chọn bộ lọc `Status` (`ALL` / `ACTIVE` / `INACTIVE` / `UNVERIFIED`), hoặc chuyển trang (`Previous` / `Next`) — danh sách được truy vấn trực tiếp trên PostgreSQL Neon.
5. Admin mở menu hành động trên một dòng user:
   - **Thay đổi vai trò (`USER` / `PARTNER` / `ADMIN`)**: Hiển thị hộp thoại xác nhận -> gọi `PATCH /api/users/admin/users/{userId}/role` -> cập nhật DB và làm mới dữ liệu. Nút đổi vai trò sang non-ADMIN bị vô hiệu hóa đối với chính tài khoản Admin đang đăng nhập.
   - **Tạm khóa (`INACTIVE`) / Kích hoạt (`ACTIVE`)**: Hiển thị hộp thoại xác nhận -> gọi `PATCH /api/users/admin/users/{userId}/status` -> cập nhật `users.status` trên DB; nếu chuyển sang `INACTIVE`, backend đồng thời thu hồi toàn bộ refresh tokens và active sessions của user đó. Nút tạm khóa bị vô hiệu hóa đối với chính tài khoản Admin đang đăng nhập.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Backend `user-service`: Danh sách người dùng có phân trang, tìm kiếm (`email`, `display_name`), lọc theo `role` và `status`; API cập nhật `role` và `status` với self-lockout/self-demotion guards và thu hồi session/refresh token khi khóa tài khoản.
  - Backend `trip-service`: Endpoint đọc số lượng trip (`archived_at IS NULL`) theo batch `owner_user_id` phục vụ cột `Trips` trên Admin UI.
  - Backend `PreFilter` (`user-service`): Bổ sung kiểm tra `userDetails.isAccountNonLocked()` để tài khoản bị chuyển sang `INACTIVE` bị chặn ngay cả khi access token chưa hết hạn khi gọi vào `user-service`.
  - Frontend `apps/web/tripsense`: Xóa `initialUsers` hardcode, tạo API client + TypeScript types, giữ giao diện đồng bộ Mindtrip/Admin design system, thêm phân trang, loading/error states (sanitized theo `ERROR_HANDLING_AND_LOGGING_STANDARDS.md`), xác nhận thao tác, và i18n parity (`en.json` & `vi.json`).
- **Out-of-Scope**:
  - Tạo mới tài khoản hoặc xóa cứng (`DELETE`) user từ Admin UI (chỉ hỗ trợ soft-disable qua `status = INACTIVE`).
  - Chỉnh sửa mật khẩu, avatar, hoặc thông tin hồ sơ chi tiết của user bởi Admin.
  - Gửi email trực tiếp từ backend (hành động `Send Email` nếu giữ lại chỉ dùng `mailto:` hoặc ẩn nếu chưa cần).
  - Bảng Audit Log lịch sử thay đổi quyền Admin riêng biệt (sẽ tách thành feature riêng nếu cần).

### 1.4 Acceptance Criteria
- [ ] AC-1: `/admin/users` không còn chứa dữ liệu hardcode (`initialUsers`); reload trang hiển thị đúng toàn bộ user thật trong bảng `users` + `user_profiles` trên Neon DB.
- [ ] AC-2: Tìm kiếm theo tên hoặc email, lọc theo `role` (`USER`, `PARTNER`, `ADMIN`) và `status` (`ACTIVE`, `INACTIVE`, `UNVERIFIED`), và phân trang hoạt động chính xác với dữ liệu DB.
- [ ] AC-3: Thay đổi `role` hoặc `status` (`ACTIVE` <-> `INACTIVE`) cập nhật xuống Neon DB, giữ nguyên trạng thái sau khi refresh trang, và hiển thị toast thông báo thành công/lỗi đã làm sạch.
- [ ] AC-4: Admin không thể tự tạm khóa (`INACTIVE`) hoặc tự hạ quyền (`USER`/`PARTNER`) chính tài khoản đang đăng nhập (cả UI disabled lẫn Backend trả lỗi `400`/`409`).
- [ ] AC-5: Khi một user bị chuyển sang `INACTIVE`, toàn bộ `refresh_tokens` và `sessions` đang hoạt động của user đó bị thu hồi trong cùng transaction.
- [ ] AC-6: Mọi request không có JWT hoặc không có `ROLE_ADMIN` nhận `401`/`403`.
- [ ] AC-7: Toàn bộ text giao diện hỗ trợ đầy đủ cả `en.json` và `vi.json` không thiếu key.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Admin Web /admin/users]
   |
   |---> (1) GET /api/users/admin/users?page&size&search&role&status
   |         -> [API Gateway (:8080)] -> [user-service] -> [Neon DB: tripsense_user (users, user_profiles)]
   |
   |---> (2) GET /api/admin/analytics/user-trip-counts?userIds=...
   |         -> [API Gateway (:8080)] -> [trip-service] -> [Neon DB: tripsense_trip (trips)]
   |
   |---> (3) PATCH /api/users/admin/users/{userId}/status | /role
             -> [API Gateway (:8080)] -> [user-service] -> [Neon DB: tripsense_user (users, refresh_tokens, sessions)]
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Giao diện `/admin/users`, gọi song song list users và batch trip counts | HTTP REST qua API Gateway |
| `services/api-gateway` | Định tuyến `/api/users/**` -> `lb://user-service` và `/api/admin/**` -> `lb://trip-service`, CORS (`GET`, `PATCH`, `OPTIONS`) | Spring Cloud Gateway |
| `services/user-service` | Chủ sở hữu bảng `users`, `user_profiles`, `refresh_tokens`, `sessions`; thực thi nghiệp vụ quản trị user & security guards | Synchronous Spring Boot REST + JPA/SQL |
| `services/trip-service` | Chủ sở hữu bảng `trips`; cung cấp batch count số trip theo danh sách `owner_user_id` cho Admin UI | Synchronous Spring Boot REST (read-only aggregate) |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway.
- [x] Mỗi service tự quản lý database riêng (`tripsense_user` vs `tripsense_trip`), **tuyệt đối không query chéo DB**.
- [x] **Không tạo JPA Entity relationship chéo microservice** (frontend tổng hợp `tripsCount` bằng `userIds` qua REST call độc lập tới `trip-service`).
- [x] Dùng REST đồng bộ là phù hợp vì Admin cần xem và cập nhật trạng thái user tức thời (request-response UI).

---

## 3. API & Event Contracts

### 3.1 REST Endpoints (API Gateway / Service)
| Method | Gateway Path | Service Internal Path | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/users/admin/users` | `/api/users/admin/users` | `Bearer JWT` (`ROLE_ADMIN`) | Lấy danh sách user phân trang, tìm kiếm, lọc role/status |
| `PATCH` | `/api/users/admin/users/{userId}/status` | `/api/users/admin/users/{userId}/status` | `Bearer JWT` (`ROLE_ADMIN`) | Cập nhật `status` (`ACTIVE` hoặc `INACTIVE`) và thu hồi token/session nếu khóa |
| `PATCH` | `/api/users/admin/users/{userId}/role` | `/api/users/admin/users/{userId}/role` | `Bearer JWT` (`ROLE_ADMIN`) | Cập nhật `role` (`USER`, `PARTNER`, `ADMIN`) |
| `GET` | `/api/admin/analytics/user-trip-counts` | `/api/admin/analytics/user-trip-counts` | `Bearer JWT` (`ROLE_ADMIN`) | Lấy map `{ userId: tripCount }` cho các `userIds` trên trang hiện tại |

#### Request & Response DTOs

**1. `GET /api/users/admin/users?page=0&size=20&search=&role=&status=`**
```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "displayName": "Nguyen Van A",
        "avatarUrl": "https://...",
        "role": "USER",
        "status": "ACTIVE",
        "authProvider": "LOCAL",
        "partnerEnrolled": false,
        "onboardingRequired": false,
        "location": "Ho Chi Minh City",
        "createdAt": "2026-10-01T08:15:30Z",
        "updatedAt": "2026-10-02T10:00:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 22,
    "totalPages": 2,
    "summary": {
      "totalUsers": 22,
      "activeUsers": 19,
      "inactiveUsers": 1,
      "unverifiedUsers": 2
    }
  }
}
```

**2. `PATCH /api/users/admin/users/{userId}/status`**
```json
// Request DTO
{
  "status": "INACTIVE" // Allowlist: "ACTIVE" | "INACTIVE"
}

// Response DTO (200 OK) - trả về AdminUserItemDto đã cập nhật
{
  "success": true,
  "message": "User status updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "INACTIVE",
    "updatedAt": "2026-11-14T13:50:00Z"
  }
}
```

**3. `PATCH /api/users/admin/users/{userId}/role`**
```json
// Request DTO
{
  "role": "PARTNER" // Allowlist: "USER" | "PARTNER" | "ADMIN"
}

// Response DTO (200 OK)
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "PARTNER",
    "updatedAt": "2026-11-14T13:52:00Z"
  }
}
```

**4. `GET /api/admin/analytics/user-trip-counts?userIds=uuid1,uuid2`** (trong `trip-service`)
```json
{
  "success": true,
  "message": "Trip counts fetched successfully",
  "data": {
    "counts": {
      "550e8400-e29b-41d4-a716-446655440000": 4
    }
  }
}
```
> Ràng buộc input: tối đa `100` UUID trong `userIds` mỗi request để tránh URL quá dài hoặc full-scan bất thường.

### 3.2 Kafka Event Specifications
Không bắt buộc trong phạm vi Phase 1-3 vì hành động Admin là quản trị đồng bộ trực tiếp trên `user-service`. Nếu sau này `notification-service` được triển khai, có thể phát sự kiện `tripsense.user.status-changed.v1` để gửi email thông báo khóa/mở khóa tài khoản.

---

## 4. Data Model & Migrations

### 4.1 Schema Existing (Neon DB `tripsense_user` & `tripsense_trip`)
Không cần tạo bảng mới. Dữ liệu đã tồn tại trên Neon PostgreSQL:
- `tripsense_user.users`: `id` (UUID PK), `email` (VARCHAR), `password` (nullable cho Google OAuth), `role` (VARCHAR(50): `USER`/`PARTNER`/`ADMIN`), `status` (`UserStatus`: `UNVERIFIED`, `ACTIVE`, `INACTIVE`), `auth_provider` (`LOCAL`/`GOOGLE`), `partner_enrolled` (BOOLEAN), `created_at`, `updated_at`.
- `tripsense_user.user_profiles`: `user_id` (UUID PK FK -> `users.id`), `display_name`, `avatar_url`, `onboarding_required`, `location`, `created_at`, `updated_at`.
- `tripsense_user.refresh_tokens` & `tripsense_user.sessions`: Lưu phiên đăng nhập và refresh token để thu hồi ngay khi `status = INACTIVE`.
- `tripsense_trip.trips`: `owner_user_id` (UUID), `archived_at` (TIMESTAMP, dùng điều kiện `archived_at IS NULL`).

### 4.2 Migration Strategy
- Kiểm tra bằng Flyway trong `services/user-service/src/main/resources/db/migration/` xem đã có index hỗ trợ lọc/sắp xếp trên `users(status, role, created_at DESC)` hay chưa.
- Nếu chưa có, thêm migration an toàn `CREATE INDEX IF NOT EXISTS` (không lock dài, hoàn toàn backward-compatible, rollback bằng `DROP INDEX IF EXISTS`).

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authentication** | Mọi endpoint `/api/users/admin/**` và `/api/admin/**` yêu cầu JWT hợp lệ. Tại `user-service`, `SecurityConfig` đã bật `@EnableMethodSecurity`, mọi controller method gắn `@PreAuthorize("hasRole('ADMIN')")`. Tại `trip-service`, kiểm tra quyền `ADMIN` nhất quán với `AdminPlatformAnalyticsController`. |
| **Access Token Revocation Gap** | Hiện tại `PreFilter.java` + `JwtUtils.validateAccessToken` chỉ kiểm tra chữ ký + hạn token mà chưa kiểm tra `userDetails.isAccountNonLocked()`. Cần bổ sung kiểm tra `userDetails.isAccountNonLocked()` trong `PreFilter.doFilterInternal` và gọi cả `refreshTokenRepository.revokeAllByUserId(userId, now)` + `sessionRepository.revokeAllByUserId(userId, now)` khi admin set `INACTIVE`. |
| **Self-Lockout / Self-Demotion** | Service layer trong `user-service` BẮT BUỘC đối chiếu `!targetUserId.equals(currentUser.getId())` trước khi chuyển sang `INACTIVE` hoặc đổi `role` khác `ADMIN`. Trả về `400 Bad Request` nếu vi phạm. |
| **Authorization / Privilege Escalation** | Validate `role` request theo allowlist cố định (`USER`, `PARTNER`, `ADMIN`) và `status` theo allowlist (`ACTIVE`, `INACTIVE`) bằng Bean Validation / explicit enum mapping. Không cho client truyền chuỗi role tùy ý. |
| **Input Validation & SQL Injection** | Dùng parameterized JPQL / native query với `:search`, `:role`, `:status` hoặc JPA `Specification` / escaping ký tự wildcard LIKE (`%`, `_`). Giới hạn `size` tối đa `100` và `userIds` tối đa `100` UUID. |
| **Error Sanitization (Zero-Leak)** | Tuân thủ `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`: không log email/token nhạy cảm, không trả stacktrace hay SQL error ra UI toast. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Cross-Service `Trips` Column** | Bảng mock cũ có cột `Trips`, nhưng `user-service` không có bảng `trips`. Nếu `user-service` gọi `RestTemplate`/`WebClient` đồng bộ tới `trip-service`, mỗi lần load trang admin bị phụ thuộc chéo dịch vụ và tăng độ trễ/điểm lỗi. | Chọn **frontend parallel aggregation**: trang `/admin/users` gọi `user-service` lấy danh sách user trang hiện tại, sau đó gọi `GET /api/admin/analytics/user-trip-counts?userIds=...` từ `trip-service` (fallback `—` nếu `trip-service` tạm thời không khả dụng). Giữ 100% độc lập giữa hai service. |
| **`SUSPENDED` vs `INACTIVE` Status** | Mock UI dùng nhãn `"SUSPENDED"`, trong khi `UserStatus` enum trong DB và Spring Security đang là `UNVERIFIED`, `ACTIVE`, `INACTIVE` (`User.isAccountNonLocked()` check `status != UserStatus.INACTIVE`). | Giữ nguyên enum `ACTIVE` / `INACTIVE` / `UNVERIFIED` trong DB và backend contract (không đổi schema/enum hiện có gây ảnh hưởng Auth flow), ở lớp hiển thị UI map `INACTIVE` sang nhãn `"Suspended"` / `"Tạm khóa"` (hoặc `"Inactive / Locked"`) để khớp ngôn ngữ vận hành. |
| **`partnerEnrolled` vs `role = PARTNER`** | Trong `User.getRoles()`, user có quyền `ROLE_PARTNER` nếu `role == "PARTNER"` HOẶC `partnerEnrolled == true`. | Trả cả `role` và `partnerEnrolled` trong DTO để Admin thấy rõ nguồn gốc quyền đối tác; khi Admin đổi `role`, chỉ cập nhật cột `users.role` (không âm thầm xóa lịch sử `partnerEnrolled`). |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend (`user-service` & `trip-service`)
- [x] Task 1.1: Tạo DTOs trong `services/user-service` (`AdminUserItemDto`, `AdminUserPageResponseDto`, `AdminUserSummaryDto`, `UpdateAdminUserStatusRequest`, `UpdateAdminUserRoleRequest`).
- [x] Task 1.2: Bổ sung migration index (`V20261114211000__add_admin_user_listing_indexes.sql`) + query phân trang, tìm kiếm, lọc (`LEFT JOIN user_profiles`) và aggregate summary counts.
- [x] Task 1.3: Tạo `AdminUserManagementService` với self-lockout guard, self-demotion guard, allowlist validation, và `@Transactional` thu hồi `RefreshTokenRepository.revokeAllByUserId` + `SessionRepository.revokeAllByUserId` khi set `INACTIVE`.
- [x] Task 1.4: Cập nhật `PreFilter.java` kiểm tra `userDetails.isAccountNonLocked()` khi xác thực access token.
- [x] Task 1.5: Tạo `AdminUserManagementController` tại `/api/users/admin/users` (`@PreAuthorize("hasRole('ADMIN')")`) với unit tests đầy đủ (`AdminUserManagementServiceTest`).
- [x] Task 1.6: Thêm `GET /api/admin/analytics/user-trip-counts` vào `AdminPlatformAnalyticsController` + `AdminPlatformAnalyticsService` + unit test (`AdminPlatformAnalyticsServiceTest`).

### Phase 2: API Gateway & Integration Sanity Check
- [x] Task 2.1: Kiểm tra cấu hình CORS & route của `services/api-gateway` (`GatewayRoutesConfig.java` / `application.yaml`) xác nhận cho phép method `PATCH` qua `/api/users/**` và `/api/admin/**`.
- [x] Task 2.2: Chạy test suites của `user-service` và `trip-service`.

### Phase 3: Web Frontend (`apps/web/tripsense`) & i18n
- [x] Task 3.1: Tạo `apps/web/tripsense/src/features/admin/types/admin-users.types.ts` và `apps/web/tripsense/src/features/admin/api/admin-users-api.ts` (dùng shared `apiClient`).
- [x] Task 3.2: Thay thế toàn bộ `initialUsers` trong `apps/web/tripsense/src/app/admin/users/page.tsx` bằng `AdminUsersView` kết nối Neon DB, có debounced search, server-side pagination, status summary pills, badge `Verified`/`Provider`/`Partner Enrolled`, confirm dialog trước khi Suspend/Activate hoặc đổi Role, và disable thao tác nguy hiểm trên chính tài khoản Admin đang đăng nhập.
- [x] Task 3.3: Bổ sung đầy đủ translation keys trong `apps/web/tripsense/src/locales/en.json` và `apps/web/tripsense/src/locales/vi.json` (`admin.users.*`), chạy kiểm tra `i18n:check`, `type-check`, `eslint`, và `vitest`.

---

## Human Approval Gate

```text
STATUS: DONE
```
> Kế hoạch kỹ thuật đã sẵn sàng để kiểm tra. Người duyệt vui lòng kiểm tra các mục trên.
> Phản hồi `Approved`, `Implement` hoặc `Proceed` để bắt đầu triển khai code.

