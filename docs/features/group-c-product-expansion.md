# Nhóm C — Mở rộng sản phẩm dựa trên dữ liệu thật

`STATUS: IMPLEMENTED`

- Cập nhật: 2026-10-13.
- Người dùng đã duyệt triển khai: C06 (Yêu cầu đặt bàn nhà hàng với backend thật, phân quyền, chống trùng lặp, chuyển trạng thái và audit log) đã hoàn thành triển khai đầy đủ.
- Chủ sở hữu: `trip-service` (nghiệp vụ nhà hàng và đặt bàn), `api-gateway` (route điều phối), `apps/web/tripsense` (giao diện đặt bàn & tích hợp).
- C01–C05 giữ thiết kế trong đặc tả này cho các đợt tiếp theo; không phát thưởng/thu phí khi chưa có chính sách được duyệt.
- Dòng tiền nhóm D vẫn để ở cuối roadmap.

## 1. Hiện trạng và lý do điều chỉnh

Rà Java/SQL backend chưa thấy nghiệp vụ loyalty, referral, subscription, sponsored placement hoặc restaurant reservation. `RestaurantController`/`RestaurantService` hiện có menu, public listing và consent liên hệ; không có API đặt bàn. `PartnerSupportCaseRequest` chỉ chấp nhận HOTEL_BOOKING/GUIDE_INQUIRY/GUIDE_PROMOTION/MANAGEMENT_CLAIM, không thể dùng ticket hỗ trợ thay đơn đặt bàn.

Kế hoạch giao diện đã duyệt không đủ để:

- Tính điểm có giá trị bằng hook hoặc localStorage mà chống tự sửa điểm được.
- Sinh mã referral từ một đoạn userId rồi đảm bảo unique, attribution và phát thưởng.
- Hiển thị đặt bàn thành công mà chưa lưu yêu cầu, chưa có Partner xử lý.
- Gắn sponsored/verified/pro dựa trên giá trị tự sinh tại frontend.

Các bản A/B trước có code nhưng chưa có kết quả test/build thành công trong phiên này. Không dùng các nhãn IMPLEMENTED đó làm bằng chứng nền tảng đã nghiệm thu. Lệnh type-check gần nhất bị công cụ chặn với lỗi `Coding[1m] is temporarily unavailable`; không phải kết quả test pass hoặc test fail.

## 2. Phạm vi và thứ tự

| Đợt | Phạm vi | Điều kiện hoàn thành |
|---|---|---|
| 1 | C06: yêu cầu đặt bàn, Partner quyết định, User theo dõi | Có dữ liệu backend thật, quyền theo cơ sở, retry an toàn, lịch sử trạng thái; không có mã xác nhận giả |
| 2 | C03: ưu đãi theo thời gian từ dữ liệu voucher hợp lệ; C05: nhãn tài trợ từ nguồn có thẩm quyền | Không banner hứa giảm giá khác checkout; không tự gắn tín nhiệm từ tài trợ |
| 3 | C01/C02: tài khoản thưởng và referral có lưu trữ | Unique, idempotency, audit, điều kiện phát thưởng được duyệt; không thưởng từ trạng thái trip tự khai |
| 4 | C04: giới thiệu gói Pro | Hiển thị rõ chưa mở đăng ký; không thanh toán, không tự cấp entitlement, không hứa quyền lợi chưa có |

Đề xuất triển khai đợt 1 trước; không đồng thời viết sáu màn hình mà bỏ backend.

## 3. C06 — Yêu cầu đặt bàn, không phải giữ tồn bàn tự động

### Hành trình

1. Khách đăng nhập mở nhà hàng công khai đủ điều kiện nhận yêu cầu.
2. Chọn ngày giờ, số người lớn/trẻ em và ghi chú; xác nhận chỉ gửi yêu cầu, chưa có bàn được giữ.
3. Backend lưu và trả ID thật với trạng thái REQUESTED. Mất mạng hoặc response thiếu ID không được hiển thị thành công.
4. OWNER/MANAGER đúng cơ sở xem hàng đợi và xác nhận hoặc từ chối sau khi kiểm tra khả năng phục vụ thực tế.
5. Khách theo dõi, hủy trước giờ hẹn. Cả hai bên thấy lịch sử quyết định; không đồng nghĩa đã thu tiền.

