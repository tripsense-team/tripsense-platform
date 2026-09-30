# AI Chat Trip-Aware Rich Itinerary & Commit Feedback — Specification & Implementation Plan

`STATUS: IMPLEMENTING`

- **Owner Service**: `services/ai-service-v2`
- **Authoritative Trip Owner**: `services/trip-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/ai-service-v2`, `services/trip-service`
- **Created Date**: 2026-09-30
- **Target PR Boundaries**: [Phase 1: Contracts & Ownership Hardening, Phase 2: Transactional Trip Commit, Phase 3: Rich Itinerary Response, Phase 4: Chat–Trip UX & Toast, Phase 5: Verification]

---

## 1. Goal & Requirements

### 1.1 Problem Statement

AI Planner V2 hiện có `createTripProposal` và `ItineraryPreview`, nhưng còn bốn vấn đề:

1. Response lịch trình đang thiên về card preview/artifact, chưa có bố cục đọc nhanh theo ngày, buổi và địa điểm giống ảnh tham chiếu.
2. UI chưa phân biệt được hoạt động nào chỉ là đề xuất và hoạt động nào đã được ghi thật vào trip.
3. Quan hệ giữa chat và trip chưa được lưu bền vững trong `ai-service-v2`; URL `?tripId=` chỉ là state phía client.
4. Endpoint confirm hiện có thể đánh dấu proposal `CONFIRMED` và trả success khi `trip-service` không tạo được trip. Đây là false-success và không được tiếp tục sử dụng.

Mục tiêu là tạo response lịch trình giàu cấu trúc, có dấu tích xanh cho từng mục đã commit, hỗ trợ chat chưa liên kết trip hoặc đã liên kết một trip, và cung cấp toast góc dưới bên phải sau thao tác tạo/thêm thành công.

### 1.2 Domain Invariants

1. Một chat có **0 hoặc 1** `tripId` đang liên kết; một trip có thể được nhiều chat tham chiếu.
2. `trip-service` là nguồn sự thật duy nhất cho trip và itinerary item. `ai-service-v2` chỉ giữ logical ID, không có cross-service foreign key.
3. Dấu tích xanh chỉ hiển thị khi `trip-service` trả commit thành công và itinerary item có `sourceProposalId + sourceItemKey` tương ứng.
4. Text do LLM sinh ra không được dùng để suy luận trạng thái “đã thêm”.
5. Một `proposal item` chỉ được thêm tối đa một lần vào cùng một trip; retry phải trả cùng kết quả qua idempotency.
6. Không đánh dấu proposal/item thành công nếu create/add thất bại hoặc chỉ lưu được cục bộ ở AI DB.
7. Mọi mutation do AI đề xuất cần xác nhận rõ ràng từ người dùng. AI không được tự ý ghi trip chỉ vì đã sinh proposal.
8. Toast chỉ do UI component/mutation coordinator phát một lần sau kết quả thật; API client, service hook và tool không tự phát toast trùng lặp.

### 1.3 User Flows

#### Flow A — Chat chưa liên kết trip

1. Người dùng yêu cầu AI lập lịch trình.
2. `createTripProposal` trả structured proposal; UI render theo ngày/buổi, chưa có dấu tích.
3. UI hiển thị CTA `Tạo trip và thêm lịch trình`.
4. Người dùng xác nhận. `ai-service-v2` gửi signed commit sang `trip-service`.
5. `trip-service` tạo trip + itinerary items trong một transaction, rồi trả item mappings.
6. `ai-service-v2` gắn `chat.tripId`, cập nhật proposal status.
7. Frontend invalidate chat context + trip itinerary, hiện dấu tích xanh và toast góc dưới phải: `Đã tạo chuyến đi và thêm {{count}} hoạt động.`

#### Flow B — Chat đã liên kết trip có sẵn

1. Chat context trả về `tripId` đã được xác thực.
2. Proposal mới hiển thị CTA `Thêm vào {{tripName}}`.
3. Người dùng xác nhận toàn bộ hoặc các mục được chọn.
4. Commit idempotent thêm các item chưa tồn tại; item đã thêm được trả về `SKIPPED_DUPLICATE`.
5. UI hiện dấu tích cho item đã tồn tại/đã thêm và toast: `Đã thêm {{count}} hoạt động vào {{tripName}}.`

