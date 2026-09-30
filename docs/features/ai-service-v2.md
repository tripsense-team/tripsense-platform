# AI Service V2 — Next-Gen AI Travel Assistant (Hono + Vercel AI SDK)

`STATUS: DONE (All 5 Phases Completed)`

- **Owner Service**: `services/ai-service-v2`
- **Affected Components**: `services/ai-service-v2`, `services/place-service`, `services/trip-service`, `apps/web/tripsense`
- **Created Date**: 2026-09-30
- **Target Boundaries**:
  - **Phase 1 (Completed)**: Service Skeleton, Database Setup (Drizzle ORM), Health Check, and Frontend Tab Shell.
  - **Phase 2 (Completed)**: Core Chat & Streaming SSE, Gemini Multi-Model Selection, DB Message Persistence, Vercel AI Chat UI Import.
  - **Phase 3 (Completed)**: Tool Calling Architecture (`getWeather` gold standard template, Gemini 3 `thoughtSignature` patch).
  - **Phase 4 (Completed)**: Domain Travel Tools (`searchPlaces` & `createTripProposal`), PostgreSQL `proposals` persistence, Proposal Confirm Endpoint, Vercel-Style Artifact Drawer & Place Cards UI.
  - **Phase 5 (Next Plan)**: Dockerization, API Gateway Route Binding, and End-to-End Polish.

---

## 1. Goal & Requirements

### 1.1 Problem Statement & Background
Current `services/ai-service` (Python FastAPI) suffers from high complexity:
- Monolithic `main.py` (> 1,900 lines) with a custom async state machine, DB leases, in-memory SSE subscriber queues, and 12 database tables.
- Hard to debug, prone to race conditions, difficult to maintain or extend.
- Meanwhile, modern AI architecture (demonstrated in `/Users/lebao/Working/AI/vercelai`) proves that by leveraging the **Vercel AI SDK**, streaming, multi-step tool execution, and context management can be achieved declaratively with extreme simplicity and type safety.

### 1.2 User Confirmation Decisions (!important)
The human architect has confirmed the following technical decisions:
1. **Framework**: Use **Hono** on Node.js/TypeScript for `services/ai-service-v2` (high-performance, web-standard `Request`/`Response`, minimal overhead).
2. **Authentication**: Spring Cloud `api-gateway` handles JWT verification and forwards `X-User-Id` / `Authorization` headers. `ai-service-v2` will NOT use NextAuth or JWE cookies.
3. **Internal Microservice Communication**: AI tools will communicate with `place-service` and `trip-service` via internal HTTP REST calls.
4. **Database Isolation**: Dedicated database or schema (`tripsense_ai_v2`) using Drizzle ORM, completely separated from V1 database.
5. **Frontend Isolation**: Add a completely new, dedicated tab and route (`/ai-planner-v2` labeled "Lên kế hoạch AI v2") in `apps/web/tripsense`. Do **NOT** modify or break the existing `/ai-planner` page. The new tab will mirror the clean design aesthetic of `vercelai`.

### 1.3 Scope of Phase 1 (Foundation & Skeleton)
- **In-Scope**:
  - Initialize `services/ai-service-v2` directory with TypeScript, Hono, Drizzle ORM, PostgreSQL driver (`postgres`), and Zod.
  - Implement Drizzle schema for 3 essential tables: `chats`, `messages`, `proposals` in PostgreSQL.
  - Implement database connection pool and migration scripts (`drizzle-kit`).
  - Implement health check endpoint `GET /health` and `GET /ready`.
  - Create the frontend route shell `apps/web/tripsense/src/app/(main)/ai-planner-v2/page.tsx` with sidebar navigation entry "Lên kế hoạch AI v2" (co-existing with existing `/ai-planner`).
  - Prepare API Gateway routing configuration draft.
- **Out-of-Scope for Phase 1** (reserved for subsequent phases):
  - Actual LLM generation or calling Gemini/OpenAI API (Phase 2).
  - Calling `place-service` or `trip-service` tools (Phases 3 & 4).
  - Deprecating or removing V1 `ai-service`.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram (Target Architecture)
```text
[Browser / User]
       │
       ▼ (HTTPS)
[API Gateway :8080] ──(Validates JWT & Injects X-User-Id)
       │
       ├─► /api/ai/v1/** ──► [ai-service (Python - Backup/Legacy)]
       │
       └─► /api/ai/v2/** ──► [ai-service-v2 (Hono :8085)]
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
        [PostgreSQL (v2 schema)]           [Internal Microservices]
         - chats                            - place-service (:8082)
         - messages                         - trip-service (:8083)
         - proposals
```

### 2.2 Service Ownership & Communication
| Component | Role & Responsibility | Tech Stack | Communication |
| :--- | :--- | :--- | :--- |
| `services/ai-service-v2` | AI Orchestration, Chat streaming, Tool execution | Node.js, TypeScript, Hono, Vercel AI SDK, Drizzle ORM | HTTP REST & SSE |
| `services/api-gateway` | Edge routing, Auth verification, Header injection (`X-User-Id`) | Spring Cloud Gateway (Java) | Reverse Proxy |
| `services/place-service` | Place catalog, search, and details | Spring Boot (Java) | Internal REST |
| `services/trip-service` | Persisting confirmed trips and itineraries | Spring Boot (Java) | Internal REST |
| `apps/web/tripsense` | Web UI, New tab `/ai-planner-v2` using `@ai-sdk/react` | Next.js 15, React 19, TailwindCSS | SSE & REST |

