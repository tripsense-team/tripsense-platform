# AI Chat Streaming UX, Single-Spinner Avatar, Rich Formatting & Right Place Detail Drawer — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense` (phối hợp `services/ai-service`)
- **Affected Components**: `apps/web/tripsense` (`components/chat/*`, `components/ai-elements/message.tsx`, `features/places/components/place-detail-overlay.tsx` reuse, `hooks/use-active-chat.tsx`), `services/ai-service` (`src/routes/chat.ts`, `src/ai/prompts.ts`)
- **Created Date**: 2026-11-16
- **Target PR Boundaries**:
  - Phase 1: Single-Spinner + Persistent AI Sparkles Avatar & Rich Note Icons (`message.tsx`, `rich-itinerary-decorator.tsx`, `prompts.ts`)
  - Phase 2: Unbuffered SSE Headers & Smooth Word-by-Word Streaming (`ai-service/src/routes/chat.ts`, `hooks/use-active-chat.tsx`, `components/ai-elements/message.tsx`)
  - Phase 3: Right Slide `PlaceDetailOverlay` Integration (Ảnh 3) from ZioMap, TripDetail & PlaceActions (`chat-ziomap-panel.tsx`, `shell.tsx`, `trip-detail-panel.tsx`, `chat-place-resolver.ts`)
  - Phase 4: Clickable Place Links in AI Text Responses, `ItineraryPreview` (Ảnh 2) & `PlaceCards` (`rich-itinerary-decorator.tsx`, `itinerary-preview.tsx`, `place-cards.tsx`, `message.tsx`, `prompts.ts`)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Sau đợt tích hợp spinner & ZioMap ở `/ai-planner`, kiểm tra trải nghiệm thực tế cho thấy 5 vấn đề UX cần hoàn thiện để đạt chất lượng Mindtrip:

1. **Xuất hiện 2 vòng xoay trùng nhau cạnh nhau**: `AiResponseAvatar` ([message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx)) có vòng cung SVG xoay bên trái, đồng thời `ActiveAgentStatus` và các tool badge (`getWeather`, `searchPlaces`, `createTripProposal`) bên cạnh cũng render thêm `<Loader2 className="animate-spin" />`, tạo cảm giác lặp và rối.
2. **Icon AI (`SparklesIcon`) lúc đầu biến mất rồi mới hiện**: Khi `isInitializing === true` (`ThinkingMessage` hoặc khi assistant message chưa có text/tool part), `AiResponseAvatar` hiển thị một dấu chấm tròn nhỏ (`size-1.5`) thay vì `<SparklesIcon />`, khiến người dùng thấy icon trống lúc mới gửi câu hỏi rồi đột ngột hiện ra sau.
3. **Phản hồi AI có cảm giác bật ra hết một lúc thay vì chảy chữ mượt mà**:
   - Backend `services/ai-service` đã dùng SSE (`streamText(...).toUIMessageStreamResponse`), **không phải JSON một cục**.
   - Tuy nhiên do kiến trúc *tool-first* (Step 1 gọi `prepareTripCandidates` + `createTripProposal` sinh toàn bộ JSON trước trong 5–15s không có text delta; Step 2 chỉ viết 1–2 câu mở đầu + 3 gạch đầu dòng ngắn trong ~0.3–0.5s), cộng với `useChat({ throttle: 60 })`, header `UI_MESSAGE_STREAM_HEADERS` thiếu `no-transform` (rủi ro Next.js `compress`/rewrite gom block nhỏ), và `<MessageResponse>` (`Streamdown` v2.6.0) chưa bật `mode="streaming"`, `isAnimating`, `animated`, cũng như hàm `memo` đang bỏ qua sự thay đổi của `isAnimating`/`mode` khi chỉ kiểm tra `prevProps.children === nextProps.children`.
4. **Đoạn văn mở đầu & lưu ý thực tế của AI còn phẳng, thiếu icon thẩm mỹ**: Prompt cho lượt `createTripProposal` ở `prompts.ts` chưa có ví dụ cấu trúc emoji chuẩn (ví dụ: `✨ Một số lưu ý...`, `🥾 Di chuyển & Tham quan:`, `🌤️ Thời tiết & Trang phục:`, `🍜 Thưởng thức ẩm thực:`), còn `rich-itinerary-decorator.tsx` mới xử lý tiêu đề `Day N` và `Morning/Afternoon/Evening`.
5. **Thiếu liên kết click vào tên địa điểm để trượt mở Place Detail giống hệt Ảnh 3 (`PlaceDetailOverlay`) ở cột bên phải**:
   - Giao diện chi tiết chuẩn (Ảnh 3: *"Bảo tàng Mỹ thuật Đà Nẵng"* với thanh action `X`, collapse, `Đã lưu`, `Đã thêm vào chuyến đi`, pin chỉ đường, nghe thuyết minh, share, header rating, photo mosaic 3–5 ảnh, tab `Tổng quan | Đánh giá | Vị trí`) đã được xây dựng hoàn chỉnh tại [place-detail-overlay.tsx](../../apps/web/tripsense/src/features/places/components/place-detail-overlay.tsx) và [place-detail-content.tsx](../../apps/web/tripsense/src/features/places/components/place-detail-content.tsx).
   - Nhưng ở `/ai-planner`:
     - `ChatZioMapPanel` hiện mở popup `PlaceDetailModal` che giữa màn hình khi bấm xem chi tiết từ pin bản đồ.
     - Văn bản AI trả lời (như *"Sơn Trà"*, *"Ngũ Hành Sơn"*, *"Mỹ Khê"*), từng dòng địa điểm trong `ItineraryPreview` (Ảnh 2: *"Cổng Chùa Linh Ứng"*, *"Mỳ quảng - bánh tráng thịt heo Quê Minh"*, *"Bảo tàng Điêu khắc Chăm Đà Nẵng"*, *"Cầu Rồng"*), và thẻ `PlaceCards` chưa gắn hành động trượt mở `PlaceDetailOverlay` ở cột phải.

