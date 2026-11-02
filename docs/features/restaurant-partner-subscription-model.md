# Restaurant Partner Subscription Model & Direct Value Flow — Specification & Implementation Plan

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, `services/ai-service`
- **Created Date**: 2026-10-27
- **Target PR Boundaries**:
  - Phase 1: Database Migration & Core Subscription Domain (Gói cước, Đơn hàng, PayOS Webhook, Cron kiểm tra hạn dùng)
  - Phase 2: Partner Subscription API & Checkout Service trong `trip-service` + Gateway Routing
  - Phase 3: Frontend Web Partner UI (`/partner/restaurants/[id]/subscription`) — Bảng giá 1T/3T/1N, Trực quan hóa giá trị cho Đối tác, Live Preview & Checkout VietQR PayOS
  - Phase 4: AI Trip Planner & Explore Engine Boost — Ưu tiên đề xuất quán có Subscription `ACTIVE` vào lịch trình ăn uống của du khách

---

## 1. Goal & Requirements

### 1.1 Problem Statement & Strategic Shift
Trước đây, hệ thống định hướng triển khai nghiệp vụ Đặt bàn (`restaurant-booking-availability-engine`) kèm luồng thanh toán tạm giữ Escrow, phân bổ hoa hồng %, ví đối tác và rút tiền. Tuy nhiên, qua phân tích thực tế:
1. **Quán ăn tại Việt Nam không phù hợp với mô hình Booking cọc bàn:** Hầu hết quán ăn địa phương, quán đặc sản, quán cafe không có nhân sự trực phần mềm để duyệt đơn đặt bàn liên tục. Khách du lịch chỉ có nhu cầu tìm quán ngon, xem thực đơn giá cả, đánh giá và đến trực tiếp hoặc liên hệ tự do.
2. **Dòng tiền trung gian (Escrow & Settlement) cồng kềnh, chi phí cao:** Việc sàn đứng ra thu cọc, giữ tiền, trừ hoa hồng từng bữa ăn, mở ví đối tác và duyệt lệnh rút tiền thủ công gây rủi ro tranh chấp (quán hết bàn, khách đến trễ), ngốn chi phí ngân hàng và nhân sự đối soát.

**Giải pháp:** Chuyển đổi 100% sang mô hình **B2B SaaS / Phí Niêm yết & Quảng bá Định kỳ (Subscription Model)**. Quán ăn đóng phí cố định theo chu kỳ (1 Tháng, 3 Tháng, 1 Năm) với các mức ưu đãi hấp dẫn. Không có đặt bàn rườm rà, tiền về thẳng tài khoản doanh thu của TripSense qua PayOS VietQR.

---

