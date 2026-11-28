"""Single-sheet tracker: everything (summary, module banners, features, issues) in one sheet."""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_tracker import (  # noqa: E402
    BORDER, BRANCH, D3, CODE_COMMIT, CODE_LOCAL, CODE_MERGED, CODE_NONE, CODE_PUSHED, COL, D1, FONT,
    HEADERS, ISSUE_ACCEPT, ISSUE_FIXED, ISSUE_OPEN, MODULES, NAVY, OWNER, S_BLOCK, S_DOING, S_DONE,
    S_HOLD, S_TEST, S_TODO, STATUS_FILL, STATUS_FONT, STATUSES, WHITE, fill, font,
)
from openpyxl import Workbook  # noqa: E402
from openpyxl.comments import Comment  # noqa: E402
from openpyxl.formatting.rule import CellIsRule, DataBarRule, FormulaRule  # noqa: E402
from openpyxl.styles import Alignment, Font  # noqa: E402
from openpyxl.utils import get_column_letter  # noqa: E402
from openpyxl.worksheet.datavalidation import DataValidation  # noqa: E402

OUT = r"D:\capstone\tripsense-platform\docs\reports\mobile-user-app-tracking-v2.xlsx"
FIRST = 6          # first data/banner row
LAST = 300         # formulas / validation / formatting cover rows up to here
NCOL = len(HEADERS)
BANNER = ["2F5597", "548235", "BF8F00", "C55A11", "7030A0", "2E75B6", "548235", "BF8F00", "C55A11", "7030A0", "44546A"]

