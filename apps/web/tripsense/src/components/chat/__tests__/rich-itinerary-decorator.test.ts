import { describe, it, expect, vi } from "vitest";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  decorateItineraryMarkdown,
  linkKnownPlacesInMarkdown,
  parsePlaceHref,
  richMarkdownComponents,
} from "../rich-itinerary-decorator";
import { PlaceDetailActionProvider } from "../place-detail-action-context";

describe("rich-itinerary-decorator", () => {
  describe("decorateItineraryMarkdown", () => {
    it("formats Day headings with appropriate icons and dividers", () => {
      const raw = `Day 1 – Trái tim Hoàng thành Bắc Kinh
Check-in nhẹ nhàng
Day 2 – Thiên Đàn + Hutong cổ
Không khí địa phương`;

      const result = decorateItineraryMarkdown(raw);

      expect(result).toContain("### Day 1 – 🏯 Trái tim Hoàng thành Bắc Kinh");
      expect(result).toContain("---");
      expect(result).toContain("### Day 2 – 🧧 Thiên Đàn + Hutong cổ");
    });

    it("does not duplicate emojis if Day title already contains an emoji", () => {
      const raw = `### Day 1 – 🏯 Trái tim Hoàng thành Bắc Kinh`;
      const result = decorateItineraryMarkdown(raw);
      expect(result).toContain("### Day 1 – 🏯 Trái tim Hoàng thành Bắc Kinh");
      expect(result).not.toContain("🏯 🏯");
    });

    it("normalizes Vietnamese and English time-of-day markers to standard bold format with emojis", () => {
      const raw = `Morning: Khởi hành đi Bà Nà
Chiều: Thăm Cầu Vàng
Tối: Dạo phố đêm Hội An`;

      const result = decorateItineraryMarkdown(raw);

      expect(result).toContain("☀️ **Morning:**");
      expect(result).toContain("🌤️ **Afternoon:**");
      expect(result).toContain("🌙 **Evening:**");
    });

    it("removes model-authored verification tags", () => {
      const raw = `Tham quan **Meridian Gate (Wumen)** [verified] và **Verboden stad** ✓`;
      const result = decorateItineraryMarkdown(raw);

      expect(result).toContain("**Meridian Gate (Wumen)**");
      expect(result).toContain("**Verboden stad**");
      expect(result).not.toContain("✓");
      expect(result).not.toContain("verified");
    });

    it("handles empty or falsy strings gracefully", () => {
      expect(decorateItineraryMarkdown("")).toBe("");
    });

    it("adds topic icons and clean bullets to plain practical travel tips", () => {
      const raw = `Một số lưu ý thực tế cho chuyến đi:

Di chuyển & Tham quan: Khu vực Bán đảo Sơn Trà có địa hình dốc, ưu tiên giày thể thao đế mềm.
Thời tiết & Trang phục: Tháng 11 tại Đà Nẵng tiết trời mát mẻ dễ chịu.
Thưởng thức ẩm thực: Các quán bánh tráng thịt heo rất đông từ 12:00 – 13:00.`;

      const result = decorateItineraryMarkdown(raw);

      expect(result).toContain("✨ **Một số lưu ý thực tế cho chuyến đi:**");
      expect(result).toContain("- 🥾 **Di chuyển & Tham quan:** Khu vực Bán đảo Sơn Trà");
      expect(result).toContain("- 🌤️ **Thời tiết & Trang phục:** Tháng 11 tại Đà Nẵng");
      expect(result).toContain("- 🍜 **Thưởng thức ẩm thực:** Các quán bánh tráng thịt heo");
    });

    it("does not duplicate emojis on tip headings or bullets that already have icons", () => {
      const raw = `✨ **Một số lưu ý thực tế cho chuyến đi:**
- 🥾 **Di chuyển & Tham quan:** Ưu tiên giày thể thao đế mềm.
- **🌤️ Thời tiết & Trang phục:** Mang áo khoác nhẹ buổi tối.`;

      const result = decorateItineraryMarkdown(raw);

      expect(result).not.toContain("✨ ✨");
      expect(result).not.toContain("🥾 🥾");
      expect(result).not.toContain("🌤️ 🌤️");
      expect(result).toContain("- 🥾 **Di chuyển & Tham quan:**");
      expect(result).toContain("- 🌤️ **Thời tiết & Trang phục:**");
    });

    it("auto-links grounded place names post-stream while skipping headings, code, city names, and shorter nested names", () => {
      const targets = [
        { id: "p-linh-ung", name: "Cổng Chùa Linh Ứng" },
        { id: "p-chua", name: "Chùa Linh Ứng" },
        { id: "p-son-tra", name: "Bán đảo Sơn Trà" },
        { id: "p-ngu-hanh-son", name: "Ngũ Hành Sơn" },
      ];

      const raw = [
        "### Day 1 – Bán đảo Sơn Trà",
        "",
        "Lịch trình Đà Nẵng cân bằng giữa Bán đảo Sơn Trà, Ngũ Hành Sơn và Cổng Chùa Linh Ứng.",
        "Xem ảnh tại [Cổng Chùa Linh Ứng](https://example.com/linh-ung) hoặc `Ngũ Hành Sơn`.",
      ].join("\n");

      const streamingResult = decorateItineraryMarkdown(raw, {
        placeTargets: targets,
        excludedNames: ["Đà Nẵng"],
        isStreaming: true,
      });
      expect(streamingResult).not.toContain("#place:");

      const settledResult = decorateItineraryMarkdown(raw, {
        placeTargets: targets,
        excludedNames: ["Đà Nẵng"],
        isStreaming: false,
      });

      expect(settledResult).toContain("### Day 1 – 🏯 Bán đảo Sơn Trà");
      expect(settledResult).not.toContain("[Đà Nẵng](#place:");
      expect(settledResult).toContain(
        "[Bán đảo Sơn Trà](#place:B%C3%A1n%20%C4%91%E1%BA%A3o%20S%C6%A1n%20Tr%C3%A0)",
      );
      expect(settledResult).toContain(
        "[Ngũ Hành Sơn](#place:Ng%C5%A9%20H%C3%A0nh%20S%C6%A1n)",
      );
      expect(settledResult).toContain(
        "[Cổng Chùa Linh Ứng](#place:C%E1%BB%95ng%20Ch%C3%B9a%20Linh%20%E1%BB%A8ng)",
      );
      expect(settledResult).not.toContain("Cổng [Chùa Linh Ứng]");
      expect(settledResult).toContain(
        "[Cổng Chùa Linh Ứng](https://example.com/linh-ung)",
      );
      expect(settledResult).toContain("`Ngũ Hành Sơn`");
    });

    it("encodes spaces and parentheses inside model-authored #place links cleanly", () => {
      const raw =
        "Ghé [Bảo tàng Chăm (Đà Nẵng)](#place:Bảo tàng Chăm (Đà Nẵng)) vào buổi chiều.";
      const result = decorateItineraryMarkdown(raw);
      expect(result).toContain(
        "[Bảo tàng Chăm (Đà Nẵng)](#place:B%E1%BA%A3o%20t%C3%A0ng%20Ch%C4%83m%20(%C4%90%C3%A0%20N%E1%BA%B5ng))",
      );
      expect(
        parsePlaceHref(
          "#place:B%E1%BA%A3o%20t%C3%A0ng%20Ch%C4%83m%20(%C4%90%C3%A0%20N%E1%BA%B5ng)",
        ),
      ).toEqual({ nameHint: "Bảo tàng Chăm (Đà Nẵng)" });
    });

    it("renders #place markdown anchors as interactive place buttons wired to PlaceDetailActionProvider", async () => {
      const openPlaceDetail = vi.fn();
      const Anchor = richMarkdownComponents.a;
      const container = document.createElement("div");
      const root = createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(
            PlaceDetailActionProvider,
            { openPlaceDetail },
            React.createElement(
              Anchor,
              { href: "#place:B%C3%A1n%20%C4%91%E1%BA%A3o%20S%C6%A1n%20Tr%C3%A0" },
              "Bán đảo Sơn Trà",
            ),
            React.createElement(
              Anchor,
              { href: "#place-id:place-my-khe" },
              "Bãi biển Mỹ Khê",
            ),
          ),
        );
      });

      const buttons = container.querySelectorAll('button[data-place-link="true"]');
      expect(buttons).toHaveLength(2);

      await act(async () => {
        (buttons[0] as HTMLButtonElement).click();
        (buttons[1] as HTMLButtonElement).click();
      });

      expect(openPlaceDetail).toHaveBeenNthCalledWith(1, {
        nameHint: "Bán đảo Sơn Trà",
        placeIdHint: undefined,
      });
      expect(openPlaceDetail).toHaveBeenNthCalledWith(2, {
        nameHint: "Bãi biển Mỹ Khê",
        placeIdHint: "place-my-khe",
      });

      const externalHtml = renderToString(
        React.createElement(Anchor, { href: "https://tripsense.vn" }, "TripSense"),
      );
      expect(externalHtml).toContain('target="_blank"');
      expect(externalHtml).toContain('rel="noopener noreferrer"');

      await act(async () => {
        root.unmount();
      });
    });

    it("returns raw text untouched in linkKnownPlacesInMarkdown when excluded names match", () => {
      const linked = linkKnownPlacesInMarkdown(
        "Đi chơi Đà Nẵng cuối tuần.",
        [{ name: "Đà Nẵng" }],
        { excludedNames: ["Đà Nẵng"] },
      );
      expect(linked).toBe("Đi chơi Đà Nẵng cuối tuần.");
    });
  });
});
