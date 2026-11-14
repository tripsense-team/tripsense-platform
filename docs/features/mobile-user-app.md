# Mobile User App (Flutter) — Specification & Implementation Plan

`STATUS: APPROVED` (đang triển khai — Phase 0–1 hoàn tất, xem "Implementation Log")

- **Owner Service**: `apps/mobile/tripsense` (client-only; không thêm service mới)
- **Affected Components**: `apps/mobile/tripsense`; backend **không đổi** ở các phase mặc định (xem Open Questions Q1, Q3)
- **Created Date**: 2026-11-11
- **Branch**: `nhiby/mobile-user-app`
- **Target PR Boundaries**: Phase 0 (Foundation) → 1 (Auth & Onboarding) → 2 (Explore & Places) → 3 (Trips & AI Planner) → 4 (Community) → 5 (Chat & Notifications) → 6 (Saved, Profile, Settings) → 7 (Hotels, Restaurants, Guides, Rentals, Reservations)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal
Web TripSense (`apps/web/tripsense`) đã có đầy đủ trải nghiệm cho khách du lịch (role user), partner và admin. Mobile hiện chỉ là bộ khung 9 file (`lib/app`, `lib/core`, `lib/features/startup`). Mục tiêu: xây app Flutter **chỉ cho role user**, tái hiện các luồng web dành cho traveler trên mobile, code sạch, tối ưu, tái sử dụng backend hiện có qua API Gateway. Admin và partner tiếp tục dùng web.

### 1.2 User Flows (bám theo web `(main)` routes)
1. Mở app → khôi phục phiên (refresh cookie) → chưa đăng nhập: Login/Register/Google; đã đăng nhập: vào Home.
2. Lần đầu: Onboarding sở thích/ngân sách (`/api/context/onboarding`).
3. Khám phá: Explore-for-you, tìm kiếm + autocomplete, chi tiết địa điểm, lưu vào Collection.
4. Lên kế hoạch: tạo/sửa trip, mời thành viên, join qua lời mời, AI Planner chat tạo lịch trình, commit vào trip.
5. Cộng đồng: feed, bài viết, bình luận, like/save, chia sẻ trip, hồ sơ creator.
6. Chat bạn bè, thông báo, chấm đỏ chưa đọc.
7. Hồ sơ, cài đặt, đổi mật khẩu, đăng xuất.
8. Đặt chỗ phía user: khách sạn, nhà hàng, guide inquiry, thuê đồ, danh sách reservations.

### 1.3 Scope Boundaries
- **In-Scope**: các route `(auth)` và `(main)` dành cho user: `login, register, onboarding, explore, places, trips(+new/join/[id]), ai-planner, community(+saved/posts/users), chat, collections, saved, calendar, notifications, profile, settings, support, reservations, hotels, restaurants, guides, guide-inquiries`.
- **Out-of-Scope**: toàn bộ `/admin/*`, `/partner/*`, `/moderation`; mọi API `/api/places/admin`, `/api/partners/businesses`, `/api/admin/*`; thay đổi backend; tablet/desktop layout tối ưu riêng; offline-first đầy đủ (chỉ cache đọc cơ bản).
- **Phân tầng ưu tiên**: Phase 0–3 là lõi (MVP nghiệm thu); Phase 4–7 theo thứ tự đã nêu, có thể cắt giảm theo thời hạn.

### 1.4 Acceptance Criteria
- [ ] AC-1: Đăng ký, xác minh email, đăng nhập, đăng xuất, quên/đổi mật khẩu chạy qua Gateway; khởi động lại app vẫn giữ phiên.
- [ ] AC-2: Access token hết hạn tự refresh, **single-flight** (nhiều request song song chỉ 1 lần refresh); refresh thất bại → về Login.
- [ ] AC-3: Mọi màn hình có đủ 3 trạng thái loading/empty/error; lỗi hiển thị thông điệp đã sanitize, không lộ lỗi server/SQL/token.
- [ ] AC-4: Toàn bộ chuỗi UI qua i18n (vi/en), không hard-code chuỗi.
- [ ] AC-5: `flutter analyze` 0 issue, `flutter test` xanh, không `print`, không `dynamic` ngoài tầng parse JSON.
- [ ] AC-6: Không có màn hình/route nào của admin/partner trong app; role khác `USER` đăng nhập thì thấy thông báo "dùng web".
- [ ] AC-7: Cuộn danh sách 60 fps trên thiết bị tầm trung: list lazy (`ListView.builder`/slivers), ảnh cache + resize.

