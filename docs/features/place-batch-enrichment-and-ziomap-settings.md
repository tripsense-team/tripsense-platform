# Place Batch Enrichment & ZioMap Settings — Specification & Implementation Plan

`STATUS: APPROVED`

- **Owner Service**: `services/place-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/place-service`, `services/recommendation-service`
- **Created Date**: 2026-09-28
- **Target PR Boundaries**: 
  - Phase 1: `place-service` Batch Enrichment Engine, Dynamic ZioMap Config & Progress Tracker
  - Phase 2: `place-service` Internal Admin Endpoints & Integration Tests
  - Phase 3: `apps/web/tripsense` Settings UI (`/settings`) with ZioMap Token Management, Real-time Progress Monitor & Live Log Console

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Currently, the production database contains **833 places** that were seeded/imported without full details. They are missing:
- `rating` and `userRatingCount` (review count)
- `reviews` (customer reviews list)
- `photos` (photo URLs)
- Vector `embedding` in Qdrant (for AI semantic search)

Users cannot click through 833 places manually in the web UI. To prepare for data reporting and production readiness, the system requires an automated batch enrichment pipeline. Additionally, the operator needs a dedicated **Settings UI** to:
1. Dynamically configure and test the **ZIOMAP API Key** at runtime without redeploying services.
2. Trigger the concurrent enrichment job for all 833 places with 1 click.
3. Monitor real-time progress (percentage, counters, live logs, elapsed time) and cancel if needed.

### 1.2 User Flows & Journey
1. **Access Settings**: The user navigates to `/settings` in the web application (from user avatar menu or sidebar).
2. **Configure ZioMap Token**:
   - The user views the current active token status (e.g. `eyJ1c...hub`).
   - The user can input a new token and click **"Test & Save"**.
   - The backend validates the token with a quick ping against ZioMap API and updates the in-memory configuration immediately.
3. **Inspect Place Statistics**:
   - The UI shows cards: **Total Places** (833), **Enriched Places** (complete with photos & reviews), and **Pending Places** (missing photos or reviews).
4. **Execute Batch Enrichment**:
   - The user selects concurrency (default: `5 threads`) and clicks **"Start Batch Enrichment"**.
   - The UI switches to the active progress view:
     - Visual progress bar updating via polling (`GET /api/places/internal/batch-enrich/progress`).
     - Metrics: `Processed: X / 833 (Y%) | Success: S | Failed: F | Elapsed: mm:ss`.
     - Live activity terminal showing recent events: `[10:25:31] Enriched 'The 59 cafe' (5 photos, 5 reviews, rating 4.4) -> Qdrant synced`.
5. **Completion**:
   - Once all 833 places are enriched, the job transitions to `COMPLETED`, displays a success toast/banner, and refreshes the stats.

### 1.3 Scope Boundaries
- **In-Scope**:
  - `place-service`: Dynamic ZioMap API key update in `ZioMapProperties`.
  - `place-service`: Concurrent batch enrichment runner (`PlaceBatchEnrichmentService`) using an `ExecutorService` with configurable concurrency and rate-limit throttle.
  - `place-service`: Internal REST endpoints for stats, config, batch execution, progress polling, and cancellation.
  - `place-service`: Automatic trigger to `recommendation-service` (`/api/recommendations/internal/places/index`) for Gemini embedding and Qdrant upsert per enriched place.
  - `apps/web/tripsense`: `/settings` page with ZioMap Token Card, Places Overview Stats Card, and Live Batch Progress Card with real-time log viewer.
  - i18n support (`en` and `vi`) for all settings labels, buttons, and error messages.
- **Out-of-Scope**:
  - Modifying external provider APIs (ZioMap or Qdrant Cloud).
  - Bulk CSV import/export (focus is on enriching existing DB records).

