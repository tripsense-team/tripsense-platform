# AI Chat Dynamic Title Generation — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/ai-service`, `apps/web/tripsense`
- **Affected Components**:
  - `services/ai-service/src/routes/chat.ts` (Title generation, update triggers, trip linking, generic title matching)
  - `apps/web/tripsense/src/hooks/use-active-chat.tsx` (Fallback title computation, auto title sync)
  - `apps/web/tripsense/src/components/chat/shell.tsx` (Generic title exclusion)
  - `apps/web/tripsense/src/components/chat/chat-header.tsx` (Title rendering & fallback)
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: [Phase 1: Backend Dynamic Title Engine & Trip-Sync, Phase 2: Frontend Contextual Title Computation & React Query Invalidation, Phase 3: Unit & Integration Verification]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Pain Point
Hiện tại, khi người dùng bắt đầu cuộc trò chuyện hoặc tạo chuyến đi liên kết với AI, tiêu đề cuộc trò chuyện hiển thị trên Header và danh sách lịch sử (Sidebar Flyout) luôn bị gán cứng thành:
`"Kế hoạch chuyến đi của bạn"` (hoặc `"Your trip plan"`).
Tên này **giữ nguyên mãi mãi** và không bao giờ được cập nhật thành tên có ý nghĩa, gây ra các bất tiện lớn:
1. **Mất định danh cuộc trò chuyện**: Khi người dùng có nhiều chuyến đi (Đà Nẵng, Phú Quốc, Hà Nội, Tokyo), toàn bộ danh sách trong Sidebar đều hiển thị cùng một tên `"Kế hoạch chuyến đi của bạn"`, khiến người dùng không phân biệt được đoạn chat nào thuộc chuyến đi nào.
2. **Cơ chế cập nhật bị chặn vĩnh viễn (Lockout Bug)**:
   - Trong `POST /chats/:id/link-trip`, backend gán cứng `title: "Kế hoạch chuyến đi của bạn"`.
   - Trong `POST /chat`, backend chỉ cập nhật tiêu đề khi `existing[0].title === "Cuộc trò chuyện mới" || existing[0].title === "New chat"`.
   - Do tiêu đề đã bị đặt thành `"Kế hoạch chuyến đi của bạn"`, biểu thức điều kiện trên luôn trả về `false`, khiến AI **hoàn toàn không bao giờ cập nhật lại tiêu đề** cho dù người dùng đã gửi nội dung cụ thể hay đã chốt điểm đến!
3. **Cơ chế trích xuất tiêu đề quá hẹp (`generateSmartTitle`)**:
   - Chỉ bắt được một số ít câu lệnh có cụm từ "lên lịch trình đi...", còn các câu hỏi thực tế như *"Gợi ý lịch trình cho Ngày 1"*, *"Top quán cafe đẹp ở Phú Quốc"*, *"Khách sạn gần biển Mỹ Khê"* đều rơi vào fallback cắt chuỗi thô hoặc giữ nguyên default.

### 1.2 User Goal & Core Flow
Người dùng muốn cuộc trò chuyện AI có logic đặt tên thông minh, chuẩn xác và linh hoạt theo từng ngữ cảnh:
- **Khi liên kết với chuyến đi (hoặc tạo từ modal)**: Tên chat lập tức mang tên chuyến đi hoặc điểm đến (ví dụ: *"Lịch trình Đà Nẵng"*, *"Lịch trình Phú Quốc"* hoặc tên tùy chỉnh của chuyến đi như *"Du lịch Đà Nẵng cùng gia đình"*).
- **Khi người dùng nhắn tin khám phá/lên kế hoạch**: AI tự động trích xuất chủ đề ngắn gọn, chuyên nghiệp (ví dụ: *"Khám phá ẩm thực Hà Nội"*, *"Quán cafe view biển Phú Quốc"*, *"Lịch trình Sapa 3 ngày 2 đêm"*).
- **Khi người dùng tự đổi tên (Rename Chat)**: Tôn trọng tuyệt đối tên do người dùng tự nhập, AI không tự ý ghi đè tên đã tùy chỉnh.
- **Tên hiển thị tức thì trên giao diện**: Đồng bộ ngay lập tức trên Chat Header và Sidebar Flyout mà không cần F5 trang.

