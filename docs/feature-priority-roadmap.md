# TripSense — Roadmap hoàn thiện sản phẩm và tính năng đề xuất

- Cập nhật: 2026-10-12.
- Phạm vi: User, Partner, Admin; web và backend hiện tại, mobile là hướng mở rộng.
- Thứ tự theo yêu cầu: **hoàn thiện trải nghiệm đang có → voucher và tiện ích mới → mở rộng sản phẩm → quản trị và dòng tiền ở cuối**.
- Cơ sở: đọc code, route, API và tài liệu trong working tree; chưa chạy kiểm thử end-to-end hoặc kiểm tra production.
- Trạng thái: `STATUS: WAITING_FOR_HUMAN_APPROVAL`.

> Đây là danh sách ưu tiên sản phẩm, không phải feature specification hoặc phê duyệt sửa code. Trước mỗi hạng mục, đối chiếu feature plan hiện có; cập nhật/lập specification theo [workflow](workflows/multi-agent-feature-workflow.md), rồi xin phê duyệt. Các mã A/B/C/D dưới đây thay cách đánh số R01–R17 của bản roadmap trước.

**Cách đọc hiện trạng:**

- **Có code, cần nghiệm thu:** không đề xuất xây lại; kiểm thử luồng thật, chỉ sửa khoảng trống đã xác nhận.
- **Có backend, thiếu UI:** hoàn thiện tích hợp và màn hình, giữ nghiệp vụ hiện có nếu phù hợp.
- **Chưa thấy triển khai:** chưa tìm được luồng trong phạm vi rà soát, cần xác nhận lại trước khi lập specification.
- **Đề xuất mới:** hướng phát triển, không khẳng định là lỗi hoặc thiếu sót của phạm vi đã duyệt.

**Lưu ý an toàn:** Đưa dòng tiền xuống cuối là thứ tự phát triển, không phải cho phép bỏ qua nghĩa vụ với giao dịch đang có. Nếu đang nhận tiền thật, vẫn phải có người đối soát, xử lý hoàn tiền và hỗ trợ khách. Không mở rộng giao dịch thật hoặc áp dụng voucher thật khi các quy tắc giá, hạn mức và hoàn/hủy chưa được thực thi ở backend.

## 1. Nhóm A — Hoàn thiện những luồng đang có trước

Mục tiêu: người dùng có thể đi trọn hành trình **đăng nhập → tìm điểm đến → tạo trip → chỉnh lịch trình → chia sẻ/cộng tác → tìm dịch vụ → theo dõi yêu cầu**, không gặp nút giả, trang cụt hoặc dữ liệu mất sau tải lại.

