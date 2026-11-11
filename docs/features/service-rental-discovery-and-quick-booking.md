# Service & Rental Discovery Marketplace (Replace Sidebar "Khách sạn và đặt phòng") — Specification & Implementation Plan

`STATUS: DONE`

- **Owner Service**: `services/trip-service`, `apps/web/tripsense`
- **Affected Components**: `apps/web/tripsense`, `services/trip-service`, `services/api-gateway` (existing routes)
- **Created Date**: 2026-11-10
- **Related Features**: [Generic Travel Rental & Activity Services](./generic-travel-rental-and-services.md), [Unified Hotel & Restaurant Reservation Experience](./unified-hotel-restaurant-reservation-experience.md), [Partner Services Hub Navigation](./partner-services-hub-navigation.md), [Place Detail Map Overlay](./place-detail-map-overlay.md)
- **Target PR Boundaries**:
  - Phase 1: Backend Public Catalog Search Parity (`PublicRentalService`, `RestaurantService` query matching & `acceptingNew` visibility in `trip-service`)
  - Phase 2: Sidebar Repositioning & Unified Service Discovery Hub (`apps/web/tripsense` — replacing `/hotels` landing view with Service & Rental Marketplace + quick booking dialogs)
  - Phase 3: Hotel Stays Integration, i18n Parity, & Automated Regression Suite

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

Hiện tại mục đầu tiên ở Sidebar người dùng (`UserSidebar`) là **`Khách sạn và đặt phòng`** (`/hotels`, khóa i18n `trip.hotels.title`), mở ra `HotelWorkspace` -> `MindtripStaysDiscovery`:
1. Trang này chỉ phục vụ tìm kiếm khách sạn (`searchRealHotels`) — trong đó trộn nhiều khách sạn từ dữ liệu địa điểm bên ngoài chưa bật đặt phòng online ("Chưa kích hoạt đặt phòng online").
2. Hàng phân loại trong `MindtripStaysDiscovery` có tới 5 mục bị khóa giả (`For you`, `Experiences`, `Restaurants`, `Locations`, `Guides` — đều gắn `"Sắp ra mắt"`), không cho tìm các dịch vụ thực tế của đối tác TripSense.
3. Du khách muốn tìm **các dịch vụ cho thuê (xe máy, ô tô tự lái, đồ cắm trại, SUP...), nhà hàng đặt bàn, và khách sạn có phòng sẵn** ở một nơi tập trung, gõ search là thấy ngay các dịch vụ **đã có sẵn & đang mở đón khách** và **bấm đặt luôn ngay tại chỗ** thay vì phải tự đi tìm từng địa điểm trên bản đồ `/places`.

**Mục tiêu người dùng**:
- Đổi mục Sidebar đầu tiên từ **"Khách sạn và đặt phòng"** thành **"Dịch vụ & Đặt chỗ"** (EN: *"Services & Booking"*), tập trung vào **dịch vụ cho thuê & dịch vụ đặt chỗ trực tiếp có sẵn trên TripSense**.
- Mở vào trang này là thấy thanh tìm kiếm + các dịch vụ có sẵn (mặc định ưu tiên **Thuê xe & Dịch vụ** và các cơ sở đang mở nhận đặt ngay), cho phép search tức thì và bấm **Đặt thuê ngay / Đặt bàn ngay / Chọn phòng & Đặt ngay** trực tiếp trong dialog ngay trên trang.

### 1.2 User Flows & Journey

1. **Điều hướng từ Sidebar (Vị trí hợp lý)**:
   - Không đặt **`Dịch vụ & Đặt chỗ`** ở vị trí đầu tiên trên `UserSidebar` (đầu sidebar dành cho khám phá & tương tác chính: `Địa điểm & Bản đồ`, `Cộng đồng`, `Trò chuyện`).
   - Đặt **`Dịch vụ & Đặt chỗ`** (`/services`) ở ngay trước **`Đơn đặt của tôi`** (`/reservations`) — tạo luồng hợp lý theo thứ tự: Khám phá (`Places`, `Community`, `Chat`) -> Lập lịch & Đặt dịch vụ (`My Trips` -> **`Dịch vụ & Đặt chỗ`** -> **`Đơn đặt của tôi`**) -> `Đã lưu` -> `Lên kế hoạch AI`.
   - Route `/hotels` giữ tương thích ngược và mở vào cùng hub (mặc định tab Khách sạn khi có `?category=hotels`).
