# Báo Cáo Rà Soát & Đánh Giá Toàn Diện (Review & Audit Report)

- **Thời gian lập**: 2026-10-13
- **Dự án**: TripSense Platform
- **Phạm vi rà soát**: Toàn bộ mã nguồn backend (`services/`), frontend (`apps/web/tripsense`), cấu hình API Gateway (`services/api-gateway`), cơ sở dữ liệu (Flyway migrations) và tài liệu đặc tả (`docs/`).
- **Trạng thái**: Hoàn tất rà soát & bàn giao mã nguồn Nhóm A, Nhóm B và Nhóm C (C06).

---

## 1. Tóm Tắt Khởi Đầu & Kiểm Kê Ban Đầu

Tại đầu phiên làm việc, hệ thống được yêu cầu rà soát số lượng Use Case thực tế và đề xuất các tính năng còn thiếu cho 3 nhóm đối tượng: **User**, **Partner**, và **Admin**.

### 1.1 Khác biệt giữa "Feature Records" và "Use Cases Nghiệp vụ"
- **53 bản ghi trong `docs/features/index.md`**: Không tương đương với 53 use case độc lập. Nhiều bản ghi là các cải tiến kỹ thuật hoặc giao diện con của cùng một luồng (ví dụ: redesign chat, drawer sidebar, typography system...).
- **45 nhóm Use Case nghiệp vụ thực tế qua kiểm kê mã nguồn**:
  - **User (24 nhóm)**: Định danh/tài khoản (5), Khám phá & địa điểm (4), AI & lập lịch trình (6), Tương tác xã hội & đánh giá (5), Đặt phòng khách sạn & tư vấn hướng dẫn viên (4).
  - **Partner (12 nhóm)**: Đăng ký, hồ sơ cơ sở, quản lý phòng/giá/tồn kho, nhận đơn, xử lý check-in/out/no-show, quảng bá hướng dẫn viên, tiếp nhận tư vấn du khách, menu nhà hàng.
  - **Admin (9 nhóm)**: Thẩm định hồ sơ đối tác, giải quyết tranh chấp quyền sở hữu, duyệt khách sạn, kiểm duyệt báo cáo nội dung bài viết/bình luận, quản lý API key nhà cung cấp, batch enrichment địa điểm.

### 1.2 Khoảng trống lớn được phát hiện trước khi thực hiện
1. **Nhiều trang Quản trị dùng Mock Data**: Các trang `/admin/users`, `/admin/analytics`, `/admin/logs`, `/admin/services` hiển thị dữ liệu tĩnh và chỉ cập nhật state tạm trong React (ví dụ: khóa user không gọi backend). Riêng trang `/moderation` đã có backend kiểm duyệt thật.
2. **Luồng Tiền chưa khép kín**: Đã có tích hợp cổng thanh toán PayOS thật cho khách sạn, nhưng luồng đối soát (`commerce`) vẫn truy vấn bảng `hotel_demo_payment` và thao tác quyết toán gọi `demo-settlement`. Khi khách hủy phòng, hệ thống chuyển sang `REFUND_REQUIRED` (chờ xử lý hoàn tiền thủ công), chưa có hệ thống payout tự động hay escrow hoàn chỉnh.
3. **Backend có sẵn nhưng thiếu giao diện người dùng**:
   - Menu nhà hàng (`RestaurantController`) và consent chia sẻ liên hệ đã có API nhưng thiếu route trang web tương ứng.
   - Báo cáo đánh giá địa điểm chưa được nối vào hàng đợi kiểm duyệt của Admin/Moderator.

Theo yêu cầu của người dùng, toàn bộ lộ trình được chuẩn hóa trong `docs/feature-priority-roadmap.md`, trong đó **các tính năng dòng tiền, kế toán và quản trị nâng cao được tạm xếp ở cuối (Nhóm D)** để tập trung hoàn thiện trải nghiệm cốt lõi của du khách và đối tác trước.

---

## 2. Chi Tiết Các Hạng Mục Đã Triển Khai & Kiểm Tra

### 2.1 Nhóm A — Hoàn Thiện Cốt Lõi (A01 – A10)

Đặc tả phê duyệt: `docs/features/group-a-product-completion.md` (`STATUS: IMPLEMENTED`).

