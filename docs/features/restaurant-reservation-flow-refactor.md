# Restaurant Reservation Flow & Chat Integration Refactor — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service` & `services/social-service`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/social-service`, `services/api-gateway`
- **Created Date**: 2026-11-04
- **Target PR Boundaries**: 
  - Phase 1: Frontend Router & Direct Chat Bridge (Sửa link 404 `/restaurants/reservations` -> `/reservations?tab=restaurants`, tự động gửi tin nhắn đặt bàn vào Chat giữa Khách và Đối tác)
  - Phase 2: Partner Business Card & Dashboard Visibility (Bổ sung nút truy cập trực tiếp "Yêu cầu đặt bàn" + Badge số lượng đơn chờ duyệt `REQUESTED` trên Partner Card)
  - Phase 3: Symmetrical Status Notification & In-Chat Confirmation Sync (Tự động thông báo và gửi tin nhắn xác nhận trạng thái `CONFIRMED`/`REJECTED` vào Chat stream)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
- **Vấn đề thực tế (Pain Points)**:
  1. **Đường dẫn 404 khi đặt bàn ("chuyển vào đâu á")**: Sau khi khách hàng điền form yêu cầu đặt bàn tại trang nhà hàng công khai (`/restaurants/[businessId]`), popup thông báo thành công có nút *"Đơn đặt bàn của tôi"* điều hướng tới `/restaurants/reservations` — một route không tồn tại trong hệ thống, dẫn đến lỗi 404 hoặc bị redirect sai vị trí. Đường dẫn đúng quy chuẩn toàn hệ thống là `/reservations?tab=restaurants`.
  2. **Thiếu kết nối hội thoại Chat ("không có gửi tin nhắn rồi bên kia confirm")**: Khi khách gửi yêu cầu đặt bàn, hệ thống chỉ lưu âm thầm vào cơ sở dữ liệu `restaurant_reservation_request` mà không khởi tạo cuộc trò chuyện hoặc gửi tin nhắn vào Chat giữa Khách hàng và Chủ nhà hàng (`ownerUserId`). Khách không biết đối tác đã nhận được chưa, và đối tác cũng không nhận được tin nhắn trao đổi trong Chat.
  3. **Điểm mù trên Dashboard Đối tác ("bên kia cũng không thấy request luôn")**: Trên trang Đối tác (`/partner`), thẻ cơ sở Nhà hàng (`partner-business-card.tsx`) chỉ hiển thị nút *"Thực đơn & Bảng giá"* và *"Gói Hội Viên"*, hoàn toàn không có nút *"Yêu cầu đặt bàn"* hay số lượng đơn chờ duyệt. Đối tác phải tự mò vào trang menu rồi bấm sang tab phụ mới thấy danh sách đơn, dẫn đến việc bỏ sót hoặc không tìm thấy đơn khách gửi.

- **Mục tiêu người dùng (User Goal)**:
  - **Du khách (Guest)**: Đặt bàn nhanh chóng từ trang nhà hàng, hệ thống tự động mở luồng chat với quán kèm nội dung tóm tắt yêu cầu (Mã đơn, Giờ ăn, Số khách, SĐT). Có nút 1 chạm điều hướng chuẩn về `/reservations?tab=restaurants` và nút vào ngay `/chat?userId=${ownerUserId}`.
  - **Chủ nhà hàng (Partner)**: Nhận ngay tin nhắn trong Chat stream và thấy ngay nút **"Yêu cầu đặt bàn"** nổi bật trên thẻ cơ sở tại `/partner` (kèm badge đếm số đơn mới đang chờ duyệt). Chủ quán có thể xác nhận đơn trên Dashboard hoặc phát hành Thẻ đề xuất báo giá (In-Chat Reservation Offer) trực tiếp trong Chat.

---

### 1.2 User Flows & Journey

```text
[Du khách xem Nhà hàng (/restaurants/[id])]
       │
       ▼
[Bấm "Đặt bàn giữ chỗ" ──> Điền Form: Họ tên, SĐT, Giờ ăn, Số khách, Ghi chú]
       │
       ▼
[Bấm "Gửi yêu cầu đặt bàn"]
       │
       ├────────────────────────────────────────┬────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
1. Lưu đơn tại trip-service            2. Tự động gửi tin nhắn Chat            3. Hiển thị Popup thành công
  (Status: REQUESTED, Mã #TS-RES)        (Tạo hội thoại với Owner)              - Nút "Xem đơn đặt" (/reservations?tab=restaurants)
                                         (Nội dung tóm tắt đơn)                - Nút "Nhắn tin với Quán" (/chat?userId=...)
                                                │
                                                ▼
                         [Đối tác nhận tin nhắn trong Chat & Notification]
                                                │
       ┌────────────────────────────────────────┴────────────────────────────────────────┐
       ▼                                                                                 ▼
[Cách A: Xác nhận trên Partner Hub]                                     [Cách B: Đề xuất In-Chat Offer]
- Thẻ nhà hàng trên /partner hiển thị nút:                               - Đối tác bấm "Tạo phiếu báo giá / Đặt chỗ"
  "Yêu cầu đặt bàn (1 đơn mới)"                                          trong Chat composer
- Bấm vào mở tab Quản lý đặt bàn                                         - Gửi vé xác nhận trực tiếp cho khách
- Bấm "Xác nhận đặt bàn" (Confirm)                                       - Khách bấm "Xác nhận & Giữ bàn" trong Chat
       │
       ▼
[Cập nhật trạng thái CONFIRMED]
- trip-service cập nhật trạng thái đơn
- Tự động đẩy tin nhắn xác nhận vào Chat: "✅ Quán đã xác nhận đặt bàn #... Hẹn gặp bạn!"
- Đồng bộ hiển thị tại /reservations?tab=restaurants
```

