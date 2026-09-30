# AI Planner V2: Mindtrip Interactive Hover Sidebar & Flyout Drawer — Specification & Implementation Plan

`STATUS: DONE`



- **Owner Service**: `apps/web/tripsense` (Frontend) & `services/ai-service-v2` (Backend)
- **Affected Components**:
  - `apps/web/tripsense/src/components/layout/user/user-sidebar.tsx` (Expanded & Slim Icon Bar States)
  - `apps/web/tripsense/src/components/chat/sidebar-flyout.tsx` (Mindtrip Flyout Drawer UI)
  - `apps/web/tripsense/src/stores/use-ai-drawer-store.ts` (Hover State Machine & Drawer State)
  - `apps/web/tripsense/src/components/layout/user/user-layout.tsx` (Hover Container & Workspace Synchronization)
  - `apps/web/tripsense/src/components/chat/shell.tsx` (Chat Workspace Integration)
- **Created Date**: 2026-09-30
- **Target PR Boundaries**: [Phase 1: Mindtrip Sidebar Alignment, Phase 2: Hover State Machine & Transition, Phase 3: Visual Precision Polish, Phase 4: Verification & Automated Tests]

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Journey
Người dùng yêu cầu giao diện và hành vi đóng/mở của thanh Sidebar khi truy cập vào AI Planner V2 (`/ai-planner-v2`) phải hoạt động chính xác 100% theo chuẩn **Mindtrip**:
1. **Trạng thái Mặc định (Hình ảnh 2 — Khi chưa di chuột / Di chuột ra)**:
   - Sidebar ở dạng **Mở rộng (Expanded)** với đầy đủ logo `mindtrip.` (hoặc `tripsense.`), danh sách navigation có chữ và badge (ví dụ: `Chats 9`), nút `New chat` dạng viên thuốc tròn, thông tin tài khoản người dùng ở góc dưới và liên kết footer.
   - Bảng **Flyout Drawer** được đóng hoàn toàn (`closed`), nhường trọn vẹn không gian cho màn hình chat hội thoại.
2. **Trạng thái Di chuột vào (Hình ảnh 1 — Khi di chuột vào)**:
   - Khi người dùng rê chuột vào mục `Chats` (hoặc vùng sidebar), thanh sidebar lập tức co gọn thành **thanh icon mảnh (Slim Icon Bar)** ở sát mép trái.
   - Đồng thời, bảng trượt **Flyout Sidebar Drawer** lập tức mở ra bên cạnh:
     - Ô tìm kiếm nhanh (`Search...` pill).
     - Phím tắt `New chat`, `New trip`.
     - Nhóm `Update my assistant`: `Personalization`.
     - Nhóm `Trips`: Danh sách các chuyến đi có ảnh thumbnail bo tròn (hoặc icon vali fallback).
     - Nhóm `Chats`: Danh sách lịch sử chat có tiêu đề in đậm (bold) và phụ đề điểm đến (ví dụ: `Trip to Hue`, `Trip to Da Nang`).
3. **Trạng thái Di chuột ra (Hình ảnh 2 — Khi rời chuột khỏi sidebar & drawer)**:
   - Khi con trỏ chuột rời khỏi vùng Sidebar + Flyout Drawer để quay lại khu vực chat chính, Flyout Drawer sẽ mượt mà đóng lại.
   - Sidebar tự động bung rộng trở lại trạng thái ban đầu (Hình ảnh 2).
4. **Yêu cầu chi tiết**:
   - Từng chi tiết nhỏ nhất bao gồm **font chữ, cỡ chữ (font size), khoảng cách (margin/padding), icon, màu sắc và border** phải giống 100% hình ảnh tham khảo của Mindtrip.

---

### 1.2 So sánh chi tiết 2 Trạng thái (Pixel-Perfect Alignment)

| Thành phần | Trạng thái Chưa di chuột / Rời chuột (Hình ảnh 2) | Trạng thái Di chuột vào (Hình ảnh 1) |
| :--- | :--- | :--- |
| **Chiều rộng Sidebar** | `w-64` (256px) mở rộng | `w-14` (56px) thanh icon mảnh |
| **Logo** | Icon `Sparkles` + chữ thương hiệu `mindtrip.` (hoặc `tripsense.`) | Chỉ icon `Sparkles` căn giữa |
| **Menu Items** | Icon + Nhãn chữ: `Home`, `Chats` (active, badge 9), `Trips`, `Agents`, `Explore`, `Saved`, `Updates`, `Inspiration`, `Create` | Chỉ các icon căn giữa: Home, Chat (active black pill), Trips, Agents, Search, Heart, Bell, Send, Plus |
| **Nút "New chat"** | Nút pill tròn lớn full-width: `bg-neutral-100 dark:bg-neutral-800` | Thu nhỏ hoặc tích hợp bên trong Flyout Drawer |
| **User Profile** | Avatar tròn + Tên "Bảo Lê" + Handle `@...` + Icon `...` | Chỉ Avatar tròn căn giữa ở đáy thanh icon |
| **Footer Links** | `Company · Contact · Help`<br>`Terms · Privacy`<br>`© 2026 Mindtrip, Inc.` | Icon `Info` tròn căn giữa ở đáy thanh icon |
| **Flyout Drawer** | **ĐÓNG (Ẩn hoàn toàn)** | **MỞ (Docked/Floating sát thanh icon)**: Search pill, New chat, New trip, Personalization, Trips list, Chats list |

