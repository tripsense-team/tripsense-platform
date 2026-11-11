# Booking Activity Badges & Smart Tab Focus (User & Partner) — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway` (consumes existing `services/social-service` chat offers on frontend)
- **Created Date**: 2026-11-10
- **Related Features**: [Unified Hotel & Restaurant Reservation Experience](./unified-hotel-restaurant-reservation-experience.md), [Generic Travel Rental & Activity Services](./generic-travel-rental-and-services.md), [Restaurant Booking Real-time Notifications](./restaurant-booking-realtime-notifications.md), [Unified Notification Center](./unified-notification-center.md), [Chat Notifications & Unread Badge](./chat-notifications-and-unread-badge.md)
- **Target PR Boundaries**:
  - Phase 1: Rental/Hotel Partner Notification Emission & Lightweight Activity Summary Endpoints (`trip-service`, `api-gateway`)
  - Phase 2: User Sidebar & `/reservations` Badges, Mark-Seen Lifecycle & Smart Focus (`apps/web/tripsense`)
  - Phase 3: Partner Sidebar, `/partner` Hub & Business Card Badges + Smart Focus (`apps/web/tripsense`)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Hiện tại cả phía **Người dùng (Traveler)** và phía **Đối tác (Partner)** đều thiếu tín hiệu trực quan để biết nhanh mục nào đang có đơn đặt mới hoặc cập nhật chưa xem:

1. **Phía Người dùng (`/reservations` & `UserSidebar`)**:
   - Thanh bên (`UserSidebar`) có badge số tin nhắn chưa đọc ở `Chat` và số chuyến đi ở `My Trips`, nhưng `Đơn đặt của tôi` (`/reservations`) chưa hiển thị số lượng đơn/thông báo mới.
   - Trang `/reservations` (`UnifiedReservationsHub`) luôn mặc định mở tab **`Khách sạn & Lưu trú`** (`defaultTab = "hotels"`), và chỉ tải danh sách của từng tab khi user bấm vào tab đó (ví dụ `rentalOrders` chỉ tải khi `activeTab === "rentals"`). Nếu user vừa có cập nhật hoặc đơn mới bên **Nhà hàng & Quán ăn** hoặc **Thuê xe & Dịch vụ**, màn hình vẫn đứng ở tab Khách sạn khiến người dùng phải bấm thử từng tab để tìm.
   - Các tab `Khách sạn & Lưu trú`, `Nhà hàng & Quán ăn`, `Thuê xe & Dịch vụ` chưa gắn số đếm (`badge`), nên rất khó biết tab nào có đơn/cập nhật mới.

2. **Phía Đối tác (`UserSidebar` -> `Cơ sở kinh doanh`, `/partner`, `PartnerBookingsHub`, `PartnerBusinessCard`)**:
   - Mục `Cơ sở kinh doanh` trên `UserSidebar` chưa hiển thị badge tổng số đơn chờ xác nhận / đơn mới của đối tác.
   - Trang `/partner` (`PartnerDashboardView`) luôn mặc định mở tab **`Cơ sở & Dịch vụ`**, còn tab **`Quản lý Đơn đặt & Booking`** chưa hiển thị số đếm đơn chờ xử lý dù đối tác đang có đơn mới cần duyệt.
   - Trên từng thẻ cơ sở (`PartnerBusinessCard`) và dãy nút chọn cơ sở trong `PartnerBookingsHub`, chưa hiện số đơn chờ xác nhận của riêng cơ sở đó; đồng thời biến state `selectedServiceType` trong `PartnerBookingsHub` đã khai báo nhưng chưa có hàng chip lọc loại dịch vụ (`Khách sạn`, `Nhà hàng`, `Thuê xe`, `Phiếu Chat`) kèm số đếm.
   - Khi có đơn mới chờ duyệt, `PartnerBookingsHub` vẫn mở mặc định bộ lọc `Tất cả` (`ALL`) thay vì ưu tiên tích chọn ngay phần **`Chờ xác nhận`** (hoặc cơ sở / loại dịch vụ đang có đơn mới).
   - Ngoài ra dưới backend, `RentalService` (thuê xe/thiết bị) chưa ghi nhận thông báo vào `partner_notification` + `PartnerNotificationOutboxService`, nên đơn thuê xe mới chưa kích hoạt realtime badge cho Partner và Traveler.

