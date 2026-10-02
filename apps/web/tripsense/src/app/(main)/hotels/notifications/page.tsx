"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { hotelApi } from "@/features/hotels/services/hotels-api";
import type { HotelNotification } from "@/features/hotels/types";
import { ArrowLeft, Bell, Building2, RefreshCw } from "lucide-react";

export default function HotelNotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<HotelNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async (markId?: string) => {
    setError("");
    try {
      if (markId) {
        await hotelApi(`/notifications/${markId}/read`, "POST");
      }
      const data = await hotelApi<HotelNotification[]>("/notifications");
      setNotifications(data);
    } catch (e) {
      setError(getSafeErrorMessage(e, t("trip.hotels.failed", { defaultValue: "Failed to load notifications" })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                {t("trip.hotels.headerTitle", { defaultValue: "Khách sạn & Lưu trú" })}
              </h1>
              <p className="text-micro text-muted-foreground hidden sm:block">
                {t("trip.hotels.notificationsSubtitle", { defaultValue: "Thông báo cập nhật đặt phòng" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadNotifications()}
              disabled={loading}
              className="gap-1 text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t("common.refresh", { defaultValue: "Làm mới" })}</span>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/hotels">
                <ArrowLeft className="h-3 w-3" />
                <span>{t("trip.hotels.backToStays", { defaultValue: "Quay lại" })}</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl w-full p-4 sm:p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">
            {t("trip.hotels.notifications", { defaultValue: "Thông báo đặt phòng" })}
          </h2>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-border/60 bg-muted/40" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadNotifications(n.id)}
                    className="h-7 text-xs shrink-0"
                  >
                    {t("trip.hotels.markRead", { defaultValue: "Đã đọc" })}
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