#### Flow C — Liên kết chat với trip có sẵn

1. Người dùng chọn trip từ danh sách thuộc quyền đọc/chỉnh sửa của mình hoặc mở workspace với `tripId`.
2. Frontend gọi endpoint link; backend kiểm tra quyền qua `trip-service` trước khi lưu.
3. Nếu chat đã liên kết trip khác, UI phải xác nhận đổi liên kết; backend dùng `expectedTripId` để chống race.
4. Reload hoặc mở lại chat vẫn khôi phục đúng trip đã liên kết.

#### Flow D — Thất bại

- Không hiện dấu tích mới, không hiện success toast.
- UI giữ proposal và nút thử lại.
- Error toast dùng thông điệp đã sanitize: `Không thể cập nhật chuyến đi. Vui lòng thử lại.`
- Với `409 TRIP_VERSION_CONFLICT`, tải lại itinerary và yêu cầu người dùng xác nhận lại.

### 1.4 Rich Response UI

Structured proposal được render bằng component chuyên biệt, không parse Markdown để tìm ngày/địa điểm:

- Day header: icon AI tròn, `Ngày 1 — Chủ đề ngày`.
- Day summary: chữ nghiêng, màu muted.
- Activity rows: icon buổi sáng/chiều/tối, time slot, title/place in đậm, mô tả ngắn.
- Place title có `placeId` là nút mở Place Detail.
- Dấu tích `CircleCheck` dùng semantic `text-primary`, có `aria-label="Đã thêm vào chuyến đi"` và tooltip.
- Separator nhẹ giữa các ngày; tránh lồng quá nhiều card/border.
- Streaming state dùng skeleton/shimmer; generic answer vẫn dùng renderer Markdown hiện tại.
- Responsive: một cột trên mobile; không tạo horizontal scroll cho nội dung lịch trình.

### 1.5 Scope Boundaries

**In-Scope**

- Rich itinerary renderer cho output `createTripProposal`.
- Stable `itemKey` cho từng activity.
- Persistent chat–trip mapping 0..1.
- Tạo trip mới + commit proposal hoặc thêm proposal vào trip đang liên kết.
- Item-level committed state và blue check sau reload.
- Bottom-right toast cho create/add success và error đã sanitize.
- Ownership, idempotency, optimistic concurrency và false-success remediation.
- i18n đầy đủ `aiPlanner`/`trip` cho `en.json` và `vi.json`.

**Out-of-Scope**

- Cho phép một chat map đồng thời nhiều trip.
- AI tự commit không cần xác nhận người dùng.
- Booking/payment, tự động đặt khách sạn/vé.
- Đồng bộ realtime đa người dùng qua Kafka/WebSocket; phiên đầu dùng refetch sau mutation.
- Thay đổi AI Planner V1.

### 1.6 Acceptance Criteria

- [ ] AC-1: Proposal hiển thị theo ngày/buổi với typography, spacing và hierarchy tương tự ảnh tham chiếu.
- [ ] AC-2: Activity chỉ có dấu tích xanh khi tồn tại trong itinerary của trip liên kết với cùng `sourceProposalId + sourceItemKey`.
- [ ] AC-3: Reload chat vẫn giữ đúng `tripId` và trạng thái tick.
- [ ] AC-4: Chat chưa map trip có thể tạo trip + itinerary atomically; chat được map với trip mới sau thành công.
- [ ] AC-5: Chat đã map trip có thể thêm proposal idempotently vào trip đó.
- [ ] AC-6: Retry cùng idempotency key không tạo item trùng.
- [ ] AC-7: Create/add thất bại không cập nhật tick/status thành công và không phát success toast.
- [ ] AC-8: Toast xuất hiện góc dưới bên phải đúng một lần, có action `Xem chuyến đi`.
- [ ] AC-9: Người dùng không thể link/apply proposal của chat khác hoặc trip không có quyền chỉnh sửa.
- [ ] AC-10: Chat thường, search places, weather và AI Planner V1 không regress.

---

## 2. Architecture & Service Boundaries

### 2.1 Data Flow

