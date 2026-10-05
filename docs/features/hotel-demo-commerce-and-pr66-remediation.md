# Hotel demo commerce và khắc phục PR #66

`STATUS: DONE`

- Ngày: 2026-09-30. Owner: `trip-service`; affected: web, user contact/auth contracts, partner approval và hotel APIs.
- Phê duyệt: người dùng yêu cầu “lên plan sửa mấy cái review và làm luôn tính năng đó” sau khi chọn mô hình đồ án không có hợp đồng/provider thật. Đây là ủy quyền lập plan và triển khai trong cùng lượt; không cần một vòng xin phép lại.
- Nguồn lỗi: [review PR #66](../reviews/pr-66-booking-and-partner-money-flow.md), F1–F13. Tài liệu này bổ sung/thay thế các quyết định xung đột trong partner/hotel spec cho increment này; không tuyên bố production payment hay xác minh pháp lý.

## 1. Scope và tiêu chí nghiệm thu

Hotel là vertical hoàn chỉnh: partner được duyệt → tạo property liên kết business → quản lý inventory → user tìm/giữ phòng → duyệt snapshot → thanh toán mô phỏng → confirm → check-in/out → Admin quyết toán mô phỏng. Commission cố định 1000 basis points (10%), snapshot mỗi lần thu tiền, VND, không phí cổng/thuế giả định. PAY_AT_PROPERTY vẫn tương thích đơn cũ, không sinh payout.

Không tiền thật, số dư có thể rút, thẻ/ngân hàng thật, provider, Kafka mới hoặc microservice mới. Guide/restaurant không thêm booking. Tài liệu private khi chưa có storage/scanner tin cậy phải fail closed (503 rõ ràng), không tạo URL/hash/CLEAN giả; upload giấy tờ production nằm ngoài demo. Duyệt checklist demo do Admin đánh giá hồ sơ, không quảng cáo xác minh pháp lý. Contact guide chỉ email đã lấy từ identity có nguồn; phone thiếu contract xác minh phải trả unavailable, không bịa.

Acceptance:
- AC1: không tạo/đặt property chưa liên kết business; search và hold enforce HOTEL + VALID + ACTIVE + không reverification + capability còn hiệu lực; hold mới còn cần PUBLISHED/acceptingNew. Confirm existing hold vẫn kiểm tra safety gates, pause không hủy nghĩa vụ cũ.
- AC2: admin approve cần checklist phiên bản có đủ required PASS, không cấp capability trái kind/request. Backend không tin UI.
- AC3: upload/access chưa tích hợp bị khóa; contact và role bootstrap không dùng giá trị giả.
- AC4: dates ISO, criteria đồng nhất; direct inventory độc lập Place, không name join; capacity và chính sách có nguồn. Khách duyệt held total/cutoff trước confirm/payment.
- AC5: checkout intent key giữ qua retry; payment và payout idempotent, actor/resource authorization. Lần retry cùng key/payload trả cùng kết quả, khác payload 409.
- AC6: SUCCESS/FAILURE/EXPIRED mô phỏng có nhãn rõ. SUCCESS với hold hợp lệ ghi payment + confirm cùng local transaction; late success ghi capture và refund cùng transaction, giữ EXPIRED, không bán quá tồn. FAIL không confirm. Hủy đủ điều kiện hoàn tiền mô phỏng đúng một lần.
- AC7: chỉ đơn paid, CHECKED_OUT, không dispute đang mở được settle; gross = commission + partner net. Admin payout mỗi booking đúng một lần. Partner chỉ xem số liệu của business có membership; khách chỉ xem đơn mình.
- AC8: ledger append-only lưu capture/refund/payout, không sửa/xóa giao dịch; số liệu suy ra ledger/payment, không cột balance tùy ý. Những khoản pending/eligible/paid được phân biệt.

## 2. Ownership và transaction

Gateway → Trip REST; Trip sở hữu hotel, demo payment, ledger và settlement trong PostgreSQL hiện có. User sở hữu identity; contact đi qua contract self/JWT email identity, không query User DB. Place chỉ enrich khi có canonical mapping, không quyết định bookable. Notification dùng hotel outbox hiện có, không gọi provider trong transaction.

Mọi financial mutation khóa property → business → booking; payment/payout serialization trên cùng property/booking. Partner safety state thay đổi lấy business write lock (JPA version/write locking); inventory write giữ property lock. Chưa dùng job payout: Admin chủ động thao tác để demo quyết định rõ. Có môi trường bật `HOTEL_DEMO_PAYMENTS_ENABLED`, mặc định false ngoài docker demo; disabled thì API trả 503. Không có webhook công khai chọn kết quả thanh toán.

## 3. API contract

Mọi endpoint đi Gateway `/api/hotels/**`; authenticated actor từ JWT. Envelope `{success,data}`; 400 validation, 403 role, 404 foreign ID, 409 state/key conflict, 503 simulator/storage disabled.

| Endpoint | Contract |
| --- | --- |
| POST `/properties` | thêm businessId; OWNER/MANAGER đúng business HOTEL đã duyệt; một property/business |
| POST `/properties/{id}/status` | đường approval cũ bị khóa, chuyển Admin qua partner review |
| GET `/search` | giữ criteria ISO; trả property_id/address/capacity/cancellation_policy/free_cancellation_until/checked_at; chỉ business bookable |
| POST `/holds` | Idempotency-Key; body cũ; trả snapshot và ngày/cutoff authoritative |
| GET `/bookings/{id}` | chỉ customer hoặc membership quản lý đúng property; dùng reconcile |
| GET `/commerce/config` | `{simulationEnabled,commissionBps:1000,currency:"VND"}` |
| POST `/bookings/{id}/demo-payment` | customer; Idempotency-Key, `{outcome:"SUCCESS"|"FAILURE"|"EXPIRED"}`; không nhận amount/rate/customerId; trả booking + payment |
| GET `/commerce` | customer xem payment đơn mình; partner xem khoản của property mình; Admin xem tổng và ledger/settlement |
| POST `/bookings/{id}/demo-settlement` | Admin; Idempotency-Key; đơn eligible → một payout ledger, trả gross/commission/net/status |
| POST `/bookings/{id}/cancel` | giữ endpoint; refund mô phỏng trong transaction nếu có captured payment, không double refund |

Partner admin bổ sung GET checklist theo application: exact checklist/version và items; quyết định gửi từng code/result/reason. Submission kiểm tra checklist hợp lệ theo kind. Guide contact snapshot email chỉ khi chính owner/customer chấp thuận; manager không tự chia sẻ email owner, phone không có verified source bị từ chối.

## 4. Data và migration

Flyway additive `V20260930...`: unique partial index hotel_property.business_id (legacy null retained nhưng không bán mới); không tự approve/backfill dữ liệu chưa xác minh. New registration bắt buộc business_id ở service. Legacy booking vẫn được hủy/fulfil theo snapshot cũ.

`hotel_demo_payment`: booking_id UUID PK FK hotel_booking; state CAPTURED/REFUNDED; amount numeric(18,2)>0, currency VND, commission_bps=1000, commission_amount/net_amount >=0 và sum=amount, captured_at/refunded_at. Một capture/booking; request attempts riêng để failure có thể retry có chủ đích.

`hotel_demo_command`: UUID PK, actor_id UUID, booking_id FK, operation PAYMENT/SETTLEMENT, request_key varchar(100), payload varchar(30), result JSONB, created_at; UNIQUE(actor_id,operation,request_key). Serialization bảo vệ conflict/retry.

`hotel_demo_ledger`: UUID PK, booking_id FK, event CAPTURE/REFUND/PAYOUT, gross/commission/partner_amount numeric(18,2), created_at; UNIQUE(booking_id,event). Chỉ insert từ service; reversal bằng REFUND entry. Index created_at, booking_id. Payout chỉ sau CHECKED_OUT, không refund sau payout trong scope; tranh chấp sau fulfilment xử lý riêng, không sửa số liệu cũ.

Checklist seed đúng CHK-HOTEL-V1 / CHK-RESTAURANT-V1 / CHK-GUIDE-V1 version 1.0: các mục demo PROFILE, CONTACT, OWNERSHIP. Unknown checklist hoặc thiếu required FAIL đóng. Guide proposal và consent thêm email snapshot nullable; legacy consent thiếu snapshot không trả email giả.

Rollback: tắt simulator/UI, giữ payment/ledger/booking để đối soát; không drop bảng có lịch sử. Migration không sửa checksum các file đã áp dụng.

## 5. Security và trade-offs

Simulator không tích hợp provider; chính customer được chọn tình huống chỉ khi server flag bật. JWT vẫn bắt buộc; ownership/rate/amount ở server; Admin-only settlement; API lỗi an toàn, không log token/contact/raw exception. Nhãn mô phỏng trên search/checkout/finance. Không yêu cầu giấy tờ thật hoặc tài khoản ngân hàng thật.

Dùng local transaction cho demo tránh distributed saga giả. Không thêm expiry worker mới: reuse hotel expiry và explicit late success path. Chọn VND integer rounding HALF_UP cho commission, partner amount là phần còn lại. Customer cancel trước cutoff và partner cancel bắt buộc reason; check-out không tự đánh paid. Các role/operationState không thay thế membership.

## 6. Tasks và test plan

1. F1/F4: eligibility/property linkage/locking/checklists, regression nullable legacy, pause/suspend/revoke, checklist missing/FAIL/wrong kind.
2. F2/F5/F10/F13: fail-closed documents, sourced/revocable email, restore roles/context; không tin client-set contact.
3. F3/F6–F9/F11–F12: type fix, canonical dates/criteria, authoritative direct offers, stable intent, review hold before confirmation.
4. Migration + commerce service/controller: capture/late refund/cancel refund/payout, command receipt/ledger. Concurrent last room, timeout retries, foreign IDs, disabled simulator, failed payment, duplicate payout và open support case.
5. Web: integrated search/checkout/history, partner fulfilment, Admin/partner commerce view, bilingual strings; loading/error/retry.
6. Verify JDK21 Maven targeted unit/integration với isolated PostgreSQL/Testcontainers; frontend i18n/type/test/lint/build; architecture/database/security/PR review; record actual results, limitations và completion, không mặc định DONE từ số test.

Verification commands: `mvnw.cmd test` tại trip-service (JDK21, isolated database); `npm run i18n:check`, `npm run type-check`, `npm test`, `npm run lint`, `npm run build` tại web. Không chạy destructive integration tests vào database người dùng.

## 7. Kết quả triển khai và giới hạn demo

- Hotel chỉ mở bán khi property gắn đúng business HOTEL còn hiệu lực, có capability và khớp revision đã duyệt. Khi revision thay đổi, tìm kiếm/giữ phòng dừng cho tới khi chủ cơ sở đồng bộ lại listing từ hồ sơ mới. Đơn cũ vẫn có thể được hủy hoặc hoàn tất nghĩa vụ.
- Booking mới trong môi trường bật simulator dùng `DEMO_ONLINE`; endpoint confirm cũ không thể xác nhận khi chưa có payment mô phỏng. Đơn `PAY_AT_PROPERTY` cũ vẫn giữ hành vi cũ. Thanh toán thành công và xác nhận nằm trong một transaction; hết hạn thì ghi capture + refund mô phỏng, không hồi sinh tồn phòng. Quyết toán chỉ dành cho Admin sau checkout, không có tranh chấp mở.
- Checklist demo có phiên bản seed và Admin đánh dấu từng mục. Upload/đọc giấy tờ riêng tư trả 503 cho đến khi có storage/scanner tin cậy. Guide chỉ chia sẻ email tài khoản đã được cả hai phía đồng ý; không chia sẻ số điện thoại thiếu nguồn xác minh.
- Các bảng payment/ledger và con số 10% là dữ liệu mô phỏng của đồ án. Không có dòng tiền, hợp đồng, hóa đơn, số dư có thể rút hay chuyển khoản thật. Partner nhận `90%` trong sổ demo sau checkout và Admin ghi nhận quyết toán; `10%` là commission demo của TripSense, chưa phải doanh thu thực nhận.
- `HOTEL_DEMO_PAYMENTS_ENABLED` mặc định `false`; `docker-compose.yml` bật `true` để chạy kịch bản đồ án. Khi tắt, booking mới quay về trả tại cơ sở và API payment/settlement demo trả 503.
- Xác minh 2026-09-30: trip-service JDK 21 `mvnw.cmd test` **133/133 pass** với PostgreSQL/Redis Testcontainers; web `npm test` **262/262 pass**, `npm run type-check`, `npm run i18n:check`, `npm run lint -- --quiet`, `npm run build` đều pass. Browser E2E với tài khoản thật chưa chạy; kiểm thử trên môi trường compose là bước tiếp theo trước khi trình diễn.