### 1.3 In-Scope & Out-of-Scope
- **In-Scope**:
  - Chuẩn hóa hàm nhận diện tiêu đề mặc định `isGenericChatTitle(title)`.
  - Nâng cấp `generateSmartTitle(userPrompt, destinationHint)` với regex phân loại ý định (Plan, Food, Stay, Sightseeing, Cafe, Weather) và loại bỏ từ đệm tiếng Việt/Anh.
  - Tích hợp tra cứu chuyến đi trong `POST /chats/:id/link-trip` để đặt tên theo `trip.destinationName` hoặc `trip.name`.
  - Tự động cập nhật tiêu đề trong `POST /chat` khi tiêu đề hiện tại là generic.
  - Cập nhật fallback trên frontend (`use-active-chat.tsx`) ưu tiên `activeTrip.destinationName` / `activeTrip.name`.
  - Viết unit test tự động cho toàn bộ logic đặt tên thông minh.
- **Out-of-Scope**:
  - Không thay đổi bảng dữ liệu `chats` (tận dụng trường `title` varchar hiện tại).
  - Không gọi thêm LLM chỉ để tóm tắt tiêu đề (dùng Fast Heuristic Engine để bảo toàn quota Gemini Free Tier và tốc độ stream tức thì).

---

## 2. Architecture & Service Boundaries

```text
[Web Client (Mindtrip UI)]
   | 
   |-- 1. use-active-chat.tsx: Ưu tiên activeTrip.destinationName ("Lịch trình Đà Nẵng")
   |
   |-- 2. POST /chats/:id/link-trip { tripId }
   |         v
   |      [ai-service]
   |         |-- GET /api/trips/{tripId} (trip-service via REST)
   |         +-> Cập nhật chats.title = `Lịch trình ${trip.destinationName || trip.name}`
   |
   |-- 3. POST /chat { userPrompt }
             v
          [ai-service]
             |-- Kiểm tra isGenericChatTitle(currentTitle)
             |-- Chạy generateSmartTitle(userPrompt, tripDestination)
             |-- Nếu là generic -> Cập nhật chats.title thành Smart Title mới
             +-> Stream message + Header "X-Chat-Title" (nếu có)
```

- **Service Boundary Compliance**:
  - `ai-service` truy vấn thông tin chuyến đi qua REST endpoint `/api/trips/{id}` của `trip-service`.
  - Không tạo quan hệ JPA xuyên service, không can thiệp trực tiếp vào DB của `trip-service`.

---

## 3. Detailed Logic Specification

### 3.1 Định nghĩa Danh sách Tiêu đề Mặc định (`isGenericChatTitle`)
Một tiêu đề được xem là tiêu đề mặc định (cần được tự động thay thế bằng tên thông minh) nếu:
```ts
const GENERIC_TITLES = new Set([
  "",
  "new chat",
  "cuộc trò chuyện mới",
  "kế hoạch chuyến đi của bạn",
  "your trip plan",
  "untitled",
  "chuyến đi chưa đặt tên",
  "cuộc trò chuyện du lịch",
  "travel conversation"
]);

export function isGenericChatTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const normalized = title.trim().toLowerCase();
  return GENERIC_TITLES.has(normalized) || normalized.startsWith("cuộc trò chuyện mới");
}
```

### 3.2 Bộ máy Đặt tên Thông minh Tối ưu (`generateSmartTitle`)
Quy tắc xử lý đầu vào:
1. **Làm sạch chuỗi (Sanitization)**: Bỏ comment `<!-- ... -->`, emojis, các từ đệm mở đầu ("hãy cho tôi", "gợi ý cho mình", "giúp em", "bạn ơi", "cho xin", "tôi muốn", "please give me").
2. **Khớp theo Ngữ cảnh Chuyến đi liên kết**:
   - Nếu prompt dạng ngữ cảnh bổ sung (ví dụ: *"Gợi ý lịch trình cho Ngày 1"*, *"Ăn gì buổi tối?"*, *"Lịch trình hôm nay"*):
     Nếu có `destinationHint` (ví dụ: *"Đà Nẵng"*), trả về: `"Lịch trình Đà Nẵng"`.
