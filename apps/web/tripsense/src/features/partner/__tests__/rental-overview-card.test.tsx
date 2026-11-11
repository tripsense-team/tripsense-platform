import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { RentalOverviewCard } from "../components/rental-overview-card";
import type { PublicRentalListingDto } from "../types";

const mockAuthState = { user: { id: "traveler-1" } };

vi.mock("@/features/auth/store/use-auth-store", () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

const sampleListing: PublicRentalListingDto = {
  id: "biz-rental-1",
  ownerUserId: "partner-owner-1",
  displayName: "Vân Khang Car - Cho Thuê VF3 Tự Lái Đà Nẵng",
  address: "334/3 Nguyễn Văn Linh, Đà Nẵng",
  destination: "Đà Nẵng",
  publicPhone: "+84 934 842 844",
  verifiedPartner: true,
  acceptingNew: true,
  badgeLabel: "Verified Partner",
  hasDirectInventory: true,
  minPricePerDay: 600000,
  items: [
    {
      id: "item-vf3",
      businessId: "biz-rental-1",
      name: "VinFast VF3 Tự Lái 2025",
      category: "CAR_4_SEATS",
      images: [],
      pricePerDay: 600000,
      depositAmount: 2000000,
      totalInventory: 3,
      pickupOption: "DELIVERY_TO_LOCATION",
      deliveryAvailable: true,
      specifications: {},
      createdAt: "2026-11-10T00:00:00Z",
      updatedAt: "2026-11-10T00:00:00Z",
    },
  ],
};

describe("RentalOverviewCard", () => {
  it("renders direct booking CTA, catalog highlights, and chat link when partner has active items and accepts bookings", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <RentalOverviewCard
          rental={sampleListing}
          placeName={sampleListing.displayName}
          placeAddress={sampleListing.address}
          placePhone={sampleListing.publicPhone ?? undefined}
        />
      </I18nProvider>
    );

    expect(html).toContain("Sẵn sàng đặt thuê");
    expect(html).toContain("Đặt thuê ngay");
    expect(html).toContain("600.000");
    expect(html).toContain("VinFast VF3 Tự Lái 2025");
    expect(html).toContain("Nhắn tin &amp; Đặt thuê qua Chat");
    expect(html).toContain("/rentals/biz-rental-1");
  });

  it("renders chat fallback notice when partner has not added rental items yet", () => {
    const emptyListing: PublicRentalListingDto = {
      ...sampleListing,
      acceptingNew: false,
      hasDirectInventory: false,
      minPricePerDay: null,
      items: [],
    };

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <RentalOverviewCard
          rental={emptyListing}
          placeName={emptyListing.displayName}
        />
      </I18nProvider>
    );

    expect(html).toContain("Đối tác chưa đăng tải danh mục xe/thiết bị");
    expect(html).toContain("Nhắn tin &amp; Đặt thuê qua Chat");
  });

  it("renders owner management CTA when signed-in user owns the rental business", () => {
    mockAuthState.user = { id: "partner-owner-1" };
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <RentalOverviewCard
          rental={sampleListing}
          placeName={sampleListing.displayName}
        />
      </I18nProvider>
    );
    mockAuthState.user = { id: "traveler-1" };

    expect(html).toContain("Quản lý danh mục &amp; Mở đón khách");
    expect(html).toContain("/partner/businesses/biz-rental-1/rentals");
  });

  it("renders non-partner fallback with phone and maps link when rental is null", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <RentalOverviewCard
          rental={null}
          placeName="Vân Khang Car - Cho Thuê VF3 Tự Lái Đà Nẵng"
          placeAddress="334/3 Nguyễn Văn Linh"
          placePhone="+84 934 842 844"
        />
      </I18nProvider>
    );

    expect(html).toContain("Chưa kích hoạt đặt thuê trực tuyến");
    expect(html).toContain("Gọi ngay: +84 934 842 844");
    expect(html).toContain("tel:+84 934 842 844");
    expect(html).toContain("Xem chỉ đường");
  });
});

