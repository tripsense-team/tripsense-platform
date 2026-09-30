# AI Chat Mindtrip Experience & Place Carousel Redesign — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense`, `services/ai-service`, `services/trip-service`
- **Created Date**: 2026-09-30
- **Target PR Boundaries**: 
  - Phase 1: Frontend Message Sequencing & Active Progress Indicator (`message.tsx`)
  - Phase 2: Rich Itinerary Formatting Engine & Verified Place Badges (Prompt + Frontend Decorator)
  - Phase 3: Mindtrip Place Carousel with Hover Navigation & Trip Idea Integration (`place-cards.tsx`)
  - Phase 4: User Sidebar Typography Styling (`user-sidebar.tsx`)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
1. **Lack of Visual Feedback During Itinerary Generation**: When AI invokes `createTripProposal` or performs complex multi-day reasoning, there is a 5–15 second pause. Since previous parts (such as weather) have already rendered, the system's `isThinking` flag turns off, leaving the user with zero indication that planning is in progress, leading them to believe the system has crashed or frozen.
2. **Missing Rich Icons & Verified Badges**: The generated itinerary lacks the aesthetic flair of Mindtrip (e.g., `Day 1 – 🏯 Trái tim Hoàng thành Bắc Kinh`, `☀️ Morning:`, `🌤️ Afternoon:`, `🌙 Evening:`, category symbols like `🏛️`, `🍽️`, `📍`, and verified blue checkmark badges `✓`). Relying solely on LLM prompt engineering often yields inconsistent formatting; a deterministic frontend decorator is needed.
3. **Suboptimal Suggested Places Placement**: Suggested places currently render immediately when `searchPlaces` emits, interrupting the natural reading order before the day-by-day itinerary is presented. Users want suggested places to appear at the very bottom of the response.
4. **Faded Sidebar Typography**: User sidebar navigation items use muted gray (`text-sidebar-foreground/80`), making the navigation text look disabled or washed out in light mode. Users want crisp black text (`text-neutral-900` / `font-medium`).
5. **Static Place Cards Grid Instead of Mindtrip Carousel**: Suggested places currently render as a 2-column grid instead of a sleek horizontal carousel featuring hover left/right arrow controls, heart favorite button, and a plus (`+`) button to add the place directly into the mapped trip's ideas.

---

### 1.2 User Journey & Flow
```text
[User Prompt: "Lên lịch trình 3 ngày Bắc Kinh"]
       │
       ▼
[Phase A: Live Progress Feedback]
  • Weather retrieved ──► Render Weather Widget
  • Tool "createTripProposal" executing...
  • Visual Status Banner: "✨ Đang thiết kế lịch trình chi tiết và phân bổ từng ngày..."
       │
       ▼
[Phase B: Rich Itinerary Content]
  • Render Day 1 / Day 2 / Day 3 with curated icons (Day header, ☀️ Morning, 🌤️ Afternoon, 🌙 Evening)
  • Verified place names decorated with blue checkmark badge (✓)
       │
       ▼
[Phase C: Bottom Suggested Places Carousel (Mindtrip Style)]
  • Rendered at the bottom of the message
  • Smooth horizontal scroll with snap-x
  • Hover displays circular Left (<) & Right (>) arrow controls
  • Place Card:
      - Top-right Heart button: Save place to collections
      - Top-right Plus (+) button: Add place directly to Trip Ideas (of mapped trip)
      - Place name, category icon (🏨 Hotel, 🍽 Restaurant, etc.), rating
```

---

### 1.3 Scope Boundaries
- **In-Scope**:
  - Continuous streaming progress banner in `apps/web/tripsense/src/components/chat/message.tsx` when `isLoading === true` and the model is in tool execution or between chunks.
  - Markdown text enricher / decorator in `apps/web/tripsense` for day headers, time-of-day emojis, and inline blue verified badges `✓`.
  - Re-ordering message parts so that `PlaceCards` consistently renders at the bottom of the assistant message.
  - Refactoring `apps/web/tripsense/src/components/chat/place-cards.tsx` to a horizontal carousel with hover navigation arrows (`<`, `>`).
  - Adding Heart (Save) and Plus (Add to Trip Ideas) action buttons to each place card.
  - Updating `apps/web/tripsense/src/components/layout/user/user-sidebar.tsx` text color to crisp black (`text-neutral-900 dark:text-neutral-100`).
  - System prompt alignment in `services/ai-service/src/ai/prompts.ts` for clean day-by-day markdown generation.
- **Out-of-Scope**:
  - Rebuilding the Trip Service database schema (using existing itinerary items / notes API for ideas).
  - External social network integrations.

---