### 1.4 Acceptance Criteria
- [ ] **AC-1**: Operator can inspect DB place enrichment stats (`total`, `enriched`, `pending`) via UI.
- [ ] **AC-2**: Operator can update the ZIOMAP token dynamically in the UI; `place-service` immediately uses the new token for subsequent requests without restart.
- [ ] **AC-3**: Batch enrichment runs concurrently (default 5 workers) with 100ms throttle between calls to prevent rate limits.
- [ ] **AC-4**: Each enriched place saves `rating`, `userRatingCount`, `reviews`, `photos` to MongoDB and syncs semantic vector embeddings to Qdrant.
- [ ] **AC-5**: If a place already has complete photos and reviews, it is skipped automatically (unless `forceAll=true`).
- [ ] **AC-6**: Real-time progress bar, success/fail counters, and terminal logs update live in the UI.
- [ ] **AC-7**: Batch job can be cancelled safely mid-run.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram & Data Flow
```text
[Web UI (/settings)]
       |
       v (REST via Gateway :8080)
[place-service (:8083)]
       |
       +---> [MongoDB] (Read places needing enrichment, persist photos & reviews)
       |
       +---> [ZioMap API] (Fetch details & photo gallery with active API key)
       |
       +---> (Async REST POST /api/recommendations/internal/places/index)
             |
             v
       [recommendation-service (:8088)]
             |
             +---> [Gemini API] (Generate embedding vector)
             +---> [Qdrant Cloud] (Upsert vector point)
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Settings page (`/settings`), token editor, progress bar, live logs | HTTP REST via API Gateway |
| `services/api-gateway` | Routing `/api/places/**` to `place-service` | Spring Cloud Gateway (Existing) |
| `services/place-service` | ZioMap provider, DB enrichment, batch orchestration, progress state | Synchronous REST & Async internal HTTP |
| `services/recommendation-service` | Receives place snapshots, generates Gemini embeddings, saves to Qdrant | Synchronous internal REST |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic goes through API Gateway.
- [x] `place-service` owns MongoDB `places` collection; no cross-service database access.
- [x] Embedding creation is delegated to `recommendation-service` via internal contract.
- [x] API keys are masked when returned to the frontend; full secret remains backend-side.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints (`place-service`)

| Method | Path | Auth Required | Description |
| --- | --- | --- | --- |
| `GET` | `/api/places/internal/stats` | Internal / Admin | Lấy thống kê số địa điểm (total, enriched, pending) và trạng thái ZioMap token |
| `POST` | `/api/places/internal/config/ziomap` | Internal / Admin | Kiểm tra và cập nhật ZioMap API Key động |
| `POST` | `/api/places/internal/batch-enrich` | Internal / Admin | Bắt đầu job batch enrichment chạy nền |
| `GET` | `/api/places/internal/batch-enrich/progress` | Internal / Admin | Lấy tiến độ job thời gian thực và log sự kiện gần nhất |
| `POST` | `/api/places/internal/batch-enrich/cancel` | Internal / Admin | Hủy bỏ job đang chạy |

### 3.2 Request & Response DTOs

#### 1. `GET /api/places/internal/stats` Response
```json
{
  "success": true,
  "data": {
    "totalPlaces": 833,
    "enrichedPlaces": 15,
    "pendingPlaces": 818,
    "zioMapKeyConfigured": true,
    "zioMapKeyMasked": "eyJ1c...hub",
    "isJobRunning": false
  }
}
```

#### 2. `POST /api/places/internal/config/ziomap` Request & Response
```json
// Request
{
  "apiKey": "eyJ1c2VyX2lkIjo1NTQs..."
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "valid": true,
    "message": "ZioMap API key validated and applied successfully",
    "maskedKey": "eyJ1c...hub"
  }
}
```

#### 3. `POST /api/places/internal/batch-enrich` Request & Response
```json
// Request (Query params or JSON body)
{
  "concurrency": 5,
  "limit": 1000,
  "forceAll": false
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "jobId": "batch-1727503800",
    "status": "RUNNING",
    "total": 818,
    "message": "Batch enrichment started with 5 workers"
  }
}
```

#### 4. `GET /api/places/internal/batch-enrich/progress` Response
```json
{
  "success": true,
  "data": {
    "status": "RUNNING",
    "total": 818,
    "processed": 142,
    "success": 140,
    "failed": 2,
    "percentage": 17.3,
    "elapsedSeconds": 28,
    "estimatedRemainingSeconds": 135,
    "currentPlaceName": "The 59 cafe",
    "recentLogs": [
      "[10:25:30] Enriched 'Reply 1988 Cafe' (5 photos, 5 reviews, Qdrant synced)",
      "[10:25:31] Enriched 'The 59 cafe' (5 photos, 5 reviews, Qdrant synced)"
    ]
  }
}
```

---

## 4. Data Model & Persistence

### 4.1 MongoDB `places` Collection Updates
For each enriched place document, the batch runner updates:
- `rating`: `Double` (e.g. `4.5`)
- `userRatingCount`: `Integer` (e.g. `312`)
- `photos`: `List<String>` (5 photo CDN URLs)
- `reviews`: `List<PlaceReview>` (array of 5 review documents)
- `openingHours`: `String` (formatted weekday hours)
- `phone`: `String`
- `website`: `String`
- `lastFetchedAt`: `Instant` (timestamp for cache freshness)

### 4.2 Helper Query in `PlaceRepository`
```java
@Query("{ $or: [ { 'reviews': { $size: 0 } }, { 'reviews': null }, { 'photos': { $size: 0 } }, { 'photos': null }, { 'rating': null } ] }")
List<Place> findPendingEnrichment(Pageable pageable);

long countByReviewsNotNullAndReviewsNotEmptyAndPhotosNotNullAndPhotosNotEmpty();
```

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **API Key Exposure** | Current ZioMap API Key is ALWAYS masked in GET responses (`eyJ1c...hub`). Never send full key back to client. |
| **Input Validation** | Validate token format and run a live test probe against `/api/place/details` or `/api/place/autocomplete` before accepting new key. |
| **Rate Limiting** | Worker threads use a bounded executor pool with a 100ms throttle per worker to prevent IP or API quota exhaustion. |
| **Crash Protection** | If a single place throws an exception (e.g., deleted from Google/ZioMap or timeout), it logs error and continues batch without aborting the entire process. |

---

## 6. Technical Trade-offs & Alternatives

| Khía cạnh | Quyết định | Đánh đổi / Rationale |
| --- | --- | --- |
| **In-Memory Job State vs DB Job Entity** | Lưu tiến độ trong `AtomicReference` / `ConcurrentLinkedDeque` của `PlaceBatchEnrichmentService` | Tránh tạo thêm bảng/collection DB cho một tác vụ admin ngắn hạn; tiến độ được lưu trực tiếp vào từng place document (idempotent nếu chạy lại). |
| **Polling vs WebSocket/SSE** | Polling mỗi 1.0 giây từ Next.js UI | Đơn giản, cực kỳ ổn định, không yêu cầu thêm kết nối WebSocket/SSE qua API Gateway, tài nguyên tiêu thụ không đáng kể cho 1 người vận hành. |
| **Batch Size & Concurrency** | Concurrency 5 threads, 100ms delay | 833 / 5 = ~160 giây (~2.7 phút), đạt hiệu năng cao nhất trong khi giữ ZioMap API và Gemini embedding an toàn dưới quota. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: `place-service` Batch Engine & Dynamic Config
- [x] Task 1.1: Bổ sung method `updateApiKey(String newKey)` và `validateKey(String key)` trong `ZioMapProvider` / `ZioMapProperties`.
- [x] Task 1.2: Viết `PlaceBatchEnrichmentService`:
  - Quản lý trạng thái tiến độ (`total`, `processed`, `success`, `failed`, `recentLogs`).
  - Thread pool chạy `placeDetailsService.getDetails(id, ..., includePhoto=true)` song song.
  - Đồng bộ sang `recommendationIndexerClient.triggerIndexingAsync(...)`.
  - Hỗ trợ dừng / cancel job an toàn.
- [x] Task 1.3: Thêm helper query trong `PlaceRepository` để đếm và lấy danh sách địa điểm cần làm giàu.

### Phase 2: REST Controllers & Backend Testing
- [x] Task 2.1: Tạo `PlaceBatchEnrichmentController` với 5 endpoint:
  - `GET /api/places/internal/stats`
  - `POST /api/places/internal/config/ziomap`
  - `POST /api/places/internal/batch-enrich`
  - `GET /api/places/internal/batch-enrich/progress`
  - `POST /api/places/internal/batch-enrich/cancel`
- [x] Task 2.2: Viết Unit & Integration Tests cho `PlaceBatchEnrichmentService` và Controller (`PlaceBatchEnrichmentControllerTest`).

### Phase 3: Web Frontend Settings UI (`/settings`)
- [x] Task 3.1: Tạo route `apps/web/tripsense/src/app/(main)/settings/page.tsx` và layout liên kết với `user-sidebar`.
- [x] Task 3.2: Xây dựng các UI component:
  - `ZioMapTokenCard`: Xem token đã mask, nhập token mới, nút "Test & Save".
  - `PlaceStatsOverviewCard`: Hiển thị 3 chỉ số (Tổng địa điểm, Đã hoàn tất, Đang chờ).
  - `BatchEnrichmentRunnerCard`: Chọn số luồng (1-8), nút "Bắt đầu làm giàu dữ liệu", thanh tiến trình ProgressBar, Live Log Terminal.
- [x] Task 3.3: Thêm chuỗi i18n đầy đủ trong `locales/en.json` và `locales/vi.json` (chạy `npm run i18n:check`).
- [x] Task 3.4: Chạy `npm run type-check` và build frontend kiểm tra toàn diện.
- [x] Task 3.5: Giới hạn quyền hiển thị nút Settings và trang `/settings` chỉ dành riêng cho role `ROLE_ADMIN` (`UserRole.ADMIN`):
  - `user-sidebar.tsx`: Cấu hình `adminOnly: true` cho mục Settings và lọc danh sách navigation theo `user?.role === UserRole.ADMIN`.
  - `user-menu.tsx`: Chỉ render `Settings` dropdown item khi `authUser?.role === UserRole.ADMIN`.
  - `src/app/(main)/settings/page.tsx`: Bảo vệ với `<AuthGuard allowedRoles={[UserRole.ADMIN]}>`.
  - `src/app/admin/settings/page.tsx`: Cung cấp Settings dashboard ngay trong panel quản trị admin.
  - Viết unit test `settings-role-visibility.test.ts` kiểm thử logic hiển thị theo role.

### Phase 4: Multi-API-Key Token Pool (ZioMap & Gemini) with MongoDB Persistence & Auto-Rotation
- [x] Task 4.1: `place-service` Domain & Persistence:
  - `ApiKeyPoolItem` MongoDB entity (`api_key_pool` collection) with `provider` (`ZIOMAP`, `GEMINI`), `status` (`ACTIVE`, `AVAILABLE`, `EXHAUSTED`, `INVALID`), `maskedKey`, metrics.
  - `ApiKeyPoolRepository` with query helpers.
  - `ApiKeyPoolService` to handle CRUD, seed from initial properties, status updates, and auto-rotation on failure.
- [x] Task 4.2: Auto-Rotation Integration:
  - Update `ZioMapProvider` to fetch active key from `ApiKeyPoolService` and rotate on 401/402/403/429.
  - Update `RecommendationIndexerClient` to pass active Gemini key in header `X-Gemini-Api-Key` to `recommendation-service`, and rotate on 429 quota exhaustion.
  - Update `recommendation-service` `InternalPlaceIndexingController` & `RecommendationProperties` to accept dynamic Gemini API key.
- [x] Task 4.3: REST Endpoints in `place-service`:
  - `GET /api/places/internal/keys?provider={ZIOMAP|GEMINI}`
  - `POST /api/places/internal/keys` (batch add keys)
  - `DELETE /api/places/internal/keys/{id}`
  - `POST /api/places/internal/keys/{id}/activate`
  - `POST /api/places/internal/keys/reset-quota`
- [x] Task 4.4: Frontend UI in `apps/web/tripsense`:
  - `TokenPoolCard` with tabs for ZioMap and Google AI Studio (Gemini).
  - Key status badges (ACTIVE, AVAILABLE, EXHAUSTED, INVALID), last used time, success count.
  - Batch add textarea (one key per line) and Reset Quota button.
  - Live rotation events displayed in UI and logs.
- [x] Task 4.5: Tests & Verification:
  - Unit tests for `ApiKeyPoolService` and rotation logic (`ApiKeyPoolServiceTest`).
  - Unit tests for `ApiKeyPoolController` (`ApiKeyPoolControllerTest`).
  - Frontend unit tests in `settings-api.test.ts`.
  - Backend `mvn test` in `services/place-service` and `services/recommendation-service`.
  - Frontend `npm run type-check` and `npm test` (all 41 test files, 223 tests passed).

### Verification Commands
```bash
# Backend Test place-service
./mvnw clean test -pl services/place-service

# Frontend Type Check & Vitest
cd apps/web/tripsense && npm run type-check && npm test
```

---

## Status

```text
STATUS: IMPLEMENTED
```