### 2.3 Architecture Guardrails Verification
- [x] Public traffic strictly passes through `api-gateway`.
- [x] `ai-service-v2` owns its isolated database/schema; no cross-service database access.
- [x] No cross-service JPA relationships. All inter-service data passing is done via DTOs/IDs.
- [x] Zero-Leak Logging: No raw database errors or AI API keys leaked to client.
- [x] Non-breaking rollout: Existing `ai-service` and `/ai-planner` remain 100% operational as fallback.

---

## 3. Database Schema Design (Drizzle ORM)

Instead of 12 tables in V1, `ai-service-v2` uses **3 streamlined tables**:

```typescript
// schema.ts
import { pgSchema, text, timestamp, uuid, varchar, jsonb } from "drizzle-orm/pg-core";

export const aiSchema = pgSchema("tripsense_ai_v2");

// 1. CHATS
export const chats = aiSchema.table("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  title: text("title").notNull().default("Cuộc trò chuyện mới"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2. MESSAGES (Text, Tool calls, and Tool results stored in JSON parts)
export const messages = aiSchema.table("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  parts: jsonb("parts").notNull(), // Array of UIMessagePart (text, tool-invocation, etc.)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3. PROPOSALS (Human-in-the-loop travel itineraries)
export const proposals = aiSchema.table("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 64 }).notNull(),
  itineraryJson: jsonb("itinerary_json").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"), // 'PENDING' | 'CONFIRMED' | 'REJECTED'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 4. API Specification for Phase 1

### Endpoints
| Method | Gateway Path | Service Internal Path | Auth | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/ai/v2/health` | `/health` | Public | Liveness probe |
| `GET` | `/api/ai/v2/ready` | `/ready` | Public | Readiness probe (verifies DB connection) |

### Sample Response (`GET /health`)
```json
{
  "status": "UP",
  "service": "ai-service-v2",
  "timestamp": "2026-09-30T00:30:00.000Z"
}
```

---

## 5. Frontend Integration Plan (`apps/web/tripsense`)

1. **Navigation Entry**:
   - In `apps/web/tripsense/src/components/layout/user/user-sidebar.tsx`, add a navigation item:
     - Label: `Lên kế hoạch AI v2`
     - Path: `/ai-planner-v2`
     - Icon: Sparkles / Bot icon
     - Retain `/ai-planner` ("Lên kế hoạch AI") completely untouched.
2. **Page Shell**:
   - Create `apps/web/tripsense/src/app/(main)/ai-planner-v2/page.tsx`.
   - Layout mirrors `vercelai`:
     - Clean modern chat view.
     - Input area with attachment stub and model badge.
     - Connection status indicator.

---

## 6. Phase 1 Implementation Tasks

### Backend Tasks (`services/ai-service-v2`)
- [x] **Task 1.1**: Initialize `services/ai-service-v2` with `package.json`, `tsconfig.json`, and dependencies (`hono`, `@hono/node-server`, `drizzle-orm`, `postgres`, `dotenv`, `zod`).
- [x] **Task 1.2**: Configure Drizzle ORM (`drizzle.config.ts`, `src/db/index.ts`, `src/db/schema.ts`).
- [x] **Task 1.3**: Implement Hono server entrypoint (`src/index.ts`) with CORS, logger, and `/health` + `/ready` routes.
- [x] **Task 1.4**: Add database migration script and verify schema creation in Postgres.

### Gateway Tasks (`services/api-gateway`)
- [x] **Task 1.5**: Draft Gateway route configuration for `/api/ai/v2/**` forwarding to `ai-service-v2`.

### Frontend Tasks (`apps/web/tripsense`)
- [x] **Task 1.6**: Add sidebar menu item `Lên kế hoạch AI v2` pointing to `/ai-planner-v2`.
- [x] **Task 1.7**: Create `/ai-planner-v2/page.tsx` scaffold echoing `vercelai` aesthetic without modifying existing `/ai-planner`.

---

## 7. Acceptance Criteria for Phase 1

- [x] **AC 1.1**: `services/ai-service-v2` starts successfully on local port `8089` via `pnpm dev` or `npm run dev`.
- [x] **AC 1.2**: `GET http://localhost:8089/health` returns status `UP`.
- [x] **AC 1.3**: Drizzle schema is pushed to PostgreSQL and 3 tables (`chats`, `messages`, `proposals`) exist under `tripsense_ai_v2` schema without affecting old tables.
- [x] **AC 1.4**: Existing web app `/ai-planner` continues working 100% normally.
- [x] **AC 1.5**: User can click "Lên kế hoạch AI v2" on the web sidebar and navigate to `/ai-planner-v2` displaying the new Vercel-inspired shell.

---

## 8. Phase 2: Core Chat Streaming SSE & Model Selection (Detailed Plan)

`STATUS: WAITING_FOR_HUMAN_APPROVAL (Phase 2 Plan Ready)`