CODE_STATES = [CODE_NONE, CODE_LOCAL, CODE_COMMIT, CODE_PUSHED, CODE_MERGED]
ISSUE_STATES = [ISSUE_OPEN, ISSUE_FIXED, ISSUE_ACCEPT]
PRIOS = ["P0", "P1", "P2"]
LIST_COLS = {"status": "Z", "prio": "AA", "issue": "AB", "code": "AC"}
FEATURE_BRANCH = "nhiby/feature/mobile-foundation-and-auth"
ONB_BRANCH = "nhiby/feature/mobile-onboarding"
ONB_COMMIT = "a27e894"
EXPLORE_BRANCH = "nhiby/feature/mobile-explore-places"
EXPLORE_COMMIT = "55ae057 (PR #103)"
SAVE_BRANCH = "nhiby/feature/mobile-save-collections"
UI_BRANCH = "nhiby/feature/mobile-ui-polish"
UI_COMMIT = "01b1f4f, 3645127"
COMMIT = "60919f6, 2974c23, 2a7d1c9 (code/test); 86e0b2c (docs)"
# Automated tests per task (name -> (type, result)); everything else done/under test has none yet.
TESTS = {
    'Lưu / bỏ lưu địa điểm': ('Unit + Widget', 'collections_controller_test (batch trạng thái) + collections_screens_test: tim, sheet lưu (pass)'),
    'Thêm vào bộ sưu tập': ('Unit + Widget', 'collections_controller_test (chỉ gọi phần chênh lệch, lỗi ném lại) + collections_screens_test: lưu, bỏ lưu, tạo trong sheet, lỗi giữ sheet (pass)'),
    'Danh sách bộ sưu tập': ('Unit + Widget', 'collections_repository_impl_test + collections_screens_test: danh sách, rỗng (pass)'),
    'Tạo / sửa / xóa bộ sưu tập': ('Unit + Widget', 'collections_controller_test + collections_screens_test: tạo, đổi tên, xóa, lỗi (pass)'),
    'Chi tiết bộ sưu tập': ('Widget', 'collections_screens_test: mở bộ sưu tập thấy địa điểm (pass)'),
    'Thêm / xóa địa điểm trong bộ sưu tập': ('Unit + Widget', 'collections_repository_impl_test: PUT/DELETE + path mã hóa; collections_screens_test (pass)'),
    'Danh sách địa điểm đã lưu': ('Unit + Widget', 'collections_controller_test: phân trang loadMore + collections_screens_test: rỗng, lỗi, mở địa điểm (pass)'),
    'Lọc & tìm trong đã lưu': ('Widget', 'collections_screens_test: chip lọc theo bộ sưu tập (pass)'),
    'Header & ô tìm kiếm': ('Widget', 'explore_screen_test.dart: tìm, xoá, chọn điểm đến (pass)'),
    'Gợi ý cho bạn (explore-for-you)': ('Unit + Widget', 'explore_controller_test (fallback khi lỗi/rỗng) + explore_screen_test (pass)'),
    'Tìm kiếm địa điểm': ('Unit + Widget', 'places_repository_impl_test + explore_controller_test (request cũ bị bỏ) + explore_screen_test (pass)'),
    'Gợi ý khi gõ (autocomplete)': ('Unit', 'explore_controller_test: debounce 300 ms, tối thiểu 2 ký tự (pass)'),
    'Lọc theo danh mục / điểm đến': ('Unit + Widget', 'explore_controller_test + explore_screen_test: chip danh mục, đổi điểm đến (pass)'),
    'Thông tin cơ bản': ('Unit + Widget', 'places_domain_test (parse, lọc ảnh) + explore_screen_test mở chi tiết, API lỗi vẫn hiển thị (pass)'),
    'Giờ mở cửa & liên hệ': ('Unit + Widget', 'places_domain_test: parse giờ, hôm nay + explore_screen_test chi tiết (pass)'),
    'Xem đánh giá cộng đồng': ('Unit', 'places_domain_test: parse reviews (pass)'),
    "Cấu trúc thư mục feature-first": ("Không áp dụng", "Cấu trúc thư mục, không có logic"),
    "Dependencies nền tảng": ("Không áp dụng", "Cấu hình; flutter pub get thành công"),
    "Lint nghiêm ngặt (analysis_options)": ("Phân tích tĩnh", "flutter analyze: 0 issue"),
    "Cấu hình môi trường API Gateway": ("Unit", "app_config: base URL mặc định (smoke test thủ công với gateway thật)"),
    "Cấu hình Android (quyền mạng, HTTP debug, Kotlin)": ("Thủ công", "Build + chạy trên emulator Pixel_6 thành công"),
    "HTTP client (Dio) qua API Gateway": ("Unit", "auth_interceptor_test (5) + auth_repository_impl_test (10) pass"),
    "Lưu refresh cookie mã hóa": ("Unit", "secure_cookie_storage_test.dart (2 test pass)"),
    "Interceptor tự refresh token (single-flight)": ("Unit", "auth_interceptor_test.dart: retry, single-flight, hết hạn, bỏ qua auth path, logout race (5 pass)"),
    "Access token chỉ lưu trên RAM": ("Unit", "auth_interceptor_test.dart: refresh sau logout bị bỏ (pass)"),
    "Envelope ApiResponse & parse JSON an toàn": ("Unit", "api_response_test.dart (3 test pass)"),
    "Chuẩn hóa lỗi (AppFailure + sanitizer)": ("Unit", "error_handling_test (6) + ui_test failureMessage (4) pass"),
    "Design tokens (màu, bo góc, bóng)": ("Unit", "app_theme_test.dart: màu/bo góc khớp globals.css của web (4 test pass)"),
    "Typography (font Inter, vai trò chữ)": ("Thủ công", "Đối chiếu bằng ảnh chụp emulator với web; chưa có golden test"),
    "Theme sáng / tối": ("Unit", "app_theme_test.dart: light + dark qua ThemeExtension (pass)"),
    "Widget trạng thái dùng chung": ("Widget", "ui_test.dart: Loading/Empty/Error + nút thử lại, không lộ lỗi thô (4 pass)"),
    "Bottom navigation 5 tab (shell)": ("Widget", "shell_and_profile_test.dart: 5 tab, chuyển tab, Coming soon (4 pass)"),
    "Router + auth guard": ("Unit + Widget", "app_router_test (3) + shell_and_profile_test (4) pass"),
    "Hạ tầng gen-l10n + ARB vi/en": ("Unit", "l10n_parity_test.dart: vi/en cùng khóa, cùng placeholder (3 pass)"),
    "Unit test nền tảng": ("Unit", "72 test pass tổng (flutter test)"),
    "Widget test màn đăng nhập": ("Widget", "login_screen_test.dart (2 test pass)"),
    "Smoke test với gateway thật": ("Integration (thủ công)", "Chạy 1 lần với gateway local: refresh/login sai/public OK (file test tạm đã xóa)"),
    "Đăng nhập email / mật khẩu": ("Unit + Widget", "session_controller_test (7) + login_screen_test (2) + auth_repository_impl_test login (4) pass"),
    "Kiểm tra dữ liệu nhập (email / mật khẩu)": ("Widget", "login_screen_test.dart: validate rỗng / sai định dạng (pass)"),
    "Thông báo lỗi đăng nhập thân thiện": ("Widget", "login_screen_test.dart: sai mật khẩu (pass)"),
    "Đăng ký tài khoản": ("Widget + Unit", "auth_screens_test RegisterScreen (3) + repository conflict (pass)"),
    "Nhập mã OTP xác minh email": ("Widget", "auth_screens_test VerifyEmailScreen: validate, xác minh, về login (2 pass)"),
    "Gửi lại mã xác minh": ("Widget", "auth_screens_test: resend + thông báo (1 pass)"),
    "Màn quên mật khẩu": ("Widget", "auth_screens_test ForgotPasswordScreen (2 pass)"),
    "Màn đặt lại mật khẩu bằng OTP": ("Widget", "auth_screens_test ResetPasswordScreen (2 pass)"),
    "Splash & khôi phục phiên": ("Unit + Widget + Thủ công", "session_controller_test (8) + shell_and_profile_test + đã chạy thật trên emulator (pass)"),
    "Tự refresh token khi hết hạn": ("Unit + Thủ công", "auth_interceptor_test (6) pass + refresh cookie chạy thật qua gateway khi khôi phục phiên"),
    "Đăng xuất": ("Unit + Widget", "session_controller_test + shell_and_profile_test logout (pass)"),
    "Chặn tài khoản không phải USER": ("Unit", "session_controller_test (admin bị chặn) + app_user_test (pass)"),
    "Hiển thị hồ sơ cơ bản": ("Widget", "shell_and_profile_test.dart: tên, email, đăng xuất (pass)"),
    "Chạy thử trên Android emulator": ("Thủ công", "Pixel_6: build debug, cài, chạy, chụp màn hình"),
    "Plan & README mobile": ("Không áp dụng", "Tài liệu"),
    "Theme pill: nút, ô nhập, chip bo tròn hết cỡ": ("Unit + Thủ công", "app_theme_test (token) + chụp màn hình emulator đối chiếu web"),
    "Logo, hero gradient cam, khung báo lỗi bo tròn": ("Widget + Thủ công", "Hiển thị trong login/onboarding test; chụp màn hình emulator"),
    "Màn Đăng nhập / Đăng ký theo phong cách web": ("Widget + Thủ công", "login_screen_test + auth_screens_test (pass); chụp màn hình emulator"),
    "Onboarding theo phong cách web": ("Widget + Thủ công", "onboarding_screen_test (10 pass) + chụp màn hình emulator"),
    "Khung chính: 5 tab như web + header logo + menu avatar": ("Widget + Thủ công", "shell_and_profile_test (6): 5 tab, header, menu avatar, đăng xuất (pass)"),
    "Bundle font Inter để chạy offline": ("Unit + Thủ công", "app_theme_test: có đủ 4 file font + mọi text role dùng Inter (pass); đã thử chế độ máy bay"),
    "Chặn người dùng mới tới khi hoàn tất onboarding": ("Unit + Widget + Thủ công", "app_router_test: 3 test cổng onboarding; đã chạy thật trên emulator"),
    "Bước: tên hiển thị": ("Widget", "onboarding_screen_test: bắt buộc nhập tên (pass)"),
    "Bước: nhóm đi (một mình / cặp đôi / bạn bè / gia đình)": ("Unit + Widget", "onboarding_domain_test + onboarding_screen_test (pass)"),
    "Bước: mức ngân sách": ("Unit + Widget", "onboarding_domain_test: tier + ngân sách; onboarding_screen_test (pass)"),
    "Bước: lưu trú, ẩm thực, hoạt động yêu thích": ("Unit", "onboarding_controller_test: chọn nhiều, thêm/xóa lựa chọn tùy ý (pass)"),
    "Bước: thành phố xuất phát & điểm đến": ("Unit + Widget", "onboarding_domain_test (slug, giới hạn 20) + onboarding_screen_test (pass)"),
    "Bước: ngân sách mỗi ngày": ("Unit + Widget", "onboarding_domain_test (VND format, 1..1e9) + onboarding_screen_test + test căn lề (pass)"),
    "Bước: mô tả tự do + tag nhanh": ("Unit", "onboarding_controller_test: tag nhanh, giới hạn 2000 ký tự (pass)"),
    "Lưu & hoàn tất onboarding": ("Unit + Widget + Integration (giả)", "onboarding_repository_impl_test (7) + onboarding_controller_test (9 luồng lưu/xung đột/lỗi mạng) + onboarding_screen_test (pass)"),
}


