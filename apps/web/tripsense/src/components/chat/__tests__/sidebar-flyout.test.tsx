import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { formatTripTitle, SidebarFlyout } from "../sidebar-flyout";
import { useAiDrawerStore } from "@/stores/use-ai-drawer-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ chatId: "chat-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "vi",
    t: (key: string) => {
      const translations: Record<string, string> = {
        "aiPlanner.searchChatsAndTrips": "Tìm kiếm...",
        "aiPlanner.newChat": "Cuộc trò chuyện mới",
        "trip.newTrip": "Chuyến đi mới",
        "aiPlanner.updateAssistant": "Tùy chỉnh trợ lý",
        "nav.personalization": "Cá nhân hóa",
        "aiPlanner.sidebarTripsHeader": "Chuyến đi",
        "aiPlanner.sidebarChatsHeader": "Cuộc trò chuyện",
        "aiPlanner.deleteChatAction": "Xoá cuộc trò chuyện",
        "trip.noMatchingTrips": "Không có chuyến đi phù hợp",
        "trip.emptyTripsShort": "Chưa có chuyến đi nào",
        "aiPlanner.noMatchingChats": "Không có cuộc trò chuyện phù hợp",
        "aiPlanner.emptyChats": "Chưa có cuộc trò chuyện nào",
        "common.showMore": "Xem thêm",
        "common.showLess": "Thu gọn",
      };
      return translations[key] || key;
    },
  }),
}));

const mockTrips = [
  { id: "trip-old", name: "Trip to Huế", destinationName: "Huế", createdAt: "2026-01-01T00:00:00Z" },
  { id: "trip-mid", name: "Khám Phá Hội An", destinationName: "Hội An", createdAt: "2026-05-01T00:00:00Z" },
  { id: "trip-new", name: "Trip to Đà Nẵng", destinationName: "Đà Nẵng", createdAt: "2026-10-19T00:00:00Z" },
  { id: "trip-4", name: "Trip to Hà Nội", destinationName: "Hà Nội", createdAt: "2026-03-01T00:00:00Z" },
  { id: "trip-5", name: "Trip to Sài Gòn", destinationName: "Sài Gòn", createdAt: "2026-02-01T00:00:00Z" },
];

const mockChats = [
  { id: "chat-old", title: "Chat cũ", createdAt: "2026-01-01T00:00:00Z" },
  { id: "chat-2", title: "Chat số 2", createdAt: "2026-02-01T00:00:00Z" },
  { id: "chat-3", title: "Chat số 3", createdAt: "2026-03-01T00:00:00Z" },
  { id: "chat-4", title: "Chat số 4", createdAt: "2026-04-01T00:00:00Z" },
  { id: "chat-new", title: "Chat mới nhất", createdAt: "2026-10-19T00:00:00Z" },
];