| Mã | Tính năng / luồng | Vai trò | Hiện trạng | Việc cần làm hoặc xác minh để chốt hoàn thiện |
|---|---|---|---|---|
| A01 | Tạo trip và chuyển tiếp sang AI Planner | User | Có code, có thay đổi trong working tree; specification đã đánh dấu các AC chính | Kiểm thử tạo từ mọi điểm vào; truyền đúng nơi/ngày/người/ngân sách; prompt chỉ gửi một lần; tải lại không tạo trip trùng; lỗi AI không làm mất trip đã lưu |
| A02 | AI đề xuất và cập nhật lịch trình thật | User | Có API liên kết chat, trip và apply proposal; một số kế hoạch còn `IMPLEMENTING` | Kiểm tra chat gắn đúng trip; bản đề xuất chưa được chấp nhận không ghi đè lịch trình; retry không thêm hoạt động trùng; giải thích được phần đã lưu và phần chưa áp dụng |
| A03 | Chỉnh lịch trình, mời bạn và cộng tác | User | Có code CRUD, lời mời, phân quyền và streaming; nghiệm thu trong tài liệu chưa chốt | Kiểm thử owner/editor/viewer; di chuyển hoạt động không mất/trùng; hai người sửa có xử lý xung đột; reconnect đồng bộ lại; thu hồi quyền có hiệu lực |
| A04 | Save, Collections và Add to Trip nhất quán | User | Có frontend/API; feature còn đang triển khai | Save ở card phải phản ánh ở detail/Saved/Collections; tải lại/đổi thiết bị vẫn còn; phân trang đúng; thêm vào trip đúng quyền; không nhầm danh sách địa điểm đã lưu với lịch trình đã xếp ngày |
| A05 | Chia sẻ chuyến đi và quyền riêng tư | User | Có public/unlisted/private và publication API; kế hoạch còn đang triển khai | Kiểm thử bản chia sẻ sau khi trip gốc thay đổi; đổi riêng tư/gỡ chia sẻ có hiệu lực; không lộ lời mời, thông tin liên hệ hoặc dữ liệu riêng của thành viên |
| A06 | Review địa điểm và kiểm duyệt review | User, Admin | Có tạo/sửa/xóa review; report/reply/like của review được ghi là deferred | Nghiệm thu review hiện tại; bổ sung báo cáo review và đường xử lý kiểm duyệt trước khi mở rộng UGC; phân biệt review TripSense với review nhà cung cấp; không xây lại moderation bài viết đã có |
| A07 | Hành trình inquiry hướng dẫn viên | User, Partner | Có hồ sơ, quảng bá, trao đổi, proposal và consent liên hệ | Nghiệm thu gửi yêu cầu, phản hồi, chấp nhận/từ chối đề xuất, thông báo và thu hồi consent; hiển thị rõ đây là inquiry hay dịch vụ đã xác nhận; không ghi là đã thanh toán |
| A08 | Hoàn thiện trải nghiệm nhà hàng | Partner, User | Có backend menu/public listing; card có link quản lý nhưng chưa thấy route tương ứng | Làm trang menu, liên hệ, ảnh/thông tin theo API cho phép; nối public listing; xử lý cơ sở chưa được duyệt hoặc tạm ẩn; chưa thêm đặt bàn |
| A09 | Tài khoản, onboarding và cài đặt | User | Có code hồ sơ, đổi/quên/reset mật khẩu và sở thích; trạng thái tài liệu chưa đồng nhất | Kiểm thử email/Google, reset mật khẩu, lưu hồ sơ/sở thích và bỏ qua/hoàn thành onboarding; đồng bộ tài liệu; không đề xuất viết lại các chức năng đã có |
| A10 | Chất lượng trải nghiệm toàn web | User, Partner | Cần nghiệm thu xuyên luồng, không khẳng định mọi màn hình đang lỗi | Rà link/nút chưa hoạt động; loading/empty/error/retry; EN/VI; bàn phím/focus; mobile responsive; kết quả tìm kiếm rỗng; dữ liệu thật thay mock trên luồng phát hành; lỗi hiển thị an toàn |

**Cách làm nhóm A:** đối chiếu acceptance criteria với code và chạy kiểm thử. Checkbox chưa tick hoặc trạng thái `IMPLEMENTING` không chứng minh chức năng chưa được viết. Nếu đã đạt thì chốt nghiệm thu, không tạo feature trùng.

## 2. Nhóm B — Voucher và các tính năng nên bổ sung tiếp

### B01 — Voucher / mã giảm giá: bổ sung có giới hạn, không chỉ thêm ô nhập mã

**Hiện trạng rà soát:** chưa thấy nghiệp vụ voucher/coupon, API sử dụng mã hoặc bảng lưu lượt sử dụng trong web/backend đã tìm. Chữ “voucher” ở một review mẫu và `LOYALTY_PROGRAM` trong onboarding không phải hệ thống voucher.

**Phạm vi bản đầu đề xuất:** voucher cho booking khách sạn trực tiếp, một mã trên một booking, VND; giảm số tiền cố định hoặc phần trăm có mức giảm tối đa. Chưa áp dụng tour, nhà hàng, điểm thưởng hoặc cộng dồn nhiều khuyến mãi.