```text
[Web Rich Itinerary]
   │  POST /api/ai/v2/proposals/{id}/apply (user JWT, Idempotency-Key)
   ▼
[API Gateway]
   ▼
[ai-service-v2]
   ├─ validates chat + proposal ownership
   ├─ reads chat.tripId (nullable)
   ├─ creates canonical proposal hash + signed commit proof
   │
   └── sync internal REST ──► [trip-service]
                              ├─ validates user edit access
                              ├─ validates signature, TTL, hash, idempotency
                              ├─ CREATE_TRIP or ADD_TO_TRIP transaction
                              └─ returns per-item commit results
   │
   ├─ updates chat mapping/proposal status after trip commit
   ▼
[Web invalidates chat-context + itinerary]
   ├─ renders authoritative blue checks
   └─ emits one bottom-right toast
```

Synchronous REST được chọn vì người dùng cần kết quả ngay để cập nhật tick/toast. Không dùng Kafka cho command path này; event analytics/audit có thể bổ sung sau.

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| `apps/web/tripsense` | Render rich proposal, confirm action, refetch authoritative state, toast duy nhất |
| `api-gateway` | JWT validation, routing, rate limiting, trusted identity headers |
| `ai-service-v2` | Chat/proposal ownership, chat–trip logical mapping, canonical proposal hash, signed commit orchestration |
| `trip-service` | Trip authorization, transaction, itinerary item persistence, deduplication, revisions |

### 2.3 Guardrails

- Không query database chéo và không tạo cross-service JPA/Drizzle relationship.
- `chats.trip_id` và `itinerary_items.source_proposal_id` chỉ là opaque logical IDs.
- Public frontend gọi qua Gateway. Internal commit endpoint không expose thành browser route.
- AI output hỗ trợ quyết định/rendering; quyền ghi, dedupe, revision và commit là deterministic business rules.

---

## 3. API & Tool Contracts

### 3.1 Extend Chat DTO

`GET /api/ai/v2/chats` thêm trường nullable:

```json
{
  "id": "chat-uuid",
  "title": "Khám phá Khe Sanh",
  "tripId": "trip-uuid-or-null",
  "tripLinkedAt": "2026-09-30T08:00:00Z"
}
```

`POST /api/ai/v2/chat` không tin `tripId` tùy ý từ request. Service lấy mapping từ DB theo `chatId`. Request có `tripId` chỉ được dùng như link hint lần đầu và phải qua cùng ownership validation.

### 3.2 Chat–Trip Context

| Method | Gateway Path | Description |
| --- | --- | --- |
| `GET` | `/api/ai/v2/chats/{chatId}/context` | Trả chat mapping, trip summary và committed source refs |
| `PUT` | `/api/ai/v2/chats/{chatId}/trip` | Link/relink chat với trip đã có quyền edit |
| `DELETE` | `/api/ai/v2/chats/{chatId}/trip` | Unlink; không xoá trip hoặc itinerary |

```json
// PUT request
{
  "tripId": "trip-uuid",
  "expectedTripId": null
}

// context response
{
  "chatId": "chat-uuid",
  "trip": {
    "id": "trip-uuid",
    "name": "Khe Sanh 3 ngày",
    "revision": 4
  },
  "committedSourceRefs": [
    { "proposalId": "proposal-uuid", "itemKey": "activity-uuid", "itineraryItemId": "item-uuid" }
  ]
}
```

Responses: `401` unauthenticated mutation, `403` no edit access, `404` owned chat/trip not found, `409 CHAT_TRIP_LINK_CONFLICT` on stale `expectedTripId`.

### 3.3 Apply Proposal

`POST /api/ai/v2/proposals/{proposalId}/apply`

Headers:

- `Authorization: Bearer <JWT>`
- `Idempotency-Key: <uuid>`

```json
{
  "chatId": "chat-uuid",
  "action": "CREATE_TRIP",
  "selectedItemKeys": ["activity-uuid"],
  "expectedTripRevision": null,
  "tripDraft": {
    "startDate": "2026-10-10",
    "endDate": "2026-10-12",
    "travelerCount": 2,
    "budgetAmount": null,
    "budgetCurrency": "VND"
  }
}
```

- `action`: `CREATE_TRIP | ADD_TO_LINKED_TRIP`.
- `tripDraft` bắt buộc với create; target trip luôn lấy từ `chat.tripId` với add, không nhận arbitrary target từ client.
- `selectedItemKeys` omitted nghĩa là apply toàn bộ item chưa commit.

