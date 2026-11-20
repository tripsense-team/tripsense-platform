import { describe, expect, it } from "vitest";
import {
  isValidHHMM,
  parseTimeToMinutes,
  sortItineraryItemsByTime,
} from "../time";
import type { ItineraryItemResponse } from "../../types";

function makeItem(
  id: string,
  startTime: string | null,
  endTime: string | null,
  sortOrder: number,
): ItineraryItemResponse {
  return {
    id,
    dayId: "day-1",
    placeId: null,
    type: "PLACE",
    title: id,
    startTime,
    endTime,
    durationMinutes: null,
    notes: null,
    status: "PLANNED",
    sortOrder,
    placeNameSnapshot: null,
    placeAddressSnapshot: null,
    latSnapshot: null,
    lngSnapshot: null,
    version: 1,
    warnings: [],
  };
}

describe("time utils", () => {
  it("parses HH:mm and HH:mm:ss time strings to minutes since midnight", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("14:15:00")).toBe(855);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("invalid")).toBeNull();
    expect(parseTimeToMinutes(null)).toBeNull();
  });

  it("validates HH:mm time strings", () => {
    expect(isValidHHMM("09:00")).toBe(true);
    expect(isValidHHMM("23:59")).toBe(true);
    expect(isValidHHMM("9:00")).toBe(false);
    expect(isValidHHMM("24:00")).toBe(false);
    expect(isValidHHMM("12:60")).toBe(false);
  });

  it("sorts scheduled items chronologically and places unscheduled items last preserving relative order", () => {
    const items = [
      makeItem("unscheduled-a", null, null, 100),
      makeItem("evening", "19:30:00", "21:00:00", 200),
      makeItem("morning", "08:00:00", "10:00:00", 300),
      makeItem("unscheduled-b", null, null, 400),
      makeItem("noon-b", "12:00:00", "13:00:00", 500),
      makeItem("noon-a", "12:00:00", "12:30:00", 150),
    ];

    const sorted = sortItineraryItemsByTime(items);
    expect(sorted.map((item) => item.id)).toEqual([
      "morning",
      "noon-a",
      "noon-b",
      "evening",
      "unscheduled-a",
      "unscheduled-b",
    ]);
  });
});
