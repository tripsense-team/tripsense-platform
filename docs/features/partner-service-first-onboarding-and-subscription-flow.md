# Partner Service-First Onboarding & Subscription Flow — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense` (Frontend UX & Funnel), `services/trip-service` (Business & Catalog Ownership)
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway`
- **Created Date**: 2026-10-29
- **Target PR Boundaries**:
  - Phase 1: Navigation & Information Architecture Separation (`/partner/services` vs `/partner/subscription`)
  - Phase 2: Restoring `PartnerServicesHubView` as a Genuine Service & Catalog Management Hub
  - Phase 3: `PartnerBusinessCard` Guided Onboarding Progress & Service-First CTAs
  - Phase 4: `PartnerSubscriptionView` Catalog Readiness Prompts & Flow Optimization
  - Phase 5: Automated Testing & Verification

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Experience Breakdown
Trước đây, trải nghiệm của đối tác trên TripSense gặp phải vấn đề đảo lộn nghiệp vụ và điều hướng gây bối rối:
1. **Đảo lộn luồng nghiệp vụ (Subscription-Before-Service):** Khi đối tác vừa đăng ký cơ sở kinh doanh xong (chưa có món ăn, chưa có phòng khách sạn, chưa có bài tour), hệ thống lập tức hiển thị nút nổi bật `"✨ Gói Hội Viên"` và chào mời mua gói cước hội viên Pro (1 tháng, 3 tháng, 1 năm). Đối tác thắc mắc: *"Tôi chưa đăng ký dịch vụ, thực đơn của mình thì mua gói hội viên để làm gì? Khách vào xem thì thấy quán trống trơn?"*.
2. **Nhập nhằng điều hướng Sidebar (`/partner/services`):** 
   - Mục sidebar hiển thị tên `"Gói Đối tác & Quyền lợi"` nhưng trỏ vào URL `/partner/services`.
   - Trang `/partner/services` vốn được thiết kế là *"Quản lý Thực đơn & Dịch vụ"* (nơi quản lý menu, phòng, tour), nhưng lại bị biến thành trang chào bán gói cước (Paywall). Nếu đối tác chưa có cơ sở nào, trang hiển thị câu thông báo chặn cụt: *"Bạn chưa có cơ sở kinh doanh nào. Đăng ký ngay để mở khóa gói..."*.
3. **Thiếu lộ trình hướng dẫn từng bước (Guided Onboarding Funnel):** Đối tác mới không nắm được các bước cần làm để chính thức mở bán và thu hút du khách hiệu quả.

### 1.2 The Standard 4-Step Partner Journey (Service-First Funnel)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CHU TRÌNH ĐỐI TÁC CHUẨN (4 BƯỚC)                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘

    [BƯỚC 1: ĐĂNG KÝ CƠ SỞ MIỄN PHÍ]
      │  - Nhập tên, địa chỉ, loại hình (HOTEL, RESTAURANT, TOUR_GUIDE), liên hệ (Hotline/Zalo/Website)
      │  - Đăng ký hoàn toàn 0đ, không yêu cầu thẻ hay thanh toán.
      ▼
    [BƯỚC 2: CẤU HÌNH DANH MỤC DỊCH VỤ & SẢN PHẨM] ◄─── TRỌNG TÂM NGHIỆP VỤ
      │  - Nhà hàng: Thêm danh mục món ăn (Menu), giá bán, hình ảnh món ăn đặc trưng.
      │  - Khách sạn: Thêm các hạng phòng (Room types), giá niêm yết, tiện ích phòng (Wi-Fi, AC, view).
      │  - Hướng dẫn viên: Đăng bài giới thiệu tour, lộ trình trải nghiệm, ngôn ngữ, chuyên môn.
      ▼
    [BƯỚC 3: XEM TRƯỚC HIỂN THỊ DU KHÁCH (LIVE PREVIEW)]
      │  - Bấm "Xem trước trang" để xem đúng giao diện mà du khách nhìn thấy (/restaurants/{id}, /hotels/{id}).
      │  - Tự tin kiểm tra hình ảnh, thực đơn, số điện thoại liên hệ đã hoàn hảo.
      ▼
    [BƯỚC 4: KÍCH HOẠT GÓI HỘI VIÊN PRO & MỞ BÁN BÙNG NỔ]
      │  - Sau khi dịch vụ đã sẵn sàng, đối tác nâng cấp Gói Hội Viên Pro để tối đa hóa doanh thu:
      │    * Tích xanh Xác thực (Verified Partner) tăng uy tín vượt trội.
      │    * Đẩy top ưu tiên tìm kiếm & hiển thị trang Khám phá (Explore).
      │    * AI Trip Planner tự động đề xuất vào lịch trình du khách đến địa phương.
      │    * Hưởng trọn 100% doanh thu (0% phí hoa hồng sàn, khách liên hệ trực tiếp).
      └──────────────────────────────────────────────────────────────────────────────────────────────────
```