```json
// 200 response
{
  "operationId": "receipt-uuid",
  "status": "APPLIED",
  "action": "ADD_TO_LINKED_TRIP",
  "chatId": "chat-uuid",
  "tripId": "trip-uuid",
  "tripName": "Khe Sanh 3 ngày",
  "tripRevision": 5,
  "appliedCount": 3,
  "skippedCount": 1,
  "items": [
    {
      "itemKey": "activity-uuid",
      "itineraryItemId": "item-uuid",
      "status": "APPLIED"
    }
  ]
}
```

Error codes: `PROPOSAL_NOT_FOUND`, `PROPOSAL_OWNERSHIP_DENIED`, `CHAT_TRIP_REQUIRED`, `TRIP_VERSION_CONFLICT`, `INVALID_PROPOSAL_ITEM`, `TRIP_COMMIT_UNAVAILABLE`.

### 3.4 Internal Trip Commit Contract

`POST /internal/ai/itinerary-commits` — direct service-to-service, not Gateway-public.

- Forward user Bearer JWT for trip authorization.
- `X-AI-Commit-Timestamp` + `X-AI-Commit-Signature` (HMAC-SHA256 over timestamp, userId, idempotency key and canonical body hash).
- Reject signature older than 5 minutes and replay with different payload.

Request contains `action`, nullable `targetTripId`, `tripDraft`, `proposalId`, `proposalHash`, `expectedTripRevision`, and normalized operations carrying `sourceItemKey`.

Trip-service response must return item-level results. This replaces the current false-success confirm path and unlocks the existing batch service only after immutable proposal proof is enforced.

### 3.5 Tool Contract

`createTripProposal` remains non-mutating, but output is extended:

```ts
type ProposalActivity = {
  itemKey: string; // UUID generated by tool executor, never by LLM
  period: "MORNING" | "AFTERNOON" | "EVENING" | "FLEXIBLE";
  timeSlot: string;
  title: string;
  description: string;
  placeId?: string;
  address?: string;
  category?: "ATTRACTION" | "FOOD" | "CAFE" | "STAY" | "ACTIVITY";
  estimatedCost?: string;
};
```

Nếu người dùng gõ “hãy tạo/thêm vào trip”, AI có thể trả `tool-requestTripCommit` để mở confirmation state. Actual write chỉ chạy sau user confirmation qua apply endpoint; không cho model tự gọi mutation tool không có approval token.

---

## 4. Data Model & Migrations

### 4.1 `ai-service-v2` / Drizzle

```sql
ALTER TABLE tripsense_ai_v2.chats
  ADD COLUMN trip_id UUID NULL,
  ADD COLUMN trip_linked_at TIMESTAMPTZ NULL;

CREATE INDEX idx_ai_v2_chats_user_trip
  ON tripsense_ai_v2.chats(user_id, trip_id)
  WHERE trip_id IS NOT NULL;

ALTER TABLE tripsense_ai_v2.proposals
  ADD COLUMN applied_trip_id UUID NULL,
  ADD COLUMN applied_at TIMESTAMPTZ NULL,
  ADD COLUMN proposal_hash VARCHAR(64) NULL;
```

Proposal status được chuẩn hóa: `PENDING | PARTIALLY_APPLIED | APPLIED | FAILED`. Activity `itemKey` nằm trong immutable `itinerary_json`; proposal hash được tính sau khi normalize và trước khi persist.

Không FK `trip_id`/`applied_trip_id` sang DB của `trip-service`.

### 4.2 `trip-service` / Flyway

Migration dự kiến: `V202609301600__add_ai_itinerary_source_refs.sql`.

```sql
ALTER TABLE itinerary_items
  ADD COLUMN source_kind VARCHAR(30) NULL,
  ADD COLUMN source_proposal_id UUID NULL,
  ADD COLUMN source_item_key UUID NULL;

CREATE UNIQUE INDEX uq_itinerary_ai_source
  ON itinerary_items(trip_id, source_proposal_id, source_item_key)
  WHERE source_kind = 'AI_PROPOSAL'
    AND source_proposal_id IS NOT NULL
    AND source_item_key IS NOT NULL;

CREATE INDEX idx_itinerary_ai_proposal
  ON itinerary_items(trip_id, source_proposal_id)
  WHERE source_proposal_id IS NOT NULL;
```

`ItineraryItemResponse` thêm `sourceKind`, `sourceProposalId`, `sourceItemKey`. Existing rows giữ null, backward compatible.