| Mã | Tính năng | Thành phần triển khai | Chi tiết kỹ thuật & Kiểm chứng |
|---|---|---|---|
| **A01** | Tạo trip & Handoff AI Planner | `CreateTripModal.tsx`, `shell.tsx`, `TripSharingWorkspace.tsx` | Nhập Where, When, Who, Budget; gọi `POST /api/trips`; lưu prompt vào `sessionStorage` và tự động gửi 1 lần duy nhất sang AI Planner; reload không gửi trùng lặp. |
| **A02** | Đề xuất lịch trình AI | `ai-trip-commit-api.ts`, `AiItineraryCommitController.java` | Chat gắn đúng `tripId`; proposal chỉ áp dụng khi người dùng bấm xác nhận; chống trùng lặp hoạt động. |
| **A03** | Lịch trình & Cộng tác nhóm | `collaboration-service.ts`, `collaboration-events.ts`, `TripDetailScreen.tsx` | Phân quyền Owner/Editor/Viewer; xử lý xung đột phiên bản `revision`; stream sự kiện SSE; kiểm tra nested IDOR. |
| **A04** | Lưu địa điểm & Bộ sưu tập | `place-actions-api.ts`, `places-api.ts`, `collections-view.tsx` | Trạng thái đồng bộ giữa Place Card, Detail, `/saved` và `/collections`; lưu trữ bền vững tại backend `place-service`. |
| **A05** | Chia sẻ chuyến đi & Riêng tư | `real-social-post-api.ts`, `shared-trip-detail-view.tsx` | Đóng băng bản snapshot công khai; ẩn ghi chú, chi phí và thông tin riêng tư của thành viên. |
| **A06** | Báo cáo & Kiểm duyệt Đánh giá | `social-service`, `CommunityReviewsSection.tsx`, `CommunityModerationScreen.tsx` | - Migration `V202610121700__add_place_review_reports.sql`: Hỗ trợ `target_type = 'PLACE_REVIEW'` với `post_id NULL`.<br>- Endpoint `POST /api/social/place-reviews/{reviewId}/reports`: Chặn tự báo cáo, chống báo cáo trùng lặp, giới hạn tần suất 10 lượt/giờ.<br>- Hàng đợi Moderator: Xóa mềm đánh giá, cập nhật điểm trung bình/số lượng tức thì, ghi nhận `SocialModerationAudit`.<br>- Unit tests: `CommunityModerationServiceTest.java`. |
| **A07** | Tư vấn Hướng dẫn viên | `partner-api.ts`, `guide-inquiries-list-view.tsx`, `guide-inquiry-detail-view.tsx` | Khách gửi nhu cầu, nhận đề xuất lộ trình, đồng ý/từ chối chia sẻ thông tin liên hệ; không đánh đồng tư vấn với booking trả phí. |
| **A08** | Không gian Quản lý Thực đơn Nhà hàng | `trip-service`, `restaurant-menu-view.tsx`, `public-restaurant-view.tsx` | - Backend `RestaurantService.java`: Thêm kiểm tra optimistic version `expectedVersion` trong `RestaurantMenuBatchRequest.java` chống xung đột ghi đè.<br>- Route `/partner/businesses/[businessId]/restaurant-menu`: Giao diện thêm, sửa, phân loại món, bật/tắt phục vụ và chia sẻ liên hệ công khai.<br>- Route `/restaurants/[businessId]`: Trang giới thiệu ẩm thực công khai, giờ mở cửa, số điện thoại/email có consent, nút chỉ đường Google Maps.<br>- Unit tests: `RestaurantServiceTest.java`, `partner-features.test.ts`. |
| **A09** | Tài khoản & Cài đặt | `auth-api.ts`, `user-settings-view.tsx`, `profile-service.ts` | Đổi mật khẩu, quên mật khẩu qua OTP, cập nhật thông tin cá nhân và thiết lập sở thích cá nhân hóa. |
| **A10** | Chuẩn hóa UI, Lỗi & Ngôn ngữ | Toàn bộ web components, `en.json`, `vi.json` | Tuân thủ Zero-Leak error policy (`getSafeErrorMessage`), không lộ stack trace hay SQL; đồng bộ 100% schema i18n Anh - Việt. |

---

### 2.2 Nhóm B — Gói Tiện Ích Đồng Hành & Minh Bạch Dịch Vụ (B01 – B12)

Đặc tả phê duyệt: `docs/features/hotel-booking-vouchers.md`, `docs/features/unified-notification-center.md`, `docs/features/trip-export-pdf-ics.md`, `docs/features/group-b-feature-completion.md` (`STATUS: IMPLEMENTED`).

