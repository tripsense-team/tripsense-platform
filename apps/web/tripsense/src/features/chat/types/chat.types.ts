export type MessageDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export const CURRENT_USER_ID = "current-user";

export interface SharedTripPreview {
  id: string;
  available?: boolean;
  title: string;
  location: string;
  durationDays: number;
  durationNights: number;
  coverImage: string;
}

export interface ChatUser {
  id: string;
  name: string;
  avatar?: string;
  isOnline?: boolean;
  statusText?: string;
}

export interface ChatMessageItem {
  id: string;
  clientMessageId?: string;
  seq?: string;
  senderId: string; // 'current-user' or recipient's id
  text: string;
  createdAt: string; // ISO date string or relative display string
  status: MessageDeliveryStatus;
  sharedTrip?: SharedTripPreview;
  retryPayload?: string;
  sharedPostId?: string;
}

export interface Conversation {
  id: string;
  olderCursor?: string | null;
  state?: "DRAFT" | "PENDING" | "ACTIVE" | "DECLINED";
  requestDirection?: "NONE" | "INCOMING" | "OUTGOING";
  user: ChatUser;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageTimestamp: number;
  unreadCount: number;
  isRequest?: boolean;
  isMuted?: boolean;
  messages: ChatMessageItem[];
}

export type ConversationTab = "all" | "requests";