### 4.3 Transaction & Rollback

- `CREATE_TRIP`: tạo Trip, ItineraryDay, items và receipt trong **một trip-service transaction**.
- `ADD_TO_TRIP`: lock trip, kiểm tra `aggregateRevision`, validate toàn bộ operations, ghi items + receipt trong một transaction.
- Unique source index là lớp chống duplicate cuối cùng.
- Rollback migration chỉ drop indexes/nullable columns sau khi app version cũ không còn đọc fields mới; không tự động xoá receipt hoặc trip data đã tạo.

---

## 5. Security & Trust Boundaries

| Risk | Required Mitigation |
| --- | --- |
| IDOR chat/messages/proposal | Mọi query phải scope cả resource ID và `userId`; không chỉ query theo UUID như route hiện tại |
| Link trip không thuộc user | `trip-service` xác minh edit access trước khi AI DB lưu mapping |
| Client giả `X-User-Id` | Production chỉ nhận identity header từ Gateway; mutation bắt buộc Bearer JWT, direct port không public |
| Model tự ghi dữ liệu | Mutation requires explicit confirmation/approval token; tool output một mình không đủ quyền |
| Giả mạo proposal | Signed canonical proposal hash, timestamp TTL, server-side secret |
| Replay/duplicate | `Idempotency-Key`, commit receipt và unique source reference |
| Stale concurrent edit | `expectedTripRevision`; trả 409 và refetch |
| Error leakage | Không trả `err.message`, SQL/JDBC/stack trace; map sang safe error code/message |
| Toast duplication | Chỉ mutation coordinator/UI gọi toast; dùng `operationId` làm Sonner toast id |

Guest vẫn có thể chat theo policy hiện tại nhưng không được link/create/add trip.

---

## 6. Devil's Advocate & Technical Trade-offs

| Decision | Risk / Alternative | Resolution |
| --- | --- | --- |
| One chat → max one trip | Multi-trip chat linh hoạt hơn nhưng state/tick mơ hồ | Chọn 0..1 như yêu cầu; mở feature khác nếu cần multi-trip |
| Structured renderer | Parse Markdown nhanh hơn | Reject parse Markdown vì không có stable IDs và không thể chứng minh commit state |
| Confirm before write | Auto tool call nhanh hơn một click | Chọn confirmation để tránh LLM tạo trip ngoài ý muốn; explicit prompt mở confirmation nhanh |
| Sync REST commit | Kafka chịu lỗi tốt hơn | Chọn REST vì UI cần immediate result; idempotency xử lý retry |
| Source refs trong trip-service | Chỉ lưu commit flags tại AI DB đơn giản hơn | Chọn trip-service authoritative để tick không nói dối khi reload/dedupe |
| Atomic create + items | Gọi create rồi add dễ tái sử dụng endpoint | Chọn một transaction để không tạo trip rỗng khi batch fail |
| Refetch after commit | Optimistic tick cảm giác nhanh hơn | Không optimistic check; chỉ shimmer pending rồi tick sau server success |

### Failure Scenarios

- Trip commit success nhưng AI DB update mapping tạm fail: retry apply dùng receipt trả same trip/result, sau đó repair mapping; không tạo trip thứ hai.
- AI DB says linked nhưng trip bị archive/quyền bị thu hồi: context endpoint trả `STALE_LINK`, UI gỡ active state sau xác nhận, không tự xoá mapping âm thầm.
- Một số selected items đã tồn tại: trả `SKIPPED_DUPLICATE`, vẫn tick; toast báo số item mới thực sự thêm.
- Proposal có `placeId` không hợp lệ: fail toàn transaction hoặc loại item trước confirmation với inline validation; không partial silent failure.

---

## 7. Frontend UX & Feedback

### 7.1 Components

- New `rich-trip-proposal.tsx`: day/period layout và item-level checks.
- Extend `PreviewMessage` tool renderer để dùng structured component.
- `useChatTripContext(chatId)`: query mapping + authoritative committed refs.
- `useApplyTripProposal()`: mutation, query invalidation, sanitized errors; không tự toast.
- UI coordinator trong chat workspace phát toast và cập nhật Trip Detail Panel.
- Add root `Toaster` from Sonner với `position="bottom-right"`, theme-aware, close button; không thêm dependency mới vì `sonner` đã có.

