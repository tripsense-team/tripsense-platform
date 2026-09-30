# AI Service Dynamic Gemini Key Pool Integration — Specification & Implementation Plan

`STATUS: APPROVED`

- **Owner Service**: `services/ai-service`, `services/place-service`
- **Affected Components**: `services/place-service`, `services/ai-service`, `services/api-gateway`, `apps/web/tripsense`
- **Created Date**: 2026-09-30
- **Target PR Boundaries**: [Phase 1 (place-service Internal Key API), Phase 2 (ai-service Dynamic Key Manager & Caching), Phase 3 (Auto-Rotation & Metrics Sync), Phase 4 (Tests & Sanity)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Hiện tại, bảng **"Token Pool & Auto-Rotation Manager"** trên Admin Dashboard cho phép quản trị viên thêm, kích hoạt (Active), đưa về dự phòng (Standby) hoặc xoay vòng các API Key của Google AI Studio (Gemini). Dữ liệu này được lưu trữ và quản lý trong MongoDB của `place-service`.

Tuy nhiên, `services/ai-service` (dịch vụ Chat AI / Chatbot) hiện tại đang khởi tạo Google Provider tĩnh 1 lần khi server khởi động bằng biến môi trường `GOOGLE_GENERATIVE_AI_API_KEY` từ file `env/.env`. Do đó:
1. Khi admin kích hoạt một API Key mới (`AQ.Ab8...owhA`) trên giao diện Admin, `ai-service` không hề nhận được key này mà vẫn sử dụng key cũ (`AQ.Ab8...Wa1w` trong file `.env`).
2. Quản trị viên không thấy phát sinh request hay quota sử dụng trong Google AI Studio của key mới.
3. Khi key hiện tại bị 429 Quota Exceeded (hết hạn mức), `ai-service` báo lỗi trực tiếp về người dùng thay vì tự động xoay tua sang key dự phòng (Standby) có sẵn trong Token Pool.

**Mục tiêu**: Kết nối `ai-service` với MongoDB Token Pool của `place-service` thông qua endpoint nội bộ an toàn, có bộ nhớ đệm (in-memory cache) ngắn hạn để tối ưu hiệu năng, tự động xoay tua khi gặp lỗi 429/401/403, và dự phòng (fallback) về file `.env` nếu `place-service` gặp sự cố.

### 1.2 User Flows & Journey
1. **Quản trị viên thao tác trên Admin Dashboard**:
   - Quản trị viên mở trang `/admin/settings` -> Tab **Google AI Studio (Gemini)**.
   - Nhấn nút **Activate** cho một API Key mới.
2. **Hệ thống AI Chatbot áp dụng key mới trong thời gian thực**:
   - Người dùng gửi prompt trên Web Chat (`/chat`).
   - `ai-service` kiểm tra cache active key. Sau khi hết thời gian TTL (ví dụ 60 giây) hoặc khi cache rỗng, `ai-service` gọi endpoint nội bộ sang `place-service` để lấy key đang Active (`AQ.Ab8...owhA`).
   - `ai-service` gọi Google Gemini API bằng key mới.
   - Google AI Studio ghi nhận usage ngay lập tức cho key mới.
3. **Tự động xử lý khi hết hạn mức (429 Rate Limit / Quota Exceeded)**:
   - Nếu Google Gemini trả về mã lỗi `429` (Quota Exhausted), `ai-service` tự động gửi thông báo nội bộ yêu cầu xoay key sang `place-service`.
   - `place-service` đánh dấu key hiện tại là `EXHAUSTED` và chuyển key `Standby` tiếp theo thành `ACTIVE`.
   - Lượt gọi tiếp theo của `ai-service` tự động nhận key mới mà không cần can thiệp thủ công hay restart hệ thống.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Endpoint nội bộ tại `place-service` (`/api/places/internal/keys/...`) trả về key giải mã cho các service backend tin cậy.
  - Endpoint nội bộ tại `place-service` cho phép backend service báo cáo lỗi 429 để kích hoạt `markExhaustedAndRotate`.
  - Endpoint nội bộ tại `place-service` ghi nhận `recordSuccess` để cập nhật `successCount` và `lastUsedAt` cho key trên Admin Dashboard.
  - `GeminiKeyManager` trong `services/ai-service` với In-memory Cache (TTL 60s), cache invalidation khi lỗi, và graceful fallback về `config.googleApiKey` từ `.env`.
  - Refactor `services/ai-service/src/ai/providers.ts` để sinh đối tượng `google` linh hoạt theo active key hiện thời.
- **Out-of-Scope**:
  - Không thay đổi bảng UI `TokenPoolCard` trên frontend (UI đã hoạt động tốt và đầy đủ tính năng).
  - Không expose raw API key ra ngoài public Internet (API Gateway tiếp tục chặn mọi request `*/internal/**`).

### 1.4 Acceptance Criteria
- [ ] **AC-1**: Khi một key Gemini được đặt làm `ACTIVE` trên Admin Dashboard, trong vòng tối đa 60 giây, tất cả các request gửi đến Google Gemini từ `ai-service` phải sử dụng key này.
- [ ] **AC-2**: Lượt gọi thành công từ `ai-service` làm tăng `successCount` và cập nhật `lastUsedAt` hiển thị trên Admin Dashboard.
- [ ] **AC-3**: Nếu Google Gemini trả về HTTP `429` hoặc `401/403`, `ai-service` xóa cache ngay lập tức, thông báo cho `place-service` kích hoạt auto-rotation sang key Standby tiếp theo.
- [ ] **AC-4**: Nếu `place-service` không phản hồi (offline/timeout) hoặc Token Pool chưa có key nào, `ai-service` tự động fallback về `process.env.GOOGLE_GENERATIVE_AI_API_KEY` mà không bị gián đoạn hay crash.
- [ ] **AC-5**: Toàn bộ endpoint nội bộ mới (`/api/places/internal/keys/**`) bị chặn 100% khi truy cập từ bên ngoài qua API Gateway (`403 Forbidden`).

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Web User Chat] 
       │ (1. POST /api/chat)
       ▼
 [API Gateway (:8080)]
       │ (2. Proxy to ai-service)
       ▼
 [ai-service (:8089)]
       │
       ├─► [GeminiKeyManager Cache (TTL 60s)] ──(Hit)──► Trả về Active Key
       │
       │ (Miss / Expired: HTTP GET /api/places/internal/keys/active-raw?provider=GEMINI)
       ▼
 [place-service (:8083)]
       │ (Resolve raw key via AES decryption)
       ▼
 [MongoDB: api_key_pool]
       │
       ▼ (Trả về Active Raw Key)
 [ai-service] ──(Gọi Google Gemini API với Active Key)──► [Google AI Studio]
       │
       ├─► (Nếu Thành công) ──► Asynchronously báo `recordSuccess` về place-service
       └─► (Nếu 429 Quota) ──► Xóa cache + Báo `rotate` về place-service -> Xoay sang Standby Key
