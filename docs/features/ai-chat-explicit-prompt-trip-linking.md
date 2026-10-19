# AI Chat Explicit Prompt & Trip Linking — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense` (`shell.tsx`, `create-trip-modal.tsx`, `use-active-chat.tsx`), `services/trip-service`, `services/ai-service`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: [Phase 1: Decouple Trip Linking from Auto-Prompt Dispatch, Phase 2: Create-Trip-Modal Prompt Reservation, Phase 3: Tests & UI Verification]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Hiện tại trên màn hình AI Planner (`apps/web/tripsense/src/components/chat/shell.tsx`), khi người dùng hoàn thành chọn điểm đến (**Where**) và thời gian (**When**) trên giao diện chính (thanh Header pills hoặc Greeting intake card), hàm `autoCreateAndLinkTrip` sau khi tạo chuyến đi đã gọi trực tiếp `handleTripCreated(newTrip)`. Hàm này vô tình kích hoạt ngay việc gửi tin nhắn người dùng kèm directive AI (`sendMessage({ parts: [{ text: fullMessageText, type: "text" }], role: "user" })`), khiến AI tự động sinh lịch trình khi người dùng chưa có yêu cầu cụ thể.

Người dùng mong muốn:
1. **Ở ngoài giao diện (Header pills, Greeting card)**: Khi chọn Where & When, hệ thống **chỉ tạo trip và liên kết vào cuộc trò chuyện hiện tại**, cập nhật `activeTrip`, badge liên kết và URL `tripId`. **Tuyệt đối không tự động gửi prompt cho AI**.
2. **Chỉ khi dùng Modal tạo chuyến đi (`create-trip-modal.tsx`) hoặc nhập prompt thủ công**: Người dùng chủ động cung cấp yêu cầu và nhấn nút Tạo, lúc này hệ thống mới gửi câu prompt đến AI để sinh lịch trình.

### 1.2 User Flows & Journey

#### Flow 1: Chọn Where & When ngoài giao diện (Silent Link Flow)
1. Người dùng vào `/ai-planner`, chọn điểm đến (Ví dụ: "Đà Nẵng") và thời gian (Ví dụ: "3 ngày linh hoạt").
2. Hệ thống kiểm tra xác thực (yêu cầu đăng nhập nếu là khách) và gọi API `POST /api/v1/trips` để tạo chuyến đi.
3. Hệ thống liên kết chuyến đi với `chatId`, cập nhật `activeTrip`, URL param `tripId`, và hiển thị toast thông báo: *"Đã tạo chuyến đi 'Chuyến đi Đà Nẵng' và liên kết với cuộc trò chuyện này"*.
4. **Không gửi tin nhắn/prompt nào cho AI**. Giao diện chat vẫn giữ nguyên danh sách tin nhắn hiện tại, cho phép người dùng tự do gõ prompt câu hỏi hoặc tùy chỉnh thêm khi sẵn sàng.

#### Flow 2: Dùng Modal "Create Trip" (Explicit Prompt Flow)
1. Người dùng bấm nút **Tạo chuyến đi** (Header hoặc Chat action) để mở `CreateTripModal`.
2. Người dùng nhập câu nhắc (prompt), ví dụ: *"Chuyến đi 5 ngày đến Tokyo tháng 10 này"*, chọn Where, When, Who.
3. Người dùng bấm **Tạo**:
   - Hệ thống tạo chuyến đi qua `POST /api/v1/trips`.
   - Hệ thống liên kết chuyến đi vào cuộc trò chuyện.
   - Hệ thống **gửi câu prompt** kèm chỉ dẫn AI (`sendMessage`) để AI bắt đầu sinh lịch trình ngay lập tức.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Tách bạch hàm liên kết chuyến đi `linkCreatedTrip(trip: TripResponse)` khỏi hàm gửi prompt `handleTripCreatedWithPrompt(trip: TripResponse, initialPrompt?: string)`.
  - Cập nhật `autoCreateAndLinkTrip` trong `shell.tsx` chỉ gọi `linkCreatedTrip(trip)` mà không gửi prompt.
  - Cập nhật `create-trip-modal.tsx` và callback `onTripCreated` để chỉ luồng modal mới kích hoạt gửi prompt sinh lịch trình.
  - Cập nhật i18n thông báo toast: thay vì *"bắt đầu lên lịch trình"*, chỉ thông báo *"đã tạo và liên kết chuyến đi"*.
  - Bổ sung/cập nhật unit test cho `shell.tsx` và `create-trip-modal.tsx`.
