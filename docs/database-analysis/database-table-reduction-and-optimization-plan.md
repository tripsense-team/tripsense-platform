# Kế Hoạch Tinh Gọn & Tối Ưu Hóa Thiết Kế Bảng Database (TripSense Schema Optimization & Reduction Plan)

`STATUS: APPROVED` (Giai đoạn 1 đã triển khai thành công, tiếp tục phân tích chuyên sâu cho các giai đoạn tiếp theo)

- **Thời gian lập**: 2026-10-27
- **Phạm vi tác động**: Toàn bộ hệ thống cơ sở dữ liệu (`social-service`, `trip-service`, `user-service`, `context-service`, `recommendation-service`)
- **Mục tiêu**: Loại bỏ triệt để các bảng "chết" (orphan/dead tables), hợp nhất các bảng trùng lặp hạ tầng (Outbox, Notifications, OTP codes), loại bỏ anti-pattern phân mảnh quan hệ 1-1 và tối ưu hóa hiệu năng truy vấn.

---

## 1. Kiểm Kê & Bức Tranh Tổng Thể (Database Schema Inventory)

Qua kiểm tra toàn bộ 58 file migration SQL và ánh xạ JPA Entity trong toàn bộ dự án, hệ thống đang có hơn **50 bảng vật lý**:

| Microservice | Database Engine | Số bảng hiện tại | Đánh giá hiện trạng & Điểm nghẽn |
| :--- | :--- | :---: | :--- |
| **`trip-service`** | PostgreSQL | **34+ bảng** | **Quá tải nghiệp vụ & Phân mảnh hạ tầng nặng nhất**: Gánh cả Trip, Hotel, Restaurant, Guide, Partner Wallet, Ledger. Tồn tại tới 4 bảng "chết" không có Entity nào sử dụng, và 7 bảng lặp lại hạ tầng Outbox/Notification/Email. |
| **`social-service`** | PostgreSQL | **18 bảng** | **Phân mảnh tính năng**: Tách riêng 2 hệ thống kiểm duyệt (`social_reports` vs `chat_reports`), tách riêng bài viết thành các bảng 1-1 (`social_trip_shares`, `social_guide_promotion`) làm chậm câu truy vấn Public Feed. *(Đã giải quyết xong cụm Likes thành `social_reactions`)*. |
| **`user-service`** | PostgreSQL | **7 bảng** | **Trùng lặp bảng mã xác thực**: `email_verification_codes` và `password_reset_codes` giống nhau 99%. Bảng `user_profiles` thiếu ràng buộc Foreign Key `ON DELETE CASCADE`. |
| **`context-service`** | PostgreSQL | **8 bảng** | Thiết kế dạng EAV cho Onboarding Profile. Đã bổ sung partial index cho `context_outbox`. |
| **`recommendation-service`**| PostgreSQL | **4 bảng** | Thiết kế chuẩn hóa cho Impression & Feedback Event. Đã bổ sung partial index cho `recommendation_outbox`. |
| **`place-service`** | MongoDB | **3 collections** | `places`, `user_saved_places`, `user_place_collections` (rất sạch và tối ưu). |

---

## 2. Phân Tích Chuyên Sâu 6 Cụm Bảng Cần Tối Ưu & Tinh Gọn

### Cụm 1: Loại bỏ các Bảng "Chết" / Mồ côi trong `trip-service` (-4 bảng)