### 1.4 Acceptance Criteria
- [ ] **AC-1 (Progress Indicator)**: While `isLoading` is true and `createTripProposal` is executing or generating, the UI displays a pulsing, animated status banner (`Đang thiết kế lịch trình chi tiết và tối ưu hóa tuyến đường...`) without leaving the message blank.
- [ ] **AC-2 (Itinerary Rich Icons)**: Day titles render with milestone icons (`Day 1 – 🏯 ...`), time slots render with `☀️ Morning:`, `🌤️ Afternoon:`, `🌙 Evening:` (or Vietnamese equivalents), and recognized places feature an inline blue verified check badge `✓`.
- [ ] **AC-3 (Placement Ordering)**: In every assistant response containing place suggestions, the place carousel renders at the bottom, directly beneath the itinerary summary and above message actions.
- [ ] **AC-4 (Sidebar Typography)**: Sidebar navigation items display in crisp dark/black (`text-neutral-900 dark:text-neutral-100 font-medium`) in both collapsed and expanded states.
- [ ] **AC-5 (Place Carousel & Hover Arrows)**:
  - Place cards are arranged in a horizontal row (`flex gap-3 overflow-x-auto snap-x`).
  - Hovering over the carousel reveals floating Left (`<`) and Right (`>`) arrow buttons with circular backdrop.
  - Clicking arrows smoothly scrolls left/right by ~260px.
- [ ] **AC-6 (Place Card Actions)**:
  - Each card has a top-right Heart icon for saving to collections.
  - Each card has a top-right Plus (`+`) icon. Clicking `+` when the chat is linked to a trip (`chat.tripId`) calls the Trip Service API to add the place to the trip's ideas list and displays visual confirmation.

---

## 2. Architecture & Component Design

### 2.1 Interaction & Data Flow
```text
┌────────────────────────────────────────────────────────────────────────┐
│                        apps/web/tripsense                              │
│                                                                        │
│  PreviewMessage (message.tsx)                                          │
│  ├── Weather Widget (Top Context)                                      │
│  ├── Rich Message Response (Decorated Markdown with Icons & Badges)    │
│  ├── Active Agent Progress Banner (when isLoading === true)            │
│  └── Suggested Places Carousel (PlaceCards.tsx - Bottom Placement)     │
│       ├── Left/Right Scroll Controls (on hover)                        │
│       ├── Heart Button ──► useSavedPlacesStore / Social Service        │
│       └── Plus (+) Button ──► createItineraryItem ──► [trip-service]   │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Specifications

#### A. Active Agent Progress Indicator (`apps/web/tripsense/src/components/chat/message.tsx`)
```tsx
interface ActiveAgentStatusProps {
  toolName?: string;
  toolArgs?: any;
  hasItineraryProposal?: boolean;
}

