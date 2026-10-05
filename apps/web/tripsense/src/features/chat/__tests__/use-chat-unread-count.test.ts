import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatUnreadStore } from "../hooks/use-chat-unread-count";
import { chatApi } from "../services/chat-api";

vi.mock("../services/chat-api", () => ({
  chatApi: {
    unreadSummary: vi.fn(),
  },
}));

describe("useChatUnreadStore", () => {
  beforeEach(() => {
    useChatUnreadStore.getState().reset();
    vi.clearAllMocks();
  });

  it("initializes with zero unread counts", () => {
    const state = useChatUnreadStore.getState();
    expect(state.unreadConversationsCount).toBe(0);
    expect(state.totalUnreadMessages).toBe(0);
  });

  it("setUnreadCount updates count and browser tab title", () => {
    useChatUnreadStore.getState().setUnreadCount(3);
    const state = useChatUnreadStore.getState();
    expect(state.unreadConversationsCount).toBe(3);
    expect(document.title).toContain("(3)");
  });

  it("decrementUnreadCount decrements count but never drops below zero", () => {
    useChatUnreadStore.getState().setUnreadCount(1);
    useChatUnreadStore.getState().decrementUnreadCount();
    expect(useChatUnreadStore.getState().unreadConversationsCount).toBe(0);

    useChatUnreadStore.getState().decrementUnreadCount();
    expect(useChatUnreadStore.getState().unreadConversationsCount).toBe(0);
  });

  it("fetchUnreadSummary updates store from chatApi", async () => {
    vi.mocked(chatApi.unreadSummary).mockResolvedValueOnce({
      unreadConversationsCount: 4,
      totalUnreadMessages: 12,
    });

    await useChatUnreadStore.getState().fetchUnreadSummary();

    const state = useChatUnreadStore.getState();
    expect(state.unreadConversationsCount).toBe(4);
    expect(state.totalUnreadMessages).toBe(12);
    expect(document.title).toContain("(4)");
  });

  it("reset restores counts to zero and removes prefix from tab title", () => {
    useChatUnreadStore.getState().setUnreadCount(5);
    expect(document.title).toContain("(5)");

    useChatUnreadStore.getState().reset();
    expect(useChatUnreadStore.getState().unreadConversationsCount).toBe(0);
    expect(document.title).not.toMatch(/^\(\d+\)/);
  });
});
