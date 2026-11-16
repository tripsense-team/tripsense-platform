import { describe, expect, it, vi } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { ItineraryPreview } from "../itinerary-preview";
import { PlaceDetailActionProvider } from "../place-detail-action-context";
import type { TripProposal } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: "vi",
  }),
}));

vi.mock("@/features/ai-trip-commit/services/ai-trip-commit-api", () => ({
  applyTripProposal: vi.fn(),
  getChatTripContext: vi.fn().mockResolvedValue(null),
}));

describe("ItineraryPreview Component", () => {
  it("renders grounded activity photo thumbnails when photoUrl is present and omits missing images cleanly", () => {
    const proposal: TripProposal = {
      proposalId: "prop-1",
      title: "Khám phá Đà Nẵng 2N1Đ",
      destination: "Đà Nẵng",
      durationDays: 1,
      summary: "Lịch trình chuẩn gu biển và ẩm thực",
      days: [
        {
          dayNumber: 1,
          theme: "Biển Mỹ Khê & Hải sản",
          activities: [
            {
              itemKey: "act-1",
              period: "MORNING",
              timeSlot: "08:30 - 10:30",
              title: "Bãi biển Mỹ Khê",
              description: "Tắm biển và dạo bờ cát sáng sớm.",
              placeId: "place-my-khe",
              address: "Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
              photoUrl: "https://res.cloudinary.com/demo/image/upload/my-khe.jpg",
              category: "ATTRACTION",
            },
            {
              itemKey: "act-2",
              period: "AFTERNOON",
              timeSlot: "14:00 - 15:00",
              title: "Nghỉ ngơi tại khách sạn",
              description: "Thư giãn buổi chiều.",
              category: "ACTIVITY",
            },
          ],
        },
      ],
    };

    const html = renderToString(<ItineraryPreview proposal={proposal} />);

    expect(html).toContain("Bãi biển Mỹ Khê");
    expect(html).toContain('src="https://res.cloudinary.com/demo/image/upload/my-khe.jpg"');
    expect(html).toContain("Nghỉ ngơi tại khách sạn");
    expect((html.match(/<img\b/g) || []).length).toBe(1);
  });

  it("renders Buổi trưa for NOON activities and lunch timeSlots even if labeled MORNING", () => {
    const proposal: TripProposal = {
      proposalId: "prop-noon",
      title: "Khám phá Đà Nẵng 1 ngày",
      destination: "Đà Nẵng",
      durationDays: 1,
      summary: "Lịch trình chuẩn giờ trưa",
      days: [
        {
          dayNumber: 1,
          theme: "Ẩm thực miền Trung",
          activities: [
            {
              itemKey: "act-noon-1",
              period: "NOON",
              timeSlot: "11:30 - 13:00",
              title: "Ẩm thực Trần",
              description: "Bánh tráng cuốn thịt heo.",
              category: "FOOD",
            },
            {
              itemKey: "act-noon-legacy",
              period: "MORNING",
              timeSlot: "12:00 - 13:15",
              title: "Mì Quảng Bà Mua",
              description: "Mì Quảng đặc sản.",
              category: "FOOD",
            },
          ],
        },
      ],
    };

    const html = renderToString(<ItineraryPreview proposal={proposal} />);
    const noonMatches = html.match(/Buổi trưa/g) || [];
    expect(noonMatches.length).toBe(2);
    expect(html).not.toContain("Buổi sáng");
  });

  it("keeps late-morning 11:00 - 11:30 checkout in Buổi sáng", () => {
    const proposal: TripProposal = {
      proposalId: "prop-checkout",
      title: "Khám phá Đà Nẵng 1 ngày",
      destination: "Đà Nẵng",
      durationDays: 1,
      summary: "Check-out 11:00 - 11:30 vẫn là buổi sáng",
      days: [
        {
          dayNumber: 1,
          theme: "Trở về",
          activities: [
            {
              itemKey: "act-checkout",
              period: "MORNING",
              timeSlot: "11:00 - 11:30",
              title: "Check-out khách sạn",
              description: "Trả phòng và gửi hành lý.",
              category: "LOGISTICS",
            },
            {
              itemKey: "act-lunch",
              period: "NOON",
              timeSlot: "11:30 - 13:00",
              title: "Cơm gà Bà Buội",
              description: "Ăn trưa trước khi ra sân bay.",
              category: "FOOD",
            },
          ],
        },
      ],
    };

    const html = renderToString(<ItineraryPreview proposal={proposal} />);
    const morningMatches = html.match(/Buổi sáng/g) || [];
    const noonMatches = html.match(/Buổi trưa/g) || [];
    expect(morningMatches.length).toBe(1);
    expect(noonMatches.length).toBe(1);
  });

  it("opens right-side place detail when clicking a place activity while leaving plain logistics static", async () => {
    const openPlaceDetail = vi.fn();
    const proposal: TripProposal = {
      proposalId: "prop-clickable",
      title: "Đà Nẵng 2N1Đ",
      destination: "Đà Nẵng",
      durationDays: 1,
      summary: "Lịch trình chuẩn",
      days: [
        {
          dayNumber: 1,
          theme: "Biển & Di sản",
          activities: [
            {
              itemKey: "act-linh-ung",
              period: "MORNING",
              timeSlot: "08:00 - 10:30",
              title: "Cổng Chùa Linh Ứng",
              description: "Viếng chùa trên bán đảo Sơn Trà.",
              placeId: "place-linh-ung",
              address: "Hoàng Sa, Sơn Trà, Đà Nẵng",
              photoUrl: "https://res.cloudinary.com/demo/linh-ung.jpg",
              category: "ATTRACTION",
            },
            {
              itemKey: "act-rest",
              period: "AFTERNOON",
              timeSlot: "13:30 - 14:30",
              title: "Nghỉ ngơi tại khách sạn",
              description: "Thư giãn buổi trưa.",
              category: "ACTIVITY",
            },
          ],
        },
      ],
    };

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PlaceDetailActionProvider openPlaceDetail={openPlaceDetail}>
          <ItineraryPreview proposal={proposal} />
        </PlaceDetailActionProvider>,
      );
    });

    const placeButton = container.querySelector(
      '[data-testid="itinerary-activity-link-act-linh-ung"]',
    ) as HTMLButtonElement | null;
    expect(placeButton).not.toBeNull();

    const logisticsButton = container.querySelector(
      '[data-testid="itinerary-activity-link-act-rest"]',
    );
    expect(logisticsButton).toBeNull();

    await act(async () => {
      placeButton?.click();
    });

    expect(openPlaceDetail).toHaveBeenCalledTimes(1);
    expect(openPlaceDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        placeIdHint: "place-linh-ung",
        nameHint: "Cổng Chùa Linh Ứng",
        knownPhotoUrl: "https://res.cloudinary.com/demo/linh-ung.jpg",
      }),
    );

    await act(async () => {
      root.unmount();
    });
  });
});

