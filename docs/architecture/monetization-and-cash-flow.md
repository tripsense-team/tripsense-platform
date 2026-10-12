# TripSense Monetization & 3-Party Cash Flow Architecture

Tài liệu đặc tả kiến trúc luồng tiền 3 bên (**Khách hàng - Nền tảng (Admin) - Đối tác (Partner)**), mô hình ký quỹ trung gian (Escrow), cơ chế đối soát thanh toán và các chiến lược tạo lợi nhuận cho quản trị viên TripSense.

---

## 1. Nguyên tắc cốt lõi: Mô hình Ký quỹ Trung gian (Escrow Model)

Để đảm bảo quyền lợi cho khách hàng, tránh đối tác bùng kèo hoặc không thực hiện dịch vụ, và đảm bảo **Admin thu được 100% lợi nhuận hoa hồng một cách tự động**, toàn bộ dòng tiền chảy qua hệ sinh thái TripSense bắt buộc tuân theo nguyên tắc:

> **Tiền đi qua Admin trước, dịch vụ hoàn thành mới giải ngân cho Partner.**

```text
┌────────────────┐                     ┌────────────────────────┐
│  Khách hàng    │                     │   Cổng PayOS / Ngân    │
│  (Traveler)    │                     │   hàng trung gian      │
└───────┬────────┘                     └───────────┬────────────┘
        │ 1. Trả 100% tiền đơn (Gross)             │
        ▼                                          │
┌──────────────────────────────────────────────────┴────────────┐
│              Tài khoản Merchant TripSense (Admin)             │
│            ──► Trạng thái: ESCROW_HOLDING (Ký quỹ)            │
└───────┬──────────────────────────┬────────────────────────────┘
        │ 2. Giữ đến khi check-out │
        ▼                          ▼
┌──────────────────┐       ┌────────────────┐       ┌───────────────────┐
│ Hoa hồng Admin   │       │ Phí cổng TT    │       │ Giải ngân cho     │
│ (10% Commission) │       │ (~1.5% PayOS)  │       │ Partner (90% Net) │
│ = LỢI NHUẬN RÒNG │       │ = Chi phí vốn  │       │ = Chu kỳ T+3/T+7  │
└──────────────────┘       └────────────────┘       └─────────┬─────────┘
                                                              │ 3. Payout
                                                              ▼
                                                    ┌───────────────────┐
                                                    │ Đối tác (Partner) │
                                                    │ Khách sạn, Tour   │
                                                    └───────────────────┘
```

---

## 2. Vòng đời giao dịch 4 giai đoạn (Transaction Lifecycle)

### Giai đoạn 1: Đặt chỗ & Thu tiền tức thì (Booking & Capture)
1. **Khách hàng**: Chọn phòng khách sạn, tour du lịch hoặc dịch vụ đối tác trên TripSense.
2. **Tạo Hold**: Hệ thống tạo bản ghi đặt chỗ trạng thái `HELD` và sinh mã đơn hàng duy nhất (`orderCode`).
3. **Thanh toán qua PayOS**: Khách quét mã VietQR chuyển 100% số tiền (ví dụ: `2.000.000 VND`).
4. **Xác nhận**: Webhook từ PayOS gửi về TripSense qua API Gateway:
   - Toàn bộ `2.000.000 VND` đã nằm trong tài khoản ngân hàng của TripSense Admin.
   - Đơn chuyển sang `PAID` / `CONFIRMED`.
   - Tiền ghi nhận vào sổ cái: `ESCROW_HOLDING`.
   - Partner nhận thông báo có đơn đặt mới và giữ phòng/chỗ cho khách.

### Giai đoạn 2: Thời gian giữ vốn (Float Period)
- Khoảng thời gian từ lúc khách đặt phòng đến ngày nhận phòng (thường kéo dài từ vài ngày đến vài tháng).
- **Lợi thế cho Admin**:
  - TripSense nắm giữ toàn bộ dòng tiền lưu động (Working Capital Float).
  - Loại bỏ hoàn toàn nguy cơ đối tác nhận tiền rồi biến mất hoặc không đón tiếp khách.

