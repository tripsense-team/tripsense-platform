# In-Chat Reservation Offer & Ticket Confirmation — Specification & Implementation Plan

`STATUS: IMPLEMENTED`

- **Owner Service**: `services/social-service` (Chat Stream & Offer Negotiation) & `services/trip-service` (Booking Execution)
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/social-service`, `services/trip-service`
- **Created Date**: 2026-11-02
- **Target PR Boundaries**: 
  - Phase 1: Database & Social Service Offer Contracts (Flyway, Offer Entity/DTO, REST endpoints, SSE invalidation)
  - Phase 2: Trip Service Booking Linkage & Acceptance Bridge (`POST /api/social/chat/offers/{id}/accept`)
  - Phase 3: Web Frontend Interactive Ticket Card, Proposal Composer Modal, Real-time Status Sync & i18n

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
- **Problem**: In conversational commerce (Airbnb, Booking.com, Grab), guests frequently initiate contact with partners (Hotels, Restaurants) via direct chat to inquire about room availability, special discounts, custom dates, or group dining arrangements. After discussing in chat, when the partner agrees to provide service (*"ok bạn mình gửi bill xác nhận nhé"*), there is currently **no structured mechanism** in TripSense to issue a formal booking proposal or ticket inside the chat. Guests are forced to leave chat, search the hotel/restaurant again from scratch, or settle transactions outside the platform (causing platform disintermediation, loss of commission, and fraud risks).
- **User Goal**: 
  - **For Partners (Hotels & Restaurants)**: Able to issue an official, actionable **In-Chat Reservation Offer (Phiếu đề xuất / Báo giá đặt chỗ)** with customizable room/table, dates, guest counts, pricing, inclusions, and an expiration countdown.
  - **For Guests (Travelers)**: Receive a sleek, interactive **Booking Ticket Card** directly in the chat bubble. The guest can inspect all details and click **"Xác nhận & Giữ phòng"** (or Decline) directly within the conversation. Upon confirmation, an official booking record (`#TS-HTL-XXXXX` / `#TS-RES-XXXXX`) is generated and synced into `/reservations`.

### 1.2 User Flows & Journey

```text
[Khách hỏi tư vấn trong Chat] 
       │
       ▼
[Đối tác bấm "Tạo phiếu báo giá / Đặt chỗ" trên Chat Composer]
       │
       ▼
[Đối tác điền Modal: Loại phòng/Bàn, Ngày giờ, Giá, Hạn giữ chỗ] 
       │
       ▼
[Gửi tin nhắn type: RESERVATION_OFFER ──> Xuất hiện Thẻ Vé / Bill trong Chat stream]
       │
       ├────────────────────────────────────────┬────────────────────────────────────────┐
       ▼                                        ▼                                        ▼
[Khách bấm "Xác nhận & Đặt chỗ"]       [Khách bấm "Từ chối"]                  [Quá hạn giữ chỗ]
       │                                        │                                        │
       ▼                                        ▼                                        ▼
[Tạo Booking chính thức tại trip-service]  [Thẻ chuyển "ĐÃ TỪ CHỐI"]             [Thẻ chuyển "ĐÃ HẾT HẠN"]
[Thẻ cập nhật "ĐÃ XÁC NHẬN" + Mã đơn]      [Đối tác nhận thông báo realtime]     [Không thể xác nhận tiếp]
[Nút "Xem tại Đơn đặt của tôi" (/reservations)]
```

1. **Khởi tạo Đề xuất (Partner Action)**:
   - Khi đối tác đang trò chuyện với khách hàng trong một cuộc hội thoại, tại thanh soạn tin nhắn chat hiển thị nút hành động: **"Tạo phiếu đặt chỗ / Báo giá"** (`Ticket` / `FileSpreadsheet` icon).
   - Popup soạn phiếu mở ra:
     - Tự động điền cơ sở kinh doanh của đối tác (Khách sạn hoặc Nhà hàng).
     - Tự động trích xuất ngày nhận/trả và số khách nếu tin nhắn gần nhất có đề cập.
     - Cho phép chọn loại phòng (hoặc loại bàn), ngày nhận phòng/trả phòng (hoặc giờ ăn), số lượng khách, tổng giá tiền thỏa thuận, điều khoản (ví dụ: *Bao gồm ăn sáng, nhận phòng sớm 12:00*), và thời hạn giữ phiếu (30 phút, 2 giờ, 12 giờ, 24 giờ).
     - Bấm **"Gửi phiếu xác nhận"**.
