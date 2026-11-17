# AI Chat Group 2 — Latency Diagnostics, Speculative Pre-fetch & Compact LLM Context

`STATUS: DONE`

- **Owner Service**: `services/ai-service`
- **Affected Components**: `services/ai-service`, `apps/web/tripsense` (`shell.tsx` directive alignment only)
- **Created Date**: 2026-11-16
- **Target PR Boundaries**: Single cohesive PR for `ai-service` latency telemetry, speculative candidate pre-fetch, compact tool payload & system prompt injection, plus frontend directive alignment and unit tests

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Sau khi hoàn thiện chất lượng phản hồi ở Nhóm 1 (`ai-chat-group1-quality-and-grounding`), nút thắt chính còn lại ở `/ai-planner` là **thời gian phản hồi của một lượt tạo lịch trình đầy đủ (`POST /api/ai/chat`)**:

1. **Chưa có telemetry đo thời gian từng pha trong `ai-service`**: Hiện chỉ `place-service` và `recommendation-service` có `ExploreDiagnostics`; `chat.ts` chưa ghi nhận `preflightMs`, `prefetchMs`, thời gian từng LLM step, thời gian từng tool và `firstTextMs`, khiến khó xác định độ trễ đến từ Gemini hay từ downstream HTTP.
2. **Nhiều vòng gọi LLM + HTTP nối đuôi nhau**: Khi người dùng đã chọn sẵn điểm đến + số ngày ở thanh header (hoặc đang liên kết chuyến đi), hệ thống vẫn phải chờ: `Pre-flight` → `LLM Step 1 (updateTripPlanningBrief)` → `LLM Step 2 (prepareTripCandidates -> HTTP recommendation/place)` → `LLM Step 3 (createTripProposal)` → `LLM Step 4 (viết chữ)`.
3. **Tool output `prepareTripCandidates` bị phình JSON gửi cho LLM**: `getPrepareTripCandidatesTool` ([prepare-trip-candidates.ts](../../services/ai-service/src/ai/tools/prepare-trip-candidates.ts#L105-L113)) đang trả về **cả `groups` lẫn `places` (trùng lặp 2 lần toàn bộ ứng viên)** và mang theo `photoUrl`, `phone`, `categories`... không cần thiết cho LLM suy luận (vì `PlaceGroundingStore` ở backend đã giữ ảnh/tọa độ để ghép khi `createTripProposal` thực thi), làm tăng số input token gửi lên Gemini.
4. **Chỉ thị ẩn tạo chuyến đi ở `shell.tsx` vẫn hướng model gọi `searchPlaces`**: Dòng directive sau khi tạo trip từ modal ([shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx#L580)) ép gọi `searchPlaces` ngay cả khi đã có sẵn ứng viên pre-fetch hoặc `prepareTripCandidates`.

### 1.2 User Flows & Journey

1. Người dùng gửi tin nhắn lập kế hoạch (từ input chat hoặc tự động từ `CreateTripModal` directive).
2. `chat.ts` thực thi pha **Pre-flight** (`fetchUserContext`, `fetchTripSummary`, `editAccess`, `resolveLanguageModel`), đồng thời đánh giá hàm xác định `shouldSpeculativelyPrefetchCandidates(...)`:
   - Nếu đã đủ điều kiện (`destinationHint` + `when` hoặc `isTripLinked`, có ý định lập kế hoạch `hasExplicitPlanningIntent(userText)`, không hủy, và lịch trình chưa có proposal): `chat.ts` chạy `prepareTripCandidates` **song song** với timeout ngân sách cứng (`PREFETCH_TIMEOUT_MS = 2800ms`, không block quá ngưỡng nếu Qdrant/ZioMap chậm), nạp sẵn vào `placeStore`.
   - Nếu điểm đến + thời gian đã biết từ client/priorState trước khi `fetchTripSummary` xong, chạy `prepareTripCandidates` ngay khi `userProfile` hoàn tất (song song với `fetchTripSummary` / `resolveLanguageModel`) để tối ưu tối đa thời gian chờ.
3. Nếu pre-fetch có kết quả (`places.length > 0`), `trip-context.ts` format thành khối `ỨNG VIÊN ĐỊA ĐIỂM ĐÃ NẠP SẴN` siêu gọn (`id`, `name`, `address`, `rating`, `reason` — không kèm URL ảnh dài) và tiêm vào `getSystemPrompt(...)`.
4. `prompts.ts` hướng dẫn model dùng trực tiếp các `id` trong `ỨNG VIÊN ĐÃ NẠP SẴN` cho `createTripProposal` (bỏ qua vòng gọi `prepareTripCandidates` thừa), trừ khi thiếu nhóm danh mục hoặc người dùng đổi điểm đến.
5. Nếu model vẫn cần gọi `prepareTripCandidates` trực tiếp (ví dụ điểm đến mới gõ trong chat chưa có trên thanh pill), `getPrepareTripCandidatesTool` trả bản rút gọn theo nhóm (không lặp mảng `places` và không nhét URL ảnh dài vào context LLM), còn `PlaceGroundingStore` vẫn giữ đầy đủ `photoUrl` + tọa độ.
6. `ChatLatencyTracker` gắn với lifecycle callbacks của `streamText` (`onStepStart`, `onStepEnd`, `onToolExecutionStart`, `onToolExecutionEnd`, `onChunk`, `onFinish`, `onError`) ghi đúng 1 dòng log có cấu trúc `[ai-latency]` cho mỗi lượt chat.

### 1.3 Scope Boundaries

- **In-Scope (Nhóm 2)**:
  - Module/helper đo hiệu năng `ChatLatencyTracker` trong `services/ai-service` (hỗ trợ bật/tắt qua env `AI_LATENCY_DIAGNOSTICS_ENABLED`, mặc định bật), log không chứa PII/token/nội dung prompt thô.
  - Logic đánh giá & chạy speculative pre-fetch có giới hạn timeout trong `chat.ts` + formatter `formatPrefetchedCandidatesSummary` trong `trip-context.ts` + cập nhật `prompts.ts`.
  - Thu gọn payload trả cho LLM của `getPrepareTripCandidatesTool` trong `prepare-trip-candidates.ts` (giữ nguyên hàm `prepareTripCandidates` trong `place-grounding.ts` và không đụng `searchPlaces` / `recommendPlaces` vì UI `PlaceCards` đọc trực tiếp từ 2 tool đó).
  - Cập nhật `hiddenDirective` ở `apps/web/tripsense/src/components/chat/shell.tsx` để ưu tiên ứng viên đã nạp / `prepareTripCandidates`.
  - Unit tests cho speculative prefetch guard, compact formatter, `getPrepareTripCandidatesTool` compact output, và `ChatLatencyTracker`.

- **Out-of-Scope (Dành cho Nhóm 3 hoặc vận hành)**:
  - Follow-up refinement chips dưới `ItineraryPreview` (Nhóm 3).
  - Thay đổi cơ chế Key Pool fallback khi `GOOGLE_GENERATIVE_AI_API_KEY` bị `429` (Nhóm 3).
  - Golden LLM Eval suite (Nhóm 3).
  - Thay đổi Java services, Redis, Kafka, DB schema hay API Gateway.

### 1.4 Acceptance Criteria

- [x] **AC-1 (Latency Telemetry)**: Mọi request `POST /chat` tạo stream trong `chat.ts` ghi 1 dòng log `[ai-latency]` có đủ `preflightMs`, `prefetchMs`, `firstChunkMs`, `firstTextMs`, `totalMs`, `stepCount`, chi tiết `steps` và `tools` (ms), không chứa JWT, API key, email hay prompt người dùng.
- [x] **AC-2 (Safe & Budgeted Speculative Pre-fetch)**:
  - Chỉ kích hoạt pre-fetch khi có đủ `destinationHint` + `when`/`isTripLinked`, `hasExplicitPlanningIntent(userText)` là `true`, `!hasCancellationIntent(userText)`, và chưa có `createTripProposal` sẵn trong cuộc trò chuyện.
  - Không kích hoạt với câu hỏi thông thường như *"Thời tiết Đà Nẵng tháng 2 thế nào?"*.
  - Bị chặn bởi `PREFETCH_TIMEOUT_MS` (`2800ms` hoặc env `AI_PREFETCH_TIMEOUT_MS`): nếu downstream chậm hoặc lỗi, `streamText` vẫn chạy bình thường, không văng 500.
- [x] **AC-3 (No-Duplicate Compact Candidate Injection & Tool Output)**:
  - `formatPrefetchedCandidatesSummary` định dạng ngắn gọn theo nhóm (`category`, `id`, `name`, `address`, `rating`), không chứa `photoUrl` hay dữ liệu thừa.
  - `getPrepareTripCandidatesTool` trả về cấu trúc gọn (bỏ mảng `places` trùng lặp, bỏ `photoUrl` khỏi JSON trả LLM) trong khi `PlaceGroundingStore` vẫn lưu đủ `PlaceSearchResult` (có `photoUrl` để `createTripProposal` gán ảnh thật vào card).
  - `searchPlaces` và `recommendPlaces` giữ nguyên payload có `photoUrl` để `PlaceCards` UI không bị mất ảnh.
- [x] **AC-4 (Prompt & Web Directive Alignment)**:
  - `prompts.ts` hướng dẫn ưu tiên dùng `ỨNG VIÊN ĐỊA ĐIỂM ĐÃ NẠP SẴN` (không gọi lại `prepareTripCandidates` nếu đã đủ cho điểm đến yêu cầu).
  - `shell.tsx` (`hiddenDirective`) bỏ ép gọi `searchPlaces` thừa khi ứng viên đã nạp sẵn hoặc dùng `prepareTripCandidates`.
- [x] **AC-5 (Verification)**: Toàn bộ unit tests `services/ai-service` và các kiểm tra frontend (`i18n:check`, `type-check`, `eslint`, chat Vitest tests) đều pass.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
POST /api/ai/chat (t0)
  |
  +---> [Phase A: Pre-flight Concurrent]
  |       |-- fetchUserContext (context-service) ----> [nếu đủ điều kiện & có early destHint]
  |       |-- fetchTripSummary (trip-service)            └--> prepareTripCandidates() (timeout <= 2800ms)
  |       |-- resolveLanguageModel (Gemini key)                  -> nạp PlaceGroundingStore + build compact summary
  |       v
  |     (nếu chỉ biết destHint sau khi fetchTripSummary xong & đủ điều kiện -> chạy bounded prefetch)
  |
  +---> [Phase B: streamText (Gemini)]
  |       - System Prompt nhận sẵn "ỨNG VIÊN ĐỊA ĐIỂM ĐÃ NẠP SẴN" (nếu prefetch OK)
  |       - Lifecycle hooks (onStepStart/End, onToolExecutionStart/End, onChunk, onFinish) -> ChatLatencyTracker
  |       - Bỏ được LLM Step gọi prepareTripCandidates -> gọi thẳng createTripProposal (đã có placeId & ảnh trong store)
  v
[ai-service] log 1 dòng [ai-latency] summary (preflightMs, prefetchMs, firstTextMs, totalMs, steps, tools)
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/ai-service` | Orchestration, telemetry `[ai-latency]`, speculative pre-fetch, compact tool/prompt serialization | HTTP REST sync tới `context-service`, `trip-service`, `recommendation-service`, `place-service` |
| `apps/web/tripsense` | Đồng bộ nội dung `hiddenDirective` ở `shell.tsx` | HTTP POST / SSE tới `/api/ai/chat` qua Gateway |
| `recommendation-service` / `place-service` / `trip-service` | **Không thay đổi code hoặc API** | Nhận ít request trùng lặp hơn |

### 2.3 Architecture Guardrails Verification

- [x] Không query chéo DB giữa các service.
- [x] Không thay đổi API contract công khai của `POST /chat` (SSE response protocol cho Vercel AI SDK client giữ nguyên 100%).
- [x] Lỗi/timeout từ pre-fetch chỉ suy giảm nhẹ (`graceful degradation`), không bao giờ làm sập request chat.

---

## 3. API & Event Contracts

### 3.1 Tool Output Contract Change (Internal LLM Tool Result: `prepareTripCandidates`)

`getPrepareTripCandidatesTool` ([prepare-trip-candidates.ts](../../services/ai-service/src/ai/tools/prepare-trip-candidates.ts)) chuyển output trả về cho model từ full `PlaceSearchResult` (lặp 2 lần ở `groups` + `places`) sang dạng gọn:

```json
{
  "success": true,
  "destination": "Đà Nẵng",
  "recommendationCount": 16,
  "fallbackTriggered": false,
  "total": 16,
  "groups": [
    {
      "category": "ATTRACTION",
      "source": "recommendation",
      "places": [
        {
          "id": "mongo-or-canonical-id",
          "name": "Cổng Chùa Linh Ứng",
          "address": "472H+435 Hoàng Sa, Sơn Trà, Đà Nẵng",
          "rating": 4.8,
          "userRatingCount": 1240,
          "reason": "Hợp gu ngắm cảnh biển"
        }
      ]
    }
  ]
}
```

- `PlaceGroundingStore` (truyền qua `context.store`) vẫn giữ nguyên full `PlaceSearchResult` bao gồm `photoUrl` và `location` để `createTripProposal` / `recommendPlaces` ghép ảnh ngay từ RAM.
- UI `message.tsx` không đọc danh sách địa điểm từ `tool-prepareTripCandidates` nên hoàn toàn tương thích.

### 3.2 Environment Variables (Optional Tuning)

- `AI_LATENCY_DIAGNOSTICS_ENABLED`: `"true"` (mặc định bật) / `"false"`.
- `AI_PREFETCH_TIMEOUT_MS`: `"2800"` (mặc định `2800ms`, giới hạn biên `1000..6000`).

---

## 4. Data Model & Migrations

- **Không thay đổi database schema hoặc migration.**
- Trong DB `messages` của `ai-service`, các tool parts mới cho `tool-prepareTripCandidates` sẽ nhỏ gọn hơn (không lưu trùng mảng `places`).

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **Log Leakage (Zero-Leak Diagnostics)** | `ChatLatencyTracker` chỉ ghi `chatId`, `modelId`, số lượng bytes/tokens/candidates và các mốc `ms`; **tuyệt đối không** log `authorization` header, API key, user text hay candidate payload. |
| **Pre-fetch Abuse / Unbounded Waiting** | Chỉ pre-fetch khi `hasExplicitPlanningIntent(userText)` là `true` và `!hasCancellationIntent(userText)`; luôn kẹp cứng thời gian chờ bằng `AbortSignal` / `Promise.race` (`AI_PREFETCH_TIMEOUT_MS`, max 6s) để không treo request khi downstream chậm. |
| **Cross-user Cache Isolation** | `placeStore` và `prefetchedCandidates` được tạo mới cho từng request (`new PlaceGroundingStore()`), không dùng biến global chia sẻ giữa các user khác nhau (đảm bảo personalization `context-service` không bị rò sang user khác). |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Pre-fetch vs First-Token Latency** | Nếu `recommendation-service` / ZioMap bị chậm (2.5s) ở một thành phố chưa có trong Qdrant, chạy pre-fetch tuần tự trước `streamText` có thể làm trễ thời điểm mở stream đầu tiên. | **Chạy song song + Timeout ngắn (`2800ms`)**: Nếu `destination` đã có từ header/priorState (`body.tripPreferences` / `priorPlanningState`), kích hoạt `prepareTripCandidates` ngay sau `fetchUserContext` (~30ms) song song với `fetchTripSummary` & `resolveLanguageModel`, và chỉ đợi tối đa `PREFETCH_TIMEOUT_MS`. Với thành phố đã index Qdrant (~100–300ms), hầu như không thêm trễ mà tiết kiệm hẳn 1 vòng LLM (~2–4s). Nếu vượt timeout, bỏ qua pre-fetch và để model tự gọi tool như cũ. |
| **Có nên bỏ tool `updateTripPlanningBrief` ở vòng 1 luôn không?** | Nếu thay thế cả `updateTripPlanningBrief` bằng server auto-commit trước `streamText`, người dùng mới sẽ chậm nhận chunk đầu nếu `trip-service` (`CREATE_TRIP`) mất thời gian. | **Giữ `updateTripPlanningBrief` là tool** để vẫn hưởng `shouldStopAfterBriefStep`, `TripIntakeCard` trạng thái UI và atomic idempotency key theo `userMessageId`, chỉ loại bỏ vòng `prepareTripCandidates` dư thừa bằng pre-fetch. |
| **Rút gọn `searchPlaces` vs chỉ rút `prepareTripCandidates`** | `searchPlaces` cũng trả URL ảnh dài vào context LLM. | **Không đụng JSON trả về của `searchPlaces`**: [message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx#L330-L356) đọc `placeData.places` (kèm `photoUrl`) từ `tool-searchPlaces` để render `PlaceCards` fallback khi không có `recommendPlaces`. Chỉ thu gọn `prepareTripCandidates` là an toàn 100% cho UI. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: `services/ai-service` (Latency Telemetry, Pre-fetch, Compact Payload & Prompts)
1. **Tạo `services/ai-service/src/ai/latency-diagnostics.ts`**:
   - Export `ChatLatencyTracker` (hoặc pure helper `createChatLatencyTracker`) theo dõi `preflightMs`, `prefetch` (`ran`, `durationMs`, `timedOut`, `hitCount`, `recommendationCount`), `firstChunkMs`, `firstTextMs`, per-step LLM timing + token usage, per-tool timing, và `formatLogLine()`.
2. **Mở rộng `services/ai-service/src/config.ts`**:
   - Bổ sung `aiLatencyDiagnosticsEnabled` (`AI_LATENCY_DIAGNOSTICS_ENABLED !== "false"`) và `aiPrefetchTimeoutMs` (clamped `1000..6000`, default `2800`).
3. **Cập nhật `services/ai-service/src/ai/trip-context.ts` & `prompts.ts`**:
   - Export `formatPrefetchedCandidatesSummary(groups)` trong `trip-context.ts`.
   - Thêm tham số `prefetchedCandidatesSummary?: string` vào `PromptContext` / `getSystemPrompt` trong `prompts.ts`, hướng dẫn dùng thẳng `id` đã nạp sẵn mà không gọi lặp `prepareTripCandidates`.
4. **Cập nhật `services/ai-service/src/ai/tools/prepare-trip-candidates.ts`**:
   - Thu gọn payload trả về LLM (chỉ giữ `groups` với các field cần cho lập lịch: `id`, `name`, `address`, `rating`, `userRatingCount`, `reason`, bỏ mảng `places` lặp lại và bỏ `photoUrl` thừa) trong khi `context.store` vẫn giữ đầy đủ `PlaceSearchResult`.
5. **Cập nhật `services/ai-service/src/routes/chat.ts`**:
   - Export helper thuần `evaluateSpeculativePrefetchPlan(...)` (hoặc đặt trong `trip-context.ts` để test trực tiếp không cần Postgres) và chạy speculative pre-fetch song song + timeout budget `config.aiPrefetchTimeoutMs`.
   - Gắn `ChatLatencyTracker` vào `onStepStart`, `onStepEnd`, `onToolExecutionStart`, `onToolExecutionEnd`, `onChunk`, `onFinish`, `onError` của `streamText`.

### Phase 2: `apps/web/tripsense` (`shell.tsx` Directive Alignment)
1. **Cập nhật [apps/web/tripsense/src/components/chat/shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx#L580)**:
   - Sửa câu `hiddenDirective` sau khi tạo trip từ *"Hãy lập tức dùng searchPlaces..."* sang *"Hãy ưu tiên dùng các địa điểm đã nạp sẵn (hoặc prepareTripCandidates nếu chưa có) và gọi createTripProposal để sinh lịch trình hoàn chỉnh chi tiết cho tất cả ${durationDays} ngày..."*.

### Phase 3: Tests & Verification
1. Thêm unit tests trong `services/ai-service`:
   - `ChatLatencyTracker` (timing breakdown, no secret leakage).
   - `evaluateSpeculativePrefetchPlan` & `formatPrefetchedCandidatesSummary` (kích hoạt đúng điều kiện planning, bỏ qua câu hỏi thường/cancel/đã có proposal, gọn nhẹ không `photoUrl`).
   - `getPrepareTripCandidatesTool` (kiểm tra output trả LLM không chứa duplicate `places` và không chứa `photoUrl`, trong khi `store.getById(...)` vẫn giữ nguyên `photoUrl`).
2. Chạy verification commands:

```bash
# 1. AI Service build & unit tests
(cd services/ai-service && AI_DATABASE_URL="postgresql://postgres:ci-placeholder@localhost:5432/tripsense_ai" npm test)

# 2. Frontend checks & chat tests
(cd apps/web/tripsense && npm run i18n:check && npm run type-check && npx eslint src/components/chat/shell.tsx && npx vitest run src/components/chat/__tests__/shell-trip-linking.test.tsx src/components/chat/__tests__/itinerary-preview.test.tsx src/components/chat/__tests__/message-recommend-places.test.tsx)
```

---

## Human Approval Gate

Approved and implemented on 2026-11-16 (`STATUS: DONE`). Verified with `services/ai-service` `npm test` (60/60 passed) and `apps/web/tripsense` `i18n:check`, `type-check`, targeted ESLint, and chat Vitest suites (3 files / 9 tests passed).