2. **Xem sẵn các dịch vụ đang mở đặt (Zero-Friction Landing)**:
   - Ngay khi vào trang (với điểm đến mặc định `"Tất cả"` để không ẩn nhầm cơ sở mới thiếu trường `destination` như *"Vân Khang Car"*), giao diện hiển thị ngay các nhóm dịch vụ **có sẵn & đang mở nhận đặt** (`acceptingNew === true` & có `items` / `menu` / `hasDirectInventory`):
     - **Thuê xe & Thiết bị** (`GET /api/public/rentals`): hiện thẳng từng phương tiện/thiết bị đang mở cho thuê (ảnh, tên xe/thiết bị, tên cơ sở, địa chỉ, badge tồn kho `"Sẵn X xe/bộ"`, `"Giao tận nơi"`, giá theo ngày/giờ) và nút **`Đặt thuê ngay`** (mở `RentalReservationDialog`).
     - **Khách sạn có phòng sẵn** (`GET /api/public/hotels`): hiện các khách sạn đối tác đã công khai & có phòng khả dụng (`hasDirectInventory === true`, giá từ `minPricePerNight/đêm`), bấm **`Chọn phòng & Đặt ngay`** mở trực tiếp `MindtripHotelDetailOverlay` (đầy đủ chọn ngày, phòng, voucher, PayOS/tại khách sạn).
     - **Nhà hàng & Quán ăn** (`GET /api/public/restaurants`): hiện quán ăn đối tác kèm ảnh/món tiêu biểu & tag ẩm thực, bấm **`Đặt bàn ngay`** mở trực tiếp `RestaurantReservationDialog`.
3. **Tìm kiếm & Lọc tức thì**:
   - Nhập từ khóa vào ô search (ví dụ `"VF3"`, `"xe máy"`, `"cắm trại"`, `"bánh xèo"`, `"Đà Nẵng"`) -> gọi song song hoặc lọc tức thì theo tên cơ sở, tên phương tiện/dịch vụ, mô tả, địa chỉ, thành phố.
   - Bấm các pill phân loại hoạt động thật 100% (xóa toàn bộ các pill `"Sắp ra mắt"`):
     - **`Tất cả sẵn sàng`** (`all`)
     - **`Thuê xe & Thiết bị`** (`rentals`) + chip lọc con (`Ô tô`, `Xe máy`, `Xe đạp`, `Cắm trại`, `SUP & Nước`, `Khác`)
     - **`Khách sạn có phòng`** (`hotels`)
     - **`Nhà hàng & Quán ăn`** (`restaurants`)
   - Có switch/chip **`Chỉ hiện nơi đang mở đặt ngay`** (mặc định **Bật**) để loại các cơ sở tạm ngưng nhận khách hoặc chưa tạo danh mục; khi tắt vẫn xem được để nhắn tin/liên hệ tham khảo.