### 1.2 User Flows & Journey

1. **Khi người dùng gửi prompt**:
   - `AiResponseAvatar` hiển thị **duy nhất 1 vòng cung xoay** bao quanh **`<SparklesIcon />` xuất hiện ngay lập tức** (không còn chấm tròn ẩn icon, không còn `<Loader2 animate-spin>` lặp lại ở `ActiveAgentStatus`).
2. **Khi AI bắt đầu trả lời chữ**:
   - Luồng SSE đi qua không bị gzip/proxy gom block (`Cache-Control: no-cache, no-transform`), `Streamdown` bật `animated` theo từng từ và `throttle` hạ xuống ~24ms giúp câu văn (cùng emoji/icon nhóm lưu ý) chảy ra mượt mà từng từ.
3. **Khi người dùng bấm vào tên địa điểm (ở bất kỳ điểm chạm nào)**:
   - **Điểm chạm 1**: Click `"Xem chi tiết"` từ marker popup trên `ChatZioMapPanel`.
   - **Điểm chạm 2**: Click vào tên địa điểm trong danh sách ngày của `ItineraryPreview` (Ảnh 2).
   - **Điểm chạm 3**: Click vào link địa điểm được gắn tự động hoặc qua markdown link trong nội dung chat AI (ví dụ: `[Bán đảo Sơn Trà]`, `[Ngũ Hành Sơn]`).
   - **Điểm chạm 4**: Click vào card địa điểm trong `PlaceCards` carousel hoặc item trong `TripDetailPanel`.
   -> Cột bên phải trượt mở **`PlaceDetailOverlay`** (giống 1:1 Ảnh 3 và trang `/places`), hiện dữ liệu tức thời và âm thầm hydrate đủ ảnh mosaic, mô tả, giờ mở cửa, đánh giá từ `getPlaceDetails(...)`. Bấm `Lưu` hoặc `Thêm vào chuyến đi` hoạt động thật qua `usePlaceActions`; bấm `X` quay về panel trước đó (`ZioMap` / `TripDetailPanel` / đóng cột phải).

### 1.3 Scope Boundaries

- **In-Scope**:
  - Sửa `AiResponseAvatar` & `ActiveAgentStatus` trong `apps/web/tripsense/src/components/chat/message.tsx`.
  - Bổ sung `Cache-Control: no-cache, no-transform` trên response SSE của `POST /api/chat` (`services/ai-service/src/routes/chat.ts`), hạ `throttle` (`use-active-chat.tsx`), bật `Streamdown` `mode`/`isAnimating`/`animated` và sửa comparator của `MessageResponse` (`apps/web/tripsense/src/components/ai-elements/message.tsx`).
  - Tinh chỉnh `prompts.ts` + `rich-itinerary-decorator.tsx` cho icon phần mở đầu/lưu ý & cú pháp link địa điểm `#place:`.
  - Xây dựng resolver + in-memory cache + Race-condition `AbortController` (`chat-place-resolver.ts`), tích hợp `PlaceDetailOverlay` + `usePlaceActions` vào `ChatShell` / `ChatZioMapPanel` (bỏ `PlaceDetailModal`), và nối click từ `ItineraryPreview`, Markdown text links, `PlaceCards`, `TripDetailPanel`.
  - Unit tests cho toàn bộ 4 phase + kiểm tra `i18n:check`, `type-check`, `eslint`, `vitest`, `ai-service` tests.
- **Out-of-Scope**:
  - Không thay đổi database schema, Flyway/Drizzle migrations hay Kafka topics.
  - Không tạo microservice hoặc REST endpoint mới ở backend Java/Node.
  - Không thay đổi trải nghiệm của `/places` (`PlaceDiscoveryView`) hay `/trips/[tripId]`.
  - Không dùng kết quả thô `prepareTripCandidates` để tự động rải pin lên ZioMap (giữ bất biến từ feature trước: ZioMap chỉ ghim địa điểm AI thực sự chọn/trả ra; danh sách candidate chỉ được dùng làm lookup `name -> id` khi người dùng *chủ động bấm* vào link trong văn bản).