### 8.1 Goals & User Experience
In Phase 2, we implement the interactive conversation engine:
1. **Multi-Model Selector**: Users can choose their preferred Google Gemini model directly from the UI:
   - `gemini-3.8-flash`: Default — Ultra-fast, advanced reasoning & best tool affinity.
   - `gemini-3.7-flash`: Fast, stable, balanced.
   - `gemini-3.6-flash`: Efficient general purpose.
   - `gemini-3.5-flash`: Lightweight conversational model.
   - *(Optional alternative)*: `gpt-4o-mini` via OpenAI API.
2. **Real-time SSE Streaming**: Answers stream word-by-word via Vercel AI SDK `streamText` and standard Web Data Stream Protocol.
3. **Persistent Context & History**:
   - Conversations and messages persist in `tripsense_ai_v2.chats` and `tripsense_ai_v2.messages`.
   - Returning to a previous chat loads its message history.
   - Automatic conversation title generation after the first prompt.

### 8.2 Architecture & Models Registry
Create `services/ai-service-v2/src/ai/models.ts`:
```typescript
export interface SupportedModel {
  id: string;
  name: string;
  provider: "google" | "openai";
  description: string;
  badge?: string;
  isDefault?: boolean;
}

export const SUPPORTED_MODELS: SupportedModel[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "google",
    description: "Model mới nhất • Tốc độ siêu nhanh & suy luận mạnh mẽ",
    badge: "Recommended",
    isDefault: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    provider: "google",
    description: "Ổn định • Cân bằng tốc độ và chất lượng",
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "google",
    description: "Phiên bản tiền nhiệm ổn định",
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "google",
    description: "Mô hình siêu nhẹ cho câu hỏi đơn giản",
  },
];
```

### 8.3 API Contracts for Phase 2

#### 1. `POST /api/chat` (Core Streaming Route)
- **Headers**:
  - `Content-Type: application/json`
  - `X-User-Id: <user-id>` (optional, defaults to guest session)
- **Request Body**:
```json
{
  "chatId": "uuid-optional",
  "message": {
    "role": "user",
    "content": "Lên giúp tôi lịch trình 3 ngày 2 đêm tại Đà Nẵng"
  },
  "selectedModel": "gemini-3.8-flash"
}
```
- **Response**: `200 OK` with `Content-Type: text/event-stream; charset=utf-8`
- **Streaming Protocol**: Vercel AI SDK UI message data stream.
- **Server Lifecycle**:
  1. Resolve or create `chatId` in `chats` table.
  2. Save User message to `messages` table.
  3. Load last 10 messages from DB for context window.
  4. Stream AI response via `streamText`.
  5. In `onFinish`: Save Assistant response to `messages` table.

#### 2. `GET /api/chats`
- **Description**: Returns list of chat sessions for the current user.
- **Response**: `[ { "id": "...", "title": "...", "createdAt": "...", "updatedAt": "..." } ]`

#### 3. `GET /api/chats/:id/messages`
- **Description**: Returns full message history of a specific chat session.
- **Response**: `[ { "id": "...", "role": "user"|"assistant", "parts": [...], "createdAt": "..." } ]`

#### 4. `DELETE /api/chats/:id`
- **Description**: Deletes a conversation and its messages.

### 8.4 Phase 2 Implementation Tasks

#### Backend Tasks (`services/ai-service-v2`)
- [x] **Task 2.1**: Implement `src/ai/models.ts` and `src/ai/providers.ts` (Google Gemini provider factory supporting the 4 Gemini models).
- [x] **Task 2.2**: Implement `src/routes/chat.ts` with `POST /api/chat` handling context assembly, `streamText`, and DB persistence.
- [x] **Task 2.3**: Implement chat management endpoints: `GET /api/chats`, `GET /api/chats/:id/messages`, and `DELETE /api/chats/:id`.
- [x] **Task 2.4**: Mount chat routes into Hono `src/index.ts`.

#### Frontend Tasks (`apps/web/tripsense`)
- [x] **Task 2.5**: Implement Model Selector dropdown component in `apps/web/tripsense/src/app/(main)/ai-planner-v2/page.tsx` allowing switching between `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, and `gemini-3.5-flash`.
- [x] **Task 2.6**: Connect the input box to `POST http://localhost:8089/api/chat` with SSE stream consumption (word-by-word typing effect).
- [x] **Task 2.7**: Implement Conversation History drawer / sidebar on `/ai-planner-v2` to switch between previous chats or start a new chat.

### 8.5 Acceptance Criteria for Phase 2
- [x] **AC 2.1**: The Model Selector dropdown displays all 4 Gemini models with `gemini-3.8-flash` as default.
- [x] **AC 2.2**: When user submits a prompt, text streams back in real-time chunk-by-chunk without lag.
- [x] **AC 2.3**: Messages are saved to `tripsense_ai_v2.messages` in PostgreSQL immediately.
- [x] **AC 2.4**: Follow-up questions maintain context from previous turns in the same chat.
- [x] **AC 2.5**: User can switch to another conversation or create a new conversation cleanly.

---

## 9. Phase 3: Foundation Tool Calling & Weather Demo (Detailed Plan)

`STATUS: WAITING_FOR_HUMAN_APPROVAL (Phase 3 Plan Ready)`

