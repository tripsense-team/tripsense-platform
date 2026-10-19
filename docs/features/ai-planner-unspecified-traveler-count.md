# AI Planner Unspecified Traveler Count — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`, `services/ai-service`, `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense/src/components/chat/*`, `services/ai-service/src/ai/tools/update-trip-planning-brief.ts`, `services/ai-service/src/routes/chat.ts`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: [Phase 1 (AI Service & Intake Brief Contract), Phase 2 (Web Client Chat Shell, Header Pill & Modals), Phase 3 (Automated Unit & Integration Tests)]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Khi người dùng tạo chuyến đi thông qua AI Chat hoặc chọn nhanh Điểm đến (Where) và Thời gian (When), hệ thống hiện đang tự động gán mặc định số lượng người là `1 khách` (1 traveler). 
Tuy nhiên, người dùng yêu cầu: **Khi người dùng chưa chủ động thêm số lượng người, hệ thống tuyệt đối không được tự động điền "1 khách"**.
- Nút pill "Số người" trên thanh công cụ vẫn phải giữ nguyên placeholder "Số người" (`t("trip.intakeWho")`), thay vì hiển thị "1 khách".
- Trường `travelerCount` trong entity `Trip` và trong payload tạo chuyến đi phải là `null` / `undefined`, không ép thành `1`.
- Chỉ khi người dùng chủ động mở modal Who và chọn số người (hoặc nói rõ trong prompt như "2 người", "gia đình 4 người"), hệ thống mới cập nhật `travelerCount`.

### 1.2 User Flows & Journey
1. **Flow A — Header Quick Intake (Where & When only)**:
   - Người dùng click chọn "Bạn muốn đi đâu?" -> Chọn "Đà Lạt".
   - Người dùng click chọn "Khi nào bạn đi?" -> Chọn 2 ngày linh hoạt trong tháng 11.
   - Hệ thống tự động tạo chuyến đi liên kết với chat: `travelerCount` gửi sang backend là `null`/`undefined`.
   - Header hiển thị: Điểm đến: "Đà Lạt", Thời gian: "2 ngày trong Thg 11", Số người: **"Số người"** (placeholder ban đầu).
   - Chi tiết chuyến đi (`trip-detail-panel.tsx`) hiển thị tag số người là "Số người" (hoặc "Who"), không hiển thị "1 khách".

2. **Flow B — Conversational Chat Intake via Gemini**:
   - Người dùng nhắn: "Tôi muốn đi Đà Lạt 3 ngày".
   - Gemini trích xuất `where: { destinationText: "Đà Lạt" }` và `when: { durationDays: 3 }`.
   - Tool `updateTripPlanningBrief` cập nhật brief nhưng **không** tự động inject `who: { adults: 1, children: 0, infants: 0, pets: 0 }`.
   - Trip auto-commit tạo chuyến đi với `travelerCount = null`.
   - Giao diện client nhận state và hiển thị pill "Số người" chưa chọn.

3. **Flow C — Explicit Who Selection**:
   - Người dùng click vào pill "Số người", modal `WhoModal` mở ra.
   - Người dùng bấm Lưu (hoặc điều chỉnh số lượng): lúc này `tripPreferences.who` mới được thiết lập và đồng bộ cập nhật lên chuyến đi.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Loại bỏ logic tự động gán `merged.who = { adults: 1, ... }` trong `services/ai-service/src/ai/tools/update-trip-planning-brief.ts`.
  - Hỗ trợ `travelerCount: null` trong `services/ai-service/src/ai/trip-commit.ts` và `chat.ts`.
  - Cập nhật `shell.tsx` trong `apps/web/tripsense`: `totalTravelers` và `travelerCount` không fallback về `1` nếu `whoData` chưa được cung cấp.
  - Cập nhật `chat-header.tsx`: chỉ format nhãn số người khi `tripPreferences?.who` thực sự tồn tại và tổng số người > 0.
  - Cập nhật `trip-detail-panel.tsx`: hiển thị placeholder đa ngôn ngữ `t("trip.intakeWho")` khi `trip.travelerCount` là null.
  - Cập nhật `create-trip-modal.tsx`: không tự động ép `initialTravelers = 1` nếu người dùng chưa cấu hình.
- **Out-of-Scope**:
  - Không sửa đổi schema database hay JPA Entity của `trip-service` vì `traveler_count` đã hỗ trợ nullable (`Integer travelerCount` không có `@NotNull`).

### 1.4 Acceptance Criteria
- [ ] **AC-1**: Khi tạo chuyến đi tự động qua Where & When ở Header Chat, `travelerCount` trong payload `createTrip` là `undefined`/`null`, backend lưu `traveler_count = null`.
- [ ] **AC-2**: Pill "Số người" trên Header của AI Chat (`chat-header.tsx`) hiển thị nhãn `t("trip.intakeWho")` ("Số người" / "Who") khi chuyến đi chưa có `travelerCount`.
- [ ] **AC-3**: Tool `updateTripPlanningBrief` trong `services/ai-service` không tự động inject `who: { adults: 1, ... }` khi thỏa mãn Where & When.
- [ ] **AC-4**: Tag hiển thị trên `trip-detail-panel.tsx` hiển thị đúng i18n placeholder "Số người" nếu `trip.travelerCount` là `null`.
- [ ] **AC-5**: Toàn bộ unit tests tại `apps/web/tripsense` và `services/ai-service` pass 100%.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow
```text
[User / Next.js Web]
   |-- (Where & When selected)
   +--> POST /api/v1/trips { destinationName, startDate, endDate, travelerCount: null }
   |       \--> [API Gateway :8080] --> [trip-service :8082] (Persists traveler_count = NULL)
   |
   +--> AI Chat Header renders:
           [ Where: "Đà Lạt" ] [ When: "2 ngày..." ] [ Who: "Số người" ]
```