### 1.4 Acceptance Criteria

- [x] **AC-1 (Single Spinner & Instant Sparkles Icon)**: Trong mọi trạng thái (`ThinkingMessage`, tool calling, streaming), bên trái câu trả lời chỉ có **1 vòng xoay duy nhất** ở `AiResponseAvatar`, và `<SparklesIcon />` luôn hiển thị ngay từ đầu.
- [x] **AC-2 (Smooth Streaming)**: Response SSE trả `Cache-Control: no-cache, no-transform`; `<MessageResponse>` kích hoạt streaming word fade-in trong `Streamdown` khi đang stream và chuyển về `mode="static"` khi hoàn tất; không bị re-animate khi load lại lịch sử.
- [x] **AC-3 (Rich Formatting)**: Phần tóm tắt & lưu ý thực tế có icon phân tách rõ ràng theo chủ đề (Di chuyển/Tham quan, Thời tiết/Trang phục, Ẩm thực...), giữ phong cách gọn, không nhồi chữ lặp ngày.
- [x] **AC-4 (Mindtrip Place Detail Drawer - Ảnh 3)**: Click xem chi tiết từ marker trên ZioMap mở `PlaceDetailOverlay` ở cột bên phải (không còn mở popup `PlaceDetailModal`). Các nút `X`, collapse, `Lưu`, `Thêm vào chuyến đi`, chỉ đường, thuyết minh, chia sẻ hoạt động đúng, bấm `X` trả về đúng panel trước đó.
- [x] **AC-5 (Clickable Places Across Chat)**:
  - Tên địa điểm trong `ItineraryPreview` (Ảnh 2) bấm được để trượt mở `PlaceDetailOverlay`.
  - Tên địa điểm cụ thể trong văn bản AI (từ grounded entities trong phiên chat hoặc link `#place:`) hiển thị dạng link nội bộ tinh tế (không bật cảnh báo link ngoài, không tự gắn link bừa vào tên món ăn/từ chung chung) và click trượt mở `PlaceDetailOverlay`.
  - Click card trong `PlaceCards` mở trượt `PlaceDetailOverlay` bên phải thay vì bật tab ngoài.
  - Click trực tiếp pin/marker trên ZioMap trong `/ai-planner` mở trượt ngay `PlaceDetailOverlay` (trong khi `/places` giữ nguyên hành vi popup hai bước).

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[AI Chat UI (apps/web/tripsense)]
  |-- POST /api/ai/chat (SSE: text/event-stream, Cache-Control: no-cache, no-transform)
  |     -> AiResponseAvatar (1 spinner + Sparkles) + ActiveAgentStatus (no spinner)
  |     -> Streamdown (mode="streaming", isAnimating, animated word fadeIn)
  |     -> Grounded Place Index extracted from message parts (createTripProposal / recommendPlaces / searchPlaces / itinerary)
  |
  |-- User Clicks Place Name (from Text Link / ItineraryPreview / PlaceCards / ZioMap Pin / TripDetailPanel)
        |
        v
  [chat-place-resolver]
    1. Open PlaceDetailOverlay immediately with instant snapshot (name, addr, coords, photo)
    2. If placeId missing (e.g. landmark mentioned in text only): match local grounded store -> fallback GET /api/places/search?q=...
    3. If rich details/photos missing or stale: GET /api/places/{id}?includePhoto=true -> cache & hydrate PlaceDetailOverlay
    4. Save / Add to Trip actions -> existing usePlaceActions (/api/places/me/... & /api/trips/...) -> dispatch tripsense:itinerary-updated
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/ai-service` | SSE streaming response headers (`no-transform`) & prompt style + `#place:` guidance | HTTP/SSE qua API Gateway (`/api/ai/chat`) |
| `services/place-service` | **Không đổi code** — cung cấp `GET /api/places/{id}` & `GET /api/places/search` và saved status | HTTP REST qua API Gateway |
| `services/trip-service` | **Không đổi code** — cung cấp `AddToTripDialog` / itinerary items | HTTP REST qua API Gateway |
| `apps/web/tripsense` | Avatar/spinner UX, `Streamdown` word animation, markdown/place linker, right-panel `PlaceDetailOverlay` & `usePlaceActions` | React state + Gateway REST calls |

### 2.3 Architecture Guardrails Verification

- [x] Mọi traffic công khai đi qua API Gateway (`/api/ai/chat`, `/api/places/*`, `/api/trips/*`).
- [x] Không truy vấn chéo DB, không tạo JPA relationship chéo service.
- [x] Sử dụng lại hợp đồng DTO hiện có của `Place` và `PlaceDetailOverlay`, không trùng lặp logic render chi tiết địa điểm.
- [x] Không làm rò rỉ raw error/URL chứa API key ra client log/toast.

