"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import { Tag, Ticket, Loader2, HelpCircle, AlertCircle, X, ExternalLink } from "lucide-react";
import { BookingSupportDialog } from "./booking-support-dialog";
import type { HotelBooking, PayOsPaymentResult, VoucherDto } from "../types";

export function HotelCheckoutReview({
  booking,
  onUpdated,
  onDismiss,
}: {
  booking: HotelBooking;
  onUpdated: (booking: HotelBooking) => void;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  const method = booking.payment_method;
  const demo = method === "DEMO_ONLINE";
  const payos = method === "PAYOS";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [showVouchers, setShowVouchers] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState<VoucherDto[]>([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const pending = useRef(false);
  const attempts = useRef(new Map<string, string>());

  const hasVoucher = Boolean(booking.voucher_code && booking.discount_amount && booking.discount_amount > 0);

  const loadVouchers = async () => {
    if (availableVouchers.length > 0) {
      setShowVouchers(!showVouchers);
      return;
    }
    try {
      setLoadingVouchers(true);
      setShowVouchers(true);
      const list = await hotelApi<VoucherDto[]>("/vouchers/available");
      setAvailableVouchers(list || []);
    } catch {
      setAvailableVouchers([]);
    } finally {
      setLoadingVouchers(false);
    }
  };

  const handleApplyVoucher = async (codeToApply?: string) => {
    const code = (codeToApply || voucherCodeInput).trim();
    if (!code || applyingVoucher) return;
    try {
      setApplyingVoucher(true);
      setMessage("");
      const updated = await hotelApi<HotelBooking>(`/bookings/${booking.id}/voucher`, "POST", { code });
      onUpdated(updated);
      setVoucherCodeInput("");
      setShowVouchers(false);
      setMessage(t("trip.hotels.voucherApplied", { code }));
    } catch (error) {
      setMessage(getSafeErrorMessage(error, t("trip.hotels.failed")));
    } finally {
      setApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = async () => {
    if (applyingVoucher) return;
    try {
      setApplyingVoucher(true);
      setMessage("");
      const updated = await hotelApi<HotelBooking>(`/bookings/${booking.id}/voucher`, "DELETE");
      onUpdated(updated);
    } catch (error) {
      setMessage(getSafeErrorMessage(error, t("trip.hotels.failed")));
    } finally {
      setApplyingVoucher(false);
    }
  };

  async function submit(outcome: "SUCCESS" | "FAILURE" | "EXPIRED" | "PROPERTY" | "PAYOS") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (outcome === "PAYOS") {
        const result = await hotelApi<PayOsPaymentResult>(`/bookings/${booking.id}/payos-payment`, "POST");
        if (result.payment?.checkoutUrl && result.payment.checkoutUrl.startsWith("https://")) {
          window.location.assign(result.payment.checkoutUrl);
        } else {
          setMessage(t("trip.commerce.payosProcessing", { defaultValue: "Đang tạo liên kết thanh toán..." }));
          onUpdated(result.booking);
        }
      } else if (outcome === "PROPERTY") {
        onUpdated(await hotelApi<HotelBooking>(`/bookings/${booking.id}/confirm`, "POST"));
      } else {
        const identity = `${booking.id}:${outcome}`;
        const key = attempts.current.get(identity) ?? crypto.randomUUID();
        attempts.current.set(identity, key);
        const result = await hotelApi<{ booking: HotelBooking; outcome: string }>(
          `/bookings/${booking.id}/demo-payment`,
          "POST",
          { outcome },
          key
        );
        setMessage(t(`trip.commerce.outcomes.${result.outcome}`));
        onUpdated(result.booking);
      }
    } catch (error) {
      setMessage(getSafeErrorMessage(error, t("trip.hotels.failed")));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const money = (value: number, currency: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "VND" }).format(value);

  const isHeld = booking.status === "HELD";

  if (!isHeld) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              {booking.status === "EXPIRED"
                ? "Đơn giữ phòng trước đó đã hết hạn."
                : booking.status === "CHECKED_OUT"
                ? "Đơn đặt phòng này đã hoàn tất lưu trú."
                : `Đơn phòng này ở trạng thái: ${booking.status}.`}
            </span>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="h-8 w-8 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Vui lòng chọn phòng ở danh sách bên dưới và bấm nút <strong>&quot;Đặt ngay&quot;</strong> để tạo đơn mới và chuyển đến trang thanh toán.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-xs" aria-label={t("trip.hotels.review")}>
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 pb-3">
        <div>
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <span>{t("trip.hotels.review", { defaultValue: "Xác nhận đặt phòng" })}</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Đang giữ chỗ
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {booking.property_name} · {booking.room_name}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="h-8 w-8 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Thời gian:</span> {booking.check_in} → {booking.check_out}
        </p>
        <p>
          <span className="font-medium text-foreground">Số lượng:</span> {booking.quantity} {t("trip.hotels.quantity", { defaultValue: "phòng" })} · {booking.guests} {t("trip.hotels.guests", { defaultValue: "khách" })}
        </p>
      </div>

      {/* Cost Breakdown with Voucher Support */}
      <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm border border-border/50">
        {hasVoucher ? (
          <>
            <div className="flex justify-between text-muted-foreground text-xs">
              <span>{t("trip.hotels.subtotal", { defaultValue: "Tạm tính" })}</span>
              <span>{money(booking.subtotal ?? booking.total, booking.currency)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium text-xs">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span>{t("trip.hotels.voucher", { defaultValue: "Voucher" })} ({booking.voucher_code})</span>
                {booking.status === "HELD" && (
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    disabled={applyingVoucher}
                    className="text-xs text-muted-foreground hover:text-destructive underline ml-1 cursor-pointer"
                  >
                    {t("trip.hotels.removeVoucher", { defaultValue: "Bỏ áp dụng" })}
                  </button>
                )}
              </span>
              <span>-{money(booking.discount_amount || 0, booking.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border/40">
              <span>{t("trip.commerce.gross", { defaultValue: "Tổng thanh toán" })}</span>
              <span className="text-primary">{money(booking.total, booking.currency)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between font-bold text-base">
            <span>{t("trip.commerce.gross", { defaultValue: "Tổng thanh toán" })}</span>
            <span className="text-primary">{money(booking.total, booking.currency)}</span>
          </div>
        )}
      </div>

      {/* Voucher Application Form when HELD */}
      {booking.status === "HELD" && !hasVoucher && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <Input
              placeholder={t("trip.hotels.enterVoucherPlaceholder", { defaultValue: "Nhập mã voucher giảm giá..." })}
              value={voucherCodeInput}
              onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
              maxLength={32}
              className="h-9 text-xs uppercase font-mono"
              disabled={applyingVoucher}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleApplyVoucher()}
              disabled={!voucherCodeInput.trim() || applyingVoucher}
              className="h-9 text-xs font-semibold"
            >
              {applyingVoucher ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("trip.hotels.applyVoucher", { defaultValue: "Áp dụng" })}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadVouchers}
              className="h-9 text-xs text-muted-foreground whitespace-nowrap"
            >
              <Ticket className="h-3.5 w-3.5 mr-1" />
              {showVouchers ? t("trip.hotels.hideVouchers", { defaultValue: "Ẩn voucher" }) : t("trip.hotels.availableVouchers", { defaultValue: "Xem voucher" })}
            </Button>
          </div>

          {showVouchers && (
            <div className="rounded-xl border border-border/80 bg-background/60 p-3 space-y-2 max-h-48 overflow-y-auto">
              {loadingVouchers ? (
                <div className="flex justify-center p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span>{t("common.loading")}</span>
                </div>
              ) : availableVouchers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">{t("trip.hotels.noVouchersAvailable", { defaultValue: "Không có voucher phù hợp" })}</p>
              ) : (
                availableVouchers.map((v) => (
                  <div key={v.code} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 text-xs gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="font-mono text-micro font-bold bg-primary/5 text-primary border-primary/20">
                          {v.code}
                        </Badge>
                        <span className="font-semibold text-foreground">{v.title}</span>
                      </div>
                      {v.description && <p className="text-micro text-muted-foreground line-clamp-1">{v.description}</p>}
                      <p className="text-micro text-muted-foreground">
                        {t("trip.hotels.minOrderRequired", { amount: money(v.min_order_amount, v.currency), defaultValue: `Đơn tối thiểu: ${money(v.min_order_amount, v.currency)}` })}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      onClick={() => handleApplyVoucher(v.code)}
                      disabled={applyingVoucher}
                      className="shrink-0 font-medium"
                    >
                      {t("trip.hotels.useVoucher", { defaultValue: "Dùng" })}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("trip.commerce.cancelUntil", { time: booking.free_cancellation_until ? new Date(booking.free_cancellation_until).toLocaleString() : booking.check_in, defaultValue: `Hủy miễn phí đến: ${booking.check_in}` })}
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {t("trip.hotels.expires", { defaultValue: "Giữ phòng đến:" })} {new Date(booking.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>

      {payos && (
        <div className="rounded-lg bg-background/80 border border-border p-3 text-xs text-muted-foreground">
          {t("trip.commerce.payosNotice", {
            defaultValue: "Bấm nút bên dưới để chuyển trực tiếp sang trang cổng thanh toán PayOS (quét mã VietQR ngân hàng).",
          })}
        </div>
      )}

      {message && <p className="text-xs text-destructive font-medium" role="status">{message}</p>}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {payos ? (
          <Button
            size="lg"
            className="w-full sm:w-auto px-6 py-2.5 rounded-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer flex items-center justify-center gap-2"
            disabled={busy}
            onClick={() => void submit("PAYOS")}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang chuyển đến cổng thanh toán PayOS...</span>
              </>
            ) : (
              <>
                <span>Thanh toán ngay qua PayOS ({money(booking.total, booking.currency)})</span>
                <ExternalLink className="h-4 w-4" />
              </>
            )}
          </Button>
        ) : demo ? (
          <Button disabled={busy} onClick={() => void submit("SUCCESS")}>
            {t("trip.commerce.pay")}
          </Button>
        ) : method === "PAY_AT_PROPERTY" ? (
          <Button disabled={busy} onClick={() => void submit("PROPERTY")}>
            {t("trip.hotels.confirm")} · {t("trip.hotels.payAtProperty")}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{t("trip.needSupportForBooking", { defaultValue: "Cần hỗ trợ về đơn đặt này?" })}</span>
        </button>
      </div>

      <BookingSupportDialog
        booking={booking}
        open={supportOpen}
        onOpenChange={setSupportOpen}
      />
    </section>
  );
}
