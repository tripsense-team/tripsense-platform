import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { TripChecklistModal } from "../trip-checklist-modal";

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

describe("TripChecklistModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders checklist modal with categories, progress, and preset items", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <TripChecklistModal
          open={true}
          onOpenChange={() => {}}
          tripId="trip-123"
          tripName="Chuyến đi Đà Lạt"
        />
      </I18nProvider>
    );

    expect(html).toContain("Danh sách chuẩn bị hành lý");
    expect(html).toContain("Chuyến đi Đà Lạt");
    expect(html).toContain("Hộ chiếu / CCCD / Giấy tờ tùy thân");
    expect(html).toContain("Mẫu gợi ý");
    expect(html).toContain("Thêm đồ cần mang hoặc việc cần làm...");
  });
});