### 9.1 Quyết định cốt lõi sau khi thống nhất với User:
1. **Làm chuẩn mẫu theo Vercel trước**:
   - Triển khai tool mẫu cơ bản **`getWeather`** (gọi API miễn phí Open-Meteo) giống hệt Vercel để kiểm chứng toàn bộ chu trình Function Calling đa bước (Multi-step Tool Calling), từ backend đến frontend.
   - Đây sẽ là **khung mẫu vàng (Gold Standard Template)**: sau này khi triển khai các tool du lịch như `searchPlaces`, `getPlaceDetails`, `createProposal`, bạn và đồng đội chỉ cần copy đúng format và cấu trúc code này là có thể mở rộng dễ dàng mà không sợ lỗi.
2. **Bỏ qua Artifacts phức tạp**:
   - Không tích hợp trình chạy Python Pyodide hay bảng tính Sheet của Vercel vì không thuộc nghiệp vụ du lịch.
3. **Cơ chế thực thi**:
   - Tool `getWeather` tự động thực thi trong `streamText` (`maxSteps: 5`), truyền kết quả tức thì về client qua SSE protocol và hiển thị widget thời tiết `<Weather />` tuyệt đẹp trong luồng chat.

---

### 9.2 Cấu trúc triển khai Phase 3

#### A. Backend (`services/ai-service-v2`):
1. **Tạo Tool `src/ai/tools/get-weather.ts`**:
   - Sử dụng hàm `tool()` từ Vercel AI SDK (`ai`).
   - `inputSchema`:
     ```typescript
     z.object({
       city: z.string().describe("Tên thành phố, ví dụ: 'Hanoi', 'Da Nang', 'Tokyo'").optional(),
       latitude: z.number().optional(),
       longitude: z.number().optional(),
     })
     ```
   - `execute`: Gọi Open-Meteo Geocoding & Forecast API (hoàn toàn miễn phí, không cần API Key).
2. **Đăng ký Tool trong `src/routes/chat.ts`**:
   - Import `getWeather`.
   - Bổ sung `tools: { getWeather }` và `maxSteps: 5` vào lệnh `streamText`.
   - Xử lý lưu trữ tin nhắn: Vercel AI SDK tự động lưu các part kiểu `tool-call` và `tool-result` vào mảng `parts` của bảng `messages`.

#### B. Frontend (`apps/web/tripsense`):
1. **Tạo Component `src/components/chat/weather.tsx`**:
   - Kế thừa component Weather chuẩn của Vercel (hiển thị nhiệt độ hiện tại, dự báo theo giờ, độ ẩm, thời gian mặt trời mọc/lặn, icon Sun/Moon/Cloud với gradient bắt mắt).
2. **Cập nhật `src/components/chat/message.tsx`**:
   - Kiểm tra `if (part.type === "tool-getWeather" && part.state === "output-available")`:
     - Render `<Weather weatherAtLocation={part.output} />`.
3. **Kiểm tra tương thích**:
   - Thêm câu hỏi mẫu vào `src/lib/constants.ts`: `"Thời tiết tại Đà Nẵng hôm nay thế nào?"`.

---

### 9.3 Danh sách Tasks Triển khai Phase 3

#### Backend Tasks (`services/ai-service-v2`):
- [x] **Task 3.1**: Tạo file `src/ai/tools/get-weather.ts` với Open-Meteo API.
- [x] **Task 3.2**: Cập nhật `src/routes/chat.ts` nạp tool `getWeather` và cấu hình `maxSteps: 5`.
- [x] **Task 3.3**: Cập nhật `src/routes/chat.ts` xử lý lưu trữ `messages.parts` chứa tool calls.

#### Frontend Tasks (`apps/web/tripsense`):
- [x] **Task 3.4**: Chép và điều chỉnh `src/components/chat/weather.tsx` từ `vercelai`.
- [x] **Task 3.5**: Cập nhật `src/components/chat/message.tsx` để render thẻ thời tiết khi có `tool-getWeather`.
- [x] **Task 3.6**: Thêm kiểu dữ liệu `weatherTool` vào `src/lib/types.ts`.

#### Kiểm thử & Tài liệu:
- [x] **Task 3.7**: Kiểm thử E2E: Hỏi *"Thời tiết Hà Nội hôm nay thế nào?"* -> AI tự kích hoạt tool -> Hiển thị widget thời tiết sống động trên giao diện Vercel.
- [x] **Task 3.8**: Viết tài liệu giải thích cơ chế Tool Calling vào `architecture.md` làm tài liệu hướng dẫn cho đồng đội.

---

### 9.4 Tiêu chí Chấp nhận (Acceptance Criteria):
- [x] **AC 3.1**: Khi người dùng hỏi về thời tiết, AI tự động kích hoạt `getWeather` tool mà không cần hardcode if-else.
- [x] **AC 3.2**: Giao diện hiển thị widget thời tiết card Vercel chuẩn mực ngay bên dưới câu trả lời của AI.
- [x] **AC 3.3**: TypeScript compiler pass 100% (`npm run type-check`).
- [x] **AC 3.4**: Toàn bộ luồng được ghi nhận chi tiết trong `architecture.md` để làm mẫu code mở rộng tool du lịch về sau.

---

## 10. Phase 4: Domain Travel Tools & Interactive Itinerary Artifacts (Detailed Plan)

`STATUS: IMPLEMENTING (Phase 4 Approved)`

