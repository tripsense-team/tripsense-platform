# AI Chat Group 1 — Response Polish, Noon Period, Grounding Precision & Itinerary Rules

`STATUS: DONE`

- **Owner Service**: `services/ai-service`
- **Affected Components**: `services/ai-service`, `apps/web/tripsense`
- **Created Date**: 2026-11-16
- **Target PR Boundaries**: Single cohesive PR covering Phase 1 (`ai-service` schema, grounding helper, prompt rules + unit tests) and Phase 2 (`apps/web/tripsense` `NOON` period rendering + component tests)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Qua kiểm tra kết quả sinh lịch trình thực tế của AI Chat (`Gemini 3.8 Flash` trên case *Đà Nẵng 3 Ngày 2 Đêm*), luồng công cụ và đồng bộ sang bảng chuyến đi đã ổn định, nhưng phần chất lượng phản hồi vẫn còn 5 vấn đề ảnh hưởng trực tiếp tới trải nghiệm người dùng cuối:

1. **Bố cục văn bản quanh thẻ `ItineraryPreview` chưa mượt**: `message.tsx` luôn render `{textParts}` trước `{proposalParts}`, trong khi model vẫn viết lời khuyên dài và câu kết *"Bạn xem qua lịch trình ở bảng bên phải và cho mình biết nếu cần điều chỉnh..."* ở cuối `textParts`. Người dùng đọc câu mời chỉnh sửa nằm ngay *phía trên* thẻ lịch trình.
2. **Bữa trưa bị gắn nhãn `Buổi sáng`**: Schema `period` hiện chỉ có `MORNING | AFTERNOON | EVENING | FLEXIBLE`. Các bữa trưa khung `11:00 - 12:30` hoặc `11:30 - 13:00` đều hiển thị `Buổi sáng · 11:30 - 13:00`.
3. **Rớt Place Grounding khi model đặt `title` dạng cụm mô tả**: Các mục như *"Mua sắm đặc sản làm quà tại Chợ Hàn"* không match được `placeId`, địa chỉ và ảnh vì chuỗi chứa cả động từ hành động phía trước, trong khi các mục *"Đại tiệc Hải sản..."* hay *"Thưởng thức Mì Quảng..."* không trỏ tới quán cụ thể.
4. **Lặp địa điểm trong chuyến đi ngắn**: Cùng một địa điểm (ví dụ *Bãi biển Mỹ Khê*) xuất hiện 2 lần ở Ngày 1 và Ngày 2 trong chuyến 3N2Đ.
5. **Lỗi logic du lịch & định tuyến**: Check-out khách sạn bị xếp vào `15:30 - 16:30` thay vì trước `12:00` (kèm gửi hành lý nếu bay chiều); các chặng trong cùng một ngày chạy zíc-zắc qua lại giữa Sơn Trà và Hải Châu nhiều lượt.

### 1.2 User Flows & Journey

1. Người dùng gửi yêu cầu lập kế hoạch (ví dụ *"Lên lịch trình Đà Nẵng 3N2Đ tháng 2"*).
2. `ai-service` gọi `prepareTripCandidates` (hoặc `searchPlaces`) để nạp sẵn địa điểm có `id`, `address`, `photoUrl`, rồi gọi `createTripProposal`.
3. Trong `createTripProposal` (và `addItineraryItems`):
   - Mỗi hoạt động được chuẩn hóa `period` (`NOON` nếu `11:00–13:29`).
   - `resolveCanonicalActivityPlaces` tách phần lõi tên địa điểm khỏi tiền tố mô tả hành động (trừ hoạt động logistics chung) để đối chiếu chính xác với `PlaceGroundingStore` và `place-service` / `recommendation-service`, giữ tối đa tên quán/địa danh chuẩn, địa chỉ và ảnh thật.
4. Model trả về phần chữ mở đầu ngắn gọn (2 câu dẫn + 2–3 lưu ý thực tế súc tích, không viết câu kết thừa trước card).
5. `apps/web/tripsense` (`ItineraryPreview`) hiển thị `Buổi trưa` cho hoạt động khung trưa (áp dụng cho cả proposal mới và proposal cũ đã lưu trong DB nhờ `resolveDisplayPeriod`), giữ đúng thứ tự `textParts` -> `ItineraryPreview` -> `PlaceCards`.