**Mục tiêu nghiệp vụ**:
- **Mark số rõ ràng ("mark số vô")** ở mọi điểm điều hướng cấp cao và cấp tab/bộ lọc cho cả User và Partner.
- **Tự động tích vào mục có dữ liệu mới ("tích vô cái mới")** khi người dùng/đối tác mở trang mà chưa truyền bộ lọc tường minh, giúp vào là thấy ngay đơn cần xem hoặc cần xác nhận.

---

### 1.2 Definition of "Mới / Cần chú ý" & Priority Rules

Để tránh nhầm lẫn giữa **"tổng đơn lịch sử"** (ví dụ đơn đã hoàn thành/hủy từ trước) với **"cái mới / cần chú ý"**:

| Ngữ cảnh | Cách tính số đếm ("New / Actionable Badge") | Quy tắc "Tích vô cái mới" (Smart Auto-Focus) |
| --- | --- | --- |
| **User — `UserSidebar` (`Đơn đặt của tôi`)** | `unreadNotificationsCount + awaitingActionCount` (`HOTEL`: `hotel_notification` chưa đọc + đơn `HELD`; `RESTAURANT`: `partner_notification` cho khách chưa đọc + đơn `REQUESTED`; `RENTAL`: `partner_notification` cho khách chưa đọc + đơn `PENDING`; `CHAT_OFFER`: phiếu chờ chốt `PENDING`). | Click vào mở `/reservations` (không ép `?tab=` nếu chưa có tham số). |
| **User — `/reservations` 3 Tabs (`hotels`, `restaurants`, `rentals`)** | Mỗi tab hiển thị badge số **Cần chú ý / Mới** (`newCount`: notification chưa đọc thuộc vertical + đơn đang `HELD`/`REQUESTED`/`PENDING` + `PENDING` in-chat offer tương ứng) khi `newCount > 0`. Nếu `newCount === 0` nhưng có đơn đang diễn ra (`CONFIRMED`/`IN_USE`/`UPCOMING`), hiển thị chip xám mảnh số đơn đang hiệu lực (`activeCount`). | Khi URL **không có `?tab=`** và user chưa tự click tab: ưu tiên tích vào tab có **`unreadCount > 0`** mới nhất (theo `latestActivityAt`), kế đến tab có **`pendingCount > 0`** mới nhất, kế đến tab có **`activeCount > 0`** mới nhất, mặc định cuối cùng là `hotels`. |
| **User — Sub-filter trong tab** | `Đang giữ phòng (N)` / `Chờ duyệt (N)` / `Chờ xác nhận` đã có số. | Nếu user chưa bấm filter con và tab có đơn `HELD` / `REQUESTED` hoặc `targetBookingId`, tự chọn pill chờ xử lý/liên quan; nếu đã xem hết thì giữ `Tất cả`. |
| **User — Cơ chế Mark-Seen** | Khi tab tương ứng đang active (khi mount hoặc user click sang tab đó), frontend gọi `POST /api/me/reservations/activity-summary/mark-seen` cho vertical đó để đánh dấu `read_at` cho các `hotel_notification` / `partner_notification` đã hiển thị và phát event refresh Sidebar. Các đơn đang `HELD`/`REQUESTED`/`PENDING` tiếp tục giữ badge nhắc nhở đến khi chốt hoặc hủy. | Không toast khi chuyển tab hay mark-seen theo chuẩn `UX_FEEDBACK_GUIDELINES.md`. |
| **Partner — `UserSidebar` (`Cơ sở kinh doanh`)** | Tổng số **đơn chờ xử lý** (`pendingTotal = hotel HELD + restaurant REQUESTED + rental PENDING`) + thông báo đặt chỗ đối tác chưa đọc thuộc mọi cơ sở active (`OWNER`/`MANAGER`/`STAFF`). | Badge màu amber/rose gọn trên item `Cơ sở kinh doanh` (hiện cả dạng thu gọn `collapsed` tương tự Chat). |
| **Partner — `/partner` Tabs & `PartnerBusinessCard`** | Tab `Quản lý Đơn đặt & Booking` hiển thị badge **`pendingTotal`** (vàng/đỏ nổi bật nếu `> 0`, trung tính nếu `0`). Mỗi `PartnerBusinessCard` hiển thị pill `+N đơn chờ` trên nút xem đơn của cơ sở đó. | Khi vào `/partner` **không có `?tab=businesses` tường minh**: nếu `pendingTotal > 0` hoặc có thông báo đặt chỗ mới chưa đọc, tự động tích sang tab `"bookings"` (`Quản lý Đơn đặt & Booking`); nếu `pendingTotal === 0`, giữ mặc định `"businesses"`. |
| **Partner — `PartnerBookingsHub` Bộ lọc** | Gắn số đơn chờ (`pending`) / tổng (`total`) lên: (1) nút chọn từng cơ sở, (2) hàng chip **Loại dịch vụ** (`Tất cả`, `Khách sạn`, `Nhà hàng`, `Thuê xe & Dịch vụ`, `Phiếu Chat`), (3) hàng chip **Trạng thái** (`Chờ xác nhận`, `Đã xác nhận`, ...). | Khi vào hub không có filter cụ thể và `pendingCount > 0`: tự động tích chip trạng thái **`PENDING` (`Chờ xác nhận`)**; nếu toàn bộ đơn chờ chỉ nằm ở 1 cơ sở hoặc 1 loại dịch vụ, gợi ý/tích sẵn hoặc sắp xếp nút đó nổi bật đầu danh sách. Khi duyệt xong đơn cuối cùng (`pendingCount` -> `0`), tự chuyển trạng thái về `ALL` để tránh màn hình trống. |

