import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ItineraryPreview } from "../itinerary-preview";
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
});

