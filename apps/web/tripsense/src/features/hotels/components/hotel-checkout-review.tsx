"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import type { HotelBooking, PayOsPaymentResult } from "../types";

export function HotelCheckoutReview({ booking, onUpdated }: { booking: HotelBooking; onUpdated: (booking: HotelBooking) => void }) {
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
    <p className="font-semibold">{money(booking.total, booking.currency)}</p>
    <p>{t("trip.commerce.cancelUntil", { time: booking.free_cancellation_until ? new Date(booking.free_cancellation_until).toLocaleString() : booking.check_in })}</p>
    <p>{t("trip.hotels.expires")} {new Date(booking.expires_at).toLocaleString()}</p>
    {demo && <p className="rounded-lg bg-muted p-3 text-sm">{t("trip.commerce.notice")}</p>}
    {payos && <p className="rounded-lg bg-muted p-3 text-sm">{t("trip.commerce.payosNotice")}</p>}
    {message && <p role="status">{message}</p>}
    {booking.status === "HELD" && <div className="flex flex-wrap gap-2">
      {payos ? (
        <Button disabled={busy} onClick={() => void submit("PAYOS")}>{t("trip.commerce.payOnline")}</Button>
      ) : demo ? (
        <Button disabled={busy} onClick={() => void submit("SUCCESS")}>{t("trip.commerce.pay")}</Button>
      ) : method === "PAY_AT_PROPERTY" ? (
        <Button disabled={busy} onClick={() => void submit("PROPERTY")}>{t("trip.hotels.confirm")} · {t("trip.hotels.payAtProperty")}</Button>
      ) : null}
    </div>}
  </section>;
}