export function ActiveAgentStatus({ toolName, toolArgs }: ActiveAgentStatusProps) {
  let label = "Đang suy nghĩ và phân tích yêu cầu...";
  if (toolName === "createTripProposal") {
    label = "Đang thiết kế lịch trình chi tiết và phân bổ từng ngày...";
  } else if (toolName === "searchPlaces") {
    label = "Đang tìm kiếm và xác thực các địa điểm nổi bật...";
  } else if (toolName === "getWeather") {
    label = "Đang kiểm tra thông tin thời tiết địa phương...";
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 my-2 w-fit text-xs font-medium text-primary shadow-2xs">
      <Sparkles className="size-3.5 animate-pulse text-primary shrink-0" />
      <span className="animate-pulse">{label}</span>
      <Loader2 className="size-3 animate-spin text-primary/70 shrink-0 ml-1" />
    </div>
  );
}
```

#### B. Rich Itinerary Text Decorator (`apps/web/tripsense/src/components/chat/rich-itinerary-decorator.tsx`)
- Post-processes markdown text nodes to inject or standardize:
  - Day titles: `Day \d+\s*[-–]\s*([^\n]+)` $\rightarrow$ Styled header with landmark icon (`🏯`, `⛩️`, `🏛️`).
  - Time slots:
    - `Morning:` / `Sáng:` $\rightarrow$ `☀️ Morning:`
    - `Afternoon:` / `Chiều:` $\rightarrow$ `🌤️ Afternoon:`
    - `Evening:` / `Tối:` $\rightarrow$ `🌙 Evening:`
  - Places & Verified Check:
    - Recognized bold place patterns `\*\*([^*]+)\*\*` or `📍 Place✓` $\rightarrow$ Decorated with `<span className="inline-flex items-center gap-1 font-semibold text-foreground">...<CheckCircle2 className="size-3 text-sky-500 fill-sky-500 text-white inline-block" /></span>`.

#### C. Place Carousel with Hover Navigation (`apps/web/tripsense/src/components/chat/place-cards.tsx`)
```tsx
interface PlaceCardsProps {
  places: PlaceSearchResult[];
  query?: string;
  total?: number;
  activeTripId?: string | null;
}
```
- **Ref Container**: `const scrollContainerRef = useRef<HTMLDivElement>(null);`
- **Hover Controls**:
  - `scrollBy({ left: -280, behavior: "smooth" })` for Left button.
  - `scrollBy({ left: 280, behavior: "smooth" })` for Right button.
- **Card Action Bar**:
  - Heart icon button (`toggleFavorite`).
  - Plus (`+`) icon button:
    ```tsx
    const handleAddToTripIdeas = async (place: PlaceSearchResult) => {
      if (!activeTripId) {
        toast.info("Chuyến đi chưa được liên kết với đoạn chat này.");
        return;
      }
      await createItineraryItem(activeTripId, firstDayId, {
        title: place.name,
        type: "NOTE",
        notes: `Gợi ý từ AI: ${place.address}`,
      });
      toast.success(`Đã thêm "${place.name}" vào ý tưởng chuyến đi!`);
    };
    ```

#### D. Sidebar Typography (`apps/web/tripsense/src/components/layout/user/user-sidebar.tsx`)
- Replace:
  ```tsx
  // Before:
  isActive
    ? "bg-neutral-200/90 text-foreground font-semibold shadow-2xs dark:bg-neutral-800 dark:text-foreground"
    : "text-sidebar-foreground/80 hover:bg-neutral-200/70 hover:text-foreground dark:hover:bg-neutral-800 font-medium"
  ```
- With:
  ```tsx
  // After:
  isActive
    ? "bg-neutral-200/90 text-neutral-900 font-semibold shadow-2xs dark:bg-neutral-800 dark:text-white"
    : "text-neutral-900 hover:bg-neutral-200/70 hover:text-black dark:text-neutral-100 dark:hover:bg-neutral-800 font-medium"
  ```
- Ensure icon has `text-neutral-900 dark:text-neutral-100`.

---

## 3. API & Data Contracts

### 3.1 Trip Idea Integration Contract
When user clicks `+` on a place card in `PlaceCards`:
- **API Call**: `POST /api/trips/{tripId}/itinerary/days/{dayId}/items`
- **Request Body**:
```json
{
  "title": "Manxin Mansion Tiananmen",
  "type": "NOTE",
  "notes": "Địa điểm gợi ý từ TripSense AI Assistant",
  "placeRef": "place-uuid-if-available"
}
```
- **Response**: `201 Created` with `ItineraryItemResponse`.

---

## 4. Security & Trust Boundaries
- **Ownership Verification**: Adding places to trip ideas uses existing API Gateway JWT forwarding (`Bearer <access-token>`). The `trip-service` validates that `userId` owns or collaborates on `tripId`.
- **Zero-Leak Error Handling**: Any failure to add an idea place shows a sanitized toast notification; raw HTTP traces or DB errors are never displayed to the user.

---

## 5. Implementation Tasks & Order of Work

### Phase 1: Sidebar Typography Fix
- [ ] **Task 1.1**: Update `apps/web/tripsense/src/components/layout/user/user-sidebar.tsx` navigation text and icons to `text-neutral-900 dark:text-neutral-100`.

### Phase 2: AI Message Reordering & Progress Feedback
- [ ] **Task 2.1**: In `apps/web/tripsense/src/components/chat/message.tsx`, partition message parts so that `searchPlaces` (PlaceCards) is separated and rendered at the **very bottom** of the assistant message.
- [ ] **Task 2.2**: Add `ActiveAgentStatus` component to `message.tsx` that displays whenever `isLoading === true` and the message is in active generation or tool execution.

### Phase 3: Itinerary Rich Text Formatting & Verified Badges
- [ ] **Task 3.1**: Update `services/ai-service/src/ai/prompts.ts` with structured Day header formatting, time-of-day emojis (`☀️ Morning`, `🌤️ Afternoon`, `🌙 Evening`), and place emoji conventions.
- [ ] **Task 3.2**: Create `apps/web/tripsense/src/components/chat/rich-itinerary-decorator.tsx` to automatically inject missing emojis and render the inline blue verified badge `✓`.

### Phase 4: Mindtrip Places Carousel with Hover Controls
- [ ] **Task 4.1**: Refactor `apps/web/tripsense/src/components/chat/place-cards.tsx` to horizontal snap scroll.
- [ ] **Task 4.2**: Add floating Left (`<`) and Right (`>`) arrow buttons that appear on hover.
- [ ] **Task 4.3**: Implement Heart icon (save) and Plus (`+`) icon (add to trip ideas) with `useTripStore` active trip mapping.

### Phase 5: Verification & Testing
- [ ] **Task 5.1**: Run `npx tsc --noEmit` in `apps/web/tripsense` to verify type safety.
- [ ] **Task 5.2**: Run `npm test` in `apps/web/tripsense` to ensure all 44 test suites pass.
- [ ] **Task 5.3**: Visual review of the chat itinerary, place carousel, and sidebar.

---

## 6. Approval Gate

`STATUS: WAITING_FOR_HUMAN_APPROVAL`

No application source code has been modified during planning. Awaiting explicit user approval before proceeding with Phase 1–5 implementation.