### 1.2 Trực quan hóa Giá trị cho Đối tác (Partner Value Proposition & ROI)
Để chủ quán sẵn sàng chi trả gói thuê bao, giao diện đối tác (`/partner/restaurants/[id]/subscription`) và trang giới thiệu phải làm nổi bật **5 Giá trị Vượt trội mà quán nhận được**:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                           BẢNG SO SÁNH GIÁ TRỊ: MIỄN PHÍ vs GÓI ĐỐI TÁC TRẢ PHÍ                       │
├─────────────────────────────────────┬───────────────────────────┬─────────────────────────────────────┤
│ Tính năng & Quyền lợi               │ Quán Miễn Phí (Free)      │ Quán Đăng Ký Gói (Partner Pro)     │
├─────────────────────────────────────┼───────────────────────────┼─────────────────────────────────────┤
│ 1. AI Trip Planner Recommendation   │ Xếp sau, không ưu tiên    │ ⭐ Ưu tiên TOP 1 gợi ý lịch trình   │
│ 2. Huy hiệu Đối tác Xác thực        │ ❌ Không có               │ 🛡️ Verified Partner Badge uy tín    │
│ 3. Ghim nổi bật trên Bản đồ (Maps)  │ Ghim xám thông thường     │ 📍 Ghim Nổi Bật (Featured Pin)      │
│ 4. Menu ảnh & Món đặc sản           │ Tối đa 3 món cơ bản       │ 📸 Không giới hạn ảnh đẹp + món hot │
│ 5. Hotline & Chỉ đường trực tiếp    │ Giới hạn click            │ 📞 Nút Gọi Ngay & Chỉ đường 1-chạm  │
│ 6. Báo cáo Tương tác (Analytics)    │ Ẩn thống kê               │ 📊 Báo cáo realtime: view, add trip │
│ 7. Chiết khấu hoa hồng từng đơn     │ 0%                        │ 0% (Giữ trọn 100% doanh thu ăn uống)│
└─────────────────────────────────────┴───────────────────────────┴─────────────────────────────────────┘
```

#### Những con số thuyết phục Chủ Quán:
- **"Tiếp cận 50.000+ du khách mỗi tháng"**: Du khách sử dụng TripSense để tạo lịch trình đi qua khu vực/thành phố của quán.
- **"Tăng gấp 3 lần tỷ lệ hiển thị"**: Thuật toán AI Trip Planner tự động lấp đầy các bữa ăn trong ngày bằng các quán đã kích hoạt gói.
- **"Không mất hoa hồng từng đĩa ăn"**: Quán không phải chia 10-20% doanh thu cho sàn như Grab/ShopeeFood. Chỉ trả một khoản phí cố định siêu nhỏ mỗi ngày (~4.000đ - 6.000đ/ngày).

---

### 1.3 Cấu trúc Gói cước (Subscription Plans) & Khuyến mãi

| Mã Gói | Tên Gói | Thời hạn | Giá Niêm Yết | Giá Khuyến Mãi | Ưu đãi & Thông điệp kích cầu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PLAN_1_MONTH` | **Gói Khám Phá (1 Tháng)** | 30 ngày | 249.000đ | **199.000đ** | Linh hoạt, dành cho quán muốn chạy thử nghiệm hiệu quả. |
| `PLAN_3_MONTHS` | **Gói Tăng Trưởng (3 Tháng)** | 90 ngày | 599.000đ | **499.000đ** | **Tiết kiệm 16%** (~166k/tháng). Phù hợp đón mùa du lịch cao điểm. |
| `PLAN_1_YEAR` | **Gói Đối Tác Kim Cương (1 Năm)** | 365 ngày | 2.388.000đ | **1.599.000đ** | **Tiết kiệm 33% (Tặng 4 tháng)** (~133k/tháng). Ưu đãi vị trí số 1 trên Bản đồ + Huy hiệu VIP. |

---

### 1.4 User Flows & Journeys

#### Luồng 1: Đối tác Xem Lợi ích & Mua Gói Thuê bao
1. Chủ quán vào `/partner/restaurants/{businessId}/subscription`.
2. Hệ thống hiển thị:
   - Thẻ hiển thị trạng thái hiện tại (ví dụ: `TRIAL` hoặc `EXPIRED` hoặc `ACTIVE: Còn 15 ngày`).
   - Khung **"Dự phóng tiếp cận"**: hiển thị số lượt khách du lịch đã tìm kiếm ăn uống tại khu vực quán trong 30 ngày qua.
   - Bảng 3 gói cước (1 Tháng, 3 Tháng, 1 Năm) với nhãn **"Bán chạy nhất" (Gói 3T)** và **"Tiết kiệm nhất" (Gói 1N)**.
3. Chủ quán chọn gói (ví dụ: Gói 1 Năm - 1.599.000đ) $\rightarrow$ Bấm **"Kích hoạt ngay"**.
4. Hệ thống gọi API tạo đơn thanh toán PayOS $\rightarrow$ Bật Modal mã VietQR chứa đúng số tiền và nội dung chuyển khoản.
5. Chủ quán mở app ngân hàng quét mã VietQR và xác nhận chuyển tiền.
6. PayOS xác thực giao dịch $\rightarrow$ Webhook bắn về Trip Service:
   - Ghi nhận đơn hàng `PAID`.
   - Cập nhật thời hạn `valid_to = now() + 365 ngày`, trạng thái chuyển `ACTIVE`.
7. Màn hình của đối tác tự động chuyển sang trạng thái chúc mừng: **"Kích hoạt thành công! Quán của bạn đã được ưu tiên hiển thị trên TripSense"**.