| Vai trò | Tính năng cần có | Quy tắc tối thiểu |
|---|---|---|
| User | Xem ưu đãi phù hợp và điều kiện sử dụng | Hiển thị thời hạn, đơn tối thiểu, mức giảm tối đa, khách sạn/phòng được áp dụng; không hứa chắc còn mã nếu chưa giữ hạn mức |
| User | Lưu voucher vào danh sách “Ưu đãi của tôi” | Lưu để dùng sau không đồng nghĩa đã sử dụng hoặc đã giữ suất |
| User | Nhập/chọn mã ở bước review booking; bỏ/thay mã | Backend tính và trả giá gốc, giảm giá, phí, số tiền cuối; frontend không tự quyết định quyền dùng mã |
| User | Xem lý do mã không áp dụng được | Mã hết hạn, chưa tới thời gian, hết lượt, không đúng dịch vụ, chưa đủ giá trị đơn hoặc đã dùng hết hạn mức |
| User | Xem voucher gắn với booking và lịch sử sử dụng | Snapshot điều kiện và số tiền giảm được giữ trên đơn; sửa campaign không thay giá đơn cũ |
| Partner | Đề xuất ưu đãi cho cơ sở của mình | Không áp voucher sang cơ sở khác; mức giảm và quyền xuất bản phải theo chính sách đã được duyệt |
| Admin | Tạo/duyệt/tạm dừng campaign; đặt hạn mức | Màn hình quản trị đầy đủ nằm ở D06; backend tối thiểu để phát hành voucher an toàn phải đi cùng B01 |

**Quy tắc phải chốt trước khi triển khai:**

1. Thời gian áp dụng tính theo múi giờ nào; kiểm theo ngày đặt, ngày lưu trú hay cả hai; ngày bị loại trừ nếu có.
2. Đơn tối thiểu và phần trăm giảm tính trên khoản nào; thứ tự giảm/phí; làm tròn VND; tổng cuối không âm. Booking giảm về 0 phải có luồng riêng hoặc bị chặn rõ, không gửi giao dịch PayOS không hợp lệ.
3. Hạn mức toàn campaign, mỗi người dùng và ngân sách giảm giá; giữ suất trong thời gian hold, tiêu thụ khi xác nhận hợp lệ, giải phóng khi hold hết hạn/thất bại theo chính sách. Cập nhật phải nguyên tử, không dùng vượt hạn mức khi đặt đồng thời.
4. Thay mã hoặc thay giá phải vô hiệu hóa/tạo lại payment link theo luồng an toàn; số tiền backend, booking, payment link và webhook phải khớp.
5. Webhook lặp, retry hoặc tiền về sau hold hết hạn không được trừ lượt hai lần hoặc tự phục hồi booking không còn đủ điều kiện; dùng đường xử lý ngoại lệ giao dịch.
6. Hủy booking có trả lại lượt voucher hay không; khách chỉ được hoàn theo số tiền thực trả và chính sách hợp lệ, không theo giá gốc trước giảm.
7. Ai tài trợ giảm giá — nền tảng hay Partner — và hoa hồng tính trên giá nào. Thiết kế đối soát chi tiết ở D03/D06, nhưng quyết định này không được bỏ trống khi chạy voucher thật.
8. Chống dò mã/lạm dụng bằng giới hạn tần suất và kiểm tra backend; không thu thập thêm giấy tờ nhạy cảm chỉ để ngăn dùng mã nhiều tài khoản.

**Nghiệm thu:** có kiểm thử hết hạn, sai điều kiện, hai khách dùng suất cuối, retry, đổi mã, hết hold và hủy đơn. Giao diện voucher có thể thử nghiệm trước bằng dữ liệu demo ghi nhãn rõ; không coi đó là voucher production.

### Các đề xuất tiếp theo