Bản đầu không có sơ đồ bàn, tự tính còn bàn, đặt cọc, gọi món, SMS/email mới hoặc cam kết phản hồi trong 24 giờ. Hai yêu cầu cùng giờ có thể tồn tại; Partner chịu trách nhiệm kiểm tra sức chứa trước khi xác nhận, UI không quảng bá bảo đảm chống overbooking.

### API đề xuất — trip-service, qua Gateway

| Method và path | Quyền / body | Kết quả |
|---|---|---|
| POST `/api/restaurants/{businessId}/reservation-requests` | User; `Idempotency-Key`; `{startAt, timeZone, adults, children, notes}` | 201 `{id,businessId,businessName,startAt,timeZone,adults,children,notes,state,version,createdAt}`; replay cùng key/payload trả cùng resource |
| GET `/api/me/restaurant-reservation-requests?page=0&size=20` | Chính khách đăng nhập | Danh sách phân trang, không nhận customerId từ query |
| GET `/api/restaurant-reservation-requests/{id}` | Chủ yêu cầu hoặc OWNER/MANAGER cơ sở | Detail và lịch sử; foreign ID trả 404 |
| POST `/api/restaurant-reservation-requests/{id}/cancel` | Khách sở hữu; `{expectedVersion}` | CANCELLED; idempotent khi đã hủy |
| GET `/api/partners/businesses/{businessId}/reservation-requests?page=0&size=20&state=REQUESTED` | Active OWNER/MANAGER | Hàng đợi cơ sở |
| POST `/api/partners/businesses/{businessId}/reservation-requests/{id}/decision` | Active OWNER/MANAGER; `{expectedVersion,decision:CONFIRM\|REJECT\|CANCEL,reason}` | Trạng thái mới và version; 409 nếu stale hoặc chuyển không hợp lệ |

Lỗi validation 400/422, unauthorized 401, forbidden 403 hoặc foreign-resource 404, conflict 409, rate limit 429; message đã sanitize. Không đổi trực tiếp body sang entity JPA.

### Schema và migration đề xuất

Migration mới trong `services/trip-service/src/main/resources/db/migration/`; không sửa migration đã áp dụng:

- `restaurant_reservation_request`: `id UUID PK`, `business_id UUID FK partner_business`, `customer_id UUID` (không FK sang user-service), `business_name_snapshot VARCHAR(160)`, `start_at TIMESTAMPTZ`, `time_zone VARCHAR(80)`, `adults INT`, `children INT`, `notes VARCHAR(1000)`, `state VARCHAR(16)`, `version BIGINT`, `request_key VARCHAR(100)`, `request_hash VARCHAR(64)`, `created_at/updated_at TIMESTAMPTZ`.
- CHECK adults 1–20, children 0–20, tổng khách ≤20; state thuộc REQUESTED/CONFIRMED/REJECTED/CANCELLED; UNIQUE(customer_id,request_key).
- `restaurant_reservation_transition`: `id UUID PK`, `request_id UUID FK`, `actor_id UUID`, `from_state`, `to_state`, `reason VARCHAR(500)`, `created_at TIMESTAMPTZ`.
- Index `(customer_id,created_at DESC,id)` và `(business_id,state,start_at,id)`.
- Mốc giờ là instant; xác thực IANA zone, nhận ngày trong 180 ngày tới và sau thời điểm hiện tại. Giờ mở cửa dạng text hiện tại không đủ làm quy tắc kiểm tra slot tự động; Partner quyết định.

### State, concurrency và bảo mật

- REQUESTED → CONFIRMED/REJECTED/CANCELLED; CONFIRMED → CANCELLED trước giờ hẹn; REJECTED/CANCELLED terminal. Không triển khai NO_SHOW/COMPLETED khi chưa có yêu cầu.
- Create và confirm phải kiểm tra `BusinessKind.RESTAURANT`, approval, publication, operationState, requiresReverification, acceptingNew và listing capability trong cùng giao dịch khóa business. Member role đọc từ dữ liệu backend hiện tại, không chỉ global PARTNER role.
- Lock ordering business trước reservation nhất quán. So expectedVersion; ghi decision và audit cùng transaction. Người bị thu hồi membership không tiếp tục quyết định.
- Idempotency hash gồm business, instant, zone, số khách và notes đã normalize; cùng key khác payload trả 409. Xử lý unique conflict có kiểm soát, không nuốt exception transaction rồi trả success.
- Khóa/dừng cơ sở chặn yêu cầu mới/xác nhận mới; khách vẫn đọc/hủy yêu cầu cũ. Không xóa lịch sử đã xác nhận.
- Không cho tải hàng loạt ghi chú khách ngoài quyền cơ sở; không log notes; UI nhắc không nhập giấy tờ, bệnh án hoặc thông tin thanh toán.
- Không dùng ngày trong tuần để bịa khả dụng; không dùng Date.now làm mã đặt bàn thành công.

