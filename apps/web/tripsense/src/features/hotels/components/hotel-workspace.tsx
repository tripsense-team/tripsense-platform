"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { isUserAdmin, isUserPartner } from "@/features/auth/utils/role-helpers";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { HotelManagement } from "./hotel-management";
import { MindtripStaysDiscovery } from "./mindtrip-stays-discovery";
import { UserBookingsView } from "./user-bookings-view";
import { PartnerHotelWorkspace } from "./partner-hotel-workspace";
import { hotelApi } from "../services/hotels-api";
import type { HotelNotification } from "../types";
import {
  Compass,
  Briefcase,
  Building2,
  ShieldCheck,
  Bell,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

type MainTab = "stays" | "bookings" | "partner" | "admin" | "notifications";

export function HotelWorkspace() {
  const userId = useAuthStore((s) => s.user?.id);
  return <HotelWorkspaceSession key={userId ?? "anonymous"} />;
}

function HotelWorkspaceSession() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const isAdmin = isUserAdmin(user);
  const isPartner = isUserPartner(user);

  const initialTab = ((): MainTab => {
    const qTab = searchParams?.get("tab");
    if (qTab === "partner" && isPartner) return "partner";
    if (qTab === "admin" && isAdmin) return "admin";
    if (qTab === "bookings") return "bookings";
    return "stays";
  })();

  const [tab, setTab] = useState<MainTab>(initialTab);
  const [notifications, setNotifications] = useState<HotelNotification[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchInbox() {
      try {
        const data = await hotelApi<HotelNotification[]>("/notifications");
        if (!cancelled) setNotifications(data);
      } catch {
        // Ignored for unauthenticated or first load
      }
    }
    void fetchInbox();
    return () => {
      cancelled = true;
    };
  }, []);

  async function inbox(id?: string) {
    setError("");
    try {
      if (id) await hotelApi(`/notifications/${id}/read`, "POST");
      setNotifications(await hotelApi<HotelNotification[]>("/notifications"));
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed", { defaultValue: "Failed to load notifications" })));
    }
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Role-Separated Clean Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Left: Brand / Section Title */}
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                {t("trip.hotels.headerTitle", { defaultValue: "Khách sạn & Lưu trú" })}
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                {tab === "partner"
                  ? t("trip.hotels.partnerMode", { defaultValue: "Kênh Đối tác khách sạn" })
                  : tab === "admin"
                  ? t("trip.hotels.adminMode", { defaultValue: "Kênh Quản trị viên" })
                  : t("trip.hotels.travelerMode", { defaultValue: "Khám phá & Đặt phòng trực tuyến" })}
              </p>
            </div>
          </div>

          {/* Center: Traveler Segmented Control (Stays | My Bookings) */}
          <nav aria-label="Traveler tabs" className="flex items-center rounded-full bg-muted/80 p-1 border border-border/80">
            <button
              type="button"
              onClick={() => setTab("stays")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                tab === "stays"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.staysDiscovery", { defaultValue: "Khám phá phòng" })}</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("bookings")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                tab === "bookings"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.myBookings", { defaultValue: "Đơn đặt của tôi" })}</span>
            </button>
          </nav>

          {/* Right: Role-specific Portals (Partner / Admin / Notifications) */}
          <div className="flex items-center gap-2">
            {/* Partner Portal Switch (Only if user has partner role) */}
            {isPartner && (
              <button
                type="button"
                onClick={() => setTab((prev) => (prev === "partner" ? "stays" : "partner"))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                  tab === "partner"
                    ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                    : "bg-card border-border text-foreground/80 hover:text-foreground hover:bg-muted"
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">
                  {tab === "partner"
                    ? t("trip.hotels.backToStays", { defaultValue: "Trang tìm phòng" })
                    : t("trip.hotels.partnerPortal", { defaultValue: "Kênh Đối tác" })}
                </span>
              </button>
            )}

            {/* Admin Portal Switch (Only if user is Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab((prev) => (prev === "admin" ? "stays" : "admin"))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all cursor-pointer ${
                  tab === "admin"
                    ? "bg-foreground text-background border-foreground shadow-2xs"
                    : "bg-card border-border text-foreground/80 hover:text-foreground hover:bg-muted"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden md:inline">
                  {tab === "admin"
                    ? t("trip.hotels.backToStays", { defaultValue: "Trang tìm phòng" })
                    : t("trip.hotels.adminPortal", { defaultValue: "Quản trị viên" })}
                </span>
              </button>
            )}

            {/* Notifications Bell */}
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => {
                setTab("notifications");
                void inbox();
              }}
              className={`relative h-8 w-8 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors cursor-pointer ${
                tab === "notifications" ? "border-primary text-primary" : "text-foreground/80"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Tab 1: Mindtrip Stays Discovery (Full experience) */}
        {tab === "stays" && (
          <MindtripStaysDiscovery
            onSwitchToManagement={
              isPartner ? () => setTab("partner") : isAdmin ? () => setTab("admin") : undefined
            }
            isAdmin={isAdmin}
          />
        )}

        {/* Tab 2: User Personal Bookings Management */}
        {tab === "bookings" && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <UserBookingsView onExploreStays={() => setTab("stays")} />
          </div>
        )}

        {/* Tab 3: Dedicated Partner Workspace */}
        {tab === "partner" && isPartner && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <PartnerHotelWorkspace onBackToStays={() => setTab("stays")} />
          </div>
        )}

        {/* Tab 4: Admin Verification & Settlement */}
        {tab === "admin" && isAdmin && (
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold">{t("trip.hotels.admin", { defaultValue: "Quản trị cơ sở lưu trú" })}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("trip.hotels.adminSubtitle", { defaultValue: "Xét duyệt và kiểm định chất lượng các cơ sở lưu trú đăng ký" })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTab("stays")} className="gap-1 text-xs">
                <ArrowLeft className="h-3 w-3" />
                <span>{t("trip.hotels.backToStays", { defaultValue: "Xem trang tìm phòng" })}</span>
              </Button>
            </div>
            <HotelManagement admin />
          </div>
        )}

        {/* Tab 5: Hotel Notifications Inbox */}
        {tab === "notifications" && (
          <div className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h2 className="text-xl font-bold">{t("trip.hotels.notifications", { defaultValue: "Thông báo đặt phòng" })}</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void inbox()} className="gap-1 text-xs">
                  <RefreshCw className="h-3 w-3" />
                  <span>{t("common.refresh", { defaultValue: "Làm mới" })}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setTab("stays")} className="gap-1 text-xs">
                  <ArrowLeft className="h-3 w-3" />
                  <span>{t("trip.hotels.backToStays", { defaultValue: "Quay lại" })}</span>
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                {error}
              </div>
            )}

            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                {t("trip.hotels.noNotifications", { defaultValue: "Chưa có thông báo nào về phòng lưu trú." })}
              </p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <article
                    key={n.id}
                    className={`flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors ${
                      n.read_at ? "border-border bg-card/60 opacity-80" : "border-primary/30 bg-primary/5 shadow-2xs"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {t(`trip.hotels.events.${n.event_type}`, { defaultValue: n.event_type })}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        #{n.aggregate_id} · {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>

                    {!n.read_at && (
                      <Button variant="outline" size="sm" onClick={() => void inbox(n.id)} className="h-7 text-xs shrink-0">
                        {t("trip.hotels.markRead", { defaultValue: "Đã đọc" })}
                      </Button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
