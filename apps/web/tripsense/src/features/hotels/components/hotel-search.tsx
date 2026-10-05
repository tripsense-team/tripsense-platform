"use client";

import { HotelCheckoutReview } from "./hotel-checkout-review";
import { bookingIntentKey, clearBookingIntent } from "../services/hotel-service-adapter";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import type { HotelBooking, HotelCriteria, HotelOffer } from "../types";

export function HotelSearch() {
  const { t } = useTranslation();
  const actorId=useAuthStore(s=>s.user?.id ?? "anonymous");
  const [criteria, setCriteria] = useState<HotelCriteria>({ destination: "", checkIn: "", checkOut: "", guests: 2, quantity: 1 });
  const [offers, setOffers] = useState<HotelOffer[] | null>(null);
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [review, setReview] = useState<HotelBooking | null>(null);
  const [cancel, setCancel] = useState<HotelBooking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const pending = useRef(false);
  const keys = useRef(new Map<string, string>());
  const change = (name: keyof HotelCriteria, value: string) => {
    generation.current++; setOffers(null);
    setCriteria(prev => ({ ...prev, [name]: name === "guests" || name === "quantity" ? Number(value) : value }));
  };
  async function act(work: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await work(); } catch (e) { setError(getSafeErrorMessage(e, t("trip.hotels.failed"))); }
    finally { pending.current = false; setBusy(false); }
  }
  const refresh = async () => setBookings(await hotelApi<HotelBooking[]>("/bookings"));
  useEffect(() => { hotelApi<HotelBooking[]>("/bookings").then(setBookings).catch(e => setError(getSafeErrorMessage(e, t("trip.hotels.failed")))); }, [t]);
  const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  return <section className="space-y-5">
    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" onSubmit={e => { e.preventDefault(); const current = ++generation.current; void act(async () => {
      const query = new URLSearchParams(Object.entries(criteria).map(([key, value]) => [key, String(value)]));
      const data = await hotelApi<HotelOffer[]>(`/search?${query}`); if (current === generation.current) setOffers(data);
    }); }}>
      {(["destination", "checkIn", "checkOut", "guests", "quantity"] as const).map(name => <label key={name} className="space-y-1 text-sm">{t(`trip.hotels.${name}`)}<Input required type={name === "destination" ? "text" : name === "guests" || name === "quantity" ? "number" : "date"} min={name === "guests" || name === "quantity" ? 1 : undefined} max={name === "quantity" ? 10 : name === "guests" ? 200 : undefined} maxLength={name === "destination" ? 120 : undefined} value={criteria[name]} onChange={e => change(name, e.target.value)} /></label>)}
      <Button disabled={busy} type="submit">{t("common.search")}</Button>
    </form>
    <p className="text-sm text-muted-foreground">{t("trip.hotels.policy")}</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {busy && <p role="status">{t("common.loading")}</p>}
    {offers?.length === 0 && <p>{t("trip.hotels.empty")}</p>}
    <div className="grid gap-4 md:grid-cols-2">{offers?.map(offer => <article key={offer.room_type_id} className="space-y-2 rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold">{offer.name}</h3><p>{offer.room_name} · {offer.destination}</p>
      <p>{money(offer.total, offer.currency)} · {t("trip.hotels.totalStay")}</p>
      <Button disabled={busy} onClick={() => void act(async () => {
        const body = { roomTypeId: offer.room_type_id, checkIn: criteria.checkIn, checkOut: criteria.checkOut, guests: criteria.guests, quantity: criteria.quantity };
        const signature = JSON.stringify(body); const key = keys.current.get(signature) ?? bookingIntentKey(actorId,body); keys.current.set(signature, key);
        const held = await hotelApi<HotelBooking>("/holds", "POST", body, key);
        if (held.status === "HELD") setReview(held);
        else { keys.current.delete(signature); await refresh(); setOffers(null); }
      })}>{t("trip.hotels.hold")}</Button>
    </article>)}</div>
    {review && <HotelCheckoutReview key={review.id} booking={review} onUpdated={b=>{
      if (["CONFIRMED","CANCELLED","EXPIRED"].includes(b.status)) {
        const intent={roomTypeId:b.room_type_id,checkIn:b.check_in,checkOut:b.check_out,guests:b.guests,quantity:b.quantity};
        clearBookingIntent(actorId,intent); keys.current.delete(JSON.stringify(intent));
      }
      setReview(b); void refresh();
    }} />}
    <div className="flex items-center justify-between"><h2 className="font-semibold">{t("trip.hotels.myBookings")}</h2><Button variant="outline" disabled={busy} onClick={() => void act(refresh)}>{t("common.refresh")}</Button></div>
    {bookings.map(b => <article key={b.id} className="space-y-2 rounded-lg border border-border p-3">
      <h3 className="font-semibold">{b.property_name} · {b.room_name}</h3>
      <p>{b.check_in} → {b.check_out} · {money(b.total, b.currency)}</p><p>{t(`trip.hotels.status.${b.status}`)}</p>
      <p className="text-xs text-muted-foreground">{b.id}</p>
      {b.status === "HELD" && <Button disabled={busy} onClick={() => setReview(b)}>{t("trip.hotels.review")}</Button>}
      {["HELD", "CONFIRMED"].includes(b.status) && <Button variant="outline" disabled={busy} onClick={() => setCancel(b)}>{t("common.cancel")}</Button>}
    </article>)}
    <ConfirmationDialog open={!!cancel} onOpenChange={open => { if (!open) setCancel(null); }} title={t("trip.hotels.cancelTitle")} description={t("trip.hotels.cancelDescription")} confirmText={t("common.confirm")} cancelText={t("common.cancel")} onConfirm={async () => { if (!cancel) return; await act(async () => { await hotelApi(`/bookings/${cancel.id}/cancel`, "POST"); if (review?.id === cancel.id) setReview(null); setCancel(null); await refresh(); }); }} />
  </section>;
}