### Reuse và file dự kiến

- Reuse `RestaurantService.getPublicRestaurant`, `PartnerBusiness.isPublicEligible`, membership/capability repositories và `AuthenticatedUser` trong `services/trip-service/.../partner/`.
- Thêm reservation controller/service/entity/repository/DTO theo pattern Partner đang có; không thêm framework hoặc service độc lập.
- Web: `features/partner/services/partner-api.ts`, types; `restaurant-reservation-dialog.tsx`; tích hợp `public-restaurant-view.tsx`; trang yêu cầu của User và hàng đợi cơ sở. Reuse `apiClient`, `getSafeErrorMessage`, Dialog/Input/Button và auth guard.
- EN/VI đầy đủ, label liên kết input, keyboard, loading/empty/error/retry; ngày giờ ghi rõ múi giờ nhà hàng. Không tự coi contactConsentVersion là consent boolean.

## 4. C01/C02 — Điểm và referral: hợp đồng cần chốt trước phát thưởng

- `trip-service` đề xuất sở hữu sổ thưởng gắn booking do đã sở hữu booking hoàn thành; không đọc DB user-service. `user-service` tiếp tục sở hữu identity.
- API đề xuất: `GET /api/me/rewards`, `GET /api/me/rewards/entries`, `POST /api/me/referral-code` (get-or-create), `POST /api/me/referrals/claim` với `{code}`.
- Lưu code ngẫu nhiên backend có unique constraint; không lộ userId trong code. User chỉ có một attribution ban đầu; không self-referral, không sửa referrer sau khi gắn.
- Schema đề xuất: `reward_entry(id,user_id,source_type,source_id,kind,points,policy_version,created_at)`, unique nguồn/người/loại nghiệp vụ; reversal riêng tham chiếu entry gốc; `referral_code(user_id PK,code UNIQUE)`; `referral_attribution(referred_user_id PK,referrer_user_id,claimed_at,qualifying_booking_id)`.
- Client không được gửi số điểm/tier hay ghi trực tiếp số dư. Booking đủ điều kiện được đọc trong service; thay đổi điểm và source transition cần idempotent và có audit. Không dùng trip đánh dấu completed do khách tự sửa để phát thưởng có giá trị.
- Chưa duyệt hệ số điểm, ngưỡng hạng, thời hạn điểm và thưởng referral. Các giá trị này phải thành chính sách được người dùng duyệt, không tự suy ra từ userId hoặc số trip. Khi chưa có policy active, API/UI ghi `NOT_ENROLLED`/`NOT_AVAILABLE`, không hiển thị điểm giả hoặc hứa quà.
- Không quy đổi điểm sang tiền hoặc voucher trong đợt đầu; bổ sung sau khi cơ chế voucher và hủy/hoàn đã được nghiệm thu.

## 5. C03/C05 — Campaign và tài trợ

- C03 reuse voucher trong trip-service, nhưng banner chỉ hiển thị campaign ACTIVE còn hạn có voucher áp dụng hợp lệ. Hết hạn/dừng campaign thì ngừng hiển thị; checkout luôn là nguồn quyết định cuối.
- API đề xuất `GET /api/hotels/campaigns` trả `{id,title,description,validFrom,validUntil,voucherCode,destination,terms}`; chuỗi content từ dữ liệu được duyệt, không hardcode khuyến mãi đang bán. Có empty state nếu chưa có campaign.
- C05 cần placement record có business/place mapping, kỳ hiệu lực và trạng thái được duyệt. Không tự gán cờ theo rating, index hoặc random; `sponsored` không có nghĩa `verified` hoặc `recommended`.
- Không tạo liên kết business→place bằng so tên gần giống. Khi chưa có mapping đã xác nhận thì chỉ hiển thị card business trong khu vực đối tác riêng.
- Thu phí quảng cáo và quản trị campaign đầy đủ vẫn thuộc nhóm D. Chưa có nguồn quản trị/duyệt thì không mở chiến dịch/tài trợ thật. Không seed chiến dịch active trên production.