---

### 1.3 Scope Boundaries

- **In-Scope**:
  - Chuẩn hóa layout và styling của `UserSidebar` cho cả 2 trạng thái: Mở rộng (`w-64`) và Thu gọn icon (`w-14`) khớp 1:1 với hình ảnh.
  - Xây dựng cơ chế **Hover State Machine** với thời gian trễ chống nhấp nháy (Debounce/Grace period 150-200ms) để khi di chuột qua lại giữa sidebar và drawer không bị đóng đột ngột.
  - Khi hover vào menu `Chats` hoặc sidebar ➜ Mở Flyout Drawer + Thu gọn sidebar thành thanh icon mảnh (Hình ảnh 1).
  - Khi hover ra khỏi khu vực sidebar và flyout drawer ➜ Đóng Flyout Drawer + Mở rộng sidebar về mặc định (Hình ảnh 2).
  - Giữ nguyên cơ chế **Smart Prefetching** (tải trước danh sách Trips và Chats) và **Click-to-Load** (chỉ tải tin nhắn khi click, có cache 5 phút, không hover prefetch tin nhắn).
  - Đảm bảo 100% không làm ảnh hưởng hay vỡ layout ở các trang khác (`/explore`, `/places`, `/trips`, `/community`...).
- **Out-of-Scope**:
  - Không thay đổi backend streaming SSE của `services/ai-service-v2`.
  - Không thay đổi cơ sở dữ liệu.

---

### 1.4 Acceptance Criteria

- [ ] **AC-1**: Khi ở trang `/ai-planner-v2` mà chưa rê chuột vào sidebar (Hình ảnh 2), sidebar hiển thị dạng mở rộng `w-64` với logo chữ, danh sách menu có nhãn chữ, badge đếm số chat, nút `New chat` pill tròn, thông tin tài khoản người dùng và liên kết footer. Flyout drawer hoàn toàn ẩn.
- [ ] **AC-2**: Khi rê chuột (`hover`) vào mục `Chats` hoặc khu vực sidebar (Hình ảnh 1), sidebar tự động co thành thanh icon mảnh `w-14` và Flyout Drawer trượt mở ra mượt mà ngay sát cạnh thanh icon.
- [ ] **AC-3**: Con trỏ chuột có thể di chuyển tự do giữa thanh icon mảnh và Flyout Drawer để tìm kiếm, bấm nút, chọn chuyến đi hoặc chọn cuộc trò chuyện mà drawer không bị tắt giữa chừng.
- [ ] **AC-4**: Khi rê chuột ra ngoài (`mouse leave`) khỏi vùng sidebar + drawer về phía màn hình chat, Flyout Drawer tự động đóng lại và sidebar mở rộng trở lại (Hình ảnh 2).
- [ ] **AC-5**: Độ trễ ân hạn (Grace period) 150-200ms mượt mà, không giật lag hay rung màn hình khi di chuột nhanh.
- [ ] **AC-6**: Từng chi tiết font chữ (Inter/Sans), font size (11px, 12px, 13.5px, 14px), font weight (normal, medium, semibold, bold), border-radius, background colors và icon giống 100% hình ảnh tham khảo.
- [ ] **AC-7**: Tất cả các trang khác (`/explore`, `/places`, `/trips`, `/community`, `/chat`) hoạt động bình thường, giữ nguyên layout vốn có.

---

## 2. Architecture & Service Boundaries

### 2.1 Hover State Machine & Component Interaction Diagram

```text
       ┌────────────────────────────────────────────────────────┐
       │               User Mouse Movement                      │
       └──────────────────────────┬─────────────────────────────┘
                                  │
         Hover IN (Sidebar/Chats) │ Hover OUT (To Chat Area)
                                  ▼
                    ┌───────────────────────────┐
                    │  useAiDrawerStore         │
                    │  - isHovered: boolean     │
                    │  - openTimer / closeTimer │
                    └─────────────┬─────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 ▼                                 ▼
   ┌───────────────────────────┐     ┌───────────────────────────┐
   │ isHovered = TRUE          │     │ isHovered = FALSE         │
   │ (Hình ảnh 1)              │     │ (Hình ảnh 2)              │
   ├───────────────────────────┤     ├───────────────────────────┤
   │ 1. Sidebar: Slim (w-14)   │     │ 1. Sidebar: Expanded w-64 │
   │ 2. Flyout Drawer: VISIBLE │     │ 2. Flyout Drawer: HIDDEN  │
   └───────────────────────────┘     └───────────────────────────┘
```

