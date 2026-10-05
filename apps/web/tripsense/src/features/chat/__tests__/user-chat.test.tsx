import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { mockChatService, CURRENT_USER_ID } from "../services/mock-chat-service";
import { SharedTripCard } from "../components/shared-trip-card";
import { ChatComposer } from "../components/chat-composer";
import { MessageRequestBanner } from "../components/message-request-banner";
import { PrototypeNotice } from "../components/prototype-notice";
import { ChatSidebar } from "../components/chat-sidebar";

// Mock i18n
vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) {
        let res = key;
        Object.entries(params).forEach(([k, v]) => {
          res += `:${k}=${v}`;
        });
        return res;
      }
      return key;
    },
  }),
}));

describe("User Chat - MockChatService", () => {
  beforeEach(() => {
    mockChatService.reset();
  });

  it("initializes with sample conversations and unread counts", () => {
    const conversations = mockChatService.getConversations();
    expect(conversations.length).toBeGreaterThan(0);

    const requestCount = mockChatService.getRequestCount();
    expect(requestCount).toBe(1);

    const normalConversations = conversations.filter((c) => !c.isRequest);
    expect(normalConversations.length).toBe(3);

    // Verify conv-1 has 6-10 alternating messages
    const conv1 = mockChatService.getConversationById("conv-1");
    expect(conv1?.messages.length).toBeGreaterThanOrEqual(8);
  });

  it("searches users by display name and NEVER exposes user emails", () => {
    const results = mockChatService.searchUsersByDisplayName("Linh");
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Khánh Linh");

    // Strict privacy requirement: verify no email property exists in ChatUser
    results.forEach((user) => {
      expect((user as unknown as Record<string, unknown>).email).toBeUndefined();
    });
  });

  it("starts a new conversation without adding fake recipient welcome messages", () => {
    const targetUser = {
      id: "u-test-traveler",
      name: "Traveler Test",
    };

    const newConv = mockChatService.startNewConversation(targetUser);
    expect(newConv.user.name).toBe("Traveler Test");
    // Requirement 14: no fake welcome message sent by recipient
    expect(newConv.messages.length).toBe(0);
  });

  it("optimistically adds message and marks status as sent after completion", async () => {
    const convId = "conv-1";
    const sendPromise = mockChatService.sendMessage(convId, "Xin chào bạn!");

    // Check optimistic addition immediately
    const conv = mockChatService.getConversationById(convId);
    const lastMsg = conv?.messages[conv.messages.length - 1];
    expect(lastMsg?.text).toBe("Xin chào bạn!");
    expect(lastMsg?.senderId).toBe(CURRENT_USER_ID);

    const res = await sendPromise;
    expect(res.success).toBe(true);
    expect(res.message.status).toBe("sent");
  });

  it("simulates message delivery failure when failure simulation is enabled", async () => {
    mockChatService.setSimulateFailure(true);
    const convId = "conv-1";

    const res = await mockChatService.sendMessage(convId, "Tin nhắn thử nghiệm lỗi");
    expect(res.success).toBe(false);
    expect(res.message.status).toBe("failed");
    expect(res.message.retryPayload).toBe("Tin nhắn thử nghiệm lỗi");
  });

  it("retries a failed message and updates its status to sent", async () => {
    const convId = "conv-2"; // conv-2 has a pre-configured failed message
    const conv = mockChatService.getConversationById(convId);
    const failedMsg = conv?.messages.find((m) => m.status === "failed");
    expect(failedMsg).toBeDefined();

    if (failedMsg) {
      const res = await mockChatService.retryMessage(convId, failedMsg.id);
      expect(res.success).toBe(true);

      const updatedMsg = conv?.messages.find((m) => m.id === failedMsg.id);
      expect(updatedMsg?.status).toBe("sent");
    }
  });

  it("accepts incoming message request and moves it to normal conversations", () => {
    const requestId = "conv-4";
    expect(mockChatService.getConversationById(requestId)?.isRequest).toBe(true);

    mockChatService.acceptRequest(requestId);
    expect(mockChatService.getConversationById(requestId)?.isRequest).toBe(false);
    expect(mockChatService.getRequestCount()).toBe(0);
  });

  it("declines message request and removes conversation", () => {
    const requestId = "conv-4";
    mockChatService.declineRequest(requestId);
    expect(mockChatService.getConversationById(requestId)).toBeUndefined();
  });

  it("blocks user, removes conversation, and removes user from available list", () => {
    const convId = "conv-1";
    const targetUserId = mockChatService.getConversationById(convId)?.user.id;

    mockChatService.blockUser(convId);
    expect(mockChatService.getConversationById(convId)).toBeUndefined();

    const available = mockChatService.getAvailableUsers();
    expect(available.some((u) => u.id === targetUserId)).toBe(false);
  });

  it("toggles notification mute status", () => {
    const convId = "conv-1";
    expect(mockChatService.getConversationById(convId)?.isMuted).toBe(false);

    const muted = mockChatService.toggleMute(convId);
    expect(muted).toBe(true);
    expect(mockChatService.getConversationById(convId)?.isMuted).toBe(true);
  });
});