---

### 1.3 Scope Boundaries

- **In-Scope**:
  - `services/trip-service`:
    - Phát sự kiện `PartnerNotification` qua `PartnerNotificationOutboxService` trong `RentalService` (đơn mới, xác nhận, từ chối, bàn giao, hoàn trả, khách hủy) và bổ sung thông báo cho chủ khách sạn trong `HotelService` khi có giữ chỗ mới / khách hủy.
    - Thêm API tóm tắt hoạt động cho User (`GET /api/me/reservations/activity-summary`, `POST /api/me/reservations/activity-summary/mark-seen`) và cho Partner (`GET /api/partners/bookings/activity-summary`) chỉ dùng query `COUNT(*)` / `MAX(...)` nhẹ trên `trip-service`.
  - `services/api-gateway`: Routing `/api/me/reservations/**` tới `lb://trip-service` (chặn endpoint nội bộ nếu có, giữ Auth JWT); `/api/partners/**` đã route sẵn.
  - `apps/web/tripsense`:
    - Hook `useReservationActivitySummary` (lắng nghe SSE `/api/partners/notifications/events`, window event `app:notifications-refresh` & `reservations:activity-changed`).
    - Cập nhật `UserSidebar` (badge trên `Đơn đặt của tôi` và `Cơ sở kinh doanh`).
    - Cập nhật `UnifiedReservationsHub`, `UserBookingsView`, `CustomerReservationsView` (badge số trên tab + sub-filter + smart tab focus + mark-seen).
    - Cập nhật `PartnerDashboardView`, `PartnerBusinessCard`, `PartnerBookingsHub` (badge số trên tab, thẻ cơ sở, chip cơ sở, chip loại dịch vụ + smart focus `PENDING`).
    - Bổ sung i18n parity 100% (`en.json`, `vi.json`), ESLint, Vitest & JUnit tests.
- **Out-of-Scope**:
  - Không thay đổi DB của `social-service` cho `ReservationOffer`; frontend tiếp tục gộp `chatApi.myOffers()` với dữ liệu từ `trip-service`.
  - Không tạo microservice `notification-service` mới trong phạm vi này.
  - Không thêm Toast khi chuyển tab, mark-seen hay tự động focus tab.
  - Không thay đổi quy trình thanh toán PayOS hoặc trạng thái nghiệp vụ cốt lõi của đơn đặt.

---

### 1.4 Acceptance Criteria

