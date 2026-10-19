import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCancellationIntent,
  hasExplicitPlanningIntent,
  hasTravelerMention,
  isDateInFlexibleMonth,
  missingFields,
  parseFlexibleMonth,
  resolveFlexibleDates,
  shouldStopAfterBriefStep,
} from "./update-trip-planning-brief.js";

test("recognizes explicit planning intent but not general destination advice", () => {
  assert.equal(hasExplicitPlanningIntent("Lên lịch trình Đà Nẵng giúp mình"), true);
  assert.equal(hasExplicitPlanningIntent("Plan me a trip to Da Nang"), true);
  assert.equal(hasExplicitPlanningIntent("Đà Nẵng có gì hay?"), false);
});

test("detects traveler mentions accurately to prevent hallucinated traveler counts", () => {
  assert.equal(hasTravelerMention("Tôi muốn đi Đà Nẵng"), false);
  assert.equal(hasTravelerMention("Lên lịch trình Đà Nẵng 3 ngày 2 đêm"), false);
  assert.equal(hasTravelerMention("Đi Đà Nẵng 2 người"), true);
  assert.equal(hasTravelerMention("Chuyến đi cho gia đình 4 người"), true);
  assert.equal(hasTravelerMention("Mình đi solo một mình"), true);
  assert.equal(hasTravelerMention("Hai vợ chồng muốn đi Sapa"), true);
});

test("recognizes cancellation independently from model input", () => {
  assert.equal(hasCancellationIntent("Thôi, để sau nhé"), true);
  assert.equal(hasCancellationIntent("Please cancel this plan"), true);
  assert.equal(hasCancellationIntent("Tôi muốn đi Đà Lạt"), false);
});

test("requires Where, When, Who and Budget without an implicit traveler", () => {
  assert.deepEqual(missingFields({}), ["WHERE", "WHEN", "WHO", "BUDGET"]);
  assert.deepEqual(
    missingFields({
      where: { destinationText: "Đà Nẵng" },
      when: { startDate: "2026-10-10", endDate: "2026-10-12" },
      who: { adults: 2, children: 0, infants: 0, pets: 0 },
      budget: { mode: "FLEXIBLE" },
    }),
    [],
  );
  // Flexible duration without calendar dates
  assert.deepEqual(
    missingFields({
      where: { destinationText: "Đà Nẵng" },
      when: { type: "flexible", durationDays: 3 },
    }),
    [],
  );
  // Where only returns remaining missing fields
  assert.deepEqual(
    missingFields({
      where: { destinationText: "Đà Nẵng" },
    }),
    ["WHEN", "WHO", "BUDGET"],
  );
});

test("stops model stream when planning intake returns COLLECTING or CANCELLED to prevent redundant text", () => {
  // 1. Should stop when runtimeStatus is COLLECTING or CANCELLED
  assert.equal(shouldStopAfterBriefStep([], "COLLECTING"), true);
  assert.equal(shouldStopAfterBriefStep([], "CANCELLED"), true);

  // 2. Should stop when last step's updateTripPlanningBrief result is COLLECTING
  assert.equal(
    shouldStopAfterBriefStep([
      {
        toolResults: [
          {
            toolName: "updateTripPlanningBrief",
            result: { accepted: true, state: { status: "COLLECTING" } },
          },
        ],
      },
    ]),
    true
  );

  // 3. Should NOT stop when status is TRIP_LINKED (so model can proceed to search places and stream itinerary)
  assert.equal(
    shouldStopAfterBriefStep([
      {
        toolResults: [
          {
            toolName: "updateTripPlanningBrief",
            result: { accepted: true, state: { status: "TRIP_LINKED" } },
          },
        ],
      },
    ], "TRIP_LINKED"),
    false
  );

  // 4. Should NOT stop for unrelated tools
  assert.equal(
    shouldStopAfterBriefStep([
      {
        toolResults: [
          {
            toolName: "searchPlaces",
            result: { places: [] },
          },
        ],
      },
    ]),
    false
  );
});

test("resolves flexible months correctly into target year and month", () => {
  const baseDate = new Date("2026-10-19T08:00:00");

  const dec = resolveFlexibleDates(3, ["Tháng 12"], baseDate);
  assert.equal(dec.startDate, "2026-12-01");
  assert.equal(dec.endDate, "2026-12-03");

  const jan = resolveFlexibleDates(3, ["Tháng 1"], baseDate);
  assert.equal(jan.startDate, "2027-01-01");
  assert.equal(jan.endDate, "2027-01-03");

  assert.equal(isDateInFlexibleMonth("2026-12-01", "Tháng 12", baseDate), true);
  assert.equal(isDateInFlexibleMonth("2026-10-26", "Tháng 12", baseDate), false);
});

test("preserves undefined who when only where and when are provided", () => {
  const brief = {
    where: { destinationText: "Đà Lạt" },
    when: { type: "flexible" as const, durationDays: 3 },
  };
  assert.equal((brief as any).who, undefined);
  assert.deepEqual(missingFields(brief), []);
});


