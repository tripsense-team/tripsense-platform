"use client";

import * as React from "react";
import Link from "next/link";
import { usePartnerHotel } from "@/features/hotels/context/partner-hotel-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import type { HotelBooking } from "@/features/hotels/types";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  Users,
  Calendar,
  AlertCircle,
  RefreshCw,
  Clock,
  Ban,
  CheckCircle2,
  DollarSign,
} from "lucide-react";

export default function PartnerHotelBookingsPage() {
  const { t } = useTranslation();
  const { businessId, property, isManager } = usePartnerHotel();
  const [bookings, setBookings] = React.useState<HotelBooking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelTargetId, setCancelTargetId] = React.useState<string | null>(null);

  const loadBookings = React.useCallback(async () => {
    if (!property) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await hotelApi<HotelBooking[]>(`/properties/${property.id}/bookings`);
      setBookings(data);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [property]);

  React.useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const handleAction = async (action: "check-in" | "check-out" | "no-show", b: HotelBooking) => {
    if (!property || busy || !isManager) return;
    setBusy(true);
    setError("");
    try {
      await hotelApi(`/bookings/${b.id}/${action}`, "POST", {
        expectedVersion: b.version,
      });
      await loadBookings();
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (b: HotelBooking) => {
    if (!property || !cancelReason.trim() || busy || !isManager) return;
    setBusy(true);
    setError("");
    try {
      await hotelApi(`/bookings/${b.id}/cancel`, "POST", {
        expectedVersion: b.version,
        reason: cancelReason.trim(),
      });
      setCancelReason("");
      setCancelTargetId(null);
      await loadBookings();
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
          Cần hoàn tất khai báo cơ sở lưu trú trước khi xem và tiếp nhận đơn đặt phòng.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/partner/businesses/${businessId}/hotel`}>Thiết lập cơ sở</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-foreground">Danh sách đơn đặt phòng ({bookings.length})</h3>
          <p className="text-xs text-muted-foreground">Theo dõi và xử lý nhận phòng, trả phòng hoặc hủy phòng của khách lưu trú.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadBookings()} disabled={busy || loading} className="gap-1.5 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40 border border-border" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-muted/20 border border-border text-muted-foreground text-sm">
          Chưa có đơn đặt phòng nào cho cơ sở này.
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const isConfirmed = b.status === "CONFIRMED";
            const isCheckedIn = b.status === "CHECKED_IN";
            const isHeld = b.status === "HELD";

            return (
              <Card key={b.id} className="rounded-2xl border-border bg-card shadow-2xs">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">{b.room_name}</span>
                        <Badge
                          variant="outline"
                          className={`text-micro font-semibold uppercase ${
                            b.status === "CONFIRMED"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : b.status === "CHECKED_IN"
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                              : b.status === "CANCELLED"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-muted text-muted-foreground"
                          }`}
                        >
                          {b.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Mã đơn: #{b.id} · Phương thức: {b.payment_method}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-base font-bold text-foreground">
                        {new Intl.NumberFormat("vi-VN").format(b.total)} {b.currency || "VND"}
                      </span>
                      <span className="text-xs text-muted-foreground block">
                        Số lượng: {b.quantity} phòng · {b.guests} khách
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-micro">Ngày nhận phòng</span>
                      <span className="font-semibold text-foreground">{b.check_in}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-micro">Ngày trả phòng</span>
                      <span className="font-semibold text-foreground">{b.check_out}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-micro">Chính sách hủy</span>
                      <span className="font-medium text-foreground">{b.cancellation_policy}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-micro">Hạn hủy miễn phí</span>
                      <span className="font-medium text-foreground">{b.free_cancellation_until || "—"}</span>
                    </div>
                  </div>

                  {/* Operational Action Buttons (Manager only) */}
                  {isManager && (
                    <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
                      {isConfirmed && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAction("check-in", b)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Xác nhận nhận phòng (Check-in)
                        </Button>
                      )}

                      {isCheckedIn && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAction("check-out", b)}
                          className="h-8 text-xs"
                        >
                          <Clock className="mr-1 h-3.5 w-3.5" />
                          Xác nhận trả phòng (Check-out)
                        </Button>
                      )}

                      {isConfirmed && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAction("no-show", b)}
                          className="h-8 text-xs"
                        >
                          <Ban className="mr-1 h-3.5 w-3.5" />
                          Khách vắng mặt (No-show)
                        </Button>
                      )}

                      {(isConfirmed || isHeld) && (
                        <>
                          {cancelTargetId === b.id ? (
                            <div className="flex items-center gap-2 w-full pt-2">
                              <Input
                                placeholder="Nhập lý do hủy từ phía khách sạn..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="h-8 text-xs flex-1"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busy || !cancelReason.trim()}
                                onClick={() => void handleCancel(b)}
                                className="h-8 text-xs"
                              >
                                Xác nhận hủy
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCancelTargetId(null);
                                  setCancelReason("");
                                }}
                                className="h-8 text-xs"
                              >
                                Đóng
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => setCancelTargetId(b.id)}
                              className="h-8 text-xs text-destructive hover:bg-destructive/10"
                            >
                              Hủy đặt phòng
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
