import { apiClient } from "@/services/api-client";
import type { TripInvitation } from "@/features/trip-management/types";
import type { HotelNotification } from "@/features/hotels/types";
import type { PartnerNotificationDto } from "@/features/partner/types";

interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const notificationsApi = {
  async getTripInvitations(): Promise<TripInvitation[]> {
    try {
      const res = await apiClient<Envelope<TripInvitation[]>>(
        "/api/trips/invitations/pending",
      );
      return res.data || [];
    } catch {
      return [];
    }
  },

  async acceptTripInvitation(invitationId: string): Promise<void> {
    await apiClient(`/api/trips/invitations/${invitationId}/accept`, {
      method: "POST",
    });
  },

  async declineTripInvitation(invitationId: string): Promise<void> {
    await apiClient(`/api/trips/invitations/${invitationId}/decline`, {
      method: "POST",
    });
  },

  async getHotelNotifications(): Promise<HotelNotification[]> {
    try {
      const res = await apiClient<Envelope<HotelNotification[]>>(
        "/api/hotels/notifications",
      );
      return res.data || [];
    } catch {
      return [];
    }
  },

  async markHotelNotificationRead(id: string): Promise<void> {
    await apiClient(`/api/hotels/notifications/${id}/read`, {
      method: "POST",
    });
  },

  async markAllHotelNotificationsRead(): Promise<void> {
    await apiClient("/api/hotels/notifications/read-all", {
      method: "POST",
    });
  },

  async getPartnerNotifications(): Promise<PartnerNotificationDto[]> {
    try {
      const res = await apiClient<Envelope<PartnerNotificationDto[]>>(
        "/api/partners/notifications",
      );
      return res.data || [];
    } catch {
      return [];
    }
  },

  async markPartnerNotificationRead(id: string): Promise<void> {
    await apiClient(`/api/partners/notifications/${id}/read`, {
      method: "POST",
    });
  },

  async markAllPartnerNotificationsRead(): Promise<void> {
    await apiClient("/api/partners/notifications/read-all", {
      method: "POST",
    });
  },

  async getChatUnreadSummary(): Promise<{ unreadConversationsCount: number; totalUnreadMessages: number } | null> {
    try {
      const res = await apiClient<Envelope<{ unreadConversationsCount: number; totalUnreadMessages: number }>>(
        "/api/social/chat/unread-summary",
      );
      return res.data || null;
    } catch {
      return null;
    }
  },
};