2. **Hiển thị Thẻ Vé Đặt Chỗ (Interactive Chat Stream)**:
   - Tin nhắn hiển thị dưới dạng **Thẻ Vé Đặt Chỗ (Reservation Ticket Card)** đặc thù với viền đứt nét vé (ticket perforation), huy hiệu trạng thái `CHỜ KHÁCH XÁC NHẬN`, đồng hồ đếm ngược thời gian hết hạn (`Hết hạn sau 01:58:30`), chi tiết phòng/bàn, giá tiền, và ghi chú dịch vụ.
   - Đối tác có thể bấm **"Hủy phiếu"** nếu cơ sở bất ngờ hết phòng hoặc đổi ý.
3. **Phản hồi của Du khách (Guest Action)**:
   - Khách hàng xem thẻ vé ngay trong bong bóng chat.
   - Nút hành động chính: **"Xác nhận & Giữ phòng ngay" (Accept & Confirm)**.
   - Nút phụ: **"Từ chối" (Decline)** kèm lý do ngắn gọn.
4. **Đồng bộ trạng thái & Khởi tạo Đơn Đặt (System Execution)**:
   - Khi khách bấm xác nhận: Hệ thống gọi Gateway tạo đơn đặt chính thức trong `trip-service` (`hotel_bookings` hoặc `restaurant_reservations`), cấp mã đơn `#TS-HTL-...` hoặc `#TS-RES-...`.
   - Thẻ vé trong chat chuyển trạng thái thời gian thực sang `✅ ĐÃ XÁC NHẬN (CONFIRMED)`.
   - Hiển thị nút liên kết một chạm: **"Xem chi tiết trong Đơn đặt của tôi"** điều hướng trực tiếp đến `/reservations?tab=hotels` hoặc `/reservations?tab=restaurants`.
   - Gửi thông báo đến Trung tâm thông báo (`/notifications`) của cả 2 bên.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Hỗ trợ phiếu đề xuất cho 2 loại hình dịch vụ: **Khách sạn (Hotel Room)** và **Nhà hàng (Restaurant Table)** (mở rộng kiến trúc cho Tour Guide sau này).
  - Bảng cơ sở dữ liệu `chat_reservation_offers` tại `social-service` để lưu trữ dữ liệu phiếu đề xuất gắn liền với đoạn hội thoại.
  - Cập nhật ràng buộc `chat_messages.type` hỗ trợ thêm giá trị `'RESERVATION_OFFER'`.
  - Đồng bộ trạng thái thời gian thực qua Server-Sent Events (SSE) và Redis Pub/Sub sẵn có của chat.
  - Tích hợp tạo đơn đặt chỗ tự động tại `trip-service` khi khách chấp nhận phiếu.
  - Giao diện thẻ vé Mindtrip-style (Ticket Card) hỗ trợ đa ngôn ngữ đầy đủ (VI/EN) và dark/light mode.
- **Out-of-Scope**:
  - Không thay đổi nghiệp vụ thanh toán cổng bên thứ 3 trong đợt này (với đơn cần cọc, tích hợp redirect sang PayOS theo chuẩn sẵn có của `trip-service`).
  - Không cho phép chỉnh sửa phiếu đã gửi (muốn đổi thông tin thì đối tác hủy phiếu cũ và phát hành phiếu mới để đảm bảo tính minh bạch kiểm toán).

