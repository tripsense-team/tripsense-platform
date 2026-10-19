# AI Itinerary Lifecycle Management Tools — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/ai-service`, `services/trip-service`, `apps/web/tripsense`
- **Affected Components**: `services/ai-service/src/ai/tools/*`, `services/ai-service/src/ai/prompts.ts`, `services/ai-service/src/routes/chat.ts`, `services/trip-service/src/main/java/fu/tripsense/tripservice/*`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: [Phase 1 (AI Tools Specification & Backend Contracts), Phase 2 (AI Prompt Engineering & Tool Dispatch), Phase 3 (Frontend Real-Time Synchronization & UX)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
1. **Vấn đề hiện tại**:
   - Khi người dùng prompt: *"Gợi ý lịch trình cho Ngày 1"*, AI trả về nội dung text rất chi tiết nhưng **không có hoạt động nào được lưu vào chuyến đi** ở panel bên phải.
   - Nguyên nhân: System prompt hiện tại chỉ hướng dẫn Gemini gọi `createTripProposal` khi khởi tạo ban đầu cho toàn bộ chuyến đi (*"Tạo đầy đủ các ngày..."*). Khi người dùng hỏi riêng cho Ngày 1 hoặc yêu cầu gợi ý bổ sung, Gemini coi đó là câu hỏi tư vấn thông thường và chỉ trả lời bằng Markdown text thay vì kích hoạt Tool Call để lưu vào cơ sở dữ liệu của `trip-service`.
2. **Nhu cầu phát triển tương lai**:
   - Người dùng cần AI hỗ trợ toàn diện vòng đời lịch trình (Itinerary Lifecycle): không chỉ tạo mới, mà còn có thể **thêm hoạt động vào ngày cụ thể, chỉnh sửa giờ giấc, xóa địa điểm, thay thế địa điểm khác, hoặc sắp xếp lại thứ tự** thông qua hội thoại tự nhiên.
   - Cần xây dựng một hệ thống Tool Calls chuẩn hóa, tin cậy để AI có đủ công cụ thao tác trực tiếp với lịch trình của `trip-service`.

---

## 2. Danh mục Công cụ (Tools) Cần Thiết cho Hệ Thống AI TripSense

Để AI phục vụ tốt nhất cho người dùng trong toàn bộ hành trình du lịch, hệ thống cần được trang bị các nhóm công cụ sau:

### Nhóm 1: Khám phá & Tra cứu Dữ liệu Thực tế (Discovery & Data Retrieval)
| Tool | Trạng thái | Mục đích & Tình huống kích hoạt |
| --- | --- | --- |
| `searchPlaces` | Đã có | Tìm kiếm địa điểm, quán ăn, quán cafe, khách sạn, điểm check-in uy tín từ cơ sở dữ liệu `place-service`. Bắt buộc gọi trước khi thêm địa điểm vào lịch trình. |
| `getWeather` | Đã có | Tra cứu thời tiết theo thành phố hoặc ngày đi để gợi ý hoạt động trong nhà/ngoài trời phù hợp. |
| `getTripItinerary` | **Cần bổ sung** | Cho phép AI đọc toàn bộ cấu trúc lịch trình hiện tại của chuyến đi (danh sách ngày, các hoạt động đang có, thời gian và `itemId`). Cần thiết khi người dùng yêu cầu sửa đổi/xóa để AI nắm chính xác ID và bối cảnh trước khi thao tác. |

### Nhóm 2: Lập Kế hoạch & Khởi tạo Tổng thể (Planning & Full Proposal)
| Tool | Trạng thái | Mục đích & Tình huống kích hoạt |
| --- | --- | --- |
| `updateTripPlanningBrief` | Đã có | Ghi nhận và cập nhật brief du lịch (Where, When, Who, Budget) trong giai đoạn intake ban đầu. |
| `createTripProposal` | Đã có (Cần nâng cấp) | Sinh toàn bộ lịch trình đa ngày khi người dùng bắt đầu lập kế hoạch mới, hoặc sinh lịch trình hoàn chỉnh cho chuyến đi. |

### Nhóm 3: Quản lý & Điều chỉnh Chi tiết Lịch trình (Itinerary Lifecycle Mutations) — TRỌNG TÂM MỚI
| Tool | Trạng thái | Mục đích & Tình huống kích hoạt |
| --- | --- | --- |
| **`addItineraryItems`** | **Cần bổ sung** | Thêm 1 hoặc nhiều hoạt động vào một ngày cụ thể (`dayNumber`). Kích hoạt khi user yêu cầu: *"Gợi ý lịch trình cho Ngày 1"*, *"Thêm quán cafe này vào buổi chiều Ngày 2"*, *"Bổ sung bảo tàng vào Ngày 1"*. AI tìm place qua `searchPlaces` rồi gọi tool này để lưu trực tiếp vào chuyến đi. |
| **`updateItineraryItem`** | **Cần bổ sung** | Chỉnh sửa thời gian (`timeSlot`, `startTime`, `endTime`), tiêu đề, hoặc ghi chú của một mục trong lịch trình. Kích hoạt khi user nói: *"Đổi giờ ăn trưa ngày 1 sang 12:30"*, *"Sửa ghi chú ngày 2: nhớ mang giày đi bộ"*. |
| **`removeItineraryItem`** | **Cần bổ sung** | Xóa một hoạt động khỏi lịch trình. Kích hoạt khi user nói: *"Xóa quán cafe chiều ngày 1 đi"*, *"Tôi không thích Chùa Linh Ứng, bỏ ra khỏi lịch trình giúp tôi"*. |
| **`replaceItineraryItem`** | **Cần bổ sung** | Thay thế một địa điểm hiện tại bằng một địa điểm mới. Kích hoạt khi user nói: *"Đổi khách sạn Sala sang InterContinental"*, *"Thay quán hải sản bằng quán chay"*. AI tìm quán mới qua `searchPlaces` và gọi tool này để thay thế tại vị trí cũ. |
| **`reorderItineraryItems`** | **Cần bổ sung** | Sắp xếp lại thứ tự các điểm trong ngày. Kích hoạt khi user nói: *"Cho tôi đi biển Mỹ Khê trước rồi mới đi ăn trưa"*, *"Đảo lịch trình sáng chiều ngày 1"*. |

---

## 3. Kiến trúc & Luồng Dữ liệu (Architecture & Service Boundaries)

### 3.1 Sơ đồ Tương tác
```text
[User Chat Prompt] 
   | ("Gợi ý lịch trình cho Ngày 1" / "Xóa điểm X ở Ngày 1")
   v
[ai-service]
   |-- 1. searchPlaces (nếu cần tìm địa điểm mới)
   |-- 2. getTripItinerary (đọc danh sách item hiện có)
   |-- 3. Gọi Tool Mutation:
   |      - addItineraryItems
   |      - updateItineraryItem
   |      - removeItineraryItem
   |      - replaceItineraryItem
   v
[trip-service] (Internal HMAC / User Bearer Token)
   |-- Cập nhật bảng `itinerary_items` & tăng `aggregate_revision`
   v
[Next.js Web Client]
   |-- Event `tripsense:itinerary-updated` được kích hoạt
   +-> [TripDetailPanel] tự động reload và hiển thị ngay trên UI bên phải!
```

### 3.2 Quy chuẩn Kiến trúc (Guardrails)
- **Zero-DB Leak**: `ai-service` không bao giờ query database của `trip-service`. Mọi thao tác đều qua REST endpoint hoặc HMAC internal commit.
- **Idempotency**: Các lệnh thêm/sửa/xóa đều kèm `idempotencyKey` hoặc `expectedTripRevision` để chống trùng lặp dữ liệu khi mạng chập chờn.
- **Phản xạ tức thì**: Web client đã có sẵn event listener `tripsense:itinerary-updated`, đảm bảo khi AI gọi tool thành công thì UI panel bên phải cập nhật mượt mà không cần F5 trang.

---

## 4. Kế hoạch Triển khai Chi tiết

### Phase 1: Mở rộng Toolset trong `services/ai-service`
1. **Xây dựng `services/ai-service/src/ai/tools/itinerary-management.ts`**:
   - `addItineraryItems`: Input `{ dayNumber: number, items: Array<ItineraryItemInput> }`. Sử dụng `commitTripMutation` với action `ADD_TO_TRIP` (đã có sẵn trong `trip-service`).
   - `getTripItinerary`: Input `{ tripId?: string }`. Gọi `GET /api/trips/{tripId}/itinerary` để trả về cấu trúc ngày và ID các item hiện có.
   - `removeItineraryItem`: Input `{ tripId?: string, itemId: string }`. Gọi `DELETE /api/trips/{tripId}/itinerary/items/{itemId}`.
   - `updateItineraryItem`: Input `{ tripId?: string, itemId: string, patch: UpdateItemInput }`. Gọi `PATCH /api/trips/{tripId}/itinerary/items/{itemId}`.
   - `replaceItineraryItem`: Input `{ tripId?: string, oldItemId: string, newItem: ItineraryItemInput }`. Xóa item cũ và thêm item mới tại cùng khung giờ.
2. **Đăng ký các tool vào `services/ai-service/src/routes/chat.ts`**:
   - Thêm các tool trên vào danh sách `tools` của hàm `streamText`.

### Phase 2: Nâng cấp System Prompt trong `services/ai-service/src/ai/prompts.ts`
1. **Bổ sung chỉ thị dứt khoát cho yêu cầu gợi ý từng ngày**:
   - *"Khi người dùng yêu cầu gợi ý hoặc lên lịch trình cho một ngày cụ thể (ví dụ: 'Gợi ý lịch trình cho Ngày 1', 'Lên kế hoạch Day 2'): Bạn BẮT BUỘC phải dùng `searchPlaces` tìm các địa điểm uy tín, sau đó GỌI NGAY `addItineraryItems` để lưu các hoạt động vào chuyến đi. TUYỆT ĐỐI KHÔNG chỉ trả lời bằng chữ mà không lưu vào lịch trình."*
2. **Hướng dẫn rõ ràng cho các thao tác Edit / Delete / Replace**:
   - Khi người dùng muốn xóa: tra cứu ID và gọi `removeItineraryItem`.
   - Khi người dùng muốn đổi địa điểm: gọi `searchPlaces` -> gọi `replaceItineraryItem`.
   - Khi người dùng muốn đổi giờ/ghi chú: gọi `updateItineraryItem`.

### Phase 3: Kiểm thử Tự động & Xác minh Giao diện
1. Viết unit test cho các tool mới trong `services/ai-service`.
2. Kiểm tra test case khi người dùng prompt *"Gợi ý lịch trình cho Ngày 1"*, tool `addItineraryItems` được gọi và sinh item.
3. Chạy `npm test` trong `services/ai-service` và `apps/web/tripsense`.

---

## 5. Verification & Test Results

- **Unit Tests (`services/ai-service`)**:
  - `addItineraryItemsSchema validates inputs correctly` (Passed)
  - `mutation schemas validate UUIDs and fields` (Passed)
  - `tools return safe error when no linked trip is found` (Passed)
  - `tsc` compilation cleanly completed with 0 errors.
  - Overall `ai-service` test suite: 24/24 tests passed.
- **Frontend Verification (`apps/web/tripsense`)**:
  - `npm run type-check`: 0 errors.
  - `npm run test -- src/components/chat`: 33/33 tests passed (including sidebar, modals, and rich itinerary decorators).
- **Status**: Completed and fully operational.

