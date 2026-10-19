# AI Planner Flexible Date Retention — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense`, `services/ai-service`
- **Affected Components**:
  - `apps/web/tripsense`: `src/features/trip-management/utils/date.ts`, `src/components/chat/shell.tsx`, `src/components/chat/trip-detail-panel.tsx`
  - `services/ai-service`: `src/routes/chat.ts`, `src/ai/tools/update-trip-planning-brief.ts`
- **Created Date**: 2026-10-19
- **Target PR Boundaries**: [Phase 1: Flexible Note Detection & Frontend State Retention, Phase 2: Trip Detail Panel & AI Context Awareness, Phase 3: Tests & Verification]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Bug Report
Khi người dùng chọn thời gian theo chế độ **Linh hoạt** (ví dụ: "2 ngày trong tháng 11" trên `WhenModal`), hệ thống tính toán ngày tạm thời (provisional dates: `2026-11-01` đến `2026-11-02`) để thỏa mãn ràng buộc database `@NotNull LocalDate startDate, endDate` của `trip-service`. Đồng thời, hệ thống lưu ghi chú cấu hình linh hoạt vào trường `trip.notes` dưới dạng:
`Travel preference: 2 days flexible (Tháng 11)`.

Tuy nhiên, sau khi gửi prompt hoặc khi chuyến đi được liên kết/tải lại từ server:
1. Trong `shell.tsx` (`loadLinkedTrip` tại dòng 240, và `tripIdParam` tại dòng 153), hàm tải chuyến đi đã ghi đè thô bạo:
   `when: { type: "dates", startDate: trip.startDate, endDate: trip.endDate }`
   làm mất cờ `type: "flexible"`, mất `durationDays: 2`, và mất `flexibleMonths: ["Tháng 11"]`.
2. Do đó, thanh Header (`chat-header.tsx`) bị chuyển nhãn từ *"2 ngày trong Tháng 11"* thành *"1 – 2 thg 11"*. Khi người dùng mở lại modal When, modal cũng tự nhảy sang tab Dates cố định ngày 1 đến ngày 2 tháng 11.
3. Bảng chi tiết chuyến đi bên phải (`trip-detail-panel.tsx`) hiển thị ngày theo hàm `formatShortRange(trip.startDate, trip.endDate)` $\rightarrow$ *"1 – 2 thg 11"* thay vì hiển thị dạng thời gian linh hoạt.
4. Trong `ai-service` (`routes/chat.ts` dòng 169), `fetchTripSummary` gửi vào system prompt của Gemini:
   `Thời gian: 2026-11-01 đến 2026-11-02`
   khiến AI hiểu nhầm người dùng đi đúng ngày 1-11 đến 2-11 và sinh lịch trình gắn cứng vào 2 ngày này.
5. Trong `update-trip-planning-brief.ts` dòng 519, khi AI tạo `tripDraft`, trường `notes` bị đặt thành `null` làm mất thông tin linh hoạt nếu chuyến đi được khởi tạo từ AI tool.

### 1.2 User Journey & Expected Experience
1. **Chọn thời gian linh hoạt**: Người dùng mở When modal, chọn tab *Linh hoạt*, chọn *2 ngày*, chọn *Tháng 11*.
2. **Hiển thị nhất quán**:
   - Thanh Header pill hiển thị: **"2 ngày trong Tháng 11"**.
   - Bảng chi tiết chuyến đi (TripDetailPanel) hiển thị: **"2 ngày trong Tháng 11 (Linh hoạt)"**.
3. **Sau khi gửi prompt**:
   - Dù chat có re-fetch hay liên kết chuyến đi, trạng thái `tripPreferences.when` vẫn giữ nguyên:
     `{ type: "flexible", durationDays: 2, flexibleMonths: ["Tháng 11"], startDate: "2026-11-01", endDate: "2026-11-02" }`.
   - Header và TripDetailPanel **không bị đổi thành 1-11 -> 2-11**.
   - Khi click vào nút When trên Header, modal mở lại đúng tab *Linh hoạt* với cấu hình đã chọn.
