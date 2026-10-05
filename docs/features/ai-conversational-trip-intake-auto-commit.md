# AI Conversational Trip Intake & Trusted Auto-Commit — Specification & Implementation Plan

`STATUS: APPROVED` (Phase 6 Interactive Token-Efficient Intake Approved)

- **Owner Service**: `services/ai-service`
- **Authoritative Trip Owner**: `services/trip-service`
- **Authoritative Place Owner**: `services/place-service`
- **Affected Components**: `apps/web/tripsense`, `services/api-gateway`, `services/ai-service`, `services/trip-service`, `services/place-service`
- **Created Date**: 2026-09-30
- **Revised Date**: 2026-09-30
- **Related Plans**: `ai-chat-trip-aware-rich-itinerary`, `ai-chat-mindtrip-experience-enhancement`

---

## 1. Goal & Requirements

### 1.1 Problem

AI Planner hiện có thể tạo lịch trình khi chưa đủ **Where, When, Who, Budget**. Bốn chip ở header chỉ là React state cục bộ, không đi vào AI context và mất sau reload. Kết quả cũng có thể hiển thị tick xanh dù địa điểm chưa được lưu thật.

Flow đích:

1. Chỉ bắt đầu intake khi user thể hiện rõ ý định lập kế hoạch/tạo chuyến đi.
2. Trích xuất dữ kiện user đã nói và chỉ hỏi trường còn thiếu theo `Where → When → Who → Budget`.
3. Khi đủ bốn trường, Trip Service lập tức tạo một `Trip` trạng thái `DRAFT` và AI Service liên kết `chat.tripId`.
4. AI dùng dữ kiện của Trip làm context, chỉ tìm địa điểm canonical từ Place Service, tạo proposal và tự thêm itinerary vào chính trip vừa liên kết.
5. Không yêu cầu user xác nhận proposal lần hai trong flow intake đã được ủy quyền.
6. Tick xanh chỉ xuất hiện sau khi Trip Service xác nhận item đã được commit.

### 1.2 UX Decision — Adaptive, Not Four Rigid Turns

- `“Lên lịch Đà Nẵng 10–12/10 cho 2 người, tổng 8 triệu”` có thể hoàn tất intake trong một lượt.
- Nếu thiếu, assistant hiển thị một **interactive intake card** trong cùng response; card chuyển câu hỏi cục bộ theo `Where → When → Who → Budget`, không tạo một assistant response/model call mới cho từng field.
- Mỗi field có quick choices phù hợp và `Other/Tùy chỉnh`: destination search/chips, date presets/date picker, traveler presets/counters, flexible/preset/custom budget.
- User vẫn có thể gõ câu trả lời tự do trong chat; server merge tất cả field trích xuất được như flow hiện tại.
- Quick-choice interaction gọi trực tiếp owned `PATCH planning-brief`, không gửi câu trả lời giả vào chat và không gọi LLM. Mỗi patch được persist để reload không mất tiến độ.
- Khi field cuối hoàn tất và Trip được link, frontend chỉ tạo một continuation turn để AI bắt đầu tìm địa điểm/lập lịch trình.
- Khi đủ dữ kiện, UI chuyển qua `Đang tạo chuyến đi → Đang tìm địa điểm → Đang lưu lịch trình`.
- Không phát toast cho từng field; chỉ dùng inline state. Chỉ phát toast khi trip được tạo hoặc itinerary được lưu/thất bại.

#### Quick-choice behavior

| Field | Quick choices | `Other/Tùy chỉnh` | Data source / normalization |
| --- | --- | --- | --- |
| Where | Destination đã trích xuất, recent/platform destinations | Search/input địa điểm | Place Service/platform data only; không sinh địa điểm bằng model |
| When | Cuối tuần này, cuối tuần sau, chọn ngày | Date range picker | Client converts presets to exact ISO dates; server validates range |
| Who | Một mình, cặp đôi, gia đình, nhóm | Adult/child/infant/pet counters | Maps to the existing `who` object; no implicit saved default |
| Budget | Linh hoạt, preset amounts appropriate to locale/currency | Amount + currency input | Maps only to `FLEXIBLE` or `TOTAL`; server validates amount/currency |