### 1.3 Scope Boundaries

- **In-Scope (Nhóm 1)**:
  - Bổ sung giá trị `NOON` (`Buổi trưa`) vào schema Zod ở `services/ai-service` (`create-trip-proposal.ts`, `itinerary-management.ts`) và UI `apps/web/tripsense` (`types.ts`, `itinerary-preview.tsx`).
  - Bổ sung logic chuẩn hóa `period` theo `timeSlot` (`normalizeActivityPeriod` ở `ai-service` và `resolveDisplayPeriod` ở `itinerary-preview.tsx`) để đảm bảo nhất quán ngay cả khi LLM gán nhầm `MORNING` hoặc khi đọc proposal cũ.
  - Bổ sung helper trích xuất tên địa điểm lõi (`extractCorePlaceQuery`) trong `place-grounding.ts` trước khi match store và gọi fallback `executeHybridPlaceSearch`, đồng thời giữ an toàn ngưỡng `computeNameSimilarity >= 0.65` và bỏ qua logistics chung (`isGenericActivityTitle`).
  - Nâng cấp `prompts.ts`: rút gọn lời dẫn trước card (không câu kết thừa), bắt buộc `title` là tên quán/địa danh cụ thể lấy từ `prepareTripCandidates`, cấm lặp địa điểm giữa các ngày, check-out trước `12:00` (gửi hành lý nếu bay chiều), và gom cụm địa lý theo buổi.
  - Unit tests cho `ai-service` và `apps/web/tripsense`.

- **Out-of-Scope (Dành cho Nhóm 2 & Nhóm 3)**:
  - Speculative prefetch `prepareTripCandidates` ngay trên server trong `chat.ts` để giảm round-trip LLM.
  - Timing telemetry (`firstChunkMs`, `groundingMs`) trong `chat.ts`.
  - Follow-up interactive refinement chips dưới `ItineraryPreview`.
  - Thay đổi cấu trúc DB (`proposals` / `trip-service`), API Gateway routes, hoặc Java services.

### 1.4 Acceptance Criteria

- [x] **AC-1 (`NOON` Period End-to-End)**: Hoạt động có `timeSlot` bắt đầu từ `11:00` đến `13:29` hiển thị nhãn `Buổi trưa` (VI) / `Noon` (EN) ở `ItineraryPreview`, kể cả khi LLM truyền `period: "MORNING"` hoặc khi render proposal JSON cũ chưa có field `NOON`.
- [x] **AC-2 (No Regressions on Trip Commit)**: `createTripProposal` và `addItineraryItems` vẫn đồng bộ `startTime` / `endTime` sang `trip-service` bình thường; không phát sinh thay đổi schema `trip-service`.
- [x] **AC-3 (Grounding Recovery for Action-Prefixed Titles)**: Với các title hợp lệ dạng *"Mua sắm đặc sản làm quà tại Chợ Hàn"* hoặc *"Check-in Cổng Chùa Linh Ứng"*, `extractCorePlaceQuery` tách được `"Chợ Hàn"` / `"Cổng Chùa Linh Ứng"` và match đúng ứng viên thật trong store hoặc fallback search; các hoạt động logistics chung như *"Check-out khách sạn & Tạm biệt Đà Nẵng"* hoặc *"Nghỉ ngơi tại khách sạn"* vẫn bị `isGenericActivityTitle` bỏ qua, không match nhầm địa điểm lạ.
- [x] **AC-4 (Prompt Rules & Chat Layout)**: `prompts.ts` quy định rõ 5 luật chất lượng (không lặp địa điểm giữa các ngày, dùng tên địa điểm cụ thể cho `title`, dùng đúng `MORNING`/`NOON`/`AFTERNOON`/`EVENING`, check-in `>= 14:00` & check-out `<= 12:00`, gom cụm khu vực theo buổi) và rút gọn văn bản trước `ItineraryPreview` (lời dẫn 2 câu + tối đa 3 lưu ý ngắn, không viết câu chốt mời xem card ở phía trên card).
- [x] **AC-5 (Existing Test Compatibility & i18n)**: Giữ nguyên thứ tự hiển thị `text` -> `ItineraryPreview` -> `PlaceCards` (pass `message-recommend-places.test.tsx`); `npm test` ở `services/ai-service`, `npm run i18n:check`, `npm run type-check`, `npm run lint` và component tests ở `apps/web/tripsense` đều pass.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
User Prompt
   |
   v
