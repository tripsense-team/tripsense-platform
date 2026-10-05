# Chat Notifications (Firebase Cloud Messaging) & Messenger-Style Unread Badge — Specification & Implementation Plan

`STATUS: APPROVED`

- **Owner Service**: `services/social-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/social-service`
- **Created Date**: 2026-09-25
- **Target PR Boundaries**: [Phase 1 (Backend Unread Summary & FCM Token Persistence), Phase 2 (Firebase Admin Push Delivery), Phase 3 (Frontend Realtime Unread Badge & Tab Title), Phase 4 (Frontend Firebase Client & Service Worker Integration)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Người dùng cần được thông báo kịp thời khi có tin nhắn mới đến ngay cả khi đang chuyển tab khác hoặc không mở trang `/chat`, đồng thời biết được chính xác **số lượng người gửi có tin nhắn chưa đọc** trên thanh điều hướng (Sidebar, Mobile Bottom Navigation) và tiêu đề trình duyệt (Browser Tab Title), hoàn toàn tương tự trải nghiệm của **Facebook Messenger**.

### 1.2 User Flows & Journey
1. **Đăng ký nhận thông báo (Web Push Notification with FCM)**:
   - Khi người dùng đăng nhập vào hệ thống TripSense trên trình duyệt web, hệ thống xin cấp quyền `Notification.requestPermission()`.
   - Nếu được cấp quyền, Firebase Web SDK (`firebase/messaging`) lấy `fcmToken` từ Firebase Cloud Messaging.
   - Client tự động gửi token này lên Backend qua `POST /api/social/chat/devices/fcm-token` để lưu trữ theo tài khoản người dùng (`userId`).
2. **Gửi tin nhắn & Bắn Push Notification**:
   - Khi Người dùng A gửi tin nhắn cho Người dùng B:
     - Tin nhắn được lưu vào `chat_messages` và `chat_participants.unread_count` của B được tăng lên 1.
     - Hệ thống phát event thời gian thực qua SSE (`/api/social/chat/events`).
     - Đồng thời, `social-service` tìm các `fcmToken` đang hoạt động của Người dùng B để gửi Push Notification qua Firebase Admin SDK:
       - **Title**: Tên hiển thị của Người gửi (ví dụ: "Khánh Linh").
       - **Body**: Nội dung tin nhắn tóm tắt hoặc loại tin nhắn (ví dụ: "Chào bạn!", "Đã chia sẻ một chuyến đi").
       - **Action URL**: `/chat?t={conversationId}` (khi click vào popup thông báo trên desktop hoặc mobile, trình duyệt lập tức mở đúng cuộc trò chuyện đó).
3. **Hiển thị Huy hiệu Số người nhắn chưa đọc (Messenger-style Unread Badge)**:
   - Tại thanh Sidebar bên trái (`UserSidebar`), mục menu **Chat** hiển thị một huy hiệu màu đỏ nhỏ gọn chứa **số cuộc trò chuyện chưa đọc** (`unreadConversationsCount`).
   - Nếu Người dùng B có 5 tin nhắn từ Bạn X và 3 tin nhắn từ Bạn Y -> Badge hiển thị **`2`** (tính theo số người nhắn chưa đọc, đúng chuẩn của Messenger, không hiển thị tổng 8 tin nhắn gây rối).
   - Khi thu gọn thanh menu (`collapsed = true`): hiển thị chấm đỏ kèm con số nhỏ gọn ở góc icon Chat.
   - Trên tiêu đề tab trình duyệt (`document.title`): hiển thị tiền tố `(2) TripSense` để người dùng nhận biết ngay cả khi đang ở tab khác.
4. **Đọc tin nhắn & Cập nhật tức thì (Sync & Mark as Read)**:
   - Khi Người dùng B bấm vào cuộc trò chuyện của Bạn X:
     - Client gửi `PUT /conversations/{id}/read`.
     - `unread_count` của cuộc trò chuyện đó trở về 0.
     - Badge tổng trên Sidebar và tiêu đề tab tự động trừ đi 1 (từ 2 xuống 1).
     - Khi đọc hết toàn bộ, badge đỏ tự động ẩn hoàn toàn và tab title trở về `TripSense`.

### 1.3 Scope Boundaries

| In-Scope | Out-of-Scope |
| --- | --- |
| Đăng ký & quản lý FCM Web Push Tokens cho tài khoản người dùng | Native iOS / Android APNs push (chỉ Web Push FCM trong bản này) |
| Gửi push notification qua Firebase Admin SDK khi có tin nhắn mới | Email notification cho tin nhắn chat |
| Huy hiệu số người nhắn chưa đọc (`unreadConversationsCount`) trên Sidebar (cả dạng mở rộng và thu gọn) | Cuộc gọi video/thoại thông báo đến |
| Cập nhật tiêu đề tab trình duyệt `(N) TripSense` theo thời gian thực | Tùy chỉnh âm thanh thông báo riêng từng người |
| Đồng bộ tự động qua SSE và REST polling dự phòng | Mã hóa đầu cuối E2EE cho push payload |
| Cơ chế fallback an toàn: Nếu môi trường dev chưa cấu hình Firebase credentials, chat và badge vẫn hoạt động 100% mượt mà | Thông báo nhóm (Group chat push) |

### 1.4 Acceptance Criteria & Domain Invariants
- [ ] **AC-1 (Unread Conversation Invariant)**: Badge phản ánh đúng số lượng cuộc trò chuyện có tin nhắn chưa đọc (`unreadConversationsCount`), không đếm trùng số tin nhắn.
- [ ] **AC-2 (Sidebar & Mobile Parity)**: Badge hiển thị trên cả `UserSidebar` (desktop), `MobileNavigation` (mobile), và `document.title`. Khi `unreadCount == 0`, badge ẩn hoàn toàn.
- [ ] **AC-3 (FCM Token Registration)**: Endpoint `POST /api/social/chat/devices/fcm-token` yêu cầu Bearer JWT, lưu trữ thiết bị có `userId`, `fcmToken`, `deviceType`, `userAgent`, và `updatedAt`.
- [ ] **AC-4 (IDOR Protection)**: Người dùng chỉ được đăng ký, truy vấn, hoặc xóa token của chính mình (lấy từ JWT Claims).
- [ ] **AC-5 (Token Cleanup on Logout)**: Khi người dùng đăng xuất, gọi `DELETE /api/social/chat/devices/fcm-token` để thu hồi token, tránh gửi nhầm thông báo cho người dùng sau trên cùng máy tính.
- [ ] **AC-6 (Deep Linking from Notification)**: Click vào thông báo push mở trực tiếp URL `/chat?t={conversationId}`.
- [ ] **AC-7 (Dev Environment Resiliency)**: Khi chạy local không có file cấu hình `firebase-service-account.json`, server log cảnh báo thông tin mà không throw Exception, không làm gián đoạn API gửi tin nhắn.
- [ ] **AC-8 (Zero-Leak Logging)**: Tuyệt đối không log private key, token Firebase hoặc dữ liệu nhạy cảm ra client console/toasts theo `docs/ERROR_HANDLING_AND_LOGGING_STANDARDS.md`.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram
```text
[Browser / Web Client]
   │
   ├─ 1. getToken() ───────────────> [Firebase Cloud Messaging (FCM)]
   │                                           │
   ├─ 2. POST /devices/fcm-token (JWT)         │
   │      │                                    │
   │      ▼                                    │
   │  [API Gateway :8080]                      │
   │      │ (Forward JWT)                      │
   │      ▼                                    │
   │  [social-service :8086]                   │
   │      ├─ Save token to DB: chat_fcm_tokens │
   │      │                                    │
   │   (On New Message Sent)                   │
   │      ├─ Inc unread_count in DB            │
   │      ├─ Emit SSE: chat.changed ───────────┼─────────> [Active Tabs / Web]
   │      │                                    │           (Update Badge Realtime)
   │      └─ Send Push via Firebase Admin SDK  │
   │             │                             │
   │             └─────────────────────────────┼─> [FCM Server]
   │                                           │       │
   │                                           ▼       ▼
   └─────────────────────────────────────── [firebase-messaging-sw.js]
                                            (Display System Notification)
```

### 2.2 Service Ownership & Communication
| Component | Trách nhiệm | Giao thức / Thư viện |
| --- | --- | --- |
| `apps/web/tripsense` | Lấy FCM Token, đăng ký Service Worker, hiển thị Badge Sidebar/Title | Firebase Web SDK v11, Next.js, Zustand |
| `services/api-gateway` | Định tuyến route `/api/social/chat/devices/**` và `/api/social/chat/unread-summary`, xác thực JWT | Spring Cloud Gateway, Redis Rate Limiter |
| `services/social-service` | Quản lý bảng `chat_fcm_tokens`, tính toán `unreadConversationsCount`, gửi Push Notification qua Firebase Admin | Spring Boot 3, Firebase Admin Java SDK 9.x, PostgreSQL |

### 2.3 Architecture Guardrails Verification
- [x] Không truy vấn chéo database: `social-service` quản lý bảng `chat_fcm_tokens` trong database `tripsense_social`.
- [x] Không JPA relationship chéo service: Chỉ lưu `userId` dạng UUID.
- [x] Private Key của Firebase Service Account được lưu hoàn toàn ở backend environment (`FIREBASE_CREDENTIALS_JSON` / `FIREBASE_CREDENTIALS_PATH`), tuyệt đối không gửi về frontend.

---

## 3. API & Event Contracts

### 3.1 REST Endpoints

#### A. Lấy tổng số cuộc trò chuyện chưa đọc (Unread Summary)
- **Method**: `GET`
- **Path**: `/api/social/chat/unread-summary`
- **Auth**: `Bearer JWT`
- **Response DTO** (`200 OK`):
```json
{
  "success": true,
  "message": "Unread summary retrieved",
  "data": {
    "unreadConversationsCount": 2,
    "totalUnreadMessages": 7
  }
}
```

#### B. Đăng ký / Cập nhật thiết bị FCM (Register FCM Device Token)
- **Method**: `POST`
- **Path**: `/api/social/chat/devices/fcm-token`
- **Auth**: `Bearer JWT`
- **Request DTO**:
```json
{
  "fcmToken": "c_dE89...fK92",
  "deviceType": "WEB",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)..."
}
```
- **Response DTO** (`200 OK`):
```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "data": {
    "registered": true,
    "updatedAt": "2026-09-25T02:30:00Z"
  }
}
```

#### C. Hủy đăng ký thiết bị khi đăng xuất (Unregister Device Token)
- **Method**: `DELETE`
- **Path**: `/api/social/chat/devices/fcm-token`
- **Auth**: `Bearer JWT`
- **Request DTO**:
```json
{
  "fcmToken": "c_dE89...fK92"
}
```
- **Response DTO** (`200 OK`):
```json
{
  "success": true,
  "message": "FCM token unregistered successfully",
  "data": null
}
```

### 3.2 Firebase Web Push Payload Schema
Khi `social-service` bắn thông báo qua Firebase Admin:
```json
{
  "token": "c_dE89...fK92",
  "notification": {
    "title": "Khánh Linh",
    "body": "Chào bạn, mình có gửi lịch trình Hội An nhé!"
  },
  "data": {
    "type": "CHAT_MESSAGE",
    "conversationId": "a1111111-1111-1111-1111-111111111111",
    "senderId": "user-linh-uuid",
    "clickActionUrl": "/chat?t=a1111111-1111-1111-1111-111111111111"
  },
  "webpush": {
    "headers": {
      "Urgency": "high"
    },
    "fcm_options": {
      "link": "/chat?t=a1111111-1111-1111-1111-111111111111"
    }
  }
}
```

---

## 4. Database & Persistence

### 4.1 Flyway Migration Script
Tạo file: `services/social-service/src/main/resources/db/migration/V202609251000__create_chat_fcm_tokens.sql`:

```sql
CREATE TABLE IF NOT EXISTS chat_fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(50) NOT NULL DEFAULT 'WEB',
    user_agent TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_fcm_token UNIQUE (fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_chat_fcm_tokens_user_id ON chat_fcm_tokens(user_id);
```

### 4.2 Query Tính Unread Conversations Count
Trong `ChatService.java`:
```sql
SELECT COUNT(DISTINCT conversation_id) 
FROM chat_participants 
WHERE user_id = :userId AND unread_count > 0;
```
Query này chạy cực nhanh dựa trên index hiện có `chat_participants(conversation_id, user_id)`.

---

## 5. Security & Trust Boundaries

1. **Bảo mật Khóa Firebase (Firebase Admin Credentials)**:
   - File JSON Service Account hoặc biến môi trường `FIREBASE_SERVICE_ACCOUNT` nằm hoàn toàn ở backend container của `social-service`.
   - Client Web chỉ giữ các biến công khai chuẩn của Firebase client (`apiKey`, `projectId`, `messagingSenderId`, `appId`, `vapidKey`).
2. **Ủy quyền Device Token (Anti-IDOR)**:
   - `userId` liên kết với `fcmToken` được trích xuất trực tiếp từ JWT của người dùng đang đăng nhập (`actorId()`), tuyệt đối không nhận `userId` từ body request.
3. **Thu hồi Token khi Token chết**:
   - Nếu Firebase trả về mã lỗi `UNREGISTERED` hoặc `INVALID_ARGUMENT` (người dùng gỡ trình duyệt hoặc revoke quyền), `social-service` tự động xóa token đó khỏi bảng `chat_fcm_tokens` để tránh lãng phí tài nguyên gọi API.

---

## 6. Trade-offs, Failure Modes & Edge Cases

| Kịch bản | Rủi ro | Giải pháp thiết kế |
| --- | --- | --- |
| **Không có Firebase Credentials ở Local/Test** | App backend bị crash khi khởi động | Khởi tạo Bean `FirebaseMessaging` theo điều kiện `@ConditionalOnProperty`. Nếu không có credentials, hệ thống log warning và chuyển sang chế độ Mock/No-op, không ảnh hưởng đến API gửi tin nhắn. |
| **Người dùng từ chối cấp quyền thông báo trình duyệt** | Không lấy được `fcmToken` | Giao diện vẫn hoạt động bình thường 100%. Huy hiệu số người chưa đọc trên Sidebar và Tab title vẫn cập nhật qua SSE / Polling. |
| **Nhiều thiết bị / Nhiều tab cùng đăng nhập** | Bắn push notification cho chính tab đang mở | `firebase-messaging-sw.js` kiểm tra nếu tab chat đang active và focused thì không bật pop-up push OS, chỉ cập nhật UI chat realtime. |
| **Đăng xuất (Logout)** | Người dùng sau dùng chung máy nhận được tin nhắn của người trước | Client gọi `DELETE /api/social/chat/devices/fcm-token` khi logout. Xóa token lưu ở IndexedDB của trình duyệt. |

---

## 7. Implementation Tasks & Plan

### Giai đoạn 1: Backend API & Database Persistence (social-service & api-gateway)
- [x] **Task 1.1**: Tạo Flyway migration `V202609251000__create_chat_fcm_tokens.sql` trong `services/social-service`.
- [x] **Task 1.2**: Thêm endpoint `GET /api/social/chat/unread-summary` trả về `unreadConversationsCount` & `totalUnreadMessages`.
- [x] **Task 1.3**: Thêm entity/repository và endpoints `POST/DELETE /api/social/chat/devices/fcm-token`.
- [x] **Task 1.4**: Cấu hình route API Gateway cho các endpoint mới trong `services/api-gateway`.
- [x] **Task 1.5**: Viết unit tests cho `ChatService` và controller tests trong `social-service`.

### Giai đoạn 2: Tích hợp Firebase Admin SDK trong social-service
- [x] **Task 2.1**: Thêm dependency `firebase-admin` vào `services/social-service/pom.xml`.
- [x] **Task 2.2**: Tạo `FirebaseConfig` khởi tạo an toàn (No-op nếu thiếu cấu hình).
- [x] **Task 2.3**: Viết `ChatPushNotificationService` gửi push notification khi có tin nhắn mới trong `ChatService.send()`.
- [x] **Task 2.4**: Tự động xóa token lỗi (`UNREGISTERED`) khi Firebase báo lỗi.

### Giai đoạn 3: Frontend Unread Badge (Messenger-style)
- [x] **Task 3.1**: Tạo hook `useChatUnreadCount` (fetch `unread-summary`, lắng nghe SSE `chat.changed`).
- [x] **Task 3.2**: Hiển thị badge số người nhắn chưa đọc trên `UserSidebar` (cả trạng thái mở rộng và thu gọn icon).
- [x] **Task 3.3**: Hiển thị badge trên `MobileNavigation` (cho thiết bị di động).
- [x] **Task 3.4**: Tự động cập nhật tiêu đề tab trình duyệt `(N) TripSense` khi có tin nhắn chưa đọc.
- [x] **Task 3.5**: Đồng bộ tức thì khi đọc tin nhắn (`mark as read`) để giảm badge về 0.

### Giai đoạn 4: Frontend Firebase Web Push Integration
- [x] **Task 4.1**: Cài đặt `firebase` package trong `apps/web/tripsense`.
- [x] **Task 4.2**: Thêm file cấu hình client `src/lib/firebase.ts`.
- [x] **Task 4.3**: Tạo Service Worker `public/firebase-messaging-sw.js` xử lý background push.
- [x] **Task 4.4**: Tạo hook `useFcmNotifications` xin quyền và đăng ký token với backend khi đăng nhập.
- [x] **Task 4.5**: Xóa token và hủy đăng ký khi đăng xuất trong `useAuthStore` & `auth-api.ts`.

### Giai đoạn 5: Verification & Review
- [x] **Task 5.1**: Chạy `npm run type-check`, `npm run i18n:check`, `npm test`, `npm run build` trên frontend (170/170 tests passed).
- [x] **Task 5.2**: Chạy `mvn test` trên backend services (49/49 tests passed).
- [x] **Task 5.3**: Kiểm tra end-to-end: Đăng ký token, gửi tin nhắn từ tài khoản A sang B, kiểm tra badge trên Sidebar và push notification.

---

## 8. Status Gate

`STATUS: DONE`