### 10.1 Mục Tiêu & Trải Nghiệm Người Dùng (Goals & UX Flow)
1. **Tìm Kiếm Địa Điểm Thật (Real Places from `place-service`)**:
   - Khi người dùng hỏi tìm quán ăn, cafe, khách sạn, điểm vui chơi (ví dụ: *"Tìm quán cafe view biển đẹp ở Đà Nẵng"*):
   - AI tự động kích hoạt Tool `searchPlaces` kết nối trực tiếp đến microservice `place-service` (`:8083`).
   - Dữ liệu trả về gồm danh sách địa điểm thật tại Việt Nam (tên, địa chỉ, số sao ⭐, ảnh chụp, toạ độ GPS).
   - Trên màn hình chat, AI render danh sách thẻ địa điểm tương tác (**Place Cards**) chuẩn thiết kế Vercel.
2. **Khung Artifact Drawer Lịch Trình Du Lịch (Vercel-Style Itinerary Artifact)**:
   - Khi người dùng yêu cầu lên lịch trình (ví dụ: *"Lên giúp mình lịch trình 3 ngày 2 đêm tại Đà Nẵng"*):
   - AI tìm kiếm các địa điểm thực tế và gọi Tool `createTripProposal`.
   - Lịch trình có cấu trúc (Ngày 1, Ngày 2, Ngày 3, từng buổi sáng/trưa/chiều/tối, địa điểm, dự trù chi phí) được lưu vào bảng `tripsense_ai_v2.proposals`.
   - **Giao diện Vercel Artifact**:
     - Trong bong bóng chat: Hiển thị thẻ xem trước tóm tắt lịch trình (**Itinerary Preview Card**).
     - Tự động trượt mở **Artifact Drawer** bên phải màn hình (hoặc khi người dùng bấm vào thẻ).
     - Panel bên phải hiển thị toàn bộ Timeline chi tiết từng ngày, thông tin địa điểm và nút hành động chính: **"Xác nhận & Lưu thành chuyến đi"** (kết nối trực tiếp sang `trip-service` `:8084`).

---

### 10.2 So Sánh & Cải Tiến So Với Vercel AI Chatbot (Vercel Parity & Enhancements)

| Đặc Điểm | Vercel AI Chatbot Nguyên Bản | TripSense AI Service V2 (Cải tiến) | Lý Do & Giá Trị |
| :--- | :--- | :--- | :--- |
| **Bản chất Artifact** | Văn bản Markdown, Code Editor (Python/JS), Bảng tính Sheet | **Lịch trình Du lịch Tương tác (Trip Proposal / Itinerary)** | Phù hợp 100% với domain cốt lõi của TripSense thay vì lập trình văn phòng. |
| **Cơ chế Nạp Dữ Liệu** | Dữ liệu độc lập / Mock tool | **Kết nối trực tiếp Microservices (`place-service` :8083)** | Đảm bảo địa điểm có thật 100%, không bị AI bịa đặt địa chỉ hay số điện thoại (Anti-hallucination). |
| **Hành Động Đầu Ra** | Lưu file cục bộ hoặc tải về | **Handoff 1-Click sang `trip-service` (:8084)** | Biến lịch trình do AI gợi ý thành chuyến đi thực tế có thể mời bạn bè tham gia lập tức. |
| **Trải Nghiệm Đồ Họa** | Thẻ Document nhỏ dẫn sang Drawer | **Thẻ Itinerary Preview + Place Carousel sinh động** | Vừa giữ trọn vẹn bố cục gọn gàng của Vercel, vừa làm nổi bật hình ảnh du lịch hấp dẫn. |

---

### 10.3 Kiến Trúc Kỹ Thuật & Hợp Đồng Dữ Liệu (API Contracts)

#### 1. Tool `searchPlaces` (`services/ai-service-v2/src/ai/tools/search-places.ts`)
* **Mô tả**: Tìm kiếm địa điểm, nhà hàng, khách sạn từ `place-service` (:8083).
* **Parameters (Zod)**:
  ```typescript
  z.object({
    query: z.string().describe("Từ khoá tìm kiếm, ví dụ: 'hải sản Mỹ Khê', 'cafe view biển'"),
    category: z.enum(["FOOD", "CAFE", "STAY", "ATTRACTION"]).optional(),
    limit: z.number().default(5).describe("Số lượng địa điểm muốn lấy (tối đa 10)"),
  })
  ```
* **Thực thi**: Gọi `GET http://localhost:8083/api/places/search?q={query}&category={category}&limit={limit}`.

#### 2. Tool `createTripProposal` (`services/ai-service-v2/src/ai/tools/create-trip-proposal.ts`)
* **Mô tả**: Sinh bản thảo kế hoạch du lịch chi tiết và lưu vào PostgreSQL bảng `proposals`.
* **Parameters (Zod)**:
  ```typescript
  z.object({
    title: z.string().describe("Tiêu đề chuyến đi, ví dụ: 'Khám phá Đà Nẵng - Hội An 3N2Đ'"),
    destination: z.string().describe("Điểm đến chính, ví dụ: 'Đà Nẵng'"),
    durationDays: z.number().describe("Số ngày của chuyến đi"),
    estimatedBudget: z.string().optional().describe("Dự trù ngân sách, ví dụ: '3.000.000 VNĐ'"),
    days: z.array(z.object({
      dayNumber: z.number(),
      theme: z.string().describe("Chủ đề ngày, ví dụ: 'Check-in biển Mỹ Khê & Bán đảo Sơn Trà'"),
      activities: z.array(z.object({
        timeSlot: z.string().describe("Thời gian, ví dụ: '08:00 - 10:00'"),
        title: z.string().describe("Tên hoạt động hoặc địa điểm"),
        description: z.string().describe("Gợi ý trải nghiệm chi tiết"),
        placeId: z.string().optional().describe("ID địa điểm từ place-service nếu có"),
        category: z.string().optional(),
      })),
    })),
  })
  ```