#### Luồng 2: Trải nghiệm Du khách (Traveler Discovery Flow)
1. Du khách tạo chuyến đi Đà Nẵng bằng AI Trip Planner.
2. AI tự động chọn các quán có `subscription_status = 'ACTIVE'` để đưa vào lịch trình: *"Trưa Ngày 2: Thưởng thức đặc sản tại [Tên Quán] (Đối tác uy tín)"*.
3. Du khách bấm vào quán: xem toàn bộ Menu món ngon kèm giá, giờ mở cửa, ảnh không gian.
4. Du khách bấm **"Chỉ đường"** (mở Google Maps) hoặc bấm **"Gọi hotline"** để đặt bàn nếu đi đoàn đông.
5. Khách đến ăn, thanh toán trực tiếp tại quán. Sàn không can thiệp dòng tiền bữa ăn.

#### Luồng 3: Hết hạn & Tự động Nhắc Gia hạn
1. Cronjob chạy hàng ngày kiểm tra các subscription sắp hết hạn.
2. Trước 7 ngày và 3 ngày: Hệ thống gửi thông báo trong ứng dụng và email cho chủ quán: *"Gói đối tác của bạn còn 3 ngày. Gia hạn ngay để không bị gián đoạn đề xuất AI!"*.
3. Khi đến ngày `valid_to`: Trạng thái chuyển sang `EXPIRED`. Dữ liệu quán vẫn giữ nguyên, chỉ tạm thời tắt huy hiệu Verified và hạ ưu tiên AI.

---

### 1.5 Scope Boundaries
- **In-Scope**:
  - Quản lý gói cước (1 Tháng, 3 Tháng, 1 Năm) cho loại hình cơ sở `RESTAURANT`.
  - Tích hợp thanh toán PayOS VietQR tự động kích hoạt gói qua Webhook.
  - Quản lý trạng thái gói (`TRIAL`, `ACTIVE`, `EXPIRED`) và gia hạn cộng dồn thời gian.
  - Giao diện Đối tác hiển thị bảng so sánh quyền lợi, giá trị ROI, và thanh toán QR.
  - Cập nhật API lấy danh sách nhà hàng công khai / gợi ý AI để ưu tiên quán đang `ACTIVE`.
  - Thông báo nhắc gia hạn tự động.
- **Out-of-Scope**:
  - Không triển khai đặt cọc giữ bàn trực tuyến, không quản lý tồn số ghế/bàn theo giờ.
  - Không mở ví đối tác và lệnh rút tiền cho quán ăn (luồng này chỉ dành cho Khách sạn).
  - Không trừ hoa hồng % trên hóa đơn bữa ăn của khách.

---

### 1.6 Acceptance Criteria
- [ ] **AC-1**: Đối tác quán ăn có thể xem các gói thuê bao 1 Tháng, 3 Tháng, 1 Năm kèm chi tiết quyền lợi và mức giảm giá tương ứng.
- [ ] **AC-2**: Khi chọn gói, hệ thống sinh mã VietQR PayOS chuẩn xác với số tiền và mã đơn hàng duy nhất trong vòng < 1 giây.
- [ ] **AC-3**: Webhook PayOS xử lý idempotent; khi nhận callback thanh toán thành công, hệ thống cập nhật `valid_to` chính xác theo số ngày của gói (nếu đang còn hạn thì cộng dồn tiếp).
- [ ] **AC-4**: Quán có gói `ACTIVE` hiển thị huy hiệu `VERIFIED_PARTNER` trên Web công khai và được AI Trip Planner gắn trọng số ưu tiên cao khi tìm kiếm quán ăn.
- [ ] **AC-5**: Quán hết hạn chuyển sang `EXPIRED` một cách an toàn, không làm mất menu hay thông tin quán, và có thể gia hạn lại bất kỳ lúc nào.
- [ ] **AC-6**: Toàn bộ luồng tiền thanh toán gói đi thẳng vào tài khoản doanh thu của TripSense, không sinh bản ghi Escrow hay ví giữ hộ.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[Chủ Quán Ăn (Partner)]                      [Khách Du Lịch (Traveler)]
         │                                               │
         │ 1. Chọn gói & Quét VietQR                    │ 5. Xem quán & AI gợi ý
         ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY (:8085)                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRIP SERVICE (:8084)                               │
