import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { HotelCommerce } from "../hotel-commerce";

vi.mock("../../services/hotels-api", () => ({
  hotelApi: vi.fn().mockImplementation((url: string) => {
    return Promise.resolve([
      {
        booking_id: "test-booking-1",
        business_id: "biz-123",
        property_name: "Test Hotel",
        room_name: "Deluxe Room",
        booking_status: "CHECKED_OUT",
        amount: 1000000,
        commission_amount: 100000,
        partner_amount: 900000,
        currency: "VND",
        payment_state: "CAPTURED",
        settlement_state: "ELIGIBLE",
      },
    ]);
  }),
}));

describe("HotelCommerce Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders commerce section header and statement fields", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <HotelCommerce businessId="biz-123" admin={false} />
      </I18nProvider>
    );

    expect(html).toContain("Đối soát doanh thu");
    // When admin is false, the settle action must never appear in partner view
    expect(html).not.toContain("Quyết toán");
  });
});
