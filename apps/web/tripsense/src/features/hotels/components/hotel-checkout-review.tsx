"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import type { HotelBooking, PayOsPaymentResult } from "../types";
import { Loader2, AlertCircle, X, ExternalLink } from "lucide-react";

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
  const pending = useRef(false);
  const attempts = useRef(new Map<string, string>());

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
          Vui lòng chọn phòng ở danh sách bên dưới và bấm nút <strong>"Đặt ngay"</strong> để tạo đơn mới và chuyển đến trang thanh toán.
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
        <p>
          <span className="font-medium text-foreground">Tổng tiền:</span>{" "}
          <strong className="text-base text-foreground">{money(booking.total, booking.currency)}</strong>
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("trip.hotels.expires", { defaultValue: "Giữ phòng đến:" })} {new Date(booking.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

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
    </section>
  );
}