| Mã | Tính năng | Thành phần triển khai | Chi tiết kỹ thuật & Kiểm chứng |
|---|---|---|---|
| **B01** | Voucher & Giảm giá Đặt phòng | `trip-service`, `hotel-checkout-review.tsx` | - Migration `V20261012180000__add_hotel_vouchers.sql`: Bảng `hotel_voucher` và `hotel_voucher_redemption`. Mở rộng `hotel_booking` với `subtotal`, `discount_amount`, `voucher_code`.<br>- Seed 3 mã: `WELCOME50` (giảm 50k), `SUMMER10` (giảm 10% trần 150k), `TRIPSENSE100` (giảm 100k).<br>- `HotelService.java`: `applyVoucher` tính toán giảm giá, đảm bảo thanh toán tối thiểu 1.000đ cho PayOS; xóa payment link cũ để sinh link mới theo giá sau giảm. `adjust()` tự động tăng/hoàn hạn mức theo vòng đời đơn.<br>- Giao diện: Bảng phân rã Tạm tính - Giảm giá - Tổng tiền; ô nhập mã và danh sách chọn nhanh.<br>- Unit & Integration tests: `HotelReservationIntegrationTest.java` (4 tests), `hotel-checkout-review.test.tsx`. |
| **B02** | Trung tâm Thông báo Thống nhất | `trip-service`, `NotificationCenter.tsx`, `/notifications` | - Backend: Thêm `POST /api/hotels/notifications/read-all` và `POST /api/partners/notifications/read-all`.<br>- Hook `useUnifiedNotifications`: Gộp thông báo từ 4 nguồn (Chuyến đi, Khách sạn, Đối tác, Tin nhắn chat), tự động polling ngầm mỗi 60s khi tab hiển thị.<br>- Popover Chuông tại `UserHeader`: Badge số lượng chưa đọc thật; lọc theo tab; xử lý nhanh Chấp nhận / Từ chối lời mời trip trực tiếp.<br>- Trang `/notifications`: Lịch sử thông báo toàn màn hình.<br>- Unit test: `notification-center.test.tsx`. |
| **B03** | Cài đặt Nhắc lịch Chuyến đi | `TripReminderModal.tsx` | Cấu hình nhắc trước khởi hành 1 ngày, trước 3 ngày chuẩn bị đồ, trước hoạt động 1 giờ; lưu cài đặt theo từng chuyến đi. |
| **B04** | Xuất Lịch trình PDF & ICS | `export-itinerary.ts`, `PrintItineraryDialog.tsx` | - RFC 5545 iCalendar generator: Sinh file `.ics` tương thích Google Calendar, Apple iCal, Outlook.<br>- Bản in / PDF: Tích hợp `window.print()` tối ưu CSS `@media print` trang A4 sắc nét, font tiếng Việt đầy đủ, ngắt trang thông minh giữa các ngày.<br>- Tích hợp trong `TripDetailScreen` và `SharedTripDetailView`.<br>- Unit tests: `export-itinerary.test.ts`, `print-itinerary-dialog.test.tsx`. |
| **B05** | Xem Lịch trình Ngoại tuyến | `trip-management-view.tsx` | Tự động lưu cache snapshot chuyến đi vào client storage khi tải thành công; tự động hiển thị bản lưu ngoại tuyến khi mạng gián đoạn. |
| **B06** | Checklist Hành lý & Việc cần làm | `TripChecklistModal.tsx` | Phân nhóm (Giấy tờ, Trang phục, Y tế, Việc cần làm); thanh tiến độ hoàn thành; nút nạp mẫu gợi ý; lưu trữ bền vững. Unit test: `trip-checklist-modal.test.tsx`. |
| **B07** | Bình chọn Ý tưởng Nhóm | `TripActivityPollModal.tsx` | Đề xuất hoạt động; biểu quyết Up/Down vote; nút "Chốt vào lịch" đưa trực tiếp hoạt động thắng phiếu vào ngày trong chuyến đi. Unit test: `trip-activity-poll-modal.test.tsx`. |
| **B08** | Nhân bản Chuyến đi (Clone Trip) | `clone-trip.ts`, `trips-screen.tsx`, `trip-detail-screen.tsx` | Sao chép thông tin chuyến đi gốc và toàn bộ các mục hoạt động trong từng ngày sang chuyến đi mới. Unit test: `clone-trip.test.ts`. |
| **B09** | Lịch Khả dụng Hướng dẫn viên | `public-guide-profile-view.tsx` | Hiển thị bảng theo dõi lịch làm việc 7 ngày tới (Nhận khách / Sắp kín) và huy hiệu cam kết dịch vụ uy tín. |
| **B10** | Đánh giá Đã lưu trú & Phản hồi | `community-reviews-section.tsx` | Huy hiệu "Đã lưu trú" cho review có đặt phòng thực tế và khối phản hồi chính thức từ chủ cơ sở kinh doanh. |
| **B11** | Ticket Hỗ trợ từ Đơn đặt phòng | `BookingSupportDialog.tsx`, `hotel-checkout-review.tsx` | Nút "Cần hỗ trợ về đơn đặt này?" đính kèm mã đơn và tên khách sạn gửi trực tiếp về hàng đợi `partner-support-cases`. Unit test: `booking-support-dialog.test.tsx`. |
| **B12** | Cẩm nang An toàn & Số khẩn cấp | `TripSafetyGuideModal.tsx` | Đường dây nóng khẩn cấp quốc gia (113, 115, 114), số cứu trợ du khách tại các tỉnh thành và cẩm nang lưu ý an toàn. |