4. **Đặt trực tiếp hoặc mở trang chi tiết / Chat**:
   - Bấm **`Đặt thuê ngay`** trên card xe/thiết bị -> mở ngay `RentalReservationDialog` với `rentalItem`, `businessName`, `ownerUserId` điền sẵn; đặt xong có link nhảy thẳng tới `/reservations?tab=rentals` hoặc chat với chủ xe.
   - Bấm **`Xem gian hàng`** / **`Nhắn tin tư vấn`** -> điều hướng sang `/rentals/[businessId]`, `/restaurants/[businessId]`, hoặc `/chat?userId=...`.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Cập nhật nhãn & icon mục Sidebar đầu tiên trong `UserSidebar` (từ `Khách sạn và đặt phòng` -> `Dịch vụ & Đặt chỗ`, hỗ trợ cả `collapsed` tooltip & i18n `vi.json`/`en.json`).
  - Bổ sung route `/services` và nâng cấp `/hotels` dùng chung hub **`ServiceDiscoveryWorkspace`** (khi `/hotels` không có `?tab=stays` riêng hoặc luôn hợp nhất để click link cũ không bị rẽ sang trang trống; giữ `MindtripHotelDetailOverlay` & chế độ tìm khách sạn nâng cao theo ngày checkin/checkout khi chọn tab Khách sạn).
  - Cải tiến truy vấn backend trong `PublicRentalService` (`searchPublicRentals` tìm thêm trong tên/mô tả/category của `partner_rental_item` đang active) và `RestaurantService` (`searchPublicRestaurants` tìm thêm theo `destination`/`address`/`menu item` và trả `acceptingNew` trong `PublicRestaurantListingDto`).
  - Bổ sung bộ lọc theo loại hình (`all` / `rentals` / `hotels` / `restaurants`), danh mục thuê (`RentalCategory`), thành phố (`Tất cả`, `Đà Nẵng`, `Hội An`, ...), và nút đặt trực tiếp bằng việc tái sử dụng `RentalReservationDialog`, `RestaurantReservationDialog`, `MindtripHotelDetailOverlay`.
- **Out-of-Scope**:
  - Không thay đổi màn hình **Địa điểm & Bản đồ** (`/places` / `/explore`).
  - Không tạo bảng database mới hay microservice mới.
  - Không tự ý sinh giá/phòng/xe ảo (giữ nguyên rule không dùng `mock-hotels` làm dữ liệu đặt chỗ chính).
  - Không làm hỏng các route `/rentals/[businessId]`, `/restaurants/[businessId]`, `/hotels/[id]` hiện hữu.

### 1.4 Acceptance Criteria

- [ ] **AC-1 (Sidebar Update)**: Mục đầu tiên của `UserSidebar` hiển thị **"Dịch vụ & Đặt chỗ"** (VI) / **"Services & Booking"** (EN), dẫn tới `/services` (và `/hotels` tiếp tục hoạt động, không vỡ `user-sidebar-contract.test.ts` hoặc cập nhật contract test tương ứng).
- [ ] **AC-2 (Ready-to-Book Default Feed)**: Vừa mở trang (với điểm đến mặc định `"Tất cả"`), người dùng thấy ngay danh sách **Thuê xe & Thiết bị**, **Khách sạn có phòng**, và **Nhà hàng đối tác** đang mở nhận khách mà không bị lọc mất các cơ sở chưa điền `destination` hay bị lẫn placeholder "Sắp ra mắt".
- [ ] **AC-3 (Item-Level Rental Search)**: Gõ từ khóa sản phẩm cụ thể như `"VF3"`, `"xe máy"`, `"lều"`, `"SUP"` tìm được đúng cơ sở & item thuê tương ứng thông qua `GET /api/public/rentals?query=...` (tìm cả ở `partner_rental_item` lẫn `partner_business`).
- [ ] **AC-4 (1-Click Quick Booking)**: Bấm **`Đặt thuê ngay`** trên card thuê xe mở `RentalReservationDialog` đặt thẳng được; bấm **`Đặt bàn ngay`** mở `RestaurantReservationDialog`; bấm **`Chọn phòng & Đặt ngay`** ở tab Khách sạn mở `MindtripHotelDetailOverlay` kiểm tra & đặt phòng thực tế.
- [ ] **AC-5 (Availability & Status Filter)**: Nút lọc **`Đặt online ngay`** (mặc định bật) chỉ hiển thị những nơi `acceptingNew === true` và đã có ít nhất 1 item/phòng/món mở đặt; cơ sở chưa tạo dịch vụ hoặc đang tạm dừng không hiện nút đặt giả.
- [ ] **AC-6 (Quality, Security & i18n)**: Chỉ hiển thị thông tin liên hệ công khai khi `publicContactConsent === true`, không rò rỉ thông tin đối tác/lỗi nội bộ, 100% i18n parity `en.json` & `vi.json`, Vitest & JUnit pass toàn bộ.

---

## 2. Architecture & Service Boundaries

