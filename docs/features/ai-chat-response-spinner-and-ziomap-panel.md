# AI Chat Spinning Response Indicator & Clean Mindtrip MapVina Split Panel — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense`, `services/ai-service`
- **Created Date**: 2026-11-16
- **Updated Date**: 2026-11-16 (Revised per user direction: No auto-open Trip Detail; clean MapVina with 0 background POIs showing destination city pin on `Where` and strictly AI-returned places on prompt)
- **Target PR Boundaries**:
  - **Phase 1**: Mindtrip Rotating AI Response Indicator (`message.tsx`, i18n)
  - **Phase 2**: Opt-in Clean Mindtrip Mode cho `MapVinaContainer` & Shared Geo Helpers (`mapvina-container.tsx`, `utils/map.ts`, `create-trip-proposal.ts`)
  - **Phase 3**: Unified Right Split Panel (`ChatZioMapPanel` làm mặc định, bỏ auto-open `TripDetailPanel`, trích xuất chặt chỉ địa điểm AI trả ra)
  - **Phase 4**: Tests, Static Quality Gates & Regression Check

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Dựa trên các ảnh UI mẫu Mindtrip và yêu cầu chốt của người dùng:

1. **Nút/Avatar phản hồi AI quay vòng khi đang chạy (`AiResponseAvatar`)**:
   - Trong [message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx#L568-L574) và `ThinkingMessage` ([message.tsx](../../apps/web/tripsense/src/components/chat/message.tsx#L624-L628)), avatar bên trái câu trả lời `assistant` đang đứng yên dù AI đang thinking/streaming.
   - Yêu cầu: Vòng cung tròn mảnh (~270°) quay quanh tâm trong lúc AI đang chạy (`isLoading === true` / `ThinkingMessage`) — tâm hiển thị chấm nhỏ khi mới khởi tạo (`"Just a sec..."`) rồi chuyển sang `✦` (`SparklesIcon`) khi bắt đầu có nội dung/tool, và dừng quay khi hoàn tất.

2. **Không tự động trượt mở `TripDetailPanel` — Mặc định cột bên phải là ZioMap (`MapVinaContainer`)**:
   - Hiện tại trong [shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx#L371), [shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx#L526) và [shell.tsx](../../apps/web/tripsense/src/components/chat/shell.tsx#L254), mỗi khi trip được tạo hoặc link vào chat, `setIsTripDetailOpen(true)` tự động trượt mở bảng chi tiết chuyến đi (`TripDetailPanel`), và nút `<MapIcon />` bên trong `TripDetailPanel` mới chỉ là biến boolean chưa render bản đồ.
   - Yêu cầu mới: **KHÔNG tự động trượt mở `TripDetailPanel`**. Cột bên phải trong AI Chat ưu tiên hiển thị **bản đồ ZioMap (`MapVinaContainer`)** với đúng format khung phải của `TripDetailPanel` (`w-full md:w-[50%] lg:w-[48%] xl:w-[46%]`, `rounded-l-2xl lg:rounded-l-3xl border-l shadow-xl`, thu gọn `w-14` & nút đóng `X`). Khi nào người dùng muốn xem chi tiết lịch trình/tabs (`TripDetailPanel`) thì **chủ động bấm vào nút chuyến đi trên Header** (hoặc nút chuyển sang Trip Detail).

3. **MapVina sạch chuẩn Mindtrip (Chỉ hiện thành phố khi chọn `Where`, chỉ hiện địa điểm AI trả ra khi prompt)**:
   - **Khi chọn `Where` (ví dụ: `"Đà Nẵng"`) — Chưa prompt hoặc chưa có kết quả địa điểm từ AI:**
     - Bản đồ trượt mở ngay tại Đà Nẵng trên cột phải (`md+`).
     - **KHÔNG hiển thị bất kỳ địa điểm/POI nào trên bản đồ** (cả địa điểm từ DB catalog lẫn POI nền mặc định của vector map như hàng quán/cây xăng/tạp hóa).
     - Chỉ hiển thị **duy nhất 1 ghim thành phố chuẩn Mindtrip** (vòng tròn trắng + icon pin đen ở giữa + nhãn tên `"Đà Nẵng"` / `"Da Nang"` bên cạnh, không kèm sao đánh giá giả hay badge thừa — đúng như ảnh mẫu).
   - **Khi người dùng gửi prompt & AI trả kết quả:**
     - Chỉ render lên MapVina **đúng những địa điểm mà AI thực sự trả ra cho người dùng** (`recommendPlaces`, `createTripProposal`, `addItineraryItems`, `replaceItineraryItem`, hoặc `searchPlaces` nếu lượt đó không có `recommendPlaces`/`createTripProposal`) — không tự gọi `/api/places/nearby` và không đổ danh sách ứng viên thô chưa được AI chọn (`prepareTripCandidates`) lên bản đồ.
     - Ẩn ghim thành phố mặc định ngay khi có ≥ 1 địa điểm từ AI và tự động `fitBounds` ôm trọn các ghim AI.

---

### 1.2 User Flows & Journey

```text
1. Chọn "Where" (ví dụ: Đà Nẵng) trên ChatHeader
   └──► [Desktop md+]: Cột phải tự trượt mở MapVina sạch tại toạ độ Đà Nẵng
        • Ẩn POI nền vector map (hideBuiltInPois=true)
        • 0 marker địa điểm, chỉ 1 City Pin trắng "Đà Nẵng"

2. User gửi prompt (ví dụ: "Lên lịch trình 3 ngày Đà Nẵng" hoặc "Gợi ý quán cafe yên tĩnh")
   ├──► [Cột trái]: Avatar AI hiện vòng cung mảnh quay quay + text ngắn gọn
   │                (và hộp tiến trình tool khi đang chạy)
   └──► [Cột phải]: Bản đồ vẫn giữ nguyên ở khung MapVina (KHÔNG tự nhảy sang TripDetailPanel)
        • Ngay khi AI trả createTripProposal / recommendPlaces / searchPlaces:
          -> Tự động bỏ City Pin chung
          -> Chỉ ghim đúng các địa điểm AI vừa trả ra + autoFitBounds
        • Kể cả khi AI tự động tạo & link Trip (auto-commit):
          -> Vẫn giữ cột phải ở MapVina, đồng bộ pin với itinerary đã commit

3. Người dùng muốn xem chi tiết lịch trình đầy đủ (Itinerary / Ideas / Bookings / ...)
   └──► Chủ động click vào nút Trip trên ChatHeader (hoặc nút chuyển sang Trip Detail)
        └──► Khung phải chuyển sang TripDetailPanel
             • Trong TripDetailPanel, bấm <MapIcon /> hoặc "Định vị trên ZioMap" ở từng card
               sẽ quay lại ngay chế độ MapVina (có lọc Ngày 1, Ngày 2... + focus pin đó).
```

---

### 1.3 Scope Boundaries

- **In-Scope**:
  - `apps/web/tripsense/src/components/chat/message.tsx`: Component `AiResponseAvatar` cho `PurePreviewMessage` & `ThinkingMessage`.
  - `apps/web/tripsense/src/features/map/components/mapvina-container.tsx` & `types/index.ts`:
    - Bổ sung props **opt-in** (giữ nguyên mặc định cho `/places`, `/trips`, `/community` không bị ảnh hưởng):
      - `hideBuiltInPois?: boolean`: khi `true`, duyệt `mapInstance.getStyle().layers` tại sự kiện `load` / `styledata` để đặt `visibility: "none"` cho các layer POI/business/transit icon & label của vector tile `streets.json`, đồng thời giữ nguyên đường, cầu, sông biển, mảng xanh và tên thành phố/quận/phường.
      - `disableBasePoiClick?: boolean`: tắt bắt click/hover POI nền bản đồ (tránh popup ngẫu nhiên không phải địa điểm AI).
      - `destinationPin?: { name: string; lat: number; lng: number } | null`: render ghim thành phố tối giản kiểu Mindtrip (vòng tròn trắng + pin đen + tên thành phố bên cạnh) khi `places.length === 0`.
      - `navigationPosition?: "top-right" | "bottom-right"` & `recenterControl?: boolean`: đặt cụm control gọn ở góc dưới-phải giống ảnh mẫu.
      - Theo dõi thay đổi `center` / `destinationPin` khi `places.length === 0` để `flyTo` mượt khi user đổi `Where` (hiện tại `mapvina-container.tsx` chỉ đọc `initialCenterRef` lúc mount).
  - `apps/web/tripsense/src/features/trip-management/utils/map.ts`: Dùng chung `getDestinationCenter` + `inferDestinationFromPrompt` (chuyển từ `trip-detail-screen.tsx`).
  - `apps/web/tripsense/src/components/chat/chat-ziomap-panel.tsx`: Panel MapVina dành riêng cho AI Chat theo đúng kích thước/bo góc/collapse strip của `TripDetailPanel`, hỗ trợ:
    - Bộ lọc ngày (`Tất cả ngày / Ngày 1...`) khi đã có proposal nhiều ngày hoặc itinerary.
    - Nút `Vừa khung (Fit Map)`, nút chuyển nhanh sang `Chi tiết chuyến đi` (khi đã có `activeTrip`), tích hợp `PlaceDetailModal`.
  - `apps/web/tripsense/src/components/chat/shell.tsx`, `chat-header.tsx`, `trip-detail-panel.tsx`:
    - Hợp nhất state cột phải thành `rightPanelMode: "closed" | "map" | "trip-detail"`.
    - Chọn `Where` -> tự mở `rightPanelMode = "map"` (trên desktop `md+`).
    - Link/tạo Trip -> **giữ nguyên `"map"` (không tự bật `"trip-detail"`)**; chỉ chuyển `"trip-detail"` khi user chủ động click nút Trip trên Header hoặc bấm xem chi tiết.
    - Trích xuất `aiReturnedPlaces` theo quy tắc nghiêm ngặt: ưu tiên địa điểm từ `itinerary` (khi đã có trip & items), `createTripProposal` (chỉ các activities trong proposal), `recommendPlaces` (`curatedPlaces`), và `searchPlaces` chỉ khi lượt đó không đi kèm `recommendPlaces`/`createTripProposal`; bỏ qua `prepareTripCandidates`. Hydrate tọa độ còn thiếu qua `getPlaceBatchSnapshots`.
  - `services/ai-service/src/ai/tools/create-trip-proposal.ts` & `apps/web/tripsense/src/lib/types.ts`: Thêm `location?: { lat: number; lng: number }` từ `canonical?.location` trong output activity của `createTripProposal` (không sửa schema input hay DB).
  - Cập nhật `en.json` và `vi.json` đúng chuẩn A–Z parity (`npm run i18n:check`).

- **Out-of-Scope**:
  - Không thay đổi bản đồ ở `/places` hay `/trips/[tripId]` (vẫn giữ behavior hiện tại vì mọi option mới trên `MapVinaContainer` là opt-in).
  - Không đổi DB schema, không tạo service hay REST endpoint mới.

---

### 1.4 Acceptance Criteria

- [x] **AC-1 (AI Response Spinner)**: Khi AI đang thinking hoặc streaming (`isLoading === true`), avatar bên trái tin nhắn AI hiển thị vòng cung ~270° quay quanh tâm (`motion-safe:animate-spin`); khi stream xong, dừng quay về viền tĩnh, khung chữ không nhảy layout.
- [x] **AC-2 (Chọn `Where` -> Tự trượt mở Map sạch 0 địa điểm)**: Ở AI Chat, khi bấm chọn `Where` (ví dụ `Đà Nẵng`) trên desktop `md+`, khung phải tự trượt mở MapVina căn đúng tọa độ Đà Nẵng, ẩn POI nền vector, có **0 marker địa điểm** và chỉ **1 City Pin tối giản `"Đà Nẵng"`**. Đổi `Where` sang thành phố khác -> bản đồ `flyTo` sang thành phố mới.
- [x] **AC-3 (Không tự mở Trip Detail)**: Khi Trip được tạo tự động hoặc liên kết với đoạn chat (`linkCreatedTrip` / `tripsense:chat-trip-linked` / `CreateTripModal`), giao diện **KHÔNG** tự nhảy sang `TripDetailPanel`; cột phải tiếp tục giữ chế độ Map. Chỉ khi người dùng tự click nút Trip trên `ChatHeader` (hoặc nút xem chi tiết) mới mở `TripDetailPanel`.
- [x] **AC-4 (Chỉ hiển thị địa điểm do AI trả ra)**: Khi người dùng gửi prompt và AI trả kết quả, bản đồ chỉ ghim đúng những địa điểm xuất hiện trong output trả cho người dùng (`createTripProposal`, `recommendPlaces`, `itinerary` đã lưu, hoặc `searchPlaces` trực tiếp) — không ghim địa điểm ngoài kết quả AI trả ra hay POI nền bản đồ.
- [x] **AC-5 (Chuyển đổi 2 chiều Map ↔ Trip Detail)**: Khi đang ở `TripDetailPanel`, bấm `<MapIcon />` hoặc *"Định vị trên ZioMap"* chuyển mượt về `Map` (lọc theo ngày / focus pin); bấm lại nút Trip chuyển về `TripDetailPanel`. Trên mobile (`< md`), map chỉ mở khi user chủ động bấm nút Map ở header.
- [x] **AC-6 (Quality Gates)**: `services/ai-service` `npm test` (64/64) và `apps/web/tripsense` (`i18n:check`, `type-check`, `eslint` 0 lỗi, Vitest `13/13` files `58/58` tests) pass 100%.

---

## 2. Architecture & Technical Feasibility Note

### 2.1 Cách MapVina ẩn POI nền & giữ Map sạch như Mindtrip
- `MapVinaContainer` sử dụng `mapvina-gl` (tương thích API MapLibre GL JS).
- Khi load vector style `https://maps.mapvina.com/styles/v2/streets.json?key=...`, mọi thành phần trên nền bản đồ đều nằm trong `map.getStyle().layers`. Với `hideBuiltInPois = true`:
  - Ngay trong sự kiện `styledata` / `load`, gọi `applyCleanMindtripStyle(map)` duyệt `style.layers` và ẩn (`setLayoutProperty(layer.id, "visibility", "none")`) các layer symbol/icon có ID hoặc `source-layer` thuộc nhóm POI/business/transit (`poi`, `place_of_worship`, `shop`, `amenity`, `hospital`, `school`, `restaurant`, `hotel`, `attraction`, `aerodrome`), trong khi **giữ nguyên 100%** đường giao thông, số hiệu quốc lộ (`CT01`, `QL14B`, `AH17`...), sông/biển, mảng xanh, địa giới và nhãn tên thành phố/quận/xã.
  - Khóa sự kiện click/hover POI nền bằng `if (disableBasePoiClickRef.current) return;`.
- **Ghi chú minh bạch theo môi trường**: Nếu `NEXT_PUBLIC_MAPVINA_API_KEY` chưa được cấu hình và app dùng raster `FALLBACK_STYLE` (Carto Voyager PNG), bản đồ raster có nhãn cố định ít chi tiết trong ảnh PNG (không có layer vector riêng để ẩn thêm), nhưng lớp marker tương tác của app vẫn được kiểm soát hoàn toàn (0 pin quán xá khi chọn `Where`, 100% chỉ ghim điểm của AI khi có kết quả).

---

## 3. Data Flow & AI Places Extraction Rules

```text
Nguồn hiển thị Marker trên ChatZioMapPanel (Ưu tiên từ trên xuống):
1. Đã có activeTrip && itinerary có ≥ 1 item có tọa độ:
   -> Chỉ lấy items trong itinerary.days (lọc theo selectedDayNumber nếu chọn ngày)
   -> Tọa độ: (item.latSnapshot, item.lngSnapshot) ?? placeSnapshots[placeRef]?.location
2. Ngược lại, trích xuất từ messages (chỉ lấy kết quả AI trả về hiển thị cho user):
   a) Nếu lượt chat đã có tool `createTripProposal` mới nhất:
      -> Chỉ lấy activities trong `proposal.days` (lọc theo selectedDayNumber nếu có)
   b) Kết hợp/hiển thị các `recommendPlaces` curated places (bỏ trùng ID)
   c) Chỉ lấy `searchPlaces` ở những assistant message KHÔNG có `recommendPlaces` & KHÔNG có `createTripProposal`
   d) KHÔNG BAO GIỜ đổ `prepareTripCandidates` (danh sách 20+ ứng viên nền) lên map!
   -> Với điểm thiếu `location` nhưng có `placeId`, hydrate nền 1 lượt bằng `getPlaceBatchSnapshots`
3. Nếu danh sách pin hợp lệ sau bước (1)-(2) = rỗng (ví dụ mới chọn Where = "Đà Nẵng"):
   -> Pass `places={[]}` và `destinationPin={{ name, lat, lng }}` từ `getDestinationCenter`
```

---

## 4. Kế Hoạch Triển Khai An Toàn Theo Từng Phase

### Phase 1: AI Response Spinning Button (`AiResponseAvatar`) — ✅ DONE
**Mục tiêu:** Thay đổi giao diện nút/avatar AI đang chạy — phạm vi hẹp, không đụng map hay routing, kiểm thử xong ngay.
- **Files đã chỉnh:**
  - `apps/web/tripsense/src/components/chat/message.tsx`
  - `apps/web/tripsense/src/components/chat/__tests__/message-recommend-places.test.tsx`
  - `apps/web/tripsense/src/locales/en.json`, `vi.json`
- **Tasks:**
  1. [x] Tạo `AiResponseAvatar({ isRunning, isInitializing })` khóa cố định `size-8 shrink-0`.
  2. [x] Khi `isRunning === true`: render vòng cung SVG 270° mảnh `motion-safe:animate-spin` bao quanh tâm (chấm tròn ở `ThinkingMessage` / `!hasAnyContent`, `<SparklesIcon size={15} />` khi đang stream nội dung/tool).
  3. [x] Khi `isRunning === false`: render viền tròn tĩnh nhẹ + `<SparklesIcon size={15} />`.
  4. [x] Cập nhật `PurePreviewMessage` & `ThinkingMessage` dùng `AiResponseAvatar` và viết test Vitest kiểm tra `data-ai-running` + không lỗi render.
- **Checkpoint an toàn (Passed):** `npm run i18n:check`, `npm run type-check`, `npx eslint` (0 errors), Vitest `4/4` test files (`17/17` tests) passed.

---

### Phase 2: Clean Mindtrip Mode trên `MapVinaContainer` & Proposal Location — ✅ DONE
**Mục tiêu:** Nâng cấp `MapVinaContainer` theo cơ chế opt-in 100% tương thích ngược, vá lỗ hổng tọa độ thành phố/Null Island và bổ sung tọa độ vào tool `createTripProposal`.
- **Files đã chỉnh / tạo:**
  - `apps/web/tripsense/src/features/map/types/index.ts`
  - `apps/web/tripsense/src/features/map/components/mapvina-container.tsx`
  - `apps/web/tripsense/src/features/map/components/mapvina-helpers.ts` & `mapvina-helpers.test.ts`
  - `apps/web/tripsense/src/features/trip-management/utils/map.ts`, `map.test.ts` & `trip-detail-screen.tsx`
  - `services/ai-service/src/ai/tools/create-trip-proposal.ts`
  - `apps/web/tripsense/src/lib/types.ts`
- **Tasks:**
  1. [x] Di chuyển `getDestinationCenter` sang `utils/map.ts` (giữ re-export ở `trip-detail-screen.tsx`), mở rộng phủ đủ **27 điểm đến trong `POPULAR_DESTINATIONS`** + các tỉnh thành VN phổ biến bằng `normalizeSearchText`, bổ sung `isValidCoordinate(lat, lng)` và `inferDestinationFromPrompt`.
  2. [x] Tạo helper thuần `shouldHideBuiltInMapLayer(layer)` & `hasValidPlaceLocation(place)` kèm unit tests `mapvina-helpers.test.ts`.
  3. [x] Tại `MapVinaContainer`, thêm các props **opt-in** (`hideBuiltInPois`, `disableBasePoiClick`, `destinationPin`, `navigationPosition`, `showWeatherBadge`) + `flyTo` ổn định theo `lastDestinationCameraKeyRef` và lifecycle cleanup `destinationMarkerRef`.
  4. [x] Tại `create-trip-proposal.ts`, trả thêm `location: canonical?.location || undefined` vào `normalizedDays[].activities[]` và cập nhật optional `location` trên `TripActivity`.
- **Checkpoint an toàn (Passed):** `services/ai-service` `npm test` (64/64), `npm run i18n:check`, `npm run type-check`, `npx eslint` (0 errors), Vitest `6/6` test files (`25/25` tests).

---

### Phase 3: Chat Map Panel, Chống Auto-Open Trip Detail & Lọc Chặt Điểm AI Trả Ra — ✅ DONE
**Mục tiêu:** Lắp ghép luồng trải nghiệm hoàn chỉnh trong AI Chat (`ChatShell` + `ChatZioMapPanel` + `TripDetailPanel` + `ChatHeader`) với đồng bộ realtime và không auto-open `TripDetailPanel`.
- **Files đã tạo / chỉnh:**
  - `apps/web/tripsense/src/components/chat/chat-map-places.ts`
  - `apps/web/tripsense/src/components/chat/chat-ziomap-panel.tsx`
  - `apps/web/tripsense/src/components/chat/shell.tsx`
  - `apps/web/tripsense/src/components/chat/chat-header.tsx`
  - `apps/web/tripsense/src/components/chat/trip-detail-panel.tsx`
  - `apps/web/tripsense/src/locales/en.json`, `vi.json`
- **Tasks:**
  1. [x] Tạo helper thuần `extractAiChatMapData` (`chat-map-places.ts`).
  2. [x] Tạo `ChatZioMapPanel` dùng `dynamic(..., { ssr: false })` + Clean Mindtrip flags + Day selector + `Fit Map` + `PlaceDetailModal`.
  3. [x] Tại `shell.tsx`, hợp nhất `rightPanelMode: "closed" | "map" | "trip-detail"`, bỏ toàn bộ auto-open `TripDetailPanel` tại `?tripId`, `linkCreatedTrip`, `tripsense:chat-trip-linked`, đồng bộ `getItinerary` + hydrate `getPlaceBatchSnapshots` 1 lần/ID + phát `tripsense:sidebar-toggle`.
  4. [x] Tại `chat-header.tsx` & `trip-detail-panel.tsx`, thêm `<MapIcon />` header toggle, kích hoạt `<MapIcon />` tab bar và thêm *"Định vị trên ZioMap"* ở menu thẻ.
- **Checkpoint an toàn (Passed):** `i18n:check`, `type-check`, `eslint`, Vitest passing.

---

### Phase 4: Verification, Tests & Edge-Case Audit — ✅ DONE
**Mục tiêu:** Bao phủ test tự động cho mọi logic trích xuất, ranh giới UI và chất lượng tĩnh.
- **Tasks:**
  1. [x] Unit test `chat-map-places.test.ts` (Where 0 pin, chặn `prepareTripCandidates`, ưu tiên `recommendPlaces`, direct `searchPlaces`, lọc ngày & fallback `placeSnapshots`, `missingPlaceIds` & `getWeather`).
  2. [x] Component tests: `chat-ziomap-panel.test.tsx`, `trip-detail-panel.test.tsx`, `message-recommend-places.test.tsx`, `mapvina-helpers.test.ts`, `map.test.ts`.
  3. [x] Chạy đầy đủ verification gates:
     - `services/ai-service`: `npm test` -> `64/64` pass.
     - `apps/web/tripsense`: `npm run i18n:check` pass, `npm run type-check` pass, `npx eslint` 0 errors, Vitest `13/13` files (`58/58` tests) pass.

---

## Completion Status

```text
STATUS: DONE
```