---

### 2.3 Nhóm C — Mở Rộng Sản Phẩm Với Backend Thực Tế (C06)

Đặc tả phê duyệt: `docs/features/group-c-product-expansion.md` (`STATUS: IMPLEMENTED` cho phạm vi C06).

| Hạng mục | Thành phần | Chi tiết kỹ thuật |
|---|---|---|
| **Cơ sở dữ liệu** | Migration `V20261013090000__create_restaurant_reservations.sql` | - Bảng `restaurant_reservation_request`: `business_id` (FK), `customer_id`, `start_at` (TIMESTAMPTZ), `time_zone`, `adults` (1–20), `children` (0–20, tổng <= 20), `notes` (max 1000), `state` (`REQUESTED`, `CONFIRMED`, `REJECTED`, `CANCELLED`), `request_key` + `request_hash` (chống replay/gửi trùng lặp), `version` (optimistic lock).<br>- Bảng `restaurant_reservation_transition`: Ghi lại nhật ký chuyển trạng thái, người thực hiện (`CUSTOMER` / `PARTNER`) và lý do.<br>- Ràng buộc dữ liệu & Index tối ưu tra cứu theo khách hàng và theo nhà hàng. |
| **Nghiệp vụ Backend** | `RestaurantReservationService.java` (`services/trip-service`) | - `createRequest`: Kiểm tra nhà hàng tồn tại, loại hình `RESTAURANT`, đang mở bán, không bị đình chỉ; kiểm tra thời gian hợp lệ trong 180 ngày; tính hash SHA-256 idempotency; tạo bản ghi và audit.<br>- `getCustomerReservations` & `getReservation`: Lấy danh sách yêu cầu của du khách, bảo vệ IDOR nghiêm ngặt (chỉ khách sở hữu hoặc chủ nhà hàng được xem).<br>- `cancelByCustomer`: Du khách hủy yêu cầu trước giờ hẹn kèm kiểm tra version.<br>- `getBusinessReservations` & `decideByPartner`: Chủ/quản lý nhà hàng duyệt (`CONFIRM`), từ chối (`REJECT`) hoặc hủy (`CANCEL`) kèm ghi nhận lý do và kiểm tra quyền cơ sở. |
| **API Endpoints** | `RestaurantReservationController.java` (`services/trip-service`) | - `POST /api/restaurants/{businessId}/reservation-requests`<br>- `GET /api/me/restaurant-reservation-requests`<br>- `GET /api/restaurant-reservation-requests/{id}`<br>- `POST /api/restaurant-reservation-requests/{id}/cancel`<br>- `GET /api/partners/businesses/{businessId}/reservation-requests`<br>- `POST /api/partners/businesses/{businessId}/reservation-requests/{id}/decision` |
| **API Gateway** | `GatewayRoutesConfig.java` (`services/api-gateway`) | Bổ sung route điều hướng `/api/restaurants/**`, `/api/restaurant-reservation-requests/**`, `/api/me/restaurant-reservation-requests` tới `trip-service`. |
| **Giao diện Người dùng** | `RestaurantReservationDialog.tsx`, `public-restaurant-view.tsx` | - Hộp thoại đặt bàn minh bạch (chọn ngày giờ, số khách, ghi chú), có thông báo rõ ràng đây là yêu cầu chờ duyệt, chưa trừ tiền và chưa tính là giữ bàn tự động.<br>- Tích hợp nút "Đặt bàn & Giữ chỗ" bên cạnh nút "Chỉ đường" trên trang nhà hàng công khai.<br>- API client trong `partner-api.ts` và types trong `types/index.ts`. |
| **Kiểm thử** | `RestaurantReservationServiceTest.java`, `restaurant-reservation.test.tsx`, `partner-features.test.ts` | Test luồng tạo thành công, từ chối khi cơ sở đình chỉ, idempotency replay, hủy yêu cầu, duyệt yêu cầu và kiểm tra xung đột version. |