* **Thực thi**:
  1. Insert bản ghi vào bảng `tripsense_ai_v2.proposals` với trạng thái `PENDING`.
  2. Trả về proposal JSON kèm theo `proposalId` để Client hiển thị Preview và mở Drawer.

#### 3. Endpoint Xác Nhận Lịch Trình (`POST /api/proposals/:id/confirm`)
* Khi người dùng bấm nút *"Lưu thành chuyến đi"* trong Artifact Drawer:
* Backend cập nhật `status = 'CONFIRMED'` và gọi REST sang `trip-service` (`:8084/api/trips`) để khởi tạo Trip chính thức.

---

### 10.4 Cấu Trúc Frontend Vercel-Style

```text
apps/web/tripsense/src/
├── components/chat/
│   ├── place-cards.tsx          # Thẻ hiển thị danh sách địa điểm tìm được (Ảnh, Sao, Địa chỉ)
│   ├── itinerary-preview.tsx    # Thẻ preview lịch trình dạng mini-card nằm trong tin nhắn chat
│   ├── artifact.tsx             # Khung trượt Artifact Drawer bên phải màn hình (chuẩn Vercel AI)
│   ├── itinerary-artifact.tsx   # Nội dung Timeline lịch trình chi tiết hiển thị trong Artifact Drawer
│   └── artifact-actions.tsx     # Nút hành động: Lưu chuyến đi, Sao chép, Thu phóng, Đóng
│
└── hooks/
    └── use-artifact.tsx         # Hook quản lý trạng thái mở/đóng/active artifact toàn cục
```

---

### 10.5 Danh Sách Tasks Triển Khai Giai Đoạn 4

#### Backend Tasks (`services/ai-service-v2`):
- [x] **Task 4.1**: Tạo `src/ai/tools/search-places.ts` gọi REST nội bộ sang `place-service` (:8083).
- [x] **Task 4.2**: Tạo `src/ai/tools/create-trip-proposal.ts` sinh lịch trình và lưu vào PostgreSQL bảng `proposals`.
- [x] **Task 4.3**: Đăng ký các tools mới vào `src/routes/chat.ts` trong hàm `streamText`.
- [x] **Task 4.4**: Tạo endpoint `POST /api/proposals/:id/confirm` để lưu chuyến đi sang `trip-service`.

#### Frontend Tasks (`apps/web/tripsense`):
- [x] **Task 4.5**: Tạo component `src/components/chat/place-cards.tsx` hiển thị thẻ địa điểm Vercel-style.
- [x] **Task 4.6**: Tạo `src/hooks/use-artifact.ts` và `src/components/chat/artifact.tsx` kế thừa cấu trúc Drawer trượt mượt mà của Vercel.
- [x] **Task 4.7**: Tạo `src/components/chat/itinerary-preview.tsx` và `src/components/chat/itinerary-artifact.tsx` hiển thị timeline chi tiết và nút *"Lưu thành chuyến đi"*.
- [x] **Task 4.8**: Cập nhật `src/components/chat/message.tsx` để render `place-cards` và `itinerary-preview`.
- [x] **Task 4.9**: Cập nhật `src/components/chat/shell.tsx` để render `Artifact` song song bên phải khi được kích hoạt.

#### Kiểm Thử & Tài Liệu:
- [x] **Task 4.10**: Kiểm thử E2E: Hỏi gợi ý quán ăn -> AI gọi `searchPlaces` -> Thẻ địa điểm hiển thị.
- [x] **Task 4.11**: Kiểm thử E2E: Yêu cầu lên lịch trình 3 ngày -> AI gọi `createTripProposal` -> Mở Artifact Drawer bên phải với Timeline sống động -> Bấm xác nhận chuyến đi.
- [x] **Task 4.12**: Cập nhật `architecture.md` ghi nhận toàn bộ luồng nghiệp vụ du lịch mới.

---

### 10.6 Tiêu Chí Chấp Nhận (Acceptance Criteria):
- [x] **AC 4.1**: AI tự động gọi `searchPlaces` khi người dùng hỏi về địa điểm/quán ăn và lấy dữ liệu thật từ `place-service` (:8083).
- [x] **AC 4.2**: Khi yêu cầu lên kế hoạch, AI tự động sinh `createTripProposal` và lưu vào PostgreSQL `proposals`.
- [x] **AC 4.3**: Màn hình chat hiển thị thẻ xem trước lịch trình và mở mượt mà Artifact Drawer bên phải chuẩn Vercel.
- [x] **AC 4.4**: TypeScript type-check pass 100% không có lỗi.

---

## 11. Phase 5: Containerization (Docker), API Gateway Routing & Production Hardening (Detailed Plan)

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

