"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { MindtripStaysDiscovery } from "./mindtrip-stays-discovery";
import { hotelApi } from "../services/hotels-api";
import type { HotelNotification } from "../types";
import {
  Compass,
  Briefcase,
  Building2,
  Bell,
} from "lucide-react";

export function HotelWorkspace() {
  const userId = useAuthStore((s) => s.user?.id);
  return <HotelWorkspaceSession key={userId ?? "anonymous"} />;
}

function HotelWorkspaceSession() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [unreadCount, setUnreadCount] = useState(0);

  // Legacy tab parameter redirection
  useEffect(() => {
    const qTab = searchParams?.get("tab");
    if (!qTab) return;
    if (qTab === "partner") {
      router.replace("/partner");
    } else if (qTab === "admin") {
      router.replace("/admin/hotels");
    } else if (qTab === "bookings") {
      router.replace("/hotels/bookings");
    } else if (qTab === "notifications") {
      router.replace("/hotels/notifications");
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;
    async function fetchInbox() {
      try {
        const data = await hotelApi<HotelNotification[]>("/notifications");
        if (!cancelled) {
          const unread = data.filter((n) => !n.read_at).length;
          setUnreadCount(unread);
        }
      } catch {
        // Ignored for unauthenticated or first load
      }
    }
    void fetchInbox();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Traveler Header */}
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
              <p className="text-micro text-muted-foreground hidden sm:block">
                {t("trip.hotels.travelerMode", { defaultValue: "Khám phá & Đặt phòng trực tuyến" })}
              </p>
            </div>
          </div>

          {/* Center: Traveler Segmented Control (Stays | My Bookings) */}
          <nav aria-label="Traveler tabs" className="flex items-center rounded-full bg-muted/80 p-1 border border-border/80">
            <span className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold bg-background text-foreground shadow-xs">
              <Compass className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.staysDiscovery", { defaultValue: "Khám phá phòng" })}</span>
            </span>

            <Link
              href="/hotels/bookings"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>{t("trip.hotels.myBookings", { defaultValue: "Đơn đặt của tôi" })}</span>
            </Link>
          </nav>

          {/* Right: Notifications Bell */}
          <div className="flex items-center gap-2">
            <Link
              href="/hotels/notifications"
              aria-label="Notifications"
              className="relative h-8 w-8 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area: Stays Discovery */}
      <main className="flex-1">
        <MindtripStaysDiscovery />
      </main>
    </div>
  );
}