---

### 1.3 Scope Boundaries

- **In-Scope**:
  - **Frontend Web (`apps/web/tripsense`)**:
    - Sửa link điều hướng sau khi đặt bàn tại `restaurant-reservation-dialog.tsx`: Chuyển từ `/restaurants/reservations` thành `/reservations?tab=restaurants`.
    - Tích hợp tự động gửi tin nhắn mở đầu cuộc trò chuyện tới `ownerUserId` của nhà hàng khi tạo yêu cầu đặt bàn thành công.
    - Cập nhật thẻ đối tác `partner-business-card.tsx`: Bổ sung nút **"Yêu cầu đặt bàn"** (kèm badge số đơn chờ duyệt nếu có) dẫn trực tiếp đến `/partner/businesses/${business.id}/restaurant-menu?tab=reservations`.
    - Khi chủ nhà hàng duyệt/từ chối đơn tại `restaurant-reservations-tab.tsx`, gửi tin nhắn thông báo kết quả tương ứng vào cuộc trò chuyện Chat với khách hàng.
    - Cập nhật file ngôn ngữ `vi.json` và `en.json` đảm bảo chuẩn i18n 100%.
  - **Backend Services**:
    - Sử dụng các API sẵn có của `trip-service` (`POST /api/restaurants/{businessId}/reservation-requests`, `POST .../decision`).
    - Sử dụng API tin nhắn của `social-service` (`POST /api/social/chat/conversations` / `messages`).
- **Out-of-Scope**:
  - Không thay đổi cấu trúc bảng cơ sở dữ liệu `restaurant_reservation_request`.
  - Không thay đổi logic tính toán công suất bàn của `availabilityEngine`.

---

### 1.4 Acceptance Criteria

- [ ] **AC-1**: Khi khách hàng đặt bàn thành công tại `RestaurantReservationDialog`, nút *"Đơn đặt bàn của tôi"* điều hướng chính xác đến `/reservations?tab=restaurants`, không bao giờ bị lỗi 404.
- [ ] **AC-2**: Khi khách hàng gửi yêu cầu đặt bàn thành công, hệ thống tự động tạo cuộc trò chuyện (hoặc gửi tin nhắn vào cuộc trò chuyện sẵn có) tới tài khoản chủ nhà hàng (`ownerUserId`) với nội dung tóm tắt chi tiết đặt bàn (Mã yêu cầu, ngày giờ, số khách, SĐT liên hệ, ghi chú).
- [ ] **AC-3**: Trên popup thành công của `RestaurantReservationDialog`, bổ sung nút hành động phụ *"Nhắn tin trao đổi với Quán"* dẫn tới `/chat?userId=${ownerUserId}` để khách có thể trò chuyện trực tiếp ngay lập tức.
- [ ] **AC-4**: Trên màn hình Quản lý đối tác (`/partner`), thẻ cơ sở Nhà hàng (`PartnerBusinessCard`) hiển thị nút chuyên biệt **"Yêu cầu đặt bàn"** dẫn thẳng vào tab danh sách đặt bàn (`/partner/businesses/${id}/restaurant-menu?tab=reservations`).
- [ ] **AC-5**: Khi chủ nhà hàng bấm **"Xác nhận đặt bàn"** hoặc **"Từ chối đặt bàn"** tại `RestaurantReservationsTab`, hệ thống tự động đồng bộ gửi tin nhắn cập nhật trạng thái vào cuộc trò chuyện của khách hàng trên Chat stream.
- [ ] **AC-6**: Tuân thủ chuẩn Zero-Leak Error Handling, không để lộ exception backend ra UI; đảm bảo 100% test suite Vitest và Type-check vượt qua.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Guest Browser]                       [API Gateway (:8080)]                  [Trip Service (:8084)]          [Social Service (:8085)]
       │                                        │                                       │                               │
       │ 1. POST /api/restaurants/{id}/...      │                                       │                               │
       ├───────────────────────────────────────>│ ── POST /reservation-requests ───────>│ (Save REQUESTED)             │
       │                                        │                                       │                               │
       │ 2. POST /api/social/chat/...           │                                       │                               │
       ├───────────────────────────────────────>│ ── POST /messages (Auto-Booking Msg) ─┼──────────────────────────────>│
       │                                        │                                       │                               │
       ▼                                        ▼                                       ▼                               ▼