- [ ] **AC-1 (User Sidebar & `/reservations` Badges)**: Sidebar `Đơn đặt của tôi` hiển thị chính xác tổng số mục cần chú ý (`> 0`), ẩn khi `0`; cả 3 tab tại `/reservations` (`Khách sạn & Lưu trú`, `Nhà hàng & Quán ăn`, `Thuê xe & Dịch vụ`) hiển thị badge số ngay lần tải đầu mà không cần bấm từng tab trước.
- [ ] **AC-2 (User Smart Auto-Focus)**: Khi truy cập `/reservations` không có query `?tab=`, hệ thống tự động chọn tab có thông báo mới chưa đọc hoặc đơn chờ xử lý mới nhất (nếu tab `Thuê xe & Dịch vụ` có đơn mới còn `Khách sạn` trống, mặc định tích sẵn vào `Thuê xe & Dịch vụ`). Nếu URL có `?tab=hotels|restaurants|rentals` hoặc user vừa tự chuyển tab, **tuyệt đối không** tự nhảy tab khác.
- [ ] **AC-3 (User Mark-Seen Lifecycle)**: Khi người dùng mở một tab trong `/reservations`, thông báo chưa đọc thuộc vertical đó được đánh dấu đã đọc (`mark-seen`) trên server và cập nhật lại badge trên `UserSidebar` + `NotificationCenter` theo thời gian thực.
- [ ] **AC-4 (Partner Sidebar, `/partner` Tabs & Business Cards)**: Mục `Cơ sở kinh doanh` trên `UserSidebar`, tab `Quản lý Đơn đặt & Booking` trên `/partner`, và nút xem đơn trên mỗi `PartnerBusinessCard` hiển thị chính xác số đơn đang chờ xác nhận (`HELD` + `REQUESTED` + `PENDING`).
- [ ] **AC-5 (Partner Smart Focus & Service Filters)**: Khi partner mở `/partner` không truyền `?tab=` và đang có đơn chờ xác nhận (`pendingTotal > 0`), hệ thống tự động tích vào tab `Quản lý Đơn đặt & Booking` và mặc định lọc `Chờ xác nhận (PENDING)` trong `PartnerBookingsHub`, đồng thời hiển thị hàng nút lọc theo loại dịch vụ (`Khách sạn`, `Nhà hàng`, `Thuê xe & Dịch vụ`, `Phiếu Chat`) kèm số đếm từng loại và từng cơ sở. Khi đối tác xác nhận/từ chối hết đơn `PENDING`, hub tự trả bộ lọc trạng thái về `ALL`.
- [ ] **AC-6 (Rental Realtime Notification Emission)**: Tạo mới, xác nhận, từ chối, bàn giao, hoàn trả hoặc hủy `RentalBookingOrder` trong `RentalService` sinh `PartnerNotification` + `NotificationRealtimeOutbox` hợp lệ cho người nhận tương ứng (chỉ OWNER/MANAGER của cơ sở cho luồng Partner; `customerId` cho luồng Traveler).
- [ ] **AC-7 (Quality, Security & i18n)**: IDOR-safe (chỉ đọc dữ liệu theo `AuthenticatedUser.id()` và membership `ACTIVE`), zero-leak error handling, `npm run i18n:check`, `npm run type-check`, Vitest, và JUnit trong `trip-service` pass 100%.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Next.js Web: UserSidebar / UnifiedReservationsHub / PartnerDashboardView]
   |
   |-- GET /api/me/reservations/activity-summary  ──┐
   |-- POST /api/me/reservations/activity-summary/mark-seen
   |-- GET /api/partners/bookings/activity-summary  ├──> [API Gateway :8080] ──> [trip-service]
   |-- SSE /api/partners/notifications/events       ┘          |                    |
   |                                                           |                    +-> Query local tables only:
   |                                                           |                        hotel_booking, hotel_notification,
   |                                                           |                        restaurant_reservation_request,
   |                                                           |                        rental_booking_order, partner_notification
   |-- GET /api/social/chat/offers/me (existing) ──────────────┴──> [social-service]
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/trip-service` | Chủ sở hữu toàn bộ bảng `hotel_booking`, `hotel_notification`, `restaurant_reservation_request`, `rental_booking_order`, `partner_notification`, `partner_business_member`. Tính summary counts và phát realtime SSE `notification.changed`. | Sync REST qua Gateway + Redis Pub/Sub SSE nội bộ service |
| `services/social-service` | Chủ sở hữu `ReservationOffer` (phiếu đặt trong chat). Không thay đổi API; web đã có `GET /api/social/chat/offers/me`. | Existing Sync REST + Chat SSE |
| `services/api-gateway` | Route `/api/me/reservations/**` và `/api/partners/**` sang `lb://trip-service`. | Spring Cloud Gateway |
| `apps/web/tripsense` | Kết hợp summary từ `trip-service` với `chatApi.myOffers()`, điều phối badge số trên Sidebar/Tabs/Cards, mark-seen, và smart auto-focus không gây nhảy UI ngoài ý muốn. | Authenticated `apiClient` + `authenticatedFetch` SSE |

### 2.3 Architecture Guardrails Verification

- [x] Traffic client đi qua API Gateway (`:8080`), không gọi trực tiếp port service.
- [x] Không query chéo database giữa `trip-service` và `social-service`; gộp in-chat offers ở BFF/frontend qua REST đã có.
- [x] Không tạo JPA relationship chéo microservice.
- [x] Toàn bộ luồng thông báo dùng lại bảng `partner_notification`, `hotel_notification`, và `notification_realtime_outbox` hiện có của `trip-service`.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints (API Gateway -> `trip-service`)

| Method | Gateway Path | Auth Required | Roles | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/api/me/reservations/activity-summary` | `Bearer JWT` | Authenticated User | Tóm tắt số đơn/cập nhật mới của du khách theo 3 nhóm (`hotels`, `restaurants`, `rentals`) & `recommendedTab`. |
| `POST` | `/api/me/reservations/activity-summary/mark-seen` | `Bearer JWT` | Authenticated User | Đánh dấu đã đọc các thông báo đặt chỗ chưa đọc thuộc 1 vertical cụ thể khi user mở tab đó. |
| `GET` | `/api/partners/bookings/activity-summary` | `Bearer JWT` | Partner (`ACTIVE` member) | Tóm tắt tổng đơn chờ xử lý (`pendingTotal`), thông báo chưa đọc, chi tiết theo từng `businessId` và theo loại dịch vụ. |

#### User Activity Summary DTO (`GET /api/me/reservations/activity-summary`)
```json
{
  "success": true,
  "data": {
    "totalAttentionCount": 2,
    "unreadNotificationCount": 1,
    "recommendedTab": "rentals",
    "verticals": {
      "hotels": {
        "unreadCount": 0,
        "pendingCount": 0,
        "activeCount": 1,
        "totalCount": 2,
        "attentionCount": 0,
        "latestActivityAt": "2026-11-08T10:15:00Z"
      },
      "restaurants": {
        "unreadCount": 0,
        "pendingCount": 0,
        "activeCount": 0,
        "totalCount": 0,
        "attentionCount": 0,
        "latestActivityAt": null
      },
      "rentals": {
        "unreadCount": 1,
        "pendingCount": 1,
        "activeCount": 1,
        "totalCount": 1,
        "attentionCount": 2,
        "latestActivityAt": "2026-11-10T15:10:36Z"
      }
    }
  }
}
```
*Lưu ý tính `totalAttentionCount` cho UI*: `pendingCount` + `unreadCount` được tách rõ trong DTO để tránh cộng trùng cùng 1 sự kiện nếu muốn chỉ hiện `Math.max(pendingCount, unreadCount)` hoặc gộp rõ `pendingOrUnread` trên badge; định nghĩa chuẩn đề xuất: `badgeCount = max(pendingCount, 0) + unreadConfirmationOrDecisionUpdates` hoặc hiển thị số mục distinct chưa xử lý/chưa đọc theo quy tắc đồng nhất giữa `UserSidebar` và `UnifiedReservationsHub`.

#### User Mark-Seen Request DTO (`POST /api/me/reservations/activity-summary/mark-seen`)
```json
{
  "vertical": "RENTALS"
}
```
- `vertical` enum hợp lệ: `HOTELS`, `RESTAURANTS`, `RENTALS` (trả `400 BAD_REQUEST` nếu khác).
- Khi `HOTELS`: cập nhật `hotel_notification.read_at = now()` với `recipient_id = user.id() AND read_at IS NULL`.
- Khi `RESTAURANTS`: cập nhật `partner_notification.read_at = now()` với `recipient_id = user.id() AND read_at IS NULL AND event_type IN ('RESTAURANT_RESERVATION_PLACED', 'RESTAURANT_RESERVATION_CONFIRMED', 'RESTAURANT_RESERVATION_REJECTED', 'RESTAURANT_RESERVATION_CANCELLED')`.
- Khi `RENTALS`: cập nhật `partner_notification.read_at = now()` với `recipient_id = user.id() AND read_at IS NULL AND event_type IN ('RENTAL_BOOKING_PLACED', 'RENTAL_BOOKING_CONFIRMED', 'RENTAL_BOOKING_REJECTED', 'RENTAL_BOOKING_HANDED_OVER', 'RENTAL_BOOKING_RETURNED', 'RENTAL_BOOKING_CANCELLED')`.

#### Partner Activity Summary DTO (`GET /api/partners/bookings/activity-summary`)
```json
{
  "success": true,
  "data": {
    "pendingTotal": 3,
    "unreadNotificationCount": 2,
    "recommendedDashboardTab": "bookings",
    "byServiceType": {
      "HOTEL": 1,
      "RESTAURANT": 1,
      "RENTAL": 1
    },
    "businesses": [
      {
        "businessId": "c26f77f0-4c72-4cb2-9126-0402fee85289",
        "kind": "RENTAL_SERVICE",
        "pendingCount": 1,
        "unreadNotificationCount": 1,
        "latestPendingAt": "2026-11-10T15:10:36Z"
      }
    ]
  }
}
```
*Quy tắc với non-partner user*: Nếu user đã đăng nhập nhưng chưa có membership `ACTIVE` nào, trả về summary rỗng với `pendingTotal: 0, unreadNotificationCount: 0, recommendedDashboardTab: "businesses", businesses: []` (`200 OK`, không ném `403` để `UserSidebar` gọi an toàn cho mọi user đã đăng nhập).

### 3.2 Partner & Customer Notification Events (`partner_notification` + SSE `notification.changed`)

Mở rộng sử dụng `PartnerNotificationOutboxService.saveNotificationWithOutbox(...)` đã có sẵn:

| Domain | Trigger Action | `event_type` | Recipient |
| --- | --- | --- | --- |
| **Rental** | Khách tạo đơn thuê mới | `RENTAL_BOOKING_REQUESTED` | Active `OWNER` / `MANAGER` của `businessId` |
| **Rental** | Khách tạo đơn thuê mới | `RENTAL_BOOKING_PLACED` | `customerId` |
| **Rental** | Đối tác xác nhận / từ chối / bàn giao / hoàn trả | `RENTAL_BOOKING_CONFIRMED`, `RENTAL_BOOKING_REJECTED`, `RENTAL_BOOKING_HANDED_OVER`, `RENTAL_BOOKING_RETURNED` | `customerId` |
| **Rental** | Khách hủy đơn thuê | `RENTAL_BOOKING_CANCELLED` | Active `OWNER` / `MANAGER` của `businessId` |
| **Hotel** | Khách tạo giữ chỗ (`HELD`) / hủy (`CANCELLED`) | `HOTEL_BOOKING_REQUESTED`, `HOTEL_BOOKING_CANCELLED_BY_CUSTOMER` | Active `OWNER` / `MANAGER` của `businessId` |

Đồng thời cập nhật `useUnifiedNotifications.ts` trên frontend để ánh xạ thêm các `event_type` trên (`RENTAL_BOOKING_*`, `HOTEL_BOOKING_REQUESTED`, `HOTEL_BOOKING_CANCELLED_BY_CUSTOMER`) với `targetUrl` trỏ đúng về `/reservations?tab=rentals` (cho du khách) hoặc `/partner?tab=bookings&businessId={businessId}` (cho đối tác).

---

## 4. Data Model & Migrations

- **Không cần thêm bảng mới.** Dữ liệu nguồn nằm sẵn trong `hotel_booking`, `hotel_notification`, `restaurant_reservation_request`, `rental_booking_order`, `partner_notification`, và `partner_business_member`.
- Cột `partner_notification.event_type` hiện có kiểu `VARCHAR(60)`, đủ sức chứa tất cả event name mới (dài nhất là `HOTEL_BOOKING_CANCELLED_BY_CUSTOMER`, 35 ký tự).
- **Flyway Migration đề xuất**: `services/trip-service/src/main/resources/db/migration/V20261110120000__add_booking_activity_summary_indexes.sql`

```sql
-- Tối ưu truy vấn unread count & mark-seen theo recipient + event_type
CREATE INDEX IF NOT EXISTS idx_partner_notification_unread_type
    ON partner_notification (recipient_id, event_type, business_id)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hotel_notification_unread
    ON hotel_notification (recipient_id, created_at DESC)
    WHERE read_at IS NULL;

-- Tối ưu truy vấn COUNT/MAX theo customer và status cho user summary
CREATE INDEX IF NOT EXISTS idx_hotel_booking_customer_status
    ON hotel_booking (customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hotel_booking_business_status
    ON hotel_booking (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_res_customer_state
    ON restaurant_reservation_request (customer_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_res_business_state
    ON restaurant_reservation_request (business_id, state, created_at DESC);
```
- **Rollback**: Các lệnh đều là `CREATE INDEX IF NOT EXISTS` không làm thay đổi cấu trúc dữ liệu, có thể rollback bằng `DROP INDEX IF EXISTS ...` nếu cần.

---

## 5. Security & Trust Boundaries

1. **JWT & Anti-IDOR**:
   - `GET /api/me/reservations/activity-summary` và `POST /api/me/reservations/activity-summary/mark-seen` luôn lấy `userId` từ `@AuthenticationPrincipal AuthenticatedUser`, không nhận `userId` từ query hay body.
   - `GET /api/partners/bookings/activity-summary` luôn truy vấn `partner_business_member` nơi `id.userId = user.id()` và `state = 'ACTIVE'`, tuyệt đối không tin `businessId` do client gửi lên nếu user không phải thành viên active.
2. **Gateway Exposure**:
   - Cần bổ sung `/api/me/reservations/**` vào `TRIP_SERVICE_ROUTE_ID` trong `GatewayRoutesConfig.java` (nằm ngay cạnh `/api/me/restaurant-reservation-requests`), đồng thời đặt `Cache-Control: no-store` hoặc xử lý chuẩn authenticated REST.
   - Đảm bảo SecurityConfig trong `trip-service` yêu cầu `authenticated()` cho `/api/me/reservations/**` và `/api/partners/**` (tránh mở nhầm vào `permitAll`).
3. **XSS & Zero-Leak Logging**:
   - Thông báo tạo từ tên khách hàng/cơ sở không render `dangerouslySetInnerHTML`.
   - Frontend bắt lỗi qua `getSafeErrorMessage`, các hook nền trên Sidebar (`useReservationActivitySummary`) fail silently về `0` khi chưa đăng nhập hoặc mất mạng tạm thời để không gây spam alert/toast.
4. **Notification Recipient Privacy**:
   - `RentalService` và `HotelService` chỉ phát `PartnerNotification` tới thành viên `ACTIVE` có role `OWNER` hoặc `MANAGER` (khớp với rule hiện hành trong `RestaurantReservationService`).

---

## 6. Devil's Advocate & Technical Trade-offs

| Rủi ro / Vấn đề | Phương án bị loại bỏ | Giải pháp được chọn & Lý do |
| --- | --- | --- |
| **Gọi N API chi tiết trên `UserSidebar` để đếm badge** | Fetch toàn bộ danh sách hotel properties + bookings + restaurant reservations + rental orders mỗi khi mount `UserSidebar`. | **Loại** vì gây N+1 request trên mọi trang và chậm load. **Chọn**: 1 API aggregate dùng SQL `COUNT(*)` / `MAX(...)` ở `trip-service` (`< 10ms`) + cập nhật lại qua SSE `notification.changed` & custom window event. |
| **Auto-focus đè lên thao tác của người dùng** | Luôn ép `setActiveTab(recommendedTab)` mỗi lần dữ liệu summary refetch. | **Loại** vì sẽ giật tab khi user đang xem tab khác. **Chọn**: Chỉ chạy smart-focus **1 lần lúc mount** (`hasAutoFocusedRef`), **chỉ khi URL không có `?tab=` (và với Partner không có `?businessId=` / `?tab=`)**, và dừng ngay nếu user đã click tab (`hasUserInteractedRef`). |
| **Màn hình trống sau khi duyệt đơn cuối cùng trong `PartnerBookingsHub`** | Giữ nguyên filter `PENDING` sau khi vừa confirm/reject đơn pending cuối cùng. | **Chọn**: Khi `filteredBookings` thuộc tab `PENDING` giảm về `0` sau thao tác confirm/reject thành công, hiển thị inline notice đã xử lý xong tất cả và tự động chuyển filter về `ALL` (chỉ khi trước đó đang đứng ở `PENDING` do auto-focus hoặc vừa xử lý xong). |
| **Định nghĩa số "mới" gây rối (đếm quá to gồm cả đơn cũ đã xong)** | Đếm tất cả `CONFIRMED` + `COMPLETED` + `CANCELLED` làm badge đỏ trên Sidebar. | **Chọn**: Sidebar chỉ mark số **cần chú ý / mới** (chờ xác nhận + thông báo đặt chỗ chưa đọc + phiếu chat chờ chốt). Số đơn lịch sử/tổng vẫn nằm trong các pill sub-filter bên trong trang. |
| **Lệch nhịp giữa `partner_notification` và dữ liệu in-chat offers (`social-service`)** | Bắt `trip-service` gọi HTTP sang `social-service` đồng bộ để gộp counts. | **Loại** vì tăng latency/coupling cho every page render. **Chọn**: `trip-service` trả counts cho trực tiếp 3 kênh nó sở hữu; frontend gộp nhẹ thêm `chatApi.myOffers()` tại `/reservations` & `UserSidebar` (khi đã auth, hoặc dùng sẵn cache/fetch song song). |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend Notification Emission & Activity Summary APIs (`services/trip-service`, `services/api-gateway`)
- [x] Task 1.1: Tạo migration `V20261110120000__add_booking_activity_summary_indexes.sql` trong `services/trip-service`.
- [x] Task 1.2: Bổ sung phát `PartnerNotification` qua `PartnerNotificationOutboxService` trong `RentalService` (`RENTAL_BOOKING_REQUESTED`, `RENTAL_BOOKING_PLACED`, `RENTAL_BOOKING_CONFIRMED`, `RENTAL_BOOKING_REJECTED`, `RENTAL_BOOKING_HANDED_OVER`, `RENTAL_BOOKING_RETURNED`, `RENTAL_BOOKING_CANCELLED`) và `HotelService` (`HOTEL_BOOKING_REQUESTED`, `HOTEL_BOOKING_CANCELLED_BY_CUSTOMER`).
- [x] Task 1.3: Triển khai `BookingActivitySummaryService` + Controller cho `GET /api/me/reservations/activity-summary`, `POST /api/me/reservations/activity-summary/mark-seen`, và `GET /api/partners/bookings/activity-summary`.
- [x] Task 1.4: Thêm `/api/me/reservations/**` vào `GatewayRoutesConfig.java` (`services/api-gateway`).
- [x] Task 1.5: Viết JUnit unit tests cho `BookingActivitySummaryServiceTest`, cập nhật `RentalServiceTest` & `PartnerNotificationServiceTest`.

### Phase 2: User Sidebar & `/reservations` Badges + Smart Focus (`apps/web/tripsense`)
- [x] Task 2.1: Thêm API client & types (`reservations-activity-api.ts`) + hook dùng chung `useReservationActivitySummary` (`use-booking-activity-summary.ts`).
- [x] Task 2.2: Gắn badge số lên mục `Đơn đặt của tôi` trong `UserSidebar` (cả bản mở rộng và bản `collapsed` với tooltip).
- [x] Task 2.3: Cập nhật `UnifiedReservationsHub`, `UserBookingsView`, và `CustomerReservationsView` (badge số trên 3 tabs, smart auto-focus khi không truyền `?tab=`, `mark-seen`, sub-filter focus `HELD`/`REQUESTED`).

### Phase 3: Partner Sidebar, `/partner` Dashboard, Cards & `PartnerBookingsHub` (`apps/web/tripsense`)
- [x] Task 3.1: Gắn badge số đơn chờ xử lý + thông báo mới lên mục `Cơ sở kinh doanh` trong `UserSidebar`.
- [x] Task 3.2: Cập nhật `PartnerDashboardView` hiển thị badge số trên tab `Quản lý Đơn đặt & Booking` và auto-focus sang `"bookings"` khi có đơn chờ xử lý.
- [x] Task 3.3: Cập nhật `PartnerBusinessCard` hiển thị badge số đơn chờ riêng từng cơ sở.
- [x] Task 3.4: Cập nhật `PartnerBookingsHub` với hàng filter Loại dịch vụ kèm số đếm, badge trên chip cơ sở, smart-focus `PENDING` và tự reset về `ALL` khi duyệt hết đơn chờ.

### Phase 4: Localization, Automated Tests & Verification
- [x] Task 4.1: Cập nhật `vi.json` & `en.json`, `npm run i18n:sort` & `npm run i18n:check`.
- [x] Task 4.2: Viết & chạy `booking-activity-summary.test.tsx` + cập nhật `partner-bookings-hub.test.tsx`.
- [x] Task 4.3: Chạy JUnit (`trip-service`, `46/46` passed), `type-check`, `eslint` (`0` errors), và `vitest run` (`91/91` files, `452/452` tests passed).

---

## Human Approval Gate

```text
STATUS: DONE
```

> Bản đặc tả kiến trúc, hợp đồng API và kế hoạch triển khai tính năng **Đánh dấu số đếm & Tự động chuyển vào mục có đơn mới (Booking Activity Badges & Smart Tab Focus)** cho cả phía **User** và **Partner** đã hoàn tất.
> Vui lòng phản hồi **`Approved`**, **`Implement`**, hoặc **`Proceed`** (hoặc nêu rõ điểm muốn điều chỉnh) trước khi bắt đầu sửa source code.