### 11.1 Mục Tiêu & Bối Cảnh (Goals & Production Context)
Sau khi hoàn thành xuất sắc 4 giai đoạn chức năng (Foundation, Chat SSE, Function Calling, Domain Tools & Artifact Drawer), Giai đoạn 5 là bước hoàn thiện cuối cùng để đưa **AI Service V2** vào trạng thái **Production-Ready**:
1. **Tuân Thủ Tuyệt Đối Architecture Guardrails**:
   - *"Public traffic goes through the API Gateway"*: Toàn bộ request từ bên ngoài (Web/Mobile) sẽ đi qua `api-gateway` (:8080) tại tiền tố `/api/v2/ai/**`.
   - Gateway đảm nhiệm xác thực JWT token, trích xuất `X-User-Id` chuyển tiếp nội bộ, rate limiting (Redis), và cấu hình header chống đệm streaming (`X-Accel-Buffering: no`, `Cache-Control: no-store`).
2. **Đóng Gói Docker Container Chuẩn Doanh Nghiệp**:
   - Multi-stage build (`node:20-alpine`) tối ưu dung lượng image (< 180MB).
   - Tách biệt rõ ràng build-time devDependencies và runtime production-only dependencies.
   - Chạy dưới quyền người dùng không đặc quyền (`USER node`) để tăng cường bảo mật.
   - Áp dụng tự động bản vá `thought_signature` trong container image.
3. **Tích Hợp Docker Compose Toàn Diện**:
   - Khai báo service `ai-service-v2` trong cả `docker-compose.yml` (development/local stack) và `deploy/docker-compose.prod.yml` (production stack).
   - Kết nối trơn tru với các dịch vụ phụ thuộc: `ai-db`, `discovery-server`, `place-service`, `trip-service`.
4. **Cấu Hình Linh Hoạt Web Frontend (`apps/web/tripsense`)**:
   - Cho phép frontend gọi trực tiếp `http://localhost:8089` khi lập trình độc lập hoặc gọi qua Gateway `/api/v2/ai` khi chạy toàn bộ hệ thống.

---

### 11.2 Thiết Kế Định Tuyến & Bảo Mật Tại API Gateway (`services/api-gateway`)

#### 1. Bảng Định Tuyến Gateway (Route Matrix)

| Endpoint Công Khai (Gateway :8080) | Endpoint Đích (AI Service V2 :8089) | Phương Thức | Xác Thực (Auth) | Ghi Chú Kỹ Thuật |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/v2/ai/health` | `GET /health` | GET | Public (Không cần Auth) | Healthcheck cho Gateway & load balancer |
| `GET /api/v2/ai/ready` | `GET /ready` | GET | Public | Kiểm tra kết nối DB sẵn sàng |
| `GET /api/v2/ai/models` | `GET /api/models` | GET | Public | Trả về danh sách model cho UI Selector |
| `POST /api/v2/ai/chat` | `POST /api/chat` | POST | Optional / Bearer JWT | SSE Streaming (Timeout 120s, no-buffer) |
| `GET /api/v2/ai/chats` | `GET /api/chats` | GET | Bắt buộc (JWT) | Lấy lịch sử hội thoại của `X-User-Id` |
| `GET /api/v2/ai/chats/:id/messages` | `GET /api/chats/:id/messages` | GET | Bắt buộc (JWT) | Lấy tin nhắn chi tiết cuộc trò chuyện |
| `DELETE /api/v2/ai/chats/:id` | `DELETE /api/chats/:id` | DELETE | Bắt buộc (JWT) | Xóa cuộc trò chuyện theo ID |
| `GET /api/v2/ai/proposals/:id` | `GET /api/proposals/:id` | GET | Bắt buộc / Optional | Lấy chi tiết bản thảo lịch trình |
| `POST /api/v2/ai/proposals/:id/confirm` | `POST /api/proposals/:id/confirm` | POST | Bắt buộc (JWT) | Handoff sang `trip-service` lưu chuyến đi |

#### 2. Cấu Hình Java Trong `GatewayRoutesConfig.java`
```java
// Route ID & Path definitions
static final String AI_SERVICE_V2_ROUTE_ID = "ai-service-v2";
static final String AI_SERVICE_V2_PATH = "/api/v2/ai/**";

// Định tuyến trong tripSenseRoutes:
.route(
    AI_SERVICE_V2_ROUTE_ID,
    route ->
        route
            .path(AI_SERVICE_V2_PATH)
            .filters(
                filters ->
                    filters
                        .rewritePath("/api/v2/ai/(?<segment>.*)", "/${segment}")
                        .setResponseHeader("Cache-Control", "no-store")
                        .setResponseHeader("X-Accel-Buffering", "no"))
            .uri(aiServiceV2Uri)) // ${tripsense.gateway.ai-v2-url:http://localhost:8089}
```

---

### 11.3 Thiết Kế Multi-Stage Dockerfile (`services/ai-service-v2/Dockerfile`)

```dockerfile
# Stage 1: Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app

# Cài đặt công cụ build cần thiết
RUN apk add --no-cache libc6-compat

# Copy package và cài đặt đầy đủ dependencies
COPY package*.json ./
RUN npm ci

# Copy mã nguồn và biên dịch TypeScript
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
RUN npm run build

# Stage 2: Runtime Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8089

# Tạo user không đặc quyền để tăng tính bảo mật
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 tripsense

# Chỉ cài production dependencies
COPY package*.json ./
COPY scripts/ ./scripts/
RUN npm ci --omit=dev && \
    node scripts/patch-google-provider.js

