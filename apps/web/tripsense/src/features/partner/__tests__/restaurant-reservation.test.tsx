import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { RestaurantReservationDialog } from "../components/restaurant-reservation-dialog";
import { PartnerBusinessCard } from "../components/partner-business-card";
import type { BusinessDetailDto } from "../types";

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
    <div className={children ? className : undefined}>{children}</div>
  ),
}));

describe("RestaurantReservationDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reservation dialog with contact inputs (name, phone), datetime, and guests", () => {
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
    expect(html).toContain("Thông tin liên hệ của bạn");
    expect(html).toContain("Họ và tên người đặt");
    expect(html).toContain("Số điện thoại liên hệ");
    expect(html).toContain("Thời gian đến dùng bữa");
    expect(html).toContain("Asia/Ho_Chi_Minh");
    expect(html).toContain("Người lớn (13+)");
    expect(html).toContain("Gửi yêu cầu đặt bàn");
    expect(html).toContain("Chưa trừ tiền và chưa tính là giữ bàn tự động");
  });

  it("renders PartnerBusinessCard with direct 'Chat với khách' button linking to chat", () => {
    const mockRestaurant: BusinessDetailDto = {
      id: "rest-123",
      kind: "RESTAURANT",
      ownerUserId: "owner-1",
      displayName: "Lantern Kitchen Hoi An",
      draftProfile: {},
      draftSchemaVersion: 1,
      approvalValidity: "VALID",
      operationState: "ACTIVE",
      publicationState: "PUBLISHED",
      acceptingNew: true,
      requiresReverification: false,
      suspensionVersion: 0,
      version: 1,
      capabilities: ["RESTAURANT_LISTING", "RESTAURANT_MENU"],
      myRole: "OWNER",
      publicEligible: true,
      newIntakeEligible: true,
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PartnerBusinessCard business={mockRestaurant} />
      </I18nProvider>
    );

    expect(html).toContain("Lantern Kitchen Hoi An");
    expect(html).toContain("Chat với khách");
    expect(html).toContain("/chat");
  });
});
