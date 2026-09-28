import { describe, expect, it } from "vitest";
import {
  areAllDaysIdentical,
  getTodayOpeningHours,
  isDayOfWeek,
  parseOpeningHours,
} from "./opening-hours";

describe("opening-hours utility", () => {
  const sampleVietnamese =
    "Thứ Hai: 06:00–22:00; Thứ Ba: 06:00–22:00; Thứ Tư: 06:00–22:00; Thứ Năm: 06:00–22:00; Thứ Sáu: 06:00–22:00; Thứ Bảy: 06:00–22:00; Chủ Nhật: 06:00–22:00";

  const sampleEnglish =
    "Monday: 08:00 - 20:00; Tuesday: 08:00 - 20:00; Wednesday: 08:00 - 20:00; Thursday: 08:00 - 20:00; Friday: 08:00 - 22:00; Saturday: 09:00 - 22:00; Sunday: Closed";

  it("identifies day of week correctly with diacritics and casing", () => {
    expect(isDayOfWeek("Thứ Hai", 1)).toBe(true);
    expect(isDayOfWeek("thứ 2", 1)).toBe(true);
    expect(isDayOfWeek("Monday", 1)).toBe(true);
    expect(isDayOfWeek("Chủ Nhật", 0)).toBe(true);
    expect(isDayOfWeek("Sunday", 0)).toBe(true);
    expect(isDayOfWeek("Thứ Bảy", 6)).toBe(true);
    expect(isDayOfWeek("Saturday", 6)).toBe(true);
  });

  it("parses Vietnamese multi-day semicolon string", () => {
    const parsed = parseOpeningHours(sampleVietnamese, 1); // Monday
    expect(parsed).toHaveLength(7);
    expect(parsed[0].day).toBe("Thứ Hai");
    expect(parsed[0].hours).toBe("06:00–22:00");
    expect(parsed[0].isToday).toBe(true);
    expect(parsed[1].isToday).toBe(false);
  });

  it("detects when all days are identical", () => {
    const parsed = parseOpeningHours(sampleVietnamese);
    expect(areAllDaysIdentical(parsed)).toBe(true);

    const parsedEnglish = parseOpeningHours(sampleEnglish);
    expect(areAllDaysIdentical(parsedEnglish)).toBe(false);
  });

  it("gets today's opening hours", () => {
    // When today is Friday (5)
    expect(getTodayOpeningHours(sampleEnglish, 5)).toBe("08:00 - 22:00");
    // When today is Sunday (0)
    expect(getTodayOpeningHours(sampleEnglish, 0)).toBe("Closed");
  });

  it("handles single-line opening hours gracefully", () => {
    const single = "08:00 - 22:00";
    const parsed = parseOpeningHours(single);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].hours).toBe("08:00 - 22:00");
    expect(getTodayOpeningHours(single)).toBe("08:00 - 22:00");
  });

  it("handles empty or null inputs", () => {
    expect(parseOpeningHours(null)).toEqual([]);
    expect(parseOpeningHours("")).toEqual([]);
    expect(getTodayOpeningHours(undefined)).toBeNull();
  });
});
