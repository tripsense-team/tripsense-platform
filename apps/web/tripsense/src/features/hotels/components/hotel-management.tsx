"use client";

import Link from "next/link";
import { getBusinessApplications, getPartnerContext } from "@/features/partner/services/partner-api";
import type { BusinessDetailDto } from "@/features/partner/types";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "../services/hotels-api";
import type { HotelProperty, HotelRoom, HotelInventory, HotelBooking } from "../types";

export function HotelManagement({ admin = false }: { admin?: boolean }) {
  const { t } = useTranslation();
  const [businesses,setBusinesses] = useState<BusinessDetailDto[]>([]);
  const [businessId,setBusinessId] = useState("");
  const [cancelReason,setCancelReason] = useState("");
  const [properties, setProperties] = useState<HotelProperty[]>([]);
  const [selected, setSelected] = useState<HotelProperty | null>(null);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [inventory, setInventory] = useState<HotelInventory[]>([]);
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  async function act(work: () => Promise<void>) { if (busy) return; setBusy(true); setError(""); try { await work(); } catch (e) { setError(getSafeErrorMessage(e, t("trip.hotels.failed"))); } finally { setBusy(false); } }
  const refresh = async () => { setProperties(await hotelApi<HotelProperty[]>(admin ? "/admin/properties" : "/properties")); if(!admin) { const eligible=(await getPartnerContext()).businesses.filter(b=>b.kind === "HOTEL" && b.approvalValidity === "VALID" && b.operationState === "ACTIVE" && !b.requiresReverification && b.myRole === "OWNER" && b.capabilities?.includes("HOTEL_INVENTORY")); setBusinesses(eligible); setBusinessId(prev=>eligible.some(b=>b.id===prev)?prev:eligible[0]?.id ?? ""); } };
  useEffect(() => { refresh().catch(e => setError(getSafeErrorMessage(e, t("trip.hotels.failed")))); }, [admin]);
  const text = (data: FormData, key: string) => String(data.get(key) ?? "");
  const field = (name: string, type = "text", value = "", min?: number, max?: number, readOnly = false) => <label className="space-y-1 text-sm" key={name}>{t(`trip.hotels.${name}`)}<Input name={name} type={type} required defaultValue={value} readOnly={readOnly} min={min} max={max} maxLength={name === "address" ? 500 : 160} step={type === "number" ? "1" : undefined} /></label>;
  const approvedBusiness=businesses.find(b=>b.id===businessId);
  const approvedProfile=approvedBusiness?.draftProfile ?? {};
  const profileText=(key:string)=>String(approvedProfile[key] ?? "");
  return <section className="space-y-5">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button variant="outline" disabled={busy} onClick={() => void act(refresh)}>{t("common.refresh")}</Button>
    {!admin && !selected && <form key={`new-${formVersion}-${businessId}`} className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(async () => {
      await hotelApi("/properties", "POST", Object.fromEntries(["name", "destination", "address", "timeZone", "checkInTime", "checkOutTime", "businessId"].map(key => [key, text(data, key)])));
      setSelected(null); setRooms([]); setInventory([]); setBookings([]); setFormVersion(v => v + 1); await refresh();
    }); }}>
      <h2 className="font-semibold sm:col-span-2">{t("trip.hotels.register")}</h2>
      <label>{t("trip.commerce.business")}<select name="businessId" required value={businessId} onChange={e=>setBusinessId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background"><option value="" disabled>{t("trip.commerce.chooseBusiness")}</option>{businesses.map(b=><option key={b.id} value={b.id}>{b.displayName}</option>)}</select></label>
      {field("name","text",approvedBusiness?.displayName ?? "",undefined,undefined,true)}{field("destination","text",profileText("destination"),undefined,undefined,true)}{field("address","text",profileText("address"),undefined,undefined,true)}{field("timeZone", "text", "Asia/Ho_Chi_Minh")}{field("checkInTime", "time", "14:00")}{field("checkOutTime", "time", "11:00")}
      <Button disabled={busy || !businessId || !profileText("destination") || !profileText("address")} type="submit">{t("common.save")}</Button><Button type="button" variant="outline" onClick={() => { setSelected(null); setRooms([]); setInventory([]); setBookings([]); }}>{t("trip.hotels.newProperty")}</Button>
      <p className="text-sm text-muted-foreground sm:col-span-2">{t("trip.hotels.verificationNote")}</p>
    </form>}
    {properties.map(p => <article key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
      <div className="flex-1"><h3 className="font-semibold">{p.name}</h3><p>{p.destination} · {t(`trip.hotels.status.${p.status}`)}</p></div>
      {admin ? <Link href="/admin/partners" className="text-primary underline">{t("trip.commerce.partnerReview")}</Link> : <Button disabled={busy} onClick={() => void act(async () => { setSelected(p); setInventory([]); const [r, b] = await Promise.all([hotelApi<HotelRoom[]>(`/properties/${p.id}/rooms`), hotelApi<HotelBooking[]>(`/properties/${p.id}/bookings`)]); setRooms(r); setBookings(b); })}>{t("trip.hotels.manage")}</Button>}
      {!admin && businesses.some(b=>b.id===p.business_id) && <Button variant="outline" disabled={busy} onClick={() => void act(async () => {
        const business=businesses.find(b=>b.id===p.business_id)!;
        const revision=(await getBusinessApplications(business.id)).find(a=>a.id===business.approvedRevisionId);
        const snapshot=revision?.profileSnapshot;
        if (!snapshot?.destination || !snapshot?.address) throw new Error("Approved profile unavailable");
        await hotelApi(`/properties/${p.id}`,"PUT",{businessId:business.id,name:business.displayName,destination:String(snapshot.destination),address:String(snapshot.address),timeZone:p.time_zone,checkInTime:p.check_in_time,checkOutTime:p.check_out_time});
        await refresh();
      })}>{t("trip.hotels.syncApproved")}</Button>}
    </article>)}
    {!admin && selected && <div className="space-y-4">
      <h2 className="font-semibold">{selected.name}</h2><Button variant="outline" onClick={()=>setSelected(null)}>{t("trip.hotels.newProperty")}</Button>
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
      <label className="block text-sm">{t("trip.hotels.cancelReason")}<Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} maxLength={500} /></label>
      {bookings.map(b => <div key={`actions-${b.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
        <span className="text-xs">{b.id} · {t(`trip.hotels.status.${b.status}`)}</span>
        {b.status === "CONFIRMED" && <Button disabled={busy} onClick={() => void act(async () => { await hotelApi(`/bookings/${b.id}/check-in`, "POST", { expectedVersion: b.version }); setBookings(await hotelApi<HotelBooking[]>(`/properties/${selected.id}/bookings`)); })}>{t("trip.hotels.checkInAction")}</Button>}
        {b.status === "CHECKED_IN" && <Button disabled={busy} onClick={() => void act(async () => { await hotelApi(`/bookings/${b.id}/check-out`, "POST", { expectedVersion: b.version }); setBookings(await hotelApi<HotelBooking[]>(`/properties/${selected.id}/bookings`)); })}>{t("trip.hotels.checkOutAction")}</Button>}
        {b.status === "CONFIRMED" && <Button variant="outline" disabled={busy} onClick={() => void act(async () => { await hotelApi(`/bookings/${b.id}/no-show`, "POST", { expectedVersion: b.version }); setBookings(await hotelApi<HotelBooking[]>(`/properties/${selected.id}/bookings`)); })}>{t("trip.hotels.noShowAction")}</Button>}
        {["HELD", "CONFIRMED"].includes(b.status) && <Button variant="destructive" disabled={busy || !cancelReason.trim()} onClick={() => void act(async () => { await hotelApi(`/bookings/${b.id}/cancel`, "POST", { expectedVersion: b.version, reason: cancelReason.trim() }); setCancelReason(""); setBookings(await hotelApi<HotelBooking[]>(`/properties/${selected.id}/bookings`)); })}>{t("trip.hotels.cancelByProperty")}</Button>}
      </div>)}
    </div>}
  </section>;
}