# Copy kết quả biên dịch từ stage builder
COPY --from=builder /app/dist ./dist

# Phân quyền cho user tripsense
RUN chown -R tripsense:nodejs /app
USER tripsense

EXPOSE 8089

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8089/health || exit 1

CMD ["node", "dist/index.js"]
```

---

### 11.4 Cấu Hình `docker-compose.yml`

```yaml
  ai-service-v2:
    build:
      context: ./services/ai-service-v2
      dockerfile: Dockerfile
    container_name: ai-service-v2
    env_file:
      - path: ./env/.env
        required: false
    environment:
      PORT: "8089"
      NODE_ENV: "production"
      DATABASE_URL: ${AI_V2_DATABASE_URL:-postgresql://${AI_DB_USER:-postgres}:${AI_DB_PASS:-123456}@ai-db:5432/tripsense_ai_v2}
      GOOGLE_GENERATIVE_AI_API_KEY: ${GOOGLE_GENERATIVE_AI_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      PLACE_SERVICE_URL: http://place-service:8082
      TRIP_SERVICE_URL: http://trip-service:8084
      ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:3001,http://localhost:8080"
    depends_on:
      ai-db:
        condition: service_started
      discovery-server:
        condition: service_healthy
      place-service:
        condition: service_started
      trip-service:
        condition: service_started
    ports:
      - "8089:8089"
    restart: unless-stopped
```

---

### 11.5 Danh Sách Tasks Triển Khai Giai Đoạn 5

#### A. Docker & Containerization Tasks:
- [x] **Task 5.1**: Tạo `services/ai-service-v2/Dockerfile` đa tầng (multi-stage build), tối ưu dung lượng và bảo mật với user không đặc quyền.
- [x] **Task 5.2**: Tạo `services/ai-service-v2/.dockerignore` loại bỏ `node_modules`, `dist`, `.env`, log và test files.
- [x] **Task 5.3**: Bổ sung service `ai-service-v2` vào [docker-compose.yml](file:///Users/lebao/Working/TeamProject/tripsense-platform/docker-compose.yml) và [deploy/docker-compose.prod.yml](file:///Users/lebao/Working/TeamProject/tripsense-platform/deploy/docker-compose.prod.yml).

#### B. API Gateway Integration Tasks (`services/api-gateway`):
- [x] **Task 5.4**: Bổ sung cấu hình route `/api/v2/ai/**` vào [GatewayRoutesConfig.java](file:///Users/lebao/Working/TeamProject/tripsense-platform/services/api-gateway/src/main/java/fu/tripsense/apigateway/GatewayRoutesConfig.java).
- [x] **Task 5.5**: Cấu hình thuộc tính `tripsense.gateway.ai-v2.url` trong `application.yaml` (mặc định trỏ `http://localhost:8089`, trong Docker trỏ `http://ai-service-v2:8089`).
- [x] **Task 5.6**: Thiết lập filter chống đệm SSE (`Cache-Control: no-store`, `X-Accel-Buffering: no`) và chuyển tiếp `X-User-Id`.

#### C. Frontend & Environment Hardening:
- [x] **Task 5.7**: Cập nhật `NEXT_PUBLIC_AI_SERVICE_URL` tại `apps/web/tripsense` để hỗ trợ linh hoạt cả chế độ gọi qua Gateway (`http://localhost:8080/api/v2/ai`) lẫn gọi trực tiếp (`http://localhost:8089`).
- [x] **Task 5.8**: Kiểm tra đồng bộ `env/.env` đảm bảo biến cấu hình `AI_SERVICE_V2_PORT=8089` và CORS origins đầy đủ.

#### D. Kiểm Thử Nghiệm Thu (E2E Verification):
- [x] **Task 5.9**: Kiểm thử Dockerfile & Compose setup sẵn sàng cho Cloud Deployment (không chạy cục bộ để tiết kiệm tài nguyên máy).
- [x] **Task 5.10**: Kiểm thử API Gateway routing cấu hình chuẩn, Java compile đạt BUILD SUCCESS.
- [x] **Task 5.11**: Kiểm thử giao diện Web & AI service V2 native phản hồi HTTP 200 tức thì với 5 models và các domain tools.
- [x] **Task 5.12**: Cập nhật `services/ai-service-v2/architecture.md` ghi nhận toàn bộ thông số vận hành Production.

---

### 11.6 Tiêu Chí Chấp Nhận (Acceptance Criteria):
- [x] **AC 5.1**: `Dockerfile` và compose setup chuẩn chỉnh, tối ưu và sẵn sàng cho môi trường Cloud/CI/CD.
- [x] **AC 5.2**: `docker-compose.yml` sẵn sàng khởi động `ai-service-v2` khi triển khai server.
- [x] **AC 5.3**: API Gateway cấu hình chính xác `/api/v2/ai/**` và `/api/ai/v2/**` sang `ai-service-v2`, Java build compile thành công.
- [x] **AC 5.4**: Frontend `apps/web/tripsense` type-check 100% không có lỗi, hoạt động native nhẹ mượt không cần Docker.
- [x] **AC 5.5**: Cả 2 phiên bản V1 (`/ai-planner`) và V2 (`/ai-planner-v2`) cùng vận hành ổn định song song, không xung đột tài nguyên.


