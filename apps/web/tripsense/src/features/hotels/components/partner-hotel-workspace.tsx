"use client";

import { useEffect, useState, useCallback, useId } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { getBusinessApplications, getPartnerContext } from "@/features/partner/services/partner-api";
import type { BusinessDetailDto } from "@/features/partner/types";
import { hotelApi } from "../services/hotels-api";
import { HotelCommerce } from "./hotel-commerce";
import type { HotelProperty, HotelRoom, HotelInventory, HotelBooking } from "../types";
import {
  Building2,
  BedDouble,
  CalendarDays,
  Users,
  DollarSign,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
} from "lucide-react";

type PartnerTab = "properties" | "inventory" | "guests" | "commerce";

export function PartnerHotelWorkspace({ onBackToStays }: { onBackToStays?: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PartnerTab>("properties");
  const [businesses, setBusinesses] = useState<BusinessDetailDto[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [properties, setProperties] = useState<HotelProperty[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<HotelProperty | null>(null);
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [inventory, setInventory] = useState<HotelInventory[]>([]);
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");

  const newPropertyFormId = useId();

  const loadContext = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [props, partnerCtx] = await Promise.all([
        hotelApi<HotelProperty[]>("/properties"),
        getPartnerContext().catch(() => ({ businesses: [] })),
      ]);
      setProperties(props);
      const eligible = partnerCtx.businesses.filter(
        (b) =>
          b.kind === "HOTEL" &&
          b.approvalValidity === "VALID" &&
          b.operationState === "ACTIVE" &&
          !b.requiresReverification &&
          b.myRole === "OWNER" &&
          b.capabilities?.includes("HOTEL_INVENTORY")
      );
      setBusinesses(eligible);
      if (eligible.length > 0) {
        setBusinessId((prev) => (eligible.some((b) => b.id === prev) ? prev : eligible[0].id));
      }
      if (props.length > 0 && !selectedProperty) {
        setSelectedProperty(props[0]);
      }
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  }, [selectedProperty, t]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  // Load rooms and bookings when selected property changes
  useEffect(() => {
    if (!selectedProperty) {
      setRooms([]);
      setBookings([]);
      return;
    }
    let cancelled = false;
    async function loadPropertyDetails() {
      try {
        const [r, b] = await Promise.all([
          hotelApi<HotelRoom[]>(`/properties/${selectedProperty!.id}/rooms`),
          hotelApi<HotelBooking[]>(`/properties/${selectedProperty!.id}/bookings`),
        ]);
        if (!cancelled) {
          setRooms(r);
          setBookings(b);
        }
      } catch (e) {
        if (!cancelled) setError(getSafeErrorMessage(e));
      }
    }
    void loadPropertyDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedProperty]);

  const approvedBusiness = businesses.find((b) => b.id === businessId);
  const approvedProfile = approvedBusiness?.draftProfile ?? {};
  const profileText = (key: string) => String(approvedProfile[key] ?? "");

  const handleSelectProperty = (p: HotelProperty) => {
    setSelectedProperty(p);
    setInventory([]);
  };

  const handleSyncProfile = async (p: HotelProperty) => {
    const business = businesses.find((b) => b.id === p.business_id);
    if (!business) return;
    setBusy(true);
    setError("");
    try {
      const apps = await getBusinessApplications(business.id);
      const revision = apps.find((a) => a.id === business.approvedRevisionId);
      const snapshot = revision?.profileSnapshot;
      if (!snapshot?.destination || !snapshot?.address) {
        throw new Error("Approved profile snapshot is incomplete");
      }
      await hotelApi(`/properties/${p.id}`, "PUT", {
        businessId: business.id,
        name: business.displayName,
        destination: String(snapshot.destination),
        address: String(snapshot.address),
        timeZone: p.time_zone,
        checkInTime: p.check_in_time,
        checkOutTime: p.check_out_time,
      });
      await loadContext();
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  const handleAddRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProperty || busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSuccessMessage("");
    try {
      await hotelApi(`/properties/${selectedProperty.id}/rooms`, "POST", {
        name: String(data.get("roomName")),
        capacity: Number(data.get("capacity")),
        nightlyPrice: Number(data.get("nightlyPrice") || 500000),
        allocation: Number(data.get("allocation") || 5),
      });
      form.reset();
      setSuccessMessage(t("trip.hotels.roomCreatedSuccess", { defaultValue: "Đã tạo loại phòng và mở bán 90 ngày thành công!" }));
      const updatedRooms = await hotelApi<HotelRoom[]>(`/properties/${selectedProperty.id}/rooms`);
      setRooms(updatedRooms);
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateInventory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedProperty || busy) return;
    const data = new FormData(e.currentTarget);
    const roomId = String(data.get("room"));
    const from = String(data.get("from"));
    const to = String(data.get("to"));
    setBusy(true);
    setError("");
    try {
      await hotelApi(`/properties/${selectedProperty.id}/rooms/${roomId}/inventory`, "PUT", {
        from,
        to,
        allocation: Number(data.get("allocation")),
        nightlyPrice: Number(data.get("nightlyPrice")),
        stopSell: data.get("stopSell") === "on",
      });
      const query = new URLSearchParams({ from, to });
      const updatedInv = await hotelApi<HotelInventory[]>(
        `/properties/${selectedProperty.id}/rooms/${roomId}/inventory?${query}`
      );
      setInventory(updatedInv);
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  const handlePropertyCancel = async (b: HotelBooking) => {
    if (!selectedProperty || !cancelReason.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await hotelApi(`/bookings/${b.id}/cancel`, "POST", {
        expectedVersion: b.version,
        reason: cancelReason.trim(),
      });
      setCancelReason("");
      setCancelTargetId(null);
      const updatedBookings = await hotelApi<HotelBooking[]>(`/properties/${selectedProperty.id}/bookings`);
      setBookings(updatedBookings);
    } catch (err) {
      setError(getSafeErrorMessage(err, t("trip.hotels.failed")));
    } finally {
      setBusy(false);
    }
  };

  const money = (val: number, cur: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "VND" }).format(val);

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-muted/60 border border-border p-4 md:p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 border border-primary/20">
              <Building2 className="h-3 w-3" />
              <span>{t("trip.hotels.partnerBadge", { defaultValue: "Kênh Đối tác khách sạn" })}</span>
            </span>
            {approvedBusiness && (
              <span className="text-xs text-muted-foreground font-medium">
                · {approvedBusiness.displayName}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {t("trip.hotels.partnerWorkspaceTitle", { defaultValue: "Bảng điều khiển quản lý khách sạn" })}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void loadContext()} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            <span>{t("common.refresh", { defaultValue: "Làm mới" })}</span>
          </Button>

          {onBackToStays && (
            <Button variant="secondary" size="sm" onClick={onBackToStays} className="gap-1.5 shadow-2xs">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.backToStays", { defaultValue: "Xem trang tìm phòng" })}</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        {[
          { key: "properties", label: t("trip.hotels.tabProperties", { defaultValue: "Cơ sở & Loại phòng" }), icon: Building2 },
          { key: "inventory", label: t("trip.hotels.tabInventory", { defaultValue: "Lịch phòng & Giá" }), icon: CalendarDays },
          { key: "guests", label: t("trip.hotels.tabGuests", { defaultValue: "Quản lý khách lưu trú" }), icon: Users, badge: bookings.length },
          { key: "commerce", label: t("trip.hotels.tabCommerce", { defaultValue: "Quyết toán doanh thu" }), icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as PartnerTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-micro px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROPERTIES & ROOM TYPES */}
      {activeTab === "properties" && (
        <div className="space-y-6">
          {/* Properties List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground">
              {t("trip.hotels.myProperties", { defaultValue: "Danh sách cơ sở lưu trú của bạn" })}
            </h3>

            {properties.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {t("trip.hotels.noPropertiesRegistered", {
                  defaultValue: "Bạn chưa đăng ký cơ sở lưu trú nào dưới doanh nghiệp này.",
                })}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {properties.map((p) => {
                  const isSelected = selectedProperty?.id === p.id;
                  const canSync = businesses.some((b) => b.id === p.business_id);
                  return (
                    <article
                      key={p.id}
                      onClick={() => handleSelectProperty(p)}
                      className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border bg-card hover:border-border/80 shadow-2xs"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-base text-foreground">{p.name}</h4>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                              p.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {t(`trip.hotels.status.${p.status}`, { defaultValue: p.status })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.destination} · {p.address}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("trip.hotels.checkInTime")}: {p.check_in_time} · {t("trip.hotels.checkOutTime")}: {p.check_out_time}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-4 mt-3 border-t border-border/50">
                        <span className="text-xs font-semibold text-primary">
                          {isSelected
                            ? t("trip.hotels.selectedProperty", { defaultValue: "Đang chọn quản lý" })
                            : t("trip.hotels.clickToManage", { defaultValue: "Bấm để quản lý" })}
                        </span>
                        {canSync && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSyncProfile(p);
                            }}
                            className="h-7 text-xs"
                          >
                            {t("trip.hotels.syncApproved", { defaultValue: "Đồng bộ từ hồ sơ" })}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rooms for Selected Property */}
          {selectedProperty && (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-primary" />
                    <span>{t("trip.hotels.roomsFor", { defaultValue: "Loại phòng tại" })}: {selectedProperty.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("trip.hotels.roomsSubtitle", { defaultValue: "Cấu hình tên loại phòng và số lượng khách tối đa" })}
                  </p>
                </div>
              </div>

              {/* Add Room Form */}
              {successMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleAddRoom} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end bg-muted/40 p-4 rounded-xl border border-border/60">
                <label className="space-y-1 text-xs font-medium sm:col-span-2 lg:col-span-1">
                  <span>{t("trip.hotels.roomName", { defaultValue: "Tên loại phòng" })}</span>
                  <Input name="roomName" required placeholder="ví dụ: Deluxe Ocean View" className="h-9 text-xs" />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  <span>{t("trip.hotels.capacity", { defaultValue: "Sức chứa (khách)" })}</span>
                  <Input name="capacity" type="number" required defaultValue="2" min={1} max={20} className="h-9 text-xs" />
                </label>
                <label className="space-y-1 text-xs font-medium">
                  <span>{t("trip.hotels.nightlyPrice", { defaultValue: "Giá mỗi đêm (VND)" })}</span>
                  <Input name="nightlyPrice" type="number" required defaultValue="500000" min={1000} step={1000} className="h-9 text-xs" />
                </label>
                <div className="flex gap-2">
                  <label className="space-y-1 text-xs font-medium flex-1">
                    <span>{t("trip.hotels.allocation", { defaultValue: "Số phòng mở bán" })}</span>
                    <Input name="allocation" type="number" required defaultValue="5" min={1} max={1000} className="h-9 text-xs" />
                  </label>
                  <Button disabled={busy} type="submit" size="sm" className="h-9 text-xs gap-1 shadow-2xs self-end">
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t("trip.hotels.addRoom", { defaultValue: "Thêm phòng" })}</span>
                  </Button>
                </div>
              </form>

              {/* Rooms List */}
              <div className="space-y-2">
                {rooms.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    {t("trip.hotels.noRoomsYet", { defaultValue: "Chưa có loại phòng nào. Hãy thêm loại phòng đầu tiên ở trên." })}
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {rooms.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background text-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{r.name}</p>
                          <p className="text-muted-foreground">
                            {r.capacity} {t("trip.hotels.guests", { defaultValue: "khách tối đa" })}
                          </p>
                        </div>
                        <span className="text-micro text-muted-foreground font-mono">#{r.id.slice(0, 6)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Register New Property Section */}
          {businesses.length > 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 space-y-4 bg-muted/20">
              <h3 className="font-semibold text-sm text-foreground">
                {t("trip.hotels.registerNewPropertyTitle", { defaultValue: "Đăng ký cơ sở lưu trú mới" })}
              </h3>
              <form
                key={`new-prop-${formVersion}-${businessId}`}
                id={newPropertyFormId}
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  void (async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await hotelApi(
                        "/properties",
                        "POST",
                        Object.fromEntries(
                          ["name", "destination", "address", "timeZone", "checkInTime", "checkOutTime", "businessId"].map(
                            (k) => [k, String(data.get(k) ?? "")]
                          )
                        )
                      );
                      setFormVersion((v) => v + 1);
                      await loadContext();
                    } catch (err) {
                      setError(getSafeErrorMessage(err));
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <label className="space-y-1 text-xs font-medium sm:col-span-2">
                  <span>{t("trip.commerce.business", { defaultValue: "Doanh nghiệp đã duyệt" })}</span>
                  <select
                    name="businessId"
                    required
                    value={businessId}
                    onChange={(e) => setBusinessId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium">
                  <span>{t("trip.hotels.name", { defaultValue: "Tên cơ sở" })}</span>
                  <Input name="name" required defaultValue={approvedBusiness?.displayName ?? ""} readOnly className="h-9 text-xs bg-muted/50" />
                </label>

                <label className="space-y-1 text-xs font-medium">
                  <span>{t("trip.hotels.destination", { defaultValue: "Điểm đến" })}</span>
                  <Input name="destination" required defaultValue={profileText("destination")} readOnly className="h-9 text-xs bg-muted/50" />
                </label>

                <label className="space-y-1 text-xs font-medium sm:col-span-2">
                  <span>{t("trip.hotels.address", { defaultValue: "Địa chỉ" })}</span>
                  <Input name="address" required defaultValue={profileText("address")} readOnly className="h-9 text-xs bg-muted/50" />
                </label>

                <label className="space-y-1 text-xs font-medium">
                  <span>{t("trip.hotels.timeZone", { defaultValue: "Múi giờ" })}</span>
                  <Input name="timeZone" required defaultValue="Asia/Ho_Chi_Minh" className="h-9 text-xs" />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-xs font-medium">
                    <span>{t("trip.hotels.checkInTime", { defaultValue: "Giờ nhận" })}</span>
                    <Input name="checkInTime" type="time" required defaultValue="14:00" className="h-9 text-xs" />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    <span>{t("trip.hotels.checkOutTime", { defaultValue: "Giờ trả" })}</span>
                    <Input name="checkOutTime" type="time" required defaultValue="11:00" className="h-9 text-xs" />
                  </label>
                </div>

                <div className="sm:col-span-2 pt-2">
                  <Button disabled={busy || !businessId || !profileText("destination")} type="submit" size="sm" className="text-xs shadow-2xs">
                    {t("common.save", { defaultValue: "Lưu cơ sở" })}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVENTORY & PRICING */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {!selectedProperty ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("trip.hotels.selectPropertyFirst", { defaultValue: "Vui lòng chọn một cơ sở lưu trú ở tab Cơ sở & Phòng trước." })}
            </p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("trip.hotels.addRoomsFirst", { defaultValue: "Cơ sở này chưa có loại phòng nào. Hãy thêm loại phòng trước." })}
            </p>
          ) : (
            <div className="space-y-6">
              {/* Form to update inventory */}
              <form onSubmit={handleUpdateInventory} className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
                <h3 className="font-semibold text-sm text-foreground">
                  {t("trip.hotels.updateInventoryTitle", { defaultValue: "Thiết lập giá và số lượng phòng mở bán" })}
                </h3>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="space-y-1 text-xs font-medium sm:col-span-2 lg:col-span-1">
                    <span>{t("trip.hotels.roomName", { defaultValue: "Loại phòng" })}</span>
                    <select name="room" className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs">
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.capacity} khách)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>{t("trip.hotels.from", { defaultValue: "Từ ngày" })}</span>
                    <Input name="from" type="date" required className="h-9 text-xs" />
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>{t("trip.hotels.to", { defaultValue: "Đến ngày" })}</span>
                    <Input name="to" type="date" required className="h-9 text-xs" />
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>{t("trip.hotels.allocation", { defaultValue: "Số phòng mở bán" })}</span>
                    <Input name="allocation" type="number" required defaultValue="1" min={0} max={1000} className="h-9 text-xs" />
                  </label>

                  <label className="space-y-1 text-xs font-medium">
                    <span>{t("trip.hotels.nightlyPrice", { defaultValue: "Giá / đêm (VND)" })}</span>
                    <Input name="nightlyPrice" type="number" required defaultValue="500000" min={1000} step={1000} className="h-9 text-xs" />
                  </label>

                  <div className="flex items-center gap-2 pt-6">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input type="checkbox" name="stopSell" className="rounded-sm border-border" />
                      <span>{t("trip.hotels.stopSell", { defaultValue: "Tạm dừng bán (Stop-sell)" })}</span>
                    </label>
                  </div>

                  <div className="pt-5">
                    <Button disabled={busy} type="submit" size="sm" className="h-9 text-xs shadow-2xs w-full">
                      {t("common.save", { defaultValue: "Cập nhật lịch" })}
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  {t("trip.hotels.allocationNote", {
                    defaultValue: "Chỉ phân bổ số phòng dành riêng cho TripSense. Các phòng đã giữ hoặc đã đặt không thể giảm.",
                  })}
                </p>
              </form>

              {/* Inventory Table */}
              {inventory.length > 0 && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <h4 className="font-semibold text-xs text-foreground">
                      {t("trip.hotels.inventoryStatus", { defaultValue: "Trạng thái phòng theo ngày" })}
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-micro">
                        <tr>
                          <th className="p-3">Ngày</th>
                          <th className="p-3">Mở bán (Allocation)</th>
                          <th className="p-3">Đang giữ (Held)</th>
                          <th className="p-3">Đã đặt (Booked)</th>
                          <th className="p-3">Giá mỗi đêm</th>
                          <th className="p-3">Tình trạng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {inventory.map((day) => (
                          <tr key={day.stay_date} className="hover:bg-muted/20">
                            <td className="p-3 font-medium text-foreground">{day.stay_date}</td>
                            <td className="p-3">{day.allocation}</td>
                            <td className="p-3 text-amber-600 font-medium">{day.held}</td>
                            <td className="p-3 text-emerald-600 font-medium">{day.booked}</td>
                            <td className="p-3 font-medium">{money(day.nightly_price, "VND")}</td>
                            <td className="p-3">
                              {day.stop_sell ? (
                                <span className="inline-flex items-center gap-1 text-micro text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                  <Ban className="h-3 w-3" /> Stop-sell
                                </span>
                              ) : (
                                <span className="text-emerald-600 text-[11px]">Đang mở</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GUEST BOOKINGS & RESERVATIONS */}
      {activeTab === "guests" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">
              {t("trip.hotels.reservationsFor", { defaultValue: "Danh sách khách đặt phòng tại" })}: {selectedProperty?.name ?? "..."}
            </h3>
            <span className="text-xs text-muted-foreground">
              {bookings.length} {t("trip.hotels.totalBookings", { defaultValue: "đơn đặt" })}
            </span>
          </div>

          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground bg-card/40">
              {t("trip.hotels.noGuestBookings", { defaultValue: "Chưa có lượt đặt phòng nào tại cơ sở này." })}
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const isConfirmed = b.status === "CONFIRMED";
                const isCheckedIn = b.status === "CHECKED_IN";
                const canCancelByProperty = ["HELD", "CONFIRMED"].includes(b.status);

                return (
                  <article
                    key={b.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{b.room_name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-micro font-semibold border ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : isCheckedIn
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {t(`trip.hotels.status.${b.status}`, { defaultValue: b.status })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.check_in} → {b.check_out} · {b.quantity} phòng · {b.guests} khách · {money(b.total, b.currency)}
                      </p>
                      <p className="text-micro text-muted-foreground font-mono">#{b.id}</p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isConfirmed && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await hotelApi(`/bookings/${b.id}/check-in`, "POST", { expectedVersion: b.version });
                                const updated = await hotelApi<HotelBooking[]>(`/properties/${selectedProperty!.id}/bookings`);
                                setBookings(updated);
                              } catch (e) {
                                setError(getSafeErrorMessage(e));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="h-8 text-xs font-semibold gap-1 shadow-2xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{t("trip.hotels.checkInAction", { defaultValue: "Nhận phòng (Check-in)" })}</span>
                        </Button>
                      )}

                      {isCheckedIn && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await hotelApi(`/bookings/${b.id}/check-out`, "POST", { expectedVersion: b.version });
                                const updated = await hotelApi<HotelBooking[]>(`/properties/${selectedProperty!.id}/bookings`);
                                setBookings(updated);
                              } catch (e) {
                                setError(getSafeErrorMessage(e));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="h-8 text-xs font-semibold gap-1 shadow-2xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{t("trip.hotels.checkOutAction", { defaultValue: "Trả phòng (Check-out)" })}</span>
                        </Button>
                      )}

                      {isConfirmed && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void (async () => {
                              setBusy(true);
                              try {
                                await hotelApi(`/bookings/${b.id}/no-show`, "POST", { expectedVersion: b.version });
                                const updated = await hotelApi<HotelBooking[]>(`/properties/${selectedProperty!.id}/bookings`);
                                setBookings(updated);
                              } catch (e) {
                                setError(getSafeErrorMessage(e));
                              } finally {
                                setBusy(false);
                              }
                            })()
                          }
                          className="h-8 text-xs gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          <span>{t("trip.hotels.noShowAction", { defaultValue: "Báo vắng mặt" })}</span>
                        </Button>
                      )}

                      {canCancelByProperty && (
                        cancelTargetId === b.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder={t("trip.hotels.cancelReason", { defaultValue: "Lý do hủy..." })}
                              value={cancelReason}
                              onChange={(e) => setCancelReason(e.target.value)}
                              className="h-8 text-xs w-48"
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busy || !cancelReason.trim()}
                              onClick={() => void handlePropertyCancel(b)}
                              className="h-8 text-xs"
                            >
                              {t("common.confirm", { defaultValue: "Xác nhận" })}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCancelTargetId(null);
                                setCancelReason("");
                              }}
                              className="h-8 text-xs"
                            >
                              {t("common.cancel", { defaultValue: "Đóng" })}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setCancelTargetId(b.id)}
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            {t("trip.hotels.cancelByProperty", { defaultValue: "Hủy đơn" })}
                          </Button>
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMERCE & STATEMENTS */}
      {activeTab === "commerce" && (
        <div className="space-y-4">
          <HotelCommerce />
        </div>
      )}
    </div>
  );
}
