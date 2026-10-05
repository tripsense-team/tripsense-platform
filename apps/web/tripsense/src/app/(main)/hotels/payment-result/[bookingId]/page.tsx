"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import type { PayOsPaymentResult } from "@/features/hotels/types";
import { useParams } from "next/navigation";

export default function PaymentResultPage() {
  const { t } = useTranslation();
  const { bookingId } = useParams<{ bookingId: string }>();
  const [result, setResult] = useState<PayOsPaymentResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await hotelApi<PayOsPaymentResult>(`/bookings/${bookingId}/payment`);
      setResult(data);
      setError("");
      return data;
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed")));
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    const poll = async () => {
      const data = await fetchStatus();
      if (cancelled) return;
      const state = data?.payment?.state;
      if (state && !["PAID", "CANCELLED", "EXPIRED", "FAILED"].includes(state) && pollCount.current < 30) {
        pollCount.current++;
        timer.current = setTimeout(poll, 3000);
      }
    };
    void poll();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const money = (value: number, currency: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

  const payment = result?.payment;
  const booking = result?.booking;

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("trip.commerce.paymentResult")}</h1>

      {loading && <p role="status">{t("common.loading")}</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}

      {booking && (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">{booking.property_name} · {booking.room_name}</h2>
          <p>{booking.check_in} → {booking.check_out}</p>
          <p className="font-semibold">{money(booking.total, booking.currency)}</p>
          <p>{t(`trip.hotels.status.${booking.status}`)}</p>
        </section>
      )}

      {payment && (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">{t("trip.commerce.paymentStatus")}</h2>
          <p>{t(`trip.commerce.payosStates.${payment.state}`)}</p>
          {payment.resolution !== "NONE" && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {t(`trip.commerce.payosResolution.${payment.resolution}`)}
            </p>
          )}
          {payment.state === "PENDING" && payment.checkoutUrl && (
            <Button onClick={() => {
              if (payment.checkoutUrl.startsWith("https://")) {
                window.location.href = payment.checkoutUrl;
              }
            }}>
              {t("trip.commerce.payOnline")}
            </Button>
          )}
        </section>
      )}

      <Button variant="outline" onClick={() => void fetchStatus()}>
        {t("common.refresh")}
      </Button>
    </div>
  );
}
