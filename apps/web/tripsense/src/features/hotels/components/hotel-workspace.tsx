"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { HotelManagement } from "./hotel-management";
import { MindtripStaysDiscovery } from "./mindtrip-stays-discovery";
import { hotelApi } from "../services/hotels-api";
import type { HotelNotification } from "../types";

export function HotelWorkspace() {
  const userId = useAuthStore((s) => s.user?.id);
  return <HotelWorkspaceSession key={userId ?? "anonymous"} />;
}

function HotelWorkspaceSession() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("search");
  const [notifications, setNotifications] = useState<HotelNotification[]>([]);
  const [error, setError] = useState("");

  const isAdmin = ["ADMIN", "ROLE_ADMIN"].includes(String(user?.role));
  const tabs = ["search", "manage", "notifications", ...(isAdmin ? ["admin"] : [])];

  async function inbox(id?: string) {
    setError("");
    try {
      if (id) await hotelApi(`/notifications/${id}/read`, "POST");
      setNotifications(await hotelApi<HotelNotification[]>("/notifications"));
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed", { defaultValue: "Failed to load notifications" })));
    }
  }

  // If in search mode, render the full Mindtrip Stays Discovery experience
  if (tab === "search") {
    return (
      <div className="w-full h-full min-h-screen bg-background text-foreground">
        <MindtripStaysDiscovery
          onSwitchToManagement={() => setTab("manage")}
          isAdmin={isAdmin}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t("trip.hotels.title", { defaultValue: "Hotel Management" })}
        </h1>
        <Button variant="outline" onClick={() => setTab("search")}>
          ← {t("trip.hotels.backToStays", { defaultValue: "Back to Stays Discovery" })}
        </Button>
      </div>

      <nav aria-label="Hotel tabs" className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item}
            variant={tab === item ? "default" : "outline"}
            onClick={() => {
              setTab(item);
              if (item === "notifications") void inbox();
            }}
          >
            {item === "search"
              ? t("trip.hotels.staysDiscovery", { defaultValue: "Stays Discovery" })
              : t(`trip.hotels.${item}`, { defaultValue: item })}
          </Button>
        ))}
      </nav>

      {tab === "manage" && <HotelManagement />}
      {tab === "admin" && isAdmin && <HotelManagement admin />}
      {tab === "notifications" && (
        <section className="space-y-3">
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <Button variant="outline" onClick={() => void inbox()}>
            {t("common.refresh", { defaultValue: "Refresh" })}
          </Button>
          {notifications.map((n) => (
            <article key={n.id} className="space-y-2 rounded-xl border border-border p-4">
              <p>{t(`trip.hotels.events.${n.event_type}`, { defaultValue: n.event_type })}</p>
              <p className="text-xs text-muted-foreground">
                {n.aggregate_id} · {new Date(n.created_at).toLocaleString()}
              </p>
              {!n.read_at && (
                <Button variant="outline" onClick={() => void inbox(n.id)}>
                  {t("trip.hotels.markRead", { defaultValue: "Mark as read" })}
                </Button>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