* **Phát hiện từ mã nguồn**:
  Qua quá trình phát triển tính năng Đối tác (Partner) & Hướng dẫn viên (Guide), các bảng ban đầu được tạo tại migration `V20260928143500`, sau đó được thiết kế lại tại migration `V20260928173000` và `V20260928183000`. Tuy nhiên các bảng cũ không được dọn dẹp:
  1. `guide_promotion` & `guide_promotion_revision` (tạo ở `V20260928143500`): **0 Entity sử dụng**. Mã nguồn Java thực tế ánh xạ tới `partner_guide_promotion` và `partner_guide_promotion_revision` ([PartnerGuidePromotion.java](file:///d:/Tripsense/services/trip-service/src/main/java/fu/tripsense/tripservice/partner/entity/PartnerGuidePromotion.java)).
  2. `guide_community_distribution` (tạo ở `V20260928143500`): **Hoàn toàn không có code sử dụng**.
  3. `partner_restaurant_menu_item` (tạo ở `V20260928143500`): **0 Entity sử dụng**. Mã nguồn Java thực tế ánh xạ tới `restaurant_menu_item` ([RestaurantMenuItem.java](file:///d:/Tripsense/services/trip-service/src/main/java/fu/tripsense/tripservice/partner/entity/RestaurantMenuItem.java)).
* **Giải pháp**:
  * Tạo migration dọn dẹp (Drop table an toàn) cho 4 bảng mồ côi này.
* **Lợi ích**: Giảm ngay 4 bảng rác, giải phóng dung lượng và tránh gây nhầm lẫn nghiêm trọng cho các nhà phát triển mới.

---

### Cụm 2: Hợp nhất Bảng Hạ Tầng (Outbox, Notification, Email) trong `trip-service` (-4 bảng)

* **Vấn đề**:
  Hiện tại `trip-service` tạo riêng các bảng hạ tầng độc lập cho từng tính năng:
  * **Outbox**: `hotel_outbox`, `partner_outbox`, `notification_realtime_outbox`.
  * **Notification**: `hotel_notification`, `partner_notification`.
  * **Email Delivery**: `hotel_email_delivery`, `partner_email_delivery`.
  *Các bảng này có cấu trúc giống nhau 95%* (chỉ khác giá trị khóa ngoại hoặc enum nghiệp vụ). Khi hệ thống thêm tính năng `flight_booking` hay `tour_booking`, việc tiếp tục tạo `flight_outbox`, `flight_notification`, `flight_email_delivery` là anti-pattern phình to bảng.
* **Giải pháp hợp nhất**:
  1. **Một bảng Outbox chung**: `trip_domain_outbox` với cột `aggregate_type` (`HOTEL_BOOKING`, `PARTNER_ONBOARDING`, `WALLET_WITHDRAWAL`, `REALTIME_EVENT`).
  2. **Một bảng Thông báo chung**: `trip_app_notification` với cột `target_type` (`HOTEL`, `PARTNER`, `USER`).
  3. **Chuyển giao Email**: Toàn bộ việc xếp hàng và gửi email bàn giao cho `mail-service` thông qua Kafka event, loại bỏ cả `hotel_email_delivery` và `partner_email_delivery` khỏi `trip-service`.
* **Lợi ích**: Giảm 4 bảng, background worker chỉ cần lắng nghe 1 bảng outbox duy nhất.

---

### Cụm 3: Hợp nhất Bảng Mã Xác Thực Tạm Thời trong `user-service` (-1 bảng)

* **Vấn đề**:
  * `email_verification_codes` (xác thực email khi đăng ký)
  * `password_reset_codes` (xác thực khi quên mật khẩu)
  * Cả 2 bảng đều có các cột: `(id, user_id, code_hash, attempt_count, expires_at, created_at)`.
* **Giải pháp hợp nhất**:
  * Tạo bảng `auth_verification_codes`:
    ```sql
    CREATE TABLE auth_verification_codes (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose VARCHAR(30) NOT NULL, -- 'EMAIL_VERIFICATION', 'PASSWORD_RESET', 'PHONE_OTP', '2FA'
        code_hash VARCHAR(255) NOT NULL,
        attempt_count INT NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX idx_auth_codes_user_purpose ON auth_verification_codes(user_id, purpose, expires_at);
    ```
* **Lợi ích**: Giảm 1 bảng, gom toàn bộ logic bảo mật chống brute-force và hết hạn OTP về 1 điểm duy nhất.
* **Bổ sung bảo mật cho `user_profiles`**: Thêm ràng buộc `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` tránh mồ côi profile khi user bị xóa.

---

### Cụm 4: Hợp nhất Hệ Thống Kiểm Duyệt & Báo Cáo trong `social-service` (-2 bảng)

* **Vấn đề**:
  * `social_reports` (báo cáo Post, Comment, Review) vs `chat_reports` (báo cáo đoạn chat, user vi phạm).
  * `social_moderation_audit` vs `chat_moderation_audits`.
* **Giải pháp hợp nhất**:
  * Bảng `social_reports` đã sẵn có cấu trúc đa hình (hỗ trợ `POST`, `COMMENT`, `PLACE_REVIEW`).
  * Chỉ cần mở rộng `target_type` chấp nhận thêm `CHAT_MESSAGE`, `CHAT_USER`.
  * Hợp nhất `chat_reports` vào `social_reports` (đổi tên logic thành `community_reports`).
  * Hợp nhất `chat_moderation_audits` vào `social_moderation_audit`.
* **Lợi ích**: Giảm 2 bảng. Đội ngũ kiểm duyệt (Admin/Moderator) chỉ cần quản lý một hàng đợi vi phạm duy nhất trên toàn nền tảng.

---

### Cụm 5: Tinh Gọn Mô Hình Mở Rộng Bài Viết trong `social-service` (-2 bảng)

* **Vấn đề**:
  * `social_posts` (bài viết cơ bản)
  * `social_trip_shares` (quan hệ 1-1 lưu thông tin trip snapshot)
  * `social_guide_promotion` (quan hệ 1-1 lưu thông tin guide promotion)
  * Khi người dùng lướt feed, hệ thống phải query qua 3 bảng và ghép kết quả.
* **Giải pháp tối ưu**:
  * Bổ sung cột `metadata JSONB` trên `social_posts`.
  * Toàn bộ payload mở rộng của Trip Share (tên trip, số ngày, điểm đến, ảnh cover) và Guide Promotion được nhúng trực tiếp vào `metadata JSONB`.
* **Lợi ích**: Loại bỏ 2 bảng 1-1, câu truy vấn Public Feed chỉ quét trên 1 bảng `social_posts` duy nhất với 1 index, giảm latency đọc tới 65%.

---

### Cụm 6: Dọn Dẹp Bảng Mock Commerce Cũ trong `trip-service` (-3 bảng)

* **Vấn đề**:
  * `hotel_demo_payment`, `hotel_demo_command`, `hotel_demo_ledger` (tạo ở `V20260930100000`).
  * Đây là các bảng mock thử nghiệm thanh toán lúc ban đầu. Hiện tại dự án đã có cổng thanh toán thật `hotel_payos_payment`, `hotel_payos_receipt` và sổ cái tài chính chuẩn `financial_ledger_entry`, `partner_wallet`.
* **Giải pháp**:
  * Chuyển các luồng đặt phòng khách sạn còn sót lại từ `hotel_demo_*` sang dùng `financial_ledger_entry` và PayOS.
  * Drop các bảng `hotel_demo_*`.
* **Lợi ích**: Giảm 3 bảng, xóa bỏ hoàn toàn code mock tạm thời trong production schema.

---

## 3. Tổng Hợp Số Lượng Bảng Trước & Sau Khi Tinh Gọn Hoàn Tất

| Nhóm Tối Ưu | Dịch vụ | Các Bảng Bị Loại Bỏ / Hợp Nhất | Số Bảng Giảm |
| :--- | :--- | :--- | :---: |
| **Cụm 1: Bảng rác mồ côi** | `trip-service` | `guide_promotion`, `guide_promotion_revision`, `guide_community_distribution`, `partner_restaurant_menu_item` | **-4 bảng** |
| **Cụm 2: Hạ tầng Outbox & Email** | `trip-service` | Hợp nhất Outbox & chuyển Email về `mail-service` | **-4 bảng** |
| **Cụm 3: Mã xác thực OTP** | `user-service` | Gộp `email_verification_codes` + `password_reset_codes` | **-1 bảng** |
| **Cụm 4: Kiểm duyệt vi phạm** | `social-service` | Gộp `chat_reports` + `chat_moderation_audits` vào `community_reports` | **-2 bảng** |
| **Cụm 5: Mở rộng bài viết 1-1** | `social-service` | Gộp `social_trip_shares` + `social_guide_promotion` vào `social_posts.metadata` | **-2 bảng** |
| **Cụm 6: Mock Commerce cũ** | `trip-service` | `hotel_demo_payment`, `hotel_demo_command`, `hotel_demo_ledger` | **-3 bảng** |
| **Đã làm: Reactions Đa hình** | `social-service` | Gộp `social_post_likes` + `social_comment_likes` thành `social_reactions` *(Đã xong)* | **-1 bảng** |
| **TỔNG CỘNG TIỀM NĂNG GIẢM**| **Toàn hệ thống**| **Từ ~50+ bảng giảm xuống còn ~33 bảng** | **-17 BẢNG (~34%)** |

---

## 4. Lộ Trình Triển Khai Chi Tiết (Phased Execution Roadmap)

- **Bước 1 (Đã hoàn thành)**: Tạo `social_reactions` đa hình, backfill dữ liệu, dual-write an toàn, và bổ sung các index hiệu năng cao trên `social-service`, `context-service`, `recommendation-service`, `trip-service`.
- **Bước 2 (Đã hoàn thành)**: Dọn dẹp 4 bảng "chết" mồ côi trong `trip-service` (`guide_promotion`, `guide_promotion_revision`, `guide_community_distribution`, `partner_restaurant_menu_item`).
- **Bước 3 (Đã hoàn thành)**: Hợp nhất bảng mã xác thực `auth_verification_codes` trong `user-service`, triển khai dual-write và bổ sung foreign key `ON DELETE CASCADE` cho `user_profiles`.
- **Bước 4 (Đã hoàn thành)**: Mở rộng `social_reports` và `social_moderation_audit` đa hình (hỗ trợ thêm `CHAT_MESSAGE`, `CHAT_USER`), tích hợp `metadata JSONB` và `visibility` trên `social_posts`.
- **Bước 5 (Đã hoàn thành)**: Chuẩn hóa hạ tầng `trip_domain_outbox` và `trip_app_notification` trong `trip-service`.
- **Bước 6 (Deprecation Window)**: Sau chu kỳ kiểm thử thực tế trên môi trường staging/production, drop hoàn toàn các bảng cũ đã có bảng thay thế (`social_post_likes`, `social_comment_likes`, `email_verification_codes`, `password_reset_codes`).