│                                                                             │
│  ┌───────────────────────────────┐     ┌─────────────────────────────────┐  │
│  │  RestaurantSubscriptionService│     │      RestaurantPublicService    │  │
│  │  - Khởi tạo thanh toán PayOS  │     │  - Trả về danh sách quán ăn     │  │
│  │  - Xử lý Webhook kích hoạt    │     │  - Gắn nhãn Verified Partner    │  │
│  │  - Cron kiểm tra hết hạn      │     │  - Ưu tiên quán có gói Active   │  │
│  └───────────────┬───────────────┘     └─────────────────────────────────┘  │
│                  │                                                          │
│                  ▼                                                          │
│  ┌───────────────────────────────┐                                          │
│  │     Trip Service Database     │                                          │
│  │  - restaurant_sub_plan        │                                          │
│  │  - restaurant_sub             │                                          │
│  │  - restaurant_sub_payment     │                                          │
│  └───────────────────────────────┘                                          │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
                   ▼ (Tạo Link & Nhận Webhook)
            ┌──────────────┐
            │ PayOS VietQR │ ───► Tiền vào Ngân hàng Platform
            └──────────────┘
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Giao diện đăng ký gói cho Partner, hiển thị huy hiệu & Menu cho du khách | REST qua API Gateway |
| `services/api-gateway` | Điều phối route `/api/partners/restaurants/**/subscription`, `/api/webhooks/payos/**` | Spring Cloud Gateway |
| `services/trip-service` | Sở hữu toàn bộ logic gói cước, trạng thái thuê bao, gọi SDK PayOS và lưu trữ DB | REST đồng bộ, Flyway, Scheduled Cron |
| `services/ai-service` | Sử dụng cờ `is_verified_partner` / `has_active_subscription` từ Trip Service để ưu tiên đề xuất vào lịch trình | REST / Internal DTOs |

---

## 3. API Contracts

### 3.1 Public & Partner Endpoints

