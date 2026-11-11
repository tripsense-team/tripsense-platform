import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { PartnerBookingsHub } from "../components/partner-bookings-hub";
import type { BusinessDetailDto } from "../types";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue || _key,
  }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("../services/partner-api", () => ({
  getBusinessRestaurantReservations: vi.fn().mockResolvedValue({
    content: [
      {
        id: "res-001",
        businessId: "biz-rest-1",
        businessName: "Hawa's Food Đà Nẵng",
        customerId: "cust-1",
        customerName: "Nguyễn Văn A",
        customerEmail: "nguyenvana@gmail.com",
        startAt: "2026-11-05T19:00:00Z",
        adults: 2,
        children: 1,
        notes: "[Khách đặt: Nguyễn Văn A | SĐT: 0984566677] - Ghi chú: bàn cạnh ban công",
        state: "REQUESTED",
        version: 1,
      },
    ],
    totalElements: 1,
  }),
  decideRestaurantReservation: vi.fn().mockResolvedValue({
    id: "res-001",
    state: "CONFIRMED",
    version: 2,
  }),
}));

vi.mock("@/features/hotels/services/hotels-api", () => ({
  hotelApi: vi.fn().mockImplementation((url: string) => {
    if (url === "/properties") {
      return Promise.resolve([
        {
          id: "prop-1",
          business_id: "biz-htl-1",
          property_name: "Khách sạn Mường Thanh",
        },
      ]);
    }
    if (url.includes("/bookings")) {
      return Promise.resolve([
        {
          id: "book-001",
          property_id: "prop-1",
          property_name: "Khách sạn Mường Thanh",
          room_name: "Phòng Deluxe City View",
          check_in: "2026-11-05",
          check_out: "2026-11-07",
          quantity: 1,
          guests: 2,
          total: 1200000,
          currency: "VND",
          status: "HELD",
          version: 1,
        },
      ]);
    }
    return Promise.resolve({});
  }),
}));

vi.mock("@/features/chat/services/chat-api", () => ({
  chatApi: {
    myOffers: vi.fn().mockResolvedValue([]),
    sendDirectMessage: vi.fn().mockResolvedValue({}),
  },
}));

describe("PartnerBookingsHub Component", () => {
  const mockBusinesses: BusinessDetailDto[] = [
    {
      id: "biz-rest-1",
      displayName: "Hawa's Food Đà Nẵng",
      kind: "RESTAURANT",
      ownerUserId: "user-1",
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
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "biz-htl-1",
      displayName: "Khách sạn Mường Thanh",
      kind: "HOTEL",
      ownerUserId: "user-1",
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
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ];

  it("renders metric counters and filter controls", () => {
    const html = renderToString(
      <PartnerBookingsHub businesses={mockBusinesses} />,
    );

    expect(html).toContain("Tổng lượt đặt");
    expect(html).toContain("Chờ xác nhận");
    expect(html).toContain("Đã chốt &amp; Giữ chỗ");
    expect(html).toContain("Hoàn tất / Đã đón");
    expect(html).toContain("Tất cả (");
    expect(html).toContain("Dịch vụ:");
    expect(html).toContain("Thuê xe &amp; Dịch vụ");
    expect(html).toContain("Phiếu Chat");
    expect(html).toContain("Hawa&#x27;s Food Đà Nẵng");
    expect(html).toContain("Khách sạn Mường Thanh");
  });
});
