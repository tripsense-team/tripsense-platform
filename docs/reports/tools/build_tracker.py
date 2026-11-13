"""Builds the TripSense Mobile (role USER) progress tracker workbook."""
from datetime import date
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.formatting.rule import CellIsRule, DataBarRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = r"D:\capstone\tripsense-platform\docs\reports\mobile-user-app-tracking.xlsx"
BRANCH = "nhiby/mobile-user-app"
OWNER = "nhiby"
D1 = date(2026, 11, 11)
D3 = date(2026, 11, 13)
LAST_ROW = 300  # formulas / validation / formatting cover rows up to here

FONT = "Arial"
NAVY, WHITE = "1F3864", "FFFFFF"

S_TODO, S_DOING, S_TEST, S_DONE, S_BLOCK, S_HOLD = (
    "Chưa bắt đầu", "Đang thực hiện", "Đang kiểm thử", "Hoàn thành", "Bị chặn", "Tạm hoãn",
)
STATUSES = [S_TODO, S_DOING, S_TEST, S_DONE, S_BLOCK, S_HOLD]
STATUS_FILL = {
    S_DONE: "C6EFCE", S_TEST: "BDD7EE", S_DOING: "FFEB9C",
    S_TODO: "EDEDED", S_BLOCK: "FFC7CE", S_HOLD: "E4DFEC",
}
STATUS_FONT = {
    S_DONE: "006100", S_TEST: "1F4E78", S_DOING: "7F6000",
    S_TODO: "595959", S_BLOCK: "9C0006", S_HOLD: "5B3F86",
}
ISSUE_OPEN, ISSUE_FIXED, ISSUE_ACCEPT = "Đang mở", "Đã xử lý", "Chấp nhận rủi ro"
CODE_NONE, CODE_LOCAL, CODE_COMMIT, CODE_PUSHED, CODE_MERGED = (
    "Chưa làm", "Chưa commit", "Đã commit (chưa push)", "Đã push", "Đã merge",
)

thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def font(size=10, bold=False, color="000000", italic=False):
    return Font(name=FONT, size=size, bold=bold, color=color, italic=italic)


def fill(hex_):
    return PatternFill("solid", start_color=hex_, end_color=hex_)


def T(name, desc="", web="", prio="P1", status=S_TODO, prog=0.0, start=None,
      end=None, issue="", istate="", fix="", note="", due=None):
    return dict(name=name, desc=desc, web=web, prio=prio, status=status, prog=prog,
                start=start, end=end, issue=issue, istate=istate, fix=fix, note=note,
                due=due)


def DONE(name, desc="", web="", prio="P0", **kw):
    return T(name, desc, web, prio, S_DONE, 1.0, D1, D1, **kw)


def TEST(name, desc="", web="", prio="P0", prog=0.9, **kw):
    return T(name, desc, web, prio, S_TEST, prog, D1, None, **kw)


