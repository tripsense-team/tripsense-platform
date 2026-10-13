import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { HotelCheckoutReview } from "../hotel-checkout-review";
import type { HotelBooking } from "../../types";

vi.mock("../../services/hotels-api", () => ({
  hotelApi: vi.fn(),
}));

describe("HotelCheckoutReview Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseBooking: HotelBooking = {
    id: "booking-123",
    property_id: "prop-1",
    room_type_id: "room-1",
    property_name: "Grand Da Nang Hotel",
    room_name: "Deluxe Ocean View",
    check_in: "2026-11-01",
    check_out: "2026-11-03",
    quantity: 1,
    guests: 2,
    subtotal: 1000000,
    total: 1000000,
    discount_amount: 0,
    currency: "VND",
    status: "HELD",
    payment_method: "PAYOS",
    version: 1,
    cancellation_policy: "FREE_BEFORE_CHECK_IN",
    free_cancellation_until: "2026-11-01T14:00:00Z",
    expires_at: "2026-10-12T20:00:00Z",
  };

  it("renders booking details and voucher input when status is HELD without voucher", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <HotelCheckoutReview booking={baseBooking} onUpdated={() => {}} />
      </I18nProvider>
    );

    expect(html).toContain("Grand Da Nang Hotel");
    expect(html).toContain("Deluxe Ocean View");
    expect(html).toContain("Nhập mã voucher...");
    expect(html).toContain("Áp dụng");
    expect(html).toContain("Mã ưu đãi có sẵn");
  });

  it("renders subtotal, voucher discount, and final total when voucher is applied", () => {
    const voucherBooking: HotelBooking = {
      ...baseBooking,
      voucher_code: "WELCOME50",
      discount_amount: 50000,
      subtotal: 1000000,
      total: 950000,
    };

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <HotelCheckoutReview booking={voucherBooking} onUpdated={() => {}} />
      </I18nProvider>
    );

    expect(html).toContain("WELCOME50");
    expect(html).toContain("Tạm tính");
    expect(html).toContain("Bỏ mã");
    expect(html).toMatch(/50[,.]000/);
    expect(html).toMatch(/950[,.]000/);
  });
});