### 2.1 Interaction Diagram / Data Flow

```text
[Next.js Web: ServiceDiscoveryWorkspace (/services & /hotels)]
   |-- 1. Initial & Query Search (Parallel Public Reads)
   |     |-- GET /api/public/rentals?query=...      ──┐
   |     |-- GET /api/public/hotels?query=...       ──┼──> [API Gateway :8080] ──> [trip-service]
   |     |-- GET /api/public/restaurants?query=...  ──┘        |                      |-- PublicRentalService
   |                                                           |                      |-- PublicHotelService
   |-- 2. Quick Booking Actions (Authenticated)                |                      |-- RestaurantService
         |-- RentalReservationDialog  -> POST /api/rental-bookings -------------------> RentalService
         |-- RestaurantReservationDialog -> POST /api/restaurant-reservation-requests -> RestaurantReservationService
         |-- MindtripHotelDetailOverlay -> POST /api/hotels/holds --------------------> HotelService
```

### 2.2 Service Ownership & Communication

| Component | Responsibility | Communication |
| --- | --- | --- |
| `services/trip-service` | Chủ sở hữu toàn bộ catalog & booking của Rental, Hotel, Restaurant. Thực hiện tìm kiếm công khai không lộ thông tin nhạy cảm (`publicContactConsent` gated). | Sync REST qua Gateway |
| `services/api-gateway` | Đã route sẵn `/api/public/rentals/**`, `/api/public/hotels/**`, `/api/public/restaurants/**`, `/api/rental-bookings/**`, `/api/hotels/**`, `/api/restaurant-reservation-requests/**`. | Spring Cloud Gateway |
| `apps/web/tripsense` | Tổng hợp feed dịch vụ sẵn sàng đặt, lọc theo category/thành phố/trạng thái mở đặt, tái sử dụng dialog đặt chỗ hiện có. | Public + Authenticated `apiClient` |

### 2.3 Architecture Guardrails Verification

- [x] Mọi public & authenticated request đi qua API Gateway (`:8080`).
- [x] Không tạo cross-service DB query; 100% nguồn dữ liệu thuộc `trip-service` (không phụ thuộc Google/OSM fallback cho nguồn dịch vụ mở đặt).
- [x] Thông tin cá nhân của partner (`email`, `phone`) tiếp tục bị chặn khi `publicContactConsent == false`.

---

## 3. API & Event Contracts

### 3.1 Existing & Enhanced Endpoints (`services/trip-service`)

| Method | Gateway Path | Auth Required | Enhancement |
| --- | --- | --- | --- |
| `GET` | `/api/public/rentals` | Public (`permitAll`) | Tham số `query` (optional), bổ sung optional `category` (`RentalCategory`) và `onlyAccepting` (`boolean`, default `false` để giữ backward-compat). Tìm khớp cả `business.displayName`, `destination`, `address`, **và `rentalItem.name` / `category` / `description`**. |
| `GET` | `/api/public/restaurants` | Public (`permitAll`) | Tham số `query` (optional), mở rộng fallback tìm theo `destination`/`address`/`menuItem.name` & `cuisineTags`; bổ sung field `boolean acceptingNew` vào `PublicRestaurantListingDto`. |
| `GET` | `/api/public/hotels` | Public (`permitAll`) | Giữ nguyên contract `PublicHotelListingDto` (`acceptingNew`, `hasDirectInventory`, `minPricePerNight`, `propertyId`, `checkInTime`, `checkOutTime`). |

#### Mở rộng `PublicRestaurantListingDto`
```json
{
  "id": "uuid",
  "ownerUserId": "uuid",
  "displayName": "Bánh Xèo Làng",
  "address": "12 Trần Phú, Đà Nẵng",
  "destination": "Đà Nẵng",
  "openingHours": "09:00 - 22:00",
  "cuisineTags": ["Món Việt", "Đặc sản Đà Nẵng"],
  "menu": [],
  "publicEmail": null,
  "publicPhone": "0901234567",
  "verifiedPartner": true,
  "acceptingNew": true,
  "badgeLabel": "Verified Partner"
}
```