[Next.js Web (/ai-planner)] --(POST /api/ai/chat)--> [API Gateway (:8080)] --> [ai-service (:8089)]
                                                                                     |
   +---------------------------------------------------------------------------------+
   | 1. System Prompt (prompts.ts: 2-sentence lead-in, no-repeat, geo-cluster, noon/checkout rules)
   | 2. prepareTripCandidates / searchPlaces -> PlaceGroundingStore
   | 3. createTripProposal / addItineraryItems:
   |      - normalizeActivityPeriod(period, timeSlot) -> MORNING | NOON | AFTERNOON | EVENING | FLEXIBLE
   |      - resolveCanonicalActivityPlaces() -> extractCorePlaceQuery(title) -> Store / batch-snapshots / search
   |      - commitTripMutation() -> [trip-service (:8084)] (timeSlot -> startTime/endTime, unchanged contract)
   v
[ItineraryPreview (apps/web/tripsense)]
   - resolveDisplayPeriod(activity.period, activity.timeSlot) -> "Buổi trưa" / "Noon"
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/ai-service` | Prompt rules, Zod tool schemas (`NOON` enum), deterministic period normalization, `extractCorePlaceQuery` grounding | HTTP REST (Sync) tới `place-service`, `recommendation-service`, `trip-service` |
| `apps/web/tripsense` | Typings (`TripActivity["period"]`), hiển thị `NOON` (`Buổi trưa` / `Noon`) trong `ItineraryPreview` | SSE UI stream & JSON history từ `ai-service` qua Gateway |
| `services/trip-service` | Lưu `TripItineraryItem` với `startTime`, `endTime`, `placeRef` | **Không thay đổi** |
| `services/place-service` | Trả snapshot + ảnh batch qua `/api/places/batch-snapshots` | **Không thay đổi** |

### 2.3 Architecture Guardrails Verification

- [x] Không query chéo database; `ai-service` tiếp tục lưu JSON proposal vào `proposals.itineraryJson` (JSONB) thuộc sở hữu riêng của `ai-service`.
- [x] Không tạo JPA relationship hay thay đổi hợp đồng sang `trip-service`.
- [x] Quy tắc nghiệp vụ xác định (`normalizeActivityPeriod`, `resolveDisplayPeriod`, `isGenericActivityTitle`, ngưỡng similarity `>= 0.65`) nằm ở code có thể unit-test, không phó mặc 100% cho LLM.

---

## 3. API & Event Contracts

### 3.1 Tool & UI Payload Contract (`createTripProposal`, `addItineraryItems`, `TripActivity`)

**Không thêm endpoint REST hay Kafka topic mới.** Chỉ mở rộng enum `period` trên DTO/Tool payload theo hướng backward-compatible:

```ts
export type ActivityPeriod = "MORNING" | "NOON" | "AFTERNOON" | "EVENING" | "FLEXIBLE";
```

- **Quy tắc chuẩn hóa thời gian (`normalizeActivityPeriod(period, timeSlot)`)**:
  - Nếu `period === "FLEXIBLE"`: giữ `"FLEXIBLE"`.
  - Parse `startHour * 60 + startMinute` từ `timeSlot` (nếu có dạng `HH:mm - HH:mm`):
    - `11:00` – `13:29` (`660 <= startMinutes < 810`): trả `"NOON"` nếu model truyền `"MORNING"`, `"NOON"`, hoặc `"AFTERNOON"`? Chi tiết:
      - `660 <= startMinutes < 810` (`11:00–13:29`) và model truyền `"MORNING"` -> sửa thành `"NOON"`. Nếu model truyền `"NOON"` -> giữ `"NOON"`. Nếu model cố tình gán `"AFTERNOON"` lúc `13:00`? Chuẩn hóa về `"NOON"` cho mọi khung bắt đầu trong `11:00–13:14`, hoặc đơn giản và nhất quán: `660 <= startMinutes < 810` (`11:00–13:29`) nếu `period !== "FLEXIBLE"` -> `"NOON"`.
      - `startMinutes >= 810 && startMinutes < 1050` (`13:30–17:29`) và model truyền `"MORNING"` hoặc `"NOON"` -> `"AFTERNOON"`.
      - `startMinutes >= 1050` (`>= 17:30`) và model truyền `"MORNING"` hoặc `"NOON"` -> `"EVENING"`.
  - Nếu `timeSlot` không parse được giờ: giữ nguyên `period` hợp lệ.

- **Quy tắc trích xuất tên địa điểm (`extractCorePlaceQuery(title)`)**:
  - Không thay đổi điều kiện chặn đầu vào `isGenericActivityTitle(item.title)` trên tiêu đề gốc (vẫn chặn `"Check-out khách sạn & Tạm biệt Đà Nẵng"`, `"Nghỉ ngơi"`, `"Tự do..."`).
  - Với tiêu đề không generic:
    1. Nếu chứa giới từ địa điểm `" tại "` hoặc `" ở "` (accent-insensitive) và vế sau dài `>= 3` ký tự, không chỉ là từ khóa generic như `"khách sạn"`, `"nhà hàng"`, `"sân bay"`: trích vế sau (ví dụ `"Mua sắm đặc sản làm quà tại Chợ Hàn"` -> `"Chợ Hàn"`).
    2. Ngược lại nếu bắt đầu bằng tiền tố hành động phổ biến (`Check-in`, `Tham quan`, `Khám phá`, `Thưởng thức`, `Ăn sáng`, `Ăn trưa`, `Ăn tối`, `Mua sắm`, `Dạo bộ`, `Dạo chơi`, `Viếng`, `Ghé thăm`, `Trải nghiệm`): loại bỏ phần tiền tố hành động để lấy tên quán/địa danh (ví dụ `"Check-in Cổng Chùa Linh Ứng"` -> `"Cổng Chùa Linh Ứng"`).
    3. Tìm trong `PlaceGroundingStore` bằng cả `title` gốc và `coreQuery`; khi fallback `executeHybridPlaceSearch`, dùng `coreQuery` (nếu ngắn hơn và có nghĩa) và lấy `Math.max(computeNameSimilarity(title, candidate.name), computeNameSimilarity(coreQuery, candidate.name))` với ngưỡng chặt `>= 0.65` kèm guard không match nếu `coreQuery` quá chung chung (chỉ toàn stop words trong `NAME_MATCH_STOP_WORDS` như `"mì quảng"`, `"hải sản"`, `"chợ"` đứng một mình).

### 3.2 Kafka Events

- Không áp dụng (không phát sinh event mới).

---

## 4. Data Model & Migrations

- **Không cần migration SQL hay MongoDB.**
- Bảng `proposals` (`services/ai-service`) lưu `itinerary_json` dưới dạng JSONB nên việc thêm `"NOON"` hoàn toàn tương thích ngược.
- Các bản ghi proposal cũ lưu trong Postgres (đang chứa `period: "MORNING"` cho `11:30 - 13:00`) sẽ tự động hiển thị đúng nhãn `"Buổi trưa"` nhờ `resolveDisplayPeriod(activity.period, activity.timeSlot)` ngay tại tầng UI.

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Grounding False Positive (Sai địa điểm)** | Chỉ chạy `extractCorePlaceQuery` sau khi qua `isGenericActivityTitle`; từ chối `coreQuery` chỉ gồm stop-words hoặc quá ngắn (`tokenizeSignificant(coreQuery).length === 0`); giữ ngưỡng `computeNameSimilarity >= 0.65`. |
| **Prompt Injection / Unbounded Text** | `prompts.ts` chỉ thêm quy tắc nghiệp vụ hệ thống; input của user vẫn tách biệt trong `messages`. |
| **Zero-Leak & XSS** | `ItineraryPreview` vẫn render chuỗi thuần bằng React text nodes (không `dangerouslySetInnerHTML`); không log raw tokens hoặc user credentials. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Vị trí Text vs Proposal Card** | Có nên viết regex tách văn bản hoặc đảo `{proposalParts}` lên trước `{textParts}` trong `message.tsx`? | **Từ chối đảo thứ tự component**: [message-recommend-places.test.tsx](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/components/chat/__tests__/message-recommend-places.test.tsx#L208-L214) kiểm tra `proposalIdx > textIdx`, đồng thời đảo thứ tự sẽ khiến giao diện bị giật khi streaming (`text` đang stream phía trên bị đẩy xuống khi tool xong). Thay vào đó **giữ `textParts -> proposalParts`** và chỉnh `prompts.ts` để phần chữ chỉ là **1–2 câu mở đầu + tối đa 3 lưu ý ngắn gọn**, bỏ câu kết mời xem tiếp ở trên card. |
| **Chống lặp địa điểm: Prompt vs Hard Block** | Có nên để `createTripProposal` từ chối trả lỗi nếu có 2 ngày chứa cùng `placeId`? | **Từ chối hard-reject trong tool**: Nếu trả lỗi để LLM tự sửa lại nguyên JSON 3–5 ngày sẽ tốn thêm +1 vòng LLM (~3–6s) hoặc khiến user gặp `streamText` timeout. Thay vào đó **ràng buộc rõ trong `prompts.ts`** (kèm ngoại lệ cho khách sạn check-in/check-out), đủ giải quyết 95% trường hợp mà **không làm tăng độ trễ**. |
| **Tách tiền tố tên địa điểm** | `title = "Thưởng thức Mì Quảng đặc sản xứ Quảng"` có thể bị match nhầm thành một quán ngẫu nhiên có chữ `"Mì Quảng"` nếu tách quá rộng. | Chỉ nhận `coreQuery` khi có tên riêng / danh từ địa danh đủ phân biệt (loại bỏ stop words ẩm thực chung chung hoặc yêu cầu similarity `>= 0.65` trên phần tên quán/địa danh chuẩn). Nhờ vậy *"Chợ Hàn"* match được đúng *Chợ Hàn*, còn *"Mì Quảng đặc sản xứ Quảng"* không match bừa vào một quán không đúng ý (và prompt sẽ ép AI chọn tên quán cụ thể từ `prepareTripCandidates` ngay từ đầu). |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: `services/ai-service` (Schema, Period Normalization, Grounding, Prompt)
1. [services/ai-service/src/ai/tools/create-trip-proposal.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/ai-service/src/ai/tools/create-trip-proposal.ts):
   - Mở rộng `activitySchema.period` thêm `"NOON"`.
   - Export helper `normalizeActivityPeriod(period, timeSlot)` và áp dụng khi chuẩn hóa `normalizedDays` trước khi lưu `itineraryPayload`.
2. [services/ai-service/src/ai/tools/itinerary-management.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/ai-service/src/ai/tools/itinerary-management.ts):
   - Mở rộng `addItineraryItemsSchema` `period` thêm `"NOON"`.
3. [services/ai-service/src/ai/place-grounding.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/ai-service/src/ai/place-grounding.ts):
   - Export helper `extractCorePlaceQuery(title)` xử lý mẫu `... tại/ở <Địa điểm>` và tiền tố hành động (`Check-in`, `Tham quan`, `Thưởng thức`, `Mua sắm`, `Khám phá`, `Viếng`...).
   - Áp dụng trong `resolveCanonicalActivityPlaces` để tra `PlaceGroundingStore`, gọi fallback `executeHybridPlaceSearch`, và chấm `computeNameSimilarity` an toàn.
4. [services/ai-service/src/ai/prompts.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/ai-service/src/ai/prompts.ts):
   - Cập nhật mục `createTripProposal` & `QUY TRÌNH LẬP KẾ HOẠCH` với 5 luật chất lượng (lời dẫn ngắn 2 câu + tối đa 3 lưu ý ngắn gọn không câu kết thừa phía trên card; dùng `NOON` cho `11:00–13:29`; `title` là tên quán/địa danh cụ thể từ `prepareTripCandidates`; không lặp địa điểm giữa các ngày; check-in `>= 14:00` & check-out `<= 12:00` kèm gửi hành lý; gom cụm khu vực theo buổi).
5. **Unit tests**:
   - Bổ sung test trong [place-grounding.test.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/ai-service/src/ai/place-grounding.test.ts) cho `extractCorePlaceQuery` & `resolveCanonicalActivityPlaces` (cả case *"Mua sắm đặc sản làm quà tại Chợ Hàn"* và case generic *"Check-out khách sạn & Tạm biệt Đà Nẵng"*).
   - Bổ sung test trong [itinerary-management.test.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/ai-service/src/ai/tools/itinerary-management.test.ts) hoặc test file mới cho `normalizeActivityPeriod` (`MORNING` lúc `11:30 - 13:00` -> `NOON`, `14:00 - 16:00` -> `AFTERNOON`) và enum `NOON`.

### Phase 2: `apps/web/tripsense` (`NOON` UI Rendering & Tests)
1. [apps/web/tripsense/src/lib/types.ts](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/lib/types.ts):
   - Cập nhật `TripActivity["period"]` thêm `"NOON"`.
2. [apps/web/tripsense/src/components/chat/itinerary-preview.tsx](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/components/chat/itinerary-preview.tsx):
   - Thêm `NOON` vào `periodConfig` (`Buổi trưa` / `Noon`) với icon phù hợp (`Utensils` hoặc `Sun` ấm).
   - Thêm `resolveDisplayPeriod(activity.period, activity.timeSlot)` khi render `ActivityRow`.
3. **Component tests**:
   - Cập nhật [itinerary-preview.test.tsx](file:///Users/lebao/Working/TeamProject/tripsense-platform/apps/web/tripsense/src/components/chat/__tests__/itinerary-preview.test.tsx) test hiển thị `Buổi trưa` cho cả `period: "NOON"` lẫn `period: "MORNING"` ở khung giờ `11:30 - 13:00`.

### Expected Improvements After Group 1 (Dự kiến so sánh Trước vs Sau)

| Tiêu chí | Trước chỉnh sửa (Baseline) | Sau bản chỉnh sửa Nhóm 1 |
| --- | --- | --- |
| **Nhãn khung giờ trưa (`11:00–13:30`)** | Bị hiện thành `Buổi sáng · 11:30 - 13:00` ở cả Ngày 1, 2, 3. | Hiển thị chuẩn **`Buổi trưa`** nhờ schema `NOON` + `normalizeActivityPeriod` / `resolveDisplayPeriod` (áp dụng cho cả proposal mới và cũ). |
| **Tỷ lệ match địa điểm thật & ảnh** | Các mục viết dài như *"Mua sắm đặc sản làm quà tại Chợ Hàn"* bị rớt địa chỉ/ảnh; quán ăn hay bị viết chung chung. | `extractCorePlaceQuery` cứu các mục có tên địa điểm kèm hành động (như `Chợ Hàn`), kết hợp prompt ép chọn tên quán cụ thể từ `prepareTripCandidates` (ví dụ quán Hải sản / Mì Quảng cụ thể). |
| **Bố cục chữ quanh Card lịch trình** | Đoạn văn dài + câu chốt *"Bạn xem qua lịch trình..."* nằm phía trên card, đọc bị ngược mạch. | Lời dẫn 2 câu mở đầu tự nhiên + tối đa 3 gạch đầu dòng súc tích dẫn thẳng vào `ItineraryPreview`, không còn câu chốt lạc chỗ trước card. |
| **Chất lượng lịch trình thực tế** | Lặp *Bãi biển Mỹ Khê* 2 lần; check-out xếp `15:30 - 16:30`; chạy qua lại Sơn Trà ↔ Hải Châu. | Không lặp địa điểm giữa các ngày; check-out đúng thực tế trước `12:00` (kèm gửi hành lý); gom cụm các điểm gần nhau vào cùng một buổi. |

### Exact Verification Commands

```bash
# 1. AI Service build & unit tests
(cd services/ai-service && npm test)

# 2. Frontend checks & targeted component tests
(cd apps/web/tripsense && npm run i18n:check && npm run type-check && npm run lint && npx vitest run src/components/chat/__tests__/itinerary-preview.test.tsx src/components/chat/__tests__/message-recommend-places.test.tsx)
```

---

## Human Approval Gate

Approved and implemented on 2026-11-16 (`STATUS: DONE`). Verified with `services/ai-service` `npm test` (55/55 passed) and `apps/web/tripsense` `i18n:check`, `type-check`, targeted ESLint, and chat Vitest suites (4 files / 15 tests passed).
