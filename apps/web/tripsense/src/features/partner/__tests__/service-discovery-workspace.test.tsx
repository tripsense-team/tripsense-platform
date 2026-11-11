import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";

const {
  apiClientMock,
  searchPublicRentalsMock,
  searchPublicHotelsMock,
  searchPublicRestaurantsMock,
  getPartnerContextMock,
} = vi.hoisted(() => ({
  apiClientMock: vi.fn(),
  searchPublicRentalsMock: vi.fn(),
  searchPublicHotelsMock: vi.fn(),
  searchPublicRestaurantsMock: vi.fn(),
  getPartnerContextMock: vi.fn(),
}));

vi.mock("@/services/api-client", () => ({
  apiClient: apiClientMock,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/features/auth/store/use-auth-store", () => ({
  useAuthStore: (selector: (s: { user: { id: string; role: string; roles: string[] }; isAuthenticated: boolean }) => unknown) =>
    selector({
      isAuthenticated: true,
      user: { id: "partner-1", role: "ROLE_PARTNER", roles: ["ROLE_USER", "ROLE_PARTNER"] },
    }),
}));

vi.mock("@/features/reservations/hooks/use-booking-activity-summary", () => ({
  useBookingActivitySummary: () => ({
    userSummary: null,
    partnerSummary: {
      pendingTotal: 4,
      unreadNotificationCount: 2,
      recommendedDashboardTab: "bookings",
      byServiceType: { RENTAL: 3, HOTEL: 1, RESTAURANT: 0 },
      businesses: [
        {
          businessId: "biz-rental-1",
          kind: "RENTAL_SERVICE",
          pendingCount: 3,
          unreadNotificationCount: 1,
        },
      ],
    },
    pendingOfferCounts: { hotels: 0, restaurants: 0, rentals: 0 },
    verticalAttentionCounts: { hotels: 0, restaurants: 0, rentals: 0 },
    verticalUnreadCounts: { hotels: 0, restaurants: 0, rentals: 0 },
    recommendedUserTab: "hotels",
    userBadgeCount: 1,
    partnerPendingCount: 4,
    loading: false,
    refresh: vi.fn(),
    markVerticalSeen: vi.fn(),
    notifyBookingActivityChanged: vi.fn(),
  }),
}));

vi.mock("../services/rental-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/rental-api")>();
  return {
    ...actual,
    searchPublicRentals: searchPublicRentalsMock,
  };
});

vi.mock("../services/partner-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/partner-api")>();
  return {
    ...actual,
    searchPublicHotels: searchPublicHotelsMock,
    searchPublicRestaurants: searchPublicRestaurantsMock,
    getPartnerContext: getPartnerContextMock,
  };
});

vi.mock("@/features/hotels/components/mindtrip-hotel-detail-overlay", () => ({
  MindtripHotelDetailOverlay: ({ hotel }: { hotel: { name: string } }) => (
    <div data-testid="hotel-overlay">{hotel.name}</div>
  ),
}));

vi.mock("../components/partner-bookings-hub", () => ({
  PartnerBookingsHub: () => <div data-testid="partner-bookings-hub-mock" />,
}));

import { searchPublicRentals } from "../services/rental-api";
import { ServiceDiscoveryWorkspace } from "../components/service-discovery-workspace";
import { PartnerBusinessCard } from "../components/partner-business-card";
import { PartnerDashboardView } from "../components/partner-dashboard-view";
import { PartnerBookingsView } from "../components/partner-bookings-view";
import type { BusinessDetailDto } from "../types";