---

## 3. API & Event Contracts

- **Không thêm REST endpoint hay Kafka topic mới**.
- **Header update duy nhất** tại `services/ai-service/src/routes/chat.ts` (`POST /api/chat`):
  - `toUIMessageStreamResponse({ headers: { "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "X-Chat-Id": ..., "X-Chat-Title": ... } })`.
- **Internal UI URL Convention trong Chat Markdown**:
  - Format link nội bộ: `[<Place Display Name>](#place:<encodeURIComponent(placeName)>)` hoặc `[<Place Display Name>](#place-id:<encodeURIComponent(placeId)>:<encodeURIComponent(placeName)>)`.
  - Interceptor trong anchor renderer (`richMarkdownComponents.a`) nhận diện href bắt đầu bằng `#place:` hoặc `#place-id:`, gọi `e.preventDefault()` và kích hoạt callback `onOpenPlaceDetail`.

---

## 4. Data Model & Migrations

- **Không có thay đổi schema DB hay Flyway/Drizzle migration**.
- Toàn bộ trạng thái drawer (`activeDetailPlace`, `isLoadingPlaceDetail`, cache chi tiết theo `placeId`/`name`) là client-side React state/ref theo phiên chat (tương tự `PlaceDiscoveryView`), đảm bảo ảnh provider tôn trọng TTL 5 phút theo `approved-photo.ts`.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Markdown Link / XSS Injection** | Link `#place:` / `#place-id:` chỉ trích xuất chuỗi chữ/UUID an toàn rồi render `<button>`/`<a>` qua React + `decodeURIComponent` có try/catch; chỉ cho phép `http:`/`https:` với link ngoài (Streamdown `defaultUrlTransform`), chặn hoàn toàn `javascript:` / `data:`. |
| **Unintended Prompt / Candidate Leak** | ZioMap pin vẫn chỉ hiển thị địa điểm AI đã chọn trong câu trả lời/lịch trình. Auto-linker chỉ gắn link vào địa điểm cụ thể xuất hiện trong phản hồi của AI, không chèn thêm địa điểm ngoài lề. |
| **Auth / IDOR trên nút Save & Add to Trip** | Tái sử dụng `usePlaceActions`, `SaveToCollectionDialog`, `AddToTripDialog` có sẵn — yêu cầu JWT & kiểm tra quyền sở hữu ở `place-service` / `trip-service`, nếu chưa đăng nhập mở `AuthModal`. |
| **Media Attribution & Key Hygiene** | Tái sử dụng `approvedPhotoGallery` trong `PlaceDetailOverlay` và `sanitized` logging chuẩn `ERROR_HANDLING_AND_LOGGING_STANDARDS.md`. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi |
| --- | --- | --- |
| **Auto-link nhầm từ chung chung trong văn bản** (ví dụ: `"mì Quảng"`, `"bánh tráng thịt heo"`, `"cả gia đình"`, `"Đà Nẵng"`) | Nếu match chuỗi quá thoáng, cả các món ăn hoặc tên thành phố chung sẽ biến thành link sai chỗ | 1) **Blacklist cụm từ chung & tên thành phố chính** đang lập kế hoạch (`Đà Nẵng`, `mì Quảng`, `bánh tráng thịt heo`, `hải sản`...); 2) Chỉ auto-link khi cụm từ có **>= 2 từ có nghĩa**, khớp đúng word-boundary với tên grounded place trong phiên chat (ưu tiên tên dài trước như `"Mỳ quảng - bánh tráng thịt heo Quê Minh"` hoặc chuỗi dài `"Bảo tàng Điêu khắc Chăm Đà Nẵng"`) hoặc do AI chủ động bọc `[...](#place:...)`; 3) Không bao giờ auto-link bên trong tiêu đề `H1/H2/H3`, code block, hoặc chuỗi đã là link `<a>`. |
| **Race condition khi click liên tiếp nhiều địa điểm** | Request `getPlaceDetails` của địa điểm A trả về trễ hơn địa điểm B làm màn hình nhảy ngược về A | Gắn `AbortController` cho mỗi lần click (hủy fetch trước đó ngay khi click địa điểm mới) + kiểm tra `activeDetailRequestKeyRef.current === currentKey` trước khi `setDetailPlace`. |
| **Streamdown `linkSafety` modal chặn link `#place:`** | Mặc định Streamdown có thể bật modal xác nhận link ngoài hoặc mở tab mới | Chặn qua `linkSafety={{ enabled: false }}` hoặc `onLinkCheck` + interceptor `components.a` kiểm tra `href.startsWith("#place")` → `e.preventDefault()`, tuyệt đối không nhảy trang hay pop modal xác nhận. |
| **`PlaceDetailOverlay` trên Mobile & Panel Collapse** | Trên màn hình `< 768px`, mở cùng lúc map + detail sẽ chồng chéo | Render `PlaceDetailOverlay` thay thế/phủ trong container cột phải (`absolute inset-0 z-30` trên nền cột phải khi đã mở map/trip, hoặc mở overlay cột phải `md:w-[50%] lg:w-[48%] xl:w-[46%]` khi cột phải đang đóng), có nút `X` quay mượt về trạng thái trước (`map`/`trip-detail`/`closed`). |
| **`Streamdown` `animated` chạy lại mỗi lần đổi chat lịch sử** | Load lại lịch sử chat cũ mà chữ lại fade-in gây chậm cảm giác đọc | Chỉ truyền `mode="streaming"` và `isAnimating={true}` khi **tin nhắn cuối cùng đang ở trạng thái `isLoading` (`submitted` / `streaming`)**; tất cả tin nhắn đã xong hoặc lịch sử cũ dùng `mode="static"` + `isAnimating={false}`. |
| **Prompt thêm icon & `#place:` link làm hỏng format `createTripProposal`** | Sửa `prompts.ts` không khéo có thể làm model quên gọi tool hoặc lặp lại lịch trình chi tiết | Giữ nguyên toàn bộ quy tắc tool-calling + "KHÔNG viết lặp chi tiết Morning/Afternoon/Evening", chỉ thêm đúng mẫu formatting 3 gạch đầu dòng lưu ý có emoji + hướng dẫn nhẹ `[Tên địa điểm](#place:Tên địa điểm)` cho thực thể địa danh trong đoạn văn; chạy lại `services/ai-service` tests (`golden-eval.test.ts`). |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Single-Spinner + Persistent AI Sparkles Avatar & Rich Note Icons
- **Mục tiêu**: Hết lỗi 2 vòng xoay trùng nhau, icon AI xuất hiện ngay từ giây đầu tiên, đoạn lưu ý của AI có icon trực quan đẹp mắt.
- **Tệp dự kiến sửa**:
  - [message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx): Trong `AiResponseAvatar`, luôn render `<SparklesIcon size={15} />` (áp `motion-safe:animate-pulse` nhẹ nếu `isInitializing`, bỏ nhánh thay bằng dấu chấm `size-1.5`); trong `ActiveAgentStatus` và các loading pill khi avatar đã quay, thay `<Loader2 className="animate-spin" />` bằng icon tĩnh gọn (`<SparklesIcon size={12} />` hoặc indicator tĩnh) để chỉ còn **1 vòng xoay duy nhất**.
  - [rich-itinerary-decorator.tsx](../../apps/web/tripsense/src/components/chat/rich-itinerary-decorator.tsx): Bổ sung normalize icon cho các mục lưu ý chuẩn (`Một số lưu ý thực tế...`, `Di chuyển & Tham quan`, `Thời tiết & Trang phục`, `Thưởng thức ẩm thực`, `Lưu trú / Đặt chỗ`) và tinh chỉnh spacing/style trong `richMarkdownComponents`.
  - [prompts.ts](../../apps/web/tripsense/services/ai-service/src/ai/prompts.ts): Cập nhật ví dụ mẫu lời dẫn + 3 gạch đầu dòng lưu ý có emoji gọn đẹp trong mục `TRƯỜNG HỢP 2`.