def R(col_name):
    c = COL[col_name]
    return f"${c}${FIRST}:${c}${LAST}"


def build():
    wb = Workbook()
    ws = wb.active
    ws.title = "Theo dõi tiến độ"
    ws.sheet_properties.tabColor = "1F3864"
    ws.sheet_view.zoomScale = 90

    for i, (h, w) in enumerate(HEADERS, start=1):
        ws.cell(row=5, column=i, value=h)
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in range(1, NCOL + 1):
        cell = ws.cell(row=5, column=c)
        cell.font = font(10, True, WHITE)
        cell.fill = fill(NAVY)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[5].height = 36

    # ---- title + summary (all formulas) ---------------------------------
    ws["A1"] = "THEO DÕI TIẾN ĐỘ BUILD APP MOBILE TRIPSENSE - ROLE USER (Flutter)"
    ws["A1"].font = font(16, True, NAVY)
    ws.row_dimensions[1].height = 28
    st, pr, ist = R("Trạng thái"), R("Tiến độ"), R("Trạng thái issue")
    task = R("Chức năng chi tiết")
    cnt = lambda s: f'COUNTIF({st},"{s}")'  # noqa: E731
    ws["A2"] = (f'="Tổng: "&COUNTA({task})&" chức năng   |   Hoàn thành: "&{cnt(S_DONE)}'
                f'&"   |   Đang kiểm thử: "&{cnt(S_TEST)}&"   |   Đang thực hiện: "&{cnt(S_DOING)}'
                f'&"   |   Chưa bắt đầu: "&{cnt(S_TODO)}&"   |   Bị chặn / Tạm hoãn: "&({cnt(S_BLOCK)}+{cnt(S_HOLD)})')
    ws["A3"] = (f'="Tiến độ tổng: "&ROUND(IFERROR(SUM({pr})/COUNTA({task}),0)*100,1)&"%"'
                f'&"   |   Issue đang mở: "&COUNTIF({ist},"{ISSUE_OPEN}")&"   |   Đã xử lý: "&COUNTIF({ist},"{ISSUE_FIXED}")'
                f'&"   |   Chấp nhận rủi ro: "&COUNTIF({ist},"{ISSUE_ACCEPT}")')
    ws["A4"] = (f"Dự án: TripSense Mobile (chỉ role User, admin/partner dùng web)   |   Nhánh hiện tại: {SAVE_BRANCH}   |   Người thực hiện: {OWNER}   |   "
                "Cập nhật: 13/11/2026 (Khám phá đã push PR #103; Lưu/Bộ sưu tập: code + test xong, chưa commit)   |   Quy ước nhánh: nhiby/feature/<tên-tính-năng>   |   Test tự động hiện có: 203 test pass   |   "
                "LƯU Ý: code đã commit local, CHƯA push lên GitHub.")
    for row, bg, fg, size in ((2, "DDEBF7", NAVY, 11), (3, "E2EFDA", "375623", 11), (4, "FFF2CC", "7F3F00", 9)):
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=9)
        c = ws.cell(row=row, column=1)
        c.font = font(size, True, fg)
        c.fill = fill(bg)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.row_dimensions[row].height = 22 if row < 4 else 26

    # ---- module banners + task rows --------------------------------------
    r = FIRST
    for mi, (mname, phase, tint, features) in enumerate(MODULES, start=1):
        # banner row
        bcol = BANNER[(mi - 1) % len(BANNER)]
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
        ws.cell(row=r, column=1, value=f"▌ NHÓM {mi - 1}: {mname.upper()}   ·   {phase}")
        mod_c, st_c = f"${COL['Nhóm tính năng']}${FIRST}:${COL['Nhóm tính năng']}${LAST}", st
        ws[f"{COL['Trạng thái']}{r}"] = f'=IFERROR(SUMIFS({pr},{mod_c},"{mname}")/COUNTIF({mod_c},"{mname}"),0)'
        ws.merge_cells(start_row=r, start_column=11, end_row=r, end_column=14)
        ws.cell(row=r, column=11,
                value=f'=COUNTIFS({mod_c},"{mname}",{st_c},"{S_DONE}")&" / "&COUNTIF({mod_c},"{mname}")&" hoàn thành"')
        for c in range(1, NCOL + 1):
            cell = ws.cell(row=r, column=c)
            cell.fill = fill(bcol)
            cell.font = font(11, True, WHITE)
            cell.alignment = Alignment(vertical="center", horizontal="left" if c in (1, 11) else "center")
        ws[f"{COL['Trạng thái']}{r}"].number_format = "0%"
        ws.row_dimensions[r].height = 24
        r += 1

        for fi, (fname, tasks) in enumerate(features, start=1):
            for ti, t in enumerate(tasks, start=1):
                no_code = t["status"] in (S_TODO, S_HOLD, S_BLOCK) or t["name"].startswith("Nghiệm thu")
                is_explore = mname.startswith("Khám phá")
                is_save = mname.startswith("Bộ sưu tập") or fname.startswith("Hành động trên địa điểm")
                code_state = CODE_NONE if no_code else (
                    CODE_LOCAL if is_save else CODE_PUSHED if is_explore else CODE_COMMIT)
                if t["name"] in TESTS:
                    ttype, tres = TESTS[t["name"]]
                elif no_code:
                    ttype, tres = ("Kế hoạch: Unit + Widget" if t["prio"] in ("P0", "P1") else "Kế hoạch: Unit"), ""
                else:
                    ttype, tres = "Chưa có", "Cần bổ sung test"
                row = [
                    f"{mi - 1}.{fi}.{ti}", phase, mname, fname, t["name"], t["desc"], t["web"], t["prio"],
                    t["status"], t["prog"], t["start"], t["end"], t["due"], None,
                    "" if no_code else (SAVE_BRANCH if is_save else EXPLORE_BRANCH if is_explore else UI_BRANCH if fname.startswith("Giao diện giống web") else ONB_BRANCH if fname.startswith("Onboarding") else FEATURE_BRANCH), code_state, "" if no_code else ("(chưa commit)" if is_save else EXPLORE_COMMIT if is_explore else UI_COMMIT if fname.startswith("Giao diện giống web") else ONB_COMMIT if fname.startswith("Onboarding") else COMMIT), t["issue"], t["istate"], t["fix"],
                    "" if no_code else OWNER, t["note"], ttype, tres,
                ]
                for c, v in enumerate(row, start=1):
                    cell = ws.cell(row=r, column=c, value=v)
                    cell.font = font(10)
                    cell.border = BORDER
                    cell.alignment = Alignment(vertical="top", wrap_text=True)
                ws[f"{COL['Số ngày']}{r}"] = (
                    f'=IF(AND({COL["Ngày bắt đầu"]}{r}<>"",{COL["Ngày kết thúc"]}{r}<>""),'
                    f'{COL["Ngày kết thúc"]}{r}-{COL["Ngày bắt đầu"]}{r}+1,"")')
                for name in ("Mã", "Phase", "Ưu tiên", "Tiến độ", "Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến",
                             "Số ngày", "Trạng thái", "Trạng thái issue", "Trạng thái code"):
                    ws[f"{COL[name]}{r}"].alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
                for name in ("Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến"):
                    ws[f"{COL[name]}{r}"].number_format = "dd/mm/yyyy"
                ws[f"{COL['Tiến độ']}{r}"].number_format = "0%"
                for name in ("Mã", "Phase", "Nhóm tính năng", "Tính năng"):
                    ws[f"{COL[name]}{r}"].fill = fill(tint)
                ws[f"{COL['Chức năng chi tiết']}{r}"].font = font(10, True)
                r += 1
    last_data = r - 1

    # spare, pre-formatted rows for new items
    for rr in range(last_data + 1, last_data + 31):
        for c in range(1, NCOL + 1):
            cell = ws.cell(row=rr, column=c)
            cell.font = font(10)
            cell.border = BORDER
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        ws[f"{COL['Số ngày']}{rr}"] = (
            f'=IF(AND({COL["Ngày bắt đầu"]}{rr}<>"",{COL["Ngày kết thúc"]}{rr}<>""),'
            f'{COL["Ngày kết thúc"]}{rr}-{COL["Ngày bắt đầu"]}{rr}+1,"")')
        for name in ("Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến"):
            ws[f"{COL[name]}{rr}"].number_format = "dd/mm/yyyy"
        ws[f"{COL['Tiến độ']}{rr}"].number_format = "0%"
        for name in ("Mã", "Phase", "Ưu tiên", "Tiến độ", "Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến",
                     "Số ngày", "Trạng thái", "Trạng thái issue", "Trạng thái code"):
            ws[f"{COL[name]}{rr}"].alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)

    ws.freeze_panes = f"F{FIRST}"
    ws.auto_filter.ref = f"A5:{get_column_letter(NCOL)}{last_data + 30}"

    # ---- hidden list sources for dropdowns --------------------------------
    lists = {"status": ("Danh sách trạng thái", STATUSES), "prio": ("Ưu tiên", PRIOS),
             "issue": ("Trạng thái issue", ISSUE_STATES), "code": ("Trạng thái code", CODE_STATES)}
    for key, (title, vals) in lists.items():
        col = LIST_COLS[key]
        ws[f"{col}5"] = title
        ws[f"{col}5"].font = font(9, True, "7F7F7F")
        for i, v in enumerate(vals):
            ws[f"{col}{FIRST + i}"] = v
            ws[f"{col}{FIRST + i}"].font = font(9, False, "7F7F7F")
        ws.column_dimensions[col].width = 22
        ws.column_dimensions[col].hidden = True

    def dropdown(col_name, key, count, prompt):
        src = LIST_COLS[key]
        v = DataValidation(type="list", formula1=f"${src}${FIRST}:${src}${FIRST + count - 1}", allow_blank=True,
                           showErrorMessage=True, showInputMessage=True, errorTitle="Giá trị không hợp lệ",
                           error="Hãy chọn một giá trị trong danh sách thả xuống.", promptTitle=col_name, prompt=prompt)
        v.add(f"{COL[col_name]}{FIRST}:{COL[col_name]}{LAST}")
        ws.add_data_validation(v)

    dropdown("Trạng thái", "status", len(STATUSES), "Bấm mũi tên để chọn trạng thái.")
    dropdown("Ưu tiên", "prio", len(PRIOS), "P0 bắt buộc, P1 quan trọng, P2 làm sau.")
    dropdown("Trạng thái issue", "issue", len(ISSUE_STATES), "Đang mở / Đã xử lý / Chấp nhận rủi ro.")
    dropdown("Trạng thái code", "code", len(CODE_STATES), "Chưa commit → Đã commit → Đã push → Đã merge.")
    vp = DataValidation(type="decimal", operator="between", formula1="0", formula2="1", allow_blank=True,
                        showErrorMessage=True, errorTitle="Tiến độ", error="Nhập từ 0% đến 100%.")
    vp.add(f"{COL['Tiến độ']}{FIRST}:{COL['Tiến độ']}{LAST}")
    ws.add_data_validation(vp)
    vd = DataValidation(type="date", operator="greaterThan", formula1="36526", allow_blank=True,
                        showErrorMessage=True, errorTitle="Ngày", error="Nhập ngày hợp lệ (dd/mm/yyyy).")
    for name in ("Ngày bắt đầu", "Ngày kết thúc", "Hạn dự kiến"):
        vd.add(f"{COL[name]}{FIRST}:{COL[name]}{LAST}")
    ws.add_data_validation(vd)

    # ---- conditional formatting ------------------------------------------
    sc = COL["Trạng thái"]
    for s in STATUSES:
        ws.conditional_formatting.add(
            f"{sc}{FIRST}:{sc}{LAST}",
            CellIsRule(operator="equal", formula=[f'"{s}"'], fill=fill(STATUS_FILL[s]),
                       font=Font(name=FONT, bold=True, color=STATUS_FONT[s])))
    ws.conditional_formatting.add(
        f"E{FIRST}:{get_column_letter(NCOL)}{LAST}",
        FormulaRule(formula=[f'${sc}{FIRST}="{S_DONE}"'], fill=fill("F1F9F3")))
    pc = COL["Tiến độ"]
    ws.conditional_formatting.add(f"{pc}{FIRST}:{pc}{LAST}",
                                  DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="63BE7B"))
    ic = COL["Trạng thái issue"]
    for key, bg, fg in ((ISSUE_OPEN, "FFC7CE", "9C0006"), (ISSUE_FIXED, "FFEB9C", "7F6000"), (ISSUE_ACCEPT, "F8CBAD", "843C0C")):
        ws.conditional_formatting.add(f"{ic}{FIRST}:{ic}{LAST}",
                                      CellIsRule(operator="equal", formula=[f'"{key}"'], fill=fill(bg), font=Font(name=FONT, bold=True, color=fg)))
    ic_text = COL["Issue / Vướng mắc"]
    ws.conditional_formatting.add(f"{ic_text}{FIRST}:{ic_text}{LAST}",
                                  FormulaRule(formula=[f'${ic}{FIRST}="{ISSUE_OPEN}"'], font=Font(name=FONT, color="9C0006")))
    prc = COL["Ưu tiên"]
    ws.conditional_formatting.add(f"{prc}{FIRST}:{prc}{LAST}",
                                  CellIsRule(operator="equal", formula=['"P0"'], font=Font(name=FONT, bold=True, color="C00000")))
    cc = COL["Trạng thái code"]
    for key, bg in ((CODE_PUSHED, "C6EFCE"), (CODE_MERGED, "C6EFCE"), (CODE_LOCAL, "FFEB9C"), (CODE_COMMIT, "FFF2CC")):
        ws.conditional_formatting.add(f"{cc}{FIRST}:{cc}{LAST}",
                                      CellIsRule(operator="equal", formula=[f'"{key}"'], fill=fill(bg)))

    tc = COL["Loại test"]
    ws.conditional_formatting.add(f"{tc}{FIRST}:{tc}{LAST}",
                                  CellIsRule(operator="equal", formula=['"Chưa có"'], fill=fill("FFC7CE"), font=Font(name=FONT, bold=True, color="9C0006")))
    ws.conditional_formatting.add(f"{tc}{FIRST}:{tc}{LAST}",
                                  FormulaRule(formula=[f'LEFT({tc}{FIRST},8)="Kế hoạch"'], font=Font(name=FONT, italic=True, color="7F7F7F")))
    ws.conditional_formatting.add(f"{tc}{FIRST}:{tc}{LAST}",
                                  FormulaRule(formula=[f'OR(LEFT({tc}{FIRST},4)="Unit",{tc}{FIRST}="Widget",LEFT({tc}{FIRST},11)="Integration")'], fill=fill("E2EFDA")))
    ws[f"{COL['Nhánh Git']}5"].comment = Comment("Quy ước: nhiby/feature/<tên-tính-năng>. Mỗi tính năng lớn một nhánh; ghi link PR ở cột 'Link PR / Commit'.", "Tracker")
    ws[f"{tc}5"].comment = Comment("Unit: logic/controller/repository. Widget: màn hình. Integration: luồng end-to-end. 'Chưa có' = cần bổ sung trước khi nghiệm thu.", "Tracker")

    # ---- header notes -----------------------------------------------------
    ws[f"{sc}5"].comment = Comment(
        "Chọn bằng dropdown:\n"
        "• Chưa bắt đầu: chưa làm\n• Đang thực hiện: đang code\n"
        "• Đang kiểm thử: code xong, chờ xác nhận chạy đúng\n• Hoàn thành: xong và đã kiểm chứng\n"
        "• Bị chặn: phụ thuộc bên ngoài\n• Tạm hoãn: ngoài phạm vi hiện tại", "Tracker")
    ws[f"{sc}5"].comment.width, ws[f"{sc}5"].comment.height = 320, 170
    ws[f"{COL['Mã']}5"].comment = Comment("Dạng <nhóm>.<tính năng>.<chức năng>, ví dụ 1.2.2 = Xác thực > Đăng ký & xác minh > Nhập mã OTP.", "Tracker")

    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "5:5"

    wb.calculation.fullCalcOnLoad = True
    wb.save(OUT)
    n = sum(len(t) for _, _, _, fs in MODULES for _, t in fs)
    print("saved", OUT, "| sheets:", wb.sheetnames, "| tasks:", n, "| last data row:", last_data)


if __name__ == "__main__":
    build()