| Mã | Tính năng | Vai trò | Hiện trạng | Bản đầu nên làm / giới hạn |
|---|---|---|---|---|
| B02 | Trung tâm thông báo thống nhất | User, Partner | Đã có thông báo chat/booking theo mảng; đề xuất gom trải nghiệm | Gom lời mời trip, chỉnh lịch trình, chat, booking/inquiry; đã đọc/chưa đọc; mở đúng đối tượng; tùy chọn kênh nhận; tái sử dụng delivery hiện có |
| B03 | Nhắc lịch chuyến đi và hoạt động | User | Đề xuất mở rộng, không thay trang Calendar đã có | Người dùng bật/tắt nhắc trước chuyến đi/hoạt động; đúng múi giờ; thay/xóa lịch thì cập nhật/hủy nhắc; giờ yên lặng; không gửi lặp |
| B04 | Xuất PDF và lịch ICS | User | Chưa thấy luồng xuất trong phạm vi rà soát | Bản in/lưu PDF từ trình duyệt; ICS đúng múi giờ và ngày; chỉ xuất trip được phép xem; không cần thư viện PDF nếu bản in đáp ứng |
| B05 | Lịch trình offline chỉ đọc | User | Đề xuất mới | Lưu snapshot, ghi thời điểm đồng bộ; tải lại khi có mạng; xóa dữ liệu cục bộ phù hợp khi đăng xuất; chưa chỉnh sửa offline |
| B06 | Checklist chuẩn bị chuyến đi | User | Đề xuất mới | Danh sách đồ cần mang/việc cần làm; đánh dấu xong; mẫu tối thiểu hoặc nhập tay; phân quyền với checklist dùng chung; chưa dùng AI nếu không cần |
| B07 | Bình chọn địa điểm/hoạt động trong nhóm | User | Đề xuất mới, bổ sung cho cộng tác hiện tại | Đề xuất lựa chọn, mỗi thành viên một phiếu/lựa chọn theo quy tắc; người có quyền chốt và thêm vào lịch trình; không để phiếu tự ghi đè lịch |
| B08 | Sao chép trip thành kế hoạch riêng | User | Đề xuất cần kiểm tra lại các nút import/reuse trước khi làm | Sao chép trip được phép tái sử dụng; cho chọn ngày mới; không sao chép thành viên, booking, chat, contact hoặc dữ liệu riêng; ghi nguồn nếu từ cộng đồng |
| B09 | Lịch rảnh hướng dẫn viên và xác nhận dịch vụ | User, Partner | Hiện có inquiry; đề xuất phần lịch phục vụ | Partner khai báo lịch nhận khách; tránh xác nhận trùng; tách inquiry, proposal và dịch vụ đã xác nhận; chưa thêm thanh toán tour |
| B10 | Review sau sử dụng dịch vụ và phản hồi Partner | User, Partner | Có review địa điểm chung; đề xuất review gắn booking | Gắn nhãn đã sử dụng khi có booking hợp lệ; giới hạn review theo booking; Partner trả lời nhưng không sửa review khách; report dùng luồng kiểm duyệt |
| B11 | Hỗ trợ ngay từ đối tượng gặp lỗi | User, Partner | Có backend support case; `/support` hiện chủ yếu FAQ/liên hệ | Mở ticket từ booking/inquiry được hỗ trợ bởi backend; xem tiến độ và bổ sung thông tin; không mặc định mọi loại tài nguyên đã được API hỗ trợ; cổng xử lý ở D05 |
| B12 | Thông tin an toàn và trợ giúp khi đi | User | Đề xuất mới | Lưu ghi chú/liên hệ khẩn cấp riêng tư, thông tin điểm đến có nguồn; không quảng bá là dịch vụ cứu hộ hoặc dữ liệu thời gian thực nếu chưa có |

**B11 không nên phát hành như hệ thống hỗ trợ trực tiếp nếu chưa có người và giao diện xử lý ở D05.** Có thể ưu tiên UI khách trước, nhưng phải hoàn thiện đường xử lý trước khi mở công khai.

## 3. Nhóm C — Mở rộng để sản phẩm đầy đủ hơn, làm khi có nhu cầu

Không phải điều kiện bắt buộc để dự án “giống sản phẩm thật”. Ưu tiên khả năng vận hành đúng hơn số lượng tính năng.

