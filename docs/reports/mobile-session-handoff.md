# TripSense Mobile (role User) — Handoff để mở chat mới

> Dán đường dẫn file này vào chat mới và nói: "Đọc file này rồi làm tiếp từ mục 8".
> Ngày tạo: 2026-11-13. Ngôn ngữ làm việc với người dùng: **tiếng Việt**.

## 1. Mục tiêu & quy tắc làm việc
- Xây **app Flutter chỉ cho role USER** trong `apps/mobile/tripsense` dựa trên web `apps/web/tripsense`. Admin/partner/moderator dùng web (app chặn và báo "dùng website").
- Code phải **sạch, tối ưu**; giao diện mobile giống web ~80% (đã chốt).
- Theo `AGENTS.md`: tính năng phải có plan duyệt trước. Plan đã **Approved**: `docs/features/mobile-user-app.md` (đọc nó + mục "Implementation Log"). Đề xuất mặc định đã dùng: cookie jar mã hóa cho refresh token, Google Sign-In làm sau (chưa có OAuth client ID), không làm FCM, bản đồ MapLibre, Android trước, ngôn ngữ vi+en (mặc định vi).
- **Mỗi tính năng lớn = một nhánh** `nhiby/feature/<tên>`, cắt chồng từ nhánh trước. **Chỉ commit local, KHÔNG push** cho tới khi người dùng bảo. Commit message kết thúc bằng dòng `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Không commit 2 thay đổi cũ không liên quan: `docker-compose.yml`, `apps/mobile/tripsense/android/.settings/org.eclipse.buildship.core.prefs` (luôn `git reset` file `.prefs` sau `git add`).
- Làm xong mỗi tính năng: viết test, `flutter analyze` 0 lỗi, `flutter test` xanh, chạy emulator + chụp màn hình đối chiếu web, **cập nhật Excel**, commit.
- **Không nhập mật khẩu/credential của người dùng.** Không đăng ký tài khoản rác lên DB prod. Mọi thao tác ghi (tạo trip, đăng bài…) đi vào **DB prod thật** (xem mục 5).

## 2. Nhánh & commit hiện có (tất cả local, chưa push)
Thứ tự chồng (mới nhất ở dưới):
| Nhánh | Nội dung | Commit chính |
|---|---|---|
| `nhiby/mobile-user-app` | nhánh nền (tách từ `dev`) | — |
| `nhiby/feature/mobile-foundation-and-auth` | Phase 0–1: nền tảng + đăng nhập/đăng ký/OTP/quên mật khẩu/phiên | `86e0b2c` (docs), `60919f6`, `2974c23` (test), `2a7d1c9` (fix splash) |
| `nhiby/feature/mobile-onboarding` | Wizard onboarding 10 bước + cổng bắt buộc | `a27e894`, `010a156` |
| `nhiby/feature/mobile-ui-polish` | UI giống web (pill, hero gradient, tab 5 như web, menu avatar) + nhúng font Inter | `01b1f4f`, `3645127` (font), `4c0daa3`, `9d0c115` |
| `nhiby/feature/mobile-explore-places` | **ĐANG LÀM** (xem mục 8), chưa commit gì | — |

Trạng thái kiểm tra ở tip `mobile-ui-polish`: `flutter analyze` 0 lỗi, **138 test pass**.

## 3. Kiến trúc app (đã dựng)
```
lib/
  app/        app.dart, app_router.dart (resolveRedirect + GoRouter), routes.dart, app_theme.dart,
              design/ (app_tokens.dart = token port từ globals.css web; app_typography.dart = Inter)
  core/       config/app_config.dart (base URL mặc định http://10.0.2.2:8085)
              network/ (gateway_client, auth_interceptor [refresh single-flight], token_refresher,
                        access_token_store [RAM], secure_cookie_storage, api_response, failure_mapper)
              errors/ (AppFailure, error_sanitizer = zero-leak), ui/ (state_views, failure_message, brand.dart)
  features/   auth/, onboarding/, profile/, shell/, startup/, places/ (đang làm)  — mỗi feature: data/ domain/ presentation/
  l10n/       app_en.arb, app_vi.arb (+ gen/ được commit). Thêm chuỗi vào CẢ HAI file rồi `flutter gen-l10n`.
assets/fonts/ Inter 4 độ đậm TTF + OFL.txt (không dùng google_fonts nữa)
```
Quyết định kỹ thuật: Riverpod `Notifier` (không codegen), model bất biến viết tay, `go_router`, `dio` chỉ gọi qua **API Gateway** (`:8085`), access token chỉ ở RAM, refresh cookie HttpOnly lưu mã hóa (BE chỉ đọc refresh từ cookie). Lỗi luôn chuẩn hóa thành `AppFailure`, UI chỉ hiện chuỗi i18n an toàn (+ mã `ERR-xxxxx` cho lỗi server). Tài khoản không phải ROLE_USER bị đăng xuất (`SessionUnauthenticated(roleBlocked: true)`).
Router: guest → login; đã đăng nhập → `/explore`; `onboardingRequired` → `/onboarding`. Shell 5 tab giống web mobile: Explore, Chat, Trips, Planner, Saved; Community & Profile mở từ menu avatar (route top-level). Các tab chưa làm hiện `ComingSoonPage`.

## 4. Giao diện (quy tắc "giống web")
- Token: nền trắng/đen, viền `#e5e5e5`, bo 10px; **nút/ô nhập/chip bo pill** (cao 48/56), nút chính đen chữ đậm; thẻ bo 24 (`AppRadius.xxl`); accent emerald/amber; hero gradient cam (`AppGradients.hero`).
- Thành phần dùng chung: `BrandMark/BrandHeader/BrandHero/InlineAlert` (`core/ui/brand.dart`), `OptionRow`/`OptionChip` (onboarding), `LoadingView/EmptyView/ErrorView`.
- Web dùng Inter; lấy mẫu giao diện bằng cách đọc code `apps/web/tripsense/src/components/ui/*` và các feature, hoặc chụp web (khổ điện thoại) — web cần chạy `npm run dev` (khá nặng RAM). Không đăng nhập web được (không có mật khẩu) nên trang sau đăng nhập chỉ đọc code.
- Bài học: bố cục dễ sai khi cột ngoài dùng `CrossAxisAlignment.center` (nội dung bị căn giữa); dùng `stretch`. Test widget cần theme thật (`buildTripSenseTheme()`) và màn hình cao (`useTallScreen()` trong `test/support/test_app.dart`).

## 5. Môi trường chạy (Windows 11, 16 GB RAM — RẤT CĂNG)
- **DB prod** (Neon Postgres, Mongo Atlas, Upstash Redis, Qdrant) nằm ở `env/.env.shared`. Service chạy local bằng Maven nhưng nạp env prod. Khởi động service **không** chạy migration lên prod (đã kiểm tra, schema khớp). Mọi ghi từ app đi vào dữ liệu thật → chỉ test đọc / dùng tài khoản cá nhân; đề xuất tạo DB dev riêng trước các tính năng có ghi dữ liệu (Trips, Community, Chat, Đặt chỗ).
- **Khởi động backend** (script lưu bền ở `docs/reports/tools/start-be.ps1`, giới hạn heap 320 MB/JVM):
  `powershell -NoProfile -ExecutionPolicy Bypass -File docs\reports\tools\start-be.ps1 -Services "discovery-server,user-service,mail-service,place-service,recommendation-service,context-service,api-gateway"`
  (script ghi log vào thư mục `logs` cạnh script; sửa đường dẫn nếu cần). Cổng: discovery 8761, user 8081, mail 8082, place 8083, trip 8084, gateway **8085**, social 8086, context 8087, recommendation 8088, ai 8089, web 3000. **Phải bật mail-service** nếu cần gửi OTP (đã từng quên). Cần `trip/social/ai` ở các phase sau.
- **RAM**: extension Java của VS Code ngốn ~2,8 GB; backend đầy đủ + emulator + Gradle sẽ hết RAM (Gradle daemon crash). Chỉ bật service cần thiết; không bật web trừ khi cần chụp; đóng Excel khi cần ghi file.
- **Emulator**: AVD `Pixel_6`. Mở: `emulator -avd Pixel_6 -memory 2048 -no-snapshot -no-boot-anim -gpu swiftshader_indirect` (**bắt buộc `-gpu swiftshader_indirect`**, nếu không app chỉ vẽ 1 khung hình rồi đứng). Đường dẫn: `C:\Users\admin\AppData\Local\Android\sdk\{emulator,platform-tools}`. Chụp màn hình: `adb exec-out screencap -p > file.png` rồi đọc ảnh. **Không bấm phím Back ở màn gốc** (thoát app). Tắt hẳn rồi mở bằng `monkey` sẽ chạy APK đã cài → luôn `flutter run` lại sau khi đổi code.
- **Chạy app**: `cd apps/mobile/tripsense && flutter run -d emulator-5554 --no-pub` (chạy nền). Đã chấp nhận license Android, cài SDK Platform 35, `kotlin.incremental=false` trong `android/gradle.properties` (project ổ D, pub cache ổ C), manifest debug bật cleartext HTTP, INTERNET ở manifest chính.
- Bản xem trước màn hình bằng dữ liệu giả: `lib/preview_main.dart` (đã thêm vào `.git/info/exclude`, không commit): `flutter run -t lib/preview_main.dart`.
- Python dùng `py` (không phải `python`); `py -m pip install openpyxl` đã cài; không có LibreOffice. Heredoc bash có ký tự `\` trong chuỗi Python thường lỗi → viết script ra file bằng công cụ Write rồi chạy.
- Tài khoản người dùng đã đăng ký + xác minh email + hoàn tất onboarding trên prod (mail của họ). Emulator hiện **đã đăng xuất**; người dùng phải tự đăng nhập lại khi muốn test màn sau đăng nhập.

## 6. Chiến lược test (đã tư vấn người dùng — áp dụng nhất quán)
Test theo **hành vi từng tính năng**, không theo từng hàm: (1) **Unit** cho logic (repository với `FakeHttpAdapter`, controller, validator, model), (2) **Widget** cho mỗi màn (loading/empty/error, nhập sai, bấm nút, điều hướng), (3) vài **Integration** cho luồng quan trọng (hiện mới có smoke thủ công với gateway thật). Hội đồng cần: `flutter test` + `flutter analyze` xanh, có thể thêm `flutter test --coverage` (mục tiêu ~70% tầng logic), mỗi dòng Excel ghi loại/kết quả test. Helper test: `test/support/` (`fake_auth_repository`, `fake_onboarding_repository`, `fake_http_adapter`, `test_app.dart`). Test regression layout: so `getTopLeft` các widget (xem `onboarding_screen_test.dart`).

## 7. Excel theo dõi tiến độ (1 sheet "Theo dõi tiến độ")
- File: `docs/reports/mobile-user-app-tracking-v2.xlsx` (157 chức năng, 11 nhóm, banner từng nhóm có % tiến độ, dropdown trạng thái, cột nhánh Git / trạng thái code / link commit / issue / test). **File gốc `mobile-user-app-tracking.xlsx` thường bị Excel khóa** (có file `~$...`) → luôn ghi ra bản `-v2` và nhờ người dùng đóng bản cũ.
- **QUY TẮC: làm tới đâu cập nhật Excel tới đó** (cả khi làm dở), rồi gửi file cho người dùng bằng `SendUserFile`.
- Cách cập nhật (tạo lại toàn bộ từ dữ liệu, an toàn vì người dùng chưa sửa tay): sửa dữ liệu `MODULES` trong `docs/reports/tools/build_tracker.py` (hàm `T(...)`, `DONE`, `TEST`), ánh xạ test/nhánh/commit trong `docs/reports/tools/build_tracker2.py` (dict `TESTS`, hằng `*_BRANCH`, `*_COMMIT`), rồi chạy `py -X utf8 docs\reports\tools\build_tracker2.py` (**ghi thẳng ra `-v2.xlsx`**, 2 file đã tự tìm nhau theo thư mục, không còn phụ thuộc thư mục tạm). Công thức đã được kiểm bằng thư viện `formulas`. `stage_check.py` in thống kê + liệt kê dòng thiếu test. Sau khi sinh file: gửi người dùng (`SendUserFile`) + commit file `-v2` cùng `docs/features/mobile-user-app.md` (Implementation Log).
- Trạng thái hiện tại (13/11/2026): 157 chức năng, 41 Hoàn thành, 10 Đang kiểm thử, 7 Đang thực hiện, tiến độ tổng ~32,8%. Nền tảng + auth + onboarding + UI parity + font **Hoàn thành**; 5 dòng Khám phá/Địa điểm **Đang thực hiện** (nhánh `nhiby/feature/mobile-explore-places`, trạng thái code "Chưa commit"). Khi commit tính năng Khám phá: đặt `EXPLORE_COMMIT` thật thay cho "(chưa commit)" trong `build_tracker2.py` và đổi `CODE_LOCAL` -> `CODE_COMMIT` cho nhóm này.
- Việc còn mở trong Excel: Google Sign-In (Bị chặn, thiếu OAuth client ID), đăng nhập/OTP/đăng xuất/chặn admin "Đang kiểm thử" (người dùng đã đăng nhập thật nên phần lớn đã được xác nhận ngầm), kiểm tra chế độ tối, đối chiếu từng màn mới với web, CI (analyze+test), flavor dev/prod, iOS.

## 8. ĐANG LÀM DỞ: Phase 2 — Khám phá & Địa điểm (nhánh `nhiby/feature/mobile-explore-places`)
**Đã viết (chưa commit, `flutter analyze` sạch):**
- `lib/features/places/domain/`: `place.dart` (`Place`, `PlaceCategory`, `GeoPoint`, `PlaceReview`, `PlaceSuggestion`, `isApprovedPhotoUrl`), `destinations.dart` (`DestinationPreset` danang/hue/hoian, `ExploreTab`, `buildSearchQuery`), `opening_hours.dart` (`parseOpeningHours`, `todayOpeningHours`), `places_repository.dart` (interface: `search`, `autocomplete`, `details`, `exploreForYou`).
- `lib/features/places/data/`: `place_json.dart` (parse + lọc ảnh theo host được duyệt), `places_repository_impl.dart` (+ `placesRepositoryProvider`).

**Chưa làm (làm theo thứ tự):**
1. **Chuỗi i18n** (script merge ARB đã soạn nhưng chưa chạy): thêm vào cả en/vi các khóa: `exploreSearchHint`, `exploreClearSearch`, `exploreTabForYou/Food/Cafes/Stays/Attractions`, `exploreEmptyTitle`, `exploreEmptyHint`, `exploreSearchResults{query}`, `exploreFallbackNote`, `exploreChooseDestination`, `placeReviewsCount{count}`, `placeOpenToday{hours}`, `placeAbout`, `placeHours`, `placeContact`, `placeReviews`, `placeAddress`, `placeNoPhoto`, `placeBack`; rồi `flutter gen-l10n`.
2. **`presentation/explore_controller.dart`** (đã thiết kế): `ExploreState{destination, tab, query, AsyncValue<List<Place>> places, usedFallback}`; `ExploreController` (Notifier) có `selectDestination/selectTab/search/clearSearch/refresh`, gắn số thứ tự request để bỏ kết quả cũ, `sessionId` ngẫu nhiên mỗi phiên; tab "For you" gọi `exploreForYou` (cần đăng nhập) và **rơi về `search(defaultQuery)`** khi lỗi/rỗng (`usedFallback=true`); tab khác gọi `search(buildSearchQuery(keyword, dest), category, near)`. `AutocompleteController` (autoDispose): debounce 300 ms, tối thiểu 2 ký tự, bỏ kết quả cũ.
3. **UI** (thay `ComingSoonPage` ở tab Explore trong `app_router.dart`): `ExploreScreen` = chọn điểm đến (pill → bottom sheet) + ô tìm kiếm pill có gợi ý + hàng chip danh mục (For you/Food/Cafés/Stays/Attractions) + danh sách thẻ địa điểm, `RefreshIndicator`, skeleton khi tải, trạng thái rỗng/lỗi có thử lại, ghi chú khi dùng fallback. `PlaceCard` giống web: ảnh 16:10 (`cached_network_image`; không ảnh → thẻ gradient + tên), badge danh mục, tên đậm, sao amber + số đánh giá, địa chỉ, "Hôm nay: giờ". `PlaceDetailScreen` route `/places/:id` (top-level, nhận `extra: Place`, gọi `details` để làm giàu): ảnh/gradient, tên, rating, địa chỉ, giờ mở cửa cả tuần, liên hệ, giới thiệu, đánh giá. Thêm `Routes.place(id)`.
4. **Test**: `place_json` (ảnh bị lọc theo host, ref id), `opening_hours`, `buildSearchQuery`, repository với `FakeHttpAdapter`, controller (fake repo: fallback, chuyển tab, tìm kiếm, bỏ kết quả cũ, autocomplete debounce bằng `fakeAsync`), widget (`ExploreScreen` các trạng thái, chạm thẻ → mở chi tiết), cập nhật `shell_and_profile_test` nếu tab Explore không còn "Coming soon" (các test lặp qua 5 tab hiện kỳ vọng "Coming soon" ở mọi tab → đổi cho đúng).
5. Chạy emulator, chụp so với web; cập nhật Excel (thêm/đổi dòng nhóm "Khám phá & Địa điểm" trong `build_tracker.py`); commit.

**Hợp đồng API đã xác minh thật qua gateway `:8085`:**
- `GET /api/places/search?q&category=FOOD|CAFE|STAY|ATTRACTION&lat&lng&radius&limit` → `{success, data:[Place], meta:{total,query,returned,category}}` (**công khai**; lần gọi đầu có thể chậm ~10 s, sau đó ~0,2 s).
- `GET /api/places/autocomplete?q&limit&lat&lng` → `{success, data:[{id,title,subtitle,category}]}` (công khai).
- `GET /api/places/{id}?name&lat&lng&includePhoto` → `{success, data: Place}` (công khai).
- `POST /api/recommendations/explore-for-you` body `{destinationId:"danang", query|null, sessionId, limit}` → `{success, data:{items:[{place, rank, score, reasons[]}], …}}` (**cần JWT**, 401 nếu chưa đăng nhập).
- `Place`: `id,name,address,city,district,categories[],rating,userRatingCount,photos[],primaryPhoto,photoGallery[],media{state,primary,gallery},openingHours("Thứ Hai: …; Thứ Ba: …"),phone,website,location{lat,lng},reviews[]`. Ảnh thường **trống** (`media.state=PENDING`) → phải có thẻ gradient dự phòng. Chỉ hiển thị ảnh `https` từ host được duyệt (lh3-6.googleusercontent.com, ziomap-api.socibi.com, res.cloudinary.com, maps.mapvina.com), không có `key|api_key|token|secret` trong query.
- Web tham chiếu: `apps/web/tripsense/src/features/places/{services,components,types,utils}` (đặc biệt `explore-feed-header.tsx`, `place-card.tsx`, `place-discovery-view.tsx`).

## 9. Các phase còn lại (theo plan, thứ tự gợi ý)
Phase 2 tiếp: tìm kiếm nâng cao/lọc, bản đồ (MapLibre + tile MapVina cần key), lưu địa điểm/Collections/Saved. Phase 3: Trips (+ mời, cộng tác SSE, Calendar) và AI Planner (stream). Phase 4: Community. Phase 5: Chat (SSE) & Notifications (FCM **không làm**). Phase 6: Hồ sơ đầy đủ & Cài đặt (đổi ngôn ngữ/theme/mật khẩu). Phase 7: Đặt chỗ (khách sạn, nhà hàng, guide, thuê đồ, PayOS deep link). Chất lượng: CI, flavor, build release, iOS (cần Mac), Google Sign-In (cần OAuth client ID Android/iOS).

## 10. Việc cần hỏi/nhắc người dùng
- Đóng file Excel gốc nếu muốn ghi đè (hoặc dùng bản `-v2`).
- Khi tới tính năng có ghi dữ liệu: hỏi dùng DB prod hay tạo DB dev Neon riêng.
- Khi cần test màn sau đăng nhập: nhờ người dùng tự đăng nhập trên emulator.
- Khi nào push các nhánh lên GitHub / tạo PR (chưa làm gì).
- Ghi chú: trong `docs/reports/` có `session-review-and-audit-report.md` không phải do tôi tạo.
