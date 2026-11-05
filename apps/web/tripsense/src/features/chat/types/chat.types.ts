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

export interface ReservationOfferPreview {
  id: string;
  conversationId: string;
  messageId?: string;
  senderId: string;
  recipientId: string;
  businessType: "HOTEL" | "RESTAURANT" | "GUIDE";
  businessId: string;
  businessName: string;
  businessThumbnail?: string;
  itemTitle: string;
  checkInDate: string;
  checkOutDate?: string;
  reservationTime?: string;
  adultsCount: number;
  childrenCount: number;
  totalPrice: number;
  depositAmount?: number;
  currency: string;
  inclusions?: string;
  expiresAt: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  declineReason?: string;
  bookingId?: string;
  bookingCode?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateReservationOfferPayload {
  clientMessageId: string;
  businessType: "HOTEL" | "RESTAURANT" | "GUIDE";
  businessId: string;
  businessName: string;
  businessThumbnail?: string;
  itemTitle: string;
  checkInDate: string;
  checkOutDate?: string;
  reservationTime?: string;
  adultsCount: number;
  childrenCount?: number;
  totalPrice: number;
  depositAmount?: number;
  currency?: string;
  inclusions?: string;
  validHours?: number;
}

export interface AcceptOfferResponse {
  offerId: string;
  status: string;
  bookingId: string;
  bookingCode: string;
  redirectUrl: string;
  message: string;
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
  type?: "TEXT" | "SHARED_TRIP" | "RESERVATION_OFFER";
  text: string;
  createdAt: string; // ISO date string or relative display string
  status: MessageDeliveryStatus;
  sharedTrip?: SharedTripPreview;
  offer?: ReservationOfferPreview;
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