- **Cải thiện sau Phase 1**: Giao diện chờ AI sạch sẽ đúng chuẩn Mindtrip (1 vòng xoay duy nhất + Sparkles luôn sáng), đoạn lời khuyên thực tế có icon phân loại dễ đọc lướt.

### Phase 2: True Unbuffered Streaming & Smooth Word-by-Word Reveal
- **Mục tiêu**: Chống proxy/compression gom block ở SSE và tạo hiệu ứng chữ tuôn mượt từng từ khi AI trả lời.
- **Tệp dự kiến sửa**:
  - [chat.ts](../../services/ai-service/src/routes/chat.ts): Thêm `"Cache-Control": "no-cache, no-transform"` và `"Content-Encoding": "identity"` vào headers của `result.toUIMessageStreamResponse(...)` để chặn nén gom chunk nhỏ.
  - [GatewayRoutesConfig.java](../../services/api-gateway/src/main/java/fu/tripsense/apigateway/GatewayRoutesConfig.java): Cập nhật filter route `ai-service` từ `.setResponseHeader("Cache-Control", "no-store")` sang `.setResponseHeader("Cache-Control", "no-store, no-cache, no-transform")` để Gateway không ghi đè mất chỉ thị `no-transform` của `ai-service`.
  - [globals.css](../../apps/web/tripsense/src/app/globals.css): Bổ sung `@import "streamdown/styles.css";` (chứa `@keyframes sd-fadeIn` & `[data-sd-animate]` vì hiện repo chưa nạp stylesheet của Streamdown) kèm `@media (prefers-reduced-motion: reduce)` tắt animation cho người dùng giảm chuyển động.
  - [use-active-chat.tsx](../../apps/web/tripsense/src/hooks/use-active-chat.tsx): Điều chỉnh `throttle: 24` thay vì `60` để cập nhật UI mượt theo từng chunk SSE.
  - [apps/web/tripsense/src/components/ai-elements/message.tsx](../../apps/web/tripsense/src/components/ai-elements/message.tsx) & [apps/web/tripsense/src/components/chat/message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx): Bổ sung prop `isAnimating?: boolean` vào `MessageResponse`, cập nhật `memo` comparator kiểm tra đủ `children`, `isAnimating`, `mode`, `className`, `components`, và bật `mode="streaming"` + `isAnimating={true}` + `animated={{ animation: "fadeIn", sep: "word", duration: 150, stagger: 12, maxBacklogMs: 280 }}` duy nhất cho phần `textParts` của tin nhắn assistant đang stream (`Boolean(isLoading) && isAssistant`); tin nhắn cũ/lịch sử giữ nguyên `mode="static"` và `animated={false}`.
