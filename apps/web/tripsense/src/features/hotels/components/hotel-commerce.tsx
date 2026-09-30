"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { isUserAdmin } from "@/features/auth/utils/role-helpers";

interface Statement {
  booking_id: string; property_name: string; room_name: string; booking_status: string;
  amount: number; commission_amount: number; partner_amount: number; currency: string;
  payment_state: string; settlement_state: string;
}

export function HotelCommerce() {
  const { t } = useTranslation();
  const admin = useAuthStore(s => isUserAdmin(s.user));
  const [rows, setRows] = useState<Statement[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const keys = useRef(new Map<string, string>());
  const refresh = useCallback(async () => setRows(await hotelApi<Statement[]>("/commerce")), []);
  useEffect(() => { refresh().catch(e => setError(getSafeErrorMessage(e))); }, [refresh]);
  async function act(id?: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      if (id) {
        const key = keys.current.get(id) ?? crypto.randomUUID(); keys.current.set(id, key);
        await hotelApi(`/bookings/${id}/demo-settlement`, "POST", undefined, key);
      }
      await refresh();
    } catch (e) { setError(getSafeErrorMessage(e, t("trip.hotels.failed"))); }
    finally { pending.current = false; setBusy(false); }
  }
  const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">{t("trip.commerce.title")}</h2>
    <p className="rounded-xl bg-muted p-4">{t("trip.commerce.notice")}</p>
    <Button variant="outline" disabled={busy} onClick={() => void act()}>{t("common.refresh")}</Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {rows.length === 0 && <p>{t("trip.commerce.empty")}</p>}
    {rows.map(row => <article key={row.booking_id} className="space-y-2 rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold">{row.property_name} · {row.room_name}</h3>
      <p className="text-xs text-muted-foreground">{row.booking_id}</p>
      <dl className="grid gap-2 sm:grid-cols-3">
        <div><dt>{t("trip.commerce.gross")}</dt><dd>{money(row.amount, row.currency)}</dd></div>
        <div><dt>{t("trip.commerce.commission")}</dt><dd>{money(row.commission_amount, row.currency)}</dd></div>
        <div><dt>{t("trip.commerce.partnerNet")}</dt><dd>{money(row.partner_amount, row.currency)}</dd></div>
      </dl>
      <p>{t(`trip.commerce.states.${row.settlement_state}`)}</p>
      {admin && row.settlement_state === "ELIGIBLE" && <Button disabled={busy} onClick={() => void act(row.booking_id)}>{t("trip.commerce.settle")}</Button>}
    </article>)}
  </section>;
}