The card may visually show one question at a time, but it is one persisted UI component rather than four AI messages. Back/edited answers use optimistic UI plus versioned PATCH and never consume model tokens.

### 1.3 Required Fields and Ownership

| Field | Temporary chat representation | Authoritative Trip representation | Completion rule |
| --- | --- | --- | --- |
| Where | `destinationText`, optional canonical ref | `destinationName`, optional `destinationPlaceId`/`destinationPlaceRef` | Tên thành phố/khu vực không rỗng |
| When | `startDate`, `endDate` | `startDate`, `endDate` | Ngày cụ thể và `startDate <= endDate` |
| Who | `adults`, `children`, `infants`, `pets` | `travelerCount` | Tổng người từ 1–100; không mặc định là đã trả lời |
| Budget | `FLEXIBLE` hoặc `TOTAL(amount,currency)` | `budgetAmount`, `budgetCurrency`; flexible = null amount | Amount không âm, currency ISO-4217 |

`travelerCount = adults + children + infants`. Cơ cấu người và pets là planning context trong chat vì Trip hiện chỉ lưu tổng số người. Nếu sau này cần báo cáo/đặt dịch vụ theo cơ cấu này, đó là một migration riêng thuộc Trip Service.

Trip Service yêu cầu ngày cụ thể. User chỉ nói tháng hoặc “linh hoạt ngày” vẫn nhận tư vấn nhưng chưa được xem là complete để tự tạo trip.

### 1.4 Consent Without a Second Confirmation

- User message rõ ràng như `lên lịch trình`, `tạo chuyến đi`, `plan a trip` tạo one-run authorization gắn với `chatId + userId + intentMessageId`.
- User tiếp tục trả lời intake nghĩa là tiếp tục yêu cầu đó; không cần nút Apply lần hai.
- Câu hỏi tư vấn chung như `Đà Nẵng có gì?` không tạo authorization.
- `hủy`, `dừng`, `để sau` sẽ revoke authorization trước mutation tiếp theo.
- Model chỉ đề xuất intent/slot; server quyết định completeness, authorization, trạng thái mutation và idempotency.
- Manual proposal flow hiện tại vẫn giữ CTA xác nhận.

### 1.5 Main Flows

#### A. Authenticated + chat chưa liên kết trip

1. Server nhận explicit planning intent và append một `data-tripBrief` part vào message history.
2. Nếu còn thiếu field, Web hiển thị một progressive intake card từ structured state; lựa chọn/custom input PATCH trực tiếp và append snapshot mới mà không gọi model.
3. Khi đủ bốn field, server gọi signed idempotent `CREATE_TRIP` với item list rỗng; Trip Service tạo `DRAFT` và receipt trong cùng transaction.
4. AI Service CAS-link `chat.tripId`; response/header chuyển sang đọc dữ liệu authoritative của trip.
5. Web gửi một continuation turn; AI tìm địa điểm canonical, tạo immutable proposal và gọi `ADD_TO_TRIP` để lưu itinerary.
6. Web refetch trip/context, hiển thị tick xanh cho item đã commit và toast có action `Xem chuyến đi`.

#### B. Trả lời nhiều field trong một câu

Server merge tất cả field hợp lệ trong một lượt. Nếu complete thì tự chạy bước tạo trip ngay, không hỏi lại field đã có.

#### C. Chat đã liên kết trip

- Header và planning context lấy từ Trip Service.
- Nếu user muốn thêm lịch trình tương thích, commit `ADD_TO_TRIP` idempotently.
- Nếu destination/date mâu thuẫn, AI hỏi một câu để user chọn tiếp tục trip hiện tại hay tạo một chat/trip mới; không âm thầm relink hoặc sửa metadata.

#### D. Guest

Guest được tư vấn chung nhưng phải đăng nhập trước khi lưu intake có authorization hoặc tạo trip. Không persist mutable state dưới shared owner `guest`.

#### E. Failure and Recovery

- Tạo trip thành công nhưng Place Service không đủ dữ liệu: giữ DRAFT đã liên kết, không bịa place; UI cho Retry/đổi tiêu chí.
- Itinerary commit lỗi: không tick item và không phát success toast; retry dùng cùng idempotency key.
- Trip tạo thành công nhưng AI DB link lỗi: replay receipt và CAS-link lại, không tạo trip thứ hai.
- Reload: latest `data-tripBrief`/`data-tripAutoCommit` part khôi phục tiến độ; nếu đã có `chat.tripId`, Trip Service là nguồn dữ liệu chuẩn.

