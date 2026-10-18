export type NotificationCategory = "ALL" | "TRIP" | "HOTEL" | "CHAT" | "PARTNER";

export interface UnifiedNotificationItem {
  id: string;
  category: "TRIP" | "HOTEL" | "CHAT" | "PARTNER";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  targetUrl: string;
  invitationId?: string;
  senderName?: string;
}
