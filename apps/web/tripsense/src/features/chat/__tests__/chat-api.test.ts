import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toChatUser,
  toChatMessage,
  toConversation,
  chatApi,
  type ServerConversation,
  type ServerMessage,
} from "../services/chat-api";
import { CURRENT_USER_ID } from "../types/chat.types";
import * as apiClientModule from "@/services/api-client";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
  authenticatedFetch: vi.fn(),
}));

describe("chatApi transformations", () => {
  it("toChatUser transforms server peer properly", () => {
    const peer = {
      userId: "u-123",
      displayName: "Khánh Linh",
      avatarUrl: "https://img.com/avatar.jpg",
    };
    const user = toChatUser(peer, true);

    expect(user.id).toBe("u-123");
    expect(user.name).toBe("Khánh Linh");
    expect(user.avatar).toBe("https://img.com/avatar.jpg");
    expect(user.isOnline).toBe(true);
  });

  it("toChatUser provides default name if displayName is blank", () => {
    const peer = {
      userId: "u-456",
      displayName: "",
      avatarUrl: null,
    };
    const user = toChatUser(peer, false);

    expect(user.id).toBe("u-456");
    expect(user.name).toBe("TripSense user");
    expect(user.avatar).toBeUndefined();
    expect(user.isOnline).toBe(false);
  });

  it("toChatMessage transforms own message to CURRENT_USER_ID and maps status", () => {
    const serverMsg: ServerMessage = {
      id: "m-1",
      clientMessageId: "c-1",
      conversationId: "conv-1",
      seq: "42",
      senderId: "my-user-id",
      type: "TEXT",
      text: "Xin chào bạn!",
      sharedTrip: null,
      createdAt: "2026-09-24T12:00:00Z",
      status: "read",
    };

    const mapped = toChatMessage(serverMsg, "my-user-id");
    expect(mapped.id).toBe("m-1");
    expect(mapped.clientMessageId).toBe("c-1");
    expect(mapped.seq).toBe("42");
    expect(mapped.senderId).toBe(CURRENT_USER_ID);
    expect(mapped.text).toBe("Xin chào bạn!");
    expect(mapped.status).toBe("read");
    expect(mapped.sharedTrip).toBeUndefined();
  });

  it("toChatMessage transforms peer message retaining original senderId and sharedTrip card", () => {
    const serverMsg: ServerMessage = {
      id: "m-2",
      clientMessageId: "c-2",
      conversationId: "conv-1",
      seq: "43",
      senderId: "peer-user-id",
      type: "SHARED_TRIP",
      text: null,
      sharedTrip: {
        id: "post-1",
        title: "Chuyến đi Đà Nẵng",
        location: "Đà Nẵng",
        durationDays: 4,
        coverImage: "https://img.com/trip.jpg",
        available: true,
      },
      createdAt: "2026-09-24T12:01:00Z",
      status: "delivered",
    };

    const mapped = toChatMessage(serverMsg, "my-user-id");
    expect(mapped.id).toBe("m-2");
    expect(mapped.senderId).toBe("peer-user-id");
    expect(mapped.status).toBe("delivered");
    expect(mapped.sharedPostId).toBe("post-1");
    expect(mapped.sharedTrip?.title).toBe("Chuyến đi Đà Nẵng");
    expect(mapped.sharedTrip?.durationDays).toBe(4);
    expect(mapped.sharedTrip?.durationNights).toBe(3);
  });

  it("toConversation transforms server conversation DTO", () => {
    const serverConv: ServerConversation = {
      id: "conv-99",
      peer: {
        userId: "peer-1",
        displayName: "Minh Anh",
        avatarUrl: null,
      },
      state: "PENDING",
      requestDirection: "INCOMING",
      lastMessage: {
        id: "m-10",
        clientMessageId: "c-10",
        conversationId: "conv-99",
        seq: "1",
        senderId: "peer-1",
        type: "TEXT",
        text: "Chào bạn!",
        sharedTrip: null,
        createdAt: "2026-09-24T10:00:00Z",
        status: "sent",
      },
      unreadCount: 1,
      muted: true,
      updatedAt: "2026-09-24T10:00:00Z",
      online: true,
    };

    const conv = toConversation(serverConv, "my-user-id");
    expect(conv.id).toBe("conv-99");
    expect(conv.user.name).toBe("Minh Anh");
    expect(conv.user.isOnline).toBe(true);
    expect(conv.isRequest).toBe(true);
    expect(conv.isMuted).toBe(true);
    expect(conv.unreadCount).toBe(1);
    expect(conv.lastMessage).toBe("Chào bạn!");
  });
});