| Mã | Tính năng | Vai trò | Giá trị / phạm vi đề xuất | Điều kiện bắt đầu |
|---|---|---|---|---|
| C01 | Điểm thưởng và hạng thành viên | User | Lịch sử điểm, điều kiện lên hạng, quyền lợi rõ ràng | Có giao dịch hoàn thành đáng tin cậy; chốt hoàn/hủy điểm và thời hạn; không tạo ví tiền trá hình |
| C02 | Giới thiệu bạn bè | User | Link/mã giới thiệu, theo dõi điều kiện nhận ưu đãi | B01 ổn định; chỉ thưởng khi hành động hợp lệ xảy ra; chống tự giới thiệu và thưởng lặp |
| C03 | Campaign ưu đãi theo mùa/nhóm khách | User, Partner | Trang ưu đãi theo điểm đến, thời gian hoặc khách mới; banner có lịch hết hạn | Reuse B01; không tạo mỗi campaign một cơ chế giảm giá; không dùng thông tin nhạy cảm để nhắm mục tiêu |
| C04 | TripSense Pro / Partner Pro | User, Partner | Gói quyền lợi đã xác định; quản lý gói, gia hạn/hủy và lịch sử | Chứng minh nhu cầu trả tiền; phần thu phí và quyền lợi gói phụ thuộc D02–D03, không chỉ thêm nút nâng cấp |
| C05 | Sponsored discovery | Partner, User | Nội dung tài trợ có nhãn, tiêu chí hiển thị và thời hạn | Có lưu lượng và dữ liệu đo hiệu quả; không giả nội dung tài trợ thành gợi ý trung lập |
| C06 | Đặt bàn nhà hàng hoặc booking tour | User, Partner | Chọn một loại dịch vụ để mở rộng từ listing/inquiry đang có | Chốt tồn chỗ, xác nhận, hủy/hoàn và trách nhiệm phục vụ; không mở đồng thời nhà hàng, tour và vé máy bay |
| C07 | Mobile cho luồng thiết yếu | User | Lịch trình, booking, thông báo và offline khi đi đường | Web/API ổn định; hiện router mobile mới có StartupScreen; không sao chép toàn bộ web ngay |

## 4. Thứ tự thực hiện đề xuất ngay lúc này

1. **Chốt nhóm A:** rà và nghiệm thu A01–A05 trước; tiếp A06–A10. Chỉ sửa phần chưa đạt, cập nhật tài liệu phần đã đạt.
2. **Lập specification B01 Voucher:** chốt điều kiện, hạn mức, giá và hủy/hoàn; có thể demo trải nghiệm trước, không bật tiền thật khi thiếu backend bảo vệ.
3. **B02–B04:** trung tâm thông báo, nhắc lịch và PDF/ICS; tăng tiện ích mà không mở thêm loại giao dịch.
4. **B05–B08:** offline, checklist, bình chọn nhóm, sao chép trip; xác nhận lại phần đã có trước khi xây.
5. **B09–B12:** lịch hướng dẫn viên, review sau booking, ticket và trợ giúp; triển khai cùng các phụ thuộc tối thiểu.
6. **Nhóm C:** chọn theo nhu cầu thực tế; không coi loyalty, subscription hoặc quảng cáo là bắt buộc.
7. **Nhóm D ở cuối file:** giữ backlog quản trị, quản lý tài chính và dòng tiền theo yêu cầu; kéo đúng phần phụ thuộc lên khi tính năng phía trên cần để vận hành an toàn.

## 5. Tiêu chí chung trước khi đánh dấu hoàn thành

- Luồng lưu dữ liệu thật, refresh/đổi thiết bị không mất; không dùng mock như dữ liệu production.
- Phân quyền và kiểm tra sở hữu thực thi ở backend; không trì hoãn bảo mật theo thứ tự màn hình quản trị.
- Thao tác nhạy cảm và thay đổi tiền/quyền có lịch sử ngay từ lúc phát hành; màn hình tra cứu tổng hợp có thể làm sau.
- Có kiểm thử đường thành công, lỗi, retry và quyền truy cập; luồng hạn mức/giá cần kiểm thử đồng thời, lặp sự kiện và rollback.
- Tuân thủ [i18n](I18N_STANDARDS.md), [lỗi và logging](ERROR_HANDLING_AND_LOGGING_STANDARDS.md), accessibility và bố cục mobile.
- Public API qua Gateway; dữ liệu thuộc service sở hữu; không truy vấn DB xuyên service, không tạo service mới chỉ vì thêm màn hình.
- Roadmap chưa duyệt không thay đổi quyền triển khai của các feature đã có. Mỗi scope mở rộng phải đi qua specification và phê duyệt.

