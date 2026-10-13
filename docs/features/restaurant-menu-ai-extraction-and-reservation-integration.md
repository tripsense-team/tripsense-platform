# Restaurant Menu AI Extraction & Reservation Integration — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- **Owner Service**: `services/trip-service`, `services/ai-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, `services/ai-service`
- **Created Date**: 2026-10-13
- **Target PR Boundaries**: [Phase 1 (Fix Database & Menu Entity), Phase 2 (AI Menu Extraction Endpoint), Phase 3 (Reservation Pre-Order Integration), Phase 4 (Web Frontend UI)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
1. **Lỗi hiện tại (ERR-NK6W3T)**: Khi chủ nhà hàng lưu thực đơn (`Save` menu) có gắn tag (ví dụ `#dacsan`), Hibernate ném ngoại lệ do cột `tags` trong PostgreSQL là `jsonb` nhưng entity `RestaurantMenuItem` map kiểu `String` thiếu `@JdbcTypeCode(SqlTypes.JSON)`. Backend ném 500 và frontend sanitizer chuyển thành thông báo gián đoạn `ERR-NK6W3T`.
2. **Nhu cầu nhập thực đơn tự động**: Chủ cơ sở mất nhiều thời gian nhập thủ công từng món ăn, danh mục và giá tiền. Hệ thống cần tính năng upload ảnh chụp thực đơn (ảnh menu giấy/bảng hiệu), AI tự động nhận diện (OCR & semantic parsing) và điền sẵn danh sách món để chủ quán kiểm tra trước khi lưu.
3. **Logic liên kết giữa Thực đơn và Đặt bàn**: Hiện tại đặt bàn chỉ lưu ngày giờ và số khách. Khi khách đặt bàn ăn, cần cho phép tham khảo thực đơn và đặt trước món (pre-order) nhằm giúp quán chuẩn bị nguyên liệu, kiểm soát tính khả dụng của món (`available`), và snapshot giá tại thời điểm đặt bàn.

### 1.2 User Flows & Journey
1. **Flow A — Trích xuất thực đơn bằng AI**:
   - Chủ quán vào trang `Quản lý Thực đơn & Dịch vụ`.
   - Bấm nút "Quét ảnh thực đơn (AI Scan)".
   - Tải lên ảnh thực đơn (JPG/PNG/WebP, tối đa 5MB).
   - `ai-service` (Gemini Multimodal) phân tích ảnh, trích xuất cấu trúc món (tên món, danh mục, giá VND, mô tả, tags).
   - Modal hiển thị danh sách các món nhận diện được để chủ quán xem trước, sửa nhanh hoặc chọn/bỏ chọn.
   - Bấm "Áp dụng vào thực đơn": các món được append vào danh sách hiện tại. Chủ quán bấm "Save" để lưu lên hệ thống.
2. **Flow B — Đặt bàn kèm chọn món trước (Pre-order Dishes)**:
   - Khách xem trang giới thiệu công khai của nhà hàng (`/restaurants/[id]`).
   - Mở dialog đặt bàn (`restaurant-reservation-dialog`).
   - Khách điền ngày giờ, số người và có thể mở rộng phần "Đặt trước món ăn (Tùy chọn)".
   - Hệ thống hiển thị các món đang khả dụng (`available = true`). Khách chọn món và số lượng.
   - Khi gửi yêu cầu đặt bàn, backend lưu snapshot giá và tên món vào `pre_order_items`.
   - Chủ nhà hàng nhận yêu cầu đặt bàn với đầy đủ thông tin số lượng món để chuẩn bị trước.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Sửa lỗi mapping `@JdbcTypeCode(SqlTypes.JSON)` trên `RestaurantMenuItem.tags` và thêm `@Modifying` cho query xóa batch trong `RestaurantMenuItemRepository`.
  - Endpoint trích xuất thực đơn từ ảnh `POST /api/ai/restaurant-menu/extract` trên `ai-service`.
  - Mở rộng bảng `restaurant_reservation_request` thêm cột `pre_order_items jsonb` lưu danh sách món đặt trước dạng snapshot.
  - Cập nhật UI Dialog thêm món / quét ảnh trên web `apps/web/tripsense`.
  - Cập nhật UI Đặt bàn khách hàng hỗ trợ chọn món đặt trước.
- **Out-of-Scope**:
  - Thanh toán cọc trực tuyến tiền món ăn (thanh toán vẫn thực hiện trực tiếp tại nhà hàng theo quy trình hiện tại).
  - Phân tích file PDF phức tạp nhiều trang (MVP chỉ nhận 1 ảnh JPG/PNG/WebP/lần quét).

### 1.4 Acceptance Criteria
- [ ] **AC-1**: Lưu thực đơn thành công kể cả khi có tags `#dacsan`, không phát sinh lỗi `ERR-NK6W3T` hay 500 SQL type mismatch.
- [ ] **AC-2**: Upload ảnh menu trích xuất được danh sách món gồm: `name`, `category`, `price`, `description`, `tags` với độ chính xác định dạng số tiền VND.
- [ ] **AC-3**: Giao diện cho phép xem trước (Preview) danh sách món AI trích xuất trước khi gộp vào bảng thực đơn hiện có.
- [ ] **AC-4**: Khi đặt bàn, khách chỉ được chọn các món có trạng thái `available = true`.
- [ ] **AC-5**: Giá món ăn trong yêu cầu đặt bàn được snapshot cố định, không bị thay đổi nếu nhà hàng sửa giá menu sau đó.
- [ ] **AC-6**: Không lộ lỗi SQL/stack trace ra UI (tuân thủ `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`).

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[Owner Web Client]
       |
       +--> (1. Upload Image) -> [API Gateway :8080] -> [AI Service :3002] (Gemini Multimodal OCR)
       |                                                    |
       |<-- (2. Return Extracted Items JSON) <--------------+
       |
       +--> (3. Save Menu) ----> [API Gateway :8080] -> [Trip Service :8083] -> [DB: restaurant_menu_item]

[Customer Web Client]
       |
       +--> (4. Reserve + Pre-order) -> [API Gateway] -> [Trip Service :8083] -> [DB: restaurant_reservation_request]
```

### 2.2 Service Ownership & Communication
| Component | Trách nhiệm | Giao thức |
| --- | --- | --- |
| `apps/web/tripsense` | Giao diện quản lý thực đơn, upload ảnh & review AI, dialog đặt bàn | HTTP REST |
| `services/api-gateway` | Route `/api/ai/**` sang `ai-service`, route `/api/partners/**` sang `trip-service` | Spring Cloud Gateway |
| `services/ai-service` | Tiếp nhận ảnh menu, gọi Gemini Flash Multimodal, parse Zod schema trả về JSON | Node.js / Hono REST |
| `services/trip-service` | Quản lý thực đơn nhà hàng, xác thực quyền Owner/Manager, quản lý đơn đặt bàn | Spring Boot JPA REST |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway.
- [x] `trip-service` sở hữu dữ liệu thực đơn và đặt bàn; `ai-service` là stateless processor, không truy cập chéo database của `trip-service`.
- [x] Không tạo quan hệ JPA chéo microservice.
- [x] Snapshot dữ liệu món ăn (tên, giá) được lưu trực tiếp vào bảng reservation để đảm bảo tính bất biến.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints

#### Endpoint 1: Trích xuất thực đơn từ ảnh (AI Service)
- **Method**: `POST`
- **Gateway Path**: `/api/ai/restaurant-menu/extract`
- **Internal Path**: `/api/ai/restaurant-menu/extract`
- **Auth**: `Bearer JWT` (Role `PARTNER`)
- **Content-Type**: `multipart/form-data` (trường `file`) hoặc `application/json` (base64)

**Response DTO (200 OK)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "name": "Gà Nướng Muối Ớt",
        "category": "Món chính",
        "price": 180000,
        "currency": "VND",
        "description": "Gà nướng than hoa ướp muối ớt đậm đà",
        "tags": ["dacsan", "cay"],
        "available": true
      }
    ],
    "detectedCurrency": "VND",
    "notes": "Trích xuất thành công 12 món ăn"
  }
}
```

#### Endpoint 2: Cập nhật Thực đơn (Trip Service - Đã có, fix backend)
- **Method**: `PUT`
- **Gateway Path**: `/api/partners/businesses/{id}/restaurant-menu`
- **Request Body**:
```json
{
  "items": [
    {
      "name": "Gà Nướng",
      "category": "Món chính",
      "price": 50000,
      "currency": "VND",
      "description": "Gà nướng thảo mộc",
      "tags": ["dacsan"],
      "available": true,
      "displayOrder": 1
    }
  ],
  "expectedVersion": 1
}
```

#### Endpoint 3: Đặt bàn kèm món đặt trước (Trip Service - Mở rộng)
- **Method**: `POST`
- **Gateway Path**: `/api/partners/businesses/{id}/reservations`
- **Request Body (Mở rộng trường `preOrderItems`)**:
```json
{
  "startAt": "2026-10-15T12:00:00Z",
  "timeZone": "Asia/Ho_Chi_Minh",
  "adults": 4,
  "children": 0,
  "notes": "Bàn cạnh cửa sổ",
  "preOrderItems": [
    {
      "menuItemId": "c0a80123-0000-0000-0000-000000000001",
      "name": "Gà Nướng",
      "price": 50000,
      "quantity": 2
    }
  ]
}
```

---

## 4. Data Model & Migrations

### 4.1 Schema Changes (Flyway Migration in `services/trip-service`)
**File**: `db/migration/V20261013100000__restaurant_menu_fix_and_reservation_preorders.sql`
```sql
-- 1. Ensure tags in restaurant_menu_item is jsonb (already jsonb in V20260928173000)
-- 2. Add pre_order_items to restaurant_reservation_request
ALTER TABLE restaurant_reservation_request 
ADD COLUMN IF NOT EXISTS pre_order_items jsonb DEFAULT '[]'::jsonb;

-- Index for searching reservations by business
CREATE INDEX IF NOT EXISTS idx_res_req_pre_orders 
ON restaurant_reservation_request USING gin (pre_order_items);
```

### 4.2 Entity Updates
1. **`RestaurantMenuItem.java`**:
```java
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "tags", columnDefinition = "jsonb")
  private List<String> tags;
```
2. **`RestaurantMenuItemRepository.java`**:
```java
  @Modifying
  @Query("DELETE FROM RestaurantMenuItem r WHERE r.businessId = :businessId")
  void deleteByBusinessId(@Param("businessId") UUID businessId);
```
3. **`RestaurantReservation.java`**:
```java
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "pre_order_items", columnDefinition = "jsonb")
  @Builder.Default
  private List<ReservationPreOrderItemDto> preOrderItems = new ArrayList<>();
```

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **File Upload Abuse** | Giới hạn dung lượng ảnh <= 5MB. Chỉ cho phép MIME `image/jpeg`, `image/png`, `image/webp`. Xử lý in-memory buffer, không ghi file tùy tiện lên ổ đĩa. |
| **Tampered Price Injection** | Khi khách đặt bàn gửi `preOrderItems`, backend `trip-service` kiểm tra đối chiếu `menuItemId` với bảng `restaurant_menu_item`: lấy giá thực tế từ DB để lưu snapshot, không tin cậy giá gửi từ client. |
| **Unavailable Dishes Order** | Kiểm tra `menuItem.isAvailable() == true`. Nếu món đã tắt phục vụ (`false`), từ chối hoặc cảnh báo khách hàng. |
| **IDOR / Business Authorization** | Endpoint sửa menu và upload menu yêu cầu `OWNER` hoặc `MANAGER` của cơ sở kinh doanh đó. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Độ chính xác của AI OCR** | Ảnh chụp mờ, ánh sáng kém, font chữ cách điệu dẫn đến đọc sai tên hoặc giá | Cung cấp UI Preview cho chủ quán rà soát, chỉnh sửa trực tiếp từng ô trước khi bấm "Lưu". Không bao giờ tự động ghi đè thẳng vào database mà không qua bước duyệt của người dùng. |
| **Ghi đè thực đơn cũ** | Quét menu mới có thể vô tình xóa sạch các món đã nhập trước đó | Cơ chế "Thêm vào thực đơn hiện có" (Append) thay vì thay thế toàn bộ. Chủ quán có checkbox chọn món muốn thêm. |
| **Biến động giá sau khi đặt bàn** | Nhà hàng tăng giá sau khi khách đặt bàn | Lưu snapshot giá và tên món tại thời điểm tạo đơn đặt bàn. Hóa đơn bàn tuân theo snapshot lúc đặt. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Fix Database & Backend Entity (`trip-service`)
- [ ] Task 1.1: Sửa `RestaurantMenuItem.java` gắn `@JdbcTypeCode(SqlTypes.JSON)` trên `List<String> tags`.
- [ ] Task 1.2: Thêm `@Modifying` và `@Query` cho `RestaurantMenuItemRepository.deleteByBusinessId`.
- [ ] Task 1.3: Cập nhật `RestaurantServiceTest` kiểm thử lưu món có tags.
- [ ] Task 1.4: Tạo migration Flyway thêm `pre_order_items` vào `restaurant_reservation_request`.

### Phase 2: AI Menu Extraction Endpoint (`ai-service`)
- [ ] Task 2.1: Tạo router `/api/ai/restaurant-menu/extract` trong `ai-service`.
- [ ] Task 2.2: Xây dựng prompt & Zod schema cho Gemini Multimodal vision nhận diện cấu trúc menu (tên, giá VND, loại món, tags).
- [ ] Task 2.3: Viết unit tests cho menu extraction handler.

### Phase 3: Reservation Pre-Order Logic (`trip-service`)
- [ ] Task 3.1: Mở rộng `CreateRestaurantReservationRequest` và DTO thêm `preOrderItems`.
- [ ] Task 3.2: Xác thực giá và tính khả dụng của món trong `RestaurantReservationService`.
- [ ] Task 3.3: Thêm test case cho luồng đặt bàn có kèm món đặt trước.

### Phase 4: Web UI Integration (`apps/web/tripsense`)
- [ ] Task 4.1: Thêm nút "Quét thực đơn AI" và Dialog Upload & Preview trong `restaurant-menu-view.tsx`.
- [ ] Task 4.2: Tích hợp chọn món đặt trước vào `restaurant-reservation-dialog.tsx`.
- [ ] Task 4.3: Bổ sung i18n đầy đủ cho `en.json` và `vi.json`, chạy `npm run i18n:check`.

### Verification Commands
```bash
# Test trip-service
./mvnw test -pl services/trip-service -Dtest=RestaurantServiceTest,RestaurantReservationServiceTest

# Test ai-service
cd services/ai-service && npm test

# Lint & build frontend
cd apps/web/tripsense && npm run i18n:check && npm run build
```

---

## Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```
> Kế hoạch kỹ thuật chi tiết đã được lập. Vui lòng xem xét và phản hồi `Approved`, `Implement` hoặc `Proceed` để bắt đầu tiến hành sửa lỗi và triển khai tính năng.