describe("chatApi methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chatApi.list requests conversations endpoint", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({
      data: { items: [], nextCursor: null },
    } as any);

    const result = await chatApi.list();
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/social/chat/conversations?filter=all&limit=50",
      undefined
    );
    expect(result.items).toEqual([]);
  });

  it("chatApi.search sends GET to /users?query=...", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({
      data: [{ userId: "u-real-1", displayName: "Real User", avatarUrl: null }],
    } as any);

    const result = await chatApi.search("Real");
    expect(mockApiClient).toHaveBeenCalledWith(
      "/api/social/chat/users?query=Real&limit=10",
      undefined
    );
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe("Real User");
  });

  it("chatApi.search returns empty array if query has fewer than 2 characters", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    const result = await chatApi.search("a");
    expect(mockApiClient).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("chatApi.create sends POST request with recipientId", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({
      data: { id: "conv-new", state: "DRAFT" },
    } as any);

    const result = await chatApi.create("user-recip");
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ recipientId: "user-recip" }),
    });
    expect(result.id).toBe("conv-new");
  });

  it("chatApi.send sends POST request with clientMessageId and text", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({
      data: { id: "msg-123", status: "sent" },
    } as any);

    const result = await chatApi.send("conv-1", "client-uuid", "Hello!");
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/conversations/conv-1/messages", {
      method: "POST",
      body: JSON.stringify({ clientMessageId: "client-uuid", type: "TEXT", text: "Hello!" }),
    });
    expect(result.id).toBe("msg-123");
  });

  it("chatApi.block sends POST to /blocks", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({ data: null } as any);

    await chatApi.block("bad-user");
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/blocks", {
      method: "POST",
      body: JSON.stringify({ targetUserId: "bad-user" }),
    });
  });

  it("chatApi.unblock sends DELETE to /blocks/{id}", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({ data: null } as any);

    await chatApi.unblock("unblocked-user");
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/blocks/unblocked-user", {
      method: "DELETE",
    });
  });

  it("chatApi.unreadSummary sends GET to /unread-summary", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({
      data: { unreadConversationsCount: 2, totalUnreadMessages: 6 },
    } as any);

    const result = await chatApi.unreadSummary();
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/unread-summary", undefined);
    expect(result.unreadConversationsCount).toBe(2);
    expect(result.totalUnreadMessages).toBe(6);
  });

  it("chatApi.registerFcmToken sends POST to /devices/fcm-token", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({ data: null } as any);

    await chatApi.registerFcmToken("fcm-tok-123", "WEB", "CustomAgent");
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/devices/fcm-token", {
      method: "POST",
      body: JSON.stringify({ fcmToken: "fcm-tok-123", deviceType: "WEB", userAgent: "CustomAgent" }),
    });
  });

  it("chatApi.unregisterFcmToken sends DELETE to /devices/fcm-token", async () => {
    const mockApiClient = vi.mocked(apiClientModule.apiClient);
    mockApiClient.mockResolvedValueOnce({ data: null } as any);

    await chatApi.unregisterFcmToken("fcm-tok-123");
    expect(mockApiClient).toHaveBeenCalledWith("/api/social/chat/devices/fcm-token", {
      method: "DELETE",
      body: JSON.stringify({ fcmToken: "fcm-tok-123" }),
    });
  });
});
