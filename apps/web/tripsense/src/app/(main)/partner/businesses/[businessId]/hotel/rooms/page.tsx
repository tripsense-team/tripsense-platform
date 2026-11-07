"use client";

import * as React from "react";
import Link from "next/link";
import { usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import type { HotelRoom } from "@/features/hotels/types";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { BedDouble, Plus, Users, CheckCircle2, AlertCircle, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PartnerHotelRoomsPage() {
  const { t } = useTranslation();
  const { businessId, property, isManager } = usePartnerHotel();
  const [rooms, setRooms] = React.useState<HotelRoom[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const loadRooms = React.useCallback(async () => {
    if (!property) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await hotelApi<HotelRoom[]>(`/properties/${property.id}/rooms`);
      setRooms(data);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [property]);

  React.useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const handleAddRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!property || busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccessMessage("");
    try {
      await hotelApi(`/properties/${property.id}/rooms`, "POST", {
        name: String(data.get("roomName")),
        capacity: Number(data.get("capacity") || 2),
        nightlyPrice: Number(data.get("nightlyPrice") || 500000),
        allocation: Number(data.get("allocation") || 5),
      });
      form.reset();
      setSuccessMessage(t("trip.hotels.roomCreatedSuccess", { defaultValue: "Đã tạo loại phòng và mở bán 90 ngày thành công!" }));
      await loadRooms();
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
          Bạn cần hoàn tất khai báo thông tin cơ sở lưu trú trước khi thêm các loại phòng.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/partner/businesses/${businessId}/hotel`}>
            Thiết lập thông tin cơ sở
          </Link>
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

      {successMessage && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Add Room Type Form */}
      {isManager && (
        <Card className="rounded-2xl border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Thêm loại phòng giới thiệu (Showcase)</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Khai báo các loại phòng và mức giá tham khảo để hiển thị tới khách du lịch. Khách sẽ nhắn tin trực tiếp để trao đổi và đặt phòng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddRoom} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <input type="hidden" name="allocation" value="10" />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Tên loại phòng</label>
                <Input name="roomName" placeholder="Ví dụ: Phòng Deluxe Hướng Biển" required />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Sức chứa tối đa (khách)</label>
                <Input name="capacity" type="number" min={1} max={20} defaultValue={2} required />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Giá tham khảo (VND / đêm)</label>
                <Input name="nightlyPrice" type="number" step="10000" min={10000} defaultValue={500000} required />
              </div>

              <div className="sm:col-span-3">
                <Button type="submit" disabled={busy} className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  <span>{busy ? "Đang xử lý..." : "Thêm loại phòng vào Showcase"}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Rooms List */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-foreground flex items-center justify-between">
          <span>Danh sách loại phòng ({rooms.length})</span>
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40 border border-border" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-muted/20 border border-border text-muted-foreground text-sm">
            Chưa có loại phòng nào được thiết lập. Hãy thêm loại phòng đầu tiên của bạn ở trên.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card key={room.id} className="rounded-2xl border-border bg-card/60 shadow-2xs">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <BedDouble className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-foreground truncate">{room.name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>Sức chứa: {room.capacity} khách</span>
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro">
                      Hiển thị Showcase
                    </Badge>
                    <Link
                      href="/chat"
                      className="text-primary hover:underline font-semibold text-xs flex items-center gap-1"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Xem tin nhắn khách</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
