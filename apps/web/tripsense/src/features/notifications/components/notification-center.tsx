"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  MapPin,
  BedDouble,
  MessageSquare,
  Store,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { useUnifiedNotifications } from "../hooks/use-unified-notifications";
import type { NotificationCategory, UnifiedNotificationItem } from "../types";

export function NotificationCenter() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
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
    setOpen(false);
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-muted-foreground hover:text-foreground"
          aria-label={t("notifications.title", { defaultValue: "Thông báo" })}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 rounded-2xl border-border bg-card p-0 shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-3.5 bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">
              {t("notifications.title", { defaultValue: "Thông báo" })}
            </h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-micro font-semibold">
                {unreadCount} {t("notifications.unread", { defaultValue: "mới" })}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 px-2 text-micro text-muted-foreground hover:text-foreground"
              title={t("notifications.markAllRead", { defaultValue: "Đánh dấu tất cả đã đọc" })}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              <span>{t("notifications.markAllRead", { defaultValue: "Đã đọc tất cả" })}</span>
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto p-2 border-b border-border/40 text-micro">
          {(
            [
              { id: "ALL", label: t("notifications.filterAll", { defaultValue: "Tất cả" }) },
              { id: "TRIP", label: t("notifications.filterTrips", { defaultValue: "Chuyến đi" }) },
              { id: "HOTEL", label: t("notifications.filterHotels", { defaultValue: "Đặt phòng" }) },
              { id: "CHAT", label: t("notifications.filterChat", { defaultValue: "Tin nhắn" }) },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFilter(f.id)}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                selectedFilter === f.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>{t("common.loading", { defaultValue: "Đang tải..." })}</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-semibold text-foreground">
                {t("notifications.noNotifications", { defaultValue: "Không có thông báo nào" })}
              </p>
              <p className="text-micro text-muted-foreground mt-0.5">
                {t("notifications.noNotificationsDesc", {
                  defaultValue: "Bạn sẽ nhận được thông báo khi có cập nhật mới.",
                })}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex items-start gap-3 p-3 transition-colors cursor-pointer hover:bg-muted/40 ${
                  !item.read ? "bg-primary/5" : ""
                }`}
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${getCategoryBg(
                    item.category,
                  )}`}
                >
                  {getCategoryIcon(item.category)}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${!item.read ? "font-bold text-foreground" : "font-medium text-foreground/90"}`}>
                      {item.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(item.createdAt).toLocaleDateString(
                        locale === "vi" ? "vi-VN" : "en-US",
                        { month: "numeric", day: "numeric" },
                      )}
                    </span>
                  </div>

                  <p className="text-micro text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  {/* Inline Action for Trip Invitations */}
                  {item.invitationId && (
                    <div className="flex items-center gap-1.5 pt-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="xs"
                        onClick={(e) => handleAccept(e, item.invitationId!)}
                        disabled={actingInvitationId === item.invitationId}
                        className="h-6 text-micro font-medium gap-1"
                      >
                        {actingInvitationId === item.invitationId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {t("notifications.acceptInvite", { defaultValue: "Chấp nhận" })}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={(e) => handleDecline(e, item.invitationId!)}
                        disabled={actingInvitationId === item.invitationId}
                        className="h-6 text-micro font-medium gap-1"
                      >
                        <X className="h-3 w-3" />
                        {t("notifications.declineInvite", { defaultValue: "Từ chối" })}
                      </Button>
                    </div>
                  )}
                </div>

                {!item.read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/70 p-2.5 bg-muted/20 text-center">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>{t("notifications.viewAll", { defaultValue: "Xem tất cả thông báo" })}</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
