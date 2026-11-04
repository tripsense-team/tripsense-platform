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
import { CreateDirectBookingModal } from "@/features/partner";
import {
  AlertCircle,
  RefreshCw,
  Clock,
  Ban,
  CheckCircle2,
  CalendarDays,
  XCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type BookingFilterTab = "ALL" | "HELD" | "CONFIRMED" | "EXPIRED" | "CHECKED_IN" | "CANCELLED";

function isHotelBookingExpired(b: HotelBooking): boolean {
  if (b.status === "EXPIRED") return true;
  if (["HELD", "PENDING"].includes(b.status)) {
    if (b.expires_at && new Date(b.expires_at).getTime() < Date.now()) return true;
    if (b.check_in && new Date(b.check_in).getTime() < Date.now()) return true;
  }
  return false;
}

const PAGE_SIZE = 6;

export default function PartnerHotelBookingsPage() {
  const { t } = useTranslation();
  const { businessId, property, isManager } = usePartnerHotel();
  const [bookings, setBookings] = React.useState<HotelBooking[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [filterState, setFilterState] = React.useState<BookingFilterTab>("ALL");
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelTargetId, setCancelTargetId] = React.useState<string | null>(null);
  const [directBookingOpen, setDirectBookingOpen] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

  const loadBookings = React.useCallback(async () => {
    if (!property) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await hotelApi<HotelBooking[]>(`/properties/${property.id}/bookings`);
      const sorted = (data || []).sort((a, b) => {
        const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (tB !== tA) return tB - tA;
        const cA = a.check_in ? new Date(a.check_in).getTime() : 0;
        const cB = b.check_in ? new Date(b.check_in).getTime() : 0;
        return cB - cA;
      });
      setBookings(sorted);
    } catch (err) {
      setError(getSafeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [property]);

  React.useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const handleConfirmBooking = async (b: HotelBooking) => {
    if (!property || busy || !isManager) return;
    setBusy(true);
    setError("");
    setActionSuccess(null);
    try {
      await hotelApi(`/bookings/${b.id}/confirm`, "POST");
      setActionSuccess(`Đã xác nhận đơn đặt phòng #${b.id.slice(0, 8)} (${b.room_name}) thành công!`);
      await loadBookings();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed", { defaultValue: "Không thể xác nhận đặt phòng" })));
    } finally {
      setBusy(false);
    }
  };

  const handleAction = async (action: "check-in" | "check-out" | "no-show", b: HotelBooking) => {
    if (!property || busy || !isManager) return;
    setBusy(true);
    setError("");
    setActionSuccess(null);
    try {
      await hotelApi(`/bookings/${b.id}/${action}`, "POST", {
        expectedVersion: b.version,
      });
      const actionName =
        action === "check-in"
          ? "nhận phòng (Check-in)"
          : action === "check-out"
          ? "trả phòng (Check-out)"
          : "báo vắng mặt (No-show)";
      setActionSuccess(`Đã cập nhật trạng thái ${actionName} cho đơn #${b.id.slice(0, 8)}.`);
      await loadBookings();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
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
    setActionSuccess(null);
    try {
      await hotelApi(`/bookings/${b.id}/cancel`, "POST", {
        expectedVersion: b.version,
        reason: cancelReason.trim(),
      });
      setCancelReason("");
      setCancelTargetId(null);
      setActionSuccess(`Đã từ chối/hủy đơn đặt phòng #${b.id.slice(0, 8)}.`);
      await loadBookings();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  const filteredBookings = React.useMemo(() => {
    return bookings.filter((b) => {
      const exp = isHotelBookingExpired(b);
      if (filterState === "ALL") return true;
      if (filterState === "EXPIRED") return exp;
      if (filterState === "HELD") return b.status === "HELD" && !exp;
      if (filterState === "CONFIRMED") return b.status === "CONFIRMED";
      if (filterState === "CHECKED_IN") return b.status === "CHECKED_IN";
      if (filterState === "CANCELLED")
        return ["CANCELLED", "NO_SHOW"].includes(b.status);
      return true;
    });
  }, [bookings, filterState]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBookings = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredBookings.slice(start, start + PAGE_SIZE);
  }, [filteredBookings, safePage]);

  const handleFilterChange = (newFilter: BookingFilterTab) => {
    setFilterState(newFilter);
    setCurrentPage(1);
  };

  const heldCount = bookings.filter((b) => b.status === "HELD" && !isHotelBookingExpired(b)).length;
  const confirmedCount = bookings.filter((b) => b.status === "CONFIRMED").length;
  const expiredCount = bookings.filter((b) => isHotelBookingExpired(b)).length;
  const checkedInCount = bookings.filter((b) => b.status === "CHECKED_IN").length;
  const cancelledCount = bookings.filter((b) => ["CANCELLED", "NO_SHOW"].includes(b.status)).length;

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
      {/* Header and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-foreground">
            Danh sách đơn đặt phòng ({bookings.length})
          </h3>
          <p className="text-xs text-muted-foreground">
            Theo dõi, xác nhận đơn giữ chỗ và xử lý nhận/trả phòng của khách lưu trú.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => setDirectBookingOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Đặt phòng trực tiếp</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadBookings()}
            disabled={busy || loading}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Symmetrical Filter Tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {[
          { id: "ALL", label: `Tất cả (${bookings.length})` },
          { id: "HELD", label: `Chờ xác nhận (${heldCount})` },
          { id: "CONFIRMED", label: `Đã xác nhận (${confirmedCount})` },
          { id: "EXPIRED", label: `Hết hạn (${expiredCount})` },
          { id: "CHECKED_IN", label: `Đang lưu trú (${checkedInCount})` },
          { id: "CANCELLED", label: `Đã hủy / Vắng mặt (${cancelledCount})` },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={filterState === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange(tab.id as BookingFilterTab)}
            className="h-8 text-xs font-medium"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-destructive flex items-center gap-2" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40 border border-border" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-muted/20 border border-dashed border-border text-muted-foreground text-xs space-y-1">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/50 mb-1" />
          <p className="font-semibold text-foreground">Không có đơn đặt phòng nào trong mục này.</p>
          <p>Khi khách đặt phòng trực tuyến, đơn sẽ tự động hiển thị tại đây để bạn tiếp nhận.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-4">
            {paginatedBookings.map((b) => {
              const isExpired = isHotelBookingExpired(b);
              const isConfirmed = b.status === "CONFIRMED";
              const isCheckedIn = b.status === "CHECKED_IN";
              const isHeld = b.status === "HELD" && !isExpired;

              return (
                <Card key={b.id} className="rounded-2xl border-border bg-card shadow-2xs hover:border-border transition-colors">
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-foreground">{b.room_name}</span>
                          <Badge
                            variant="outline"
                            className={`text-micro font-semibold uppercase ${
                              isConfirmed
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : isCheckedIn
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                                : isHeld
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : isExpired
                                ? "border-muted-foreground/30 bg-muted/60 text-muted-foreground"
                                : b.status === "CANCELLED"
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                : "border-muted text-muted-foreground"
                            }`}
                          >
                            {isExpired
                              ? "Đã hết hạn"
                              : b.status === "HELD"
                              ? "Chờ xác nhận"
                              : b.status === "CONFIRMED"
                              ? "Đã xác nhận"
                              : b.status === "CHECKED_IN"
                              ? "Đang lưu trú"
                              : b.status === "CHECKED_OUT"
                              ? "Đã hoàn tất"
                              : b.status === "CANCELLED"
                              ? "Đã hủy"
                              : b.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">
                          Mã đơn: #{b.id.slice(0, 8)} · Thanh toán: {b.payment_method}
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

                  {/* Operational Actions */}
                  {isExpired && (
                    <div className="pt-2 border-t border-border flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-md border border-border/40">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Đơn đặt phòng đã quá thời hạn xử lý</span>
                    </div>
                  )}

                  {/* Symmetrical Operational Actions (Manager only) */}
                  {isManager && !isExpired && (
                    <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
                      {/* Symmetrical ACCEPT action for HELD */}
                      {isHeld && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleConfirmBooking(b)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Xác nhận đặt phòng</span>
                        </Button>
                      )}

                      {isConfirmed && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAction("check-in", b)}
                          className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Xác nhận nhận phòng (Check-in)</span>
                        </Button>
                      )}

                      {isCheckedIn && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAction("check-out", b)}
                          className="h-8 text-xs font-semibold gap-1"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>Xác nhận trả phòng (Check-out)</span>
                        </Button>
                      )}

                      {isConfirmed && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleAction("no-show", b)}
                          className="h-8 text-xs gap-1"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Khách vắng mặt (No-show)</span>
                        </Button>
                      )}

                      {(isConfirmed || isHeld) && (
                        <>
                          {cancelTargetId === b.id ? (
                            <div className="flex items-center gap-2 w-full pt-2">
                              <Input
                                placeholder="Nhập lý do từ chối / hủy đơn từ phía khách sạn..."
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
                                Xác nhận từ chối
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
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              {isHeld ? "Từ chối nhận đơn" : "Hủy đặt phòng"}
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-4 px-1">
            <span className="text-xs text-muted-foreground">
              Trang {safePage} / {totalPages} ({filteredBookings.length} đơn đặt phòng)
            </span>
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-8 px-2.5 text-xs font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Trước
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    Math.abs(pageNum - safePage) <= 1
                  ) {
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === safePage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0 text-xs font-semibold"
                      >
                        {pageNum}
                      </Button>
                    );
                  }
                  if (pageNum === safePage - 2 || pageNum === safePage + 2) {
                    return (
                      <span key={pageNum} className="text-muted-foreground px-1 text-xs">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-8 px-2.5 text-xs font-medium"
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
      )}

      <CreateDirectBookingModal
        open={directBookingOpen}
        onOpenChange={setDirectBookingOpen}
        initialBusinessId={businessId}
        initialType="HOTEL"
        onSuccess={() => void loadBookings()}
      />
    </div>
  );
}
