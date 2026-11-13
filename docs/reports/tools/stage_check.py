import sys, warnings, collections
warnings.filterwarnings("ignore")
import os, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_tracker2 as b
STAGING = os.path.join(tempfile.gettempdir(), "tracker_staged.xlsx")
b.OUT = STAGING; b.build()
import openpyxl
ws = openpyxl.load_workbook(STAGING)["Theo dõi tiến độ"]
hdr = {c.value: i for i, c in enumerate(ws[5])}
print("cols:", len(hdr), "| test cols:", [h for h in hdr if "test" in str(h).lower()])
rows = [[c.value for c in r] for r in ws.iter_rows(min_row=6, max_row=200) if r[0].value and not str(r[0].value).startswith("▌")]
print("tasks:", len(rows))
print("branch:", dict(collections.Counter(r[hdr["Nhánh Git"]] for r in rows)))
print("code state:", dict(collections.Counter(r[hdr["Trạng thái code"]] for r in rows)))
print("test type:", dict(collections.Counter(r[hdr["Loại test"]] for r in rows)))
print("done/test rows lacking tests:", [(r[0], r[hdr["Chức năng chi tiết"]]) for r in rows if r[hdr["Trạng thái"]] in ("Hoàn thành","Đang kiểm thử") and r[hdr["Loại test"]]=="Chưa có"])