### 7.2 Feedback Rules

| State | UI |
| --- | --- |
| Proposal only | Không tick; CTA create/add |
| Applying | CTA disabled + spinner; item chưa tick |
| Applied | Blue semantic check per item + success toast once |
| Duplicate/replay | Tick theo authoritative state; không spam toast nếu cùng `operationId` đã hiển thị |
| Failed | Inline retry state + one sanitized error toast |

Toast examples (i18n):

- VI create: `Đã tạo chuyến đi và thêm {{count}} hoạt động.`
- VI add: `Đã thêm {{count}} hoạt động vào {{tripName}}.`
- EN create: `Trip created with {{count}} activities.`
- EN add: `Added {{count}} activities to {{tripName}}.`
- Action: `Xem chuyến đi` / `View trip`.

---

## 8. Phased Implementation Tasks & Verification

### Phase 1 — Contracts, Schema & Ownership Hardening

- [x] Add versioned Drizzle migration for nullable chat mapping and proposal apply metadata.
- [x] Add Flyway migration for itinerary source refs and indexes.
- [x] Add stable activity `itemKey`, proposal normalization and SHA-256 hash.
- [x] Scope all chat/message/proposal/vote routes by authenticated user; sanitize errors.
- [x] Add chat context link/unlink endpoints and API Gateway contracts.

### Phase 2 — Transactional Commit

- [x] Implement signed internal commit verifier in `trip-service`.
- [x] Extend `ItineraryBatchOperation/Response` with `sourceItemKey` and item results.
- [x] Implement atomic `CREATE_TRIP` and revision-checked `ADD_TO_TRIP` paths.
- [x] Implement AI apply endpoint with idempotency/recovery after partial cross-service response loss.
- [x] Remove false-success fallback from current proposal confirm endpoint; keep compatibility route as deprecated adapter returning real failure.

### Phase 3 — Rich Itinerary Response

- [x] Implement structured day/period renderer matching reference hierarchy.
- [ ] Add place interactions, accessible check indicator, loading and retry states.
- [x] Preserve generic Markdown renderer for non-proposal answers.
- [x] Add responsive and dark-mode styling using semantic theme tokens.

### Phase 4 — Chat–Trip UX & Toast

- [x] Persist/restore linked trip when opening chat or switching history.
- [x] Add create/add confirmation flow; explicit trip selection links only an unlinked chat and does not silently relink.
- [x] Refetch itinerary/context after commit and update Trip Detail Panel.
- [x] Configure root Sonner toaster bottom-right and emit exactly one operation-scoped toast.
- [x] Add `aiPlanner` i18n keys with EN/VI schema parity.

### Phase 5 — Tests & Reviews

- [ ] AI service tests: ownership, link conflicts, proposal hashing, apply idempotency, downstream failure, recovery.
- [ ] Trip service unit/integration tests: signature/TTL, IDOR, atomic rollback, revision conflict, duplicate source refs, per-item response.
- [x] Frontend API tests for context, link, idempotency and sanitized failures; full web suite passes.
- [ ] E2E flows: no trip → create; linked trip → add; retry; stale revision; unauthorized trip; archived trip.
- [x] Architecture, database, security and PR-ready reviews completed; no open merge-blocking source finding.

### Verification Commands

```bash
# AI service
cd services/ai-service-v2
npm run build
npm test

# Trip service
cd services/trip-service
./mvnw test

# Web
cd apps/web/tripsense
npm run i18n:check
npm run lint
npm run type-check
npm test
npm run build
```

---

## 9. Approval Decisions Captured

Human đã xác nhận đầy đủ các quyết định sau vào ngày 2026-09-30:

1. Một chat map tối đa một trip.
2. Rich response dùng structured proposal, không parse Markdown.
3. Dấu tích chỉ dựa trên trip-service source refs.
4. Create/add cần confirmation trước mutation; AI không tự ghi trip âm thầm.
5. Toast bottom-right chỉ sau server success, có action mở trip.
6. Commit create trip + items phải atomic và add phải idempotent.

## Human Approval

```text
STATUS: IMPLEMENTING
```

Implementation đã hoàn tất trong source và vượt qua build/type-check/web tests cùng targeted trip-service security tests. Full trip-service Testcontainers suite còn chờ môi trường Docker để xác minh trước khi chuyển `DONE`.
