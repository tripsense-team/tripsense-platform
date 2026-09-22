import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <h2 className={className}>{children}</h2>,
}));

import { TripCreationHandoffModal } from "./trip-creation-handoff-modal";
import type { AiItineraryPreview } from "./types";
import type { TripResponse } from "@/features/trip-management/types";

describe("TripCreationHandoffModal", () => {
  const mockPreview: AiItineraryPreview = {
    validForPreview: true,
    explanation: "Gợi ý chuyến đi khám phá Đà Nẵng 2 ngày 1 đêm",
    constraints: {
      destination: "Đà Nẵng",
      hardBudgetAmount: 3000000,
      budgetCurrency: "VND",
    },
    days: [
      {
        dayNumber: 1,
        date: "2026-09-22",
        items: [
          {
            canonicalPlaceId: "p-my-khe",
            title: "Biển Mỹ Khê",
            address: "Võ Nguyên Giáp, Đà Nẵng",
            startTime: "08:00",
            endTime: "10:30",
            location: { lat: 16.06, lng: 108.24 },
          },
          {
            canonicalPlaceId: "p-cau-rong",
            title: "Cầu Rồng",
            address: "Nguyễn Văn Linh, Đà Nẵng",
            startTime: "19:00",
            endTime: "21:00",
            location: { lat: 16.061, lng: 108.227 },
          },
        ],
      },
      {
        dayNumber: 2,
        date: "2026-09-23",
        items: [
          {
            canonicalPlaceId: "p-ba-na",
            title: "Bà Nà Hills",
            address: "Hòa Vang, Đà Nẵng",
            startTime: "08:30",
            endTime: "15:00",
            location: { lat: 15.99, lng: 107.99 },
          },
        ],
      },
    ],
  };

  it("does not render modal content when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <TripCreationHandoffModal
        isOpen={false}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        preview={mockPreview}
      />
    );
    expect(html).toBe("");
  });

  it("renders modal with pre-filled destination, dates, and place list when open", () => {
    const html = renderToStaticMarkup(
      <TripCreationHandoffModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        preview={mockPreview}
      />
    );

    // Modal title & headers
    expect(html).toContain("Tạo Chuyến Đi &amp; Lưu Lịch Trình");
    expect(html).toContain("Đà Nẵng");

    // Pre-filled items from preview
    expect(html).toContain("Biển Mỹ Khê");
    expect(html).toContain("Cầu Rồng");
    expect(html).toContain("Bà Nà Hills");

    // Days grouping
    expect(html).toContain("Ngày 1");
    expect(html).toContain("Ngày 2");

    // Primary action button
    expect(html).toContain("Tạo chuyến đi &amp; Lưu");
  });

  it("renders with existing trips option when existingTrips are provided", () => {
    const existingTrips = [
      {
        id: "trip-1",
        name: "Chuyến đi miền Trung",
        destinationName: "Đà Nẵng",
        startDate: "2026-09-25",
        endDate: "2026-09-28",
        status: "PLANNING" as const,
        privacy: "PRIVATE" as const,
        currency: "VND",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
    ];

    const html = renderToStaticMarkup(
      <TripCreationHandoffModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        preview={mockPreview}
        existingTrips={existingTrips as unknown as TripResponse[]}
      />
    );

    expect(html).toContain("Thêm vào chuyến đi đã có");
    expect(html).toContain("Tạo chuyến đi mới");
  });

  it("handles missing preview gracefully", () => {
    const html = renderToStaticMarkup(
      <TripCreationHandoffModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        preview={undefined}
      />
    );

    expect(html).toContain("Tạo Chuyến Đi &amp; Lưu Lịch Trình");
    expect(html).toContain("Chưa có địa điểm nào được gợi ý trong cuộc trò chuyện.");
  });
});