---

### 1.3 Scope Boundaries

- **In-Scope**:
  - **Tách bạch rõ ràng Sidebar & Routing**:
    - `/partner`: Quản lý danh sách cơ sở kinh doanh (Tổng quan & Dashboard).
    - `/partner/services`: Hub Quản lý Thực đơn & Dịch vụ (Menu món ăn, Hạng phòng, Bài tour của các cơ sở).
    - `/partner/subscription`: Hub Quản lý Gói Hội Viên Pro & Tiếp cận du khách (Xem gói, thanh toán VietQR PayOS, lịch sử hạn dùng).
    - `/partner/analytics`: Thống kê tương tác & lượt xem của du khách.
  - **Khôi phục `PartnerServicesHubView`**: Trở về đúng vai trò là trung tâm quản lý dịch vụ/sản phẩm:
    - Liệt kê các cơ sở kinh doanh của đối tác kèm tiến độ chuẩn bị (Readiness): e.g. "5 món trong thực đơn", "3 hạng phòng", "Chưa có dịch vụ".
    - Phím tắt hành động nhanh: "Thêm món ăn", "Cài đặt phòng", "Xem trước trang du khách".
    - Thẻ khuyến nghị: "Sẵn sàng mở bán? Kích hoạt Gói Hội Viên Pro để nhận Tích xanh & Lên top đề xuất AI".
  - **Nâng cấp `PartnerBusinessCard`**:
    - Thêm thanh tiến độ (Progress Tracker) 4 bước: (1. Hồ sơ cơ sở -> 2. Dịch vụ/Thực đơn -> 3. Xem trước -> 4. Gói Hội Viên).
    - Phím bấm theo ngữ cảnh (Contextual CTA):
      - Khi chưa có dịch vụ nào (0 món / 0 phòng): Nút chính nổi bật là **"👉 Thêm thực đơn / dịch vụ"**; nút Gói Hội Viên là thứ cấp kèm gợi ý nên thêm dịch vụ trước.
      - Khi đã có dịch vụ: Nút chính là **"Quản lý thực đơn"** kèm nút **"✨ Kích hoạt Gói Hội Viên"**.
      - Luôn có nút **"Xem trước hiển thị"** (Icon `ExternalLink`) để đối tác kiểm tra trang công khai.
  - **Tối ưu `PartnerSubscriptionView`**:
    - Hiển thị banner khuyến khích hoàn tất dịch vụ trước khi kích hoạt gói (Advisory banner: *"Hãy đảm bảo cơ sở đã có đầy đủ món ăn/hạng phòng để đạt hiệu quả tiếp cận cao nhất ngay khi kích hoạt"*).
    - Không chặn cứng (hard-block) thanh toán nếu đối tác vẫn muốn mua gói trước mùa cao điểm, nhưng định hướng rõ ràng thứ tự dịch vụ trước - hội viên sau.

- **Out-of-Scope**:
  - Không thay đổi schema cơ sở dữ liệu `trip-service` (tận dụng toàn bộ các bảng `restaurant_menu_item`, `hotel_room_type`, `partner_guide_promotion`, `partner_subscription` hiện có).
  - Không khôi phục luồng đặt cọc / ví escrow / hoa hồng cũ (duy trì 100% triết lý SaaS 0% hoa hồng).

---

