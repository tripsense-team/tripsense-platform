# Partner Cleanup & Unified Subscription Redesign — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`, `services/ai-service`
- **Created Date**: 2026-10-28
- **Target PR Boundaries**:
  - Phase 1: Database Migration & Cleanup (Xóa/Drop bảng nghiệp vụ cũ: booking, availability, wallet, withdrawal; Chuẩn hóa bảng Subscription & Order)
  - Phase 2: Backend `trip-service` Refactoring (Xóa code booking/wallet/escrow cũ, nâng cấp `PartnerSubscriptionService` khắc phục lỗi phân quyền/kind mismatch/PayOS fallback)
  - Phase 3: Frontend Web Refactoring (Xóa các view đặt chỗ/ví cũ, tinh gọn giao diện Đối tác, hoàn thiện Modal thanh toán VietQR & kích hoạt tức thì)
  - Phase 4: Tích hợp AI Recommendation & Explore Boost cho đối tác Pro

---

## 1. Goal & Requirements

### 1.1 Problem Statement & Strategic Shift
Trước đây, hệ thống Đối tác của TripSense bị phân mảnh và ôm đồm quá nhiều nghiệp vụ phức tạp:
1. **Khách sạn (`HOTEL`):** Giữ tiền phòng qua PayOS, cơ chế ký quỹ Escrow, chia hoa hồng % sàn, tạo ví đối tác (`partner_wallet`), quản lý lệnh rút tiền (`partner_withdrawal_request`), duyệt đối soát tài chính thủ công.
2. **Nhà hàng (`RESTAURANT`):** Quản lý tình trạng bàn theo khung giờ (`restaurant_availability`), nhận yêu cầu đặt cọc & giữ bàn trực tuyến (`restaurant_reservation_request`), xử lý chuyển trạng thái đặt chỗ phức tạp.
3. **Hướng dẫn viên (`TOUR_GUIDE`):** Tiếp nhận inquiry đặt tour thủ công có ràng buộc đặt cọc.

**Hậu quả:**
* Codebase cồng kềnh, hàng chục bảng dữ liệu ràng buộc chồng chéo.
* Phát sinh lỗi phân quyền và luồng tiền khó kiểm soát.
* Người dùng gặp lỗi khi bấm "Kích hoạt ngay" do vướng kiểm tra phân quyền thành viên cũ (`requireMember`), không khớp ngành nghề (`INVALID_PLAN_KIND`), hoặc lỗi kết nối PayOS khi thiếu cấu hình môi trường.

**Định hướng thiết kế mới:**
* **Dọn dẹp triệt để (100% Cleanup):** Xóa bỏ toàn bộ luồng booking, đặt bàn, đặt cọc giữ chỗ, ví ký quỹ escrow, lệnh rút tiền và đối soát tài chính cũ.
* **Mô hình Thuê bao Tinh gọn (Pure Subscription SaaS):**
  - Mọi đối tác (`RESTAURANT`, `HOTEL`, `TOUR_GUIDE`) đều chỉ quản lý thông tin hồ sơ và mua gói cước cố định (1 Tháng, 3 Tháng, 1 Năm) với ưu đãi rõ ràng.
  - Du khách xem thông tin, thực đơn, hạng phòng và **liên hệ trực tiếp** với đối tác (Hotline, Zalo, Website, Link OTA, Google Maps). Đối tác hưởng trọn **100% doanh thu (0% hoa hồng)**.
  - Luồng thanh toán gói PayOS VietQR có cơ chế tự động kích hoạt qua Webhook, kèm nút "Xác nhận đã chuyển khoản" để tự kiểm tra tức thì trong môi trường kiểm thử.

---

### 1.2 User Flows & Journey