### 1.6 Domain Invariants

1. Một chat có tối đa một linked trip.
2. Trip Service sở hữu trip/itinerary; Place Service sở hữu place facts; AI Service chỉ sở hữu chat, message và orchestration context.
3. Không có bảng `trip_planning_intakes`; không sao chép dữ liệu Trip vào AI DB sau khi đã link.
4. Trước khi trip tồn tại, partial brief là structured chat state append-only; sau khi link, Trip Service thắng mọi xung đột.
5. `PLACE`, `MEAL`, `HOTEL` bắt buộc canonical `placeRef`; logistics/note mới được null.
6. Search chỉ dùng canonical `p.id`, không fallback `providerPlaceId`; rating/address thiếu phải là `null`.
7. Tick chỉ dựa trên commit result/committed refs từ Trip Service, không dựa vào Markdown/prompt.
8. Tạo trip và thêm itinerary đều idempotent; reload/retry không tạo duplicate.
9. Trip được tạo ngay khi brief complete; planning lỗi không rollback/xóa trip của user.

### 1.7 Scope

**In scope**: adaptive intake, persisted structured brief, immediate DRAFT creation after field four, chat-trip link, canonical retrieval, automatic add-to-trip, real committed ticks, retry/cancel, EN/VI, mobile/responsive web.

**Out of scope**: booking/payment, nhiều trip trong một chat, tự sửa metadata của linked trip khi conflict, detailed traveler schema trong Trip, route-time guarantees, guest mutation, thay thế manual proposal flow.

### 1.8 Acceptance Criteria

- [ ] AC-1: Explicit intent starts intake; general advice never creates trip.
- [ ] AC-2: AI asks only missing fields and accepts multi-field answers.
- [ ] AC-3: Partial brief/header survives reload and chat switching without a new intake table.
- [ ] AC-4: User can cancel before complete with no trip created.
- [ ] AC-5: Complete intake immediately creates exactly one DRAFT and links it to chat.
- [ ] AC-6: Trip fields match Where/When/Who/Budget supplied by user.
- [ ] AC-7: Planning starts automatically after link without a second confirmation.
- [ ] AC-8: Place-like items use only canonical Place Service records.
- [ ] AC-9: Place shortage/outage never creates fabricated place, address, rating or fake tick.
- [ ] AC-10: A planning failure leaves the linked DRAFT recoverable and retryable.
- [ ] AC-11: Blue ticks appear only after authoritative item commit and survive reload.
- [ ] AC-12: Retry/concurrency creates no duplicate trip/item.
- [ ] AC-13: Guest is authenticated before mutation.
- [ ] AC-14: Errors are sanitized/localized and preserve retry state.
- [ ] AC-15: Existing chat/weather/search/manual proposal flows do not regress.
- [ ] AC-16: A missing-field intake renders one interactive card with quick choices and `Other/Tùy chỉnh` instead of a new AI message per field.
- [ ] AC-17: Selecting or editing a card answer persists through the planning-brief API without invoking the LLM or adding a synthetic user chat message.
- [ ] AC-18: Completing all fields from the card creates/links exactly one DRAFT and triggers only one continuation turn for itinerary generation.
- [ ] AC-19: Keyboard navigation, mobile layout, EN/VI labels and inline validation work for every choice/custom-input control.

---

## 2. Architecture & Service Boundaries

### 2.1 Data Flow

```text
[Web] --JWT/SSE--> [API Gateway] --> [AI Planning Coordinator]
  └─ interactive card --versioned PATCH (no LLM)---┘
                                         ├─ append structured brief --> AI messages JSONB
                                         ├─ signed CREATE_TRIP ------> [Trip Service]
                                         │                              └─ DRAFT + receipt
                                         ├─ CAS link chat.tripId
                                         ├─ canonical search --------> [Place Service]
                                         └─ signed ADD_TO_TRIP ------> [Trip Service]
                                                                        └─ items + receipt
[Web] <-- brief/trip context + authoritative commit results -- refetch
```

Synchronous REST is justified because this is a user-facing flow needing immediate feedback. Kafka does not control commit success. Không service nào truy cập DB của service khác và không có cross-service JPA relation.

