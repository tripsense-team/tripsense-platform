"""One-off: record the 'update the Excel as you go' rule + Explore progress in the docs."""
import os

ROOT = r"D:\capstone\tripsense-platform\docs"

# ---- plan: implementation log + working rule --------------------------------------
p = os.path.join(ROOT, "features", "mobile-user-app.md")
s = open(p, encoding="utf8").read()

row = ("| 2 Explore & Places | ĐANG LÀM (nhánh `nhiby/feature/mobile-explore-places`) | "
       "Đã xong domain + data (Place, tìm kiếm, gợi ý, chi tiết, giờ mở cửa); chưa có controller, giao diện, test. |")
if "| 2 Explore & Places | TODO | |" in s:
    s = s.replace("| 2 Explore & Places | TODO | |", row, 1)

rule = (
    "\n### Quy tắc theo dõi tiến độ (bắt buộc)\n"
    "- **Làm tới đâu cập nhật Excel tới đó:** sau mỗi tính năng (và cả khi làm dở) cập nhật "
    "`docs/reports/mobile-user-app-tracking-v2.xlsx` (trạng thái, tiến độ, ngày, nhánh Git, "
    "trạng thái code, commit, issue, loại/kết quả test) rồi ghi Implementation Log ở trên.\n"
    "- Cách làm: sửa dữ liệu trong `docs/reports/tools/build_tracker.py`, ánh xạ nhánh/commit/test trong "
    "`docs/reports/tools/build_tracker2.py`, chạy `py -X utf8 docs\\reports\\tools\\build_tracker2.py` (ghi thẳng ra bản `-v2`).\n"
    "- File Excel gốc `mobile-user-app-tracking.xlsx` hay bị Excel khóa: luôn dùng bản `-v2`.\n"
)
if "Quy tắc theo dõi tiến độ" not in s:
    s += rule
open(p, "w", encoding="utf8").write(s)

# ---- handoff: refresh sections 7 and 8 ---------------------------------------------
p = os.path.join(ROOT, "reports", "mobile-session-handoff.md")
h = open(p, encoding="utf8").read()

h = h.replace(
    "- Cách cập nhật (tạo lại toàn bộ từ dữ liệu, an toàn vì người dùng chưa sửa tay):",
    "- **QUY TẮC: làm tới đâu cập nhật Excel tới đó** (cả khi làm dở), rồi gửi file cho người dùng bằng `SendUserFile`.\n"
    "- Cách cập nhật (tạo lại toàn bộ từ dữ liệu, an toàn vì người dùng chưa sửa tay):", 1)
h = h.replace(
    "rồi chạy `py -X utf8 build_tracker2.py` (đặt `OUT` ra `-v2.xlsx`; sửa các đường dẫn tuyệt đối trong 2 file nếu cần).",
    "rồi chạy `py -X utf8 docs\\reports\\tools\\build_tracker2.py` (**ghi thẳng ra `-v2.xlsx`**, 2 file đã tự tìm nhau theo thư mục, không còn phụ thuộc thư mục tạm).", 1)
h = h.replace(
    "- Trạng thái hiện tại: nền tảng + auth + onboarding + UI parity + font **Hoàn thành**; Khám phá/Địa điểm… **chưa bắt đầu** trong Excel (cần đánh dấu \"Đang thực hiện\" khi làm).",
    "- Trạng thái hiện tại (13/11/2026): 157 chức năng, 41 Hoàn thành, 10 Đang kiểm thử, 7 Đang thực hiện, tiến độ tổng ~32,8%. Nền tảng + auth + onboarding + UI parity + font **Hoàn thành**; "
    "5 dòng Khám phá/Địa điểm **Đang thực hiện** (nhánh `nhiby/feature/mobile-explore-places`, trạng thái code \"Chưa commit\"). "
    "Khi commit tính năng Khám phá: đặt `EXPLORE_COMMIT` thật thay cho \"(chưa commit)\" trong `build_tracker2.py` và đổi `CODE_LOCAL` -> `CODE_COMMIT` cho nhóm này.", 1)
open(p, "w", encoding="utf8").write(h)
print("docs updated")