---

## 2. Architecture & Service Boundaries

### 2.1 Data Flow
```text
[Flutter App] --HTTPS/REST (+SSE)--> [API Gateway :8085] --> user / place / trip / social / context / recommendation / ai / mail
```
Mobile chỉ nói chuyện với Gateway (đúng guardrail). Không URL service nội bộ, không bí mật backend trên client.

### 2.2 Cấu trúc thư mục (feature-first, 3 tầng)
```text
lib/
  main.dart
  app/            # TripSenseApp, router (+auth guard), theme
  core/
    config/       # AppConfig (flavor + --dart-define)
    network/      # dio client, auth interceptor (single-flight refresh), cookie jar
    errors/       # AppFailure (sealed), sanitizer, incident id
    session/      # SessionController (AsyncNotifier), secure storage
    i18n/         # vi/en ARB + generated l10n
    ui/           # design tokens, shared widgets (state views, image, skeleton)
    utils/
  features/<name>/
    data/         # api (dio) + dto (json_serializable) + repository impl
    domain/       # entity (immutable), repository interface
    presentation/ # providers (Riverpod), screens, widgets
```
Quy tắc: `presentation → domain ← data`; widget không gọi dio trực tiếp; DTO không rò lên UI (map sang entity).

### 2.3 Quyết định kỹ thuật chính
| Hạng mục | Lựa chọn | Lý do |
| --- | --- | --- |
| State | `flutter_riverpod` 3 (đã có) + `riverpod_annotation`/generator | Đã dùng, test dễ, không BuildContext |
| Routing | `go_router` (đã có) + `redirect` theo session | Deep link (trip invite, PayOS return) |
| HTTP | `dio` (đã có) + interceptor | Single-flight refresh, sanitize lỗi |
| Model | `freezed` + `json_serializable` | Immutable, union cho state, ít boilerplate |
| Lưu phiên | `dio_cookie_manager` + `PersistCookieJar` (storage mã hóa qua `flutter_secure_storage`) | Backend refresh/logout chỉ đọc **cookie HttpOnly** (`AuthController`), nên không cần sửa BE |
| Access token | Chỉ giữ trong RAM (notifier) | Giống web; không ghi đĩa |
| Ảnh | `cached_network_image` | Cache đĩa + placeholder |
| Bản đồ | `maplibre_gl` (web dùng MapVina) | Cùng nguồn tile; xem Q4 |
| i18n | `flutter_localizations` + `intl` ARB (vi/en) | Chuẩn Flutter; đồng bộ khóa với `apps/web/.../locales` theo namespace |
| Realtime | SSE qua dio stream cho chat/collab | BE đang dùng SSE (`/api/social/chat/events`) |
| Lint | `flutter_lints` + bật `strict-casts/strict-inference/strict-raw-types` | Clean code, chặn `dynamic` |

### 2.4 Architecture Guardrails
- [x] Chỉ đi qua API Gateway; base URL qua `--dart-define`, **mặc định cần sửa** từ `:8080` sang cổng gateway thực (`:8085`) hoặc flavor.
- [x] Không query DB, không tạo service mới.
- [x] AI chỉ gọi qua `/api/ai/*`; không để key trên client.
- [x] Tuân thủ `ERROR_HANDLING_AND_LOGGING_STANDARDS.md` (zero-leak) và `I18N_STANDARDS.md` (tinh thần namespace/parity) cho mobile.

---

## 3. API Contracts (tái dùng hoàn toàn, theo web)

