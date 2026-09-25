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

export const DEFAULT_SUGGESTED_USERS: ChatUser[] = [
  {
    id: "18029f68-0211-44f3-8183-6bd9e6020576",
    name: "Ngoc",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocK47Pq32UP3Dk6mnwbzf_Fb7Sb5ullD1BqzC1-81qWhiTad1TI=s96-c",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "a1111111-1111-1111-1111-111111111111",
    name: "Khánh Linh",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "a2222222-2222-2222-2222-222222222222",
    name: "Tuấn Kiệt",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Hoạt động 2 giờ trước",
  },
  {
    id: "a3333333-3333-3333-3333-333333333333",
    name: "Mai Phương",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "a4444444-4444-4444-4444-444444444444",
    name: "Thanh Tùng",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    isOnline: false,
    statusText: "Hoạt động hôm qua",
  },
  {
    id: "a5555555-5555-5555-5555-555555555555",
    name: "Minh Anh",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "a6666666-6666-6666-6666-666666666666",
    name: "Minh Hằng",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "a7777777-7777-7777-7777-777777777777",
    name: "Hoàng Long",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
  {
    id: "64a60437-097f-42ab-8736-38bf9e65d98d",
    name: "Bryan Howard",
    avatar: "https://lh3.googleusercontent.com/a/ACg8ocIIxhYGmNFwfZ-0oe4Px-rLFeEIChKvGthwt9IxFB50t1HIcRo=s96-c",
    isOnline: true,
    statusText: "Đang hoạt động",
  },
];

const ID_ALIAS_MAP: Record<string, string> = {
  "creator-1": "a6666666-6666-6666-6666-666666666666",
  "creator-2": "a7777777-7777-7777-7777-777777777777",
  "creator-3": "a1111111-1111-1111-1111-111111111111",
  "creator-4": "a2222222-2222-2222-2222-222222222222",
  "user-linh": "a1111111-1111-1111-1111-111111111111",
  "user-kiet": "a2222222-2222-2222-2222-222222222222",
  "user-phuong": "a3333333-3333-3333-3333-333333333333",
  "user-tung": "a4444444-4444-4444-4444-444444444444",
  "u-minhanh": "a5555555-5555-5555-5555-555555555555",
};

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
  messages: async (id: string, before?: string) => {
    if (id.startsWith("conv-local-")) {
      return { items: [], nextCursor: null };
    }
    return call<Page<ServerMessage>>(
      `/conversations/${id}/messages?limit=50${before ? `&beforeSeq=${encodeURIComponent(before)}` : ""}`
    );
  },
  search: async (query: string) => {
    const trimmed = query.trim();
    const normalized = removeDiacritics(trimmed);
    let remote: Array<{ userId: string; displayName: string; avatarUrl: string | null }> = [];
    if (trimmed.length >= 2) {
      try {
        remote = await call<Array<{ userId: string; displayName: string; avatarUrl: string | null }>>(
          `/users?query=${encodeURIComponent(trimmed)}&limit=10`
        );
      } catch {
        remote = [];
      }
    }
    const local = DEFAULT_SUGGESTED_USERS.filter((user) =>
      removeDiacritics(user.name).includes(normalized)
    ).map((user) => ({
      userId: user.id,
      displayName: user.name,
      avatarUrl: user.avatar || null,
    }));

    const seen = new Set<string>();
    const result: Array<{ userId: string; displayName: string; avatarUrl: string | null }> = [];
    for (const item of [...remote, ...local]) {
      if (!seen.has(item.userId)) {
        seen.add(item.userId);
        result.push(item);
      }
    }
    return result;
  },
  create: async (recipientId: string) => {
    const resolvedId = ID_ALIAS_MAP[recipientId] || recipientId;
    try {
      return await call<ServerConversation>("/conversations", {
        method: "POST",
        body: JSON.stringify({ recipientId: resolvedId }),
      });
    } catch {
      const target = DEFAULT_SUGGESTED_USERS.find(
        (u) => u.id === resolvedId || u.id === recipientId
      );
      return {
        id: `conv-local-${resolvedId}`,
        peer: {
          userId: resolvedId,
          displayName: target?.name || "TripSense user",
          avatarUrl: target?.avatar || null,
        },
        state: "ACTIVE" as const,
        requestDirection: "NONE" as const,
        lastMessage: null,
        unreadCount: 0,
        muted: false,
        updatedAt: new Date().toISOString(),
        online: target?.isOnline ?? true,
      };
    }
  },
  send: async (id: string, clientMessageId: string, text: string) => {
    if (id.startsWith("conv-local-")) {
      return {
        id: `msg-${clientMessageId}`,
        clientMessageId,
        conversationId: id,
        seq: `${Date.now()}`,
        senderId: CURRENT_USER_ID,
        type: "TEXT" as const,
        text,
        sharedTrip: null,
        createdAt: new Date().toISOString(),
        status: "delivered",
      };
    }
    return call<ServerMessage>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ clientMessageId, type: "TEXT", text }),
    });
  },
  sharedTrip: (id: string, clientMessageId: string, sharedPostId: string) => call<ServerMessage>(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({clientMessageId,type:"SHARED_TRIP",sharedPostId}) }),
  read: (id: string, throughSeq: string) => {
    if (id.startsWith("conv-local-")) return Promise.resolve(null as unknown as ServerConversation);
    return call<ServerConversation>(`/conversations/${id}/read`, { method: "PUT", body: JSON.stringify({ throughSeq }) });
  },
  delivered: (id: string, throughSeq: string) => {
    if (id.startsWith("conv-local-")) return Promise.resolve(null as unknown as ServerConversation);
    return call<ServerConversation>(`/conversations/${id}/delivered`, { method: "PUT", body: JSON.stringify({ throughSeq }) });
  },
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
