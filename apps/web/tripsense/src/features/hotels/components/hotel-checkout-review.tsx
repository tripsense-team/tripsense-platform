"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import { Tag, Ticket, Loader2, HelpCircle } from "lucide-react";
import { BookingSupportDialog } from "./booking-support-dialog";
import type { HotelBooking, PayOsPaymentResult, VoucherDto } from "../types";

export function HotelCheckoutReview({ booking, onUpdated }: { booking: HotelBooking; onUpdated: (booking: HotelBooking) => void }) {
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
    pending.current = true; setBusy(true); setMessage("");
    try {
      if (outcome === "PAYOS") {
        const result = await hotelApi<PayOsPaymentResult>(`/bookings/${booking.id}/payos-payment`, "POST");
        if (result.payment?.checkoutUrl && result.payment.checkoutUrl.startsWith("https://")) {
          window.location.href = result.payment.checkoutUrl;
        } else {
          setMessage(t("trip.commerce.payosProcessing"));
          onUpdated(result.booking);
        }
      } else if (outcome === "PROPERTY") {
        onUpdated(await hotelApi<HotelBooking>(`/bookings/${booking.id}/confirm`, "POST"));
      } else {
        const identity = `${booking.id}:${outcome}`;
        const key = attempts.current.get(identity) ?? crypto.randomUUID();
        attempts.current.set(identity, key);
        const result = await hotelApi<{ booking: HotelBooking; outcome: string }>(`/bookings/${booking.id}/demo-payment`, "POST", { outcome }, key);
        setMessage(t(`trip.commerce.outcomes.${result.outcome}`));
        onUpdated(result.booking);
      }
    } catch (error) {
      setMessage(getSafeErrorMessage(error, t("trip.hotels.failed")));
    } finally { pending.current = false; setBusy(false); }
  }

  const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

  return <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={t("trip.hotels.review")}>
    <h3 className="font-semibold">{t("trip.hotels.review")}</h3>
    <p>{booking.property_name} · {booking.room_name}</p>
    <p>{booking.check_in} → {booking.check_out} · {booking.quantity} {t("trip.hotels.quantity")} · {booking.guests} {t("trip.hotels.guests")}</p>

    {/* Cost Breakdown */}
    <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm border border-border/50">
      {hasVoucher ? (
        <>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>{t("trip.hotels.subtotal")}</span>
            <span>{money(booking.subtotal ?? booking.total, booking.currency)}</span>
          </div>
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium text-xs">
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.voucher")} ({booking.voucher_code})</span>
              {booking.status === "HELD" && (
                <button
                  type="button"
                  onClick={handleRemoveVoucher}
                  disabled={applyingVoucher}
                  className="text-xs text-muted-foreground hover:text-destructive underline ml-1 cursor-pointer"
                >
                  {t("trip.hotels.removeVoucher")}
                </button>
              )}
            </span>
            <span>-{money(booking.discount_amount || 0, booking.currency)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1.5 border-t border-border/40">
            <span>{t("trip.commerce.gross")}</span>
            <span className="text-primary">{money(booking.total, booking.currency)}</span>
          </div>
        </>
      ) : (
        <div className="flex justify-between font-bold text-base">
          <span>{t("trip.commerce.gross")}</span>
          <span className="text-primary">{money(booking.total, booking.currency)}</span>
        </div>
      )}
    </div>

    {/* Voucher Application Form when HELD */}
    {booking.status === "HELD" && !hasVoucher && (
      <div className="space-y-2 pt-1">
        <div className="flex gap-2">
          <Input
            placeholder={t("trip.hotels.enterVoucherPlaceholder")}
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
            {applyingVoucher ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("trip.hotels.applyVoucher")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadVouchers}
            className="h-9 text-xs text-muted-foreground whitespace-nowrap"
          >
            <Ticket className="h-3.5 w-3.5 mr-1" />
            {showVouchers ? t("trip.hotels.hideVouchers") : t("trip.hotels.availableVouchers")}
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
              <p className="text-xs text-muted-foreground text-center py-2">{t("trip.hotels.noVouchersAvailable")}</p>
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
                      {t("trip.hotels.minOrderRequired", { amount: money(v.min_order_amount, v.currency) })}
                    </p>
                  </div>
                  <Button
                    size="xs"
                    onClick={() => handleApplyVoucher(v.code)}
                    disabled={applyingVoucher}
                    className="shrink-0 font-medium"
                  >
                    {t("trip.hotels.useVoucher")}
                  </Button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    )}

    <p>{t("trip.commerce.cancelUntil", { time: booking.free_cancellation_until ? new Date(booking.free_cancellation_until).toLocaleString() : booking.check_in })}</p>
    <p>{t("trip.hotels.expires")} {new Date(booking.expires_at).toLocaleString()}</p>
    {demo && <p className="rounded-lg bg-muted p-3 text-sm">{t("trip.commerce.notice")}</p>}
    {payos && <p className="rounded-lg bg-muted p-3 text-sm">{t("trip.commerce.payosNotice")}</p>}
    {message && <p role="status" className="text-xs text-primary font-medium">{message}</p>}
    {booking.status === "HELD" && <div className="flex flex-wrap gap-2">
      {payos ? (
        <Button disabled={busy} onClick={() => void submit("PAYOS")}>{t("trip.commerce.payOnline")}</Button>
      ) : demo ? (
        <Button disabled={busy} onClick={() => void submit("SUCCESS")}>{t("trip.commerce.pay")}</Button>
      ) : method === "PAY_AT_PROPERTY" ? (
        <Button disabled={busy} onClick={() => void submit("PROPERTY")}>{t("trip.hotels.confirm")} · {t("trip.hotels.payAtProperty")}</Button>
      ) : null}
    </div>}

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
  </section>;
}