# --------------------------------------------------------------------------
# Feature breakdown: module -> features -> tasks   (ROLE USER ONLY)
# --------------------------------------------------------------------------
MODULES = [
    ("Nền tảng & Hạ tầng", "Phase 0", "DDEBF7", [
        ("Khởi tạo & cấu hình dự án", [
            DONE("Cấu trúc thư mục feature-first", "app / core / features / l10n; mỗi feature 3 tầng data - domain - presentation, phụ thuộc một chiều."),
            DONE("Dependencies nền tảng", "dio, riverpod, go_router, cookie_jar, secure storage, shared_preferences, cached_network_image, intl, google_fonts."),
            DONE("Lint nghiêm ngặt (analysis_options)", "strict-casts / strict-inference / strict-raw-types + 10 rule bổ sung; flutter analyze 0 lỗi."),
            DONE("Cấu hình môi trường API Gateway", "Chỉ gọi qua Gateway (:8085), cấu hình bằng --dart-define; mặc định 10.0.2.2 cho Android emulator.",
                 issue="Backend local và app mobile dùng chung DB prod (Neon, Mongo Atlas, Upstash Redis, Qdrant): mọi thao tác ghi từ app đi vào dữ liệu thật.", istate=ISSUE_ACCEPT,
                 fix="Chỉ test thao tác đọc, dùng tài khoản cá nhân. Đề xuất tạo DB dev riêng trước Phase 3 (có ghi dữ liệu)."),
            DONE("Cấu hình Android (quyền mạng, HTTP debug, Kotlin)", "INTERNET vào manifest chính; usesCleartextTraffic chỉ bật cho debug; tắt kotlin.incremental; đổi tên hiển thị TripSense.",
                 issue="(1) Kotlin lỗi 'this and base files have different roots': project ở ổ D, pub cache ở ổ C nên cache biên dịch tăng dần bị hỏng. (2) Android 9+ chặn HTTP thường tới gateway local; bản release thiếu quyền INTERNET.", istate=ISSUE_FIXED,
                 fix="Thêm kotlin.incremental=false vào android/gradle.properties; bật usesCleartextTraffic chỉ cho debug và thêm INTERNET vào manifest chính."),
            T("Flavor dev / staging / prod", "Tách base URL và cấu hình theo môi trường.", prio="P1"),
            T("Cấu hình iOS", "Chưa làm: cần máy Mac để build/ký. Làm Android trước theo thỏa thuận.", prio="P2"),
        ]),
        ("Tầng mạng & bảo mật", [
            DONE("HTTP client (Dio) qua API Gateway", "Timeout 10s/20s, header Accept, cookie manager."),
            DONE("Lưu refresh cookie mã hóa", "PersistCookieJar + flutter_secure_storage (Keychain/Keystore) vì BE chỉ đọc refresh token từ cookie HttpOnly."),
            DONE("Interceptor tự refresh token (single-flight)", "Nhiều request 401 cùng lúc chỉ refresh 1 lần; bỏ kết quả nếu user đã đăng xuất trong lúc refresh."),
            DONE("Access token chỉ lưu trên RAM", "Không ghi xuống đĩa; version chống race khi logout."),
            DONE("Envelope ApiResponse & parse JSON an toàn", "Chuẩn {success, message, data} của mọi service."),
            DONE("Chuẩn hóa lỗi (AppFailure + sanitizer)", "Không bao giờ hiện lỗi SQL/stack trace/token ra UI; có mã tham chiếu ERR-xxxxx cho lỗi server."),
        ]),
        ("Design system (đồng bộ với web)", [
            DONE("Design tokens (màu, bo góc, bóng)", "Port 1:1 từ globals.css của web: nền trắng/đen, viền #e5e5e5, bo 10px, accent emerald/amber."),
            DONE("Typography (font Inter, vai trò chữ)", "display / page-title / section-title / heading / body / caption / overline theo web."),
            DONE("Theme sáng / tối", "Theo hệ thống; dark theo token dark của web."),
            DONE("Widget trạng thái dùng chung", "LoadingView / EmptyView / ErrorView (có nút thử lại)."),
            DONE("Bottom navigation 5 tab (shell)", "Khám phá, Chuyến đi, Trợ lý AI, Cộng đồng, Hồ sơ; các tab chưa làm hiện 'Sắp ra mắt'."),
            DONE("Router + auth guard", "go_router, redirect theo trạng thái phiên (checking / guest / authenticated)."),
            T("Thư viện component dùng chung", "Card địa điểm, chip, avatar, ảnh cache + placeholder, nút, bottom sheet theo web.", prio="P0"),
            T("Skeleton loading", "Khung chờ cho danh sách / chi tiết.", prio="P1"),
        ]),
        ("Giao diện giống web (UI parity ~80%)", [
            T("Theme pill: nút, ô nhập, chip bo tròn hết cỡ", "Nút chính đen, outline, ô nhập cao 56 bo pill, chip pill; thanh điều hướng không viên thuốc, nhãn đậm khi chọn.", "components/ui/button, input", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã đối chiếu mã nguồn web (rounded-full, h-12/h-14) và chụp màn hình emulator."),
            T("Logo, hero gradient cam, khung báo lỗi bo tròn", "BrandMark / BrandHeader / BrandHero (gradient amber-orange của hero web) và InlineAlert.", "landing-hero, auth-modal", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3,
              issue="Hero ban đầu quá tối (lớp phủ đen 30%) so với web.", istate=ISSUE_FIXED, fix="Giảm lớp phủ xuống 12% và dùng màu amber/orange sáng hơn; đã chụp lại emulator thấy khớp web."),
            T("Màn Đăng nhập / Đăng ký theo phong cách web", "Logo, hero, tiêu đề đậm chữ khít, ô nhập và nút pill.", "(auth)/login, register", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3),
            T("Onboarding theo phong cách web", "Huy hiệu tròn đen, hàng lựa chọn pill có ô tích tròn, tiến độ kèm %, nút Quay lại/Tiếp tục có mũi tên.", "(main)/onboarding", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã chụp màn hình emulator (bản xem trước dữ liệu giả, tiếng Việt)."),
            T("Khung chính: 5 tab như web + header logo + menu avatar", "Explore / Chat / Trips / Planner / Saved; Cộng đồng và Hồ sơ mở từ menu avatar (giống web).", "components/layout/user/mobile-navigation", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã chụp màn hình emulator."),
            T("Bundle font Inter để chạy offline", "Inter Regular/Medium/SemiBold/Bold (TTF, SIL OFL) nhúng vào assets; bỏ google_fonts.", "app/layout (Inter)", prio="P1", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã kiểm chứng trên emulator ở chế độ máy bay: chữ vẫn là Inter, tiếng Việt có dấu đúng. Nguồn: rsms/inter v4.0, kèm OFL.txt.",
              issue="Trước đó font tải lúc chạy qua mạng nên khi offline rơi về Roboto.", istate=ISSUE_FIXED,
              fix="Nhúng font vào app theo sự đồng ý của người dùng (đã tải 4 file TTF từ GitHub rsms/inter)."),
            T("Kiểm tra chế độ tối (dark) trên emulator", "Token dark đã có; chưa chụp màn hình các màn mới.", "-", prio="P2"),
            T("Đối chiếu từng màn mới với web trước khi nghiệm thu", "Quy trình: chụp web (khổ điện thoại) và emulator, ghi chênh lệch.", "-", prio="P0", status=S_DOING, prog=0.3, start=D3),
        ]),
        ("Đa ngôn ngữ (vi / en)", [
            DONE("Hạ tầng gen-l10n + ARB vi/en", "Mặc định tiếng Việt, fallback theo ngôn ngữ máy; không hard-code chuỗi."),
            T("Đồng bộ khóa với locales của web", "Cùng namespace (common, auth, trip, places...) để dùng lại bản dịch.", prio="P2"),
        ]),
        ("Kiểm thử & CI", [
            DONE("Unit test nền tảng", "Interceptor, sanitizer, failure mapper, router redirect, session controller."),
            DONE("Widget test màn đăng nhập", "Validate form, thông báo sai mật khẩu."),
            DONE("Smoke test với gateway thật", "Refresh khi chưa có cookie -> không có phiên; login sai -> 401 map đúng; endpoint public -> 200 (test tạm đã xóa).", prio="P1"),
            T("CI chạy analyze + test", "GitHub Actions cho apps/mobile.", prio="P1"),
        ]),
    ]),
    ("Xác thực & Onboarding", "Phase 1", "E2EFDA", [
        ("Đăng nhập", [
            TEST("Đăng nhập email / mật khẩu", "Màn Login (web: (auth)/login), gọi /api/auth/login, lưu phiên.", "(auth)/login", prog=0.9,
                 issue="(1) Dòng 'Chưa có tài khoản? Tạo tài khoản' tràn ngang trên màn hẹp (widget test phát hiện). (2) Chưa kiểm chứng đăng nhập thật: tài khoản vừa đăng ký chưa xác minh email.", istate=ISSUE_FIXED,
                 fix="(1) Đã đổi Row sang Wrap. (2) Còn mở: xác minh email rồi đăng nhập thử trên emulator.", note="Chưa đăng nhập thử bằng tài khoản đã xác minh trên emulator."),
            DONE("Kiểm tra dữ liệu nhập (email / mật khẩu)", "Validate email hợp lệ, mật khẩu >= 6 ký tự (khớp BE).", "(auth)/login"),
            DONE("Thông báo lỗi đăng nhập thân thiện", "Sai mật khẩu -> 'Email hoặc mật khẩu không chính xác'.", "(auth)/login", note="Đã xác minh bằng smoke test: BE trả 401 và app map đúng."),
        ]),
        ("Đăng ký & xác minh email", [
            DONE("Đăng ký tài khoản", "Màn Register, gọi /api/auth/register; đã tạo được tài khoản trên prod.", "(auth)/register"),
            TEST("Nhập mã OTP xác minh email", "Màn Verify (6 số), gọi /api/auth/verify-email.", "(auth)/register", prog=0.8,
                 issue="Mail xác minh lần đầu không gửi được vì mail-service đang bị tắt (tắt để giải phóng RAM), user-service chuyển sang fallback chỉ ghi log mã.", istate=ISSUE_FIXED,
                 fix="Bật lại mail-service và gửi lại mã (Resend báo gửi thành công).", note="Chờ xác nhận đã nhận mail và nhập mã thành công."),
            TEST("Gửi lại mã xác minh", "Nút 'Gửi lại mã' gọi /api/auth/resend-code.", "(auth)/register", prog=0.9),
        ]),
        ("Quên & đặt lại mật khẩu", [
            TEST("Màn quên mật khẩu", "Nhập email -> /api/auth/forgot-password.", "(auth)/login", prio="P1", prog=0.9),
            TEST("Màn đặt lại mật khẩu bằng OTP", "OTP + mật khẩu mới -> /api/auth/reset-password.", "(auth)/login", prio="P1", prog=0.9),
        ]),
        ("Phiên đăng nhập", [
            T("Splash & khôi phục phiên", "Mở app tự đăng nhập lại từ refresh cookie đã lưu mã hóa.", "-", prio="P0", status=S_DONE, prog=1.0, start=D1, end=date(2026, 11, 13), note="Đã kiểm chứng trên emulator 13/11: tắt hẳn rồi mở lại app vẫn vào thẳng màn Khám phá (phiên được khôi phục từ cookie). Thêm giới hạn 30s để không kẹt splash.",
              issue="Splash quay mãi trên emulator: thực chất emulator chỉ vẽ 1 khung hình rồi đứng (lỗi đồ họa Impeller/OpenGL), không phải lỗi đăng nhập.", istate=ISSUE_FIXED,
              fix="Khởi động emulator với -gpu swiftshader_indirect. Đồng thời sửa code: mọi lỗi/treo khi khôi phục phiên đều về trạng thái chưa đăng nhập (giới hạn 30s)."),
            T("Tự refresh token khi hết hạn", "Đổi refresh cookie lấy access token mới; có unit test single-flight.", "-", prio="P0", status=S_DONE, prog=1.0, start=D1, end=date(2026, 11, 13), note="Đã chạy thật: khôi phục phiên dùng cookie refresh qua gateway. Chưa thử đúng lúc access token vừa hết hạn giữa phiên (đã có unit test)."),
            TEST("Đăng xuất", "Xóa token RAM + cookie, gọi /api/auth/logout.", "-", prog=0.9),
            TEST("Chặn tài khoản không phải USER", "Admin / moderator / partner bị đăng xuất kèm thông báo 'dùng website'.", "-", prog=0.9, note="Có unit test; chưa thử với tài khoản admin thật."),
        ]),
        ("Đăng nhập Google", [
            T("Đăng nhập bằng Google", "Google Sign-In lấy idToken -> /api/auth/google.", "(auth)/login", prio="P1", status=S_BLOCK,
              issue="Chưa có OAuth client ID cho Android/iOS (hiện chỉ có Web client ID).", istate=ISSUE_OPEN,
              fix="Cần tạo OAuth client Android (SHA-1) / iOS trong Google Cloud Console."),
        ]),
        ("Onboarding (Phase 1b)", [
            T("Chặn người dùng mới tới khi hoàn tất onboarding", "Router chuyển về /onboarding theo cờ onboardingRequired; người đã xong không vào lại được.", "(main)/onboarding", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã kiểm chứng trên emulator với tài khoản thật: tài khoản mới bị giữ ở wizard thay vì vào Khám phá."),
            T("Bước: tên hiển thị", "Bắt buộc; cập nhật displayName qua PUT /api/users/profile khi hoàn tất.", "(main)/onboarding", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3),
            T("Bước: nhóm đi (một mình / cặp đôi / bạn bè / gia đình)", "Chọn một đáp án (TRAVEL_PARTY).", "(main)/onboarding", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã chụp màn hình emulator: chip đen khi chọn, nút Tiếp tục chỉ bật sau khi chọn."),
            T("Bước: mức ngân sách", "BUDGET / MID_RANGE / PREMIUM (BUDGET_TIER).", "(main)/onboarding", prio="P0", status=S_DONE, prog=1.0, start=D3, end=D3),
            T("Bước: lưu trú, ẩm thực, hoạt động yêu thích", "Chọn nhiều + thêm lựa chọn tùy ý (tối đa 40 ký tự).", "(main)/onboarding", prio="P0", status=S_TEST, prog=0.9, start=D3,
              note="Chip đã kiểm chứng; ô 'Thêm lựa chọn khác' mới có test controller, chưa thử trên emulator."),
            T("Bước: thành phố xuất phát & điểm đến", "Tìm không dấu, danh sách phổ biến, tự nhập, tối đa 20 địa điểm mỗi nhóm.", "(main)/onboarding", prio="P1", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã chụp màn hình emulator (bước 2 và 4), tiếng Việt có dấu và cờ hiển thị đúng."),
            T("Bước: ngân sách mỗi ngày", "Nhập số tiền VNĐ, tự thêm dấu chấm nghìn, hợp lệ từ 1 đến 1.000.000.000.", "(main)/onboarding", prio="P1", status=S_DONE, prog=1.0, start=D3, end=D3,
              note="Đã chụp màn hình emulator: gõ 700000 hiển thị 700.000 VNĐ.",
              issue="Cột nội dung bị căn giữa thay vì căn trái ở các bước có nội dung hẹp (phát hiện qua ảnh chụp emulator).", istate=ISSUE_FIXED,
              fix="Cho cột ngoài của wizard giãn hết bề ngang (CrossAxisAlignment.stretch) và thêm test chặn tái phát (đã chứng minh test fail khi bỏ bản sửa)."),
            T("Bước: mô tả tự do + tag nhanh", "Tối đa 2000 ký tự, 6 tag nhanh.", "(main)/onboarding", prio="P2", status=S_TEST, prog=0.9, start=D3,
              note="Có test controller; chưa chụp màn hình emulator."),
            T("Lưu & hoàn tất onboarding", "PUT /api/context/onboarding (thử lại 1 lần khi xung đột phiên bản), POST /complete, đánh dấu hoàn tất profile.", "(main)/onboarding", prio="P0", status=S_TEST, prog=0.85, start=D3,
              note="Đã test với server giả (repository, controller, màn hình). CHƯA gửi thật lên DB prod: cần bạn bấm Hoàn tất bằng tài khoản của bạn để nghiệm thu."),
        ]),
    ]),
    ("Khám phá & Địa điểm", "Phase 2", "FFF2CC", [
        ("Trang Khám phá", [
            T("Header & ô tìm kiếm", "", "(main)/explore", prio="P0"),
            T("Gợi ý cho bạn (explore-for-you)", "/api/recommendations/explore-for-you, cá nhân hóa theo onboarding.", "(main)/explore", prio="P0", status=S_DOING, prog=0.3, start=D3,
              note="Đã xong domain + repository gọi API (flutter analyze sạch); chưa có controller, giao diện, test. Tab này cần đăng nhập, lỗi thì rơi về tìm kiếm địa điểm nổi bật."),
            T("Các mục theo danh mục (sections)", "Cuộn ngang theo danh mục.", "(main)/explore", prio="P0"),
            T("Phân trang & kéo để làm mới", "", "(main)/explore", prio="P1"),
        ]),
        ("Tìm kiếm", [
            T("Tìm kiếm địa điểm", "/api/places/search.", "(main)/places", prio="P0", status=S_DOING, prog=0.3, start=D3,
              note="Đã xong repository + parser Place (lọc ảnh theo host được duyệt) + buildSearchQuery; chưa có controller, giao diện, test."),
            T("Gợi ý khi gõ (autocomplete)", "Debounce 300 ms + bỏ kết quả của request cũ.", "(main)/explore", prio="P0", status=S_DOING, prog=0.2, start=D3,
              note="Đã xong repository; controller debounce và giao diện chưa làm."),
            T("Lọc theo danh mục / điểm đến", "", "(main)/explore", prio="P1"),
            T("Tìm kiếm gần đây", "", "(main)/explore", prio="P2"),
        ]),
        ("Chi tiết địa điểm", [
            T("Thông tin cơ bản", "Tên, địa chỉ, đánh giá, danh mục.", "(main)/places", prio="P0", status=S_DOING, prog=0.2, start=D3,
              note="Đã xong model Place + API chi tiết; chưa có màn hình."),
            T("Thư viện ảnh", "Gallery vuốt ngang, ảnh cache.", "(main)/places", prio="P0"),
            T("Giờ mở cửa & liên hệ", "Hiển thị giờ hôm nay + cả tuần, điện thoại, website.", "(main)/places", prio="P1", status=S_DOING, prog=0.15, start=D3,
              note="Đã xong bộ phân tích giờ mở cửa (parseOpeningHours/todayOpeningHours); chưa có màn hình."),
            T("Xem đánh giá cộng đồng", "", "(main)/places", prio="P1"),
            T("Viết đánh giá", "", "(main)/places", prio="P2"),
            T("Địa điểm gần đây (nearby)", "/api/places/nearby.", "(main)/places", prio="P2"),
        ]),
        ("Bản đồ", [
            T("Hiển thị bản đồ (MapLibre)", "Cùng nguồn tile MapVina như web.", "(main)/places", prio="P1"),
            T("Marker & thẻ địa điểm", "", "(main)/places", prio="P1"),
            T("Vị trí hiện tại & chỉ đường", "Xin quyền vị trí; mở app bản đồ ngoài.", "(main)/places", prio="P2"),
        ]),
        ("Hành động trên địa điểm", [
            T("Lưu / bỏ lưu địa điểm", "", "(main)/saved", prio="P0"),
            T("Thêm vào bộ sưu tập", "", "(main)/collections", prio="P1"),
            T("Thêm vào chuyến đi", "", "(main)/trips", prio="P1"),
            T("Chia sẻ địa điểm", "", "(main)/places", prio="P2"),
        ]),
    ]),
    ("Bộ sưu tập & Đã lưu", "Phase 2", "FCE4D6", [
        ("Bộ sưu tập (Collections)", [
            T("Danh sách bộ sưu tập", "/api/places/me/collections.", "(main)/collections", prio="P1"),
            T("Tạo / sửa / xóa bộ sưu tập", "", "(main)/collections", prio="P1"),
            T("Chi tiết bộ sưu tập", "", "(main)/collections", prio="P1"),
            T("Thêm / xóa địa điểm trong bộ sưu tập", "", "(main)/collections", prio="P1"),
        ]),
        ("Đã lưu", [
            T("Danh sách địa điểm đã lưu", "", "(main)/saved", prio="P1"),
            T("Lọc & tìm trong đã lưu", "", "(main)/saved", prio="P2"),
        ]),
    ]),
    ("Chuyến đi", "Phase 3", "EAD1F5", [
        ("Danh sách & tạo chuyến đi", [
            T("Danh sách chuyến đi", "Đang đi / sắp tới / đã qua.", "(main)/trips", prio="P0"),
            T("Tạo chuyến đi mới", "Điểm đến, ngày, số người, ngân sách.", "(main)/trips/new", prio="P0"),
            T("Chi tiết chuyến đi", "", "(main)/trips/[tripId]", prio="P0"),
            T("Sửa / xóa chuyến đi", "", "(main)/trips/[tripId]", prio="P1"),
        ]),
        ("Lịch trình theo ngày", [
            T("Xem lịch trình theo ngày", "", "(main)/trips/[tripId]", prio="P0"),
            T("Thêm địa điểm / hoạt động vào ngày", "", "(main)/trips/[tripId]", prio="P0"),
            T("Sửa, xóa, sắp xếp lại hoạt động", "Kéo thả.", "(main)/trips/[tripId]", prio="P1"),
            T("Ghi chú & giờ cho hoạt động", "", "(main)/trips/[tripId]", prio="P2"),
        ]),
        ("Cộng tác", [
            T("Mời thành viên", "Qua link / email.", "(main)/trips/[tripId]", prio="P1"),
            T("Tham gia chuyến đi qua lời mời", "Deep link /trips/join.", "(main)/trips/join", prio="P1"),
            T("Quản lý thành viên & quyền", "", "(main)/trips/[tripId]", prio="P2"),
            T("Chỉnh sửa đồng thời (realtime SSE)", "/api/trips/*/collaboration/events.", "(main)/trips/[tripId]", prio="P2"),
        ]),
        ("Ngân sách, lịch & chia sẻ", [
            T("Ngân sách & chi phí chuyến đi", "", "(main)/trips/[tripId]", prio="P1"),
            T("Lịch (Calendar)", "", "(main)/calendar", prio="P2"),
            T("Chia sẻ chuyến đi lên cộng đồng", "", "(main)/trips/[tripId]", prio="P2"),
            T("Xuất lịch trình", "", "(main)/trips/[tripId]", prio="P2"),
        ]),
    ]),
    ("Trợ lý AI (AI Planner)", "Phase 3", "D9E1F2", [
        ("Hội thoại AI", [
            T("Danh sách hội thoại AI", "", "(main)/ai-planner", prio="P0"),
            T("Màn chat AI (streaming)", "/api/ai/* giữ nguyên giao thức stream của web.", "(main)/ai-planner/[chatId]", prio="P0"),
            T("Gợi ý câu hỏi nhanh", "", "(main)/ai-planner", prio="P2"),
            T("Đổi tên / xóa hội thoại, tiêu đề tự động", "", "(main)/ai-planner", prio="P2"),
        ]),
        ("Lịch trình do AI tạo", [
            T("Thẻ địa điểm trong khung chat", "Rich card địa điểm / lịch trình.", "(main)/ai-planner/[chatId]", prio="P1"),
            T("Tạo lịch trình & lưu thành chuyến đi", "Commit itinerary vào trip.", "(main)/ai-planner/[chatId]", prio="P0"),
            T("Liên kết hội thoại với chuyến đi", "", "(main)/ai-planner/[chatId]", prio="P1"),
            T("Xem chi tiết lịch trình trong chat", "", "(main)/ai-planner/[chatId]", prio="P2"),
        ]),
    ]),
    ("Cộng đồng", "Phase 4", "E2EFDA", [
        ("Bảng tin", [
            T("Danh sách bài viết (feed)", "/api/social/posts, phân trang.", "(main)/community", prio="P0"),
            T("Lọc loại bài (tất cả / thường / chia sẻ trip)", "", "(main)/community", prio="P1"),
            T("Chi tiết bài viết", "", "(main)/community/posts/[postId]", prio="P0"),
        ]),
        ("Tạo & tương tác", [
            T("Tạo bài viết (kèm ảnh)", "Upload media qua BE (Cloudinary), Idempotency-Key.", "(main)/community", prio="P1"),
            T("Bình luận nhiều cấp", "", "(main)/community/posts/[postId]", prio="P1"),
            T("Thích & lưu bài viết", "", "(main)/community", prio="P1"),
            T("Bài viết đã lưu", "", "(main)/community/saved", prio="P2"),
        ]),
        ("Người dùng & khám phá", [
            T("Trang cá nhân người dùng / creator", "", "(main)/community/users/[userId]", prio="P1"),
            T("Theo dõi / bỏ theo dõi", "", "(main)/community/users/[userId]", prio="P2"),
            T("Điểm đến thịnh hành, creator nổi bật, thời tiết", "", "(main)/community", prio="P2"),
            T("Nhập chuyến đi từ bài chia sẻ", "", "(main)/trips", prio="P2"),
        ]),
    ]),
    ("Chat & Thông báo", "Phase 5", "FFF2CC", [
        ("Chat bạn bè", [
            T("Danh sách hội thoại", "", "(main)/chat", prio="P1"),
            T("Nhắn tin realtime (SSE)", "/api/social/chat/events; chỉ kết nối khi app ở foreground.", "(main)/chat", prio="P1"),
            T("Tìm người để bắt đầu chat", "", "(main)/chat", prio="P2"),
            T("Trạng thái đã đọc & badge chưa đọc", "", "(main)/chat", prio="P2"),
            T("Đề nghị đặt chỗ ngay trong chat", "In-chat reservation offer.", "(main)/chat", prio="P2"),
        ]),
        ("Thông báo", [
            T("Danh sách thông báo", "", "(main)/notifications", prio="P1"),
            T("Badge thông báo chưa đọc", "", "(main)/notifications", prio="P2"),
            T("Push notification (FCM)", "Ngoài phạm vi hiện tại: cần BE lưu device token.", "(main)/notifications", prio="P2", status=S_HOLD,
              issue="Cần thay đổi backend (lưu FCM device token) nên đã thỏa thuận không làm ở giai đoạn này.", istate=ISSUE_ACCEPT),
        ]),
    ]),
    ("Đặt chỗ & Dịch vụ", "Phase 7", "FCE4D6", [
        ("Khách sạn", [
            T("Danh sách & tìm kiếm khách sạn", "/api/public/hotels.", "(main)/hotels", prio="P1"),
            T("Chi tiết khách sạn & phòng trống", "", "(main)/hotels", prio="P1"),
            T("Đặt phòng", "", "(main)/hotels", prio="P1"),
            T("Thanh toán PayOS & deep link kết quả", "Trả về app qua deep link payment-result.", "(main)/hotels/payment-result/[bookingId]", prio="P2"),
            T("Lịch sử đặt phòng", "", "(main)/reservations", prio="P2"),
        ]),
        ("Nhà hàng", [
            T("Chi tiết nhà hàng & thực đơn", "", "(main)/restaurants/[businessId]", prio="P1"),
            T("Yêu cầu đặt bàn", "", "(main)/restaurants/[businessId]", prio="P1"),
        ]),
        ("Hướng dẫn viên (Guide)", [
            T("Danh sách & chi tiết guide", "", "(main)/guides/[guideId]", prio="P2"),
            T("Gửi & theo dõi guide inquiry", "", "(main)/guide-inquiries", prio="P2"),
        ]),
        ("Thuê đồ & Đặt chỗ tổng hợp", [
            T("Danh sách & đặt thuê đồ", "/api/rental-items, /api/rental-bookings.", "(main)/reservations", prio="P2"),
            T("Trung tâm đặt chỗ (Reservations hub)", "Gộp mọi yêu cầu / đặt chỗ của user.", "(main)/reservations", prio="P2"),
            T("Hỗ trợ (support cases)", "", "(main)/support", prio="P2"),
        ]),
    ]),
    ("Hồ sơ & Cài đặt", "Phase 6", "EAD1F5", [
        ("Hồ sơ cá nhân", [
            DONE("Hiển thị hồ sơ cơ bản", "Avatar, tên, email, nút đăng xuất (tab Hồ sơ).", "(main)/profile", prio="P1"),
            T("Trang hồ sơ đầy đủ", "Bio, ảnh bìa, bài viết, chuyến đi.", "(main)/profile", prio="P1"),
            T("Chỉnh sửa hồ sơ & đổi ảnh đại diện", "PUT /api/users/profile.", "(main)/profile", prio="P1"),
            T("Sở thích du lịch (travel preferences)", "", "(main)/settings", prio="P2"),
        ]),
        ("Cài đặt", [
            T("Chọn ngôn ngữ (vi / en)", "", "(main)/settings", prio="P1"),
            T("Chọn giao diện sáng / tối", "", "(main)/settings", prio="P2"),
            T("Đổi mật khẩu", "PUT /api/auth/password.", "(main)/settings", prio="P1"),
            T("Đăng xuất khỏi mọi thiết bị", "", "(main)/settings", prio="P2"),
            T("Trung tâm hỗ trợ & điều khoản", "", "(main)/support", prio="P2"),
        ]),
    ]),
    ("Chất lượng & Phát hành", "Xuyên suốt", "DDEBF7", [
        ("Kiểm thử trên thiết bị", [
            DONE("Chạy thử trên Android emulator", "Pixel_6: build debug, cài và chạy app thành công; chụp màn hình đối chiếu theme với web.", "-", prio="P0",
                 issue="(1) Chưa chấp nhận Android license. (2) Thiếu Android SDK Platform 35 nên Gradle fail. (3) Gradle daemon crash do hết RAM: máy 16 GB chỉ còn ~1,7 GB vì >10 JVM backend + extension Java của VS Code (~2,8 GB) + emulator + Gradle (-Xmx8G) chạy cùng lúc. (4) Emulator chỉ vẽ 1 khung hình rồi đứng (app tưởng như treo ở splash).", istate=ISSUE_FIXED,
                 fix="Chạy flutter doctor --android-licenses; cài platform 35 bằng sdkmanager; tắt bớt service backend không cần cho đăng nhập, giới hạn heap JVM (-Xmx320m) và dọn Gradle daemon rồi build lại; emulator chạy với -gpu swiftshader_indirect. Khuyến nghị: chỉ bật service cần thiết, đóng bớt Java extension của IDE."),
            T("Chạy thử trên thiết bị thật", "Dùng --dart-define với IP LAN của máy chạy backend.", "-", prio="P1"),
            T("Chạy trên Windows desktop", "Không hỗ trợ: thiếu Visual Studio và chưa có thư mục windows.", "-", prio="P2", status=S_HOLD,
              issue="Máy chưa cài Visual Studio và project chưa có thư mục windows.", istate=ISSUE_ACCEPT, fix="Chỉ test trên Android emulator."),
        ]),
        ("Tối ưu & phát hành", [
            T("Tối ưu hiệu năng (danh sách, ảnh, rebuild)", "Mục tiêu 60 fps; phân trang, debounce, hủy request.", "-", prio="P1",
              issue="Backend đang chậm (~200 ms nền, N+1 ở hotels/social, search lần đầu ~8 s) ảnh hưởng UX; nguyên nhân: mỗi truy vấn DB prod ở xa ~70 ms, thiếu cache.", istate=ISSUE_OPEN,
              fix="Mobile dùng phân trang, skeleton, debounce; tối ưu backend làm sau theo thỏa thuận."),
            T("Đổi applicationId, icon & splash native", "Hiện com.example.trip.", "-", prio="P1"),
            T("Build release (obfuscate) & ký app", "--obfuscate --split-debug-info.", "-", prio="P1"),
            T("Build iOS", "Cần máy Mac.", "-", prio="P2"),
        ]),
        ("Tài liệu & nghiệm thu", [
            DONE("Plan & README mobile", "docs/features/mobile-user-app.md (đã Approved), apps/mobile/tripsense/README.md.", "-", prio="P1"),
            T("Nghiệm thu từng phase với leader", "Phase 0-1 đã xong code, chờ nghiệm thu.", "-", prio="P0", status=S_DOING, prog=0.2),
        ]),
    ]),
]

# --------------------------------------------------------------------------
ISSUES = [
    ("ISS-01", D1, "10.1.1", "Lỗi build", "Chưa chấp nhận Android SDK license nên không build được (flutter doctor cảnh báo).", "Trung bình",
     "License SDK chưa được accept trên máy.", "Chạy flutter doctor --android-licenses.", ISSUE_FIXED, D1),
    ("ISS-02", D1, "10.1.1", "Lỗi build", "Gradle fail: Failed to install platforms;android-35.", "Cao",
     "Máy thiếu Android SDK Platform 35, Gradle không tự cài được.", "Cài bằng sdkmanager (platforms;android-35).", ISSUE_FIXED, D1),
    ("ISS-03", D1, "10.1.1", "Lỗi build / môi trường", "Gradle daemon bị crash giữa chừng (JVM hết bộ nhớ).", "Cao",
     "Máy 16 GB chỉ còn ~1,7 GB trống: >10 JVM backend + emulator + Gradle (-Xmx8G) chạy cùng lúc.",
     "Tắt tạm các service backend không cần cho đăng nhập, dọn Gradle daemon rồi build lại. Khuyến nghị: chỉ bật service cần thiết khi build.", ISSUE_FIXED, D1),
    ("ISS-04", D1, "0.1.5", "Lỗi build", "Kotlin compile lỗi 'this and base files have different roots'.", "Cao",
     "Project ở ổ D, pub cache ở ổ C nên cache biên dịch tăng dần của Kotlin bị hỏng.", "Thêm kotlin.incremental=false vào android/gradle.properties.", ISSUE_FIXED, D1),
    ("ISS-05", D1, "0.1.5", "Cấu hình", "Android chặn HTTP thường tới gateway local; bản release thiếu quyền INTERNET.", "Cao",
     "Android 9+ chặn cleartext; INTERNET chỉ khai báo ở manifest debug/profile.", "usesCleartextTraffic chỉ bật cho debug; thêm INTERNET vào manifest chính.", ISSUE_FIXED, D1),
    ("ISS-06", D1, "1.2.2", "Tích hợp", "Email xác minh đăng ký không gửi được lần đầu.", "Trung bình",
     "mail-service bị tắt (tôi tắt để giải phóng RAM), user-service chuyển sang fallback chỉ ghi log mã.",
     "Bật lại mail-service và gửi lại mã; log Resend báo gửi thành công. Cần xác nhận mail đã tới hộp thư.", ISSUE_FIXED, D1),
    ("ISS-07", D1, "1.1.1", "Lỗi giao diện", "Dòng 'Chưa có tài khoản? Tạo tài khoản' tràn ngang trên màn hình hẹp.", "Thấp",
     "Dùng Row không xuống dòng; widget test phát hiện RenderFlex overflow.", "Đổi Row sang Wrap.", ISSUE_FIXED, D1),
    ("ISS-08", D1, "0.1.4", "Rủi ro dữ liệu", "Backend local và app mobile dùng chung DB prod (Neon, Mongo Atlas, Upstash Redis, Qdrant): thao tác ghi sẽ vào dữ liệu thật.", "Cao",
     "Yêu cầu dùng DB prod; env/.env.shared trỏ prod.",
     "Hiện chỉ đọc + tài khoản cá nhân. Kiểm tra: khi khởi động không có migration nào chạy lên prod. Đề xuất DB dev riêng trước Phase 3.", ISSUE_ACCEPT, None),
    ("ISS-09", D1, "1.5.1", "Phụ thuộc", "Chưa thể làm đăng nhập Google trên mobile.", "Trung bình",
     "Chưa có OAuth client ID cho Android/iOS (chỉ có Web client ID).", "Cần tạo OAuth client Android (SHA-1) / iOS trong Google Cloud Console.", ISSUE_OPEN, None),
    ("ISS-10", D1, "10.1.3", "Môi trường", "Không chạy được app bằng Windows desktop.", "Thấp",
     "Thiếu Visual Studio và project chưa có thư mục windows.", "Chỉ test trên Android emulator.", ISSUE_ACCEPT, None),
    ("ISS-11", D1, "10.2.1", "Hiệu năng (backend)", "Backend phản hồi chậm: ~200 ms nền, N+1 ở public/hotels và social/posts, search lần đầu ~8 s.", "Trung bình",
     "Mỗi truy vấn DB prod ở xa ~70 ms, nhân với N+1 và thiếu cache.", "Mobile dùng phân trang, skeleton, debounce; tối ưu backend để sau theo thỏa thuận.", ISSUE_OPEN, None),
    ("ISS-12", D1, "1.1.1", "Kiểm thử", "Chưa kiểm chứng đăng nhập, giữ phiên sau khi tắt app và chặn admin bằng tài khoản thật trên emulator.", "Trung bình",
     "Tài khoản vừa đăng ký chưa xác minh email; chưa có tài khoản admin để thử.", "Xác minh email rồi thử đủ các bước; nhờ leader cấp tài khoản admin thử chặn role.", ISSUE_OPEN, None),
]

DAILY = [
    (D1, "Khảo sát & lập kế hoạch", "Đọc AGENTS.md và docs, khảo sát web (route, API, cách xác thực) và mobile hiện có; viết docs/features/mobile-user-app.md; tạo nhánh nhiby/mobile-user-app.",
     "Plan 8 phase được duyệt (dùng đề xuất mặc định).", "Toàn dự án",
     "Phát hiện refresh/logout của BE chỉ đọc cookie HttpOnly.", "Dùng cookie jar lưu mã hóa, không đổi backend.", "Dựng nền tảng (Phase 0)."),
    (D1, "Phase 0 - Nền tảng", "Dựng core: config, Dio + cookie jar + interceptor refresh single-flight, sanitizer lỗi, ApiResponse, i18n vi/en, theme, shell 5 tab, router guard.",
     "flutter analyze 0 lỗi; 23 test pass.", "0.1 - 0.5", "Không dùng codegen (freezed...) để giảm rủi ro phiên bản.", "Dùng class bất biến + Riverpod Notifier.", "Làm Phase 1 (Auth)."),
    (D1, "Phase 1 - Xác thực", "Làm đăng nhập, đăng ký, OTP, quên/đặt lại mật khẩu, splash khôi phục phiên, đăng xuất, chặn role không phải USER.",
     "Smoke test với gateway thật: refresh không cookie -> không phiên, login sai -> 401, endpoint public -> 200.", "1.1 - 1.4",
     "Test phát hiện dòng đăng nhập tràn ngang (ISS-07).", "Đổi sang Wrap.", "Chạy thử trên emulator."),
    (D1, "Chạy thử trên Android emulator", "Chấp nhận license, cài SDK 35, mở emulator Pixel_6, build và chạy app.",
     "App chạy được trên emulator; đăng ký tài khoản đi tới màn xác minh email.", "10.1.1",
     "ISS-02, ISS-03, ISS-04, ISS-05: thiếu SDK, hết RAM, lỗi Kotlin cache, chặn HTTP.", "Cài platform 35, tắt bớt service, kotlin.incremental=false, sửa manifest.", "Xác nhận nhận mail; thử đăng nhập thật."),
    (D1, "Giao diện giống web", "Port design tokens, typography Inter, theme sáng/tối từ globals.css của web sang mobile.",
     "Màn đăng nhập hiển thị đúng phong cách web (đen/trắng/xám, bo 10px).", "0.3",
     "ISS-06: mail xác minh chưa gửi được do mail-service bị tắt.", "Bật lại mail-service và gửi lại mã.", "Bắt đầu Phase 2 (Khám phá + Địa điểm)."),
    (date(2026, 11, 12), "Kế hoạch: Phase 2 - Khám phá & Địa điểm", "", "", "2.1 - 2.5", "", "", "Chọn dùng DB prod hay DB dev cho các phase có ghi dữ liệu (từ Phase 3)."),
]

VI_DOW = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]

HEADERS = [
    ("Mã", 8), ("Phase", 9), ("Nhóm tính năng", 22), ("Tính năng", 26), ("Chức năng chi tiết", 36),
    ("Mô tả / Phạm vi", 46), ("Trang web đối chiếu", 24), ("Ưu tiên", 9), ("Trạng thái", 16),
    ("Tiến độ", 10), ("Ngày bắt đầu", 13), ("Ngày kết thúc", 13), ("Hạn dự kiến", 13),
    ("Số ngày", 9), ("Nhánh Git", 24), ("Trạng thái code", 21), ("Link PR / Commit", 20),
    ("Issue / Vướng mắc", 44), ("Trạng thái issue", 17), ("Cách xử lý / Kết quả", 40),
    ("Người thực hiện", 14), ("Ghi chú", 36),
    ("Loại test", 20), ("Kết quả test", 38),
]
COL = {h: get_column_letter(i + 1) for i, (h, _) in enumerate(HEADERS)}
TRACK = "Theo dõi tính năng"
Q = f"'{TRACK}'!"


def rng(col_name):
    c = COL[col_name]
    return f"{Q}${c}$5:${c}${LAST_ROW}"


def style_header(ws, row, ncols, height=36):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = font(10, True, WHITE)
        cell.fill = fill(NAVY)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[row].height = height


def build():
    wb = Workbook()

    # ------------------------------------------------------------ tracking
    ws = wb.active
    ws.title = TRACK
    ws.sheet_properties.tabColor = "1F3864"
    ws["A1"] = "THEO DÕI TIẾN ĐỘ BUILD APP MOBILE TRIPSENSE - ROLE USER (Flutter)"
    ws["A1"].font = font(16, True, NAVY)
    ws["A2"] = ("Chỉ gồm chức năng dành cho người dùng (traveler). Admin / partner dùng web. "
                "Cập nhật các cột Trạng thái, Tiến độ, Ngày, Nhánh Git, Issue mỗi ngày; sheet 'Tổng quan' tự tính lại.")
    ws["A2"].font = font(10, False, "595959", italic=True)
    for i, (h, w) in enumerate(HEADERS, start=1):
        ws.cell(row=4, column=i, value=h)
        ws.column_dimensions[get_column_letter(i)].width = w
    style_header(ws, 4, len(HEADERS))

    r = 5
    mod_rows = {}
    for mi, (mname, phase, tint, features) in enumerate(MODULES, start=1):
        first = r
        for fi, (fname, tasks) in enumerate(features, start=1):
            for ti, t in enumerate(tasks, start=1):
                no_code = t["status"] in (S_TODO, S_HOLD, S_BLOCK) or t["name"].startswith("Nghiệm thu")
                code_state = CODE_NONE if no_code else CODE_LOCAL
                branch = "" if no_code else BRANCH
                row = [
                    f"{mi - 1}.{fi}.{ti}" if mname == "Nền tảng & Hạ tầng" else f"{mi - 1}.{fi}.{ti}",
                    phase, mname, fname, t["name"], t["desc"], t["web"], t["prio"], t["status"], t["prog"],
                    t["start"], t["end"], t["due"], None, branch, code_state, "", t["issue"],
                    t["istate"], t["fix"], OWNER if code_state != CODE_NONE else "", t["note"],
                ]
                for c, v in enumerate(row, start=1):
                    cell = ws.cell(row=r, column=c, value=v)
                    cell.font = font(10)
                    cell.border = BORDER
                    cell.alignment = Alignment(vertical="top", wrap_text=True)
                ws[f"{COL['Số ngày']}{r}"] = (
                    f'=IF(AND({COL["Ngày bắt đầu"]}{r}<>"",{COL["Ngày kết thúc"]}{r}<>""),'
                    f'{COL["Ngày kết thúc"]}{r}-{COL["Ngày bắt đầu"]}{r}+1,"")'
                )
                for name in ("Mã", "Phase", "Ưu tiên", "Tiến độ", "Ngày bắt đầu", "Ngày kết thúc",
                             "Hạn dự kiến", "Số ngày", "Trạng thái", "Trạng thái issue", "Trạng thái code"):
                    ws[f"{COL[name]}{r}"].alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
                for name in ("Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến"):
                    ws[f"{COL[name]}{r}"].number_format = "dd/mm/yyyy"
                ws[f"{COL['Tiến độ']}{r}"].number_format = "0%"
                for name in ("Mã", "Phase", "Nhóm tính năng", "Tính năng"):
                    ws[f"{COL[name]}{r}"].fill = fill(tint)
                ws[f"{COL['Nhóm tính năng']}{r}"].font = font(10, True)
                ws[f"{COL['Chức năng chi tiết']}{r}"].font = font(10, True)
                r += 1
        mod_rows[mname] = (first, r - 1)
    last_data = r - 1

    # empty styled rows so the user can append new items
    for rr in range(last_data + 1, last_data + 21):
        for c in range(1, len(HEADERS) + 1):
            cell = ws.cell(row=rr, column=c)
            cell.font = font(10)
            cell.border = BORDER
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        ws[f"{COL['Số ngày']}{rr}"] = (
            f'=IF(AND({COL["Ngày bắt đầu"]}{rr}<>"",{COL["Ngày kết thúc"]}{rr}<>""),'
            f'{COL["Ngày kết thúc"]}{rr}-{COL["Ngày bắt đầu"]}{rr}+1,"")'
        )
        for name in ("Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến"):
            ws[f"{COL[name]}{rr}"].number_format = "dd/mm/yyyy"
        ws[f"{COL['Tiến độ']}{rr}"].number_format = "0%"

    ws.freeze_panes = "F5"
    ws.auto_filter.ref = f"A4:{get_column_letter(len(HEADERS))}{last_data + 20}"
    ws.sheet_view.zoomScale = 90

    st, pr = COL["Trạng thái"], COL["Tiến độ"]
    # status colours (cell) + soft green row highlight for finished items
    for s in STATUSES:
        ws.conditional_formatting.add(
            f"{st}5:{st}{LAST_ROW}",
            CellIsRule(operator="equal", formula=[f'"{s}"'], fill=fill(STATUS_FILL[s]),
                       font=Font(name=FONT, bold=True, color=STATUS_FONT[s])),
        )
    ws.conditional_formatting.add(
        f"E5:{get_column_letter(len(HEADERS))}{LAST_ROW}",
        FormulaRule(formula=[f'${st}5="{S_DONE}"'], fill=fill("F1F9F3")),
    )
    ws.conditional_formatting.add(f"{pr}5:{pr}{LAST_ROW}",
                                  DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
    isu = COL["Trạng thái issue"]
    ws.conditional_formatting.add(f"{isu}5:{isu}{LAST_ROW}",
                                  CellIsRule(operator="equal", formula=[f'"{ISSUE_OPEN}"'], fill=fill("FFC7CE"), font=Font(name=FONT, bold=True, color="9C0006")))
    ws.conditional_formatting.add(f"{isu}5:{isu}{LAST_ROW}",
                                  CellIsRule(operator="equal", formula=[f'"{ISSUE_FIXED}"'], fill=fill("FFEB9C"), font=Font(name=FONT, bold=True, color="7F6000")))
    ws.conditional_formatting.add(f"{isu}5:{isu}{LAST_ROW}",
                                  CellIsRule(operator="equal", formula=[f'"{ISSUE_ACCEPT}"'], fill=fill("F8CBAD"), font=Font(name=FONT, bold=True, color="843C0C")))
    iss = COL["Issue / Vướng mắc"]
    ws.conditional_formatting.add(f"{iss}5:{iss}{LAST_ROW}",
                                  FormulaRule(formula=[f'AND(LEN({iss}5)>0,${isu}5="{ISSUE_OPEN}")'], font=Font(name=FONT, color="9C0006")))
    pc = COL["Ưu tiên"]
    ws.conditional_formatting.add(f"{pc}5:{pc}{LAST_ROW}", CellIsRule(operator="equal", formula=['"P0"'], font=Font(name=FONT, bold=True, color="C00000")))
    cs = COL["Trạng thái code"]
    ws.conditional_formatting.add(f"{cs}5:{cs}{LAST_ROW}", CellIsRule(operator="equal", formula=[f'"{CODE_PUSHED}"'], fill=fill("C6EFCE")))
    ws.conditional_formatting.add(f"{cs}5:{cs}{LAST_ROW}", CellIsRule(operator="equal", formula=[f'"{CODE_MERGED}"'], fill=fill("C6EFCE")))
    ws.conditional_formatting.add(f"{cs}5:{cs}{LAST_ROW}", CellIsRule(operator="equal", formula=[f'"{CODE_LOCAL}"'], fill=fill("FFEB9C")))
    ws.conditional_formatting.add(f"{cs}5:{cs}{LAST_ROW}", CellIsRule(operator="equal", formula=[f'"{CODE_COMMIT}"'], fill=fill("FFF2CC")))

    def dv(formula, col):
        v = DataValidation(type="list", formula1=formula, allow_blank=True, showErrorMessage=True)
        v.add(f"{COL[col]}5:{COL[col]}{LAST_ROW}")
        ws.add_data_validation(v)

    dv('"' + ",".join(STATUSES) + '"', "Trạng thái")
    dv('"P0,P1,P2"', "Ưu tiên")
    dv('"' + ",".join([ISSUE_OPEN, ISSUE_FIXED, ISSUE_ACCEPT]) + '"', "Trạng thái issue")
    dv('"' + ",".join([CODE_NONE, CODE_LOCAL, CODE_COMMIT, CODE_PUSHED, CODE_MERGED]) + '"', "Trạng thái code")
    vp = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", allow_blank=True,
                        showErrorMessage=True, errorTitle="Tiến độ", error="Nhập từ 0% đến 100%.")
    vp.add(f"{pr}5:{pr}{LAST_ROW}")
    ws.add_data_validation(vp)
    vd = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                        showErrorMessage=True, errorTitle="Ngày", error="Nhập ngày hợp lệ (dd/mm/yyyy).")
    for name in ("Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến"):
        vd.add(f"{COL[name]}5:{COL[name]}{LAST_ROW}")
    ws.add_data_validation(vd)

    # ------------------------------------------------------------ overview
    ov = wb.create_sheet("Tổng quan", 0)
    ov.sheet_properties.tabColor = "70AD47"
    ov.sheet_view.showGridLines = False
    widths = {"A": 3, "B": 30, "C": 11, "D": 13, "E": 14, "F": 14, "G": 13, "H": 11, "I": 11, "J": 14}
    for k, v in widths.items():
        ov.column_dimensions[k].width = v
    ov["B1"] = "TRIPSENSE MOBILE - BÁO CÁO TIẾN ĐỘ (ROLE USER)"
    ov["B1"].font = font(18, True, NAVY)
    info = [
        ("Dự án", "TripSense Mobile App (Flutter) - chỉ dành cho role User"),
        ("Nhánh làm việc", BRANCH),
        ("Người thực hiện", OWNER),
        ("Ngày bắt đầu", D1),
        ("Cập nhật lần cuối", date(2026, 11, 12)),
        ("Trạng thái code", "Chưa có commit nào được push - toàn bộ code đang ở máy local (chưa commit)."),
    ]
    for i, (k, v) in enumerate(info):
        rr = 3 + i
        ov[f"B{rr}"] = k
        ov[f"B{rr}"].font = font(10, True, "595959")
        ov[f"C{rr}"] = v
        ov[f"C{rr}"].font = font(10, k == "Trạng thái code", "C00000" if k == "Trạng thái code" else "000000")
        if isinstance(v, date):
            ov[f"C{rr}"].number_format = "dd/mm/yyyy"
            ov[f"C{rr}"].alignment = Alignment(horizontal="left")

    # KPI cards
    kp = [
        ("Tổng chức năng", f"=COUNTA({rng('Mã')})", "DDEBF7", NAVY),
        ("Hoàn thành", f'=COUNTIF({rng("Trạng thái")},"{S_DONE}")', "C6EFCE", "006100"),
        ("Đang kiểm thử", f'=COUNTIF({rng("Trạng thái")},"{S_TEST}")', "BDD7EE", "1F4E78"),
        ("Đang thực hiện", f'=COUNTIF({rng("Trạng thái")},"{S_DOING}")', "FFEB9C", "7F6000"),
        ("Chưa bắt đầu", f'=COUNTIF({rng("Trạng thái")},"{S_TODO}")', "EDEDED", "595959"),
        ("Bị chặn / Tạm hoãn", f'=COUNTIF({rng("Trạng thái")},"{S_BLOCK}")+COUNTIF({rng("Trạng thái")},"{S_HOLD}")', "FFC7CE", "9C0006"),
        ("Tiến độ tổng", f"=IFERROR(AVERAGE({rng('Tiến độ')}),0)", "E2EFDA", "375623"),
    ]
    start_col = 2
    for i, (label, formula, bg, fg) in enumerate(kp):
        col = get_column_letter(start_col + i)
        ov[f"{col}10"] = label
        ov[f"{col}10"].font = font(9, True, fg)
        ov[f"{col}10"].fill = fill(bg)
        ov[f"{col}10"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ov[f"{col}11"] = formula
        ov[f"{col}11"].font = font(20, True, fg)
        ov[f"{col}11"].fill = fill(bg)
        ov[f"{col}11"].alignment = Alignment(horizontal="center", vertical="center")
        for rr in (10, 11):
            ov[f"{col}{rr}"].border = BORDER
        if label == "Tiến độ tổng":
            ov[f"{col}11"].number_format = "0.0%"
    ov.row_dimensions[10].height = 28
    ov.row_dimensions[11].height = 38

    # per-module table
    ov["B13"] = "TIẾN ĐỘ THEO NHÓM TÍNH NĂNG"
    ov["B13"].font = font(12, True, NAVY)
    heads = ["Nhóm tính năng", "Phase", "Tổng", "Hoàn thành", "Đang kiểm thử", "Đang thực hiện", "Chưa bắt đầu", "Chặn / Hoãn", "% tiến độ"]
    for i, h in enumerate(heads):
        ov.cell(row=14, column=2 + i, value=h)
    style_header(ov, 14, 10, 30)
    ov.cell(row=14, column=1).fill = PatternFill()
    ov.cell(row=14, column=1).border = Border()
    mod_rng, status_rng, prog_rng = rng("Nhóm tính năng"), rng("Trạng thái"), rng("Tiến độ")
    first_mod_row = 15
    for i, (mname, phase, tint, _f) in enumerate(MODULES):
        rr = first_mod_row + i
        ov[f"B{rr}"] = mname
        ov[f"C{rr}"] = phase
        ov[f"D{rr}"] = f'=COUNTIF({mod_rng},$B{rr})'
        ov[f"E{rr}"] = f'=COUNTIFS({mod_rng},$B{rr},{status_rng},"{S_DONE}")'
        ov[f"F{rr}"] = f'=COUNTIFS({mod_rng},$B{rr},{status_rng},"{S_TEST}")'
        ov[f"G{rr}"] = f'=COUNTIFS({mod_rng},$B{rr},{status_rng},"{S_DOING}")'
        ov[f"H{rr}"] = f'=COUNTIFS({mod_rng},$B{rr},{status_rng},"{S_TODO}")'
        ov[f"I{rr}"] = f'=COUNTIFS({mod_rng},$B{rr},{status_rng},"{S_BLOCK}")+COUNTIFS({mod_rng},$B{rr},{status_rng},"{S_HOLD}")'
        ov[f"J{rr}"] = f'=IFERROR(AVERAGEIFS({prog_rng},{mod_rng},$B{rr}),0)'
        for c in "BCDEFGHIJ":
            cell = ov[f"{c}{rr}"]
            cell.font = font(10, c == "B")
            cell.border = BORDER
            cell.alignment = Alignment(horizontal="left" if c == "B" else "center", vertical="center")
        ov[f"B{rr}"].fill = fill(tint)
        ov[f"J{rr}"].number_format = "0%"
        ov.row_dimensions[rr].height = 22
    last_mod_row = first_mod_row + len(MODULES) - 1
    tr = last_mod_row + 1
    ov[f"B{tr}"] = "TỔNG CỘNG"
    for c in "DEFGHI":
        ov[f"{c}{tr}"] = f"=SUM({c}{first_mod_row}:{c}{last_mod_row})"
    ov[f"J{tr}"] = f"=IFERROR(AVERAGE({prog_rng}),0)"
    for c in "BCDEFGHIJ":
        cell = ov[f"{c}{tr}"]
        cell.font = font(10, True, WHITE)
        cell.fill = fill("44546A")
        cell.border = BORDER
        cell.alignment = Alignment(horizontal="left" if c == "B" else "center", vertical="center")
    ov[f"J{tr}"].number_format = "0%"
    ov.conditional_formatting.add(f"J{first_mod_row}:J{last_mod_row}",
                                  DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
    ov.conditional_formatting.add(f"E{first_mod_row}:E{last_mod_row}", CellIsRule(operator="greaterThan", formula=["0"], fill=fill("C6EFCE"), font=Font(name=FONT, bold=True, color="006100")))
    ov.conditional_formatting.add(f"F{first_mod_row}:F{last_mod_row}", CellIsRule(operator="greaterThan", formula=["0"], fill=fill("BDD7EE"), font=Font(name=FONT, bold=True, color="1F4E78")))
    ov.conditional_formatting.add(f"I{first_mod_row}:I{last_mod_row}", CellIsRule(operator="greaterThan", formula=["0"], fill=fill("FFC7CE"), font=Font(name=FONT, bold=True, color="9C0006")))

    # issue summary
    isr = tr + 2
    ov[f"B{isr}"] = "TỔNG HỢP ISSUE"
    ov[f"B{isr}"].font = font(12, True, NAVY)
    issue_sheet = "Issue & Rủi ro"
    items = [("Đang mở", ISSUE_OPEN, "FFC7CE", "9C0006"), ("Đã xử lý", ISSUE_FIXED, "FFEB9C", "7F6000"),
             ("Chấp nhận rủi ro", ISSUE_ACCEPT, "F8CBAD", "843C0C")]
    for i, (label, key, bg, fg) in enumerate(items):
        col = get_column_letter(2 + i)
        ov[f"{col}{isr + 1}"] = label
        ov[f"{col}{isr + 2}"] = f"=COUNTIF('{issue_sheet}'!$I$5:$I$200,\"{key}\")"
        ov[f"{col}{isr + 1}"].font = font(9, True, fg)
        ov[f"{col}{isr + 2}"].font = font(18, True, fg)
        for rr in (isr + 1, isr + 2):
            ov[f"{col}{rr}"].fill = fill(bg)
            ov[f"{col}{rr}"].border = BORDER
            ov[f"{col}{rr}"].alignment = Alignment(horizontal="center", vertical="center")
    ov.row_dimensions[isr + 2].height = 32

    # chart
    ch = BarChart()
    ch.type = "bar"
    ch.title = "% tiến độ theo nhóm tính năng"
    ch.style = 10
    ch.y_axis.scaling.min = 0
    ch.y_axis.scaling.max = 1
    ch.y_axis.number_format = "0%"
    ch.legend = None
    ch.add_data(Reference(ov, min_col=10, min_row=14, max_row=last_mod_row), titles_from_data=True)
    ch.set_categories(Reference(ov, min_col=2, min_row=first_mod_row, max_row=last_mod_row))
    ch.dataLabels = DataLabelList()
    ch.dataLabels.showVal = True
    ch.height, ch.width = 9.5, 17
    ov.add_chart(ch, f"B{isr + 5}")

    # ------------------------------------------------------------ daily log
    dl = wb.create_sheet("Nhật ký hằng ngày")
    dl.sheet_properties.tabColor = "ED7D31"
    dl["A1"] = "NHẬT KÝ CÔNG VIỆC HẰNG NGÀY"
    dl["A1"].font = font(16, True, NAVY)
    dl["A2"] = "Mỗi ngày thêm 1-n dòng: làm được gì, kết quả, gặp issue gì, xử lý ra sao, mai làm gì. Cột 'Mã tính năng' trỏ về sheet 'Theo dõi tính năng'."
    dl["A2"].font = font(10, False, "595959", italic=True)
    dh = [("Ngày", 13), ("Thứ", 11), ("Hạng mục", 28), ("Việc đã làm", 60), ("Kết quả / Output", 42),
          ("Mã tính năng", 14), ("Issue gặp phải", 44), ("Cách xử lý", 40), ("Kế hoạch tiếp theo", 36)]
    for i, (h, w) in enumerate(dh, start=1):
        dl.cell(row=4, column=i, value=h)
        dl.column_dimensions[get_column_letter(i)].width = w
    style_header(dl, 4, len(dh))
    for i, (d, topic, did, result, codes, iss_, fix_, nxt) in enumerate(DAILY):
        rr = 5 + i
        vals = [d, VI_DOW[d.weekday()], topic, did, result, codes, iss_, fix_, nxt]
        for c, v in enumerate(vals, start=1):
            cell = dl.cell(row=rr, column=c, value=v)
            cell.font = font(10, c == 3)
            cell.border = BORDER
            cell.alignment = Alignment(vertical="top", wrap_text=True, horizontal="center" if c in (1, 2, 6) else "left")
        dl.cell(row=rr, column=1).number_format = "dd/mm/yyyy"
        if iss_:
            dl.cell(row=rr, column=7).fill = fill("FFF2CC")
        if d == D1:
            dl.cell(row=rr, column=1).fill = fill("E2EFDA")
        else:
            for c in range(1, len(dh) + 1):
                dl.cell(row=rr, column=c).fill = fill("F2F2F2")
    for rr in range(5 + len(DAILY), 5 + len(DAILY) + 40):
        for c in range(1, len(dh) + 1):
            cell = dl.cell(row=rr, column=c)
            cell.border = BORDER
            cell.font = font(10)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        dl.cell(row=rr, column=1).number_format = "dd/mm/yyyy"
    dl.freeze_panes = "A5"
    dl.auto_filter.ref = f"A4:{get_column_letter(len(dh))}{4 + len(DAILY) + 40}"

    # ------------------------------------------------------------ issues
    isw = wb.create_sheet(issue_sheet)
    isw.sheet_properties.tabColor = "C00000"
    isw["A1"] = "ISSUE & RỦI RO"
    isw["A1"].font = font(16, True, NAVY)
    isw["A2"] = "Ghi mọi lỗi / vướng mắc / rủi ro gặp phải. Mã tính năng trỏ về sheet 'Theo dõi tính năng'."
    isw["A2"].font = font(10, False, "595959", italic=True)
    ih = [("Mã issue", 10), ("Ngày phát hiện", 14), ("Mã tính năng", 13), ("Loại", 20), ("Mô tả", 52), ("Mức độ", 11),
          ("Nguyên nhân gốc", 46), ("Cách xử lý", 52), ("Trạng thái", 17), ("Ngày xử lý xong", 15), ("Người xử lý", 13)]
    for i, (h, w) in enumerate(ih, start=1):
        isw.cell(row=4, column=i, value=h)
        isw.column_dimensions[get_column_letter(i)].width = w
    style_header(isw, 4, len(ih))
    for i, it in enumerate(ISSUES):
        rr = 5 + i
        vals = list(it) + [OWNER]
        # reorder: id, date, code, type, desc, severity, cause, fix, status, resolved, owner
        for c, v in enumerate(vals, start=1):
            cell = isw.cell(row=rr, column=c, value=v)
            cell.font = font(10, c == 1)
            cell.border = BORDER
            cell.alignment = Alignment(vertical="top", wrap_text=True,
                                       horizontal="center" if c in (1, 2, 3, 6, 9, 10, 11) else "left")
        isw.cell(row=rr, column=2).number_format = "dd/mm/yyyy"
        isw.cell(row=rr, column=10).number_format = "dd/mm/yyyy"
    for rr in range(5 + len(ISSUES), 5 + len(ISSUES) + 40):
        for c in range(1, len(ih) + 1):
            cell = isw.cell(row=rr, column=c)
            cell.border = BORDER
            cell.font = font(10)
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        isw.cell(row=rr, column=2).number_format = "dd/mm/yyyy"
        isw.cell(row=rr, column=10).number_format = "dd/mm/yyyy"
    for key, bg, fg in ((ISSUE_OPEN, "FFC7CE", "9C0006"), (ISSUE_FIXED, "C6EFCE", "006100"), (ISSUE_ACCEPT, "F8CBAD", "843C0C")):
        isw.conditional_formatting.add("I5:I200", CellIsRule(operator="equal", formula=[f'"{key}"'], fill=fill(bg), font=Font(name=FONT, bold=True, color=fg)))
    for key, bg, fg in (("Cao", "FFC7CE", "9C0006"), ("Trung bình", "FFEB9C", "7F6000"), ("Thấp", "E2EFDA", "375623")):
        isw.conditional_formatting.add("F5:F200", CellIsRule(operator="equal", formula=[f'"{key}"'], fill=fill(bg), font=Font(name=FONT, bold=True, color=fg)))
    v1 = DataValidation(type="list", formula1=f'"{ISSUE_OPEN},{ISSUE_FIXED},{ISSUE_ACCEPT}"', allow_blank=True)
    v1.add("I5:I200")
    v2 = DataValidation(type="list", formula1='"Cao,Trung bình,Thấp"', allow_blank=True)
    v2.add("F5:F200")
    isw.add_data_validation(v1)
    isw.add_data_validation(v2)
    isw.freeze_panes = "A5"
    isw.auto_filter.ref = f"A4:K{4 + len(ISSUES) + 40}"

    # ------------------------------------------------------------ guide
    gd = wb.create_sheet("Hướng dẫn")
    gd.sheet_properties.tabColor = "7F7F7F"
    gd.column_dimensions["A"].width = 3
    gd.column_dimensions["B"].width = 24
    gd.column_dimensions["C"].width = 90
    gd["B1"] = "HƯỚNG DẪN SỬ DỤNG & CHÚ THÍCH"
    gd["B1"].font = font(16, True, NAVY)
    rows = [("TRẠNG THÁI", None, None)]
    desc = {
        S_TODO: "Chưa bắt đầu làm.",
        S_DOING: "Đang code.",
        S_TEST: "Code xong, đang kiểm thử / chờ xác nhận chạy đúng trên emulator hoặc thiết bị.",
        S_DONE: "Đã xong và đã kiểm chứng; dòng được tô xanh nhạt.",
        S_BLOCK: "Không làm tiếp được do phụ thuộc bên ngoài (ghi rõ ở cột Issue).",
        S_HOLD: "Tạm hoãn / ngoài phạm vi hiện tại theo thỏa thuận.",
    }
    for s in STATUSES:
        rows.append((s, desc[s], s))
    rows += [("", "", None), ("CÁCH CẬP NHẬT", None, None),
             ("Hằng ngày", "Cập nhật Trạng thái, Tiến độ, Ngày bắt đầu / kết thúc ở sheet 'Theo dõi tính năng'; ghi 'Nhật ký hằng ngày'.", None),
             ("Nhánh & code", "Cột 'Nhánh Git' ghi tên nhánh; cột 'Trạng thái code' đổi: Chưa commit -> Đã commit (chưa push) -> Đã push -> Đã merge; dán link vào 'Link PR / Commit'.", None),
             ("Issue", "Ghi mô tả ở cột 'Issue / Vướng mắc', chọn 'Trạng thái issue' (Đang mở / Đã xử lý / Chấp nhận rủi ro) và ghi chi tiết ở sheet 'Issue & Rủi ro'.", None),
             ("Thêm chức năng", "Điền vào các dòng trống ngay dưới bảng (đã có sẵn định dạng, menu chọn và công thức).", None),
             ("Ưu tiên", "P0 = bắt buộc cho bản nghiệm thu đầu; P1 = quan trọng; P2 = nên có / làm sau.", None),
             ("Mã", "Dạng <nhóm>.<tính năng>.<chức năng>, ví dụ 1.2.2 = Xác thực > Đăng ký & xác minh > Nhập mã OTP.", None),
             ("Sheet 'Tổng quan'", "Tự tính từ sheet 'Theo dõi tính năng' bằng công thức. Nếu mở bằng Protected View, bấm 'Enable Editing' để số liệu hiển thị.", None),
             ("Phạm vi", "Chỉ app mobile cho role User. Admin, partner, moderator dùng web nên không nằm trong danh sách.", None),
             ("Nguồn", "Phân rã từ docs/features/mobile-user-app.md và các route (main)/(auth) của apps/web/tripsense.", None)]
    rr = 3
    for k, v, st_ in rows:
        gd[f"B{rr}"] = k
        if v is None and k:
            gd[f"B{rr}"].font = font(11, True, NAVY)
        elif k:
            gd[f"B{rr}"].font = font(10, True)
            gd[f"C{rr}"] = v
            gd[f"C{rr}"].font = font(10)
            gd[f"C{rr}"].alignment = Alignment(wrap_text=True, vertical="top")
        if st_:
            gd[f"B{rr}"].fill = fill(STATUS_FILL[st_])
            gd[f"B{rr}"].font = font(10, True, STATUS_FONT[st_])
            gd[f"B{rr}"].alignment = Alignment(horizontal="center")
        rr += 1

    wb.calculation.fullCalcOnLoad = True
    wb.save(OUT)
    n = sum(len(t) for _, _, _, fs in MODULES for _, t in fs)
    print("saved", OUT, "tasks:", n, "last data row:", last_data)
    return n


if __name__ == "__main__":
    build()