### 3.2 Frontend Adapter Contract

- Tái sử dụng `searchPublicRentals` trong `src/features/partner/services/rental-api.ts`.
- Tái sử dụng `searchPublicHotels`, `searchPublicRestaurants` trong `src/features/partner/services/partner-api.ts`.
- Chuyển đổi `PublicHotelListingDto` (có `propertyId`) -> cấu trúc `MindtripHotel` tối thiểu khi người dùng mở `MindtripHotelDetailOverlay` để kiểm tra phòng & đặt theo ngày.

---

## 4. Data Model & Migrations

- **Không cần tạo bảng mới hoặc Flyway migration mới.**
- Chỉ truy vấn đọc trên các bảng đã có trong `trip-service`:
  - `partner_business` (đã có index `kind`, `publication_state`)
  - `partner_rental_item` (`idx_rental_item_biz(business_id, is_active)`, `idx_rental_item_category(category, is_active)`)
  - `hotel_property`, `hotel_room_type`, `hotel_inventory`
  - `restaurant_menu_item`

---

## 5. Security & Trust Boundaries

1. **Public Listing Privacy**: `PublicRentalService`, `PublicHotelService`, `RestaurantService` chỉ trả hồ sơ khi `publicationState == PUBLISHED`, không đình chỉ, đủ điều kiện công khai (`isPublicEligible`), và chỉ trả `publicEmail` / `publicPhone` nếu partner bật `publicContactConsent`.
2. **Item Active Guard**: `PublicRentalService` chỉ trả `RentalItemDto` đang `active == true`; đồng thời chỉ khi `rental.acceptingNew && items.length > 0` mới hiển thị nút đặt trực tiếp.
3. **Booking Auth**: Các thao tác xem & search dịch vụ cho phép truy cập public (`permitAll`), còn hành động xác nhận đặt trong `RentalReservationDialog`, `RestaurantReservationDialog`, `MindtripBookStayModal` tiếp tục yêu cầu Bearer JWT ở Gateway/backend (hoặc nhắc đăng nhập gọn trên dialog nếu chưa login).
4. **Zero-Leak Error Handling**: Mọi lỗi mạng từ từng nhánh (`rentals`, `hotels`, `restaurants`) dùng `Promise.allSettled` + `getSafeErrorMessage`, một nhóm lỗi không làm sập cả màn hình tìm kiếm.

---

## 6. Devil's Advocate & Technical Trade-offs

| Rủi ro / Vấn đề | Phương án bị loại bỏ | Giải pháp được chọn & Lý do |
| --- | --- | --- |
| **Gộp với `/places` ("Địa điểm & Bản đồ") gây loãng kết quả chưa đặt được** | Giữ sidebar `/hotels` chỉ tìm khách sạn qua Google/OSM `places-api` và thêm nhãn phụ. | **Loại** vì khách vào `/hotels` chỉ thấy nơi "Chưa kích hoạt đặt phòng online". **Chọn**: Đổi hẳn mục đầu tiên sang **Dịch vụ & Đặt chỗ**, nguồn dữ liệu chính là các cơ sở/dịch vụ đối tác đã mở đặt trên TripSense (`/api/public/rentals`, `/api/public/hotels`, `/api/public/restaurants`). |
| **Mất tính năng tìm phòng khách sạn theo ngày check-in/check-out** | Xóa bỏ `MindtripStaysDiscovery` hoàn toàn. | **Loại** vì các nút `"Tìm thêm phòng"` trong `/reservations` hay luồng đặt phòng hotel theo ngày vẫn cần `MindtripHotelDetailOverlay` + criteria ngày. **Chọn**: Giữ chọn ngày + mở `MindtripHotelDetailOverlay` ngay trong tab **`Khách sạn`** (hỗ trợ `?category=hotels` tại `/hotels` và `/services`), nhưng bỏ 5 pill giả `"Sắp ra mắt"`. |
| **Hiển thị cơ sở chưa có sản phẩm/phòng nào** | Liệt kê tất cả `PUBLISHED` business dù 0 item. | **Chọn**: Bật mặc định filter **"Sẵn sàng đặt ngay"** (`acceptingNew && có item/phòng/menu`), đẩy lên đầu và đánh badge xanh rõ ràng; nơi chưa có inventory bị lọc ẩn mặc định (hoặc xuống cuối nếu user tắt filter). |
| **Đối tác quên nhập `destination` nên mặc định chọn `"Đà Nẵng"` bị rỗng** | Giữ mặc định `selectedDestination = "Đà Nẵng"` như `MindtripStaysDiscovery`. | **Loại** vì vừa gây mất cơ sở mới tạo (như *"Vân Khang Car"* có `destination: ""`). **Chọn**: Mặc định `selectedDestination = "Tất cả"` để vào trang là thấy ngay toàn bộ dịch vụ sẵn có. |
| **Hiển thị cấp shop hay cấp từng xe/thiết bị khi tìm thuê** | Chỉ hiện thẻ tên shop *"Vân Khang Car"* khiến khách phải bấm thêm 1-2 trang mới thấy xe & giá. | **Chọn**: Trong mục **Thuê xe & Thiết bị**, vừa hiển thị thẻ từng **xe/thiết bị sẵn sàng đặt** (kèm tên shop + badge giao tận nơi + giá/ngày + nút **`Đặt thuê ngay`**) vừa có link mở trang shop `/rentals/[businessId]` nếu shop có nhiều xe. |