3. **Khớp theo Chủ đề & Điểm đến (Categorized Pattern Matching)**:
   - **Lịch trình**: `(lên lịch trình|lịch trình|kế hoạch|du lịch|phượt|khám phá|chuyến đi|tour) (đi|đến|ở|tại)? ([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)`
     -> `"Lịch trình " + Capitalized(Destination)` (ví dụ: *"Lịch trình Đà Lạt 3N2Đ"*).
   - **Ẩm thực**: `(quán ăn|món ngon|đặc sản|ăn gì|ẩm thực) (ở|tại|gần)? ([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)`
     -> `"Ẩm thực " + Capitalized(Destination)` (ví dụ: *"Ẩm thực Phú Quốc"*).
   - **Quán Cafe**: `(quán cafe|cà phê|coffee|view đẹp) (ở|tại|gần)? ([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)`
     -> `"Quán cafe " + Capitalized(Destination)` (ví dụ: *"Quán cafe ngắm hoàng hôn Phú Quốc"*).
   - **Khách sạn / Lưu trú**: `(khách sạn|homestay|resort|nơi ở) (ở|tại|gần)? ([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)`
     -> `"Khách sạn " + Capitalized(Destination)` (ví dụ: *"Khách sạn gần biển Mỹ Khê"*).
   - **Tham quan / Check-in**: `(địa điểm|điểm tham quan|check-in|sống ảo|vui chơi) (ở|tại)? ([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)`
     -> `"Địa điểm check-in " + Capitalized(Destination)` (ví dụ: *"Địa điểm check-in Đà Nẵng"*).
   - **Thời tiết**: `(thời tiết|khí hậu|nhiệt độ) (ở|tại)? ([A-ZÀ-Ỹa-zà-ỹ0-9\s]+)`
     -> `"Thời tiết " + Capitalized(Destination)`.
4. **Fallback Tinh gọn (Graceful Snippet)**:
   - Nếu là câu hỏi chung, cắt lấy tối đa 36 ký tự theo ranh giới từ nguyên vẹn (`word boundary`), viết hoa chữ cái đầu, không cắt vụn giữa chữ.

### 3.3 Đồng bộ khi Liên kết Chuyến đi (`POST /chats/:id/link-trip`)
- Khi gọi endpoint `link-trip`:
  - Fetch chi tiết chuyến đi: `GET /api/trips/{tripId}`.
  - Lấy `tripName = trip.destinationName ? `Lịch trình ${trip.destinationName}` : trip.name`.
  - Nếu chat chưa có trong DB: Tạo mới với `title: tripName`.
  - Nếu chat đã có trong DB và đang có tiêu đề generic: Cập nhật `title: tripName`.

### 3.4 Đồng bộ trên Web Client (`use-active-chat.tsx`)
- Thay thế fallback cứng `"Kế hoạch chuyến đi của bạn"`:
  ```ts
  const chatTitle = useMemo(() => {
    if (currentChat?.title && !isGenericChatTitle(currentChat.title)) {
      return currentChat.title;
    }
    if (activeTrip?.destinationName) {
      return locale === "vi" ? `Lịch trình ${activeTrip.destinationName}` : `Trip to ${activeTrip.destinationName}`;
    }
    if (activeTrip?.name) {
      return activeTrip.name;
    }
    if (currentChat?.title) {
      return currentChat.title;
    }
    return messages.length > 0
      ? (locale === "vi" ? "Lịch trình chuyến đi" : "Trip itinerary")
      : t("aiPlanner.newChat");
  }, [currentChat?.title, activeTrip?.destinationName, activeTrip?.name, messages.length, locale, t]);
  ```

---

## 4. API & Data Contracts

### 4.1 AI Service Endpoints Affected
1. `POST /api/chats/:id/link-trip`
   - **Behavior**: Tra cứu trip detail và gán title theo chuyến đi nếu title hiện tại generic.
2. `POST /api/chat`
   - **Behavior**: Nếu chat có title generic, tự động cập nhật title mới qua `generateSmartTitle`. Expose `X-Chat-Title` trong response headers để client cập nhật ngay lập tức nếu cần.