vi.mock("@/features/trip-management/hooks/use-user-trips", () => ({
  useUserTrips: () => ({
    trips: mockTrips,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-ai-chats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-ai-chats")>();
  return {
    ...actual,
    useAiChatSessions: () => ({
      data: mockChats,
    }),
    useDeleteAiChatMutation: () => ({
      mutateAsync: vi.fn(),
    }),
  };
});

describe("formatTripTitle", () => {
  it("adapts legacy 'Trip to <Dest>' string to Vietnamese when locale is 'vi'", () => {
    expect(formatTripTitle("Trip to Đà Nẵng", "Đà Nẵng", "vi")).toBe("Chuyến đi Đà Nẵng");
    expect(formatTripTitle("Trip to Bangkok", "Bangkok", "vi")).toBe("Chuyến đi Bangkok");
  });

  it("leaves custom titles untouched", () => {
    expect(formatTripTitle("Khám Phá Hội An Trọn Vẹn", "Hội An", "vi")).toBe("Khám Phá Hội An Trọn Vẹn");
    expect(formatTripTitle("Du lịch đà nẵng 3 ngày", "Đà Nẵng", "vi")).toBe("Du lịch đà nẵng 3 ngày");
  });

  it("handles fallback to destination name based on locale", () => {
    expect(formatTripTitle(undefined, "Đà Nẵng", "vi")).toBe("Chuyến đi Đà Nẵng");
    expect(formatTripTitle(undefined, "Tokyo", "en")).toBe("Trip to Tokyo");
  });
});

describe("SidebarFlyout Component", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useAiDrawerStore.setState({ isOpen: true, searchQuery: "" });
  });

  it("renders translated navigation, headers, and localized trip names with max 3 items initially", async () => {
    await act(async () => {
      root.render(<SidebarFlyout chatId="chat-1" />);
    });

    const text = container.textContent || "";
    // Verify localized action buttons & headers
    expect(text).toContain("Cuộc trò chuyện mới");
    expect(text).toContain("Chuyến đi mới");
    expect(text).toContain("Tùy chỉnh trợ lý");
    expect(text).toContain("Cá nhân hóa");
    expect(text).toContain("Chuyến đi");
    expect(text).toContain("Cuộc trò chuyện");

    // Verify trip name localization ("Trip to Đà Nẵng" -> "Chuyến đi Đà Nẵng")
    expect(text).toContain("Chuyến đi Đà Nẵng");
    expect(text).toContain("Khám Phá Hội An");

    // Top newest trips: trip-new (Oct 19), trip-mid (May 1), trip-4 (Mar 1)
    // trip-old (Jan 1) should NOT be displayed initially
    expect(text).not.toContain("Chuyến đi Huế");

    // Verify "Xem thêm" button exists for 5 items (5 - 3 = 2 more)
    expect(text).toContain("Xem thêm (2)");

    // Top newest chat: chat-new (Oct 19) should be displayed
    expect(text).toContain("Chat mới nhất");
    expect(text).not.toContain("Chat cũ");

    // Verify search input placeholder
    const input = container.querySelector("input");
    expect(input?.getAttribute("placeholder")).toBe("Tìm kiếm...");
  });

  it("expands to show all items on click 'Xem thêm' and collapses on click 'Thu gọn'", async () => {
    await act(async () => {
      root.render(<SidebarFlyout chatId="chat-1" />);
    });

    const expandButtons = [...container.querySelectorAll("button")].filter((b) =>
      b.textContent?.includes("Xem thêm (2)")
    );
    expect(expandButtons.length).toBe(2); // One for Trips, one for Chats

    // Click to expand trips
    await act(async () => {
      expandButtons[0]?.click();
    });

    // Now all 5 trips should be visible including the oldest
    expect(container.textContent).toContain("Chuyến đi Huế");
    expect(container.textContent).toContain("Thu gọn");

    // Click again to collapse
    const collapseButton = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Thu gọn")
    );
    await act(async () => {
      collapseButton?.click();
    });

    // Back to 3 items
    expect(container.textContent).not.toContain("Chuyến đi Huế");
    expect(container.textContent).toContain("Xem thêm (2)");
  });

  it("increments visible items by 4 on each 'Xem thêm' click for large lists", async () => {
    const tenChats = Array.from({ length: 10 }, (_, i) => ({
      id: `chat-${i + 1}`,
      title: `Hội thoại số ${i + 1}`,
      userId: "user-1",
      createdAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }));

    await act(async () => {
      root.render(<SidebarFlyout chatList={tenChats} />);
    });

    // Initially 3 items shown, 7 remaining
    expect(container.textContent).toContain("Xem thêm (7)");
    expect(container.textContent).toContain("Hội thoại số 10"); // Newest
    expect(container.textContent).not.toContain("Hội thoại số 7"); // 4th item

    // Click "Xem thêm" -> loads 4 more items (3 + 4 = 7 shown, 3 remaining)
    const showMoreBtn1 = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Xem thêm (7)")
    );
    await act(async () => {
      showMoreBtn1?.click();
    });

    expect(container.textContent).toContain("Hội thoại số 7"); // 4th item now visible
    expect(container.textContent).toContain("Xem thêm (3)"); // 3 remaining
    expect(container.textContent).toContain("Thu gọn"); // Partial collapse button available

    // Click "Xem thêm" again -> loads last 3 items (7 + 4 = 11 >= 10, all shown)
    const showMoreBtn2 = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Xem thêm (3)")
    );
    await act(async () => {
      showMoreBtn2?.click();
    });

    expect(container.textContent).toContain("Hội thoại số 1"); // Oldest item now visible
    expect(container.textContent).not.toContain("Xem thêm (3)");
    expect(container.textContent).toContain("Thu gọn");

    // Click "Thu gọn" -> collapses back to 3
    const collapseBtn = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Thu gọn")
    );
    await act(async () => {
      collapseBtn?.click();
    });

    expect(container.textContent).toContain("Xem thêm (7)");
    expect(container.textContent).not.toContain("Hội thoại số 7");
  });
});
