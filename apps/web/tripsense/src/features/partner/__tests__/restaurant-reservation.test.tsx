import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { RestaurantReservationDialog } from "../components/restaurant-reservation-dialog";

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

describe("RestaurantReservationDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reservation dialog with restaurant name, datetime, and guests input", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <RestaurantReservationDialog
          businessId="rest-123"
          restaurantName="Lantern Kitchen Hoi An"
          open={true}
          onOpenChange={() => {}}
        />
      </I18nProvider>
    );

    expect(html).toContain("Lantern Kitchen Hoi An");
    expect(html).toContain("Yêu cầu Đặt bàn");
    expect(html).toContain("Thời gian đến dùng bữa");
    expect(html).toContain("Asia/Ho_Chi_Minh");
    expect(html).toContain("Người lớn (13+)");
    expect(html).toContain("Gửi yêu cầu đặt bàn");
    expect(html).toContain("Chưa trừ tiền và chưa tính là giữ bàn tự động");
  });
});