## 6. Nguồn rà soát và giới hạn kết luận

- [Feature Index](features/index.md): tại lần kiểm kê đầu có 53 bản ghi feature; không phải 53 use case độc lập.
- [Tạo trip và handoff](features/mindtrip-trip-creation-handoff.md): AC chính đã đánh dấu hoàn thành; cần kiểm thử working tree, không gắn nhãn chưa viết.
- [Collaborative itinerary](features/collaborative-itinerary-editing.md): còn checkbox nghiệm thu; đối chiếu với code collaboration đã hiện diện.
- [Save/Add/Reviews](features/save-add-place-and-community-reviews.md): đã có code, report/reply/like review được hoãn trong scope hiện tại.
- [Calendar route](../apps/web/tripsense/src/app/(main)/calendar/page.tsx): đã nối vào TripManagementView; không đề xuất tạo Calendar mới.
- [Auth API](../apps/web/tripsense/src/features/auth/services/auth-api.ts): có đổi/quên/reset mật khẩu và logout-all.
- [Partner API](../apps/web/tripsense/src/features/partner/services/partner-api.ts), [RestaurantController](../services/trip-service/src/main/java/fu/tripsense/tripservice/partner/controller/RestaurantController.java): nền tảng Partner/nhà hàng hiện có.
- [Support page](../apps/web/tripsense/src/app/(main)/support/page.tsx), [PartnerSupportCaseController](../services/trip-service/src/main/java/fu/tripsense/tripservice/partner/controller/PartnerSupportCaseController.java): giao diện trợ giúp và backend ticket hiện tại chưa tương đương nhau.
- Voucher: tìm `voucher`, `coupon`, `promoCode`, `discountCode`, `loyalty`, `referral` trong web và Java/TypeScript/SQL backend chưa thấy luồng sử dụng voucher. `LOYALTY_PROGRAM` trong onboarding là nhóm sở thích, không phải tích điểm TripSense.
- [PayOS specification](features/hotel-payos-payment.md), [HotelCommerce](../apps/web/tripsense/src/features/hotels/components/hotel-commerce.tsx), [HotelService](../services/trip-service/src/main/java/fu/tripsense/tripservice/hotel/HotelService.java): có thu tiền PayOS nhưng commerce đang dùng dữ liệu/quyết toán demo; không suy ra payout thật từ tài liệu kiến trúc.
- [Admin Users](../apps/web/tripsense/src/app/admin/users/page.tsx), [Admin Analytics](../apps/web/tripsense/src/app/admin/analytics/page.tsx): ví dụ trang dùng dữ liệu mẫu và thao tác local state.

## 7. Nhóm D — Quản trị, quản lý và dòng tiền: tạm xếp cuối

### D.1. Quản trị và quản lý vận hành

| Mã | Tính năng | Vai trò | Hiện trạng | Việc cần làm |
|---|---|---|---|---|
| D01 | Quản lý tài khoản và quyền thật | Admin | Trang Users dùng mock/local state | Tìm kiếm/phân trang; khóa/mở; phân quyền; thu hồi phiên; nhật ký; bảo vệ tài khoản quản trị cuối cùng |
| D04 | Vận hành Partner và nhân viên cơ sở | Admin, Partner | Có backend, UI chưa đầy đủ | Duyệt/đình chỉ/khôi phục cơ sở; thu hồi capability; duyệt quảng bá; mời/thu hồi thành viên theo quyền; không để mất owner hợp lệ |
| D05 | Cổng xử lý ticket và kiểm duyệt | Admin, Partner theo quyền | Có support backend và moderation bài viết; một số trang Admin vẫn mock | Nối B11 với hàng đợi thật; phân công, trao đổi, lịch sử quyết định; mở rộng report review A06; tái sử dụng `/moderation`, không xây lại |
| D06 | Quản lý campaign voucher | Admin, Partner | Đề xuất mới đi cùng B01 | Tạo/duyệt/dừng campaign; hạn mức, nguồn tài trợ, phạm vi cơ sở; báo cáo lượt dùng và chi phí giảm; backend an toàn không được chờ đến giai đoạn cuối nếu voucher đã chạy thật |
| D07 | Dashboard và báo cáo thật | Admin, Partner | Có nhiều trang dùng số cố định; commerce demo không phải doanh thu thật | Số người dùng/trip/booking, tỷ lệ hủy, công suất phòng, doanh thu theo định nghĩa; lọc ngày, phân quyền theo cơ sở; dùng công cụ giám sát sẵn có |
| D08 | Phiên đăng nhập và quyền riêng tư | User, Admin theo quyền | Có logout-all; chưa thấy đầy đủ quản lý từng phiên/xuất-xóa dữ liệu | Xem/thu hồi từng phiên; yêu cầu xuất/xóa dữ liệu; bảo vệ dữ liệu thành viên khác; giữ chứng từ theo nghĩa vụ hợp lệ |
| D09 | Nội dung trợ giúp và chính sách | Admin; User, Partner đọc | FAQ hiện viết cứng trong trang Support | Hoàn thiện hướng dẫn, điều khoản, chính sách nội dung/hủy/hoàn và phiên bản đã chấp nhận; dùng nội dung versioned trong repo trước, chỉ thêm CMS khi cần người không viết code cập nhật |