4. **AI Context chuẩn xác**:
   - AI nhận diện đây là chuyến đi 2 ngày linh hoạt trong tháng 11 (tạm thời neo mốc đầu tháng để lập khung giờ), không trả lời áp đặt cứng nhắc ngày 1/11 - 2/11 nếu người dùng chưa chốt ngày chính xác.

### 1.3 Scope Boundaries
- **In-Scope**:
  - Viết helper `parseFlexiblePreferenceFromNotes(notes?: string | null)` trong `date.ts`.
  - Cập nhật `loadLinkedTrip`, `tripIdParam` loader, và `getPlanningBrief` loader trong `shell.tsx` để bảo toàn `type: "flexible"` khi `trip.notes` hoặc `brief` chứa cấu hình linh hoạt.
  - Cập nhật `trip-detail-panel.tsx` để hiển thị nhãn thời gian linh hoạt khi phát hiện chuyến đi linh hoạt.
  - Cập nhật `services/ai-service/src/routes/chat.ts` (`fetchTripSummary` và fallback `effectiveBrief`) để truyền đạt đúng tính chất linh hoạt cho mô hình ngôn ngữ.
  - Cập nhật `update-trip-planning-brief.ts` để gán ghi chú linh hoạt vào `tripDraft.notes` khi tạo chuyến đi từ brief.
  - Bổ sung unit test kiểm chứng logic parse và kiểm thử hồi quy `shell-trip-linking`.
- **Out-of-Scope**:
  - Không sửa đổi database schema PostgreSQL hay migration của `trip-service` (vẫn duy trì `@NotNull startDate, endDate` làm anchor cho các bảng ngày `itinerary_day`).

### 1.4 Acceptance Criteria
- [ ] **AC-1 (Header Pill Retention)**: Sau khi chọn linh hoạt (ví dụ: 2 ngày, Tháng 11) và gửi prompt cho AI, thanh Header pill vẫn hiển thị *"2 ngày trong Tháng 11"*, không bị chuyển thành *"1 – 2 thg 11"*.
- [ ] **AC-2 (TripDetailPanel Retention)**: Panel chi tiết chuyến đi bên phải hiển thị *"2 ngày trong Tháng 11"* thay vì cố định *"1 – 2 thg 11"*.
- [ ] **AC-3 (WhenModal Re-open State)**: Bấm vào nhãn When trên Header hoặc Panel sau khi chat, modal hiển thị đúng tab *Linh hoạt* với 2 ngày và Tháng 11 được chọn sẵn.
- [ ] **AC-4 (AI Prompt Context)**: Prompt context truyền cho Gemini thể hiện rõ thời gian là 2 ngày linh hoạt trong tháng 11.
- [ ] **AC-5 (Automated Tests)**: Toàn bộ unit tests cho `date.ts`, `sidebar-flyout`, `trip-intake-card`, `shell` đều PASS 100%.

---

## 2. Technical Architecture & Component Changes

### 2.1 Note Serialization & Deserialization
Format ghi chú chuẩn:
`Travel preference: ${durationDays} days flexible${flexibleMonths.length > 0 ? ` (${flexibleMonths.join(", ")})` : ""}`

Helper `parseFlexiblePreferenceFromNotes`:
```ts
export function parseFlexiblePreferenceFromNotes(notes?: string | null): {
  durationDays: number;
  flexibleMonths?: string[];
} | null {
  if (!notes) return null;
  const match = notes.match(/Travel preference:\s*(\d+)\s*days\s*flexible(?:\s*\(([^)]+)\))?/i);
  if (!match) return null;
  const durationDays = parseInt(match[1], 10);
  const monthsStr = match[2];
  const flexibleMonths = monthsStr
    ? monthsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  return { durationDays, flexibleMonths };
}
```