### 2.2 Service Ownership & Communication
| Component | Responsibility | Communication |
| --- | --- | --- |
| `apps/web/tripsense` | Shell, Chat Header, Modal Create Trip: không fallback travelerCount về 1 | REST / State Store |
| `services/ai-service` | `updateTripPlanningBrief`: giữ `who` là `undefined` nếu user không nhắc đến | In-memory / Internal Tool |
| `services/trip-service` | Lưu `traveler_count` trong DB (đã là nullable) | JPA / PostgreSQL |

---

## 3. Detailed Changes by Component

### 3.1 `services/ai-service/src/ai/tools/update-trip-planning-brief.ts`
- Xóa bỏ việc tự động gán `merged.who = { adults: 1, children: 0, infants: 0, pets: 0 };` tại dòng 407-409 khi Where & When thỏa mãn.
- Trong đoạn tạo `tripDraft`:
  ```ts
  const who = merged.who;
  ...
  travelerCount: who ? who.adults + who.children + who.infants : null,
  ```

### 3.2 `services/ai-service/src/routes/chat.ts` & `trip-commit.ts`
- `chat.ts`:
  - Dòng 174: Không format `| Số người: ${trip.travelerCount || 1}`, chỉ thêm `| Số người: ${trip.travelerCount}` khi `trip.travelerCount != null`.
  - Dòng 1094: Chuyển `who: t.travelerCount ? { adults: t.travelerCount, children: 0, infants: 0, pets: 0 } : undefined`.
- `trip-commit.ts`:
  - `TripDraft.travelerCount`: chuyển thành `number | null`.

### 3.3 `apps/web/tripsense/src/components/chat/shell.tsx`
- Trong `autoCreateAndLinkTrip`:
  - `totalTravelers`:
    ```ts
    const totalTravelers = whoData
      ? whoData.adults + whoData.children + whoData.infants
      : undefined;
    ```
  - `createTrip` payload:
    ```ts
    travelerCount: totalTravelers && totalTravelers > 0 ? totalTravelers : undefined,
    ```
- Trong `handleTripCreatedWithPrompt`:
  - `const travelers = newTrip.travelerCount;`
  - Nếu `travelers` không có, không format `, ${travelers} khách` vào user-facing prompt text và hidden directive.

### 3.4 `apps/web/tripsense/src/components/chat/chat-header.tsx`
- Đảm bảo `whoLabel`:
  ```ts
  let whoLabel = t("trip.intakeWho");
  if (tripPreferences?.who) {
    const total =
      tripPreferences.who.adults +
      tripPreferences.who.children +
      tripPreferences.who.infants;
    if (total > 0) {
      whoLabel =
        total === 1
          ? t("trip.travelerCountOne")
          : t("trip.travelerCountMultiple", { count: total });
    }
  }
  ```

### 3.5 `apps/web/tripsense/src/components/chat/trip-detail-panel.tsx`
- Cập nhật tag hiển thị số lượng người sang i18n:
  ```tsx
  <span>
    {trip.travelerCount
      ? (locale === "vi" ? `${trip.travelerCount} khách` : `${trip.travelerCount} traveler${trip.travelerCount > 1 ? "s" : ""}`)
      : (t("trip.intakeWho") || "Số người")}
  </span>
  ```

### 3.6 `apps/web/tripsense/src/components/chat/modals/create-trip-modal.tsx`
- Sửa `initialTravelers`: không mặc định `initialTravelers = 1`.
- Nếu chưa có `initialTravelers` và người dùng chưa mở `WhoModal`, `whoCounts` là `undefined`.
- Hiển thị nút Who: `{whoSummaryText || t("trip.intakeAddPeople") || "Add people"}`.
- Khi bấm Tạo: `travelerCount: totalTravelers && totalTravelers > 0 ? totalTravelers : undefined`.

---

## 4. Test & Verification Plan

1. **Unit Tests (`services/ai-service`)**:
   - Chạy `npm test` trong `services/ai-service`.
   - Bổ sung test kiểm tra: khi gọi `updateTripPlanningBrief` chỉ có Where & When, `state.brief.who` là `undefined` và `tripDraft.travelerCount` là `null`.
2. **Unit Tests (`apps/web/tripsense`)**:
   - Chạy `npm run test -- apps/web/tripsense/src/components/chat`.
   - Kiểm tra `shell-trip-linking.test.tsx` và `create-trip-modal.test.tsx` tương thích với `travelerCount` nullable.
3. **Type-check & Parity**:
   - Chạy `npm run type-check` trong `apps/web/tripsense`.
