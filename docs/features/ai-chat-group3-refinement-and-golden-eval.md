# AI Chat Group 3 — Interactive Refinement Chips & Golden LLM Evaluation Suite

`STATUS: DONE`

- **Owner Service**: `services/ai-service`, `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense` (chat thread UI & i18n), `services/ai-service` (offline & live Golden Eval framework)
- **Created Date**: 2026-11-16
- **Scope Note**: Excludes Gemini Key Pool strategy changes (already verified stable on EC2 per user direction).

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

1. **Khám phá tính năng tinh chỉnh hội thoại chưa trực quan (`apps/web/tripsense`)**: Backend `services/ai-service` đã cung cấp đầy đủ `addItineraryItems`, `replaceItineraryItem`, `updateItineraryItem`, `removeItineraryItem`, nhưng sau khi `ItineraryPreview` xuất hiện trong khung chat, giao diện chỉ có dòng trạng thái *"Đã tự động lưu vào chuyến đi..."*. Người dùng cuối ít nhận ra mình có thể chat tiếp để đổi khách sạn, bớt điểm tham quan, thêm quán ăn hay tính chi phí ngay lập tức.
2. **Thiếu bộ kiểm chứng hành vi thực của LLM sau khi sửa Prompt/Model (`services/ai-service`)**: 60 unit test hiện tại kiểm tra logic hàm và mock HTTP nhưng không đánh giá được chất lượng tool-calling & tuân thủ quy tắc của Gemini (`3.8-flash` hoặc phiên bản mới) trước khi merge/deploy.

### 1.2 User Flows & Journey

#### Flow A: Interactive Refinement Chips (`apps/web/tripsense`)
1. Người dùng nhận được thẻ `ItineraryPreview` hoàn chỉnh trong khung chat (`tool-createTripProposal` có `proposalId`).
2. Ngay bên dưới thẻ `ItineraryPreview` (chỉ ở **tin nhắn trợ lý cuối cùng** khi không đang stream/submit), hiển thị 4 chip bấm nhanh sử dụng component `Suggestion` song ngữ (`vi`/`en`) qua `useTranslation()`:
   - Đổi khách sạn gần biển hơn / khu trung tâm hơn (`replaceItineraryItem`)
   - Giảm bớt điểm để lịch đi nhẹ nhàng hơn (`removeItineraryItem` / `updateItineraryItem`)
   - Thêm quán ăn địa phương / cafe cho Ngày 1 (`addItineraryItems`)
   - Ước tính chi phí chi tiết cho từng ngày
3. Khi người dùng click một chip:
   - UI gửi ngay prompt tinh chỉnh qua `sendMessage`.
   - Khi tin nhắn mới bắt đầu gửi/stream (`messages.length` tăng hoặc `isStreaming` bật), thanh chip ở thẻ cũ tự ẩn đi để lịch sử hội thoại luôn gọn sạch.
   - AI thực thi tool tương ứng và đồng bộ sang `TripDetailPanel` bên phải.

#### Flow B: Golden LLM Evaluation Suite (`services/ai-service`)
1. Kỹ sư chạy `npm run eval` (tách biệt khỏi `npm test` trên CI để không phụ thuộc API key thật trong PR check).
2. Bộ eval chạy **8 kịch bản chuẩn** với `getSystemPrompt` thật + tool definitions thật + fixture địa điểm/lịch trình mẫu trong bộ nhớ (không cần bật Postgres/Mongo/Docker Compose):
   - Kịch bản 1: Thiếu ngày đi → phải gọi `updateTripPlanningBrief` (`COLLECTING`), không tạo proposal.
   - Kịch bản 2: Đủ Where + When (3 ngày Đà Nẵng tháng 2) → gọi `createTripProposal` (3 ngày, có `NOON` khung 11:00–13:29, không lặp địa điểm, check-out `< 12:00`, không gọi kèm `recommendPlaces`, không viết lặp Markdown Day 1/2/3).
   - Kịch bản 3: Đủ Where + When đã nạp sẵn từ pill / pre-fetch → ưu tiên tạo `createTripProposal` bằng ID có sẵn.
   - Kịch bản 4: Hỏi gợi ý quán cafe lẻ → gọi `recommendPlaces`/`searchPlaces`, không gọi `createTripProposal`.
   - Kịch bản 5: Hỏi thời tiết/thông tin chung → không gọi `createTripProposal`.
   - Kịch bản 6: Yêu cầu thay thế 1 điểm Ngày 1 trên chuyến đi đã liên kết → gọi `replaceItineraryItem` (hoặc `getTripItinerary` rồi `replaceItineraryItem`).
   - Kịch bản 7: Yêu cầu xóa 1 hoạt động Ngày 2 → gọi `removeItineraryItem` / `getTripItinerary`.
   - Kịch bản 8: User có `dislikedCategories: ["seafood", "bar"]` → lịch trình không đề xuất hải sản/quán bar.
