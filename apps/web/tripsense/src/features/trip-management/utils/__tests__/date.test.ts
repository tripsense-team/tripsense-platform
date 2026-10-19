import { describe, it, expect } from "vitest";
import {
  parseFlexibleMonth,
  resolveFlexibleDates,
  formatWhenSelection,
  isDateInFlexibleMonth,
  formatLocalDateIso,
  parseFlexiblePreferenceFromNotes,
} from "../date";

describe("date utils - flexible dates", () => {
  const baseDate = new Date("2026-10-19T08:00:00");

  describe("parseFlexibleMonth", () => {
    it("parses Vietnamese format 'Tháng 12' in same year", () => {
      const parsed = parseFlexibleMonth("Tháng 12", baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(11); // 0-indexed month 11 is December
      expect(parsed?.getDate()).toBe(1);
    });

    it("parses Vietnamese format 'Tháng 1' rolling over to next year", () => {
      const parsed = parseFlexibleMonth("Tháng 1", baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2027);
      expect(parsed?.getMonth()).toBe(0); // January
      expect(parsed?.getDate()).toBe(1);
    });

    it("parses ISO format '2026-12'", () => {
      const parsed = parseFlexibleMonth("2026-12", baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(11);
    });

    it("parses English month name 'December'", () => {
      const parsed = parseFlexibleMonth("December", baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(11);
    });

    it("parses English month name with explicit year 'Dec 2027'", () => {
      const parsed = parseFlexibleMonth("Dec 2027", baseDate);
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2027);
      expect(parsed?.getMonth()).toBe(11);
    });
  });

  describe("resolveFlexibleDates", () => {
    it("resolves 3 days in Tháng 12 to 2026-12-01 -> 2026-12-03", () => {
      const result = resolveFlexibleDates(3, ["Tháng 12"], baseDate);
      expect(result.startDate).toBe("2026-12-01");
      expect(result.endDate).toBe("2026-12-03");
    });

    it("resolves 4 days in Tháng 1 to 2027-01-01 -> 2027-01-04", () => {
      const result = resolveFlexibleDates(4, ["Tháng 1"], baseDate);
      expect(result.startDate).toBe("2027-01-01");
      expect(result.endDate).toBe("2027-01-04");
    });

    it("falls back to 7 days from baseDate when no month is specified", () => {
      const result = resolveFlexibleDates(3, [], baseDate);
      expect(result.startDate).toBe("2026-10-26");
      expect(result.endDate).toBe("2026-10-28");
    });
  });

  describe("isDateInFlexibleMonth", () => {
    it("returns true when date is in the specified flexible month", () => {
      expect(isDateInFlexibleMonth("2026-12-01", "Tháng 12", baseDate)).toBe(true);
      expect(isDateInFlexibleMonth("2026-12-25", "Tháng 12", baseDate)).toBe(true);
      expect(isDateInFlexibleMonth("2026-10-26", "Tháng 12", baseDate)).toBe(false);
    });
  });

  describe("formatWhenSelection", () => {
    it("formats flexible selection with month in Vietnamese", () => {
      const text = formatWhenSelection({
        type: "flexible",
        durationDays: 3,
        flexibleMonths: ["Tháng 12"],
        locale: "vi",
      });
      expect(text).toBe("3 ngày trong Tháng 12");
    });

    it("formats flexible selection without month in Vietnamese", () => {
      const text = formatWhenSelection({
        type: "flexible",
        durationDays: 3,
        locale: "vi",
      });
      expect(text).toBe("3 ngày (Linh hoạt)");
    });

    it("formats flexible selection in English", () => {
      const text = formatWhenSelection({
        type: "flexible",
        durationDays: 3,
        flexibleMonths: ["Dec 2026"],
        locale: "en",
      });
      expect(text).toBe("3 days in Dec 2026");
    });

    it("formats concrete dates in Vietnamese", () => {
      const text = formatWhenSelection({
        type: "dates",
        startDate: "2026-10-26",
        endDate: "2026-10-29",
        locale: "vi",
      });
      expect(text).toBe("26 – 29 thg 10");
    });

    it("formats concrete dates across months in Vietnamese", () => {
      const text = formatWhenSelection({
        type: "dates",
        startDate: "2026-10-28",
        endDate: "2026-11-02",
        locale: "vi",
      });
      expect(text).toBe("28 thg 10 – 2 thg 11");
    });
  });

  describe("formatLocalDateIso", () => {
    it("formats local date without UTC offset shifting", () => {
      const d = new Date(2026, 11, 1);
      expect(formatLocalDateIso(d)).toBe("2026-12-01");
    });
  });

  describe("parseFlexiblePreferenceFromNotes", () => {
    it("parses duration and month from standard flexible note format", () => {
      const notes = "Travel preference: 2 days flexible (Tháng 11)";
      const result = parseFlexiblePreferenceFromNotes(notes);
      expect(result).toEqual({
        durationDays: 2,
        flexibleMonths: ["Tháng 11"],
      });
    });

    it("parses multiple flexible months", () => {
      const notes = "Travel preference: 3 days flexible (Tháng 11, Tháng 12)\n\nTravelers: 2 adults";
      const result = parseFlexiblePreferenceFromNotes(notes);
      expect(result).toEqual({
        durationDays: 3,
        flexibleMonths: ["Tháng 11", "Tháng 12"],
      });
    });

    it("parses flexible note without months", () => {
      const notes = "Travel preference: 4 days flexible";
      const result = parseFlexiblePreferenceFromNotes(notes);
      expect(result).toEqual({
        durationDays: 4,
        flexibleMonths: undefined,
      });
    });

    it("returns null for non-flexible notes or missing notes", () => {
      expect(parseFlexiblePreferenceFromNotes(null)).toBeNull();
      expect(parseFlexiblePreferenceFromNotes(undefined)).toBeNull();
      expect(parseFlexiblePreferenceFromNotes("Just regular notes")).toBeNull();
      expect(parseFlexiblePreferenceFromNotes("")).toBeNull();
    });
  });
});