### Giai đoạn 3: Hoàn thành dịch vụ (Fulfillment)
1. Khách đến sử dụng dịch vụ, đối tác ghi nhận `CHECKED_IN`.
2. Khi kết thúc kỳ nghỉ, đối tác xác nhận `CHECKED_OUT` (hoặc hệ thống tự động chốt sau 24h kể từ ngày trả phòng nếu không có khiếu nại).
3. Đơn chuyển trạng thái: `SETTLEMENT_ELIGIBLE` (Đủ điều kiện quyết toán).

### Giai đoạn 4: Đối soát & Giải ngân tự động (Settlement & Payout)
1. Đến chu kỳ đối soát (ví dụ: Thứ 2 hàng tuần hoặc ngày 15 & 30 hàng tháng):
2. Hệ thống tính toán phân rã dòng tiền cho từng đơn hàng:
   $$\text{Gross} = \text{Admin Commission} + \text{Partner Net}$$
   *Ví dụ đơn 2.000.000 VND*:
   - **Tổng tiền khách trả (Gross)**: `2.000.000 VND`
   - **Hoa hồng TripSense (Take-rate 10%)**: `+200.000 VND` *(Giữ lại tài khoản)*
   - **Phí cổng PayOS (~1.5%)**: `-30.000 VND` *(Chi phí vận hành)*
   - **Lợi nhuận ròng Admin**: `170.000 VND`
   - **Số tiền thanh toán cho Partner**: `1.800.000 VND`
3. Admin thực hiện chuyển khoản lệnh Payout vào số tài khoản ngân hàng đã đăng ký của Partner.
4. Đơn chuyển trạng thái: `SETTLED`.

---

## 3. Các mô hình tạo lợi nhuận cho phía Admin (Revenue Streams)

Để tối đa hóa lợi nhuận cho bên phía Admin, TripSense áp dụng 4 kênh thu tiền:

| Nguồn doanh thu | Đối tượng trả | Cơ chế tính phí | Biên lợi nhuận |
|---|---|---|---|
| **1. Transaction Commission (Take-rate)** | Đối tác (Partner) | Thu **8% – 12%** trên mỗi giao dịch đặt phòng khách sạn, tour tham quan, trải nghiệm thành công. | Cốt lõi, tăng trưởng theo GMV |
| **2. Phí thuê bao Đối tác (B2B SaaS / Partner Pro)** | Đối tác (Partner) | Thu phí tháng (**199.000đ – 499.000đ/tháng**):<br>- Gắn huy hiệu "Đối tác uy tín" (Verified Partner).<br>- Giảm hoa hồng đơn hàng từ 10% xuống 7%.<br>- Dashboard phân tích hành vi khách hàng & báo cáo chuyên sâu. | Dòng tiền định kỳ đều đặn (ARR) |
| **3. Vị trí quảng cáo & Ưu tiên AI (Sponsored Discovery)** | Đối tác (Partner) | Trả phí để được hiển thị hàng đầu trong danh mục "For you", tab "Ideas", hoặc được thuật toán AI ưu tiên đề xuất đầu tiên khi người dùng nhờ lên lịch trình. | Rất cao (>90%), không tốn chi phí hàng tồn |
| **4. Gói hội viên Người dùng (B2C TripSense Pro)** | Khách hàng (User) | Phí thành viên **49.000đ/tháng** hoặc **399.000đ/năm**:<br>- Lên lịch trình AI không giới hạn số lượng.<br>- Tải lịch trình Offline & xuất file PDF chuyên nghiệp.<br>- Nhận voucher giảm giá độc quyền từ các đối tác. | Biên lợi nhuận cao, tăng gắn kết người dùng |

---

## 4. Xử lý rủi ro & Chính sách hủy (Risk & Refund Policy)

### Kịch bản 1: Khách hủy phòng đúng hạn (Free Cancellation)
- Khách hủy trước hạn quy định (`cancelUntil`).
- Tiền hoàn trả lại khách 100% từ quỹ ký quỹ của Admin.
- Partner không nhận tiền, Admin không mất vốn.

### Kịch bản 2: Khách hủy phòng trễ hạn (Late Cancellation / No-show)
- Khách bị phạt theo chính sách (ví dụ: phạt 100% đêm đầu tiên = `1.000.000 VND`).
- Số tiền phạt được chia đôi hoặc chia theo tỷ lệ hoa hồng:
  - Admin thu hoa hồng 10%: `100.000 VND`.
  - Partner nhận bồi thường 90%: `900.000 VND`.
  - Admin không bao giờ chịu thiệt hại.

