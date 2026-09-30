import assert from "node:assert/strict";
import test from "node:test";
import {
  hasCancellationIntent,
  hasExplicitPlanningIntent,
  hasTravelerMention,
  missingFields,
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

