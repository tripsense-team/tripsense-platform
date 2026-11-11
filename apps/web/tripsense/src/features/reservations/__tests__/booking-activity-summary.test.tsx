import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";

const {
  apiClientMock,
  mockState,
  searchParamsState,
  markVerticalSeenMock,
  getMyRentalBookingsMock,
  myOffersMock,
} = vi.hoisted(() => ({
  apiClientMock: vi.fn(),
  mockState: {
    userSummary: {
      totalAttentionCount: 2,
      unreadNotificationCount: 1,
      recommendedTab: "rentals" as "hotels" | "restaurants" | "rentals",
      verticals: {
        hotels: {
          unreadCount: 0,
          pendingCount: 0,
          activeCount: 1,
          totalCount: 1,
          attentionCount: 0,
          latestActivityAt: null,
        },
        restaurants: {
          unreadCount: 0,
          pendingCount: 0,
          activeCount: 0,
          totalCount: 0,
          attentionCount: 0,
          latestActivityAt: null,
        },
        rentals: {
          unreadCount: 1,
          pendingCount: 1,
          activeCount: 2,
          totalCount: 2,
          attentionCount: 2,
          latestActivityAt: "2026-11-10T15:00:00Z",
        },
      },
    },
  },
  searchParamsState: {
    tab: null as string | null,
  },
  markVerticalSeenMock: vi.fn(),
  getMyRentalBookingsMock: vi.fn(),
  myOffersMock: vi.fn(),
}));

vi.mock("@/services/api-client", () => ({
  apiClient: apiClientMock,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "tab" ? searchParamsState.tab : null),
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("../hooks/use-booking-activity-summary", () => ({
  useBookingActivitySummary: () => ({
    userSummary: mockState.userSummary,
    verticalAttentionCounts: {
      hotels: mockState.userSummary.verticals.hotels.attentionCount,
      restaurants: mockState.userSummary.verticals.restaurants.attentionCount,
      rentals: mockState.userSummary.verticals.rentals.attentionCount,
    },
    verticalUnreadCounts: {
      hotels: mockState.userSummary.verticals.hotels.unreadCount,
      restaurants: mockState.userSummary.verticals.restaurants.unreadCount,
      rentals: mockState.userSummary.verticals.rentals.unreadCount,
    },
    recommendedUserTab: mockState.userSummary.recommendedTab,
    userBadgeCount: mockState.userSummary.totalAttentionCount,
    markVerticalSeen: markVerticalSeenMock,
  }),
}));

vi.mock("@/features/chat/services/chat-api", () => ({
  chatApi: {
    myOffers: myOffersMock,
  },
}));

vi.mock("@/features/hotels", () => ({
  UserBookingsView: () => <div data-testid="hotels-bookings-view" />,
}));

vi.mock("@/features/partner", () => ({
  CustomerReservationsView: () => <div data-testid="restaurant-reservations-view" />,
}));

vi.mock("@/features/partner/services/rental-api", () => ({
  getMyRentalBookings: getMyRentalBookingsMock,
  cancelMyRentalBooking: vi.fn(),
}));

import {
  getPartnerBookingsActivitySummary,
  getUserReservationActivitySummary,
  markUserReservationVerticalSeen,
} from "../services/reservations-activity-api";
import { UnifiedReservationsHub } from "../components/unified-reservations-hub";

describe("Booking Activity Summary API & UnifiedReservationsHub", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    markVerticalSeenMock.mockResolvedValue(undefined);
    getMyRentalBookingsMock.mockResolvedValue([]);
    myOffersMock.mockResolvedValue([]);
    searchParamsState.tab = null;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  it("calls summary and mark-seen REST endpoints cleanly", async () => {
    apiClientMock.mockResolvedValueOnce({
      success: true,
      data: mockState.userSummary,
    });
    const summary = await getUserReservationActivitySummary();
    expect(apiClientMock).toHaveBeenCalledWith("/api/me/reservations/activity-summary");
    expect(summary?.recommendedTab).toBe("rentals");

    apiClientMock.mockResolvedValueOnce({
      success: true,
      data: { ...mockState.userSummary, totalAttentionCount: 1 },
    });
    await markUserReservationVerticalSeen("RENTALS");
    expect(apiClientMock).toHaveBeenLastCalledWith(
      "/api/me/reservations/activity-summary/mark-seen",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ vertical: "RENTALS" }),
      }),
    );

    apiClientMock.mockResolvedValueOnce({
      success: true,
      data: { pendingTotal: 4, recommendedDashboardTab: "bookings" },
    });
    const partnerSummary = await getPartnerBookingsActivitySummary();
    expect(apiClientMock).toHaveBeenLastCalledWith("/api/partners/bookings/activity-summary");
    expect(partnerSummary?.pendingTotal).toBe(4);
  });

  it("auto-focuses rentals tab when no ?tab= is present, marks seen, and renders tab badge count", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <I18nProvider initialLocale="vi">
          <UnifiedReservationsHub />
        </I18nProvider>,
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Thuê xe & Dịch vụ");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("Đơn đặt thuê phương tiện & dịch vụ");
    expect(markVerticalSeenMock).toHaveBeenCalledWith("rentals");
    expect(getMyRentalBookingsMock).toHaveBeenCalled();
  });

  it("respects explicit ?tab=hotels param and keeps hotels active without overriding user selection", async () => {
    searchParamsState.tab = "hotels";

    await act(async () => {
      root = createRoot(container);
      root.render(
        <I18nProvider initialLocale="vi">
          <UnifiedReservationsHub />
        </I18nProvider>,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="hotels-bookings-view"]')).not.toBeNull();
    expect(container.textContent).toContain("2");
  });
});