### 2.2 Quản lý State Hover & Debounce

Tránh hiện tượng nhấp nháy (flicker) bằng cách bọc Sidebar và Flyout Drawer trong một vùng nhận diện tương tác duy nhất hoặc dùng timer debounce:

```ts
// useAiDrawerStore
interface AiDrawerState {
  isOpen: boolean;            // Hiển thị flyout drawer
  isHovered: boolean;         // Đang hover trong vùng sidebar + drawer
  searchQuery: string;
  selectedChatId: string | null;

  setHovered: (hovered: boolean) => void;
  setIsOpen: (open: boolean) => void;
  // ...
}
```

- Khi `onMouseEnter` trên Sidebar hoặc Flyout Drawer: Huỷ timer đóng đang chờ (nếu có), đặt `setHovered(true)` và `setIsOpen(true)`.
- Khi `onMouseLeave` khỏi cả hai: Bật timer 180ms. Nếu sau 180ms chuột không quay lại, đặt `setHovered(false)` và `setIsOpen(false)`.

---

## 3. UI Component & Typography Precision Specifications

### 3.1 Styling Chi tiết cho Trạng thái Mở rộng (Hình ảnh 2)

- **Container**: `w-64 border-r border-border/40 bg-background flex flex-col h-full text-foreground`
- **Brand Logo Header**:
  - `px-4 pt-5 pb-3 flex items-center gap-2`
  - Icon: `<Sparkles className="size-5 text-foreground fill-foreground" />`
  - Chữ: `<span className="font-bold text-[17px] tracking-tight">mindtrip.</span>` (hoặc `tripsense.`)
- **Navigation Links**:
  - Item height: `h-10 px-3 py-2 rounded-xl flex items-center gap-3.5 text-[13.5px] font-medium transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800/70`
  - Active item (`Chats`): `font-semibold text-foreground`
  - Badge (`Chats`): `ml-auto rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted-foreground text-xs font-semibold px-2 py-0.5 min-w-[20px] text-center`
- **Nút "New chat"**:
  - `w-full rounded-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200/90 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-foreground font-medium text-sm text-center transition-colors my-2.5 shadow-2xs`
- **User Profile Box**:
  - `mt-auto px-3 py-3 flex items-center gap-2.5 border-t border-transparent`
  - Avatar: `size-9 rounded-full ring-1 ring-border/50`
  - Tên: `text-sm font-semibold text-foreground truncate leading-tight`
  - Username: `text-xs text-muted-foreground truncate leading-tight mt-0.5`
  - Icon options: `<MoreHorizontal className="size-4 text-muted-foreground" />`
- **Footer Links**:
  - `px-3 pb-4 text-[11px] text-muted-foreground/75 leading-relaxed select-none space-y-1`

### 3.2 Styling Chi tiết cho Trạng thái Di chuột vào (Hình ảnh 1)

- **Slim Sidebar**:
  - `w-14 shrink-0 flex flex-col items-center py-4 border-r border-border/40 bg-background`
  - Icons: `size-5 text-muted-foreground hover:text-foreground transition-colors`
  - Active chat icon: `<MessageSquare className="size-5 fill-foreground text-foreground" />` với indicator pill đen
- **Flyout Drawer**:
  - `w-80 shrink-0 h-full flex flex-col bg-background border-r border-border/40 shadow-xl z-30`
  - Search pill: `bg-muted/50 rounded-full text-xs py-2 pl-9 pr-4`
  - Quick action links: `New chat`, `New trip` (`font-semibold text-xs`)
  - Update assistant: `Personalization` (`font-medium text-xs`)
  - Trips list: thumbnail `size-7 rounded-lg` + tên trip
  - Chats list: Tiêu đề in đậm (`font-bold text-xs`) + subtitle điểm đến (`text-[11px] text-muted-foreground`)

---

## 4. Data Model & Prefetching Architecture

- Không thay đổi schema DB.
- Giữ nguyên quy trình:
  - `prefetchUserTrips()` và `prefetchAiChats()` nạp trước metadata (0ms delay).
  - Tin nhắn chi tiết: nạp bằng **Click-to-Load** kèm TanStack Query cache 5 phút (`staleTime: 5 * 60 * 1000`).

---

## 5. Security & Trust Boundaries