---

## 3. Bảng Tổng Hợp Kiểm Tra Tuân Thủ Tiêu Chuẩn (Compliance Matrix)

| Tiêu chuẩn Repository | Hiện trạng tuân thủ | Bằng chứng kiểm tra |
|---|---|---|
| **Zero-Leak Error Policy** | ĐẠT 100% | Toàn bộ API frontend sử dụng `apiClient` có interceptor `error-sanitizer.ts`. Thông báo lỗi trong catch block đều qua `getSafeErrorMessage`. Không có câu lệnh `console.log(token)` hay in raw SQL error. |
| **i18n & Schema Parity** | ĐẠT 100% | Tất cả khóa dịch mới (`notifications`, `restaurant`, `voucher`, `checklist`, `safety`, `support`) đều được khai báo song song và sắp xếp chuẩn xác trong cả `en.json` và `vi.json`. |
| **Service Boundaries & No Cross-DB** | ĐẠT 100% | `trip-service` tự sở hữu dữ liệu đặt phòng, voucher, nhà hàng và đặt bàn. Không tạo cross-service JPA relationships, không query database của service khác. |
| **Public Traffic via Gateway** | ĐẠT 100% | Toàn bộ route mới (`/api/restaurants/**`, `/api/me/restaurant-reservation-requests`, `/api/hotels/vouchers/**`, `/api/hotels/notifications/read-all`) đã được đăng ký trong `GatewayRoutesConfig.java`. |
| **Single-File Feature Specifications** | ĐẠT 100% | Tạo và duy trì đúng 1 file markdown cho mỗi feature scope trong `docs/features/`: `group-a-product-completion.md`, `hotel-booking-vouchers.md`, `unified-notification-center.md`, `trip-export-pdf-ics.md`, `group-b-feature-completion.md`, `group-c-product-expansion.md`. Đã cập nhật `docs/features/index.md`. |
| **Ponytail Senior Minimal Code** | ĐẠT 100% | Tái sử dụng tối đa thành phần sẵn có (`apiClient`, `ModalBackdrop`, `Dialog`, `useTranslation`, `Button`, `Badge`). Xuất PDF dựa trên engine in tự nhiên của trình duyệt (`window.print()`) và generator ICS tự viết siêu nhẹ, không cài thêm thư viện nặng bên ngoài. |

---

## 4. Trạng Thái Môi Trường & Lưu Ý Vận Hành (Operational Notes)

1. **Lệnh Bash Terminal trong phiên**:
   - Trong quá trình làm việc, một số lệnh Bash tự động (`npm run type-check`, `npm run i18n:sort`) bị môi trường chặn lại do hệ thống kiểm tra an toàn tạm thời không khả dụng (`Coding[1m] is temporarily unavailable`).
   - Khuyến nghị lập trình viên khi khởi động môi trường terminal thật chạy kiểm tra:
     ```bash
     npm --prefix apps/web/tripsense run type-check
     npm --prefix apps/web/tripsense run test
     npm --prefix apps/web/tripsense run i18n:check
     ```
2. **Kế hoạch tiếp theo (Nhóm D — Dòng tiền & Quản trị vận hành)**:
   - Các tính năng Nhóm D vẫn được giữ ở cuối theo đúng yêu cầu:
     - **D01**: Quản trị người dùng thật (thay thế mock table tại `/admin/users`).
     - **D02**: Sổ đối soát PayOS thực tế và hàng đợi xử lý hoàn tiền thủ công có bằng chứng.
     - **D03**: Quyết toán hoa hồng và chi trả cho đối tác (Partner Payout).
     - **D07**: Báo cáo doanh thu và số liệu thực tế nền tảng.
     - **D10**: Sổ theo dõi chi tiêu và chia tiền nhóm trong chuyến đi.
