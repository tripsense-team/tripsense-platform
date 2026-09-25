import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatConversationTime } from "../utils/format-chat-time";

describe("formatConversationTime", () => {
  const fixedNow = new Date("2026-09-25T02:42:43.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for null, undefined, or empty inputs", () => {
    expect(formatConversationTime(null)).toBe("");
    expect(formatConversationTime(undefined)).toBe("");
    expect(formatConversationTime("")).toBe("");
  });

  it("preserves pre-formatted mock strings that are not dates", () => {
    expect(formatConversationTime("10:20")).toBe("10:20");
    expect(formatConversationTime("Hôm qua")).toBe("Hôm qua");
  });

  it("formats messages sent within the last minute as 'Vừa xong' or 'Just now'", () => {
    const fortySecondsAgo = new Date(fixedNow.getTime() - 40 * 1000).toISOString();
    expect(formatConversationTime(fortySecondsAgo, "vi")).toBe("Vừa xong");
    expect(formatConversationTime(fortySecondsAgo, "en")).toBe("Just now");
  });

  it("formats messages sent earlier today as HH:mm in local time", () => {
    const twoHoursAgo = new Date(fixedNow.getTime() - 2 * 60 * 60 * 1000);
    const expectedHours = String(twoHoursAgo.getHours()).padStart(2, "0");
    const expectedMinutes = String(twoHoursAgo.getMinutes()).padStart(2, "0");

    expect(formatConversationTime(twoHoursAgo.toISOString(), "vi")).toBe(
      `${expectedHours}:${expectedMinutes}`
    );
  });

  it("formats messages sent yesterday as 'Hôm qua' or 'Yesterday'", () => {
    const yesterday = new Date(fixedNow.getTime() - 24 * 60 * 60 * 1000);
    expect(formatConversationTime(yesterday.toISOString(), "vi")).toBe("Hôm qua");
    expect(formatConversationTime(yesterday.toISOString(), "en")).toBe("Yesterday");
  });

  it("formats messages sent 3 days ago as short weekday abbreviation", () => {
    const threeDaysAgo = new Date(fixedNow.getTime() - 3 * 24 * 60 * 60 * 1000);
    const viRes = formatConversationTime(threeDaysAgo.toISOString(), "vi");
    const enRes = formatConversationTime(threeDaysAgo.toISOString(), "en");

    expect(["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"]).toContain(viRes);
    expect(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).toContain(enRes);
  });

  it("formats messages older than 7 days in the same year as dd/MM", () => {
    const twentyDaysAgo = new Date(fixedNow.getTime() - 20 * 24 * 60 * 60 * 1000);
    const day = String(twentyDaysAgo.getDate()).padStart(2, "0");
    const month = String(twentyDaysAgo.getMonth() + 1).padStart(2, "0");

    expect(formatConversationTime(twentyDaysAgo.toISOString(), "vi")).toBe(`${day}/${month}`);
  });

  it("formats messages from previous years as dd/MM/yyyy", () => {
    const lastYear = new Date("2025-05-15T10:00:00.000Z");
    const day = String(lastYear.getDate()).padStart(2, "0");
    const month = String(lastYear.getMonth() + 1).padStart(2, "0");

    expect(formatConversationTime(lastYear.toISOString(), "vi")).toBe(`${day}/${month}/2025`);
  });

  it("handles numeric timestamps accurately", () => {
    const timestamp = fixedNow.getTime() - 30 * 1000;
    expect(formatConversationTime(timestamp, "vi")).toBe("Vừa xong");
  });
});