- **Out-of-Scope**:
  - Không thay đổi backend API của `services/trip-service` hay `services/ai-service`.
  - Không thay đổi cấu trúc bảng cơ sở dữ liệu.

### 1.4 Acceptance Criteria
- [ ] **AC-1 (No Auto Prompt from Outer UI)**: Khi người dùng chọn Where và When từ Greeting/Intake card hoặc Header pill ngoài giao diện:
  - Hệ thống gọi `createTrip` thành công và gán vào `activeTrip`.
  - Hệ thống đồng bộ URL `?tripId=...` và hiển thị badge liên kết chuyến đi.
  - **Không có bất kỳ tin nhắn nào được gửi đến AI** (`sendMessage` không được gọi, không hiển thị message bong bóng trong chat).
- [ ] **AC-2 (Prompt Triggered from Modal)**: Khi người dùng bấm Tạo từ `CreateTripModal`:
  - Hệ thống tạo trip, liên kết vào chat, VÀ gửi tin nhắn prompt đến AI (`sendMessage` được gọi đúng 1 lần).
- [ ] **AC-3 (Toast Notification Accuracy)**: Toast thông báo khi chọn ngoài giao diện thể hiện đúng hành động liên kết, không hứa hẹn AI đang sinh lịch trình tự động.
- [ ] **AC-4 (Regression & Parity)**: Toàn bộ kiểm thử unit test cho `shell.tsx`, `create-trip-modal.tsx` đều PASS. Schema i18n (`en.json`, `vi.json`) giữ nguyên 100% parity.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[User selects Where & When in Header/Greeting]
       │
       ▼
[autoCreateAndLinkTrip() in shell.tsx]
       │
       ├───> POST /api/v1/trips (Trip Service via Gateway)
       │         │
       │         ▼
       │     Trip created with ID
       │
       └───> linkCreatedTrip(trip)
                 │
                 ├── Set activeTrip state & ref
                 ├── Update URL: ?tripId=<id>
                 ├── Show Toast: "Created & Linked Trip"
                 └── [STOP - DO NOT CALL sendMessage()]

─────────────────────────────────────────────────────────────

[User opens CreateTripModal, inputs prompt, clicks "Tạo"]
       │
       ▼
[CreateTripModal -> onTripCreated(trip, prompt)]
       │
       ▼
[handleTripCreatedWithPrompt(trip, prompt) in shell.tsx]
       │
       ├── linkCreatedTrip(trip)
       └── sendMessage({ parts: [{ text: promptWithDirective, type: "text" }] })
                 │
                 ▼
          [AI Service streams itinerary proposal]
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Quản lý UI state, điều phối tạo trip và quyết định thời điểm gửi prompt | Client-side React State |
| `services/trip-service` | Lưu trữ chuyến đi (`POST /api/v1/trips`, `PUT /api/v1/trips/{id}`) | Synchronous REST |
| `services/ai-service` | Xử lý tin nhắn chat và sinh lịch trình khi nhận prompt | SSE / Streaming REST |

### 2.3 Architecture Guardrails Verification
- [x] Tuân thủ phân định trách nhiệm: Client không tự ý giả lập hành vi prompt của người dùng khi người dùng chưa đồng thuận.
- [x] Không query chéo database, không thay đổi service boundaries.
- [x] Giữ nguyên API contract hiện tại của `trip-service` và `ai-service`.

---

## 3. Implementation Plan & Detailed Changes

