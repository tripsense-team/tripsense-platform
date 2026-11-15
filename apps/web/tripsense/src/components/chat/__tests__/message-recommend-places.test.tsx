import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { PreviewMessage } from "../message";
import type { ChatMessage } from "@/lib/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
    locale: "vi",
  }),
}));

// Mock auth store
vi.mock("@/features/auth", () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { name: "Bảo Lê", email: "bao@example.com" },
      isAuthenticated: true,
    }),
}));

// Mock trip store
vi.mock("@/features/trip-management/store/use-trip-store", () => ({
  useTripStore: (selector: any) =>
    selector({
      trips: [{ id: "trip-1", name: "Chuyến đi Đà Nẵng" }],
      fetchTrips: vi.fn(),
    }),
}));

describe("PreviewMessage Component - recommendPlaces tool", () => {
  it("renders AI curated place cards carousel with custom title and reason highlights", () => {
    const message: ChatMessage = {
      id: "msg-ai-1",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Dưới đây là một số địa điểm nổi bật mình đã chọn lọc cho bạn:",
        },
        {
          type: "tool-recommendPlaces" as any,
          output: {
            success: true,
            title: "Điểm tham quan & ẩm thực tinh tuyển tại Đà Nẵng",
            destination: "Đà Nẵng",
            total: 2,
            places: [
              {
                id: "ai-rec-1",
                name: "Bãi biển Mỹ Khê",
                categories: ["beach"],
                rating: 4.8,
                reason: "Bãi cát trắng mịn, thích hợp tắm biển buổi chiều",
                photoUrl: "https://example.com/mykhe.jpg",
              },
              {
                id: "ai-rec-2",
                name: "Bán đảo Sơn Trà & Chùa Linh Ứng",
                categories: ["attraction"],
                rating: 4.9,
                reason: "Ngắm tượng Phật Bà và toàn cảnh vịnh Đà Nẵng",
                photoUrl: "https://example.com/sontra.jpg",
              },
            ],
          },
        } as any,
      ],
    };

    const html = renderToString(
      <PreviewMessage chatId="chat-1" message={message} isLoading={false} />
    );

    // Checks custom title from tool output
    expect(html).toContain("Điểm tham quan &amp; ẩm thực tinh tuyển tại Đà Nẵng");
    // Checks place names
    expect(html).toContain("Bãi biển Mỹ Khê");
    expect(html).toContain("Bán đảo Sơn Trà &amp; Chùa Linh Ứng");
    // Checks AI reasons
    expect(html).toContain("Bãi cát trắng mịn, thích hợp tắm biển buổi chiều");
    expect(html).toContain("Ngắm tượng Phật Bà và toàn cảnh vịnh Đà Nẵng");
    // Checks ratings
    expect(html).toContain("4.8");
    expect(html).toContain("4.9");
  });

  it("prioritizes recommendPlaces over searchPlaces when both are present", () => {
    const message: ChatMessage = {
      id: "msg-ai-2",
      role: "assistant",
      parts: [
        {
          type: "tool-searchPlaces" as any,
          output: {
            success: true,
            places: [
              {
                id: "raw-place-1",
                name: "Raw Duplicate Beach 1",
                categories: ["beach"],
              },
              {
                id: "raw-place-2",
                name: "Raw Duplicate Beach 2",
                categories: ["beach"],
              },
            ],
          },
        } as any,
        {
          type: "tool-recommendPlaces" as any,
          output: {
            success: true,
            title: "Gợi ý AI chuẩn",
            places: [
              {
                id: "ai-rec-only",
                name: "Bãi biển Mỹ Khê Tuyển Chọn",
                categories: ["beach"],
                reason: "Điểm duy nhất được chọn lọc",
              },
            ],
          },
        } as any,
      ],
    };

    const html = renderToString(
      <PreviewMessage chatId="chat-1" message={message} isLoading={false} />
    );

    expect(html).toContain("Gợi ý AI chuẩn");
    expect(html).toContain("Bãi biển Mỹ Khê Tuyển Chọn");
    expect(html).not.toContain("Raw Duplicate Beach 1");
    expect(html).not.toContain("Raw Duplicate Beach 2");
  });

  it("renders text intro before ItineraryPreview and PlaceCards carousel even when tool parts arrive first", () => {
    const message: ChatMessage = {
      id: "msg-ai-order",
      role: "assistant",
      parts: [
        {
          type: "tool-recommendPlaces" as any,
          output: {
            success: true,
            title: "Điểm gợi ý thêm tại Đà Nẵng",
            places: [
              {
                id: "rec-1",
                name: "Cầu Rồng Đà Nẵng",
                categories: ["attraction"],
              },
            ],
          },
        } as any,
        {
          type: "tool-createTripProposal" as any,
          output: {
            proposalId: "prop-order-1",
            title: "Khám phá Đà Nẵng 3N2Đ",
            destination: "Đà Nẵng",
            durationDays: 3,
            summary: "Lịch trình cân bằng biển và ẩm thực",
            days: [
              {
                dayNumber: 1,
                theme: "Biển Mỹ Khê",
                activities: [
                  {
                    itemKey: "act-1",
                    period: "MORNING",
                    timeSlot: "08:30 - 10:30",
                    title: "Bãi biển Mỹ Khê",
                    description: "Tắm biển buổi sáng.",
                    category: "BEACH",
                  },
                ],
              },
            ],
          },
        } as any,
        {
          type: "text",
          text: "Chào bạn, dưới đây là kế hoạch tối ưu dành riêng cho chuyến đi sắp tới:",
        },
      ],
    };

    const html = renderToString(
      <PreviewMessage chatId="chat-1" message={message} isLoading={false} />
    );

    const textIdx = html.indexOf("Chào bạn, dưới đây là kế hoạch tối ưu dành riêng cho chuyến đi sắp tới:");
    const proposalIdx = html.indexOf("Khám phá Đà Nẵng 3N2Đ");
    const carouselIdx = html.indexOf("Điểm gợi ý thêm tại Đà Nẵng");

    expect(textIdx).toBeGreaterThan(-1);
    expect(proposalIdx).toBeGreaterThan(textIdx);
    expect(carouselIdx).toBeGreaterThan(proposalIdx);
  });

  it("defers PlaceCards carousel during streaming before text arrives and shows status above proposal", () => {
    const message: ChatMessage = {
      id: "msg-ai-streaming",
      role: "assistant",
      parts: [
        {
          type: "tool-recommendPlaces" as any,
          output: {
            success: true,
            title: "Carousel không nên nhảy lên đầu",
            places: [
              {
                id: "rec-stream-1",
                name: "Bán đảo Sơn Trà",
                categories: ["attraction"],
              },
            ],
          },
        } as any,
        {
          type: "tool-createTripProposal" as any,
          output: {
            proposalId: "prop-stream-1",
            title: "Hành trình Đà Nẵng 2N1Đ",
            destination: "Đà Nẵng",
            durationDays: 2,
            summary: "Thư giãn cuối tuần",
            days: [
              {
                dayNumber: 1,
                theme: "Khởi hành",
                activities: [
                  {
                    itemKey: "act-s1",
                    period: "AFTERNOON",
                    timeSlot: "14:00 - 16:00",
                    title: "Check-in khách sạn",
                    description: "Nhận phòng và nghỉ ngơi.",
                    category: "STAY",
                  },
                ],
              },
            ],
          },
        } as any,
      ],
    };

    const html = renderToString(
      <PreviewMessage chatId="chat-1" message={message} isLoading={true} />
    );

    expect(html).toContain("Đã lưu lịch trình — đang hoàn thiện lời dẫn");
    expect(html).toContain("Hành trình Đà Nẵng 2N1Đ");
    expect(html).not.toContain("Carousel không nên nhảy lên đầu");
    expect(html.indexOf("Đã lưu lịch trình")).toBeLessThan(
      html.indexOf("Hành trình Đà Nẵng 2N1Đ")
    );
  });
});