3. Engine `evaluateGoldenRun(...)` chấm PASS/FAIL theo các quy tắc xác định và in bảng tóm tắt kèm `durationMs` + mã lỗi vi phạm (nếu có). Chính các hàm evaluator xác định này được unit-test trực tiếp trong `npm test` (offline, 0 quota).

### 1.3 Scope Boundaries

- **In-Scope**:
  - Prop truyền callback `onQuickReply` và điều kiện hiển thị chip chỉ trên tin nhắn `createTripProposal` cuối cùng chưa bị tiếp nối ở `shell.tsx` → `messages.tsx` → `message.tsx` → component `ItineraryRefinementChips` (hoặc tích hợp gọn trong `message.tsx`/`itinerary-preview.tsx`).
  - Bổ sung i18n keys trong `aiPlanner` namespace của `en.json` và `vi.json`, sắp xếp A → Z (`npm run i18n:sort` / `npm run i18n:check`).
  - Cập nhật `PreviewMessage` `memo` comparator trong `message.tsx`.
  - Tạo module evaluator & scenarios ở `services/ai-service/src/ai/eval/`:
    - `golden-eval.ts` (định nghĩa scenarios, pure evaluator checks, isolated tool harness)
    - `golden-eval.test.ts` (unit test cho `evaluateGoldenScenario` chạy trong `npm test`)
    - `run-golden-eval.ts` + script `"eval"` trong `services/ai-service/package.json` chạy live với Gemini khi có API key.
  - Component test trong `apps/web/tripsense` kiểm chứng chip hiện ở proposal cuối cùng, gọi `onQuickReply` khi click, và ẩn khi đang loading hoặc khi có tin nhắn mới phía sau.

- **Out-of-Scope**:
  - Bất kỳ thay đổi nào tới `gemini-key-manager.ts` hoặc Token Pool.
  - Thay đổi backend Java microservices, API Gateway hoặc database migrations.
  - Chạy live Gemini calls trong GitHub Actions CI mặc định (`npm test` chỉ chạy evaluator unit test offline).

### 1.4 Acceptance Criteria

- [x] **AC-1 (Refinement Chips Display & Cleanliness)**: Sau khi `createTripProposal` hoàn thành (có `proposalId`) ở tin nhắn cuối cùng và `!isLoading`, hiển thị 4 chip gợi ý tinh chỉnh nhanh ngay dưới thẻ lịch trình; ẩn chip khi đang loading/streaming hoặc khi có tin nhắn tiếp theo phía sau.
- [x] **AC-2 (Quick Action Trigger)**: Click vào chip gọi `sendMessage` với câu lệnh tiếng Việt hoặc tiếng Anh khớp ngôn ngữ hiện tại (i18n `useTranslation()`).
- [x] **AC-3 (i18n Parity & No Hardcoded UI Strings)**: Toàn bộ label/prompt của chip nằm trong `en.json` và `vi.json`, đúng thứ tự A → Z và pass `npm run i18n:check`.
- [x] **AC-4 (Golden Eval Framework & Offline Verification)**: `services/ai-service` có 8 kịch bản chuẩn + bộ evaluator kiểm tra tool selection, số ngày, không trùng địa điểm, nhãn `NOON`, check-out `< 12:00`, tránh danh mục ghét, và sự súc tích của văn bản; `evaluateGoldenScenario` được unit test đầy đủ trong `npm test`.
- [x] **AC-5 (Live Runner Script Ready)**: `npm run eval` trong `services/ai-service` chạy được live với `GOOGLE_GENERATIVE_AI_API_KEY` (hoặc pool) mà không phụ thuộc Postgres/Docker containers, báo lỗi rõ ràng nếu thiếu key.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Web Chat UI]
  shell.tsx (sendMessage)
    -> messages.tsx (isLatestAssistantProposal = index === messages.length - 1 && !isAnyLoading)
      -> message.tsx (PreviewMessage memo checks isLatestAssistantProposal & onQuickReply)
        -> ItineraryPreview + ItineraryRefinementChips (4 Suggestion pills)
             |-- user clicks pill --> sendMessage({ role: "user", parts: [{ text, type: "text" }] })