### 2.2 Frontend State Invariants (`shell.tsx`)
Khi nạp `trip` từ server trong `loadLinkedTrip`, `useEffect([tripIdParam])`, và `getPlanningBrief`:
```ts
const flexibleInfo = parseFlexiblePreferenceFromNotes(trip.notes);
const isFlexible = Boolean(
  flexibleInfo ||
  (brief?.when as any)?.type === "flexible" ||
  tripPreferences.when?.type === "flexible"
);

setTripPreferences({
  where: { location: trip.destinationName, isRoadTrip: false },
  when: isFlexible
    ? {
        type: "flexible",
        durationDays: flexibleInfo?.durationDays || (brief?.when as any)?.durationDays || tripPreferences.when?.durationDays || 3,
        flexibleMonths: flexibleInfo?.flexibleMonths || (brief?.when as any)?.flexibleMonths || tripPreferences.when?.flexibleMonths || [],
        startDate: trip.startDate,
        endDate: trip.endDate,
      }
    : { type: "dates", startDate: trip.startDate, endDate: trip.endDate },
  ...
});
```

### 2.3 Trip Detail Panel (`trip-detail-panel.tsx`)
```ts
const dateRangeStr = React.useMemo(() => {
  const flexibleInfo = parseFlexiblePreferenceFromNotes(trip.notes);
  if (flexibleInfo) {
    return formatWhenSelection({
      type: "flexible",
      durationDays: flexibleInfo.durationDays,
      flexibleMonths: flexibleInfo.flexibleMonths,
      locale,
    });
  }
  if (!trip.startDate || !trip.endDate) return "Chưa chọn ngày";
  return formatShortRange(trip.startDate, trip.endDate);
}, [trip.notes, trip.startDate, trip.endDate, locale]);
```

### 2.4 AI Service Prompt Context (`services/ai-service/src/routes/chat.ts`)
```ts
const flexibleMatch = trip.notes?.match(/Travel preference:\s*(\d+)\s*days\s*flexible(?:\s*\(([^)]+)\))?/i);
const timeSummary = flexibleMatch
  ? `${flexibleMatch[1]} ngày linh hoạt${flexibleMatch[2] ? ` (${flexibleMatch[2]})` : ""} (tạm neo ${trip.startDate} đến ${trip.endDate})`
  : `${trip.startDate} đến ${trip.endDate}`;

let summary = `- Tên chuyến đi: "${trip.name}" | Điểm đến: ${trip.destinationName} | Thời gian: ${timeSummary} | Số người: ${trip.travelerCount || 1}`;
```

---

## 3. Implementation Tasks

1. **Task 1: Add `parseFlexiblePreferenceFromNotes` helper & tests**
   - Location: `apps/web/tripsense/src/features/trip-management/utils/date.ts`
   - Test: `apps/web/tripsense/src/features/trip-management/utils/__tests__/date.test.ts`
2. **Task 2: Fix state retention in `shell.tsx`**
   - Location: `apps/web/tripsense/src/components/chat/shell.tsx`
   - Target lines: 151-160, 238-248, 285-298.
3. **Task 3: Update `trip-detail-panel.tsx` date range formatting**
   - Location: `apps/web/tripsense/src/components/chat/trip-detail-panel.tsx`
   - Target lines: 312-316.
4. **Task 4: Update `services/ai-service` prompt context & brief draft notes**
   - Location: `services/ai-service/src/routes/chat.ts` and `services/ai-service/src/ai/tools/update-trip-planning-brief.ts`
5. **Task 5: Verification & Quality Gate**
   - Run vitest `src/components/chat` and `src/features/trip-management`.
   - Run `npm run type-check`.
   - Run `npm run i18n:check`.

---

## 4. Approval Gate

STATUS: WAITING_FOR_HUMAN_APPROVAL
Do not modify application code until the user approves this plan.
