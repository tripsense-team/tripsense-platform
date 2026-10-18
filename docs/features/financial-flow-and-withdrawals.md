# Financial Flow, Cancellation/Refund & Partner Withdrawal Management — Specification & Implementation Plan

`STATUS: APPROVED`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/trip-service`
- **Created Date**: 2026-10-18
- **Scope**: Hệ thống Lưu trú & Khách sạn (Hotel / Accommodation), Đối tác Doanh nghiệp (Hotel Partner), Khách hàng (User/Traveler), Quản trị viên (Admin).
- **Target PR Boundaries**:
  - Phase 1: Data Model & Financial Ledger (Flyway migration, Partner Payout Account, Partner Wallet, Financial Ledger, Customer Refund Queue, Withdrawal Requests)
  - Phase 2: Core Financial Engine, Cancellation/Refund & Auto Settlement (Tích hợp PayOS vào Sổ cái Escrow, Luồng hoàn tiền khi huỷ trước hạn, Auto Settlement sau khi Check-out, Khóa tiền khi rút)
  - Phase 3: Admin Financial Dashboard & Dual Payout Queue (Màn hình tổng quan 4 chỉ số tài chính, Hàng đợi hoàn tiền cho khách huỷ phòng, Hàng đợi duyệt rút tiền cho đối tác)
  - Phase 4: Frontend Web Integration (Giao diện Ví đối tác tại `/partner/finance`, Quản trị tài chính tại `/admin/finance/**`, Nút Hủy & Hoàn tiền tại `/hotels/bookings`)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & Business Context
Hiện tại nền tảng TripSense gặp các lỗ hổng và điểm nghẽn nghiêm trọng về dòng tiền (financial flow):
1. **Tiền bị kẹt sau thanh toán (Hotel PayOS Payments):** Khách hàng thanh toán trực tuyến qua cổng PayOS (`PAYOS`), tiền về tài khoản ngân hàng Merchant của Platform TripSense. Tuy nhiên, hệ thống **chưa có cơ chế phân bổ doanh thu (Revenue Split)**, **chưa có Ví đối tác (Partner Wallet)**, và **hoàn toàn chưa có luồng rút tiền (Withdrawal Flow)** để chủ khách sạn nhận phần tiền phòng (sau khi trừ hoa hồng).
2. **Nút "Hủy" phòng gây mất mát dòng tiền (Cancellation & Refund Gap):** Khi khách hàng bấm nút **"Hủy"** trên đơn đặt phòng, hệ thống chỉ cập nhật trạng thái `CANCELLED` và gán cờ `resolution = 'REFUND_REQUIRED'` trong database rồi dừng lại. Số tiền 100% của khách vẫn nằm ở tài khoản ngân hàng của Sàn, khách không được hoàn tiền, khách không có chỗ nhập STK nhận lại tiền, và Admin hoàn toàn không có màn hình danh sách các đơn cần hoàn tiền.
3. **Thiếu cơ chế Tạm giữ bảo chứng (Escrow):** Khi khách trả tiền, tiền không được giữ an toàn theo từng booking mà hòa lẫn vào tài khoản công ty; không có cơ chế tự động chuyển tiền sang số dư khả dụng cho đối tác sau khi khách check-out an toàn (T+24h sau check-out).
4. **Thiếu minh bạch và công cụ quản lý (Lack of Transparency & Auditability):**
   - **Admin:** Không có trang quản lý tài chính tổng quan (GMV, tiền Escrow đang giữ, doanh thu hoa hồng, nợ đối tác, nợ hoàn tiền khách), không có màn hình xét duyệt và xử lý lệnh rút tiền / hoàn tiền (kèm chứng từ ủy nhiệm chi).
   - **Đối tác Khách sạn:** Không xem được số dư tạm giữ (Pending/Escrow), số dư khả dụng (Available Balance), chưa có nơi đăng ký tài khoản ngân hàng thụ hưởng, không thể gửi yêu cầu rút tiền.
   - **Khách hàng (User):** Cần minh bạch chính sách hoàn tiền khi hủy phòng và theo dõi tiến độ tiền về tài khoản.

---

### 1.2 User Flows & Journeys

#### Luồng A: Thanh toán Đặt phòng & Quyết toán Khách sạn (Hotel Booking Escrow & Settlement)
1. Khách đặt phòng và thanh toán qua PayOS (100% số tiền vào tài khoản Merchant Platform).
2. Tiền được ghi nhận vào trạng thái **Tạm giữ (ESCROW_HOLD)** gắn với `booking_id`.
3. Khi khách hoàn tất lưu trú (`CHECKED_OUT`) và không có tranh chấp (Dispute) trong vòng T+24h:
   - Hệ thống tự động kích hoạt quyết toán (Settlement Engine):
     * Hoa hồng nền tảng (`commission_amount`): ví dụ 10% (1000 bps) chuyển vào Doanh thu Platform (`PLATFORM_REVENUE`).
     * Tiền phòng thực nhận (`partner_amount`): 90% được ghi có vào **Số dư khả dụng (Available Balance)** của Ví Đối tác (`partner_wallet`).
4. Đối tác nhận thông báo số tiền đã sẵn sàng để rút.

#### Luồng B: Khách hàng Hủy phòng & Hoàn tiền (Cancellation & Customer Refund Flow)
1. **Kiểm tra chính sách:** Khi khách bấm "Hủy", hệ thống kiểm tra thời hạn hủy miễn phí (`free_cancellation_until`):
   - **Trường hợp 1 (Hủy hợp lệ trước hạn):**
     * Hệ thống giải phóng phòng trong kho (`hotel_inventory`).
     * Booking chuyển sang `CANCELLED`, tiền trong Escrow chuyển sang trạng thái `REFUND_PENDING`.
     * Modal hiển thị form cho khách nhập thông tin nhận lại tiền (Ngân hàng, Số tài khoản, Tên chủ tài khoản).
     * Yêu cầu hoàn tiền được đưa vào **Hàng đợi Hoàn tiền (Refund Queue)** của Admin.
   - **Trường hợp 2 (Hủy trễ / Sau hạn hủy miễn phí):**
     * Khách không được hoàn tiền (hoặc tính phí phạt theo chính sách phòng).
     * Tiền phòng tiếp tục được quyết toán cho Khách sạn theo tỷ lệ thỏa thuận.
2. **Quy trình Admin xử lý Hoàn tiền:**
   - Admin vào `/admin/finance/refunds`, xem danh sách các đơn khách đã hủy hợp lệ.
   - Admin bấm **"Tạo mã VietQR hoàn tiền"** để quét app ngân hàng chuyển trả lại 100% tiền cho khách.
   - Admin nhập mã giao dịch ngân hàng (`bank_reference_code`) + tải ảnh ủy nhiệm chi.
   - Trạng thái chuyển sang `REFUNDED`. Khách nhận được thông báo "Đã hoàn tiền thành công".

#### Luồng C: Yêu cầu Rút tiền của Đối tác (Partner Withdrawal Journey)
1. Đối tác vào mục **Tài chính & Ví** (`/partner/finance`), cập nhật thông tin tài khoản ngân hàng thụ hưởng (Ngân hàng, Số tài khoản, Tên chủ tài khoản, Chi nhánh).
2. Khi Số dư khả dụng >= Hạn mức tối thiểu (100.000 VNĐ), Đối tác bấm **"Tạo yêu cầu rút tiền"** (nhập số tiền muốn rút).
3. Hệ thống tạo lệnh `WITHDRAWAL_REQUEST` ở trạng thái `PENDING_REVIEW` và **khóa ngay lập tức (LOCKED)** số tiền tương ứng khỏi Số dư khả dụng (ngăn chặn double-spending).
4. **Quy trình Admin duyệt Rút tiền:**
   - Admin vào `/admin/finance/withdrawals`, xem chi tiết yêu cầu, danh sách các booking sinh ra số dư này, và thông tin tài khoản ngân hàng của Đối tác.
   - **Nếu duyệt:** Admin thực hiện chuyển khoản ngân hàng (hỗ trợ tạo nhanh mã VietQR), nhập Mã tham chiếu giao dịch ngân hàng (`bank_reference_code`) và tải ảnh biên lai ủy nhiệm chi (`proof_image_url`). Lệnh chuyển sang `COMPLETED`.
   - **Nếu từ chối:** Admin nhập lý do từ chối (ví dụ: sai số tài khoản, tên không khớp). Lệnh chuyển sang `REJECTED`, số tiền bị khóa được **hoàn trả ngay lập tức** về Số dư khả dụng của Đối tác.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[Khách Hàng (User)]                              [Đối Tác Khách Sạn (Partner)]
        │                                                     │
        │ 1. Đặt phòng (PayOS VietQR)                         │ 4. Xem Ví & Gửi lệnh Rút tiền
        ▼                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY (:8085)                              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRIP SERVICE (:8084)                               │
│                                                                             │
│  ┌────────────────────────┐      ┌──────────────────────────────────────┐   │
│  │     Escrow Engine      │      │          Settlement Engine           │   │
│  │ - Hold tiền khi đặt    │ ───► │ - Check-out an toàn + 24h            │   │
│  │ - Đơn huỷ -> Chờ hoàn  │      │ - 10% Platform / 90% Partner Wallet │   │
│  └──────────┬─────────────┘      └──────────────────┬───────────────────┘   │
│             │                                       │                       │
│             ▼                                       ▼                       │
│  ┌────────────────────────┐      ┌──────────────────────────────────────┐   │
│  │ Customer Refund Queue  │      │       Partner Wallet & Ledger        │   │
│  │ - Đơn hủy hợp lệ       │      │ - Số dư khả dụng / Khóa rút          │   │
│  │ - STK nhận hoàn tiền   │      │ - Sổ cái tài chính bất biến          │   │
│  └──────────┬─────────────┘      └──────────────────┬───────────────────┘   │
│             │                                       │                       │
└─────────────┼───────────────────────────────────────┼───────────────────────┘
              │                                       │
              ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ADMIN FINANCIAL DASHBOARD                             │
│  1. Overview: GMV | Escrow Holding | Platform Revenue | Partner Payable     │
│  2. Tab Hoàn tiền: Duyệt & Quét VietQR trả lại tiền cho Khách               │
│  3. Tab Rút tiền: Duyệt & Quét VietQR chi trả tiền cho Khách sạn            │
│  4. Sổ cái Đối soát: Kiểm toán toàn bộ biến động tài chính                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Service Ownership & Boundaries
| Component | Responsibility | Constraints |
| :--- | :--- | :--- |
| `services/trip-service` | Sở hữu toàn bộ Booking, Hotel Property, Financial Ledger, Partner Wallet, Customer Refunds, Withdrawal Requests. | Không truy vấn chéo DB `user-service`. Dùng snapshot DTO / JWT `user.id`. |
| `services/api-gateway` | Định tuyến các endpoint `/api/finance/**`, `/api/partners/businesses/{id}/finance/**`, rate limiting, verify JWT. | Không chứa business logic lưu trữ. |
| `apps/web/tripsense` | Giao diện Ví đối tác, Form rút tiền, Dashboard duyệt rút tiền Admin, Lịch sử hóa đơn khách hàng. | Luôn hiển thị dữ liệu authoritative từ backend, tuân thủ zero-leak error handling. |

### 2.3 Nguyên tắc Bất biến Tài chính (Financial Invariants)
- **Append-only Ledger (Chỉ ghi tăng/giảm qua bút toán):** Tuyệt đối không bao giờ dùng lệnh `UPDATE partner_wallet SET balance = balance + ...` độc lập. Mọi thay đổi số dư bắt buộc phải tương ứng với một dòng `financial_ledger_entry` có tham chiếu `reference_id` và `entry_type`.
- **Ngăn chặn rút lố / Rút trùng lặp (Strict Idempotency & Locking):** Khi tạo lệnh rút tiền, hệ thống sử dụng Pessimistic Lock (`SELECT ... FOR UPDATE`) trên bản ghi Ví để kiểm tra số dư và trừ `available_balance` chuyển sang `locked_balance` trong cùng 1 transaction.
- **Hạn mức & Tần suất rút:** Giới hạn rút tối thiểu 100.000 VNĐ, tối đa 50.000.000 VNĐ/lệnh, tối đa 2 lệnh đang chờ xử lý/đối tác cùng một thời điểm.

---

## 3. Database Schema & Migration Strategy

Dự án sẽ bổ sung migration Flyway mới trong `services/trip-service`:
`V20261018150000__financial_flow_and_partner_withdrawals.sql`

```sql
-- 1. Tài khoản ngân hàng nhận tiền của Đối tác Khách sạn
CREATE TABLE partner_payout_account (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    bank_code VARCHAR(32) NOT NULL, -- VCB, TCB, MB, ICB...
    bank_name VARCHAR(128) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    account_holder_name VARCHAR(128) NOT NULL,
    branch_name VARCHAR(128),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_business_payout_account UNIQUE (business_id)
);

-- 2. Ví tài chính Đối tác (Partner Wallet)
CREATE TABLE partner_wallet (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    available_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (available_balance >= 0),
    locked_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
    total_withdrawn NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    total_earned NUMERIC(18,2) NOT NULL DEFAULT 0.00 CHECK (total_earned >= 0),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_business_wallet UNIQUE (business_id)
);

-- 3. Hàng đợi Hoàn tiền cho Khách Hàng (Customer Refund Queue)
CREATE TABLE customer_refund_request (
    id UUID PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES hotel_booking(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    -- 'PENDING_REVIEW', 'PROCESSING', 'REFUNDED', 'REJECTED'
    
    -- Thông tin tài khoản khách hàng nhận lại tiền
    bank_code VARCHAR(32) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    account_holder_name VARCHAR(128) NOT NULL,
    
    -- Bằng chứng Admin hoàn tiền
    bank_reference_code VARCHAR(128),
    proof_image_url VARCHAR(500),
    admin_notes TEXT,
    processed_by UUID,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_booking_refund UNIQUE (booking_id)
);
CREATE INDEX idx_refund_status ON customer_refund_request(status, created_at DESC);

-- 4. Bảng yêu cầu rút tiền của Đối tác (Withdrawal Request)
CREATE TABLE partner_withdrawal_request (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES partner_business(id),
    wallet_id UUID NOT NULL REFERENCES partner_wallet(id),
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 100000),
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
    -- 'PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED'
    
    -- Snapshot thông tin tài khoản nhận tiền tại thời điểm gửi lệnh
    bank_code VARCHAR(32) NOT NULL,
    bank_name VARCHAR(128) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    account_holder_name VARCHAR(128) NOT NULL,
    
    -- Bằng chứng chi trả từ Admin
    bank_reference_code VARCHAR(128),
    proof_image_url VARCHAR(500),
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_withdrawal_biz ON partner_withdrawal_request(business_id, created_at DESC);
CREATE INDEX idx_withdrawal_status ON partner_withdrawal_request(status, created_at DESC);

-- 5. Sổ cái biến động tài chính bất biến (Append-Only Financial Ledger)
CREATE TABLE financial_ledger_entry (
    id UUID PRIMARY KEY,
    wallet_id UUID REFERENCES partner_wallet(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES partner_business(id),
    entry_type VARCHAR(32) NOT NULL, 
    -- 'BOOKING_SETTLEMENT', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_PAYOUT', 'WITHDRAWAL_REFUND', 'CUSTOMER_REFUND', 'DISPUTE_DEDUCTION'
    amount NUMERIC(18,2) NOT NULL, -- Giá trị biến động (+ hoặc -)
    balance_after NUMERIC(18,2) NOT NULL,
    reference_type VARCHAR(32) NOT NULL, -- 'HOTEL_BOOKING', 'WITHDRAWAL_REQUEST', 'CUSTOMER_REFUND'
    reference_id UUID NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX idx_ledger_business ON financial_ledger_entry(business_id, created_at DESC);
CREATE INDEX idx_ledger_ref ON financial_ledger_entry(reference_type, reference_id);
```

---

## 4. API Contracts

### 4.1 Customer Refund APIs
| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/hotels/bookings/{id}/cancel-and-refund` | Customer | Hủy đơn và nhập STK nhận tiền hoàn nếu đơn hợp lệ |
| `GET` | `/api/hotels/bookings/{id}/refund-status` | Customer | Xem tiến độ hoàn tiền của đơn phòng đã hủy |

### 4.2 Partner Wallet & Withdrawal APIs
| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/partners/businesses/{id}/finance/summary` | Partner Owner/Manager | Lấy tổng quan số dư ví, tài khoản ngân hàng và thống kê |
| `PUT` | `/api/partners/businesses/{id}/finance/payout-account` | Partner Owner | Cập nhật thông tin tài khoản ngân hàng thụ hưởng |
| `POST` | `/api/partners/businesses/{id}/finance/withdrawals` | Partner Owner | Gửi yêu cầu rút tiền mới (kèm Idempotency-Key) |
| `GET` | `/api/partners/businesses/{id}/finance/withdrawals` | Partner Owner/Manager | Danh sách lịch sử các yêu cầu rút tiền |
| `GET` | `/api/partners/businesses/{id}/finance/ledger` | Partner Owner/Manager | Sổ cái chi tiết biến động số dư ví |

### 4.3 Admin Finance & Payout Management APIs
| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/finance/overview` | Admin | Dashboard tài chính: GMV, Escrow đang giữ, Doanh thu hoa hồng, Nợ đối tác, Nợ hoàn tiền |
| `GET` | `/api/admin/finance/withdrawals` | Admin | Danh sách các lệnh rút tiền của khách sạn (lọc theo trạng thái) |
| `POST` | `/api/admin/finance/withdrawals/{id}/approve` | Admin | Duyệt lệnh rút tiền sang trạng thái `PROCESSING` |
| `POST` | `/api/admin/finance/withdrawals/{id}/complete` | Admin | Hoàn tất lệnh rút tiền (nhập mã GD ngân hàng + upload ủy nhiệm chi) |
| `POST` | `/api/admin/finance/withdrawals/{id}/reject` | Admin | Từ chối lệnh rút tiền (nhập lý do, hoàn tiền về ví partner) |
| `GET` | `/api/admin/finance/refunds` | Admin | Danh sách các đơn khách huỷ cần hoàn tiền |
| `POST` | `/api/admin/finance/refunds/{id}/complete` | Admin | Hoàn tất chuyển trả tiền lại cho khách (mã GD ngân hàng + upload ảnh) |

---

## 5. UI/UX Specifications for Admin & Partner

### 5.1 Admin Financial Hub (`/admin/finance`)
- **4 Thẻ Chỉ Số Vàng (Metric Cards):**
  1. **Tổng GMV (Gross Merchandise Value):** Tổng tiền khách đã thanh toán qua PayOS.
  2. **Tiền Tạm Giữ Bảo Chứng (Escrow Holding):** Tiền các đơn đang ở hoặc chưa tới hạn check-out.
  3. **Doanh Thu Hoa Hồng (Platform Net Revenue):** 10% hoa hồng nền tảng đã quyết toán.
  4. **Nợ Đối Tác & Khách (Liabilities):** Số dư khả dụng của các khách sạn + Tiền chờ hoàn cho khách hủy phòng.
- **Tab 1: Quản lý Rút tiền Đối tác (`/admin/finance/withdrawals`):**
  - Danh sách bảng table: Khách sạn, Số tiền xin rút, Thời gian, Thông tin STK.
  - Nút **"Tải mã VietQR chuyển khoản nhanh"** để Admin quét app ngân hàng thanh toán chuẩn 100% số tiền và STK.
  - Modal xác nhận: Nhập mã GD ngân hàng + Tải ảnh ủy nhiệm chi.
- **Tab 2: Hàng đợi Hoàn tiền Khách hàng (`/admin/finance/refunds`):**
  - Hiển thị các đơn khách đã bấm Hủy hợp lệ.
  - Tên khách, Mã booking, Số tiền hoàn trả (100% tiền cọc), STK nhận tiền.
  - Nút chuyển khoản VietQR + Upload ủy nhiệm chi hoàn tiền.

---

## 6. Implementation Plan & Phases

- [ ] **Phase 1: Database Migration & Entities**
  - Tạo bảng `partner_payout_account`, `partner_wallet`, `customer_refund_request`, `partner_withdrawal_request`, `financial_ledger_entry`.
- [ ] **Phase 2: Core Financial Engine, Cancellation & Auto Settlement**
  - Viết `SettlementService`: Nạp tiền vào Escrow khi PayOS báo `PAID`, tự động giải phóng tiền T+24h sau check-out (10% sàn, 90% ví đối tác).
  - Viết `RefundService`: Xử lý khi khách bấm Hủy hợp lệ -> Đưa vào `customer_refund_request`.
  - Viết `WithdrawalService`: Khóa tiền an toàn khi tạo lệnh rút.
- [ ] **Phase 3: Admin Management APIs & VietQR Generator**
  - Viết API thống kê 4 chỉ số tài chính tổng quan.
  - Viết API xử lý duyệt chi rút tiền và duyệt hoàn tiền kèm biên nhận.
- [ ] **Phase 4: Frontend Web Integration**
  - Xây dựng Trung tâm Tài chính Admin tại `/admin/finance/**`.
  - Nâng cấp modal "Hủy phòng" của khách tại `/hotels/bookings` để nhập STK nhận lại tiền.
  - Xây dựng giao diện Ví đối tác tại `/partner/finance`.

---

## 7. Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```
*Tài liệu kiến trúc giải pháp tài chính minh bạch cho Admin và luồng Hủy/Hoàn tiền đã được cập nhật đầy đủ. Đang chờ phê duyệt từ bạn trước khi bắt đầu viết code implementation.*
