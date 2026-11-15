import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { HotelReservationDialog } from "../components/hotel-reservation-dialog";
import type { PublicHotelListingDto } from "../types";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

vi.mock("@/features/hotels/services/hotel-service-adapter", () => ({
  createDirectHold: vi.fn(),
}));

vi.mock("../services/partner-api", () => ({
  getPublicHotelRooms: vi.fn().mockResolvedValue([
    {
      id: "room-vip-1",
      propertyId: "prop-1",
      name: "Phòng Deluxe King",
      capacity: 2,
      pricePerNight: 750000,
      availableRooms: 5,
      currency: "VND",
      cancellationPolicy: "FREE_BEFORE_CHECK_IN",
    },
  ]),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open !== false ? <div>{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p className={className}>{children}</p>
  ),
  DialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={children ? className : undefined}>{children}</div>
  ),
}));

describe("HotelReservationDialog Component", () => {
  const sampleHotel: PublicHotelListingDto = {
    id: "hotel-1",
    ownerUserId: "owner-hotel-1",
    displayName: "Ibiza Riverfront Hotel",
    address: "205 Trần Hưng Đạo, Sơn Trà, Đà Nẵng",
    destination: "Đà Nẵng",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    verifiedPartner: true,
    acceptingNew: true,
    hasDirectInventory: true,
    minPricePerNight: 750000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders hotel direct reservation dialog with room selection, stay dates, guest counts, and price preview", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <HotelReservationDialog
          hotel={sampleHotel}
          open={true}
          onOpenChange={() => {}}
          defaultCheckIn="2026-11-20"
          defaultCheckOut="2026-11-22"
          defaultGuests={2}
          defaultQuantity={1}
        />
      </I18nProvider>,
    );

    expect(html).toContain("Ibiza Riverfront Hotel");
    expect(html).toContain("205 Trần Hưng Đạo");
    expect(html).toContain("Đặt phòng trực tiếp");
    expect(html).toContain("Ngày nhận phòng (*)");
    expect(html).toContain("Ngày trả phòng (*)");
    expect(html).toContain("Số phòng (*)");
    expect(html).toContain("Người lớn (*)");
    expect(html).toContain("Họ và tên khách đại diện (*)");
    expect(html).toContain("Email nhận xác nhận (*)");
    expect(html).toContain("Miễn phí hủy phòng trước giờ nhận phòng");
    expect(html).toContain("Xác nhận đặt phòng ngay");
  });
});