describe("ServiceDiscoveryWorkspace & Partner Pending Activity Badges", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    searchPublicRentalsMock.mockResolvedValue([
      {
        id: "biz-rental-1",
        ownerUserId: "owner-1",
        displayName: "Vân Khang Car - VF3 Đà Nẵng",
        address: "334/3 Nguyễn Văn Linh",
        destination: "Đà Nẵng",
        openingHours: "07:00 - 22:00",
        verifiedPartner: true,
        acceptingNew: true,
        hasDirectInventory: true,
        minPricePerDay: 600000,
        items: [
          {
            id: "item-vf3",
            businessId: "biz-rental-1",
            name: "VinFast VF3 Tự Lái",
            category: "CAR_4_SEATS",
            images: [],
            pricePerDay: 600000,
            depositAmount: 2000000,
            totalInventory: 3,
            deliveryAvailable: true,
            pickupOption: "BOTH",
            specifications: {},
            active: true,
            createdAt: "2026-11-10T00:00:00Z",
            updatedAt: "2026-11-10T00:00:00Z",
          },
        ],
      },
    ]);
    searchPublicHotelsMock.mockResolvedValue([
      {
        id: "biz-hotel-1",
        ownerUserId: "owner-2",
        displayName: "Riverside Heritage Hotel",
        address: "10 Bạch Đằng",
        destination: "Đà Nẵng",
        verifiedPartner: true,
        acceptingNew: true,
        hasDirectInventory: true,
        minPricePerNight: 850000,
        propertyId: "prop-1",
      },
    ]);
    searchPublicRestaurantsMock.mockResolvedValue([
      {
        id: "biz-rest-1",
        ownerUserId: "owner-3",
        displayName: "Bánh Xèo Làng",
        address: "25 Trần Phú",
        destination: "Đà Nẵng",
        verifiedPartner: true,
        acceptingNew: true,
        menu: [],
      },
    ]);
    getPartnerContextMock.mockResolvedValue({
      role: "ROLE_PARTNER",
      roles: ["ROLE_USER", "ROLE_PARTNER"],
      businesses: [],
    });

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

  it("serializes optional category and onlyAccepting parameters in searchPublicRentals", async () => {
    const rentalApiMod = await vi.importActual<typeof import("../services/rental-api")>(
      "../services/rental-api",
    );
    apiClientMock.mockResolvedValueOnce({ success: true, data: [] });
    await rentalApiMod.searchPublicRentals("VF3", {
      category: "CAR_4_SEATS",
      onlyAccepting: true,
    });

    expect(apiClientMock).toHaveBeenCalledWith(
      "/api/public/rentals?query=VF3&category=CAR_4_SEATS&onlyAccepting=true",
      expect.anything(),
    );
    expect(searchPublicRentals).toBeTypeOf("function");
  });

  it("renders ready-to-book rental items, partner hotels, and restaurants with no coming-soon placeholders", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <I18nProvider initialLocale="vi">
          <ServiceDiscoveryWorkspace />
        </I18nProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const text = container.textContent || "";
    expect(text).toContain("VinFast VF3 Tự Lái");
    expect(text).toContain("Đặt thuê ngay");
    expect(text).toContain("Riverside Heritage Hotel");
    expect(text).toContain("Chọn phòng & Đặt ngay");
    expect(text).toContain("Bánh Xèo Làng");
    expect(text).toContain("Đặt bàn ngay");
    expect(text).not.toContain("Sắp ra mắt");
  });

  it("keeps PartnerDashboardView separated from PartnerBookingsView while linking pending business badges to /partner/bookings", async () => {
    const sampleBusiness: BusinessDetailDto = {
      id: "biz-rental-1",
      displayName: "Vân Khang Car",
      kind: "RENTAL_SERVICE",
      ownerUserId: "partner-1",
      approvalValidity: "VALID",
      operationState: "ACTIVE",
      publicationState: "PUBLISHED",
      acceptingNew: true,
      requiresReverification: false,
      reverificationApplicationId: null,
      latestApplicationState: "APPROVED",
      myRole: "OWNER",
      suspensionVersion: 0,
      publicEligible: true,
      newIntakeEligible: true,
      version: 1,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    getPartnerContextMock.mockResolvedValue({
      role: "ROLE_PARTNER",
      roles: ["ROLE_USER", "ROLE_PARTNER"],
      businesses: [sampleBusiness],
    });

    await act(async () => {
      root = createRoot(container);
      root.render(
        <I18nProvider initialLocale="vi">
          <>
            <PartnerBusinessCard business={sampleBusiness} pendingBookingsCount={3} />
            <PartnerDashboardView />
          </>
        </I18nProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain("Đơn đặt thuê");
    expect(container.textContent).toContain("3");
    const bookingsAnchor = container.querySelector('a[href="/partner/bookings?businessId=biz-rental-1"]');
    expect(bookingsAnchor).not.toBeNull();
    // Business management (/partner) stays cleanly separated from PartnerBookingsHub
    expect(container.querySelector('[data-testid="partner-bookings-hub-mock"]')).toBeNull();

    await act(async () => {
      root?.render(
        <I18nProvider initialLocale="vi">
          <PartnerBookingsView />
        </I18nProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(container.textContent).toContain("Quản lý Đơn đặt & Booking");
    expect(container.querySelector('[data-testid="partner-bookings-hub-mock"]')).not.toBeNull();
  });
});