[Guest sees success dialog]           [Partner sees request on Card]          [Partner views request]         [Partner sees Chat msg]
(/reservations?tab=restaurants)       (/partner -> "Yêu cầu đặt bàn")         (restaurant-reservations-tab)   (/chat?userId=guestId)
```

### 2.2 Service Ownership & Communication
| Component | Trách nhiệm | Giao thức giao tiếp |
| --- | --- | --- |
| `apps/web/tripsense` | Giao diện công khai nhà hàng, dialog đặt bàn, trang quản lý đối tác | HTTP REST qua Gateway |
| `services/api-gateway` | Điều phối traffic, xác thực JWT, định tuyến `/api/restaurants/**` và `/api/social/**` | Spring Cloud Gateway |
| `services/trip-service` | Sở hữu nghiệp vụ đặt bàn nhà hàng, kiểm tra tính hợp lệ và cập nhật trạng thái đơn | Spring Boot REST |
| `services/social-service` | Quản lý hội thoại chat, tin nhắn, sự kiện thông báo realtime | Spring Boot REST / Redis SSE |

---

## 3. Implementation Details & Contract Changes

### 3.1 Dialog Link Correction (`restaurant-reservation-dialog.tsx`)
```tsx
// Before (Broken 404):
<Link href="/restaurants/reservations" onClick={handleClose}>
  {t("partner.restaurant.viewMyReservations", { defaultValue: "Đơn đặt bàn của tôi" })}
</Link>

// After (Fixed):
<Link href="/reservations?tab=restaurants" onClick={handleClose}>
  {t("partner.restaurant.viewMyReservations", { defaultValue: "Đơn đặt bàn của tôi" })}
</Link>
```

### 3.2 Auto-Message Dispatch on Booking Creation
Khi tạo đơn thành công, gọi `chatApi.sendMessage` hoặc tạo tin nhắn trực tiếp với `ownerUserId`:
```typescript
const bookingSummaryMsg = `[Yêu cầu đặt bàn mới] Chào quán, mình đã gửi yêu cầu đặt bàn tại ${restaurantName}:\n- Thời gian: ${new Date(startInstant).toLocaleString("vi-VN")}\n- Số khách: ${numAdults} người lớn${numChildren > 0 ? `, ${numChildren} trẻ em` : ""}\n- Người đặt: ${trimmedName} (SĐT: ${cleanPhone})${notes.trim() ? `\n- Ghi chú: ${notes.trim()}` : ""}\nNhờ quán kiểm tra và xác nhận giúp mình nhé!`;

if (ownerUserId) {
  void chatApi.sendDirectMessage(ownerUserId, bookingSummaryMsg).catch(() => undefined);
}
```

### 3.3 Partner Business Card Action Enhancement (`partner-business-card.tsx`)
Bổ sung nút truy cập trực tiếp vào đặt bàn trên thẻ cơ sở Nhà hàng:
```tsx
{business.kind === "RESTAURANT" && (
  <Button
    asChild
    variant="outline"
    size="sm"
    className="h-8 text-xs flex-1 font-medium border-primary/30 text-primary hover:bg-primary/5"
  >
    <Link href={`/partner/businesses/${business.id}/restaurant-menu?tab=reservations`}>
      <Calendar className="mr-1.5 h-3.5 w-3.5" /> Yêu cầu đặt bàn
    </Link>
  </Button>
)}
```

---

## 4. Verification & Testing Plan

### 4.1 Automated Tests
- Cập nhật `apps/web/tripsense/src/features/partner/__tests__/restaurant-reservation.test.tsx`:
  - Kiểm tra dialog điều hướng đúng `/reservations?tab=restaurants`.
  - Kiểm tra việc gọi gửi tin nhắn chat tóm tắt khi gửi đơn đặt bàn.
  - Kiểm tra nút "Yêu cầu đặt bàn" trên `PartnerBusinessCard`.

### 4.2 Manual Verification Steps
1. Đăng nhập tài khoản du khách A (`tritvvde181029@fpt.edu.vn`).
2. Vào trang nhà hàng `/restaurants/e79797e4-eb35-4102-97d9-fd5e53acb67a` (Hawa's Food Đà Nẵng).
3. Bấm "Đặt bàn giữ chỗ", điền thông tin và bấm gửi.
4. Kiểm tra popup: Nút "Đơn đặt bàn của tôi" dẫn chuẩn về `/reservations?tab=restaurants` (hiển thị đơn mới tạo ở tab Nhà hàng).
5. Mở `/chat`: Thấy cuộc trò chuyện với chủ quán đã có tin nhắn tóm tắt đơn đặt bàn.
6. Đăng nhập tài khoản chủ quán (`tranvovantri@gmail.com`):
   - Vào `/partner`: Thấy thẻ Hawa's Food Đà Nẵng có nút "Yêu cầu đặt bàn".
   - Vào `/chat`: Thấy tin nhắn đặt bàn của khách.
   - Bấm "Yêu cầu đặt bàn" trên thẻ -> Mở đúng tab Đặt bàn, bấm "Xác nhận đặt bàn" thành công.

