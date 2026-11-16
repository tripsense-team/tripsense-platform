# Admin Reviews & Trips Management — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Services**: `services/social-service` (`/admin/reviews`), `services/trip-service` (`/admin/trips`)
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/social-service`, `services/trip-service`
- **Created Date**: 2026-11-15
- **Target PR Boundaries**: Phase 1 (Backend Admin APIs & Service Logic), Phase 2 (Security, Concurrency & Backend Tests), Phase 3 (Frontend `/admin/reviews` & `/admin/trips` Integration, i18n & Verification)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Hiện tại hai trang quản trị trong TripSense Admin Portal vẫn đang sử dụng dữ liệu giả lập (hardcoded arrays) và state cục bộ trên trình duyệt:
- [`apps/web/tripsense/src/app/admin/reviews/page.tsx`](../../apps/web/tripsense/src/app/admin/reviews/page.tsx): Dùng mảng `initialReviews` (4 bản ghi giả), khi Admin nhấn Approve / Reject chỉ đổi state React tạm thời và mất khi reload.
- [`apps/web/tripsense/src/app/admin/trips/page.tsx`](../../apps/web/tripsense/src/app/admin/trips/page.tsx): Dùng mảng `initialTrips` (6 bản ghi giả), khi Admin nhấn Archive / Restore chỉ đổi state React tạm thời và mất khi reload.

Mục tiêu của tính năng là kết nối hoàn toàn 2 trang `/admin/reviews` và `/admin/trips` với dữ liệu thực trên Neon PostgreSQL DB thông qua API Gateway, đảm bảo:
1. Admin xem được danh sách thực từ `tripsense_social.place_reviews` (kèm trạng thái báo cáo vi phạm từ `social_reports`) và `tripsense_trip.trips` (kèm số địa điểm và cờ AI/Manual).
2. Mọi thao tác kiểm duyệt review (`PUBLISHED` / `REMOVED`) và lưu trữ/khôi phục chuyến đi (`ARCHIVE` / `RESTORE`) đều được lưu bền vững xuống database với kiểm soát quyền `ROLE_ADMIN` và xử lý xung đột đồng thời (`@Version`).
3. Tuân thủ ranh giới microservice: tuyệt đối không query chéo database giữa `social-service`, `trip-service`, `user-service` và `place-service`.

### 1.2 User Flows & Journey

#### Flow A: Quản trị Đánh giá địa điểm (`/admin/reviews`)
1. Admin truy cập `/admin/reviews`. Frontend gọi `GET /api/social/admin/reviews` qua API Gateway (mặc định `page=0`, `size=20`).
2. `social-service` truy vấn bảng `place_reviews` (`deleted_at IS NULL`) trong `tripsense_social`, tổng hợp số lượng `social_reports` có `target_type = 'PLACE_REVIEW'` và `status = 'PENDING'` cho từng review, đồng thời enrich tên tác giả qua `UserPublicProfileClient` (`user-service`) và tên địa điểm qua `PlaceClient` (`place-service`) với fallback an toàn.
3. Admin lọc theo từ khóa (`search`), trạng thái (`ALL`, `PUBLISHED`, `REMOVED`, `FLAGGED`) hoặc số sao (`rating`), hoặc chuyển trang.
4. Admin nhấn **Publish / Approve** (`PUBLISHED`) hoặc **Remove / Reject** (`REMOVED`) trên một review -> Frontend gọi `PATCH /api/social/admin/reviews/{reviewId}/status`.
5. `social-service` khóa pessimistic/kiểm tra optimistic `@Version`, cập nhật `place_reviews.status`, đồng bộ xử lý các `social_reports` đang `PENDING` của review đó (`RESOLVED` khi `REMOVED`, `DISMISSED` khi `PUBLISHED`), và trả về DTO mới nhất để UI cập nhật.

#### Flow B: Quản trị Chuyến đi & Lịch trình (`/admin/trips`)
1. Admin truy cập `/admin/trips`. Frontend gọi `GET /api/admin/trips` qua API Gateway (`page=0`, `size=20`).
2. `trip-service` truy vấn bảng `trips` (`deleted_at IS NULL`) trong `tripsense_trip`, tính số địa điểm (`spotsCount`) và cờ tạo bởi AI (`isAiGenerated` từ `itinerary_commit_receipts`).
3. Frontend thu thập danh sách `ownerUserId` duy nhất trên trang hiện tại và gọi batch endpoint có sẵn `POST /api/users/public-profiles:batch` tới `user-service` để hiển thị tên và avatar của người tạo chuyến đi (fallback về ID rút gọn nếu lỗi mạng).
4. Admin lọc theo từ khóa (`search` theo tên chuyến đi, điểm đến, hoặc UUID), quyền riêng tư (`ALL`, `PUBLIC`, `SHARED`, `PRIVATE`), và trạng thái lưu trữ (`ALL`, `ACTIVE`, `ARCHIVED`).
5. Admin nhấn **Archive Trip** hoặc **Restore Trip** -> Frontend gọi `PATCH /api/admin/trips/{tripId}/archive` với `{ archived: true | false, version }`.
6. `trip-service` xác thực quyền Admin, kiểm tra `@Version`, cập nhật `status` & `archived_at` (và xóa cache `trip-detail`, `trip-list`, `trip-itinerary`), sau đó UI cập nhật lại hàng dữ liệu và bộ đếm tổng quan.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Backend `social-service`: API `GET /api/social/admin/reviews` và `PATCH /api/social/admin/reviews/{reviewId}/status` trên `place_reviews` + đồng bộ `social_reports`.
  - Backend `trip-service`: API `GET /api/admin/trips` và `PATCH /api/admin/trips/{tripId}/archive` trên `trips` + `trip_places` / `itinerary_items` + `itinerary_commit_receipts`.
  - Frontend `apps/web/tripsense`: Thay thế toàn bộ dữ liệu mock ở `/admin/reviews` và `/admin/trips` bằng real API hooks, pagination, search/filter server-side, loading skeleton, sanitized error banner (`ERR-XXXXXX`), confirmation/action feedback, và i18n (`en.json` + `vi.json`).
- **Out-of-Scope**:
  - Review đặt phòng khách sạn/nhà hàng ở `reservation-review-modal.tsx` (hiện tại modal này chỉ lưu ở `localStorage`, chưa có bảng DB ở backend).
  - Xóa cứng (`DELETE`) trip hoặc review khỏi database.
  - Các trang admin mock khác (`/admin/reports`, `/admin/services`) sẽ được tách feature riêng.

### 1.4 Acceptance Criteria
- [ ] AC-1: `GET /api/social/admin/reviews` trả về danh sách `place_reviews` thực từ `tripsense_social` hỗ trợ phân trang (`page`, `size`), tìm kiếm (`search`), lọc `status` (`ALL`, `PUBLISHED`, `REMOVED`, `FLAGGED`), kèm `pendingReportCount`, `authorName`, `placeName` (fallback an toàn nếu service phụ gián đoạn).
- [ ] AC-2: `PATCH /api/social/admin/reviews/{reviewId}/status` cập nhật bền vững `place_reviews.status` (`PUBLISHED` / `REMOVED`), kiểm tra `@Version` chống ghi đè đồng thời, và tự động chuyển các `social_reports` đang `PENDING` của review đó sang `RESOLVED` / `DISMISSED`.
- [ ] AC-3: `GET /api/admin/trips` trả về danh sách `trips` thực từ `tripsense_trip` (`deleted_at IS NULL`) hỗ trợ phân trang, tìm kiếm, lọc `visibility` (`PUBLIC`, `SHARED`, `PRIVATE`) và trạng thái lưu trữ (`ACTIVE`, `ARCHIVED`), kèm `spotsCount`, `isAiGenerated` và `summary`.
- [ ] AC-4: `PATCH /api/admin/trips/{tripId}/archive` cho phép Admin chuyển đổi `archived = true` (`status = 'ARCHIVED'`, `archived_at = now`) và `archived = false` (`archived_at = null`, `status` khôi phục về `CONFIRMED` hoặc `DRAFT`), kiểm tra `@Version` và xóa cache liên quan.
- [ ] AC-5: Cả `/api/social/admin/reviews/**` và `/api/admin/trips/**` từ chối mọi user không có `ROLE_ADMIN` với HTTP `403` (hoặc `401` khi chưa đăng nhập).
- [ ] AC-6: `/admin/reviews` và `/admin/trips` không còn hardcoded mock array, không rò rỉ thông báo lỗi thô/token ở UI hoặc console (`ERROR_HANDLING_AND_LOGGING_STANDARDS.md`), và vượt qua `npm run i18n:check`, `type-check`, `eslint`, `vitest`, và Maven unit tests.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Admin Web (/admin/reviews)]
   |
   +--> GET /api/social/admin/reviews ---------> [API Gateway] --> [social-service] --> [Neon: tripsense_social]
   |                                                                    |
   |                                                                    +--> (Best-effort HTTP) -> [user-service: /public-profiles:batch]
   |                                                                    +--> (Best-effort HTTP) -> [place-service: /api/places/{ref}]
   +--> PATCH /api/social/admin/reviews/{id}/status --> [API Gateway] --> [social-service]

[Admin Web (/admin/trips)]
   |
   +--> GET /api/admin/trips ------------------> [API Gateway] --> [trip-service] -----> [Neon: tripsense_trip]
   |
   +--> POST /api/users/public-profiles:batch -> [API Gateway] --> [user-service] -----> [Neon: tripsense_user]
   |
   +--> PATCH /api/admin/trips/{id}/archive ---> [API Gateway] --> [trip-service] -----> [Neon: tripsense_trip]
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Trang `/admin/reviews` & `/admin/trips`, gọi API Gateway, batch enrich creator cho `/admin/trips` | HTTP REST (`apiClient`) |
| `services/api-gateway` | Đã cấu hình sẵn `/api/social/**` -> `social-service` và `/api/admin/**` -> `trip-service`; verify JWT | Spring Cloud Gateway |
| `services/social-service` | Sở hữu `place_reviews` & `social_reports`; kiểm duyệt và batch enrich author/place qua client có sẵn | Synchronous Spring Boot |
| `services/trip-service` | Sở hữu `trips`, `trip_places`, `itinerary_items`, `itinerary_commit_receipts`; quản trị danh sách & archive/restore | Synchronous Spring Boot |
| `services/user-service` | Cung cấp sẵn `POST /api/users/public-profiles:batch` (`PublicProfileDto`) để tra cứu tên/avatar tác giả & chủ trip | Synchronous REST (read-only) |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway (`/api/social/**` và `/api/admin/**` đã được khai báo trong `GatewayRoutesConfig.java`).
- [x] Mỗi service tự quản lý database riêng, **tuyệt đối không query chéo DB** (`social-service` chỉ query `tripsense_social`, `trip-service` chỉ query `tripsense_trip`).
- [x] **Không tạo JPA Entity relationship chéo microservice** (chỉ lưu `author_user_id`, `owner_user_id`, `place_ref`).
- [x] Dùng REST đồng bộ vì đây là màn hình Admin đọc/cập nhật dữ liệu theo thời gian thực.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints (API Gateway / Services)
| Method | Gateway & Service Path | Owning Service | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/social/admin/reviews` | `social-service` | `ROLE_ADMIN` | Phân trang + lọc `place_reviews` kèm báo cáo & summary |
| `PATCH` | `/api/social/admin/reviews/{reviewId}/status` | `social-service` | `ROLE_ADMIN` | Cập nhật `PUBLISHED` / `REMOVED` & đóng report `PENDING` |
| `GET` | `/api/admin/trips` | `trip-service` | `ROLE_ADMIN` | Phân trang + lọc `trips` kèm `spotsCount`, `isAiGenerated`, `summary` |
| `PATCH` | `/api/admin/trips/{tripId}/archive` | `trip-service` | `ROLE_ADMIN` | Lưu trữ (`ARCHIVED`) hoặc khôi phục (`ACTIVE`) chuyến đi |
| `POST` | `/api/users/public-profiles:batch` *(có sẵn)* | `user-service` | Gateway/Public | Batch tra cứu `displayName`, `avatarUrl` từ `userIds` |

#### Request & Response DTOs

**1. `GET /api/social/admin/reviews?page=0&size=20&search=...&status=ALL&rating=`**
```json
// Response (Envelope ApiResponse<AdminPlaceReviewPageResponse>)
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "placeRef": "ChIJ...",
        "placeName": "Bà Nà Hills",
        "authorUserId": "uuid",
        "authorName": "Nguyen Van A",
        "authorAvatarUrl": "https://...",
        "rating": 5,
        "content": "Phong cảnh tuyệt đẹp...",
        "status": "PUBLISHED",
        "pendingReportCount": 2,
        "totalReportCount": 3,
        "version": 1,
        "createdAt": "2026-10-12T08:30:00Z",
        "updatedAt": "2026-10-12T08:30:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 42,
    "totalPages": 3,
    "summary": {
      "total": 42,
      "published": 35,
      "removed": 7,
      "flagged": 4
    }
  }
}
```

**2. `PATCH /api/social/admin/reviews/{reviewId}/status`**
```json
// Request DTO
{
  "status": "REMOVED",
  "reason": "Violates community guidelines",
  "version": 1
}

// Response DTO (200 OK)
{
  "success": true,
  "message": "Review status updated",
  "data": {
    "id": "uuid",
    "status": "REMOVED",
    "pendingReportCount": 0,
    "version": 2,
    "updatedAt": "2026-11-15T13:50:00Z"
  }
}
```

**3. `GET /api/admin/trips?page=0&size=20&search=...&visibility=ALL&archived=ALL`**
```json
// Response (Envelope ApiResponse<AdminTripPageResponse>)
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "ownerUserId": "uuid",
        "name": "3 Days in Da Nang",
        "destinationName": "Da Nang, Vietnam",
        "startDate": "2026-11-20",
        "endDate": "2026-11-22",
        "durationDays": 3,
        "status": "CONFIRMED",
        "visibility": "PUBLIC",
        "travelerCount": 2,
        "spotsCount": 8,
        "isAiGenerated": true,
        "archived": false,
        "archivedAt": null,
        "version": 4,
        "createdAt": "2026-11-01T10:00:00Z",
        "updatedAt": "2026-11-10T14:20:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 18,
    "totalPages": 1,
    "summary": {
      "totalTrips": 18,
      "activeTrips": 15,
      "archivedTrips": 3,
      "aiCraftedTrips": 11,
      "publicTrips": 9
    }
  }
}
```

**4. `PATCH /api/admin/trips/{tripId}/archive`**
```json
// Request DTO
{
  "archived": true,
  "version": 4
}

// Response DTO (200 OK)
{
  "success": true,
  "message": "Trip archive state updated",
  "data": {
    "id": "uuid",
    "status": "ARCHIVED",
    "archived": true,
    "archivedAt": "2026-11-15T13:55:00Z",
    "version": 5,
    "updatedAt": "2026-11-15T13:55:00Z"
  }
}
```

### 3.2 Kafka Event Specifications
- Không phát sinh Kafka topic mới trong phạm vi tính năng này (luồng đồng bộ Admin CRUD).

---

## 4. Data Model & Migrations

### 4.1 Schema Definition (Sử dụng bảng hiện có trên Neon)
Không cần tạo bảng mới. Dữ liệu đọc và cập nhật trực tiếp trên các bảng sẵn có:

1. **`tripsense_social.place_reviews`** (từ `V202609301100__create_place_reviews.sql`):
   - `id UUID PRIMARY KEY`
   - `place_ref VARCHAR(128) NOT NULL`
   - `author_user_id UUID NOT NULL`
   - `rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5)`
   - `content TEXT NOT NULL`
   - `status VARCHAR(16) NOT NULL CHECK (status IN ('PUBLISHED', 'REMOVED'))`
   - `version BIGINT NOT NULL DEFAULT 0`
   - `created_at TIMESTAMPTZ NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL`, `deleted_at TIMESTAMPTZ`
2. **`tripsense_social.social_reports`** (từ `V202610121700__add_place_review_reports.sql`):
   - `target_type = 'PLACE_REVIEW'`, `target_id = place_reviews.id`, `status IN ('PENDING', 'RESOLVED', 'DISMISSED')`.
3. **`tripsense_trip.trips`** (từ `V1__create_trip_tables.sql`):
   - `id UUID PRIMARY KEY`, `owner_user_id UUID NOT NULL`, `name VARCHAR(160)`, `destination_name VARCHAR(255)`, `start_date DATE`, `end_date DATE`, `status VARCHAR(32) CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'ARCHIVED'))`, `visibility VARCHAR(32)`, `traveler_count INT`, `version BIGINT`, `publication_revision BIGINT`, `archived_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`.
   - Join/aggregate trong cùng `tripsense_trip`: `trip_places` + `itinerary_items` (tính `spotsCount`) và `itinerary_commit_receipts` (xác định `isAiGenerated`).

### 4.2 Migration Strategy
- **Không bắt buộc thêm migration bảng mới** vì schema hiện tại đã có đầy đủ cột `status`, `version`, `archived_at`, `deleted_at`.
- Chỉ bổ sung index đọc nếu cần khi đo tải (tùy chọn backward-compatible `CREATE INDEX IF NOT EXISTS`).
- **Quy tắc khôi phục Trip (`archived = false`)**:
  - `TripServiceImpl.validateStatusChange` ở luồng user thông thường chặn đổi trạng thái từ `ARCHIVED`. Do đó `AdminTripManagementService` thực hiện riêng hành động khôi phục dành cho `ROLE_ADMIN`: đặt `archivedAt = null`, kiểm tra xem trip đã có `itinerary_days` / `itinerary_items` hay chưa để đặt lại `status = CONFIRMED` (nếu có item) hoặc `DRAFT` (nếu rỗng), đồng thời tăng `publicationRevision`.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authentication & Role** | `social-service` `SecurityConfig` đã khóa `/api/social/admin/**` cho `hasRole("ADMIN")`; `trip-service` `SecurityConfig` đã khóa `/api/admin/**` cho `hasRole("ADMIN")`. Bổ sung kiểm tra `requireAdmin(...)` ngay trong service layer để phòng thủ theo chiều sâu (`401`/`403`). |
| **Privilege Escalation / IDOR** | Đường dẫn `/api/social/admin/**` và `/api/admin/**` chỉ chấp nhận Admin; mọi tham số lọc (`search`, `status`, `visibility`) được bind qua JDBC/JPA parameterized queries (chống SQL Injection). |
| **Input Validation** | Validate `@Valid` DTO (`@NotNull`, `@Size(max = 500)` cho `reason`); giới hạn `size` tối đa `100` (clamp `1..100`) và whitelist giá trị `status`, `visibility`, `archived` ở backend. |
| **Graceful Downstream Enrichment** | Lỗi kết nối từ `user-service` hoặc `place-service` khi làm giàu tên hiển thị không được phép làm sập danh sách Admin (`try/catch` với fallback `placeRef` / UUID rút gọn và warning log đã làm sạch). |
| **Zero-Leak Frontend Logging** | Tuân thủ `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`: không log stack trace/raw response lên console ở production và chỉ hiện thông báo i18n thân thiện kèm mã `ERR-XXXXXX`. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Review Status (`PENDING` vs `FLAGGED`)** | UI mẫu của `/admin/reviews` trước đây có trạng thái `PENDING / APPROVED / REJECTED`, nhưng constraint thực tế trong DB là `PUBLISHED / REMOVED` (bản chất review đăng thẳng và chỉ bị ẩn khi bị report hoặc Admin gỡ). | Map UI filter sang đúng domain thực tế: `ALL`, `PUBLISHED`, `REMOVED`, và `FLAGGED` (có report `PENDING`). Nút hành động chuyển thành **Approve / Publish** (`PUBLISHED`) và **Remove / Reject** (`REMOVED`). Không phá vỡ `ck_review_status` của người dùng cuối. |
| **Cross-service Place & Creator Names** | Bảng `trips` chỉ có `owner_user_id`, bảng `place_reviews` chỉ có `author_user_id` & `place_ref`. | Không gọi DB chéo. `/admin/trips` dùng `POST /api/users/public-profiles:batch` từ frontend (giống cách `/admin/users` gọi batch sang `trip-service`). `/admin/reviews` dùng `UserPublicProfileClient` + `PlaceClient` sẵn có trong `social-service` kèm try-catch fallback. |
| **Concurrency** | Hai Admin cùng lúc duyệt 1 review hoặc 1 trip. | Dùng pessimistic lock + kiểm tra `version` (`@Version` đã có trên cả `PlaceReview` và `Trip`), trả HTTP `409 Conflict` (`CONFLICTING_UPDATE`) nếu dữ liệu đã cũ để UI thông báo làm mới. |
| **Search Scope on Cross-Service Fields** | Tìm kiếm ở backend chỉ tìm trực tiếp được trên `trips.name`, `trips.destination_name`, `place_reviews.content`, `place_reviews.place_ref` hoặc UUID; chưa search trực tiếp theo email người dùng ở SQL nếu không giữ bản sao. | Chấp nhận search trực tiếp trên nội dung review / mã địa điểm / tên trip / điểm đến / UUID ở DB, giữ đúng ownership dữ liệu mà không phải duplicate bảng user. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend Admin Services & REST Controllers
- [x] Task 1.1 (`services/social-service`): Mở rộng `SocialReportRepository` để lấy report `PENDING` theo `target_type = 'PLACE_REVIEW'` và đóng report khi Admin đổi trạng thái review.
- [x] Task 1.2 (`services/social-service`): Tạo DTOs + `AdminPlaceReviewService` + `AdminPlaceReviewController` tại `/api/social/admin/reviews` (`GET` list + summary, `PATCH /{reviewId}/status`), tái sử dụng `UserPublicProfileClient` và `PlaceClient` với fallback an toàn.
- [x] Task 1.3 (`services/trip-service`): Tạo DTOs + `AdminTripManagementService` + `AdminTripManagementController` tại `/api/admin/trips` (`GET` list + summary, `PATCH /{tripId}/archive`) dùng `JdbcTemplate` / `TripRepository` để lấy `spotsCount`, `isAiGenerated` và cập nhật `ARCHIVED`/restore kèm `@CacheEvict`.

### Phase 2: Backend Unit & Security Tests
- [x] Task 2.1 (`services/social-service`): Viết `AdminPlaceReviewServiceTest` kiểm tra quyền Admin (`401`/`403`), lọc `PUBLISHED`/`REMOVED`/`FLAGGED`, `version` conflict (`409`), và đóng `social_reports` `PENDING`.
- [x] Task 2.2 (`services/trip-service`): Viết `AdminTripManagementServiceTest` kiểm tra quyền Admin (`401`/`403`), lọc `visibility`/`archived`, archive/restore state transition, và `version` conflict.

### Phase 3: Frontend `/admin/reviews` & `/admin/trips`, i18n & Verification
- [x] Task 3.1 (`apps/web/tripsense`): Tạo API modules & types dưới `src/features/admin/` (`admin-reviews-api.ts`, `admin-reviews.types.ts`, `admin-trips-api.ts`, `admin-trips.types.ts`).
- [x] Task 3.2 (`apps/web/tripsense`): Cập nhật `/admin/reviews/page.tsx` -> `AdminReviewsView` và `/admin/trips/page.tsx` -> `AdminTripsView`, bỏ toàn bộ mock arrays, gắn pagination, filter, action loading states, batch lookup creator cho trips (`POST /api/users/public-profiles:batch`), và error banner an toàn.
- [x] Task 3.3 (`apps/web/tripsense`): Cập nhật `src/locales/en.json` và `src/locales/vi.json` (đạt parity & thứ tự A->Z), viết Vitest tests (`admin-reviews-api.test.ts`, `admin-trips-api.test.ts`, `admin-reviews-and-trips-view.test.tsx`).

### Verification Commands
```bash
# Backend Tests
sh mvnw test -pl services/social-service -Dtest=AdminPlaceReviewServiceTest
sh mvnw test -pl services/trip-service -Dtest=AdminTripManagementServiceTest

# Frontend Checks
cd apps/web/tripsense && npm run i18n:check
cd apps/web/tripsense && npm run type-check
cd apps/web/tripsense && npx eslint src/features/admin src/app/admin/reviews src/app/admin/trips
cd apps/web/tripsense && npx vitest run src/features/admin/
```

---

## Human Approval Gate

```text
STATUS: DONE
```
> Tính năng đã được phê duyệt, triển khai đầy đủ và kiểm thử thành công.