```text
[Partner Owner]
      │
      ▼
1. Vào /partner -> Thấy thẻ cơ sở -> Bấm "✨ Gói Hội Viên & Tiếp Cận AI"
      │
      ▼
2. Xem Bảng quyền lợi & Chọn gói (1 Tháng / 3 Tháng / 1 Năm)
      │
      ▼
3. Bấm "Kích hoạt ngay" -> Hệ thống tạo đơn hàng PayOS & Hiện Modal VietQR (Kèm mã QR, STK, Số tiền, Nội dung chuyển khoản)
      │
      ├──────────────────────────────┬──────────────────────────────┐
      ▼                              ▼                              ▼
(Quét mã PayOS VietQR)     (Polling tự động 3s)          (Nút "Kiểm tra thanh toán")
      │                              │                              │
      ▼                              ▼                              ▼
Webhook xác nhận thành công ───────► Kích hoạt gói ACTIVE ────────► Tự động gia hạn thời gian
                                     (Tích xanh Verified)
```

---

### 1.3 Scope Boundaries

- **In-Scope**:
  - Dọn dẹp sạch sẽ các bảng, entity, service, controller và UI liên quan đến booking/escrow/wallet cũ.
  - Sửa lỗi nút "Kích hoạt ngay":
    1. Kiểm tra quyền sở hữu linh hoạt: Chấp nhận cả `owner_user_id` trên `PartnerBusiness` và bảng `PartnerBusinessMember`.
    2. Tự động đồng bộ gói cước theo đúng `business.kind` của cơ sở (tránh lỗi `INVALID_PLAN_KIND`).
    3. Hỗ trợ fallback sinh VietQR chuẩn ngân hàng tĩnh hoặc test mode nếu PayOS credentials chưa được nạp.
  - Hoàn thiện luồng kiểm tra trạng thái thanh toán và kích hoạt gói ngay trên modal.
  - Gắn nhãn `Verified Partner`, `Verified Accommodation`, `Verified Local Guide` trên toàn bộ trang công khai và danh sách tìm kiếm.
  - Ưu tiên hiển thị cơ sở có gói `ACTIVE` trong AI Trip Planner.

- **Out-of-Scope**:
  - Không xây dựng lại bất kỳ tính năng đặt cọc tiền hay giữ chỗ ăn uống nào trên nền tảng.
  - Không can thiệp vào tài khoản ngân hàng của khách du lịch (du khách tự thanh toán trực tiếp cho đối tác).

---

### 1.4 Acceptance Criteria

- [ ] **AC-1 (Dọn dẹp DB):** Migration Flyway loại bỏ hoặc đánh dấu deprecate an toàn các bảng ví/rút tiền/đặt chỗ cũ (`restaurant_reservation_request`, `restaurant_availability`, `partner_wallet`, `partner_withdrawal_request`, `financial_ledger_entry`).
- [ ] **AC-2 (Dọn dẹp Codebase):** Xóa bỏ các controller/service/view cũ không còn sử dụng (`/hotel/commerce`, `restaurant-reservation-modal`, `withdrawal-modal`).
- [ ] **AC-3 (Kích hoạt mượt mà):** Nút "Kích hoạt ngay" trên trang `/subscription` luôn mở modal VietQR thành công 100% cho chủ cơ sở, không bị lỗi 403 Forbidden hay 400 Invalid Plan Kind.
- [ ] **AC-4 (Thanh toán & Kích hoạt):** Hỗ trợ đầy đủ: Quét mã PayOS thật, Webhook tự động kích hoạt, Polling 3s cập nhật trạng thái, và nút kiểm tra thủ công.
- [ ] **AC-5 (Gia hạn lũy tiến):** Mua thêm gói khi đang còn hạn sẽ cộng dồn số ngày vào ngày hết hạn hiện tại.
- [ ] **AC-6 (Huy hiệu & Đề xuất AI):** Cơ sở có gói Active có huy hiệu xác thực trên trang công khai và được ưu tiên đề xuất trong lịch trình chuyến đi.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[Partner Browser] 
       │
       ▼ (POST /api/partners/businesses/{id}/subscription/checkout)
[API Gateway :8080] 
       │ (JWT Token + Header Forwarding)
       ▼
