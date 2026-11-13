"""One-off: mark the Explore rows that already have code (domain + data layer) as in progress."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# ---- build_tracker.py: task rows ------------------------------------------------
p = os.path.join(HERE, "build_tracker.py")
s = open(p, encoding="utf8").read()

REPL = [
    ('T("Gợi ý cho bạn (explore-for-you)", "/api/recommendations/explore-for-you, cá nhân hóa theo onboarding.", "(main)/explore", prio="P0"),',
     'T("Gợi ý cho bạn (explore-for-you)", "/api/recommendations/explore-for-you, cá nhân hóa theo onboarding.", "(main)/explore", prio="P0", status=S_DOING, prog=0.3, start=D3,\n'
     '              note="Đã xong domain + repository gọi API (flutter analyze sạch); chưa có controller, giao diện, test. Tab này cần đăng nhập, lỗi thì rơi về tìm kiếm địa điểm nổi bật."),'),
    ('T("Tìm kiếm địa điểm", "/api/places/search.", "(main)/places", prio="P0"),',
     'T("Tìm kiếm địa điểm", "/api/places/search.", "(main)/places", prio="P0", status=S_DOING, prog=0.3, start=D3,\n'
     '              note="Đã xong repository + parser Place (lọc ảnh theo host được duyệt) + buildSearchQuery; chưa có controller, giao diện, test."),'),
    ('T("Gợi ý khi gõ (autocomplete)", "Debounce + hủy request cũ (CancelToken).", "(main)/explore", prio="P0"),',
     'T("Gợi ý khi gõ (autocomplete)", "Debounce 300 ms + bỏ kết quả của request cũ.", "(main)/explore", prio="P0", status=S_DOING, prog=0.2, start=D3,\n'
     '              note="Đã xong repository; controller debounce và giao diện chưa làm."),'),
    ('T("Thông tin cơ bản", "Tên, địa chỉ, đánh giá, danh mục.", "(main)/places", prio="P0"),',
     'T("Thông tin cơ bản", "Tên, địa chỉ, đánh giá, danh mục.", "(main)/places", prio="P0", status=S_DOING, prog=0.2, start=D3,\n'
     '              note="Đã xong model Place + API chi tiết; chưa có màn hình."),'),
    ('T("Giờ mở cửa & liên hệ", "", "(main)/places", prio="P1"),',
     'T("Giờ mở cửa & liên hệ", "Hiển thị giờ hôm nay + cả tuần, điện thoại, website.", "(main)/places", prio="P1", status=S_DOING, prog=0.15, start=D3,\n'
     '              note="Đã xong bộ phân tích giờ mở cửa (parseOpeningHours/todayOpeningHours); chưa có màn hình."),'),
]
for a, b in REPL:
    assert a in s, a[:60]
    s = s.replace(a, b, 1)
open(p, "w", encoding="utf8").write(s)

# ---- build_tracker2.py: self-contained paths + explore branch/code state ---------
p = os.path.join(HERE, "build_tracker2.py")
t = open(p, encoding="utf8").read()

old_path = [ln for ln in t.splitlines() if ln.startswith("sys.path.insert(0, r\"C:")]
assert old_path
t = t.replace(old_path[0], "sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))", 1)
t = t.replace("import sys\n", "import os\nimport sys\n", 1) if "import os" not in t else t
t = t.replace('OUT = r"D:\\capstone\\tripsense-platform\\docs\\reports\\mobile-user-app-tracking.xlsx"',
              'OUT = r"D:\\capstone\\tripsense-platform\\docs\\reports\\mobile-user-app-tracking-v2.xlsx"', 1)

t = t.replace('UI_BRANCH = "nhiby/feature/mobile-ui-polish"',
              'EXPLORE_BRANCH = "nhiby/feature/mobile-explore-places"\nUI_BRANCH = "nhiby/feature/mobile-ui-polish"', 1)

a = "                code_state = CODE_NONE if no_code else CODE_COMMIT\n"
b = ('                is_explore = mname.startswith("Khám phá")\n'
     "                code_state = CODE_NONE if no_code else (CODE_LOCAL if is_explore else CODE_COMMIT)\n")
assert a in t
t = t.replace(a, b, 1)
t = t.replace('"" if no_code else (UI_BRANCH if', '"" if no_code else (EXPLORE_BRANCH if is_explore else UI_BRANCH if', 1)
t = t.replace('"" if no_code else (UI_COMMIT if', '"" if no_code else ("(chưa commit)" if is_explore else UI_COMMIT if', 1)
t = t.replace("Nhánh hiện tại: {UI_BRANCH}", "Nhánh hiện tại: {EXPLORE_BRANCH}", 1)
t = t.replace("Cập nhật: 13/11/2026 (UI parity)", "Cập nhật: 13/11/2026 (Khám phá đang làm)", 1)
open(p, "w", encoding="utf8").write(t)
print("patched")
