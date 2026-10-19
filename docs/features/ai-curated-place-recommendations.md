# AI Curated Place Recommendations — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/ai-service`
- **Affected Components**: `services/ai-service`, `apps/web/tripsense`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: [Phase 1 (AI recommendPlaces Tool in ai-service), Phase 2 (Web Client Integration in apps/web/tripsense), Phase 3 (Automated Unit & Integration Tests)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
* **Vấn đề hiện tại**:
  1. Khi người dùng lên kế hoạch hoặc hỏi gợi ý du lịch, hệ thống tự động gom kết quả tìm kiếm thô của công cụ `searchPlaces` từ `place-service` và hiển thị thành thanh carousel *"Địa điểm gợi ý cho chuyến đi"*.
  2. Do `place-service` và Google Places lưu trữ nhiều thực thể (entities) riêng lẻ cho cùng một địa điểm (ví dụ: *"Bãi biển Mỹ Khê"* [beach], *"My Khe Beach"* [tham quan], *"Bãi Tắm Biển Mỹ Khê"* [tham quan], *"Bãi biển Mỹ Khê"* [establishment]), danh sách gợi ý bị trùng lặp tới 4 lần cùng một bãi biển Mỹ Khê.
  3. Danh sách này mang tính máy móc, không phản ánh tư duy du lịch, gu thẩm mỹ hay đề xuất cá nhân hóa của AI.
* **Mục tiêu của người dùng**:
  * Người dùng muốn các địa điểm gợi ý cho chuyến đi **được trực tiếp phản hồi và chọn lọc bởi AI** (*"response bởi AI luôn"*).
  * Danh sách gợi ý phải là các địa điểm tiêu biểu, độc đáo, đa dạng danh mục (biển, tham quan, ẩm thực, quán xá), không bị trùng lặp, kèm theo lý do gợi ý hoặc lời khuyên của AI, đồng thời tự động liên kết ảnh chụp thực tế và toạ độ bản đồ.

### 1.2 User Flows & Journey
1. **Người dùng trò chuyện**: Người dùng nhập *"Tư vấn cho tôi đi chơi Đà Nẵng 3 ngày"* hoặc *"Gợi ý các địa điểm nên đi ở Phú Quốc"*.
2. **AI chọn lọc thông minh**:
   - AI kích hoạt tool chuyên biệt `recommendPlaces` với danh sách từ 4 đến 8 địa điểm tinh hoa do AI tự phân tích và chọn lọc theo ngữ cảnh điểm đến.
   - Mỗi địa điểm có tên chuẩn tiếng Việt, phân loại (`ATTRACTION`, `FOOD`, `CAFE`, `STAY`, `BEACH`), lý do nên đi (`reason`), và thời điểm lý tưởng trong ngày (`bestTimeToVisit`).
3. **Làm giàu dữ liệu & Khử trùng lặp ngầm (Enrichment & Deduplication)**:
   - `ai-service` chạy bộ lọc khử trùng lặp mờ (Fuzzy Name Normalization & Geo Distance) đảm bảo không có địa điểm nào bị lặp lại.
   - Song song truy vấn nhẹ `place-service` để lấy `photoUrl`, `rating`, `location` và `placeId` chuẩn nếu có trong hệ sinh thái TripSense.
4. **Hiển thị trên giao diện Web**:
   - Giao diện chat hiển thị carousel đẹp mắt *"Địa điểm gợi ý từ TripSense AI"*.
   - Mỗi thẻ địa điểm hiển thị hình ảnh, đánh giá, tag lý do gợi ý của AI, và nút `+` để thêm ngay vào lịch trình chuyến đi một cách liền mạch.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Tạo tool mới `recommendPlaces` trong `services/ai-service/src/ai/tools/recommend-places.ts`.
  - Bộ thuật toán chuẩn hoá tên & khử trùng lặp đa tầng `services/ai-service/src/ai/place-deduplication.ts`.
  - Cập nhật `prompts.ts` trong `ai-service` để AI ưu tiên dùng `recommendPlaces` khi đưa ra gợi ý địa điểm, giữ `searchPlaces` chỉ làm công cụ tra cứu ID ngầm.
  - Tách bạch trong `apps/web/tripsense/src/components/chat/message.tsx`: Carousel địa điểm gợi ý chỉ kích hoạt khi có `recommendPlaces`, không hiển thị tràn lan kết quả thô của `searchPlaces`.
  - Thêm chốt chặn khử trùng lặp `deduplicatePlaces` ở frontend (`place-cards.tsx` & `message.tsx`).
- **Out-of-Scope**:
  - Viết lại toàn bộ thuật toán ranking Qdrant / Elasticsearch trong `recommendation-service`.
  - Thay đổi cấu trúc cơ sở dữ liệu MongoDB trong `place-service`.

### 1.4 Acceptance Criteria
- [ ] **AC-1 (AI Recommendation Tool)**: AI kích hoạt `recommendPlaces` khi người dùng hỏi tư vấn điểm đến hoặc khi lập kế hoạch chuyến đi, trả về từ 4 đến 8 địa điểm đa dạng danh mục.
- [ ] **AC-2 (Zero Duplicate Guarantee)**: Không bao giờ xuất hiện các địa điểm trùng lặp tên (cả tiếng Anh/tiếng Việt như *"Bãi biển Mỹ Khê"* và *"My Khe Beach"*) hoặc có cùng vị trí toạ độ địa lý gần nhau trong cùng một carousel.
- [ ] **AC-3 (Data Enrichment)**: Các địa điểm do AI đề xuất được tự động map với `place-service` để lấy ảnh đại diện, toạ độ, rating nếu tìm thấy, hoặc fallback ảnh danh mục chất lượng cao.
- [ ] **AC-4 (UI Integration)**: Carousel trên web hiển thị tiêu đề và thẻ địa điểm với badge lý do của AI, hỗ trợ click xem Google Maps và nút `+` thêm vào chuyến đi.
- [ ] **AC-5 (Separation of Search vs Recommendation)**: Công cụ `searchPlaces` đóng vai trò công cụ tra cứu nội bộ; kết quả tìm kiếm thô của `searchPlaces` không tự ý đè lên carousel gợi ý AI.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[User / Next.js Web]
       |
       v (SSE / Chat Stream)
[services/ai-service (:3002)]
       |
       +---> [Gemini LLM] -> Quyết định chọn lọc địa điểm qua tool: `recommendPlaces`
       |          |
       |          v
       |     [place-deduplication engine] -> Chuẩn hoá tên, loại bỏ stop words, lọc trùng toạ độ
       |          |
       |          v (REST - Fast parallel lookup)
       |     [services/place-service (:8080)] -> Enrich photoUrl, rating, location
       |
       v (Stream to Client)
[apps/web/tripsense] -> Render Carousel "Địa điểm gợi ý từ TripSense AI" kèm badge lý do
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/ai-service` | Định nghĩa tool `recommendPlaces`, prompt kỹ thuật, engine khử trùng lặp và làm giàu dữ liệu | Node.js / Vercel AI SDK |
| `services/place-service` | Cung cấp dữ liệu ảnh, toạ độ, rating qua endpoint nội bộ `/api/places/search` | Synchronous REST |
| `apps/web/tripsense` | Nhận tool part `recommendPlaces` và hiển thị thẻ địa điểm có nút lưu chuyến đi | React / Next.js Client |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic đi qua API Gateway.
- [x] Mỗi service sở hữu database riêng, không truy vấn chéo database.
- [x] Không tạo JPA relationship chéo microservice.
- [x] Không làm phát sinh chi phí LLM dư thừa: Sử dụng thuật toán heuristic khử trùng lặp và tra cứu nhẹ song song.

---

## 3. API & Tool Contracts

### 3.1 AI Tool Contract: `recommendPlaces`
```typescript
export const recommendPlacesSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .default("Địa điểm gợi ý cho chuyến đi")
    .describe("Tiêu đề ngắn gọn cho nhóm địa điểm gợi ý (ví dụ: 'Điểm tham quan & check-in nổi bật ở Đà Nẵng')"),
  destination: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .describe("Điểm đến / Thành phố chính (ví dụ: 'Đà Nẵng')"),
  places: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(120)
          .describe("Tên địa điểm chuẩn tiếng Việt (ví dụ: 'Bãi biển Mỹ Khê', 'Bán đảo Sơn Trà', 'Cầu Rồng')"),
        category: z
          .enum(["ATTRACTION", "FOOD", "CAFE", "STAY", "BEACH", "ACTIVITY"])
          .describe("Phân loại danh mục địa điểm"),
        reason: z
          .string()
          .trim()
          .max(250)
          .describe("Điểm nhấn hoặc lý do AI khuyên nên ghé thăm (ví dụ: 'Bãi cát trắng mịn, thích hợp tắm biển buổi chiều và ngắm hoàng hôn')"),
        bestTimeToVisit: z
          .string()
          .trim()
          .max(80)
          .optional()
          .describe("Thời điểm ghé thăm lý tưởng trong ngày (ví dụ: 'Sáng sớm', 'Hoàng hôn', 'Tối')"),
        address: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe("Địa chỉ tương đối nếu biết"),
      })
    )
    .min(3)
    .max(8)
    .describe("Danh sách từ 3 đến 8 địa điểm tinh hoa do AI chọn lọc cho chuyến đi"),
});
```

### 3.2 Output Data Model sau khi Enrich
```typescript
export interface EnrichedRecommendedPlace {
  id: string; // Canonical placeId hoặc synthetic UUID
  name: string;
  category: "ATTRACTION" | "FOOD" | "CAFE" | "STAY" | "BEACH" | "ACTIVITY";
  categories: string[];
  reason: string;
  bestTimeToVisit?: string;
  address?: string;
  city?: string;
  location?: { lat: number; lng: number };
  photoUrl?: string;
  rating?: number;
  isAiCurated: true;
}
```

---

## 4. Deduplication Engine (Thuật toán lọc trùng lặp)

### 4.1 Chuẩn hoá Tên (Fuzzy Normalization)
1. **Loại bỏ Stop Words du lịch**:
   - `["bãi biển", "bãi tắm", "biển", "điểm tham quan", "khu du lịch", "bán đảo", "chùa", "cầu", "chợ", "quán", "nhà hàng", "khách sạn", "resort", "hotel", "beach", "restaurant", "cafe"]`
2. **Loại bỏ dấu tiếng Việt & ký tự đặc biệt**:
   - *"Bãi biển Mỹ Khê"* $\rightarrow$ `"my khe"`
   - *"My Khe Beach"* $\rightarrow$ `"my khe"`
   - *"Bãi Tắm Biển Mỹ Khê"* $\rightarrow$ `"my khe"`
3. **So sánh độ tương đồng**:
   - Nếu `normalizedA === normalizedB` hoặc Token Jaccard Similarity $\ge 0.8 \rightarrow$ **Trùng lặp**.

### 4.2 Khoảng cách Địa lý (Haversine Distance)
- Nếu hai địa điểm có toạ độ cách nhau $< 300\text{m}$ và tên rút gọn có phần chung:
  $\rightarrow$ Giữ lại một bản ghi duy nhất, ưu tiên bản ghi có ảnh và rating cao hơn.

---

## 5. Implementation Tasks & Verification

### Phase 1: AI Service Tooling
- [x] Task 1.1: Tạo `services/ai-service/src/ai/tools/recommend-places.ts` cho phép AI trực tiếp gợi ý các địa điểm chuẩn hóa kèm lý do và phân loại.
- [x] Task 1.2: Cập nhật `services/ai-service/src/ai/prompts.ts` chỉ dẫn AI gọi `recommendPlaces` khi tư vấn địa điểm.
- [x] Task 1.3: Đăng ký `recommendPlaces` trong `services/ai-service/src/routes/chat.ts`.
- [x] Task 1.4: Tạo unit test `recommend-places.test.ts` trong `services/ai-service` (100% passed).

### Phase 2: Web Client Presentation
- [x] Task 2.1: Cập nhật `apps/web/tripsense/src/components/chat/message.tsx` xử lý `tool-recommendPlaces`.
- [x] Task 2.2: Ưu tiên `recommendPlaces` so với `searchPlaces`, tránh việc đẩy dữ liệu tìm kiếm thô của hệ thống ra carousel.
- [x] Task 2.3: Bổ sung hiển thị `reason` tag trên thẻ `place-cards.tsx` và lưu vào notes khi thêm vào chuyến đi.
- [x] Task 2.4: Bổ sung trường `reason?: string` vào `PlaceSearchResult` interface.

### Phase 3: Automated Testing & Verification
- [x] Task 3.1: Unit test trong `ai-service`: `npm test` -> 31/31 passed.
- [x] Task 3.2: Unit test trong `apps/web/tripsense`: `npm run test -- src/components/chat` -> 35/35 passed (bao gồm test cho `recommendPlaces`).
- [x] Task 3.3: Type check trong `apps/web/tripsense`: `npm run type-check` -> 0 errors.

---

## 6. Security, Resilience & Rollback

- **Khả năng chịu lỗi (Resilience)**: Nếu `place-service` bị chậm hoặc mất mạng, `recommendPlaces` vẫn trả về đầy đủ các địa điểm do AI đề xuất với ảnh placeholder danh mục thẩm mỹ cao, không gây đứt gãy luồng chat.
- **Bảo mật**: Người dùng bấm `+` thêm vào chuyến đi từ thẻ gợi ý vẫn qua xác thực JWT và kiểm tra quyền sở hữu chuyến đi (Anti-IDOR) tại `trip-service`.
- **Kế hoạch Rollback**: Chỉ cần tắt tool `recommendPlaces` trong `chat.ts`, hệ thống trở về trạng thái cũ an toàn mà không ảnh hưởng tới DB.