### 1.4 Acceptance Criteria

- [x] **AC-1 (Sidebar tách bạch chuẩn xác):**
  - Sidebar hiển thị riêng biệt 3 mục đối tác rõ ràng:
    1. `Cơ sở kinh doanh` (`/partner`) — Icon `Store`
    2. `Quản lý dịch vụ & thực đơn` (`/partner/services`) — Icon `Utensils`
    3. `Gói Hội Viên Pro` (`/partner/subscription`) — Icon `Sparkles`
    4. `Thống kê & Tiếp cận` (`/partner/analytics`) — Icon `BarChart3`
- [x] **AC-2 (Hub Quản lý Dịch vụ đúng chức năng):**
  - Truy cập `/partner/services` hiển thị danh sách các cơ sở với danh mục dịch vụ tương ứng (`RESTAURANT` -> Quản lý thực đơn, `HOTEL` -> Quản lý phòng & tiện ích, `TOUR_GUIDE` -> Quản lý tour).
  - Hiển thị nút "Xem trước trang du khách" dẫn tới trang công khai (`/restaurants/{id}`, `/hotels/{id}`).
  - Không hiển thị paywall gói cước ở trang này.
- [x] **AC-3 (Thẻ cơ sở kinh doanh ưu tiên dịch vụ):**
  - Trên thẻ cơ sở `PartnerBusinessCard`, nút hành động dịch vụ ("Thực đơn món ăn", "Quản lý khách sạn", "Bài quảng bá") luôn được ưu tiên hàng đầu.
  - Có liên kết "Xem trước trang" (Live Preview) để đối tác kiểm tra hiển thị.
  - Nút "Gói Hội Viên" hiển thị rõ ràng là bước gia tăng tiếp cận (Boost/Pro badge) sau khi đã có dịch vụ.
- [x] **AC-4 (Trang Gói Hội Viên chuyên biệt):**
  - `/partner/subscription` và `/partner/businesses/{id}/subscription` hiển thị đầy đủ bảng quyền lợi 3 gói (1 Tháng, 3 Tháng, 1 Năm), modal quét VietQR PayOS, kiểm tra thanh toán tức thì.
  - Có banner gợi ý kiểm tra lại dịch vụ trước khi kích hoạt để đạt hiệu quả cao nhất.
- [x] **AC-5 (i18n & Error Handling):**
  - Tất cả các nhãn, tiêu đề, tooltip hỗ trợ đầy đủ cả tiếng Việt (`vi`) và tiếng Anh (`en`).
  - Áp dụng triệt để tiêu chuẩn `ERROR_HANDLING_AND_LOGGING_STANDARDS.md`, không lộ raw trace hay token.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction & Navigation Architecture