### 2.2 Ownership

| Component | Responsibility |
| --- | --- |
| Web | Stateful intake card, quick choices/custom inputs, versioned direct PATCH, progress/cancel/retry, rendering committed checks |
| API Gateway | JWT, route public traffic, rate limiting, trusted identity |
| AI Service | Intent/slot extraction, structured chat-state snapshots, orchestration, proposal generation, signed calls, `chat.tripId` |
| Place Service | Canonical search/snapshots and place evidence |
| Trip Service | Trip lifecycle, authoritative brief fields, membership/permission, itinerary transaction, dedupe receipts |

### 2.3 State Without `trip_planning_intakes`

Before a trip exists, the latest structured snapshot in message parts represents the active run:

```text
IDLE -> COLLECTING -> READY -> CREATING_TRIP -> TRIP_LINKED
COLLECTING -> CANCELLED
TRIP_LINKED -> PLANNING -> COMMITTING -> COMPLETED
PLANNING/COMMITTING -> FAILED_RETRYABLE -> PLANNING
```

Each snapshot contains `runId`, `intentMessageId`, normalized brief, missing fields, status, version and safe error code. Server validates transitions and appends the next snapshot. The LLM cannot set `CREATING_TRIP`, `TRIP_LINKED`, `COMMITTING` or `COMPLETED`.

Once `chat.tripId` exists, Trip Service fields are authoritative. Structured parts remain an audit/recovery trail, not a second business record.

---

## 3. API, Message and Tool Contracts

### 3.1 Public via Gateway

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ai/v2/chats/{chatId}/planning-brief` | Return latest structured brief plus authoritative trip fields when linked |
| PATCH | `/api/ai/v2/chats/{chatId}/planning-brief` | Validate a chip edit and append a new brief snapshot |
| POST | `/api/ai/v2/chats/{chatId}/planning-brief/cancel` | Append cancellation/revoke snapshot before mutation |
| POST | `/api/ai/v2/chats/{chatId}/planning-brief/retry` | Resume the current run with deterministic idempotency keys |

All endpoints require JWT and owned chat. PATCH accepts `{ expectedVersion, patch }`; stale version returns `BRIEF_VERSION_CONFLICT`.

The existing PATCH contract accepts one or several fields in the same request. Interactive-card selections use this endpoint directly and do not call `POST /chat`. No new public endpoint is required.

```json
{
  "chatId": "uuid",
  "runId": "uuid",
  "version": 3,
  "status": "COLLECTING",
  "brief": {
    "where": { "destinationText": "Đà Nẵng", "destinationPlaceRef": null },
    "when": { "startDate": "2026-10-10", "endDate": "2026-10-12" },
    "who": { "adults": 2, "children": 1, "infants": 0, "pets": 0 },
    "budget": { "mode": "TOTAL", "amount": 8000000, "currency": "VND" }
  },
  "missingFields": [],
  "tripId": null,
  "safeErrorCode": null
}
```

### 3.2 Chat/SSE Parts

`POST /api/ai/v2/chat` loads the latest snapshot from recent owned-chat messages, extracts candidates from the newest user message, validates/merges, persists the next snapshot and supplies it to the model.

When `updateTripPlanningBrief` returns `COLLECTING`, the stream exposes the structured state and stops before generating a prose follow-up question. Web renders the card from that state. On reload, Web restores the same card from `GET planning-brief`. When the tool returns `TRIP_LINKED`, normal tool orchestration continues or the card completion sends one continuation turn.

```ts
type TripBriefPart = {
  type: "data-tripBrief";
  runId: string;
  intentMessageId: string;
  version: number;
  status:
    | "COLLECTING" | "READY" | "CREATING_TRIP" | "TRIP_LINKED"
    | "PLANNING" | "COMMITTING" | "COMPLETED"
    | "FAILED_RETRYABLE" | "CANCELLED";
  brief: TripPlanningBrief;
  missingFields: ("WHERE" | "WHEN" | "WHO" | "BUDGET")[];
  nextQuestion?: "WHERE" | "WHEN" | "WHO" | "BUDGET";
  tripId?: string;
  safeErrorCode?: string;
};

