import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { TripActivityPollModal } from "../trip-activity-poll-modal";

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

describe("TripActivityPollModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders group activity poll modal with proposed ideas and voting buttons", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <TripActivityPollModal
          open={true}
          onOpenChange={() => {}}
          tripId="trip-456"
          tripName="Khám phá Phú Quốc"
        />
      </I18nProvider>
    );

    expect(html).toContain("Bình chọn ý tưởng hoạt động nhóm");
    expect(html).toContain("Khám phá Phú Quốc");
    expect(html).toContain("Ăn hải sản đêm bên bờ biển");
    expect(html).toContain("Đề xuất");
  });
});