### 1.4 Acceptance Criteria
- [ ] **AC-1**: Chỉ người dùng có vai trò Đối tác (Partner) sở hữu cơ sở kinh doanh đã duyệt mới có quyền tạo `RESERVATION_OFFER`. Người dùng thông thường không thể tạo phiếu.
- [ ] **AC-2**: Tin nhắn phiếu đề xuất hiển thị dưới dạng Thẻ vé trực quan trong chat, có đầy đủ: tên cơ sở, loại phòng/bàn, ngày giờ, số khách, giá tiền, ghi chú, đếm ngược hạn hiệu lực, và mã phiếu.
- [ ] **AC-3**: Khách hàng (người nhận) có thể bấm "Xác nhận & Giữ chỗ" trước khi phiếu hết hạn. Khi xác nhận, hệ thống tạo thành công bản ghi đặt chỗ trong `trip-service` và cập nhật trạng thái phiếu thành `ACCEPTED`.
- [ ] **AC-4**: Khi phiếu được chấp nhận, từ chối, hủy, hoặc hết hạn, giao diện thẻ vé của cả Đối tác và Khách hàng đều tự động cập nhật trạng thái mới mà không cần F5 tải lại trang.
- [ ] **AC-5**: Thẻ vé sau khi xác nhận hiển thị rõ mã đơn đặt (`#TS-...`) và nút chuyển nhanh đến trang `/reservations`.
- [ ] **AC-6**: Ngăn chặn IDOR: Chỉ đúng người nhận trong cuộc hội thoại mới có quyền Chấp nhận hoặc Từ chối phiếu; chỉ người tạo phiếu mới có quyền Hủy phiếu.
- [ ] **AC-7**: Tuân thủ chuẩn Zero-Leak Logging và i18n parity 100% giữa `vi.json` và `en.json`.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Partner Browser /chat]              [Guest Browser /chat]
         │                                    │
         │ 1. POST /api/social/chat/conversations/{id}/offers
         ▼                                    │
 [API Gateway (:8080)]                        │
         │                                    │
         ▼ (Forward JWT)                      │
 [social-service (:8086)]                     │
   - Verify Partner ownership                 │
   - Insert into chat_reservation_offers      │
   - Insert chat_messages (type=RESERVATION_OFFER)
   - Emit SSE event via Redis Pub/Sub ───────►│ (Guest receives SSE, renders Ticket Card)
                                              │
                                              │ 2. POST /api/social/chat/offers/{offerId}/accept
                                              ▼
                                      [API Gateway (:8080)]
                                              │
                                              ▼
                                      [social-service (:8086)]
                                        - Validate recipient & expiration
                                        │
                                        │ 3. Internal REST sync call
                                        ▼
                                      [trip-service (:8084)]
                                        - Create HotelBooking / RestaurantReservation
                                        - Assign booking code & status HELD/CONFIRMED
                                        - Return BookingDto
                                        │
                                        ▼
                                      [social-service (:8086)]
                                        - Update offer (status=ACCEPTED, booking_id, booking_code)
                                        - Emit SSE update to both users
                                        │
         ◄────────────────────────────────────┴────────────────────────────────────►
                 Cả 2 bên nhận sự kiện realtime: Thẻ vé chuyển thành ĐÃ XÁC NHẬN