[Golden Eval Runner (services/ai-service)]
  npm run eval (CLI local/staging)
    -> golden-eval.ts (8 scenarios + mocked tool fixtures + real getSystemPrompt)
      -> generateText/streamText with real Gemini model (maxSteps)
        -> evaluateGoldenScenario(scenario, result) -> PASS/FAIL table + metrics
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Render chip gợi ý tinh chỉnh, gửi prompt qua `useActiveChat().sendMessage` | Client-side React -> `POST /api/ai/chat` hiện có |
| `services/ai-service` | Golden Eval scenarios, deterministic graders, live runner script | Gọi Gemini SDK qua `resolveLanguageModel`, không cần DB/Docker |

### 2.3 Architecture Guardrails Verification

- [x] Không tạo endpoint mới hay thay đổi contract API Gateway.
- [x] Không truy cập chéo DB; live eval dùng isolated in-memory tool fixtures an toàn, không ghi dữ liệu rác vào Postgres/TripService prod.
- [x] Tuân thủ 100% [I18N_STANDARDS.md](../I18N_STANDARDS.md) và zero-leak error rules ở [apps/web/tripsense/AGENTS.md](../../apps/web/tripsense/AGENTS.md).

---

## 3. API & Event Contracts

- **Không thêm hoặc sửa REST endpoint / Kafka topic.**
- **Frontend UI Prop Additions**:
  - `MessagesProps`: bổ sung `onQuickReply?: (prompt: string) => void`.
  - `PreviewMessageProps`: bổ sung `showRefinementChips?: boolean` và `onQuickReply?: (prompt: string) => void` (cả 2 trường phải được so sánh trong `PreviewMessage` `memo` custom comparator!).

---

## 4. Data Model & Migrations

- **Không thay đổi database schema hoặc migration.**

---

## 5. Security & Trust Boundaries

| Risk Area | Mitigation Strategy |
| --- | --- |
| **API Key Protection in Eval** | `run-golden-eval.ts` đọc key qua `resolveLanguageModel` / `env`, không hardcode hay in key ra stdout. |
| **Isolated Live Eval Execution** | Các tool trong `npm run eval` chạy trên fixture trong RAM, không bao giờ gửi mutation (`CREATE_TRIP`, `ADD_TO_TRIP`) vào database hoặc `trip-service` thật. |
| **XSS / Input Safety** | Chip chỉ gửi chuỗi văn bản i18n cố định qua `sendMessage`, render qua React JSX text nodes. |

---

## 6. Devil's Advocate & Technical Trade-offs

| Khía cạnh | Thách thức / Rủi ro | Giải pháp & Đánh đổi (Trade-off) |
| --- | --- | --- |
| **Chip hiện ở mọi proposal cũ vs chỉ proposal cuối** | Nếu render chip dưới mọi `ItineraryPreview` trong lịch sử dài, thread sẽ rất rối và user có thể bấm nhầm vào prompt của proposal cũ. | Chỉ render chip ở **tin nhắn cuối cùng** khi `!isLoading` và có `proposalId` hợp lệ (`index === messages.length - 1 && !isAnyLoading`), tự biến mất ngay khi user gửi câu tiếp theo. |
| **`npm run eval` có nên gộp vào `npm test` trên CI?** | Không nên gộp lời gọi Gemini live vào CI vì tốn quota, chậm (~20–40s) và có thể flaky do mạng hoặc rate limit. | Tách rõ: **`npm test`** (CI) test logic chấm điểm `evaluateGoldenScenario` với fixtures xác định (0ms mạng, 100% deterministic); **`npm run eval`** (chủ động chạy bằng tay trước release/đổi prompt) mới gọi LLM thật. |
| **Live Eval không cần Postgres** | `chat.ts` và `tools/create-trip-proposal.ts` mặc định import `db` từ `src/db/index.ts`, và `config.ts` đòi `AI_DATABASE_URL`. | Eval harness dùng trực tiếp `getSystemPrompt` + định nghĩa tool độc lập không ghi Postgres (`mocked tools` dùng chung `activitySchema` & `normalizeActivityPeriod` & `evaluateSpeculativePrefetchPlan`), giúp chạy eval mọi lúc chỉ với Gemini key. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: `apps/web/tripsense` (Interactive Refinement Chips + i18n + Tests)
1. [apps/web/tripsense/src/locales/en.json](../../apps/web/tripsense/src/locales/en.json) & [vi.json](../../apps/web/tripsense/src/locales/vi.json):
   - Thêm các key `aiPlanner.refinePromptCost`, `aiPlanner.refinePromptFood`, `aiPlanner.refinePromptHotel`, `aiPlanner.refinePromptRelax`, `aiPlanner.refineSuggestionsTitle` (chạy `npm run i18n:sort` giữ đúng A → Z).
