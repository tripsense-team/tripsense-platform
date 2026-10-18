import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "@/i18n";
import { PrintItineraryDialog } from "../print-itinerary-dialog";
import type { ItineraryResponse, TripResponse } from "../../types";

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

describe("PrintItineraryDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTrip: TripResponse = {
    id: "trip-print-1",
    name: "Hành trình khám phá Hà Nội",
    destinationName: "Hà Nội",
    destinationPlaceId: null,
    startDate: "2026-11-05",
    endDate: "2026-11-08",
    status: "CONFIRMED",
    displayStatus: "UPCOMING",
    visibility: "PRIVATE",
    ownerId: "user-1",
    travelerCount: 3,
    budgetAmount: 10000000,
    budgetCurrency: "VND",
    notes: "Khám phá phố cổ và ẩm thực",
    coverImageUrl: null,
    version: 1,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
  };

  const mockItinerary: ItineraryResponse = {
    tripId: "trip-print-1",
    days: [
      {
        id: "day-1",
        version: 1,
        dayNumber: 1,
        date: "2026-11-05",
        items: [
          {
            id: "it-1",
            dayId: "day-1",
            placeId: null,
            title: "Cà phê Giảng",
            notes: "Thưởng thức cà phê trứng truyền thống",
            placeAddressSnapshot: "39 Nguyễn Hữu Huân, Hoàn Kiếm",
            placeNameSnapshot: "Cà phê Giảng",
            latSnapshot: null,
            lngSnapshot: null,
            startTime: "08:30",
            endTime: "09:30",
            durationMinutes: 60,
            type: "MEAL",
            status: "PLANNED",
            sortOrder: 1,
            version: 1,
            warnings: [],
          },
        ],
      },
    ],
  };

  it("renders printable itinerary dialog with trip header, dates, and activities", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="vi">
        <PrintItineraryDialog
          open={true}
          onOpenChange={() => {}}
          trip={mockTrip}
          itinerary={mockItinerary}
        />
      </I18nProvider>
    );

    expect(html).toContain("Hành trình khám phá Hà Nội");
    expect(html).toContain("Hà Nội");
    expect(html).toContain("3 người tham gia");
    expect(html).toContain("Cà phê Giảng");
    expect(html).toContain("Ngày 1");
    expect(html).toContain("In / Lưu PDF");
    expect(html).toContain("Tải file .ics");
  });
});
