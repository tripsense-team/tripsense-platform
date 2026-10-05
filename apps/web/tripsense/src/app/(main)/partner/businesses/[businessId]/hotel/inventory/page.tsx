"use client";

import * as React from "react";
import Link from "next/link";
import { usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import type { HotelRoom, HotelInventory } from "@/features/hotels/types";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { CalendarDays, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";

export default function PartnerHotelInventoryPage() {
  const { t } = useTranslation();
  const { businessId, property, isManager } = usePartnerHotel();
  const [rooms, setRooms] = React.useState<HotelRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState("");
  const [inventory, setInventory] = React.useState<HotelInventory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const todayIso = React.useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultToIso = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  }, []);

  const [fromDate, setFromDate] = React.useState(todayIso);
  const [toDate, setToDate] = React.useState(defaultToIso);

  // Load rooms
  React.useEffect(() => {
    if (!property) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchRooms() {
      try {
        const data = await hotelApi<HotelRoom[]>(`/properties/${property!.id}/rooms`);
        if (!cancelled) {
          setRooms(data);
          if (data.length > 0) {
            setSelectedRoomId(data[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) setError(getSafeErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchRooms();
    return () => {
      cancelled = true;
    };
  }, [property]);

  // Load inventory for selected room and range
  const loadInventory = React.useCallback(async () => {
    if (!property || !selectedRoomId || !fromDate || !toDate) return;
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ from: fromDate, to: toDate });
      const data = await hotelApi<HotelInventory[]>(
        `/properties/${property.id}/rooms/${selectedRoomId}/inventory?${query}`
      );
      setInventory(data);
    } catch (e) {
      setError(getSafeErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [property, selectedRoomId, fromDate, toDate]);

  React.useEffect(() => {
    if (selectedRoomId) {
      void loadInventory();
    }
  }, [selectedRoomId, loadInventory]);

  const handleUpdateInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!property || !selectedRoomId || busy || !isManager) return;
    const data = new FormData(e.currentTarget);
    const allocation = Number(data.get("allocation"));
    const nightlyPrice = Number(data.get("nightlyPrice"));
    const stopSell = data.get("stopSell") === "on";

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await hotelApi(`/properties/${property.id}/rooms/${selectedRoomId}/inventory`, "PUT", {
        from: fromDate,
        to: toDate,
        allocation,
        nightlyPrice,
        stopSell,
      });
      setSuccess("Cập nhật lịch phòng và giá thành công!");
      await loadInventory();
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  if (!property) {
    return (
      <div className="p-8 text-center space-y-4 rounded-2xl bg-card border border-border">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h3 className="font-bold text-base text-foreground">Cơ sở lưu trú chưa được khởi tạo</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Cần hoàn tất khai báo cơ sở lưu trú trước khi quản lý lịch phòng và giá.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/partner/businesses/${businessId}/hotel`}>Thiết lập cơ sở</Link>
        </Button>
      </div>
    );
  }

  if (rooms.length === 0 && !loading) {
    return (
      <div className="p-8 text-center space-y-4 rounded-2xl bg-card border border-border">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
        <h3 className="font-bold text-base text-foreground">Chưa có loại phòng nào</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Hãy thêm ít nhất một loại phòng trước khi điều chỉnh giá và số lượng mở bán.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/partner/businesses/${businessId}/hotel/rooms`}>Thêm loại phòng</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filter and Update Form */}
      <Card className="rounded-2xl border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>Điều chỉnh giá & số lượng phòng mở bán</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Chọn loại phòng và khoảng ngày cần cập nhật số lượng phòng khả dụng hoặc giá bán theo đêm.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleUpdateInventory} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Loại phòng</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.capacity} khách)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Từ ngày</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Đến ngày</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Số phòng mở bán</label>
              <Input name="allocation" type="number" min={0} max={100} defaultValue={5} required />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Giá / đêm (VND)</label>
              <Input name="nightlyPrice" type="number" step="10000" min={10000} defaultValue={500000} required />
            </div>

            <div className="sm:col-span-2 md:col-span-3 lg:col-span-6 flex flex-wrap items-center justify-between gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                <input type="checkbox" name="stopSell" className="rounded" />
                <span>Tạm dừng mở bán (Stop Sell) trong khoảng thời gian này</span>
              </label>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void loadInventory()} disabled={busy}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                  Xem lịch
                </Button>
                {isManager && (
                  <Button type="submit" size="sm" disabled={busy}>
                    {busy ? "Đang lưu..." : "Áp dụng cập nhật"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-foreground">
          Chi tiết tồn phòng ({inventory.length} ngày)
        </h3>

        {inventory.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-muted/20 border border-border text-muted-foreground text-sm">
            Không có dữ liệu lịch phòng cho khoảng thời gian này. Bấm &quot;Xem lịch&quot; hoặc &quot;Áp dụng cập nhật&quot; để tạo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3 text-left font-semibold">Ngày lưu trú</th>
                  <th className="p-3 text-center font-semibold">Mở bán</th>
                  <th className="p-3 text-center font-semibold">Đang giữ</th>
                  <th className="p-3 text-center font-semibold">Đã đặt</th>
                  <th className="p-3 text-right font-semibold">Giá / đêm</th>
                  <th className="p-3 text-center font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventory.map((day) => (
                  <tr key={day.stay_date} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium text-foreground">{day.stay_date}</td>
                    <td className="p-3 text-center font-semibold">{day.allocation}</td>
                    <td className="p-3 text-center text-amber-600 dark:text-amber-400 font-semibold">{day.held}</td>
                    <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-semibold">{day.booked}</td>
                    <td className="p-3 text-right font-bold">
                      {new Intl.NumberFormat("vi-VN").format(day.nightly_price)} VND
                    </td>
                    <td className="p-3 text-center">
                      {day.stop_sell ? (
                        <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-micro font-semibold">
                          Tạm ngưng
                        </span>
                      ) : day.allocation - day.held - day.booked <= 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-micro font-semibold">
                          Hết phòng
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-micro font-semibold">
                          Còn {day.allocation - day.held - day.booked}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
