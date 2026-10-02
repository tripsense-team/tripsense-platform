"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import { HotelCheckoutReview } from "./hotel-checkout-review";
import type { HotelBooking, PayOsPaymentResult } from "../types";
import {
  Calendar,
  Users,
  Clock,
  Building2,
  CreditCard,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";

interface UserBookingsViewProps {
  onExploreStays?: () => void;
}

type FilterTab = "all" | "held" | "confirmed" | "history";

export function UserBookingsView({ onExploreStays }: UserBookingsViewProps) {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<HotelBooking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<HotelBooking | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await hotelApi<HotelBooking[]>("/bookings");
      setBookings(data);
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed", { defaultValue: "Failed to load bookings" })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        searchQuery === "" ||
        b.property_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.room_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filter === "held") return b.status === "HELD";
      if (filter === "confirmed") return b.status === "CONFIRMED";
      if (filter === "history") return ["CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW", "EXPIRED"].includes(b.status);
      return true;
    });
  }, [bookings, filter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: bookings.length,
      held: bookings.filter((b) => b.status === "HELD").length,
      confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
      history: bookings.filter((b) =>
        ["CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW", "EXPIRED"].includes(b.status)
      ).length,
    };
  }, [bookings]);

  async function handleQuickPay(booking: HotelBooking) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (booking.payment_method === "PAYOS") {
        const result = await hotelApi<PayOsPaymentResult>(`/bookings/${booking.id}/payos-payment`, "POST");
        if (result.payment?.checkoutUrl && result.payment.checkoutUrl.startsWith("https://")) {
          window.location.assign(result.payment.checkoutUrl);
          return;
        }
      }
      setSelectedBooking(booking);
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPayAtProperty(booking: HotelBooking) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await hotelApi<HotelBooking>(`/bookings/${booking.id}/confirm`, "POST");
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelConfirm() {
    if (!cancelTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      await hotelApi(`/bookings/${cancelTarget.id}/cancel`, "POST");
      setCancelTarget(null);
      if (selectedBooking?.id === cancelTarget.id) setSelectedBooking(null);
      await loadBookings();
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  }

  const money = (value: number, currency: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "VND" }).format(value);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "HELD":
        return {
          icon: Clock,
          color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          label: t("trip.hotels.status.HELD", { defaultValue: "Đang giữ chỗ" }),
        };
      case "CONFIRMED":
        return {
          icon: CheckCircle2,
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          label: t("trip.hotels.status.CONFIRMED", { defaultValue: "Đã xác nhận" }),
        };
      case "CHECKED_IN":
        return {
          icon: CheckCircle2,
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          label: t("trip.hotels.status.CHECKED_IN", { defaultValue: "Đã nhận phòng" }),
        };
      case "CHECKED_OUT":
        return {
          icon: CheckCircle2,
          color: "bg-muted text-muted-foreground border-border",
          label: t("trip.hotels.status.CHECKED_OUT", { defaultValue: "Đã trả phòng" }),
        };
      case "CANCELLED":
        return {
          icon: XCircle,
          color: "bg-destructive/10 text-destructive border-destructive/20",
          label: t("trip.hotels.status.CANCELLED", { defaultValue: "Đã hủy" }),
        };
      case "EXPIRED":
        return {
          icon: Clock,
          color: "bg-muted text-muted-foreground border-border",
          label: t("trip.hotels.status.EXPIRED", { defaultValue: "Hết hạn giữ" }),
        };
      default:
        return {
          icon: HelpCircle,
          color: "bg-muted text-foreground border-border",
          label: status,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t("trip.hotels.myBookings", { defaultValue: "Đơn đặt phòng của tôi" })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("trip.hotels.myBookingsSubtitle", {
              defaultValue: "Theo dõi trạng thái, thanh toán và quản lý các chuyến lưu trú của bạn",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || busy}
            onClick={() => void loadBookings()}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{t("common.refresh", { defaultValue: "Làm mới" })}</span>
          </Button>

          {onExploreStays && (
            <Button size="sm" onClick={onExploreStays} className="gap-1.5 shadow-2xs">
              <Building2 className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.exploreMore", { defaultValue: "Đặt thêm phòng" })}</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-border pb-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { key: "all", label: t("common.all", { defaultValue: "Tất cả" }), count: counts.all },
              { key: "held", label: t("trip.hotels.status.HELD", { defaultValue: "Đang giữ chỗ" }), count: counts.held },
              { key: "confirmed", label: t("trip.hotels.status.CONFIRMED", { defaultValue: "Đã xác nhận" }), count: counts.confirmed },
              { key: "history", label: t("trip.hotels.historyTab", { defaultValue: "Lịch sử" }), count: counts.history },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                filter === tab.key
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  filter === tab.key ? "bg-background/20 text-background" : "bg-background text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("trip.hotels.searchBookingPlaceholder", { defaultValue: "Tìm theo tên khách sạn..." })}
            className="h-8 w-full rounded-full border border-border bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* 3. Review Modal / Dialog */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-lg">{t("trip.hotels.reviewBooking", { defaultValue: "Chi tiết đặt phòng" })}</h3>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="h-8 w-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="pt-4">
              <HotelCheckoutReview
                booking={selectedBooking}
                onUpdated={(updated) => {
                  setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
                  setSelectedBooking(updated);
                  if (["CONFIRMED", "CANCELLED", "EXPIRED"].includes(updated.status)) {
                    void loadBookings();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Bookings Cards Grid */}
      {loading && bookings.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
          <p className="text-sm">{t("common.loading", { defaultValue: "Đang tải dữ liệu..." })}</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4 bg-card/50">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="font-semibold text-foreground text-sm">
              {filter === "all"
                ? t("trip.hotels.emptyBookings", { defaultValue: "Bạn chưa có đơn đặt phòng nào" })
                : t("trip.hotels.emptyFilteredBookings", { defaultValue: "Không tìm thấy đơn nào theo bộ lọc này" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("trip.hotels.emptyBookingsDesc", {
                defaultValue: "Khám phá các khách sạn hàng đầu và đặt phòng với giá ưu đãi ngay trên TripSense",
              })}
            </p>
          </div>
          {onExploreStays && (
            <Button onClick={onExploreStays} size="sm" className="shadow-2xs">
              {t("trip.hotels.exploreNow", { defaultValue: "Khám phá ngay" })}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredBookings.map((b) => {
            const badge = getStatusBadge(b.status);
            const BadgeIcon = badge.icon;
            const isPayos = b.payment_method === "PAYOS";
            const isHeld = b.status === "HELD";
            const isConfirmed = b.status === "CONFIRMED";
            const canCancel = isHeld || isConfirmed;

            return (
              <article
                key={b.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-4"
              >
                {/* Header: Hotel Name + Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-base text-foreground leading-snug">
                      {b.property_name}
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      <span>{b.room_name}</span>
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium shrink-0 ${badge.color}`}
                  >
                    <BadgeIcon className="h-3 w-3" />
                    <span>{badge.label}</span>
                  </span>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-muted/40 rounded-xl p-3 border border-border/50">
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{t("trip.hotels.stayDates", { defaultValue: "Thời gian lưu trú" })}</span>
                    </span>
                    <p className="font-medium text-foreground">
                      {b.check_in} → {b.check_out}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{t("trip.hotels.roomAndGuests", { defaultValue: "Phòng & Khách" })}</span>
                    </span>
                    <p className="font-medium text-foreground">
                      {b.quantity} {t("trip.hotels.quantity", { defaultValue: "phòng" })} · {b.guests} {t("trip.hotels.guests", { defaultValue: "khách" })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      <span>{t("trip.hotels.paymentMethod", { defaultValue: "Thanh toán" })}</span>
                    </span>
                    <p className="font-medium text-foreground">
                      {isPayos
                        ? t("trip.commerce.payOnline", { defaultValue: "Online qua payOS" })
                        : b.payment_method === "DEMO_ONLINE"
                        ? t("trip.commerce.payOnline", { defaultValue: "Thanh toán trực tuyến" })
                        : t("trip.hotels.payAtProperty", { defaultValue: "Tại cơ sở" })}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground">
                      {t("trip.hotels.totalPrice", { defaultValue: "Tổng chi phí" })}
                    </span>
                    <p className="font-semibold text-primary text-sm">
                      {money(b.total, b.currency)}
                    </p>
                  </div>
                </div>

                {/* Expiry or cancellation cutoff notices */}
                {isHeld && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      {t("trip.hotels.expires", { defaultValue: "Hết hạn giữ chỗ:" })}{" "}
                      {new Date(b.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </p>
                )}

                {/* Footer Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                  <span className="text-micro text-muted-foreground/80 font-mono truncate max-w-[120px]">
                    #{b.id.slice(0, 8)}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Pay / Confirm action if HELD */}
                    {isHeld && (
                      isPayos ? (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleQuickPay(b)}
                          className="h-8 text-xs font-semibold shadow-2xs"
                        >
                          {t("trip.commerce.payOnline", { defaultValue: "Thanh toán ngay" })}
                        </Button>
                      ) : b.payment_method === "PAY_AT_PROPERTY" ? (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleConfirmPayAtProperty(b)}
                          className="h-8 text-xs font-semibold shadow-2xs"
                        >
                          {t("trip.hotels.confirm", { defaultValue: "Xác nhận đặt" })}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => setSelectedBooking(b)}
                          className="h-8 text-xs font-semibold shadow-2xs"
                        >
                          {t("trip.hotels.review", { defaultValue: "Xem lại" })}
                        </Button>
                      )
                    )}

                    {/* View details */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBooking(b)}
                      className="h-8 text-xs"
                    >
                      {t("trip.hotels.details", { defaultValue: "Chi tiết" })}
                    </Button>

                    {/* Cancel booking if eligible */}
                    {canCancel && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setCancelTarget(b)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {t("common.cancel", { defaultValue: "Hủy" })}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog for Cancellation */}
      <ConfirmationDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title={t("trip.hotels.cancelTitle", { defaultValue: "Hủy đơn đặt phòng này?" })}
        description={t("trip.hotels.cancelDescription", {
          defaultValue: "Phòng đã giữ sẽ được mở lại cho khách khác. Bạn có chắc chắn muốn hủy không?",
        })}
        confirmText={t("common.confirm", { defaultValue: "Xác nhận hủy" })}
        cancelText={t("common.cancel", { defaultValue: "Giữ lại đơn" })}
        onConfirm={handleCancelConfirm}
      />
    </div>
  );
}