[Trip Service :8084]
       ├── 1. Xác thực quyền: user.id == business.owner_user_id HOẶC member.role in (OWNER, MANAGER)
       ├── 2. Tạo SubscriptionOrder (Trạng thái: PENDING)
       ├── 3. Gọi PayOS API tạo Link thanh toán VietQR (hoặc sinh fallback VietQR URL)
       └── 4. Trả về QR Code + Order Code cho Frontend Modal
```

### 2.2 Danh mục chi tiết các thành phần cần dọn dẹp (Cleanup List)

#### A. Database Tables cần xóa / drop:
| Bảng cũ | Mục đích cũ | Hướng xử lý |
| --- | --- | --- |
| `restaurant_reservation_request` | Đặt bàn nhà hàng | Xóa (DROP) |
| `restaurant_reservation_transition` | Lịch sử trạng thái đặt bàn | Xóa (DROP) |
| `restaurant_availability` | Cấu hình số lượng bàn | Xóa (DROP) |
| `restaurant_opening_interval` | Giờ mở cửa đặt chỗ | Tích hợp vào JSON profile cơ sở, bỏ bảng riêng |
| `partner_wallet` | Ví tiền tích lũy của đối tác | Xóa (DROP) |
| `partner_withdrawal_request` | Lệnh rút tiền về ngân hàng | Xóa (DROP) |
| `financial_ledger_entry` | Sổ cái tài chính đối soát | Xóa (DROP) |
| `hotel_booking` | Đặt phòng qua sàn | Xóa (DROP) |
| `hotel_demo_*` / `hotel_voucher*` | Demo luồng giữ tiền cũ | Xóa (DROP) |

#### B. Backend Code trong `services/trip-service` cần dọn dẹp:
- Xóa các class: `RestaurantReservationService`, `RestaurantAvailabilityService`, `RestaurantReservationController`, `PartnerWithdrawalService`, `PartnerWalletService`.
- Sửa `PartnerSubscriptionService`:
  ```java
  // Bỏ requireMember cứng nhắc, chấp nhận cả ownerUserId trực tiếp
  private void checkPartnerAccess(AuthenticatedUser user, PartnerBusiness business) {
    if (user == null) throw new TripServiceException("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    if (business.getOwnerUserId().equals(user.id())) return; // Owner hợp lệ!
    boolean isManager = memberRepository.findByIdBusinessIdAndIdUserId(business.getId(), user.id())
        .map(m -> m.getState() == MembershipState.ACTIVE && (m.getRole() == MembershipRole.OWNER || m.getRole() == MembershipRole.MANAGER))
        .orElse(false);
    if (!isManager) throw new TripServiceException("FORBIDDEN", "Bạn không có quyền quản lý cơ sở này", HttpStatus.FORBIDDEN);
  }
  ```

#### C. Frontend Code trong `apps/web/tripsense` cần dọn dẹp:
- Xóa bỏ folder/route: `/partner/businesses/[businessId]/hotel/commerce` (Đối soát & Rút tiền).
- Xóa bỏ các modal đặt bàn, component kiểm tra lịch giữ chỗ cũ.
- Chuẩn hóa trang Hub `/partner/services` và trang mua gói `/subscription`.

---

## 3. Database Schema (Mô hình Mới Tinh Gọn)

```sql
-- 1. Bảng danh mục gói cước
CREATE TABLE IF NOT EXISTS partner_subscription_plan (
    plan_id VARCHAR(50) PRIMARY KEY,
    business_kind VARCHAR(30) NOT NULL, -- 'HOTEL', 'RESTAURANT', 'TOUR_GUIDE'
    name VARCHAR(100) NOT NULL,
    duration_days INT NOT NULL,         -- 30, 90, 365
    price_vnd DECIMAL(12, 2) NOT NULL,
    original_price_vnd DECIMAL(12, 2),
    discount_percent INT DEFAULT 0,
    tagline VARCHAR(255),
    badge_label VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng theo dõi gói thuê bao của cơ sở
CREATE TABLE IF NOT EXISTS partner_subscription (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    current_plan_id VARCHAR(50) REFERENCES partner_subscription_plan(plan_id),
    status VARCHAR(30) NOT NULL DEFAULT 'TRIAL', -- 'TRIAL', 'ACTIVE', 'EXPIRED'
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_partner_subscription_business UNIQUE (business_id)
);

-- 3. Bảng đơn hàng PayOS VietQR
CREATE TABLE IF NOT EXISTS partner_subscription_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code BIGINT NOT NULL UNIQUE,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    plan_id VARCHAR(50) NOT NULL REFERENCES partner_subscription_plan(plan_id),
    amount DECIMAL(12, 2) NOT NULL,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'CANCELLED'
    payos_payment_link_id VARCHAR(100),
    qr_code TEXT,
    payment_url TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. API & Contract Specifications

### 4.1 Danh sách API Thuê bao Đối tác
| Method | Endpoint | Quyền hạn | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api/subscription-plans?businessKind=...` | Public | Lấy danh mục 3 gói cước theo ngành |
| `GET` | `/api/partners/businesses/{id}/subscription` | Owner/Manager | Xem gói hiện tại & ngày hết hạn |
| `POST` | `/api/partners/businesses/{id}/subscription/checkout` | Owner/Manager | Tạo đơn thanh toán VietQR |
| `GET` | `/api/partners/businesses/{id}/subscription/orders/{code}/status` | Owner/Manager | Polling trạng thái đơn hàng |
| `POST` | `/api/partners/businesses/{id}/subscription/orders/{code}/verify-manual` | Owner/Manager | Nút kiểm tra kích hoạt tức thì |
| `POST` | `/api/partners/subscriptions/payos/webhook` | Webhook (HMAC) | Nhận thông báo tiền về từ PayOS |

---

## 5. Implementation Steps & PR Plan

### Phase 1: Database Migration (Flyway)
1. Viết script migration `V20261028120000__cleanup_legacy_partner_and_finalize_subscriptions.sql`:
   - Drop các bảng đặt chỗ và ví cũ an toàn.
   - Bổ sung chỉ mục tối ưu cho `partner_subscription` và `partner_subscription_order`.

### Phase 2: Backend `trip-service` Refactoring
1. Loại bỏ các file service/controller của booking cũ.
2. Nâng cấp `PartnerSubscriptionService`:
   - Thêm phương thức `checkPartnerAccess` cho phép trực tiếp `business.getOwnerUserId().equals(user.id())`.
   - Bổ sung fallback sinh VietQR chuẩn ngân hàng tĩnh hoặc test sandbox khi chưa nạp API key PayOS thật.
   - Thêm endpoint `POST .../verify-manual` cho phép đối tác bấm xác nhận kích hoạt ngay trên giao diện thử nghiệm.

### Phase 3: Frontend Refactoring & Verification
1. Xóa các component và route con của luồng ví cũ (`hotel/commerce`, đặt bàn cũ).
2. Nâng cấp Modal thanh toán VietQR:
   - Hiển thị QR Code ngân hàng sắc nét, thông tin số tài khoản, tên chủ thẻ và mã đơn hàng.
   - Thêm nút "Tôi đã chuyển khoản thành công" để kích hoạt gói ngay lập tức trên UI.
   - Hiển thị thông báo chúc mừng & thời hạn gói cước tự động nhảy sang màu xanh `Đang hoạt động`.

### Phase 4: Test Suite & Documentation Verification
1. Chạy toàn bộ test suites (`mvn test` trên backend, `npm test` trên frontend).
2. Đảm bảo 100% tuân thủ zero-leak error handling và i18n chuẩn hóa.

---

## 6. Approval Gate
Vui lòng phản hồi **"Approved"** hoặc **"Triển khai"** để tôi tiến hành xóa sạch các thành phần cũ và hoàn thiện toàn bộ luồng gói hội viên mới!