type TripAutoCommitPart = {
  type: "data-tripAutoCommit";
  runId: string;
  operation: "CREATE_TRIP" | "ADD_TO_TRIP";
  status: "PENDING" | "APPLIED" | "FAILED_RETRYABLE";
  operationId?: string;
  tripId?: string;
  proposalId?: string;
  committedItemKeys?: string[];
  safeErrorCode?: string;
};
```

### 3.3 Signed Trip Mutation Contract

Reuse `POST /internal/ai/itinerary-commits` and its HMAC/idempotency receipt. Contract changes:

- `CREATE_TRIP` allows `items: []` only for a complete authorized brief. `proposalId = runId`, `proposalHash = SHA-256(canonical brief)`.
- Trip Service creates the DRAFT and receipt atomically, returning `tripId`, even when applied item count is zero.
- `ADD_TO_TRIP` continues to require at least one item and uses the verified proposal ID/hash.
- Conditional validation is deterministic server code; annotations alone must not permit invalid action/payload combinations.
- The `CREATE_TRIP` idempotency key is deterministic from `chatId + operation`, so concurrent intake turns for one chat converge on one receipt. `ADD_TO_TRIP` uses `chatId + proposalId + operation`; same key/different body returns conflict.

This avoids a second trip-creation API and reuses the existing signed trust boundary and receipt table.

### 3.4 Place and Proposal Rules

- Reuse `GET /api/places/search` and `POST /api/places/batch-snapshots`.
- Only canonical `p.id` becomes `placeRef`.
- Missing batch IDs fail proposal verification.
- Place visible facts are replaced by Place Service snapshot facts.
- Missing rating/address remains null; never default rating to `4.5`.
- Manual `POST /api/ai/v2/proposals/{id}/apply` remains unchanged for non-intake flows.

---

## 4. Data Model & Migrations

### 4.1 AI Service

No new table and no AI migration.

- Reuse `messages.parts JSONB` for append-only `data-tripBrief` and `data-tripAutoCommit` snapshots.
- Reuse `chats.trip_id` and `chats.trip_linked_at` for the one authoritative link.
- Latest snapshot lookup is scoped by `chat_id`, ordered by message creation/id descending and bounded; do not scan all user messages or another user's chat.
- After link, do not mirror destination/date/traveler/budget into an AI table.
- Card-local focus/open/validation state is ephemeral; accepted answers are persisted only through existing structured `data-tripBrief` snapshots.

### 4.2 Trip Service

No new Trip columns or tables.

- Reuse `trips.destination_name`, `start_date`, `end_date`, `traveler_count`, `budget_amount`, `budget_currency`, `status=DRAFT`.
- Reuse `itinerary_commit_receipts` unique `(owner_user_id, idempotency_key)` to deduplicate both create and add operations.
- Reuse itinerary source proposal/item keys for item dedupe.
- The Java request validator and commit service change to support conditional empty items for `CREATE_TRIP`; no Flyway migration is expected.

### 4.3 Rollback

Disable the coordinator feature flag first. Structured message parts remain backward-compatible JSON and may be ignored by old UI. Trips already created are user-owned records and are never automatically deleted during rollback.

---

## 5. Security & Trust Boundaries

| Risk | Mitigation |
| --- | --- |
| Accidental creation | Explicit intent evidence and complete brief required |
| Prompt injection/model mutation | Server owns authorization, validation and mutation transitions |
| Guest/shared state | JWT required before persistence/mutation |
| IDOR | Every chat route scopes by `userId`; Trip Service rechecks owner/editor permission |
| Duplicate trip | Deterministic key + receipt unique constraint + request-hash conflict |
| Fabricated places | Canonical IDs + batch snapshots; fail closed |
| Fake ticks | UI uses commit result/trip items, never generated Markdown |
| Stale/cancel race | Version check before create; cancellation checked again immediately before signed call |
| Error leakage | Stable safe codes, localized messages, no raw provider/SQL/stack/JWT/secret in UI logs |
| Malicious custom answer | Length limits, schema validation and normalization on PATCH; never render custom text as raw HTML |
| Stale multi-tab answer | Existing `expectedVersion` rejects stale PATCH; UI refetches latest brief and preserves the user's unsaved input for retry |

Rate-limit intent starts/retries/commits. HMAC secret remains backend-only. Log IDs, safe codes and state transitions; do not log raw message content by default.

---

## 6. Trade-offs & Rejected Alternatives

| Decision | Resolution |
| --- | --- |
| Separate `trip_planning_intakes` table | Rejected: duplicates Trip business data and creates two sources of truth |
| No persistence before field four | Rejected: reload would lose partial progress |
| Structured message parts | Chosen for partial conversational context already owned by AI Service |
| Create Trip only after places succeed | Rejected per product requirement; complete brief must immediately become a Trip record |
| DRAFT remains after place failure | Chosen: preserves user intent, allows retry, avoids deleting user data |
| New draft endpoint | Rejected: existing signed idempotent commit boundary can safely create an empty DRAFT |
| No second confirmation | Explicit intent + continued intake answers grant one-run authorization |
| Flexible budget | Persist null amount; retain preference in chat context |
| Detailed Who in Trip | Current Trip stores total only; detailed composition remains context until separately modeled |
| Four model-generated questions | Rejected: unnecessary latency/token cost; deterministic interactive card owns missing-field collection |
| One large static four-field form | Rejected as default: visually heavy; progressive card shows one field at a time while keeping the entire interaction client-side |
| Send each choice as chat text | Rejected: pollutes history and still invokes the model; direct versioned PATCH is deterministic and cheaper |

### Current Implementation Gaps/Superseded Behavior

1. `tripPreferences` is local-only and currently defaults one adult before user input.
2. Current prompt/UI can decorate place names with tick symbols without commit evidence; this plan supersedes that behavior.
3. `createTripProposal` trusts optional IDs/model place facts.
4. `searchPlaces` falls back to provider ID and defaults rating to `4.5`.
5. Current `CREATE_TRIP` commit requires non-empty items and therefore cannot create the DRAFT immediately after intake.

---

## 7. Frontend UX

- Header chips read latest partial brief before link and authoritative Trip data after link.
- Inline assistant renders one progressive intake card for destination, dates, travelers and budget; advancing between questions is local UI, not a new AI response.
- Every step supports quick choices, `Other/Tùy chỉnh`, Back and Cancel. Submit/selection shows inline pending/error state and retries the same versioned mutation safely.
- The card is restored after reload/chat switching from the latest brief and disappears after cancellation or trip link.
- Progress order: `Đang tạo chuyến đi → Đang tìm địa điểm đã xác minh → Đang lưu lịch trình`.
- DRAFT creation emits one operation-scoped toast with `Xem chuyến đi`; successful itinerary commit updates it or emits a concise completion toast.
- Rich day/morning/afternoon/evening layout follows the supplied reference.
- Blue `CircleCheck` renders only when the corresponding item key/place ref is present in authoritative committed results.
- Failures remain inline with Retry; no success tick/toast on failure.
- All new strings use the correct `aiPlanner`/`trip` namespaces with EN/VI parity and sanitized errors.

---

## 8. Phased Implementation & Verification

### Phase 1 — Structured Intake

- [x] Add typed brief/state parts and latest-snapshot repository over existing message JSONB.
- [x] Add deterministic intent/slot extraction, server validation, cancellation and version transitions.
- [x] Add owned GET/PATCH/cancel/retry routes through Gateway.
- [x] Remove implicit one-adult completion default.

### Phase 2 — Immediate Trip Creation

- [x] Extend signed commit validation so `CREATE_TRIP` accepts empty items but complete TripDraft; keep `ADD_TO_TRIP` non-empty.
- [x] Create deterministic create idempotency key/hash and receipt replay.
- [x] Link `chat.tripId` with compare-and-set and repair link after replay.
- [x] Make linked Trip the authoritative header/context source.

### Phase 3 — Trusted Planning & Auto-Add

- [x] Make search canonical-ID-only and rating/address nullable.
- [x] Add batch snapshot verification and enforce place refs by item type.
- [x] Generate immutable verified proposal from authoritative Trip fields plus chat-only details.
- [x] Auto-commit `ADD_TO_TRIP` with retry/idempotency; remove second CTA only for authorized intake flow.

### Phase 4 — Conversational UX

- [x] Add adaptive question/header inputs/progress and reload recovery.
- [x] Render real committed checks and rich itinerary layout.
- [x] Add operation-scoped, localized and sanitized toast feedback.
- [x] Preserve manual proposal behavior and responsive/mobile accessibility.

### Phase 5 — Tests and Reviews

- [x] AI unit/build verification: intent discrimination, server cancellation, missing order/no implicit traveler, structured state and proposal validation.
- [x] Trip unit/compile verification: empty-item CREATE only and invalid ADD empty; existing receipt/hash behavior retained.
- [x] Place/proposal static/build verification: canonical-only IDs, missing snapshot fail-closed, null facts, no fabricated rating.
- [x] Web verification: partial/linked sources, reload, real checks, sanitized errors, EN/VI parity, tests and production build.
- [ ] E2E: one-message complete, interactive-card completion without intermediate model turns, linked/conflict, cancel, place outage with retained DRAFT, retry/reload/concurrency.
- [x] Architecture, database, security, testing and PR reviews; no blocking design issue found, live E2E remains pending.

### Phase 6 — Interactive Token-Efficient Intake (Approved & Implemented)

- [x] Add a typed `TripIntakeCard` renderer driven by the latest `data-tripBrief`/planning-brief response.
- [x] Add field-specific quick choices, `Other/Tùy chỉnh`, Back/Cancel, responsive and keyboard-accessible behavior.
### Phase 7 — UX Polish & Auto-Commit Stabilization (Completed)

- [x] Bug 1: Removed automatic artificial user message sending (`sendMessage`) on `TRIP_LINKED`. Added explicit user-controlled `[ ✨ Tạo lịch trình ngay ]` CTA button.
- [x] Bug 2: Prevented model hallucination of traveler count (`who`) by adding `hasTravelerMention` regex detector, server sanitization, and strict prompt constraints so intake never skips `WHO`.
- [x] Bug 3: Replaced boxed AI card container with borderless natural chat timeline layout (`variant="chat"`) and removed redundant "Add to trip" buttons.
- [x] Bug 4: Eliminated ugly dashed empty search boxes (`Compass`) when sub-queries return 0 results by returning `null`.
- [x] Bug 5 & 6: Aggregated all suggested places from multiple `searchPlaces` calls into a single unified Carousel, deduplicated by `place.id`, and removed repetitive keyword headers.
- [x] Bug 7: Resolved auto-commit authorization bug in `routes/chat.ts` by ensuring `isTripLinked` initializes `planningRuntime.autoCommitAuthorized = true`, enabling `createTripProposal` to commit all activities directly to `trip-service`.

```bash
cd services/ai-service && npm run build && npm test
./mvnw -pl services/trip-service,services/place-service -am test
cd apps/web/tripsense
npm test
npm run build
```

---

## 9. Approval Decisions

Approval confirms:

1. Không tạo bảng `trip_planning_intakes`.
2. Partial brief được lưu dưới dạng structured message parts cho đến khi Trip tồn tại.
3. Đủ Where/When/Who/Budget sẽ lập tức tạo và link đúng một Trip DRAFT trong Trip Service.
4. Nếu planning/place fail, DRAFT vẫn tồn tại và được retry; không rollback/xóa tự động.
5. Explicit intent + intake answers là one-run consent; không cần xác nhận proposal lần hai.
6. Place-like items phải canonical và tick chỉ đến từ commit thật.
7. Trip hiện lưu tổng traveler; breakdown/pets chỉ là planning context.
8. Manual proposal flow vẫn còn và vẫn yêu cầu xác nhận.
9. Missing-field collection chuyển sang interactive quick-choice card; card PATCH không tiêu thụ model tokens và không tạo synthetic chat messages.

## Human Approval Gate

```text
STATUS: APPROVED
```

Implementation ban đầu và Revision Phase 6 đã được user phê duyệt ngày 2026-09-30.

## Implementation Verification — 2026-09-30

- AI Service: TypeScript build and 7 unit tests passed (`shouldStopAfterBriefStep`, GeminiKeyManager, intent/cancel/missing order).
- Trip Service: compile and 2 focused commit-validation tests passed.
- API Gateway: compile and Spotless checks passed.
- Web: i18n parity, typography contract, type-check, 255 tests (including `trip-intake-card.test.tsx`) and production build passed.
- Live services on ports 8080/8083/8084/8089 were offline, so the runtime E2E matrix remains pending live staging deployment.