### Kịch bản 3: Đối tác không phục vụ / Lừa đảo (Partner Breach)
- Vì Admin **đang giữ tiền trong tài khoản Escrow**, Admin chủ động hoàn tiền 100% cho khách ngay lập tức mà không cần phải đi đòi tiền Partner.
- Khóa tài khoản đối tác, bảo vệ tuyệt đối uy tín của thương hiệu TripSense.

---

## 5. Kiến trúc kỹ thuật trên Codebase TripSense

Hệ sinh thái hiện tại đã có nền tảng vững chắc và sẵn sàng mở rộng mà không cần đập đi xây lại:

### Thành phần đã có sẵn:
1. **`services/trip-service`**:
   - `hotel_booking`: Quản lý trạng thái đơn hàng (`HELD`, `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`).
   - `hotel_payos_payment`: Quản lý thanh toán thật qua PayOS với `order_code`, `payment_link_id`, webhook chữ ký HMAC-SHA256 an toàn.
   - `hotel_demo_ledger`: Cấu trúc sổ cái mẫu phân tách Gross / Commission / Partner Net.
2. **`apps/web/tripsense`**:
   - Giao diện Admin: `/admin/hotels/commerce` hiển thị danh sách đơn và đối soát.
   - Giao diện Partner: Kênh quản lý đơn đặt phòng và doanh thu của cơ sở mình.

### Các bảng dữ liệu mở rộng cho Quyết toán thật:
```sql
-- 1. Bảng lưu tài khoản nhận tiền của Đối tác
CREATE TABLE IF NOT EXISTS partner_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    bank_code VARCHAR(20) NOT NULL, -- VCB, MB, TCB, ACB...
    account_number VARCHAR(32) NOT NULL,
    account_name VARCHAR(120) NOT NULL,
    is_primary BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng lưu các đợt quyết toán (Payout Batch)
CREATE TABLE IF NOT EXISTS partner_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    cycle_start_date DATE NOT NULL,
    cycle_end_date DATE NOT NULL,
    total_bookings INTEGER NOT NULL,
    gross_amount NUMERIC(18, 2) NOT NULL,      -- Tổng tiền khách trả
    commission_amount NUMERIC(18, 2) NOT NULL,  -- Lợi nhuận Admin giữ lại (10%)
    payout_amount NUMERIC(18, 2) NOT NULL,      -- Tiền chuyển cho Partner (90%)
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    payout_reference VARCHAR(100),              -- Mã giao dịch ngân hàng chuyển tiền
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Bảng chi tiết từng đơn hàng trong đợt quyết toán
CREATE TABLE IF NOT EXISTS partner_settlement_items (
    settlement_id UUID NOT NULL REFERENCES partner_settlements(id),
    booking_id UUID NOT NULL REFERENCES hotel_booking(id),
    gross_amount NUMERIC(18, 2) NOT NULL,
    commission_amount NUMERIC(18, 2) NOT NULL,
    net_amount NUMERIC(18, 2) NOT NULL,
    PRIMARY KEY (settlement_id, booking_id)
);
```

---

## 6. Lộ trình triển khai khuyến nghị

1. **Giai đoạn 1 (Hiện tại - Đã xong)**:
   - Thanh toán trực tiếp qua PayOS (`hotel-payos-payment.md`). Tiền vào tài khoản Admin TripSense.
   - Ghi nhận trạng thái thanh toán và thông báo đặt phòng.
2. **Giai đoạn 2 (Hoàn thiện tự động hóa hoa hồng)**:
   - Tạo bảng `partner_bank_accounts` cho Partner điền thông tin tài khoản ngân hàng khi đăng ký cơ sở kinh doanh.
   - Thêm nghiệp vụ chuyển trạng thái `CHECKED_OUT` thành `SETTLEMENT_ELIGIBLE`.
3. **Giai đoạn 3 (Cổng quyết toán Admin)**:
   - Tại trang `/admin/hotels/commerce`, bấm nút "Tạo kỳ quyết toán tuần này".
   - Hệ thống tự động tính tổng tiền giữ lại cho Admin (10%) và sinh danh sách chi tiền (Payout List) hoặc mã VietQR thanh toán cho từng đối tác.