- Auth context `X-User-Id` lấy an toàn từ `useAuthStore`.
- Input tìm kiếm là filter phía client, an toàn tuyệt đối với injection.
- Tất cả token và secret nằm an toàn ở backend.

---

## 6. Technical Tradeoffs & Devil's Advocate

| Vấn đề tiềm ẩn | Rủi ro | Giải pháp kỹ thuật |
| :--- | :--- | :--- |
| **Nhấp nháy khi rê chuột giữa sidebar và drawer** | Khi chuột đi qua khe hở giữa 2 cột, `mouseLeave` có thể kích hoạt làm drawer tắt mở liên tục. | Sử dụng **Grace Period Debounce (180ms)**: Khi chuột rời khỏi, đợi 180ms; nếu chuột đi vào drawer, huỷ lệnh đóng. Đồng thời bọc trong flex container chung để không có khoảng trống chết. |
| **Thiết bị cảm ứng / Mobile** | Mobile không có sự kiện `mouseEnter`/`mouseLeave`. | Dự phòng sự kiện `onClick`: chạm vào Chats trên mobile sẽ toggle drawer kèm backdrop. |
| **Hiệu năng animation** | Co dãn chiều rộng `width` có thể gây giật nếu layout re-flow liên tục. | Dùng Tailwind `transition-[width] duration-200 ease-out will-change-[width]` được GPU tăng tốc. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Mindtrip Sidebar Alignment (Hình ảnh 2 — Expanded Default)
- Cập nhật `UserSidebar` để khi ở trang `/ai-planner-v2` (mặc định chưa hover):
  - Hiển thị đầy đủ logo `mindtrip.` (hoặc `tripsense.`), các menu items có nhãn và badge `9`.
  - Hiển thị nút `New chat` pill tròn chuẩn Mindtrip.
  - Hiển thị user profile và footer links chuẩn xác theo font size và khoảng cách của Hình ảnh 2.

### Phase 2: Hover State Machine & Transition (Hình ảnh 1 — Hover State)
- Nâng cấp `useAiDrawerStore` với logic quản lý `isHovered`, `openDrawerWithHover()` và `closeDrawerWithGracePeriod()`.
- Gắn sự kiện `onMouseEnter` / `onMouseLeave` cho vùng Sidebar và Flyout Drawer.
- Khi hover vào mục `Chats` / Sidebar:
  - Sidebar co lại thành thanh icon mảnh `w-14` (Hình ảnh 1).
  - Flyout Drawer mở ra trượt nhẹ nhàng sát mép.
- Khi rời chuột ra khỏi vùng:
  - Sau 180ms, Flyout Drawer đóng lại và Sidebar mở rộng trở lại `w-64` (Hình ảnh 2).

### Phase 3: Visual Precision Polish
- Đối chiếu pixel font size (11px, 12px, 13.5px, 14px), font weight, màu badge và bo góc icon.
- Đảm bảo tuân thủ Typography Contract (không dùng `text-[10px]` hay `text-[9px]`, dùng `text-micro`).

### Phase 4: Verification & Automated Tests
- Kiểm thử unit test cho `useAiDrawerStore` và `use-ai-chats`.
- Kiểm thử tương tác đóng mở trên trình duyệt.
- Chạy toàn bộ test suite `npm test -- --passWithNoTests` và `npx tsc --noEmit`.

### Phase 5: Sidebar CTA & Navigation Refinement
- [x] Đổi CTA sidebar thành `Create a trip`, bỏ icon dấu cộng và căn giữa nội dung.
- [x] Xoá CTA phụ `New conversation`.
- [x] Xoá các mục `Explore`, `Collections`, `Help & Support` và tiêu đề nhóm `Menu`, `Account`.
- [x] Đổi icon của `Places & Map` thành icon kính lúp.
- [x] Chuyển CTA `Create a trip` xuống ngay sau danh sách điều hướng theo bố cục Mindtrip tham chiếu.
- [x] Tăng chiều cao hàng, khoảng cách dọc giữa các menu và khoảng thở trước CTA theo nhịp dọc Mindtrip.
- [x] Nới vùng chứa CTA để viền và bóng đổ không bị cắt ở cạnh dưới.
- [x] Giữ nguyên chiều cao hàng và khoảng cách dọc khi collapse để icon không dịch chuyển vị trí.
- [x] Thêm contract test bảo vệ cấu hình điều hướng và CTA mới.

---

## 8. Verification Commands

```bash
# 1. Type check
npx tsc --noEmit

# 2. Automated test suite
npm test -- --passWithNoTests

# 3. Targeted store and hook tests
npx vitest run src/stores/__tests__/use-ai-drawer-store.test.ts src/hooks/__tests__/use-ai-chats.test.ts
```

---

`STATUS: DONE`