| Nhóm | Endpoint (qua Gateway) | Ghi chú |
| --- | --- | --- |
| Auth | `POST /api/auth/{register,login,google,refresh,logout,logout-all,verify-email,resend-code,forgot-password,reset-password}`, `PUT /api/auth/password` | refresh/logout dùng cookie |
| User | `GET/PATCH /api/users/me`, `GET /api/users/profile/{id}` | |
| Onboarding | `/api/context/onboarding` | |
| Places | `GET /api/places/{search,autocomplete,nearby}`, `/api/places/me/collections*` | |
| Recommend | `GET /api/recommendations/explore-for-you[/sections]` | cần JWT (401 nếu thiếu) |
| Trips | `/api/trips*`, `/api/trips/invitations`, `/api/trips/place-memberships`, collab SSE `/api/trips/*/collaboration/events` | |
| AI | `/api/ai/*` (stream) | giữ nguyên giao thức stream của web |
| Social | `/api/social/{posts,trip-shares,media,destinations,creators,chat/*}` | chat SSE `/api/social/chat/events` |
| Reservations | `/api/public/hotels`, `/api/hotels/*`, `/api/restaurants/*`, `/api/restaurant-reservation-requests`, `/api/guide-inquiries`, `/api/rental-bookings/me`, `/api/partner-support-cases` | phía user |

Envelope chung `ApiResponse<T>{success,message,data}` → một `ApiResponse` generic + `Result`/`AsyncValue` ở repository. Danh sách endpoint chi tiết + DTO sẽ được chốt cuối mỗi phase từ code web tương ứng, không đoán.

---

## 4. Data Model & Migrations
Không có thay đổi DB/migration. Lưu cục bộ:
| Dữ liệu | Nơi lưu |
| --- | --- |
| Refresh cookie | `PersistCookieJar` + secure storage (Keystore/Keychain) |
| Access token | RAM |
| Locale, cờ onboarding đã xem | `shared_preferences` |
| Cache đọc nhẹ (explore, địa điểm) | Cache HTTP/ảnh của thư viện; **không** lưu PII dài hạn |

---

## 5. Security & Trust Boundaries
| Risk | Mitigation |
| --- | --- |
| Lộ token | Access token chỉ ở RAM; cookie lưu secure storage; không log token/Authorization |
| Lộ lỗi nội bộ | Mọi lỗi qua `AppFailure` + sanitizer; UI chỉ thấy thông điệp thân thiện + incident id |
| IDOR | Mobile không tự quyết quyền; luôn dựa BE. Ẩn UI theo role chỉ là UX |
| Transport | HTTPS ở production; cho phép HTTP chỉ ở debug (Android `usesCleartextTraffic` theo flavor) |
| Google login | Dùng Google Sign-In SDK lấy idToken gửi `/api/auth/google`; client ID riêng Android/iOS (Q2) |
| Deep link | Whitelist host/path; xác thực trước khi nhận invite/payment result |
| Chống chụp/biên dịch | Bật obfuscation `--obfuscate --split-debug-info` ở release |

---

## 6. Devil's Advocate & Trade-offs
| Khía cạnh | Rủi ro | Giải pháp / Đánh đổi |
| --- | --- | --- |
| Quy mô | Web user-side ~45k dòng TS; làm hết trong một lần là quá lớn | Chia 8 phase, mỗi phase một PR, nghiệm thu từng phase; MVP là Phase 0–3 |
| Cookie refresh trên mobile | Cookie HttpOnly không như trình duyệt; mất khi cookie jar hỏng | Persist jar mã hóa; fallback về Login. Phương án thay thế: BE thêm refresh-token trong body cho client mobile (đổi BE, từ chối mặc định vì ngoài phạm vi; xem Q1) |
| Race refresh | Nhiều request 401 đồng thời | Single-flight giống `api-client.ts` của web, có `authVersion` chống refresh sau logout |
| freezed/codegen | Thêm bước `build_runner`, file `.g.dart` | Đổi lấy code ngắn, ít lỗi; commit file generated hay không → Q5 |
| Chat/Collab realtime | SSE bị ngắt khi app nền | Chỉ kết nối khi foreground; reconnect + resume bằng REST; push FCM là mở rộng (Q3) |
| Hiệu suất | Payload search lớn (81 KB), BE chậm (đã phân tích riêng) | Phân trang, `ListView.builder`, debounce autocomplete, hủy request cũ (`CancelToken`); tối ưu BE làm sau |
| Rejected: Bloc, GetX | — | Riverpod đã có sẵn trong dự án, ít nghi thức hơn Bloc |
| Rejected: WebView bọc web | Nhanh nhưng không phải app thật, UX/hiệu suất kém | Không đạt yêu cầu "clean, tối ưu" |
| Rejected: Monorepo package tách (melos) | Quá sớm cho 1 app | Giữ 1 package, ranh giới bằng thư mục `features/` |