```text
                               ┌──────────────────────────────────────────────┐
                               │                 SIDEBAR NAV                  │
                               └───────┬──────────────┬──────────────┬────────┘
                                       │              │              │
                       ┌───────────────┘              │              └───────────────┐
                       ▼                              ▼                              ▼
             [/partner]                      [/partner/services]           [/partner/subscription]
      (Danh sách & Trạng thái)          (Hub Quản lý Dịch vụ/Thực đơn)     (Gói Hội Viên Pro SaaS)
               │                                      │                              │
               ├── Thêm cơ sở kinh doanh              ├── Quản lý món ăn/thực đơn    ├── Bảng giá 1T/3T/1N
               ├── Bật/Tắt công khai & nhận khách     ├── Cấu hình phòng & tiện ích  ├── Thanh toán VietQR PayOS
               ├── Xem trước trang du khách           ├── Bài quảng bá tour          └── Kích hoạt Tích xanh
               └── Lối tắt tới Dịch vụ & Gói          └── Xem trước hiển thị du khách
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Quản lý giao diện, điều hướng, trạng thái Onboarding Funnel, hiển thị Services Hub & Subscription View | REST calls qua API Gateway |
| `services/api-gateway` | Forward request, kiểm tra JWT Bearer Token | Spring Cloud Gateway |
| `services/trip-service` | Sở hữu các entity: `PartnerBusiness`, `RestaurantMenuItem`, `HotelRoomType`, `PartnerGuidePromotion`, `PartnerSubscription` | REST Spring Boot (:8082) |

### 2.3 Architecture Guardrails Verification
- [x] Không can thiệp DB chéo giữa các service.
- [x] Mọi request từ web client đều đi qua API Gateway (`:8080`).
- [x] Tận dụng triệt để các endpoint REST backend hiện có, không tạo backend code dư thừa khi frontend có thể cấu trúc lại thông tin sạch sẽ.
- [x] Đảm bảo tuân thủ tiêu chuẩn i18n đa ngôn ngữ (`docs/I18N_STANDARDS.md`).

---

## 3. API & Contracts

Tính năng này tập trung vào tái cấu trúc UX / Navigation và tận dụng 100% các API hiện có:

### 3.1 Existing Endpoints Utilized

| Method | Path | Auth | Chức năng |
| --- | --- | --- | --- |
| `GET` | `/api/partners/businesses` | Bearer | Lấy thông tin ngữ cảnh đối tác và danh sách cơ sở kinh doanh (`getPartnerContext`) |
| `GET` | `/api/partners/businesses/{id}` | Bearer | Lấy chi tiết cơ sở (`getBusinessDetail`) |
| `GET` | `/api/subscription-plans?businessKind=...` | Public/Bearer | Lấy danh sách gói cước Pro theo loại hình kinh doanh (`getSubscriptionPlans`) |
| `GET` | `/api/partners/businesses/{id}/subscription` | Bearer | Lấy thông tin gói cước đang áp dụng của cơ sở (`getPartnerSubscription`) |
| `POST` | `/api/partners/businesses/{id}/subscription/checkout` | Bearer | Tạo đơn hàng thanh toán PayOS VietQR (`createSubscriptionCheckout`) |
| `GET` | `/api/partners/businesses/{id}/subscription/orders/{orderCode}/status` | Bearer | Kiểm tra trạng thái đơn hàng (`getSubscriptionOrderStatus`) |
| `POST` | `/api/partners/businesses/{id}/subscription/orders/{orderCode}/verify-manual` | Bearer | Xác nhận kích hoạt tức thì sau chuyển khoản (`verifyManualPayment`) |

---

## 4. UI/UX Design & Component Specifications

### 4.1 Restructured Sidebar Navigation (`user-sidebar.tsx`)
Cập nhật menu "Đối tác / Partner" trong `user-sidebar.tsx` thành 4 mục rõ ràng:
1. **Cơ sở kinh doanh** (`/partner`) — Icon `Store`: Quản lý hồ sơ cơ sở, trạng thái duyệt, bật/tắt đón khách.
2. **Dịch vụ & Thực đơn** (`/partner/services`) — Icon `UtensilsCrossed` hoặc `Layers`: Quản lý thực đơn nhà hàng, phòng nghỉ khách sạn, tour du lịch.
3. **Gói Hội Viên Pro** (`/partner/subscription`) — Icon `Sparkles`: Nâng cấp gói cước đối tác, huy hiệu xác thực & tăng tốc hiển thị AI.
4. **Thống kê & Tiếp cận** (`/partner/analytics`) — Icon `BarChart3`: Báo cáo số liệu tương tác.

### 4.2 Rebuilt `PartnerServicesHubView` (`/partner/services`)
Chuyển đổi từ trang hiển thị gói cước sang **Hub Quản lý Dịch vụ & Sản phẩm**:
- **Header**: "Quản lý Dịch vụ & Thực đơn", mô tả: "Quản lý danh mục món ăn, phòng lưu trú và nội dung tour cho các cơ sở của bạn."
- **Danh sách cơ sở**: Hiển thị từng cơ sở dạng thẻ tiện ích chuyên sâu:
  - Thông tin cơ sở: Tên, loại hình (`HOTEL`, `RESTAURANT`, `TOUR_GUIDE`), địa chỉ.
  - Nút thao tác dịch vụ trực tiếp:
    - `RESTAURANT`: Nút "🍽️ Quản lý Thực đơn Món ăn" -> trỏ tới `/partner/businesses/{id}/restaurant-menu`.
    - `HOTEL`: Nút "🏨 Quản lý Hạng phòng & Giá" -> trỏ tới `/partner/businesses/{id}/hotel`.
    - `TOUR_GUIDE`: Nút "🧭 Quản lý Bài quảng bá Tour" -> trỏ tới `/partner/businesses/{id}/guide-promotions`.
  - Nút xem trước du khách: "👁️ Xem trước trang công khai" -> Mở trang `/restaurants/{id}` hoặc `/hotels/{id}` trong tab mới.
- **Thẻ khích lệ mở bán (Pro Boost Banner)** ở chân trang:
  - *"Đã hoàn tất danh mục dịch vụ? Hãy đăng ký Gói Hội Viên Pro để nhận Tích xanh xác thực và đưa cơ sở lên trang nhất Khám phá!"* kèm nút "Xem Gói Hội Viên".

### 4.3 Enhanced `PartnerBusinessCard` (`partner-business-card.tsx`)
- Bổ sung **Onboarding Funnel Indicator** gọn gàng:
  - Bước 1: Thông tin cơ sở ✓
  - Bước 2: Dịch vụ & Thực đơn (Trọng tâm)
  - Bước 3: Xem trước trang
  - Bước 4: Mở bán & Hội viên Pro
- Sắp xếp nút bấm theo chuẩn UX:
  - Nút 1 (Chính): Quản lý Dịch vụ ("Thực đơn món ăn" / "Quản lý phòng" / "Bài quảng bá").
  - Nút 2 (Xem trước): "Xem trước trang" (Icon `Eye` hoặc `ExternalLink`).
  - Nút 3 (Nâng cấp): "✨ Gói Hội Viên" (Dẫn tới `/partner/businesses/{id}/subscription` để kích hoạt tích xanh và đề xuất AI).

### 4.4 Optimized `PartnerSubscriptionView` (`/partner/subscription`)
- Đóng vai trò là trang quản lý gói Pro chuyên nghiệp:
  - Nếu truy cập từ `/partner/subscription` mà có nhiều cơ sở, cho phép chọn cơ sở cần mua gói.
  - Banner hướng dẫn: *"💡 Lời khuyên: Đảm bảo cơ sở của bạn đã cập nhật thực đơn hoặc hạng phòng trước khi kích hoạt gói để du khách có thể đặt bàn hoặc liên hệ ngay khi xem hồ sơ!"*.
  - Bảng 3 gói cước rõ ràng (1 Tháng, 3 Tháng, 1 Năm), gắn nhãn "Phổ biến nhất" cho gói 3 Tháng, "Tiết kiệm nhất" cho gói 1 Năm.
  - Modal VietQR PayOS quét mã tự động kích hoạt.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Authorization / IDOR** | Mọi thao tác quản lý dịch vụ và mua gói subscription đều được `trip-service` kiểm tra quyền sở hữu (`owner_user_id == user.id` hoặc `PartnerBusinessMember`). Không bao giờ cho phép chỉnh sửa dịch vụ của cơ sở khác. |
| **Client Navigation Tampering** | Frontend chỉ cung cấp điều hướng UX; nếu người dùng cố ý gọi API chỉnh sửa món/phòng của cơ sở không thuộc quyền sở hữu, backend lập tức trả về `403 Forbidden`. |
| **Payment Security** | Webhook PayOS xác thực chữ ký SHA-256 HMAC; mã đơn hàng `orderCode` sinh ngẫu nhiên duy nhất cho từng giao dịch. |
| **Error Handling & Privacy** | Tuân thủ `ERROR_HANDLING_AND_LOGGING_STANDARDS.md`, toàn bộ lỗi gọi API đều đi qua `getSafeErrorMessage()`, không lộ dữ liệu hệ thống hay token. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Chặn cứng vs Khuyến nghị mềm (Hard Block vs Gentle Nudge)** | Nếu chặn cứng không cho mua gói khi chưa có món ăn/phòng, đối tác có thể khó chịu nếu họ muốn mua gói trước ngày khai trương. | **Giải pháp:** Sử dụng Khuyến nghị mềm (Gentle Nudge). Hiển thị khuyến nghị nên đăng ký dịch vụ trước, nút dịch vụ là nút chính nổi bật. Nhưng vẫn cho phép họ mua gói nếu họ chủ động click "Gói Hội Viên", đảm bảo tính linh hoạt tối đa trong kinh doanh. |
| **Trùng lặp route `/partner/services` vs `/partner/businesses/...`** | Liệu có cần tạo thêm các trang quản lý dịch vụ mới không? | **Giải pháp:** Tận dụng 100% các trang workspace đã xây dựng rất hoàn chỉnh (`/partner/businesses/{id}/restaurant-menu`, `/hotel`, `/guide-promotions`). Trang `/partner/services` đóng vai trò là Hub tổng hợp để điều phối đối tác đến đúng nơi cần quản lý. |
| **Tương thích ngược (Backward Compatibility)** | Các link cũ trỏ tới `/partner/services` đang mong đợi hiển thị gói cước? | **Giải pháp:** Tại `/partner/services`, cung cấp banner dẫn sang `/partner/subscription`. Tạo route `/partner/subscription` chính thức và cập nhật link trên `PartnerBusinessCard` trỏ thẳng tới `/partner/businesses/{id}/subscription` hoặc `/partner/subscription?businessId={id}`. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Navigation & Sidebar Restructuring
- [x] Task 1.1: Cập nhật `apps/web/tripsense/src/components/layout/user/user-sidebar.tsx`:
  - Thêm mục `Quản lý dịch vụ & thực đơn` (`/partner/services`).
  - Tách riêng mục `Gói Hội Viên Pro` (`/partner/subscription`).
  - Cập nhật i18n keys cho cả `vi` và `en` trong `apps/web/tripsense/src/locales/`.

### Phase 2: Restoring `PartnerServicesHubView`
- [x] Task 2.1: Tái cấu trúc `apps/web/tripsense/src/features/partner/components/partner-services-hub-view.tsx`:
  - Hiển thị danh sách cơ sở kinh doanh và các hành động dịch vụ tương ứng (Thực đơn món ăn, Hạng phòng lưu trú, Bài quảng bá tour).
  - Tích hợp nút xem trước trang du khách (`/restaurants/{id}`, `/hotels/{id}`).
  - Thêm Pro Boost Banner ở chân trang dẫn sang trang Gói Hội Viên.

### Phase 3: Enhancing `PartnerBusinessCard` with Service-First Funnel
- [x] Task 3.1: Cập nhật `apps/web/tripsense/src/features/partner/components/partner-business-card.tsx`:
  - Thêm bước hướng dẫn trực quan (Funnel indicator: Hồ sơ -> Dịch vụ -> Xem trước -> Hội viên Pro).
  - Đặt nút Quản lý Dịch vụ làm trọng tâm.
  - Cập nhật nút "Gói Hội Viên" trỏ tới `/partner/businesses/{id}/subscription`.
  - Tích hợp nút "Xem trước trang du khách" cho tất cả các loại hình cơ sở.

### Phase 4: Optimizing Dedicated `PartnerSubscriptionView`
- [x] Task 4.1: Cập nhật `apps/web/tripsense/src/app/(main)/partner/subscription/page.tsx`:
  - Cho phép chọn cơ sở kinh doanh nếu người dùng có nhiều cơ sở và hiển thị `PartnerSubscriptionView`.
  - Bổ sung banner khuyến khích hoàn thiện dịch vụ trước khi kích hoạt gói.

### Phase 5: Verification & Quality Assurance
- [x] Task 5.1: Chạy toàn bộ test suite frontend (388/388 tests passed, 28/28 partner tests passed).
- [x] Task 5.2: Kiểm tra Next.js typography & sidebar contracts.
- [x] Task 5.3: Xác minh các route `/partner`, `/partner/services`, `/partner/subscription` trả về 200 OK trên dev server localhost:3000.

---

## Completion Status

```text
STATUS: DONE
```
> Tính năng đã được triển khai hoàn tất và kiểm chứng thành công. Toàn bộ 388 frontend unit/contract tests đạt 100% pass. Local dev server hoạt động ổn định trên cổng 3000.