2. [apps/web/tripsense/src/components/chat/shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx):
   - Truyền `onQuickReply` callback gọi `sendMessage` xuống `<Messages />`.
3. [apps/web/tripsense/src/components/chat/messages.tsx](../../apps/web/tripsense/src/components/chat/messages.tsx):
   - Nhận `onQuickReply` và truyền `showRefinementChips={status === "ready" && !isLoading && index === messages.length - 1}` cùng `onQuickReply` xuống `<PreviewMessage />`.
4. [apps/web/tripsense/src/components/chat/message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx):
   - Hiển thị cụm 4 chip gợi ý tinh chỉnh (dùng `Suggestion`) ngay dưới `proposalParts` khi `showRefinementChips && readyProposalTitle && onQuickReply`.
   - Cập nhật comparator trong `PreviewMessage = memo(...)` kiểm tra thêm `showRefinementChips` và `onQuickReply`.
5. Component tests trong [apps/web/tripsense/src/components/chat/__tests__/message-recommend-places.test.tsx](../../apps/web/tripsense/src/components/chat/__tests__/message-recommend-places.test.tsx) (hoặc file test mới cho refinement chips).

### Phase 2: `services/ai-service` (Golden Eval Scenarios, Graders & Live Runner)
1. **Tạo `services/ai-service/src/ai/eval/golden-eval.ts`**:
   - Định nghĩa 8 kịch bản chuẩn (`GOLDEN_EVAL_SCENARIOS`).
   - Export `evaluateGoldenScenario(scenario, trace)` kiểm tra chặt: `requiredTools`, `forbiddenTools`, `expectedDurationDays`, `forbidDuplicatePlaceIds`, `requireNoonForLunchSlots`, `forbidLateCheckout`, `forbidMarkdownDayDump`, `dislikedKeywords`, `maxIntroBulletLines`.
   - Export canned Da Nang fixture toolset + runner `runGoldenEval(...)` chạy qua `generateText` / `streamText` không đụng DB.
2. **Tạo `services/ai-service/src/ai/eval/run-golden-eval.ts`** & thêm `"eval": "tsx src/ai/eval/run-golden-eval.ts"` vào `services/ai-service/package.json`.
3. **Tạo `services/ai-service/src/ai/eval/golden-eval.test.ts`** (đăng ký vào `"test"` trong `services/ai-service/package.json`):
   - Test đầy đủ các quy tắc của `evaluateGoldenScenario` (case PASS chuẩn vs các case FAIL vì trùng địa điểm, sai giờ check-out 15:30, thiếu `NOON`, gọi thừa `recommendPlaces`, hoặc vi phạm món ghét).

### Exact Verification Commands

```bash
# 1. AI Service build & unit tests (including golden-eval.test.ts offline graders)
(cd services/ai-service && AI_DATABASE_URL="postgresql://postgres:ci-placeholder@localhost:5432/tripsense_ai" npm test)

# 2. Frontend i18n, type-check, eslint & Vitest chat tests
(cd apps/web/tripsense && npm run i18n:check && npm run type-check && npx eslint src/components/chat/shell.tsx src/components/chat/messages.tsx src/components/chat/message.tsx && npx vitest run src/components/chat/__tests__/message-recommend-places.test.tsx src/components/chat/__tests__/itinerary-preview.test.tsx)

# 3. Optional live Golden Eval run (when GEMINI key / env/.env is present)
# (cd services/ai-service && npm run eval)
```

---

## Human Approval Gate

Approved and implemented on 2026-11-16 (`STATUS: DONE`). Verified with `services/ai-service` `npm test` (64/64 passed) and `apps/web/tripsense` `i18n:check`, `type-check`, targeted ESLint, and chat/i18n Vitest suites (4 files / 15 tests passed). Live `npm run eval` runner is wired and ready for manual runs when API quota is used.