### 4.2 Data Model
- Giữ nguyên bảng `chats` trong `tripsense_ai_v2`. Không cần chạy migration DB.

---

## 5. Security & Trust Boundaries
- **Ownership Verification**: Mọi thao tác rename hoặc link trip đều kiểm tra `ownedChat(chatId, userId)`.
- **Anti-Tampering**: Người dùng không thể đổi tên chat của người khác.
- **Sanitization**: Tiêu đề được cắt gọn, loại bỏ thẻ HTML/script để chống XSS khi render trên DOM.

---

## 6. Devil's Advocate & Technical Trade-offs
- **Câu hỏi**: Tại sao không gọi Gemini để tóm tắt tiêu đề như ChatGPT?
  - **Phân tích**: Việc gọi riêng 1 API call LLM cho mỗi message chỉ để sinh tiêu đề sẽ gây lãng phí lớn hạn ngạch rate limit (Gemini Free Tier có giới hạn RPM/RPD).
  - **Quyết định**: Dùng Fast Heuristic Engine (regex có hỗ trợ tiếng Việt có dấu và tiếng Anh + ngữ cảnh chuyến đi). Độ trễ < 1ms, độ chính xác cao đối với bài toán du lịch, không tốn quota.
- **Câu hỏi**: Nếu người dùng cố tình tự đặt tên chat là "Kế hoạch chuyến đi của bạn" thì sao?
  - Khi người dùng chủ động gọi `PATCH /api/chats/:id` (rename chat), họ có toàn quyền đặt tên. Sau này nếu gửi thêm tin nhắn, hệ thống chỉ auto-rename nếu tiêu đề hiện tại khớp với tiêu đề mặc định lúc tạo hệ thống.

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Logic Engine & AI Service (`services/ai-service`)
- [x] Triển khai hàm `isGenericChatTitle` và nâng cấp `generateSmartTitle` trong `services/ai-service/src/ai/chat-title.ts`.
- [x] Cập nhật `POST /chats/:id/link-trip` để lấy tên từ chuyến đi thay vì gán cứng `"Kế hoạch chuyến đi của bạn"`.
- [x] Cập nhật điều kiện auto-rename trong `POST /chat` sử dụng `isGenericChatTitle` kết hợp `destinationHint`.
- [x] Viết unit test cho `generateSmartTitle` với đa dạng test case tiếng Việt & tiếng Anh (`services/ai-service/src/ai/chat-title.test.ts`).

### Phase 2: Web Client Synchronization (`apps/web/tripsense`)
- [x] Cập nhật `use-active-chat.tsx` để tính toán `chatTitle` thông minh theo `activeTrip` và loại bỏ hoàn toàn fallback `"Kế hoạch chuyến đi của bạn"`.
- [x] Cập nhật `shell.tsx` và `chat-header.tsx` để hiển thị tiêu đề điểm đến tức thì khi liên kết chuyến đi.
- [x] Cập nhật `sidebar-flyout.tsx` để render `displayTitle` thông minh và làm mới cache React Query khi link chuyến đi.

### Phase 3: Automated Verification
- [x] `npm test` trong `services/ai-service` vượt qua 100% (28/28 tests passed).
- [x] `npm run type-check` và `npm test -- src/components/chat` trong `apps/web/tripsense` vượt qua 100% (33/33 tests passed).

---

## 8. Verification & Test Results

- **Unit Tests (`services/ai-service`)**:
  - `isGenericChatTitle accurately flags default and empty titles` (Passed)
  - `capitalizeWords preserves Vietnamese diacritics` (Passed)
  - `cleanUserPrompt removes comments, greetings and filler phrases` (Passed)
  - `generateSmartTitle extracts destination and category accurately` (Passed)
  - Overall `ai-service` suite: 28/28 tests passed.
- **Frontend Verification (`apps/web/tripsense`)**:
  - `npm run type-check`: 0 errors.
  - `npm run test -- src/components/chat`: 33/33 tests passed across all 8 test suites.
- **Final Status**: COMPLETED & VERIFIED.
