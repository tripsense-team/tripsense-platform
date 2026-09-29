"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import type { HotelProperty, HotelRoom, HotelInventory, HotelBooking } from "../types";

export function HotelManagement({ admin = false }: { admin?: boolean }) {
  const { t } = useTranslation();
  const [properties, setProperties] = useState<HotelProperty[]>([]);
  const [selected, setSelected] = useState<HotelProperty | null>(null);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [inventory, setInventory] = useState<HotelInventory[]>([]);
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  async function act(work: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await work(); } catch (e) { setError(getSafeErrorMessage(e, t("trip.hotels.failed"))); } finally { setBusy(false); } }
  const refresh = async () => setProperties(await hotelApi<HotelProperty[]>(admin ? "/admin/properties" : "/properties"));
  const text = (data: FormData, key: string) => String(data.get(key) ?? "");
  const field = (name: string, type = "text", value = "", min?: number, max?: number) => <label className="space-y-1 text-sm" key={name}>{t(`trip.hotels.${name}`)}<Input name={name} type={type} required defaultValue={value} min={min} max={max} maxLength={name === "address" ? 500 : 160} step={type === "number" ? "1" : undefined} /></label>;
  return <section className="space-y-5">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button variant="outline" disabled={busy} onClick={() => void act(refresh)}>{t("common.refresh")}</Button>
    {!admin && <form key={`${selected?.id ?? "new"}-${formVersion}`} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(async () => {
      await hotelApi(selected ? `/properties/${selected.id}` : "/properties", selected ? "PUT" : "POST", Object.fromEntries(["name", "destination", "address", "timeZone", "checkInTime", "checkOutTime"].map(key => [key, text(data, key)])));
      setSelected(null); setRooms([]); setInventory([]); setBookings([]); setFormVersion(v => v + 1); await refresh();
    }); }}>
      <h2 className="font-semibold sm:col-span-2">{t(selected ? "trip.hotels.editProperty" : "trip.hotels.register")}</h2>
      {field("name", "text", selected?.name)}{field("destination", "text", selected?.destination)}{field("address", "text", selected?.address)}{field("timeZone", "text", selected?.time_zone ?? "Asia/Ho_Chi_Minh")}{field("checkInTime", "time", selected?.check_in_time ?? "14:00")}{field("checkOutTime", "time", selected?.check_out_time ?? "11:00")}
      <Button disabled={busy} type="submit">{t("common.save")}</Button><Button type="button" variant="outline" onClick={() => { setSelected(null); setRooms([]); setInventory([]); setBookings([]); }}>{t("trip.hotels.newProperty")}</Button>
      <p className="text-sm text-muted-foreground sm:col-span-2">{t("trip.hotels.verificationNote")}</p>
    </form>}
    {properties.map(p => <article key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
      <div className="flex-1"><h3 className="font-semibold">{p.name}</h3><p>{p.destination} · {t(`trip.hotels.status.${p.status}`)}</p></div>
      {admin ? ["ACTIVE", "REJECTED", "SUSPENDED"].map(status => <Button disabled={busy || p.status === status} key={status} variant="outline" onClick={() => void act(async () => { await hotelApi(`/properties/${p.id}/status`, "POST", { status }); await refresh(); })}>{t(`trip.hotels.status.${status}`)}</Button>) : <Button disabled={busy} onClick={() => void act(async () => { setSelected(p); setInventory([]); const [r, b] = await Promise.all([hotelApi<HotelRoom[]>(`/properties/${p.id}/rooms`), hotelApi<HotelBooking[]>(`/properties/${p.id}/bookings`)]); setRooms(r); setBookings(b); })}>{t("trip.hotels.manage")}</Button>}
    </article>)}
    {!admin && selected && <div className="space-y-4">
      <h2 className="font-semibold">{selected.name}</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(async () => { await hotelApi(`/properties/${selected.id}/rooms`, "POST", { name: text(data, "roomName"), capacity: Number(data.get("capacity")) }); setRooms(await hotelApi<HotelRoom[]>(`/properties/${selected.id}/rooms`)); }); }}>{field("roomName")}{field("capacity", "number", "2", 1, 20)}<Button disabled={busy}>{t("trip.hotels.addRoom")}</Button></form>
      {rooms.length > 0 && <form className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(async () => {
        const room = text(data, "room"); const from = text(data, "from"); const to = text(data, "to");
        await hotelApi(`/properties/${selected.id}/rooms/${room}/inventory`, "PUT", { from, to, allocation: Number(data.get("allocation")), nightlyPrice: Number(data.get("nightlyPrice")), stopSell: data.get("stopSell") === "on" });
        setInventory(await hotelApi<HotelInventory[]>(`/properties/${selected.id}/rooms/${room}/inventory?${new URLSearchParams({ from, to })}`));
      }); }}>
        <label>{t("trip.hotels.roomName")}<select name="room" className="h-10 w-full rounded-md border border-input bg-background px-3">{rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity})</option>)}</select></label>
        {field("from", "date")}{field("to", "date")}{field("allocation", "number", "1", 0, 10000)}{field("nightlyPrice", "number", "500000", 1)}
        <label className="flex items-center gap-2"><input type="checkbox" name="stopSell" />{t("trip.hotels.stopSell")}</label>
        <Button disabled={busy}>{t("common.save")}</Button><p className="text-sm text-muted-foreground sm:col-span-3">{t("trip.hotels.allocationNote")}</p>
      </form>}
      {inventory.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["from", "allocation", "held", "booked", "nightlyPrice"].map(k => <th className="p-2 text-left" key={k}>{t(`trip.hotels.${k}`)}</th>)}</tr></thead><tbody>{inventory.map(day => <tr key={day.stay_date}><td className="p-2">{day.stay_date}</td><td>{day.allocation}</td><td>{day.held}</td><td>{day.booked}</td><td>{day.nightly_price}</td></tr>)}</tbody></table></div>}
      <h3 className="font-semibold">{t("trip.hotels.reservations")}</h3>{bookings.map(b => <p key={b.id}>{b.check_in} → {b.check_out} · {b.quantity} {t("trip.hotels.quantity")} · {t(`trip.hotels.status.${b.status}`)} · {b.id}</p>)}
    </div>}
  </section>;
}