---

## 7. Phased Implementation Tasks & Verification

### Phase 0: Foundation
- [ ] Nâng `pubspec` (freezed, json_serializable, riverpod_annotation, dio_cookie_manager, cookie_jar, flutter_secure_storage, shared_preferences, cached_network_image, intl) và `analysis_options` strict.
- [ ] Flavor/config: dev/prod, sửa default gateway, README cập nhật.
- [ ] `core/network`: dio client, auth interceptor single-flight, cookie jar, error sanitizer, `ApiResponse<T>`.
- [ ] `core/i18n` (vi/en), theme + design tokens, shared state widgets (loading/empty/error), shell điều hướng bottom-nav.
- [ ] Test: interceptor refresh (single-flight, logout race), sanitizer, router guard.

### Phase 1: Auth & Onboarding
- [ ] Login, Register, Verify email (OTP), Resend, Forgot/Reset password, Google Sign-In, Splash khôi phục phiên, Onboarding.
### Phase 2: Explore & Places
- [ ] Home/Explore-for-you, search + autocomplete, chi tiết địa điểm, bản đồ, Collections/Saved.
### Phase 3: Trips & AI Planner
- [ ] Danh sách/tạo/chi tiết trip, ngày/hoạt động, mời/join, Calendar; AI Planner chat + commit trip.
### Phase 4: Community
- [ ] Feed, chi tiết/tạo bài (upload media), bình luận, like/save, chia sẻ trip, creator profile.
### Phase 5: Chat & Notifications
- [ ] Danh sách hội thoại, nhắn tin (SSE), thông báo + badge.
### Phase 6: Profile, Settings, Support
- [ ] Hồ sơ, chỉnh sửa, cài đặt (ngôn ngữ, mật khẩu, thiết bị), hỗ trợ.
### Phase 7: Bookings (user side)
- [ ] Hotels (+PayOS return deep link), Restaurants, Guides/Guide inquiries, Rentals, Reservations hub.

### Verification Commands
```bash
cd apps/mobile/tripsense
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter analyze
flutter test
flutter run --dart-define=TRIPSENSE_API_BASE_URL=http://10.0.2.2:8085
```
Mỗi phase: chạy app trên emulator với backend local (đã chạy sẵn), kiểm thủ công luồng trong AC liên quan.

---

## Open Questions (cần bạn chốt trước khi Approve)
1. **Auth trên mobile**: dùng cookie jar bền vững (không đổi BE, **đề xuất**) hay muốn BE hỗ trợ refresh token qua body cho mobile?
2. **Google Sign-In**: đã có OAuth client ID cho Android/iOS chưa? (hiện chỉ thấy Web client ID). Nếu chưa, Phase 1 làm email/password trước.
3. **Push notification (FCM)**: có làm không? (Firebase project `tripsense-642bd` đã có; cần BE lưu device token → đổi BE, nên là phase riêng).
4. **Bản đồ**: dùng MapLibre với tile MapVina như web (cần key) hay Google Maps?
5. **Codegen**: commit file `.g.dart/.freezed.dart` hay sinh trong CI?
6. **Phạm vi nghiệm thu**: chốt MVP = Phase 0–3, hay cần đủ cả 7 phase? Có hạn chót nào không?
7. **Nền tảng**: Android trước, hay cả iOS (cần máy Mac để build/ký)? Hiện máy là Windows.
8. **Ngôn ngữ**: vi + en như web, mặc định vi?

---

## Human Approval Gate
Dừng ở `STATUS: WAITING_FOR_HUMAN_APPROVAL`. Chỉ triển khai khi bạn trả lời `Approved` / `Implement` / `Proceed` (kèm câu trả lời các Open Questions, hoặc chấp nhận các đề xuất mặc định).

---

## Implementation Log

**Approved 2026-11-11** với toàn bộ đề xuất mặc định (Q1 cookie jar, Q2 Google Sign-In sau, Q3 FCM không làm, Q4 MapLibre, Q6 MVP = Phase 0–3, Q7 Android trước, Q8 vi + en mặc định vi).