- **Cải thiện sau Phase 2**: Xác nhận luồng SSE đi qua Gateway/Next.js không bị nén gom cục, chữ hiện ra mượt mà từng từ tự nhiên ngay cả khi model Flash sinh tốc độ cao.

### Phase 3: Place Detail Right Slide Drawer (Ảnh 3 — `PlaceDetailOverlay`) từ ZioMap & Trip Detail (`COMPLETED`)
- **Mục tiêu**: Khi click địa điểm trên bản đồ ZioMap hoặc từ Trip Detail, cột bên phải trượt mượt ra giao diện chi tiết chuẩn Ảnh 3 (`PlaceDetailOverlay` + `PlaceDetailContent` đã có tại `features/places`) với đầy đủ 3–5 ảnh mosaic, đánh giá, tab `Tổng quan | Đánh giá | Vị trí`, bản đồ mini và nút `Lưu` / `Thêm vào chuyến đi` hoạt động thật, không còn popup `PlaceDetailModal` che giữa màn hình.
- **Thay đổi đã triển khai**:
  - [chat-place-resolver.ts](../../apps/web/tripsense/src/components/chat/chat-place-resolver.ts):
    - `isRealCatalogPlaceId(...)`: phân tách ID catalog thật với synthetic keys (`geo:`, `msg-place:`, ...), `item.id` trong itinerary và `sourceItemKey`.
    - `buildChatPlaceLookup(...)`: trích xuất index lookup on-demand từ `messages` (`createTripProposal`, `recommendPlaces`, `searchPlaces`, `prepareTripCandidates` chỉ phục vụ lookup khi user chủ động click — KHÔNG đẩy lên pin ZioMap), `scopedActiveItinerary`, `aiMapPlaces` và `placeSnapshots`.
    - `toCanonicalDetailPlace(...)`: chuẩn hóa **`id` về canonical catalog `placeId`** (`providerPlaceId` / `placeRef` nếu `place.id` là `item.id` từ [chat-map-places.ts](../../apps/web/tripsense/src/components/chat/chat-map-places.ts#L304)) trước khi đưa vào `PlaceDetailOverlay`, đảm bảo `CommunityReviewsSection` (`placeRef={place.id}`), `usePlaceActions`, `SaveToCollectionDialog` và `AddToTripDialog` thao tác đúng ID thật trong `place-service`.
    - `resolveAndHydrateChatPlace(...)`: mở `PlaceDetailOverlay` tức thời bằng dữ liệu hiện có, kiểm tra cache in-memory + TTL 5 phút theo `approved-photo.ts`, gọi `getPlaceDetails(canonicalId, name, lat, lng, signal, includePhoto)` (hoặc fallback `searchPlaces` theo tâm điểm đến `getDestinationCenter` nếu mới chỉ có synthetic key), dùng `AbortController` + request sequence counter chống race condition khi click liên tiếp nhiều địa điểm.
  - [chat-ziomap-panel.tsx](../../apps/web/tripsense/src/components/chat/chat-ziomap-panel.tsx): Gỡ bỏ `PlaceDetailModal`, nhận prop `onViewPlaceDetails?: (place: Place) => void` và nối `onViewDetails` từ `MapVinaContainer` (click pin hiện mini-popup card, bấm `"Xem chi tiết"` trượt mở `PlaceDetailOverlay` bên phải).
  - [shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx):
    - Thêm state `placeDetailState`, `saveDialogState`, `tripDialogState` (scoped theo `chatId`), `placeDetailsCacheRef`, `photoCheckedAtCacheRef`, `detailAbortControllerRef`, `detailRequestSeqRef`.
    - Bao cột bên phải trong host container `data-testid="chat-right-pane"` chứa `ChatZioMapPanel` / `TripDetailPanel` và `<PlaceDetailOverlay>` (`z-30`): khi đang mở `map` hoặc `trip-detail` thì phủ trực tiếp trên cột phải (không unmount MapVina hay TripDetail bên dưới).
    - Nút `(X)` đóng overlay, hủy request đang chạy và trả lại đúng `rightPanelMode` trước đó; nút `[|<]` toggle `isExpanded` giữa chia đôi 46–50% (`md:relative`) và full-workspace (`absolute inset-0 z-30 w-full`); tích hợp `usePlaceActions` + `SaveToCollectionDialog` + `AddToTripDialog` + `AuthModal` + `tripsense:itinerary-updated`.
  - [trip-detail-panel.tsx](../../apps/web/tripsense/src/components/chat/trip-detail-panel.tsx): Bổ sung prop `onOpenPlaceDetail?: (item: ItineraryItemResponse, knownPhotoUrl?: string) => void`, bấm trực tiếp card hoạt động (thumbnail + tiêu đề) hoặc mục `aiPlanner.viewPlaceDetails` trong menu `...` để trượt `PlaceDetailOverlay` (Ảnh 3), song song với `"Định vị trên ZioMap"` (`onOpenMap`).
  - [en.json](../../apps/web/tripsense/src/locales/en.json) & [vi.json](../../apps/web/tripsense/src/locales/vi.json): Thêm `aiPlanner.placeNotCataloged` và `aiPlanner.viewPlaceDetails` đúng thứ tự A → Z.
  - Tests: [chat-place-resolver.test.ts](../../apps/web/tripsense/src/components/chat/__tests__/chat-place-resolver.test.ts), [chat-ziomap-panel.test.tsx](../../apps/web/tripsense/src/components/chat/__tests__/chat-ziomap-panel.test.tsx), [trip-detail-panel.test.tsx](../../apps/web/tripsense/src/components/chat/__tests__/trip-detail-panel.test.tsx).
- **Cải thiện sau Phase 3**: Bấm xem chi tiết từ ZioMap hoặc Trip Detail lập tức trượt mượt ra đúng **Place Detail Ảnh 3 (`PlaceDetailOverlay`)** bên phải, giữ nguyên luồng chat bên trái, xem đủ ảnh mosaic / đánh giá / bản đồ nhỏ và bấm `Lưu` / `Thêm vào chuyến đi` thật ngay trong `/ai-planner`.

### Phase 4: Clickable Place Links across AI Text, `ItineraryPreview` (Ảnh 2), `PlaceCards` & Direct Pin Click on ZioMap (`COMPLETED`)
- **Mục tiêu**: Hoàn thiện liên thông đa chạm chuẩn Mindtrip: click tên địa điểm trong **văn bản trả lời của AI**, từng dòng của **`ItineraryPreview` (Ảnh 2)**, card **`PlaceCards`**, hoặc click **trực tiếp vào pin/marker trên ZioMap** đều trượt mượt ngay `PlaceDetailOverlay` (Ảnh 3) ở cột bên phải.
- **Thay đổi đã triển khai**:
  - [mapvina-helpers.ts](../../apps/web/tripsense/src/features/map/components/mapvina-helpers.ts), [mapvina-container.tsx](../../apps/web/tripsense/src/features/map/components/mapvina-container.tsx), [map/types/index.ts](../../apps/web/tripsense/src/features/map/types/index.ts) & [chat-ziomap-panel.tsx](../../apps/web/tripsense/src/components/chat/chat-ziomap-panel.tsx):
    - Bổ sung prop optional `openDetailsOnMarkerClick?: boolean` (mặc định `false` để giữ nguyên 100% hành vi của `/places` `PlaceDiscoveryView`) và helper `dispatchMapMarkerClick(...)`.
    - Bật `openDetailsOnMarkerClick={true}` tại `ChatZioMapPanel`: click trực tiếp lên pin bản đồ vừa highlight/fly camera (`onSelectPlace(place.id)`), vừa mở thẳng `onViewDetails(place)` để `PlaceDetailOverlay` trượt ra ngay không cần bấm thêm bước `"Xem chi tiết"` trên popup. Thao tác programmatic `"Định vị trên ZioMap"` từ `TripDetailPanel` vẫn chỉ focus pin + popup để quan sát trên bản đồ.
  - [place-detail-action-context.tsx](../../apps/web/tripsense/src/components/chat/place-detail-action-context.tsx):
    - React Context ổn định cung cấp `openPlaceDetail`, `placeMentionTargets`, `excludedPlaceNames` từ `Messages` xuống `PreviewMessage`, `RichMarkdownLink`, `ItineraryPreview` và `PlaceCards` mà không phá `React.memo` của `Streamdown` hay `PreviewMessage`.
  - [rich-itinerary-decorator.tsx](../../apps/web/tripsense/src/components/chat/rich-itinerary-decorator.tsx):
    - Bổ sung `encodePlaceHref`, `parsePlaceHref`, `normalizePlaceLinksInLine`, `linkKnownPlacesInMarkdown(...)` (áp dụng sau khi stream xong `!options?.isStreaming`, lọc bỏ tên thành phố gốc/từ chung/heading/code/URL/link có sẵn, match biên từ Unicode theo thứ tự tên dài trước).
    - Custom renderer `a` (`RichMarkdownLink`) trong `richMarkdownComponents` nhận `#place:` / `#place-id:` (đi qua `rehype-sanitize` & `defaultUrlTransform` của `Streamdown`) render nút inline gạch chân + `<MapPin />` gọi `openPlaceDetail` từ Context, triệt tiêu popup `LinkSafety`.
  - [chat-place-resolver.ts](../../apps/web/tripsense/src/components/chat/chat-place-resolver.ts):
    - Bổ sung `extractPlaceMentionTargets(...)`, `tripActivityToPlace(...)`, `placeSearchResultToPlace(...)`, nhánh `nameHint` / `placeIdHint` trong `toCanonicalDetailPlace(...)`, và ghi nhận `itemKey` thiếu `placeId` vào `sourceOnlyKeys` để không auto-link hoặc coi hoạt động thuần túy là catalog ID.
  - [itinerary-preview.tsx](../../apps/web/tripsense/src/components/chat/itinerary-preview.tsx):
    - Trong `ActivityRow`, nâng cấp tiêu đề + thumbnail của các mục có `placeId` / `address` / `location` hoặc danh mục địa điểm (`category` khác `ACTIVITY`/`LOGISTICS`) thành nút mở `PlaceDetailOverlay`.
  - [place-cards.tsx](../../apps/web/tripsense/src/components/chat/place-cards.tsx):
    - Click/Enter/Space trên card gọi `openPlaceDetail` từ `PlaceDetailActionProvider` (hoặc `onSelectPlace`) thay cho `window.open`; giữ fallback `window.open(..., "noopener,noreferrer")` nếu render ngoài `ChatShell` và giữ cô lập `stopPropagation()` trên nút Yêu thích / Thêm vào trip.
  - [message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx), [messages.tsx](../../apps/web/tripsense/src/components/chat/messages.tsx) & [shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx):
    - Truyền `onOpenPlaceDetail`, `placeMentionTargets`, `excludedPlaceNames` vào `Messages` (`PlaceDetailActionProvider`) và đồng bộ highlight `selectedMapPlaceId` khi tìm thấy pin khớp trên `aiMapData.places` mà không ghi đè `rightPanelMode`.
  - [prompts.ts](../../services/ai-service/src/ai/prompts.ts):
    - Bổ sung hướng dẫn nhẹ khuyến khích AI dùng `[Tên địa điểm cụ thể](#place:Tên địa điểm cụ thể)` cho các địa điểm nổi bật trong phần lời dẫn/lưu ý và danh sách gợi ý văn bản.
  - Tests: [rich-itinerary-decorator.test.ts](../../apps/web/tripsense/src/components/chat/__tests__/rich-itinerary-decorator.test.ts), [itinerary-preview.test.tsx](../../apps/web/tripsense/src/components/chat/__tests__/itinerary-preview.test.tsx), [place-cards.test.tsx](../../apps/web/tripsense/src/components/chat/__tests__/place-cards.test.tsx), [chat-ziomap-panel.test.tsx](../../apps/web/tripsense/src/components/chat/__tests__/chat-ziomap-panel.test.tsx), [chat-place-resolver.test.ts](../../apps/web/tripsense/src/components/chat/__tests__/chat-place-resolver.test.ts), [mapvina-helpers.test.ts](../../apps/web/tripsense/src/features/map/components/mapvina-helpers.test.ts).
- **Cải thiện sau Phase 4**: Toàn bộ hệ sinh thái AI Chat (Văn bản AI ↔ Lịch trình `ItineraryPreview` Ảnh 2 ↔ Carousel `PlaceCards` ↔ Pin trực tiếp trên ZioMap ↔ `TripDetailPanel`) liên thông đồng nhất vào **1 Place Detail Slide Drawer (`PlaceDetailOverlay` Ảnh 3)** bên phải.

### Verification Commands (sau khi được duyệt và implement từng phase)
```bash
# 1. Backend AI Service tests & TypeScript build
(cd services/ai-service && AI_DATABASE_URL="postgresql://postgres:ci-placeholder@localhost:5432/tripsense_ai" npm test)

# 2. Frontend i18n, TypeScript, ESLint, Vitest & Production Build
(cd apps/web/tripsense && npm run i18n:check && npm run type-check && npx eslint --quiet src/components/chat src/features/map/components/ src/features/places/components/place-detail-overlay.tsx && npx vitest run src/components/chat/__tests__ src/features/map/components/ src/features/places/components/ src/components/ai-elements/__tests__ src/hooks/__tests__ src/i18n/__tests__/i18n.test.ts && npm run build)
```

---

## Human Approval Gate

```text
STATUS: DONE
```
> Toàn bộ 4 phase đã được phê duyệt, triển khai và kiểm thử tự động thành công.
