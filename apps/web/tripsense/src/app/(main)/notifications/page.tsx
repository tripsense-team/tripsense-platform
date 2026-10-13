"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  MapPin,
  BedDouble,
  MessageSquare,
  Store,
  X,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { useUnifiedNotifications } from "@/features/notifications/hooks/use-unified-notifications";
import type { NotificationCategory, UnifiedNotificationItem } from "@/features/notifications/types";

export default function NotificationsPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] =
    React.useState<NotificationCategory>("ALL");
  const [actingInvitationId, setActingInvitationId] = React.useState<
    string | null
  >(null);

  const {
    items,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
    acceptInvitation,
    declineInvitation,
  } = useUnifiedNotifications();

  const filteredItems = React.useMemo(() => {
    if (selectedFilter === "ALL") return items;
    if (selectedFilter === "TRIP")
      return items.filter((it) => it.category === "TRIP");
    if (selectedFilter === "HOTEL")
      return items.filter((it) => it.category === "HOTEL");
    if (selectedFilter === "CHAT")
      return items.filter((it) => it.category === "CHAT");
    if (selectedFilter === "PARTNER")
      return items.filter((it) => it.category === "PARTNER");
    return items;
  }, [items, selectedFilter]);

  const handleItemClick = async (item: UnifiedNotificationItem) => {
    if (!item.read) {
      await markAsRead(item);
    }
    if (item.targetUrl) {
      router.push(item.targetUrl);
    }
  };

  const handleAccept = async (e: React.MouseEvent, invitationId: string) => {
    e.stopPropagation();
    try {
      setActingInvitationId(invitationId);
      await acceptInvitation(invitationId);
    } finally {
      setActingInvitationId(null);
    }
  };

  const handleDecline = async (e: React.MouseEvent, invitationId: string) => {
    e.stopPropagation();
    try {
      setActingInvitationId(invitationId);
      await declineInvitation(invitationId);
    } finally {
      setActingInvitationId(null);
    }
  };

  const getCategoryIcon = (category: UnifiedNotificationItem["category"]) => {
    switch (category) {
      case "TRIP":
        return <MapPin className="h-4 w-4 text-teal-600 dark:text-teal-400" />;
      case "HOTEL":
        return <BedDouble className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "CHAT":
        return <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "PARTNER":
        return <Store className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    }
  };

  const getCategoryBg = (category: UnifiedNotificationItem["category"]) => {
    switch (category) {
      case "TRIP":
        return "bg-teal-500/10 border-teal-500/20";
      case "HOTEL":
        return "bg-emerald-500/10 border-emerald-500/20";
      case "CHAT":
        return "bg-amber-500/10 border-amber-500/20";
      case "PARTNER":
        return "bg-purple-500/10 border-purple-500/20";
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs">
              <Link href="/explore">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {t("common.back")}
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("notifications.title", { defaultValue: "Trung tâm Thông báo" })}
            </h1>
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
                {unreadCount} {t("notifications.unread", { defaultValue: "chưa đọc" })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("notifications.pageDesc", {
              defaultValue: "Tổng hợp thông báo về hành trình, lời mời chuyến đi, đặt phòng và tin nhắn của bạn.",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="h-9 gap-1.5 text-xs font-semibold"
          >
            <CheckCheck className="h-4 w-4" />
            {t("notifications.markAllRead", { defaultValue: "Đánh dấu tất cả đã đọc" })}
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {(
          [
            { id: "ALL", label: t("notifications.filterAll", { defaultValue: "Tất cả" }), count: items.length },
            { id: "TRIP", label: t("notifications.filterTrips", { defaultValue: "Chuyến đi" }), count: items.filter((it) => it.category === "TRIP").length },
            { id: "HOTEL", label: t("notifications.filterHotels", { defaultValue: "Đặt phòng" }), count: items.filter((it) => it.category === "HOTEL").length },
            { id: "CHAT", label: t("notifications.filterChat", { defaultValue: "Tin nhắn" }), count: items.filter((it) => it.category === "CHAT").length },
            { id: "PARTNER", label: t("notifications.filterPartner", { defaultValue: "Đối tác" }), count: items.filter((it) => it.category === "PARTNER").length },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFilter(f.id)}
            className={`rounded-xl px-3.5 py-1.5 font-medium transition-all flex items-center gap-1.5 ${
              selectedFilter === f.id
                ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{f.label}</span>
            {f.count > 0 && (
              <span className={`text-[11px] rounded-full px-1.5 py-0.2 ${
                selectedFilter === f.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-muted-foreground"
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List Card */}
      <Card className="shadow-xs border-border/80">
        <CardContent className="p-0 divide-y divide-border/50">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
              <span>{t("common.loading", { defaultValue: "Đang tải thông báo..." })}</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 text-center space-y-2">
              <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="text-sm font-bold text-foreground">
                {t("notifications.noNotifications", { defaultValue: "Không có thông báo nào" })}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {t("notifications.noNotificationsDesc", {
                  defaultValue: "Bạn sẽ nhận được thông báo khi có lời mời chuyến đi, cập nhật đặt phòng hoặc tin nhắn mới.",
                })}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4.5 transition-colors cursor-pointer hover:bg-muted/30 ${
                  !item.read ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${getCategoryBg(
                      item.category,
                    )}`}
                  >
                    {getCategoryIcon(item.category)}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-sm ${!item.read ? "font-bold text-foreground" : "font-semibold text-foreground/90"}`}>
                        {item.title}
                      </h4>
                      {!item.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.message}
                    </p>

                    <p className="text-[11px] text-muted-foreground/80 font-mono">
                      {new Date(item.createdAt).toLocaleString(
                        locale === "vi" ? "vi-VN" : "en-US",
                      )}
                    </p>
                  </div>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {item.invitationId && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        onClick={(e) => handleAccept(e, item.invitationId!)}
                        disabled={actingInvitationId === item.invitationId}
                        className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
                      >
                        {actingInvitationId === item.invitationId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {t("notifications.acceptInvite", { defaultValue: "Chấp nhận" })}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleDecline(e, item.invitationId!)}
                        disabled={actingInvitationId === item.invitationId}
                        className="h-8 text-xs font-medium gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("notifications.declineInvite", { defaultValue: "Từ chối" })}
                      </Button>
                    </div>
                  )}

                  {!item.read && !item.invitationId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(item);
                      }}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t("notifications.markRead", { defaultValue: "Đánh dấu đã đọc" })}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
