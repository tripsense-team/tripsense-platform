import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchAiChatsQueryFn,
  fetchChatMessagesQueryFn,
  fetchTripAiChatsQueryFn,
} from "../use-ai-chats";

describe("use-ai-chats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchAiChatsQueryFn returns chat list on success", async () => {
    const mockChats = [
      {
        id: "chat-1",
        userId: "guest",
        title: "Kế Hoạch Du Lịch Huế 3 Ngày",
        createdAt: "2026-09-30T00:00:00.000Z",
        updatedAt: "2026-09-30T00:00:00.000Z",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chats: mockChats }),
    } as unknown as Response);

    const result = await fetchAiChatsQueryFn();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Kế Hoạch Du Lịch Huế 3 Ngày");
  });

  it("fetchAiChatsQueryFn returns empty array on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchAiChatsQueryFn();
    expect(result).toEqual([]);
  });

  it("fetchChatMessagesQueryFn parses message parts correctly on click", async () => {
    const mockMessages = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Lên lịch trình Huế" }],
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Chào bạn, đây là lịch trình..." }],
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: mockMessages }),
    } as unknown as Response);

    const result = await fetchChatMessagesQueryFn("chat-1");
    expect(result).toHaveLength(2);
    expect((result[0].parts[0] as { type: "text"; text: string }).text).toBe("Lên lịch trình Huế");
    expect(result[1].role).toBe("assistant");
  });

  it("fetchTripAiChatsQueryFn queries by tripId and strictly filters out chats belonging to other trips", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chats: [
          {
            id: "chat-linked",
            userId: "user-1",
            title: "Lịch trình Đà Nẵng",
            tripId: "trip-target",
            createdAt: "2026-11-15T00:00:00.000Z",
            updatedAt: "2026-11-15T00:00:00.000Z",
          },
          {
            id: "chat-other-trip",
            userId: "user-1",
            title: "Lịch trình Đà Nẵng",
            tripId: "trip-other",
            createdAt: "2026-11-14T00:00:00.000Z",
            updatedAt: "2026-11-14T00:00:00.000Z",
          },
          {
            id: "chat-unlinked",
            userId: "user-1",
            title: "Lịch trình Đà Nẵng",
            tripId: null,
            createdAt: "2026-11-14T00:00:00.000Z",
            updatedAt: "2026-11-14T00:00:00.000Z",
          },
        ],
      }),
    } as unknown as Response);
    global.fetch = fetchMock;

    const result = await fetchTripAiChatsQueryFn("trip-target");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/chats?tripId=trip-target"),
      expect.anything(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("chat-linked");
  });
});
