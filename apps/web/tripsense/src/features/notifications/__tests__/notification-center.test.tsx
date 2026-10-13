import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { NotificationCenter } from "../components/notification-center";

vi.mock("../services/notifications-api", () => ({
  notificationsApi: {
    getTripInvitations: vi.fn().mockResolvedValue([
      {
        id: "inv-1",
        tripId: "trip-101",
        tripName: "Chuyến đi Đà Nẵng",
        inviterName: "Minh Anh",
        role: "EDITOR",
        createdAt: "2026-10-12T10:00:00Z",
      },
    ]),
    getHotelNotifications: vi.fn().mockResolvedValue([
      {
        id: "h-1",
        event_type: "BOOKING_CONFIRMED",
        message: "Đặt phòng tại Khách sạn Grand Da Nang đã được xác nhận.",
        read_at: null,
        created_at: "2026-10-12T09:30:00Z",
      },
    ]),
    getPartnerNotifications: vi.fn().mockResolvedValue([]),
    getChatUnreadSummary: vi.fn().mockResolvedValue({
      unreadConversationsCount: 2,
      totalUnreadMessages: 5,
    }),
    markAllHotelNotificationsRead: vi.fn().mockResolvedValue(undefined),
    markAllPartnerNotificationsRead: vi.fn().mockResolvedValue(undefined),
    acceptTripInvitation: vi.fn().mockResolvedValue(undefined),
    declineTripInvitation: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/features/auth/store/use-auth-store", () => ({
  useAuthStore: (selector: any) => selector({ isAuthenticated: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("NotificationCenter Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders notification trigger button with bell icon", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <NotificationCenter />
      </I18nProvider>
    );

    expect(html).toContain("Thông báo");
  });
});