| Method | Gateway Path | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/restaurants/subscription-plans` | Public | Lấy danh sách 3 gói cước kèm giá & ưu đãi |
| `GET` | `/api/partners/businesses/{businessId}/restaurant-subscription` | Partner JWT (OWNER/MANAGER) | Lấy thông tin gói cước hiện tại của quán & lịch sử giao dịch |
| `POST` | `/api/partners/businesses/{businessId}/restaurant-subscription/checkout` | Partner JWT (OWNER/MANAGER) | Tạo yêu cầu thanh toán gói cước qua PayOS VietQR |
| `POST` | `/api/webhooks/payos/restaurant-subscription` | PayOS Signature | Webhook nhận thông báo tiền về từ PayOS để kích hoạt gói |

#### Request Body: Checkout Gói Cước
```json
{
  "planId": "PLAN_1_YEAR",
  "returnUrl": "https://tripsense.vn/partner/restaurants/a1b2c3d4/subscription?status=success",
  "cancelUrl": "https://tripsense.vn/partner/restaurants/a1b2c3d4/subscription?status=cancelled"
}
```

#### Response Body: Checkout Gói Cước (200 OK)
```json
{
  "orderId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "orderCode": 1029384756,
  "planId": "PLAN_1_YEAR",
  "planName": "Gói Đối Tác Kim Cương (1 Năm)",
  "amount": 1599000,
  "qrCode": "vietqr://...",
  "paymentUrl": "https://pay.payos.vn/web/...",
  "status": "PENDING"
}
```

#### Response Body: Lấy trạng thái Thuê bao hiện tại (200 OK)
```json
{
  "businessId": "a1b2c3d4-...",
  "status": "ACTIVE",
  "currentPlan": {
    "planId": "PLAN_1_YEAR",
    "name": "Gói Đối Tác Kim Cương (1 Năm)",
    "durationDays": 365
  },
  "validFrom": "2026-10-27T10:00:00Z",
  "validTo": "2027-10-27T10:00:00Z",
  "daysRemaining": 365,
  "isAutoRenew": false,
  "perks": {
    "aiRecommendationBoost": true,
    "verifiedBadge": true,
    "featuredMapPin": true,
    "unlimitedMenuPhotos": true,
    "directContactLead": true
  }
}
```

---

## 4. Data Model & Migrations

### 4.1 Flyway Migration Script
Tạo file: `services/trip-service/src/main/resources/db/migration/V20261028100000__restaurant_partner_subscription_model.sql`

```sql
-- 1. Bảng danh mục các gói thuê bao cố định
CREATE TABLE IF NOT EXISTS restaurant_subscription_plan (
    plan_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration_days INT NOT NULL,
    price_vnd DECIMAL(12, 2) NOT NULL,
    original_price_vnd DECIMAL(12, 2),
    discount_percent INT DEFAULT 0,
    tagline VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Khởi tạo dữ liệu sẵn cho 3 gói
INSERT INTO restaurant_subscription_plan 
(plan_id, name, duration_days, price_vnd, original_price_vnd, discount_percent, tagline, display_order)
VALUES 
('PLAN_1_MONTH', 'Gói Khám Phá (1 Tháng)', 30, 199000, 249000, 20, 'Linh hoạt trải nghiệm & đánh giá hiệu quả', 1),
('PLAN_3_MONTHS', 'Gói Tăng Trưởng (3 Tháng)', 90, 499000, 599000, 16, 'Tiết kiệm 16% - Đón đầu mùa du lịch', 2),
('PLAN_1_YEAR', 'Gói Đối Tác Kim Cương (1 Năm)', 365, 1599000, 2388000, 33, 'Tiết kiệm 33% - Tặng 4 tháng, ưu tiên Top 1', 3)
ON CONFLICT (plan_id) DO NOTHING;

-- 2. Bảng theo dõi gói thuê bao của từng quán ăn
CREATE TABLE IF NOT EXISTS restaurant_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES partner_businesses(id) ON DELETE CASCADE,
    current_plan_id VARCHAR(50) REFERENCES restaurant_subscription_plan(plan_id),
    status VARCHAR(30) NOT NULL DEFAULT 'TRIAL', -- 'TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED'
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_restaurant_subscription_business UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_sub_status_valid_to 
ON restaurant_subscription(status, valid_to);

-- 3. Bảng lịch sử thanh toán PayOS
CREATE SEQUENCE IF NOT EXISTS restaurant_payos_order_code_seq START WITH 20000001;

CREATE TABLE IF NOT EXISTS restaurant_subscription_payment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code BIGINT NOT NULL UNIQUE DEFAULT nextval('restaurant_payos_order_code_seq'),
    business_id UUID NOT NULL REFERENCES partner_businesses(id),
    plan_id VARCHAR(50) NOT NULL REFERENCES restaurant_subscription_plan(plan_id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'CANCELLED', 'FAILED'
    payos_payment_link_id VARCHAR(100),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restaurant_payment_biz 
ON restaurant_subscription_payment(business_id, created_at DESC);
```

---

## 5. Security & Trust Boundaries

| Khu vực rủi ro | Biện pháp bảo vệ |
| :--- | :--- |
| **Quyền sở hữu quán (Anti-IDOR)** | Endpoint checkout kiểm tra chặt chẽ `business_member` của user: chỉ tài khoản có vai trò `OWNER` hoặc `MANAGER` của đúng `business_id` mới được phép thao tác. |
| **Xác thực Webhook PayOS** | Webhook từ PayOS bắt buộc kiểm tra chữ ký số HMAC-SHA256 (`payos.checksum-key`). Nếu sai chữ ký lập tức trả `400 Bad Request` và không kích hoạt gói. |
| **Bảo vệ Idempotency** | Xử lý Webhook dựa trên `order_code`. Nếu trạng thái đơn đã là `PAID`, hệ thống trả về `200 OK` ngay lập tức mà không cộng dồn ngày 2 lần. |
| **Bảo mật giá trị gói cước** | Số tiền thanh toán (`amount`) được lấy trực tiếp từ bảng cơ sở dữ liệu `restaurant_subscription_plan`, tuyệt đối không nhận `amount` gửi từ frontend client. |

---

## 6. Devil's Advocate & Trade-offs

| Thách thức | Phân tích & Giải pháp |
| :--- | :--- |
| **Quán còn hạn nhưng mua thêm gói mới** | **Cộng dồn thời gian (Accumulative Extension):** Nếu quán đang còn hạn đến `2026-12-01` và mua tiếp gói 1 Năm, thời hạn mới sẽ là `2027-12-01` (bắt đầu tính tiếp từ ngày hết hạn cũ thay vì tính từ hôm nay). Điều này khuyến khích đối tác mua gia hạn sớm. |
| **Có cần tự động trừ tiền thẻ tín dụng (Recurring Billing) không?** | **Không:** Tại Việt Nam, phương thức VietQR quét mã một lần qua App Ngân hàng có tỷ lệ thành công và độ tin cậy cao hơn nhiều so với auto-debit thẻ tín dụng. TripSense sử dụng cơ chế nhắc nhở trước 7 ngày để chủ quán chủ động quét mã gia hạn. |
| **Xử lý các quán không đóng phí thế nào?** | Quán vẫn hiển thị cơ bản trên bản đồ để đảm bảo kho dữ liệu phong phú cho du khách, nhưng không có huy hiệu Verified, không được AI ưu tiên và bị giới hạn tính năng Menu/Analytics. Quán không bị xóa dữ liệu. |

---

## 7. Phased Implementation Tasks

### Phase 1: Database & Backend Core (`trip-service`)
- [ ] Task 1.1: Tạo file migration Flyway `V20261028100000__restaurant_partner_subscription_model.sql`.
- [ ] Task 1.2: Tạo JPA Entities: `RestaurantSubscriptionPlan`, `RestaurantSubscription`, `RestaurantSubscriptionPayment`.
- [ ] Task 1.3: Tạo `RestaurantSubscriptionService`: logic tạo link thanh toán PayOS VietQR, tính toán ngày hết hạn, xử lý Webhook.
- [ ] Task 1.4: Tạo Cronjob hàng ngày `SubscriptionExpiryJob` quét các quán hết hạn và gửi thông báo nhắc nhở trước 7 ngày.

### Phase 2: Controllers & Gateway Routing
- [ ] Task 2.1: Thêm `RestaurantSubscriptionController` với các endpoints: lấy danh sách gói, lấy subscription hiện tại, tạo checkout.
- [ ] Task 2.2: Thêm Webhook Controller xác thực chữ ký PayOS.
- [ ] Task 2.3: Cập nhật API lấy thông tin nhà hàng (`RestaurantController`) trả về cờ `verifiedPartner` và `activeSubscription`.
- [ ] Task 2.4: Đảm bảo Spring Cloud Gateway định tuyến chính xác các route mới.

### Phase 3: Web Partner Experience (`apps/web/tripsense`)
- [ ] Task 3.1: Xây dựng trang Quản lý Gói cước Đối tác tại `/partner/restaurants/[id]/subscription`.
- [ ] Task 3.2: Thiết kế Component **Bảng So Sánh Quyền Lợi (ROI Matrix)** và **Khung Dự Phóng Lượt Tiếp Cận Khách Du Lịch**.
- [ ] Task 3.3: Tích hợp Popup mã VietQR PayOS tự động polling trạng thái thanh toán thành công.
- [ ] Task 3.4: Hiển thị Huy hiệu `Verified Partner` trên thẻ quán ăn và trang chi tiết quán ăn phía người dùng.

### Phase 4: Tích hợp AI Trip Planner & Explore Engine
- [ ] Task 4.1: Cập nhật câu prompt và thuật toán chọn địa điểm ăn uống của AI để ưu tiên các quán có cờ `verifiedPartner = true`.
- [ ] Task 4.2: Kiểm tra nghiệm thu toàn bộ hành trình từ thanh toán gói đến hiển thị trên lịch trình du lịch.

---

## Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```
> Kế hoạch kỹ thuật cho Mô hình Thu phí Gói Định kỳ Đối tác Quán ăn (Subscription Model) đã được thiết kế đầy đủ, giải quyết triệt để bài toán dòng tiền tinh gọn và tối đa hóa việc thể hiện lợi ích cho chủ quán.
> Vui lòng xác nhận để bắt đầu triển khai code!
