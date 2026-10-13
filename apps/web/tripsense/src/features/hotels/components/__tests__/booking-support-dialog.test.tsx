import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { BookingSupportDialog } from "../booking-support-dialog";
import type { HotelBooking } from "../../types";

vi.mock("@/services/api-client", () => ({
  apiClient: vi.fn(),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open !== false ? <div>{children}</div> : null),
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
    <div className={className}>{children}</div>
  ),
}));

describe("BookingSupportDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBooking: HotelBooking = {
    id: "booking-supp-1",
    property_id: "prop-1",
    room_type_id: "room-1",
    property_name: "Vinpearl Resort Nha Trang",
    room_name: "Deluxe Ocean View",
    check_in: "2026-11-10",
    check_out: "2026-11-12",
    quantity: 1,
    guests: 2,
    total: 2500000,
    currency: "VND",
    status: "CONFIRMED",
    payment_method: "PAYOS",
    version: 1,
    cancellation_policy: "FREE_BEFORE_CHECK_IN",
    free_cancellation_until: "2026-11-10T14:00:00Z",
    expires_at: "2026-10-12T20:00:00Z",
  };

  it("renders contextual support ticket dialog with booking reference and categories", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <BookingSupportDialog
          booking={mockBooking}
          open={true}
          onOpenChange={() => {}}
        />
      </I18nProvider>
    );

    expect(html).toContain("Yêu cầu Hỗ trợ Đơn đặt phòng");
    expect(html).toContain("Vinpearl Resort Nha Trang");
    expect(html).toContain("Vấn đề thanh toán / Yêu cầu hoàn tiền");
    expect(html).toContain("Gửi yêu cầu");
  });
});
