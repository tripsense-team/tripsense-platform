import { apiClient, authenticatedFetch } from "@/services/api-client";
import type { ChatMessageItem, ChatUser, Conversation } from "../types/chat.types";
import { CURRENT_USER_ID } from "../types/chat.types";
import type { SocialPostPageResponse } from "@/features/social-post/types";

const ROOT = "/api/social/chat";
type Envelope<T> = { data: T };
export type ServerMessage = {
  id: string;
  clientMessageId: string;
  conversationId: string;
  seq: string;
  senderId: string;
  type: "TEXT" | "SHARED_TRIP";
  text: string | null;
  sharedTrip: {
    id: string; title: string | null; location: string | null;
    durationDays: number | null; coverImage: string | null; available: boolean;
  } | null;
  createdAt: string;
  status: string;
};
export type ServerConversation = {
  id: string;
  peer: { userId: string; displayName: string; avatarUrl: string | null };
  state: "DRAFT" | "PENDING" | "ACTIVE" | "DECLINED";
  requestDirection: "NONE" | "INCOMING" | "OUTGOING";
  lastMessage: ServerMessage | null;
  unreadCount: number;
  muted: boolean;
  updatedAt: string;
  online: boolean;
};
type Page<T> = { items: T[]; nextCursor: string | null };

export function removeDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

async function call<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiClient<Envelope<T>>(`${ROOT}${path}`, options);
  return response.data;
}

export const chatApi = {
  list: (cursor?: string) => call<Page<ServerConversation>>(`/conversations?filter=all&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`),
  messages: (id: string, before?: string) =>
    call<Page<ServerMessage>>(
      `/conversations/${id}/messages?limit=50${before ? `&beforeSeq=${encodeURIComponent(before)}` : ""}`
    ),
  search: async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }
    try {
      return await call<Array<{ userId: string; displayName: string; avatarUrl: string | null }>>(
        `/users?query=${encodeURIComponent(trimmed)}&limit=10`
      );
    } catch {
      return [];
    }
  },
  create: (recipientId: string) =>
    call<ServerConversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ recipientId }),
    }),
  send: (id: string, clientMessageId: string, text: string) =>
    call<ServerMessage>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ clientMessageId, type: "TEXT", text }),
    }),
  sharedTrip: (id: string, clientMessageId: string, sharedPostId: string) => call<ServerMessage>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({clientMessageId,type:"SHARED_TRIP",sharedPostId}) }),
  read: (id: string, throughSeq: string) =>
    call<ServerConversation>(`/conversations/${id}/read`, { method: "PUT", body: JSON.stringify({ throughSeq }) }),
  delivered: (id: string, throughSeq: string) =>
    call<ServerConversation>(`/conversations/${id}/delivered`, { method: "PUT", body: JSON.stringify({ throughSeq }) }),
  accept: (id: string) => call<ServerConversation>(`/conversations/${id}/accept`, {method:"POST"}),
  decline: (id: string) => call<ServerConversation>(`/conversations/${id}/decline`, {method:"POST"}),
  mute: (id: string, muted: boolean) => call<ServerConversation>(`/conversations/${id}/mute`, {method:"PUT",body:JSON.stringify({muted})}),
  block: (targetUserId: string) => call<void>("/blocks", {method:"POST",body:JSON.stringify({targetUserId})}),
  unblock: (targetUserId: string) => call<void>(`/blocks/${targetUserId}`, {method:"DELETE"}),
  blocks: () => call<Page<{userId:string;displayName:string;avatarUrl:string|null}>>("/blocks?limit=50"),
  shareableTrips: async (userId: string) => {
    const result = await apiClient<Envelope<SocialPostPageResponse>>(`/api/social/posts?userId=${encodeURIComponent(userId)}&type=TRIP_SHARE&page=0&size=50`);
    return result.data.items.filter((post) => post.visibility === "PUBLIC" && post.trip);
  },
  unreadSummary: () => call<{ unreadConversationsCount: number; totalUnreadMessages: number }>("/unread-summary"),
  registerFcmToken: (fcmToken: string, deviceType = "WEB", userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") =>
    call<void>("/devices/fcm-token", { method: "POST", body: JSON.stringify({ fcmToken, deviceType, userAgent }) }),
  unregisterFcmToken: (fcmToken: string) =>
    call<void>("/devices/fcm-token", { method: "DELETE", body: JSON.stringify({ fcmToken }) }),
  testPushNotification: () =>
    call<boolean>("/devices/test-push", { method: "POST" }),
  report: (id: string, reportedUserId: string, reason: string) => call<{id:string;status:string}>(`/conversations/${id}/reports`, {method:"POST",body:JSON.stringify({reportedUserId,reason})}),
  stream: (signal: AbortSignal) => authenticatedFetch(`${ROOT}/events`, {headers:{Accept:"text/event-stream, application/json;q=0.9"},signal}),
};

export function toChatUser(peer: ServerConversation["peer"], online = false): ChatUser {
  return {id:peer.userId,name:peer.displayName || "TripSense user",avatar:peer.avatarUrl || undefined,isOnline:online};
}

export function toChatMessage(message: ServerMessage, ownId: string): ChatMessageItem {
  const trip = message.sharedTrip;
  return {
    id:message.id,
    clientMessageId:message.clientMessageId,
    seq:message.seq,
    senderId:message.senderId===ownId?CURRENT_USER_ID:message.senderId,
    text:message.text || "",
    createdAt:message.createdAt,
    status:message.status==="read"?"read":message.status==="delivered"?"delivered":"sent",
    sharedPostId:trip?.id,
    sharedTrip:trip ? {
      id:trip.id,available:trip.available,title:trip.title || "",location:trip.location || "",
      durationDays:trip.durationDays || 0,durationNights:Math.max(0,(trip.durationDays || 0)-1),
      coverImage:trip.coverImage || "",
    } : undefined,
  };
}

export function toConversation(server: ServerConversation, ownId: string, messages: ChatMessageItem[] = []): Conversation {
  return {
    id:server.id,
    user:toChatUser(server.peer,server.online),
    state:server.state,
    requestDirection:server.requestDirection,
    lastMessage:server.lastMessage?.text || (server.lastMessage?.type==="SHARED_TRIP" ? "Trip" : ""),
    lastMessageTime:server.lastMessage?.createdAt || server.updatedAt,
    lastMessageTimestamp:Date.parse(server.lastMessage?.createdAt || server.updatedAt),
    unreadCount:server.unreadCount,
    isRequest:server.requestDirection==="INCOMING",
    isMuted:server.muted,
    messages,
  };
}
