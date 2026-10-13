"use client";

import * as React from "react";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { notificationsApi } from "../services/notifications-api";
import type { UnifiedNotificationItem } from "../types";

export function useUnifiedNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = React.useState<UnifiedNotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchAll = React.useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      const [tripInvs, hotelNotifs, partnerNotifs, chatSummary] =
        await Promise.all([
          notificationsApi.getTripInvitations(),
          notificationsApi.getHotelNotifications(),
          notificationsApi.getPartnerNotifications(),
          notificationsApi.getChatUnreadSummary(),
        ]);

      const normalized: UnifiedNotificationItem[] = [];

      // 1. Trip Invitations
      tripInvs.forEach((inv) => {
        normalized.push({
          id: `trip-inv-${inv.id}`,
          category: "TRIP",
          title: "Lời mời tham gia chuyến đi",
          message: `${inv.inviterName || "Thành viên"} đã mời bạn tham gia cộng tác chuyến đi "${inv.tripName || "Chuyến đi mới"}".`,
          createdAt: inv.createdAt || new Date().toISOString(),
          read: false,
          targetUrl: inv.tripId ? `/trips/${inv.tripId}` : "/trips",
          invitationId: inv.id,
          senderName: inv.inviterName,
        });
      });

      // 2. Hotel Notifications
      hotelNotifs.forEach((h) => {
        let label = "Cập nhật đặt phòng khách sạn";
        if (h.event_type === "BOOKING_CONFIRMED") label = "Đặt phòng đã xác nhận thành công";
        if (h.event_type === "BOOKING_CANCELLED") label = "Đặt phòng đã được hủy";
        if (h.event_type === "BOOKING_EXPIRED") label = "Thời gian giữ phòng đã hết hạn";
        if (h.event_type === "BOOKING_CHECKED_IN") label = "Đã làm thủ tục nhận phòng";
        if (h.event_type === "BOOKING_CHECKED_OUT") label = "Đã làm thủ tục trả phòng";

        normalized.push({
          id: `hotel-${h.id}`,
          category: "HOTEL",
          title: label,
          message: h.message || "Kiểm tra chi tiết trong mục đặt phòng của bạn.",
          createdAt: h.created_at || new Date().toISOString(),
          read: Boolean(h.read_at),
          targetUrl: "/hotels/bookings",
        });
      });

      // 3. Partner Notifications
      partnerNotifs.forEach((p) => {
        normalized.push({
          id: `partner-${p.id}`,
          category: "PARTNER",
          title: p.title || "Thông báo kênh đối tác",
          message: p.message || "",
          createdAt: p.createdAt || new Date().toISOString(),
          read: Boolean(p.read),
          targetUrl: p.targetUri || "/partner",
        });
      });

      // 4. Chat Unread Summary
      if (chatSummary && chatSummary.unreadConversationsCount > 0) {
        normalized.push({
          id: "chat-summary",
          category: "CHAT",
          title: "Tin nhắn chưa đọc",
          message: `Bạn có ${chatSummary.unreadConversationsCount} cuộc trò chuyện chưa đọc (${chatSummary.totalUnreadMessages} tin nhắn).`,
          createdAt: new Date().toISOString(),
          read: false,
          targetUrl: "/chat",
        });
      }

      // Sort by newest first
      normalized.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setItems(normalized);
    } catch {
      // Background notifications failure should never crash the app
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    fetchAll();

    // Auto-poll every 60s while page is visible
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAll();
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [fetchAll]);

  const unreadCount = React.useMemo(() => {
    return items.filter((it) => !it.read).length;
  }, [items]);

  const markAsRead = async (item: UnifiedNotificationItem) => {
    try {
      if (item.category === "HOTEL" && item.id.startsWith("hotel-")) {
        const rawId = item.id.replace("hotel-", "");
        await notificationsApi.markHotelNotificationRead(rawId);
      } else if (item.category === "PARTNER" && item.id.startsWith("partner-")) {
        const rawId = item.id.replace("partner-", "");
        await notificationsApi.markPartnerNotificationRead(rawId);
      }

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, read: true } : it)),
      );
    } catch {
      // Ignore
    }
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all([
        notificationsApi.markAllHotelNotificationsRead().catch(() => {}),
        notificationsApi.markAllPartnerNotificationsRead().catch(() => {}),
      ]);

      setItems((prev) =>
        prev.map((it) => (it.category !== "TRIP" && it.category !== "CHAT" ? { ...it, read: true } : it)),
      );
    } catch {
      // Ignore
    }
  };

  const acceptInvitation = async (invitationId: string) => {
    await notificationsApi.acceptTripInvitation(invitationId);
    setItems((prev) => prev.filter((it) => it.invitationId !== invitationId));
  };

  const declineInvitation = async (invitationId: string) => {
    await notificationsApi.declineTripInvitation(invitationId);
    setItems((prev) => prev.filter((it) => it.invitationId !== invitationId));
  };

  return {
    items,
    unreadCount,
    loading,
    refresh: fetchAll,
    markAsRead,
    markAllAsRead,
    acceptInvitation,
    declineInvitation,
  };
}