### 3.1 Refactoring `apps/web/tripsense/src/components/chat/shell.tsx`

1. **Tách hàm `linkCreatedTrip`**:
```typescript
const linkCreatedTrip = useCallback(
  (newTrip: TripResponse) => {
    activeTripRef.current = newTrip;
    setActiveTrip(newTrip);
    setIsTripDetailOpen(true);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tripId", newTrip.id);
      window.history.replaceState(null, "", url.toString());
    }
  },
  []
);
```

2. **Hàm `handleTripCreatedWithPrompt` (dành riêng cho Modal Create Trip)**:
```typescript
const handleTripCreatedWithPrompt = useCallback(
  async (newTrip: TripResponse, initialPrompt?: string) => {
    linkCreatedTrip(newTrip);

    // Tính số ngày và travelers
    let durationDays = 3;
    if (newTrip.startDate && newTrip.endDate) {
      const start = Date.parse(`${newTrip.startDate}T00:00:00Z`);
      const end = Date.parse(`${newTrip.endDate}T00:00:00Z`);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        durationDays = Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
      }
    }
    const travelers = newTrip.travelerCount || 1;
    const dest = newTrip.destinationName;

    const userFacingText = initialPrompt?.trim()
      ? initialPrompt.trim()
      : locale === "vi"
      ? `Lên lịch trình du lịch ${dest} (${durationDays} ngày, ${travelers} khách)`
      : `Plan a ${durationDays}-day trip to ${dest} (${travelers} traveler${travelers > 1 ? "s" : ""})`;

    const hiddenDirective = `<!-- ai-directive: Người dùng vừa tạo chuyến đi "${newTrip.name}" đến ${dest} (${durationDays} ngày, ${travelers} khách). Hãy lập tức dùng searchPlaces tìm kiếm các địa điểm thực tế uy tín tại ${dest} và gọi createTripProposal để sinh lịch trình hoàn chỉnh chi tiết cho tất cả ${durationDays} ngày. Không hỏi lại các thông tin cơ bản. -->`;

    sendMessage({
      parts: [{ text: `${userFacingText}\n\n${hiddenDirective}`, type: "text" }],
      role: "user",
    });
  },
  [linkCreatedTrip, locale, sendMessage]
);
```

3. **Cập nhật `autoCreateAndLinkTrip`**:
```typescript
// Chỉ liên kết trip, KHÔNG gửi prompt
linkCreatedTrip(newTrip);
toast.success(
  t("aiPlanner.tripCreated", { tripName: newTrip.name })
);
```

4. **Cập nhật Props truyền cho `CreateTripModal`**:
```typescript
<CreateTripModal
  isOpen={isCreateTripModalOpen}
  onClose={() => setIsCreateTripModalOpen(false)}
  onTripCreated={(trip, prompt) => handleTripCreatedWithPrompt(trip, prompt)}
  // ...
/>
```

---

## 4. Verification & Testing Strategy

### 4.1 Unit Tests
- `apps/web/tripsense/src/components/chat/__tests__/shell-trip-linking.test.tsx`:
  - Test Case 1: Khi `autoCreateAndLinkTrip` hoàn tất, `createTrip` được gọi, `activeTrip` được set, nhưng `sendMessage` **KHÔNG ĐƯỢC GỌI**.
  - Test Case 2: Khi `onTripCreated` của `CreateTripModal` kích hoạt, `createTrip` được gọi VÀ `sendMessage` **ĐƯỢC GỌI** với prompt người dùng.
- Chạy `npm test` để xác nhận tất cả test suites đều xanh.

### 4.2 Type-Check & i18n Parity
- Chạy `npm run type-check` (`tsc --noEmit`).
- Chạy `npm run i18n:check` để đảm bảo không phát sinh lỗi bản dịch.

---

## 5. Review & Approval Status

- [ ] Product & UX Review: Approved.
- [ ] Architecture Review: Approved.
- [ ] Testing Strategy: Approved.

`STATUS: WAITING_FOR_HUMAN_APPROVAL`
