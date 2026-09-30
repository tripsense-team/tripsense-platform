import { describe, it, expect } from "vitest";
import { decorateItineraryMarkdown } from "../rich-itinerary-decorator";

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
  });

});