```

### 2.2 Service Ownership & Communication

| Service | Responsibility | Communication Boundary |
| --- | --- | --- |
| `apps/web/tripsense` | Giao diện Chat Composer (nút tạo phiếu), Ticket Card trong luồng tin nhắn, Modal tạo phiếu, xử lý click Xác nhận/Từ chối. | HTTP REST & SSE qua API Gateway |
| `services/api-gateway` | Xác thực JWT, ủy quyền route `/api/social/chat/**`, truyền `X-User-Id`. | Spring Cloud Gateway |
| `services/social-service` | Sở hữu nghiệp vụ Đề xuất trong chat (`chat_reservation_offers`), bảng `chat_messages`, phát sự kiện realtime SSE qua Redis Pub/Sub. | Spring Boot REST, PostgreSQL |
| `services/trip-service` | Sở hữu vòng đời Đơn đặt chỗ (`hotel_bookings`, `restaurant_reservations`), tạo mã đơn chuẩn `#TS-...`. Nhận request tạo booking từ `social-service`. | Internal REST / Kafka |

### 2.3 Architecture Guardrails Verification
- [x] **Public traffic đi qua API Gateway**: Toàn bộ thao tác tạo phiếu, xem phiếu, chấp nhận/từ chối đều qua `/api/social/chat/**`.
- [x] **Mỗi service sở hữu DB riêng**: `social-service` sở hữu bảng `chat_reservation_offers` trong `social_db`. `trip-service` sở hữu các bảng `hotel_bookings` và `restaurant_reservations` trong `trip_db`. Không có bất kỳ truy vấn chéo DB nào.
- [x] **Không có quan hệ JPA chéo microservice**: `chat_reservation_offers` chỉ lưu `booking_id UUID` và `booking_code VARCHAR` dưới dạng trường dữ liệu độc lập, không join JPA chéo.
- [x] **Giao tiếp đồng bộ khi luồng người dùng cần dữ liệu tức thời**: Khi khách bấm "Xác nhận đặt chỗ", `social-service` gọi `trip-service` qua REST client nội bộ để lấy ngay `bookingCode` hiển thị lên thẻ vé.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints

| Method | Gateway Path | Service Internal Path | Auth Required | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/social/chat/conversations/{id}/offers` | `/api/chat/conversations/{id}/offers` | `Bearer JWT (Partner)` | Tạo và gửi phiếu đề xuất đặt chỗ vào đoạn chat |
| `GET` | `/api/social/chat/offers/{offerId}` | `/api/chat/offers/{offerId}` | `Bearer JWT` | Lấy chi tiết phiếu đề xuất theo ID |
| `POST` | `/api/social/chat/offers/{offerId}/accept` | `/api/chat/offers/{offerId}/accept` | `Bearer JWT (Recipient)` | Du khách chấp nhận phiếu và tạo đơn đặt chính thức |
| `POST` | `/api/social/chat/offers/{offerId}/decline` | `/api/chat/offers/{offerId}/decline` | `Bearer JWT (Recipient)` | Du khách từ chối phiếu đề xuất |
| `POST` | `/api/social/chat/offers/{offerId}/cancel` | `/api/chat/offers/{offerId}/cancel` | `Bearer JWT (Creator)` | Đối tác hủy phiếu đề xuất đã gửi |

### 3.2 Request & Response DTOs

#### Tạo Phiếu Đề Xuất (Create Offer Request)
```json
// POST /api/social/chat/conversations/{id}/offers
{
  "clientMessageId": "8f888f4e-9b5a-4b92-807d-2b7376c483a9",
  "businessType": "HOTEL", // "HOTEL" | "RESTAURANT"
  "businessId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "businessName": "Khách sạn Mường Thanh Luxury Sông Hàn",
  "businessThumbnail": "https://res.cloudinary.com/.../hotel-thumb.jpg",
  "itemTitle": "Phòng Deluxe King Hướng Sông",
  "checkInDate": "2026-10-30",
  "checkOutDate": "2026-10-31",
  "reservationTime": null, // "19:00:00" cho nhà hàng
  "adultsCount": 2,
  "childrenCount": 0,
  "totalPrice": 1200000.0,
  "depositAmount": 0.0,
  "currency": "VND",
  "inclusions": "Bao gồm ăn sáng buffet, nhận phòng sớm 12:00",
  "validHours": 24 // Hạn giữ chỗ: 24 tiếng kể từ lúc tạo
}
```

#### Chi Tiết Phiếu Đề Xuất (Offer Response DTO)
```json
// Response DTO (200 OK)
{
  "id": "e674b78a-569d-4720-a611-d7d8e6c78112",
  "conversationId": "c4d5e6f7-1111-2222-3333-444455556666",
  "messageId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "senderId": "11111111-2222-3333-4444-555555555555",
  "recipientId": "22222222-3333-4444-5555-666666666666",
  "businessType": "HOTEL",
  "businessId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "businessName": "Khách sạn Mường Thanh Luxury Sông Hàn",
  "businessThumbnail": "https://res.cloudinary.com/.../hotel-thumb.jpg",
  "itemTitle": "Phòng Deluxe King Hướng Sông",
  "checkInDate": "2026-10-30",
  "checkOutDate": "2026-10-31",
  "reservationTime": null,
  "adultsCount": 2,
  "childrenCount": 0,
  "totalPrice": 1200000.0,
  "depositAmount": 0.0,
  "currency": "VND",
  "inclusions": "Bao gồm ăn sáng buffet, nhận phòng sớm 12:00",
  "expiresAt": "2026-10-31T09:41:00Z",
  "status": "PENDING", // PENDING | ACCEPTED | DECLINED | CANCELLED | EXPIRED
  "bookingId": null,
  "bookingCode": null,
  "createdAt": "2026-10-30T09:41:00Z",
  "updatedAt": "2026-10-30T09:41:00Z"
}
```

#### Chấp Nhận Phiếu (Accept Offer Response)
```json
// POST /api/social/chat/offers/{offerId}/accept
// Response DTO (200 OK)
{
  "offerId": "e674b78a-569d-4720-a611-d7d8e6c78112",
  "status": "ACCEPTED",
  "bookingId": "88888888-9999-0000-aaaa-bbbbccccdddd",
  "bookingCode": "TS-HTL-26103001",
  "redirectUrl": "/reservations?tab=hotels&bookingId=88888888-9999-0000-aaaa-bbbbccccdddd",
  "message": "Xác nhận đặt phòng thành công!"
}
```

---

## 4. Data Model & Migrations

### 4.1 Schema Definition (`social-service`)
File Flyway: `services/social-service/src/main/resources/db/migration/V202611021200__create_chat_reservation_offers.sql`

```sql
-- 1. Cập nhật CHECK constraint trên chat_messages để hỗ trợ kiểu RESERVATION_OFFER
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
  CHECK (type IN ('TEXT', 'SHARED_TRIP', 'RESERVATION_OFFER'));

-- 2. Thêm cột offer_id vào chat_messages
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS offer_id UUID;

-- 3. Tạo bảng chat_reservation_offers
CREATE TABLE IF NOT EXISTS chat_reservation_offers (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id UUID,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  business_type VARCHAR(32) NOT NULL CHECK (business_type IN ('HOTEL', 'RESTAURANT', 'GUIDE')),
  business_id UUID NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_thumbnail VARCHAR(512),
  item_title VARCHAR(255) NOT NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE,
  reservation_time TIME,
  adults_count INT NOT NULL DEFAULT 1,
  children_count INT NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'VND',
  inclusions TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
  decline_reason VARCHAR(500),
  booking_id UUID,
  booking_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes cho truy vấn và kiểm tra hiệu lực
CREATE INDEX IF NOT EXISTS idx_chat_offers_conversation ON chat_reservation_offers (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_offers_recipient_status ON chat_reservation_offers (recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_offers_expires ON chat_reservation_offers (status, expires_at);
```

### 4.2 Migration Strategy
- Migration được thực hiện an toàn qua Flyway, giữ tương thích ngược 100% với các tin nhắn `TEXT` và `SHARED_TRIP` hiện có. Cột `offer_id` là nullable.

---

## 5. Security & Trust Boundaries

| Risk Area | Potential Threat | Mitigation Strategy |
| --- | --- | --- |
| **Authentication** | Mạo danh người dùng gửi phiếu hoặc chấp nhận đơn | Bắt buộc Bearer JWT. Trích xuất `currentUserId` từ SecurityContext, không tin cậy ID gửi từ client. |
| **Authorization / IDOR** | Kẻ xấu bấm Accept phiếu của người khác | Kiểm tra nghiêm ngặt: `offer.recipientId == currentUserId`. Nếu không khớp, từ chối ngay với HTTP `403 Forbidden`. |
| **Partner Verification** | Người dùng thường giả mạo đối tác phát hành báo giá lừa đảo | Khi tạo offer, backend kiểm tra người gửi có sở hữu `businessId` hợp lệ ở trạng thái `ACTIVE` hay không. |
| **Double-Accept Race Condition** | Khách click nhiều lần cùng lúc hoặc 2 tab bấm accept | Sử dụng database transaction với Optimistic Locking (`@Version` hoặc `UPDATE ... WHERE id = :id AND status = 'PENDING'`). Chỉ đúng 1 request được chuyển trạng thái. |
| **Tampering with Price/Dates** | Khách sửa giá tiền hoặc ngày nhận phòng khi accept | Endpoint `accept` chỉ nhận `offerId`. Toàn bộ thông tin giá tiền, ngày giờ được đọc trực tiếp từ bản ghi `chat_reservation_offers` trên database, client không thể can thiệp payload. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Hết hạn phiếu khi đang xem (Clock skew / Expiry)** | Khách mở chat, đồng hồ đã điểm quá hạn nhưng client chưa refresh | Backend khi nhận `accept` luôn kiểm tra `Instant.now().isBefore(offer.expiresAt)`. Nếu quá hạn, trả về mã lỗi `OFFER_EXPIRED` và tự động cập nhật status sang `EXPIRED`. Frontend hiển thị rõ trạng thái hết hạn. |
| **Lưu Offer ở Social Service vs Trip Service** | Tranh cãi ranh giới sở hữu: Phiếu đặt phòng có nên nằm ở Trip Service không? | **Đánh đổi**: Đặt `chat_reservation_offers` tại `social-service` vì nó là một dạng "Tin nhắn đàm phán trong đoạn hội thoại" (Chat artifact). Chỉ khi khách chốt chấp nhận (Accept), đơn đặt chính thức mới được sinh ra tại `trip-service`. Điều này tránh làm rác database của `trip-service` bởi các đề xuất báo giá chưa được đồng ý. |
| **Phương thức thanh toán / Đặt cọc** | Phiếu có yêu cầu thanh toán online ngay lập tức không? | **Thiết kế phân kỳ**: Với đơn thanh toán tại chỗ hoặc giữ bàn ăn, chấp nhận là `CONFIRMED` ngay. Với đơn có tiền cọc lớn, sau khi accept hệ thống trả về `paymentCheckoutUrl` của PayOS để khách thanh toán. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Database & Social Service Offer Backend
- [ ] Task 1.1: Tạo script Flyway `V202611021200__create_chat_reservation_offers.sql` trong `social-service`.
- [ ] Task 1.2: Định nghĩa `ChatReservationOffer` Entity, Repository, DTOs (`ChatDtos$ReservationOffer`).
- [ ] Task 1.3: Cập nhật `ChatService` và `ChatController` hỗ trợ tạo offer và truy vấn offer.
- [ ] Task 1.4: Thêm unit tests cho `ChatService` với các trường hợp: tạo offer hợp lệ, tạo khi không phải partner, hết hạn.

### Phase 2: Booking Acceptance Bridge (Trip Service Linkage)
- [ ] Task 2.1: Thêm endpoint `POST /api/chat/offers/{offerId}/accept`, `decline`, `cancel`.
- [ ] Task 2.2: Tích hợp Feign / REST Client gọi `trip-service` để tự động tạo bản ghi `hotel_bookings` hoặc `restaurant_reservations`.
- [ ] Task 2.3: Phát sự kiện realtime SSE (`OFFER_UPDATED`) qua Redis Pub/Sub để đồng bộ hai phía khách và đối tác.

### Phase 3: Web Frontend UI & Real-time Integration
- [ ] Task 3.1: Mở rộng types trong `chat.types.ts` (`ReservationOfferPreview`, `offerId`).
- [ ] Task 3.2: Xây dựng modal soạn phiếu báo giá `CreateReservationOfferModal` tích hợp vào `ChatComposer` (chỉ hiển thị khi đối tác đang chat).
- [ ] Task 3.3: Xây dựng component `ReservationOfferCard` hiển thị trong `ChatBubble`:
  - Giao diện thẻ vé đặc thù (Ticket Card) với perforated border.
  - Hiển thị ngày giờ, phòng/bàn, khách, giá, đồng hồ đếm ngược.
  - Nút bấm "Xác nhận & Giữ phòng" và "Từ chối" với optimistic state.
- [ ] Task 3.4: Đồng bộ ngôn ngữ `vi.json` và `en.json` đầy đủ cho mọi nhãn của phiếu đề xuất.
- [ ] Task 3.5: Viết component tests và xác minh toàn bộ test suite frontend tiếp tục duy trì 100% green.

---

## Human Approval Gate

```text
STATUS: WAITING_FOR_HUMAN_APPROVAL
```
> Kế hoạch kỹ thuật chi tiết cho tính năng **Gửi phiếu xác nhận / Báo giá đặt chỗ trực tiếp trong chat (In-Chat Reservation Offer & Ticket Confirmation)** đã hoàn tất. 
> Anh xem qua chi tiết nghiệp vụ và kiến trúc ở trên nhé. Khi anh đồng ý tiến hành triển khai, vui lòng phản hồi `Approved`, `Tiến hành` hoặc `Implement` để em bắt đầu code từng phase ạ!