describe("User Chat - Component Rendering", () => {
  it("renders PrototypeNotice with disclaimer and tools popover trigger", () => {
    const html = renderToString(
      <PrototypeNotice
        isOffline={false}
        simulateFailure={false}
        onRefresh={() => {}}
      />
    );

    expect(html).toContain("chat.prototype.badge");
    expect(html).toContain("chat.prototype.dataDisclaimer");
    expect(html).toContain("chat.prototype.tools");
  });

  it("renders SharedTripCard with trip information and specific trip link", () => {
    const trip = {
      id: "trip-test-123",
      title: "Hành trình Quy Nhơn 3N2Đ",
      location: "Quy Nhơn, Bình Định",
      durationDays: 3,
      durationNights: 2,
      coverImage: "https://example.com/photo.jpg",
    };

    const html = renderToString(<SharedTripCard trip={trip} />);
    expect(html).toContain("Hành trình Quy Nhơn 3N2Đ");
    expect(html).toContain("Quy Nhơn, Bình Định");
    expect(html).toContain("/community/posts/trip-test-123");
    expect(html).toContain("chat.sharedTrip.duration");
    expect(html).toContain("chat.sharedTrip.viewTrip");
  });

  it("renders ChatComposer without character counter when empty (< 1800 chars)", () => {
    const html = renderToString(
      <ChatComposer onSendMessage={() => {}} />
    );

    expect(html).not.toContain("chat.composer.charCount");
    expect(html).toContain("chat.composer.placeholder");
  });

  it("renders MessageRequestBanner with user name and 3 distinct action buttons", () => {
    const user = {
      id: "user-request",
      name: "Trần Văn A",
    };

    const html = renderToString(
      <MessageRequestBanner
        user={user}
        onAccept={() => {}}
        onDecline={() => {}}
        onBlock={() => {}}
      />
    );

    expect(html).toContain("chat.requestBanner.title");
    expect(html).toContain("chat.requestBanner.accept");
    expect(html).toContain("chat.requestBanner.decline");
    expect(html).toContain("chat.requestBanner.block");
  });

  it("renders ChatSidebar with conversation list, tabs, and unread counts", () => {
    const conversations = mockChatService.getConversations();

    const html = renderToString(
      <ChatSidebar
        conversations={conversations}
        activeConversationId="conv-1"
        onSelectConversation={() => {}}
        onOpenNewChat={() => {}}
        searchQuery=""
        onSearchChange={() => {}}
        activeTab="all"
        onTabChange={() => {}}
        requestCount={1}
        totalUnreadCount={2}
      />
    );

    expect(html).toContain("chat.messages");
    expect(html).toContain("chat.tabs.all");
    expect(html).not.toContain("chat.tabs.unread");
    expect(html).toContain("chat.tabs.requests");
    expect(html).toContain("Minh Anh");
  });
});