### D.2. Dòng tiền và tài chính

| Mã | Tính năng | Vai trò | Hiện trạng | Phạm vi cần có trước khi vận hành đầy đủ |
|---|---|---|---|---|
| D02 | Giao dịch PayOS, đối soát và hoàn tiền | Admin, User | Có thu tiền; `REFUND_REQUIRED` chưa phải đã hoàn; commerce hiện dựa trên demo | Sổ giao dịch thật; xử lý thiếu/thừa/muộn/sai tham chiếu; nối payment với booking; hàng đợi hoàn tiền, người phụ trách, bằng chứng và thông báo kết quả; retry không ghi nhận/hoàn hai lần |
| D03 | Hoa hồng, công nợ và payout Partner | Admin, Partner | Chưa thấy quyết toán tiền thật; `demo-settlement` chỉ mô phỏng | Tài khoản nhận tiền; chính sách hoa hồng được snapshot; khoản phải trả theo đơn; kỳ quyết toán; giữ đơn tranh chấp; sao kê, bằng chứng chi trả; tích hợp chi phí voucher B01/D06; không payout hai lần |
| D10 | Chi tiêu thực tế và chia tiền trip | User | Có ngân sách dự kiến; đề xuất sổ chi thực tế | Khoản chi, người trả/người hưởng và số dư; một đồng tiền/trip ở bản đầu; quy tắc làm tròn; chỉ ghi nhận phân chia, không tự chuyển tiền giữa thành viên |
| D11 | Chứng từ giao dịch và hóa đơn nếu cần | User, Partner, Admin | Đề xuất, chưa xác minh tích hợp hóa đơn | Tải biên nhận/xác nhận booking có số tiền thực trả; phân biệt biên nhận nền tảng với hóa đơn thuế; chỉ tích hợp hóa đơn điện tử khi chốt chủ thể phát hành và nghĩa vụ |
| D12 | Tự động refund/payout và thu phí gói | Admin, Partner, User | Phần mở rộng tương lai | Tự động hóa trên D02–D03 đã ổn định; trạng thái retry, kiểm soát phê duyệt và đối soát; nếu triển khai C04 thì xử lý gia hạn/hủy/thu phí lặp rõ ràng |

**Bản tài chính đầu tiên:** có thể hoàn/chuyển tiền thủ công nhưng phải lưu bằng chứng, phân quyền và đối soát đầy đủ. Chưa cần ví nội bộ, tự động payout hoặc một microservice mới.

**Cổng kiểm soát trước tiền thật:** chốt bên nhận tiền, nghĩa vụ trả Partner, người chịu giảm giá/phí, chính sách hoàn/hủy và hợp đồng. Không gọi tài khoản merchant là escrow nếu không có cơ sở pháp lý/cơ chế tương ứng. Không xem số liệu demo là doanh thu hay khoản phải trả thật.

**Trạng thái toàn roadmap: `STATUS: WAITING_FOR_HUMAN_APPROVAL`.**