**Điều chỉnh so với plan (Q5):** không dùng codegen (`freezed`, `json_serializable`, `riverpod_generator`). Model là class bất biến Dart 3 + `fromJson` viết tay, state dùng Riverpod `Notifier`. Lý do: ít dependency/bước build, không có file `.g.dart`, ít rủi ro xung đột analyzer với Dart 3.12. Chỉ file sinh ra là `lib/l10n/gen/*` (gen-l10n), được commit.

| Phase | Trạng thái | Ghi chú |
| --- | --- | --- |
| 0 Foundation | DONE | config, dio + cookie jar bảo mật, interceptor single-flight, sanitizer, i18n vi/en, theme, shell điều hướng, router guard |
| 1 Auth | DONE (một phần) | Login, Register, Verify OTP, Resend, Forgot/Reset, Splash khôi phục phiên, chặn role không phải USER. **Chưa làm:** Google Sign-In (Q2, cần client ID), Onboarding wizard (tách thành phase 1b) |
| 1b Onboarding | DONE (chờ nghiệm thu lưu thật) | Nhánh `nhiby/feature/mobile-onboarding`: wizard 10 bước, cổng bắt buộc, lưu/hoàn tất qua context-service. 135 test pass. Đã chạy trên emulator; chưa bấm Hoàn tất với DB prod. |
| UI parity (~80% giống web) | DONE (đã nhúng font Inter) | Nhánh `nhiby/feature/mobile-ui-polish`: theme pill, hero gradient, màn auth/onboarding/khung chính theo web. Đã chụp emulator đối chiếu. 137 test pass. |
| 2 Explore & Places | ĐANG LÀM, phần lõi xong (PR #103 chờ review; tiếp nối ở nhánh `nhiby/feature/mobile-save-collections`) | Explore + chi tiết địa điểm: PR [#103](https://github.com/tripsense-team/tripsense-platform/pull/103) (commit `55ae057`, đã push). Lưu địa điểm + Bộ sưu tập + tab Saved: code + test xong trên nhánh `nhiby/feature/mobile-save-collections`, **chưa commit**. 203 test pass, analyze 0 issue. **Chưa làm:** bản đồ MapLibre, gallery ảnh, phân trang feed, tìm kiếm trong Đã lưu, sections cuộn ngang. |
| 3 Trips & AI Planner | TODO | |
| 4–7 | TODO | |

Verification Phase 0–1: `flutter analyze` 0 issue; `flutter test` 23 test pass (interceptor, sanitizer, router redirect, session controller, login screen); smoke test với gateway local xác nhận refresh-không-cookie → không phiên, login sai → 401 map đúng, endpoint công khai → 200. Chưa chạy trên emulator/thiết bị (máy không có Android emulator).

### Cập nhật phạm vi (2026-11-11)
- **Q6 đổi:** nghiệm thu **đủ cả 7 phase** (mọi trang user của web), không còn dừng ở MVP Phase 0–3.
- **Quy tắc UI parity:** giao diện mobile phải giống web. Design tokens (màu, bo góc, bóng, cỡ chữ) port 1:1 từ `apps/web/tripsense/src/app/globals.css` vào `lib/app/design/` (`app_tokens.dart`, `app_typography.dart`); đổi token ở web thì đổi ở mobile. Font Inter qua `google_fonts` (web dùng `.woff2`, Flutter không đọc được). Mỗi màn hình mobile bám bố cục/luồng của trang web tương ứng, tối ưu cho thao tác một tay (bottom sheet thay modal, bottom nav thay sidebar).
- Phase 0 hoàn thành thêm: theme theo web (đã áp dụng cho các màn auth).

**Quy ước nhánh:** `nhiby/feature/<tên-tính-năng>`, mỗi tính năng lớn một nhánh, cắt chồng từ nhánh trước. Tiến độ chi tiết theo từng chức năng: `docs/reports/mobile-user-app-tracking-v2.xlsx`.

### Quy tắc theo dõi tiến độ (bắt buộc)
- **Làm tới đâu cập nhật Excel tới đó:** sau mỗi tính năng (và cả khi làm dở) cập nhật `docs/reports/mobile-user-app-tracking-v2.xlsx` (trạng thái, tiến độ, ngày, nhánh Git, trạng thái code, commit, issue, loại/kết quả test) rồi ghi Implementation Log ở trên.
- Cách làm: sửa dữ liệu trong `docs/reports/tools/build_tracker.py`, ánh xạ nhánh/commit/test trong `docs/reports/tools/build_tracker2.py`, chạy `py -X utf8 docs\reports\tools\build_tracker2.py` (ghi thẳng ra bản `-v2`).
- File Excel gốc `mobile-user-app-tracking.xlsx` hay bị Excel khóa: luôn dùng bản `-v2`.


### Nhật ký 2026-11-13 (phiên làm việc Phase 2)
**Quyết định / quy ước mới:** mỗi tính năng một nhánh `nhiby/feature/<tên>`; **chỉ commit/push khi người dùng đồng ý**; trước mỗi commit/push phải chạy đủ `flutter analyze` + `flutter test` để CI không fail; DB test của các tính năng có ghi dữ liệu = **DB prod, chỉ dùng tài khoản của người dùng** và phải dọn dữ liệu test sau khi thử.

**1. Khám phá & Chi tiết địa điểm** (nhánh `nhiby/feature/mobile-explore-places`, commit `55ae057`, đã push, PR #103 vào `dev`, chờ review, chưa merge)
- Màn Explore: chọn điểm đến (Đà Nẵng/Huế/Hội An), ô tìm kiếm + autocomplete (debounce 300 ms, tối thiểu 2 ký tự, bỏ kết quả cũ), chip danh mục, thẻ địa điểm, skeleton, rỗng/lỗi + thử lại, kéo để làm mới.
- Tab "For you" gọi explore-for-you; lỗi/rỗng thì rơi về địa điểm nổi bật kèm ghi chú.
- Chi tiết `/places/:id`: giờ mở cửa cả tuần, liên hệ, đánh giá; API chi tiết lỗi vẫn hiện dữ liệu từ danh sách.
- Test: 172 pass. Đã xem trên emulator với dữ liệu thật; sửa chip đang chọn bị chữ tối trên nền đen.
- Lưu ý BE (không phải lỗi app): recommendation-service gọi place-service bị `ResourceAccessException` khi chạy local (nghi do giới hạn heap), nên feed cá nhân hóa đang fallback.
- PR #103 chứa 12 commit vì các nhánh trước (foundation, onboarding, UI polish) chưa từng được push.

**2. Lưu địa điểm & Bộ sưu tập** (nhánh `nhiby/feature/mobile-save-collections`, **chưa commit**)
- Thư mục mới `lib/features/collections/` (data/domain/presentation). API: `/api/places/me/{collections,saved,saved-status:batch}`, PUT/DELETE `collections/{id}/places/{ref}`.
- Nút tim trên thẻ + màn chi tiết (trạng thái lưu lấy theo batch), sheet chọn nhiều bộ sưu tập + tạo mới trong sheet (chỉ gọi thêm/xóa phần chênh lệch), tab Saved (cuộn vô hạn 20/trang, chip lọc theo bộ sưu tập), màn `/collections` (tạo/đổi tên/xóa có xác nhận) và `/collections/:id`.
- Dữ liệu tách theo tài khoản (`signedInUserIdProvider`) để không lộ dữ liệu khi đổi user.
- Lỗi thật tìm ra khi làm: (a) Riverpod 3 tự retry provider lỗi nên UI không hiện lỗi → tắt `retry` cho 2 provider; (b) dialog dispose `TextEditingController` quá sớm → chuyển vào widget dialog riêng; (c) theme đặt `minimumSize` rộng vô hạn nên nút trong `Row` lỗi layout → đặt `minimumSize: Size(0, 48)`; (d) chuỗi "1 places" → dùng plural ICU (chỉ bản en).
- Test: 203 pass (31 test mới), analyze 0 issue.
- Đã thử trên emulator với DB prod: tạo "Mobile test", lưu địa điểm, thấy ở Saved, rồi xóa bộ sưu tập; dữ liệu test đã dọn.
- Chưa làm: ô tìm kiếm trong Đã lưu; nút Xóa trong hộp thoại xác nhận đang kéo dài hết chiều ngang.

**Việc tiếp theo gợi ý:** commit nhánh save-collections (khi người dùng đồng ý) và push/tạo PR; sau đó Bản đồ (cần key MapVina), gallery ảnh, rồi sang Phase 3 (Trips & AI Planner).