```

### 2.2 Service Ownership & Communication
| Component | Trách nhiệm | Giao thức |
| --- | --- | --- |
| `services/place-service` | Sở hữu `api_key_pool` collection trong MongoDB, quản lý mã hóa/giải mã AES, cung cấp API nội bộ | Spring Boot REST |
| `services/ai-service` | Gọi AI Gemini sinh hành trình/chat, lưu cache cục bộ active key, xử lý xoay key khi gặp lỗi | Node.js / TypeScript |
| `services/api-gateway` | Chặn triệt để public traffic vào `/api/*/internal/**` | Spring Cloud Gateway Filter |
| `apps/web/tripsense` | Dashboard Admin cho quản trị viên thêm/xem/kích hoạt key | Next.js (Không đổi) |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway; Gateway đã có filter chặn cứng `/api/*/internal/**` (`BLOCK_INTERNAL_ROUTE_ID`).
- [x] Mỗi service tự quản lý database riêng: `ai-service` **không** kết nối trực tiếp vào MongoDB của `place-service`. Chỉ giao tiếp qua HTTP REST nội bộ.
- [x] Không lưu trữ plain-text secrets ở phía frontend; raw key chỉ di chuyển giữa internal backend services qua mạng nội bộ.
- [x] AI chat flow luôn có cơ chế fallback về biến môi trường cục bộ để không bao giờ bị phụ thuộc đơn điểm (single point of failure).

---

## 3. API & Event Contracts

### 3.1 REST Endpoints (Internal Service-to-Service)

| Method | Internal Path | Header kiểm soát | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/places/internal/keys/active-raw` | `Query: provider=GEMINI` | Lấy raw key đang active (kèm keyHash, status) |
| `POST` | `/api/places/internal/keys/rotate` | Body JSON | Yêu cầu đánh dấu key bị lỗi quota và xoay sang Standby |
| `POST` | `/api/places/internal/keys/record-success` | Body JSON | Báo cáo lượt gọi thành công để tăng counter |

#### DTO Chi tiết:

##### 1. GET `/api/places/internal/keys/active-raw?provider=GEMINI`
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "provider": "GEMINI",
    "key": "AIzaSyD...",
    "keyHash": "3f7a1b...",
    "maskedKey": "AQ.Ab8...owhA",
    "status": "ACTIVE"
  }
}
```

##### 2. POST `/api/places/internal/keys/rotate`
**Request Body:**
```json
{
  "provider": "GEMINI",
  "failedKey": "AIzaSyD...",
  "status": "EXHAUSTED",
  "reason": "Google API 429 Resource Exhausted / Quota exceeded"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "rotated": true,
    "previousKey": "AQ.Ab8...owhA",
    "newActiveKey": "AIzaSyNew...",
    "newMaskedKey": "AQ.Ab8...Walw"
  }
}
```

##### 3. POST `/api/places/internal/keys/record-success`
**Request Body:**
```json
{
  "provider": "GEMINI",
  "rawKey": "AIzaSyD..."
}
```
**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 4. Data Model & Migrations

### 4.1 Persistence Model
- Không thay đổi cấu trúc bảng hay collection.
- Sử dụng collection hiện có `api_key_pool` trong MongoDB do `ApiKeyPoolRepository` quản lý:
  - `provider`: `GEMINI` | `ZIOMAP` | `OPENAI`
  - `keyHash`: SHA-256 hash của raw key
  - `encryptedKey`: Chuỗi khóa đã mã hóa AES
  - `status`: `ACTIVE` | `INACTIVE` | `EXHAUSTED` | `DISABLED`
  - `successCount`: Số lần gọi thành công
  - `lastUsedAt`: Thời điểm gọi gần nhất

### 4.2 Caching Strategy tại `ai-service`
```typescript
interface CachedGeminiKey {
  rawKey: string;
  keyHash: string;
  expiresAt: number; // Date.now() + 60_000 (1 phút)
}
```
- TTL ngắn (60 giây) đảm bảo:
  - Tối ưu: Không phát sinh request REST nội bộ cho từng câu chat hay từng tool call.
  - Linh hoạt: Khi Admin nhấn "Activate" key mới trên giao diện, `ai-service` tự động chuyển sang key mới chậm nhất sau 60 giây.
  - Tức thì khi lỗi: Khi bắt được lỗi 429 hoặc 401, cache bị xóa (invalidation) ngay lập tức mà không cần chờ hết 60s.

---

## 5. Security & Trust Boundaries

| Vùng rủi ro | Chiến lược kiểm soát & Bảo mật |
| --- | --- |
| **Bảo vệ Endpoint Raw Key** | Endpoint `/api/places/internal/keys/**` tuyệt đối **không** được cấu hình trong Gateway công khai. Gateway tự động trả về `403 Forbidden` đối với bất kỳ request nào có tiền tố `/api/*/internal/**`. |
| **Bảo vệ Secrets** | `ai-service` chỉ giữ `rawKey` trong bộ nhớ RAM, không log `rawKey` ra console (chỉ log `maskedKey` hoặc `keyHash` khi debug). |
| **Anti-Thundering-Herd** | Khi nhiều request gặp 429 cùng lúc, `ApiKeyPoolService.markExhaustedAndRotate` trong `place-service` đã có sẵn cơ chế so sánh `failedKeyHash == currentActiveKeyHash`. Chỉ request đầu tiên thực hiện xoay key, các request đến sau sẽ trả về key đã được xoay mà không xoay kép. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Độ trễ khi fetch key** | Nếu gọi `place-service` trước mỗi lần chat thì có làm chậm phản hồi không? | Đã dùng **In-Memory Cache (TTL 60s)**. 99% các request chat sẽ lấy key trực tiếp từ RAM trong 0ms. |
| **Single Point of Failure** | Nếu `place-service` bị restart hoặc gặp sự cố thì `ai-service` có bị chết theo không? | Thiết kế **Graceful Fallback**: Nếu HTTP call sang `place-service` bị timeout hoặc lỗi mạng, hệ thống tự động fallback sử dụng `process.env.GOOGLE_GENERATIVE_AI_API_KEY` từ file `.env`. Chatbot vẫn hoạt động bình thường. |
| **Instance Pool trong AI SDK** | `@ai-sdk/google` yêu cầu `createGoogleGenerativeAI({ apiKey })`. Nếu mỗi request tạo 1 provider mới thì có tốn RAM? | Cache các instance `googleProvider` theo `rawKey` (Map<rawKey, GoogleProviderInstance>). Chỉ tạo provider mới khi key thực sự thay đổi. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: `place-service` Internal Key API
- [x] Task 1.1: Tạo `InternalApiKeyPoolController.java` tại `services/place-service/src/main/java/fu/tripsense/placeservice/controller/`:
  - `GET /api/places/internal/keys/active-raw`
  - `POST /api/places/internal/keys/rotate`
  - `POST /api/places/internal/keys/record-success`
- [x] Task 1.2: Viết Unit / Controller test `InternalApiKeyPoolControllerTest.java` kiểm tra trả về raw key, xoay key thành công, và validation.
- [x] Task 1.3: Chạy `mvn test -pl services/place-service` đảm bảo toàn bộ tests pass (15/15 tests passed).

### Phase 2: `ai-service` Dynamic Key Manager
- [x] Task 2.1: Tạo module `services/ai-service/src/ai/gemini-key-manager.ts`:
  - Fetch key từ `place-service` với timeout 3s.
  - In-memory cache với TTL 60s.
  - Fallback về `config.googleApiKey`.
  - Invalidate cache & gọi rotation khi có lỗi 429/401/403.
- [x] Task 2.2: Cập nhật `services/ai-service/src/ai/providers.ts`:
  - Thêm `resolveLanguageModel(modelId: string)` và `getLanguageModel(modelId: string)` async.
  - Cache instance `createGoogleGenerativeAI` theo API key.
- [x] Task 2.3: Cập nhật `services/ai-service/src/routes/chat.ts` để `await resolveLanguageModel(selectedModelId)` và ghi nhận success/failure.

### Phase 3: Error Handling & Auto-Rotation Loop
- [x] Task 3.1: Thêm interceptor / error handler bắt mã `429` (hoặc `RESOURCE_EXHAUSTED`) và `401/403` trong stream chat để kích hoạt `geminiKeyManager.reportFailure(failedKey, status, reason)`.
- [x] Task 3.2: Async throttled gọi `recordSuccess` sau khi stream hoàn tất thành công.

### Phase 4: Verification & Sanity Check
- [x] Task 4.1: Kiểm tra Gateway chặn endpoint `/api/places/internal/keys/active-raw` từ ngoài (bảo vệ bởi `BLOCK_INTERNAL_ROUTE_ID`).
- [x] Task 4.2: Chạy unit tests cho cả `place-service` (15/15 passed) và `ai-service` (6/6 passed).
- [x] Task 4.3: Viết unit tests cho `GeminiKeyManager` (`gemini-key-manager.test.ts`).

---

## Status

```text
STATUS: DONE
```