---

## 7. Phased Implementation Tasks & Verification

### Phase 1: Backend Public Search Improvements (`services/trip-service`)
- [x] Task 1.1: Cập nhật `PublicRentalService.searchPublicRentals` (tìm theo tên/mô tả/category của item kèm optional `category` & `onlyAccepting`, dùng `ListingTextSearchSupport` bỏ dấu tiếng Việt).
- [x] Task 1.2: Bổ sung `boolean acceptingNew` vào `PublicRestaurantListingDto` và mở rộng `RestaurantService.searchPublicRestaurants`.
- [x] Task 1.3: Viết & pass unit tests trong `PublicRentalServiceTest` và `RestaurantServiceTest`.

### Phase 2: Sidebar & Service Discovery Workspace (`apps/web/tripsense`)
- [x] Task 2.1: Cập nhật `UserSidebar`: đổi mục thành `Dịch vụ & Đặt chỗ` (`/services`) và đặt ở vị trí hợp lý ngay trước `Đơn đặt của tôi`, cập nhật `user-sidebar-contract.test.ts`.
- [x] Task 2.2: Tạo route `/services` và cập nhật `/hotels` dùng `ServiceDiscoveryWorkspace`.
- [x] Task 2.3: Xây dựng `ServiceDiscoveryWorkspace` với search tức thì, lọc khu vực `"Tất cả"` mặc định, filter `Sẵn sàng đặt ngay`, card dịch vụ kèm nút **`Đặt thuê ngay`**, **`Đặt bàn ngay`**, **`Chọn phòng & Đặt ngay`**, cập nhật CTA từ `UnifiedReservationsHub`.

### Phase 3: Localization, Automated Verification & Stack Build
- [x] Task 3.1: Cập nhật `en.json` & `vi.json`, pass `i18n:check`.
- [x] Task 3.2: Viết & pass `service-discovery-workspace.test.tsx`.
- [x] Task 3.3: Pass backend tests (`46/46`), `type-check`, `eslint` (`0` errors), `vitest run` (`91/91` files, `452/452` tests), rebuild & verified live stack trên `:8080` và `:3000`.

---

## Human Approval Gate

```text
STATUS: DONE
```

> Bản thiết kế tính năng **Đổi mục "Khách sạn và đặt phòng" thành Cổng tìm kiếm & Đặt nhanh Dịch vụ có sẵn (Thuê xe/Thiết bị, Khách sạn, Nhà hàng)** đã hoàn tất.
> Vui lòng xác nhận hoặc phản hồi **`Approved`**, **`Implement`**, hoặc **`Proceed`** (hoặc góp ý thay đổi tên mục / thứ tự hiển thị mặc định) để bắt đầu triển khai code.