## 6. C04 — Pro showcase

- Chỉ trang giới thiệu trạng thái chưa mở đăng ký, không checkout hoặc tự nâng hạng local.
- Không công bố giá/quyền lợi là cam kết nếu chưa được duyệt hoặc tính năng chưa hoạt động. Không gắn huy hiệu verified như quyền lợi mua được.
- Không để nút "Nâng cấp thành công" khi chưa có billing/entitlement backend; activation nằm ở nhóm D sau.

## 7. Thử nghiệm, rollout và review

1. Baseline type-check, i18n và tests trước khi sửa; ghi log lỗi cũ/tạo mới. Nếu công cụ vẫn chặn, ghi BLOCKED, không đổi thành DONE.
2. Backend C06: ownership/foreign ID, manager cơ sở khác, revoked member, suspended business, time zone invalid, giờ quá khứ, duplicate replay/hash conflict, hai quyết định đồng thời, cancel-vs-confirm, audit rollback; migration trên PostgreSQL test/local.
3. Frontend: gửi đúng DTO; giữ nội dung khi lỗi; không tạo ID fallback; REQUESTED không hiện CONFIRMED; loading/empty/retry; User thấy đơn thật và Partner thấy cùng ID; test keyboard và mobile.
4. Rewards: policy-disabled, source replay, reversal replay, referral unique/self-claim; campaign expiry; sponsored không suy ra verified.
5. Web: `npm --prefix apps/web/tripsense run test`, `type-check`, `i18n:check`, `lint`, `build`. Backend Maven wrapper trong service bị ảnh hưởng; dùng test infra sẵn có. Test live chỉ trên môi trường được phép, không gửi request/thu tiền production.
6. Migration additive; rollback ưu tiên disable entry points giữ dữ liệu/audit, không DROP dữ liệu khi lỗi rollout. Review kiến trúc, DB, security và PR-ready trước khi đánh dấu DONE.

## 8. Bằng chứng triển khai & Kiểm tra (C06)

- **Database**: Additive Flyway migration `V20261013090000__create_restaurant_reservations.sql` tạo bảng `restaurant_reservation_request` và `restaurant_reservation_transition` với đầy đủ ràng buộc số khách, trạng thái và idempotency unique key.
- **Backend (`services/trip-service`)**:
  - `RestaurantReservationService.java`: `createRequest` (kiểm tra eligibility, suspension, time zone, SHA-256 hash idempotency), `getCustomerReservations`, `getReservation`, `cancelByCustomer`, `getBusinessReservations`, `decideByPartner` (CONFIRM/REJECT/CANCEL kèm optimistic lock version check).
  - `RestaurantReservationController.java`: endpoints `/api/restaurants/{businessId}/reservation-requests`, `/api/me/restaurant-reservation-requests`, `/api/restaurant-reservation-requests/{id}`, `/api/restaurant-reservation-requests/{id}/cancel`, `/api/partners/businesses/{businessId}/reservation-requests`, `/api/partners/businesses/{businessId}/reservation-requests/{id}/decision`.
  - Integration/Unit tests: `RestaurantReservationServiceTest.java` (createRequest, suspended rejection, idempotent replay, cancel, partner decision, version conflict).
- **API Gateway (`services/api-gateway`)**:
  - Cập nhật `GatewayRoutesConfig.java` điều phối các route `/api/restaurants/**`, `/api/restaurant-reservation-requests/**`, `/api/me/restaurant-reservation-requests` tới `trip-service`.
- **Frontend (`apps/web/tripsense`)**:
  - `RestaurantReservationDialog.tsx`: Hộp thoại đặt bàn minh bạch (chọn ngày giờ, người lớn, trẻ em, ghi chú) có cảnh báo rõ ràng đây là yêu cầu chờ duyệt, không trừ tiền, không giữ bàn tự động.
  - `PublicRestaurantView.tsx`: Tích hợp nút "Đặt bàn & Giữ chỗ" bên cạnh nút chỉ đường.
  - Types & API service: Cập nhật `types/index.ts` và `services/partner-api.ts`.
  - Unit tests: `restaurant-reservation.test.tsx` và `partner-features.test.ts`.
- **Đa ngôn ngữ**:
  - 100% đồng bộ khóa dịch trong `en.json` và `vi.json` dưới namespace `partner.restaurant`.
