import assert from "node:assert/strict";
import test from "node:test";
import {
  addItineraryItemsSchema,
  getTripItinerarySchema,
  removeItineraryItemSchema,
  updateItineraryItemSchema,
  replaceItineraryItemSchema,
  replaceDayItinerarySchema,
  manageItineraryDaysSchema,
  updateTripDetailsSchema,
  reorderItineraryItemsSchema,
  sortItineraryItemsByTime,
  getItineraryManagementTools,
} from "./itinerary-management.js";
import {
  normalizeActivityPeriod,
  parseTimes,
  resolveProposalCommitAction,
} from "./create-trip-proposal.js";

test("addItineraryItemsSchema validates inputs correctly", () => {
  const valid = {
    dayNumber: 1,
    items: [
      {
        period: "MORNING",
        timeSlot: "08:00 - 10:00",
        title: "Bãi biển Mỹ Khê",
        category: "ATTRACTION",
      },
      {
        period: "AFTERNOON",
        title: "Bánh tráng cuốn thịt heo",
        category: "FOOD",
      },
      {
        period: "AFTERNOON",
        title: "Dạo biển Mỹ Khê",
        category: "BEACH",
      },
    ],
  };
  const parsed = addItineraryItemsSchema.safeParse(valid);
  assert.equal(parsed.success, true);

  // Rejects dayNumber < 1
  const invalidDay = addItineraryItemsSchema.safeParse({
    dayNumber: 0,
    items: [{ period: "MORNING", title: "Test", category: "ACTIVITY" }],
  });
  assert.equal(invalidDay.success, false);

  // Rejects empty items array
  const emptyItems = addItineraryItemsSchema.safeParse({
    dayNumber: 1,
    items: [],
  });
  assert.equal(emptyItems.success, false);
});

test("mutation schemas validate UUIDs and fields", () => {
  const parsedRemove = removeItineraryItemSchema.safeParse({
    itemId: "item-123",
  });
  assert.equal(parsedRemove.success, true);

  const parsedUpdate = updateItineraryItemSchema.safeParse({
    itemId: "item-123",
    timeSlot: "12:30 - 14:00",
    notes: "Đặt bàn trước",
  });
  assert.equal(parsedUpdate.success, true);

  const parsedReplace = replaceItineraryItemSchema.safeParse({
    itemId: "item-123",
    newTitle: "Khách sạn InterContinental",
    newCategory: "STAY",
  });
  assert.equal(parsedReplace.success, true);
});

test("tools return safe error when no linked trip is found", async () => {
  const mockContext = {
    chatId: "chat-1",
    userId: "user-1",
    authorization: "Bearer mock",
    runtime: {
      runId: "run-1",
      brief: undefined,
      autoCommitAuthorized: false,
    },
  };

  const tools = getItineraryManagementTools(mockContext);

  const addResult = await (tools.addItineraryItems as any).execute({
    dayNumber: 1,
    items: [{ period: "MORNING", title: "Test", category: "ATTRACTION" }],
  });
  assert.equal(addResult.success, false);
  assert.match(addResult.error, /chưa có chuyến đi/i);

  const getResult = await (tools.getTripItinerary as any).execute({});
  assert.equal(getResult.success, false);

  const removeResult = await (tools.removeItineraryItem as any).execute({
    itemId: "item-1",
  });
  assert.equal(removeResult.success, false);

  const updateResult = await (tools.updateItineraryItem as any).execute({
    itemId: "item-1",
    title: "Updated",
  });
  assert.equal(updateResult.success, false);

  const replaceResult = await (tools.replaceItineraryItem as any).execute({
    itemId: "item-1",
    newTitle: "Replaced",
  });
  assert.equal(replaceResult.success, false);

  const reorderResult = await (tools.reorderItineraryItems as any).execute({
    dayNumber: 1,
    sortByTime: true,
  });
  assert.equal(reorderResult.success, false);
});

test("reorderItineraryItemsSchema and sortItineraryItemsByTime sort chronologically with unscheduled items last", () => {
  const parsed = reorderItineraryItemsSchema.safeParse({
    dayNumber: 1,
    sortByTime: true,
    preserveTimes: true,
  });
  assert.equal(parsed.success, true);

  const sorted = sortItineraryItemsByTime([
    { id: "c", startTime: "13:00:00", sortOrder: 10 },
    { id: "d", startTime: null, sortOrder: 20 },
    { id: "a", startTime: "09:00", sortOrder: 30 },
    { id: "b", startTime: "11:30", sortOrder: 40 },
    { id: "e", startTime: null, sortOrder: 50 },
  ]);
  assert.deepEqual(
    sorted.map((it) => it.id),
    ["a", "b", "c", "d", "e"],
  );
});

test("addItineraryItemsSchema accepts NOON period and normalizeActivityPeriod aligns lunch slots", () => {
  const parsed = addItineraryItemsSchema.safeParse({
    dayNumber: 1,
    items: [
      {
        period: "NOON",
        timeSlot: "11:30 - 13:00",
        title: "Ẩm thực Trần",
        category: "FOOD",
      },
    ],
  });
  assert.equal(parsed.success, true);

  assert.equal(normalizeActivityPeriod("MORNING", "11:30 - 13:00"), "NOON");
  assert.equal(normalizeActivityPeriod("MORNING", "11:00 - 12:30"), "NOON");
  assert.equal(normalizeActivityPeriod("MORNING", "11:00 - 11:30"), "MORNING");
  assert.equal(normalizeActivityPeriod("NOON", "08:30 - 10:30"), "MORNING");
  assert.equal(normalizeActivityPeriod("MORNING", "14:00 - 16:00"), "AFTERNOON");
  assert.equal(normalizeActivityPeriod("MORNING", "19:00 - 21:00"), "EVENING");
  assert.equal(normalizeActivityPeriod("FLEXIBLE", "12:00 - 13:00"), "FLEXIBLE");
});

test("parseTimes supports both ranges and single start times while rejecting invalid ranges", () => {
  assert.deepEqual(parseTimes("08:30 - 10:00"), { startTime: "08:30:00", endTime: "10:00:00" });
  assert.deepEqual(parseTimes("12:30"), { startTime: "12:30:00", endTime: null });
  assert.deepEqual(parseTimes("9:05"), { startTime: "09:05:00", endTime: null });
  assert.deepEqual(parseTimes("15:00 - 14:00"), { startTime: null, endTime: null });
  assert.deepEqual(parseTimes(undefined), { startTime: null, endTime: null });
});

test("resolveProposalCommitAction enforces deterministic replace guard for populated trips", () => {
  assert.deepEqual(
    resolveProposalCommitAction({
      explicitMode: undefined,
      dayNumbers: [1, 2],
      hasTripItems: false,
      tripDaysCount: 2,
    }),
    { action: "ADD_TO_TRIP" },
  );
  assert.deepEqual(
    resolveProposalCommitAction({
      explicitMode: undefined,
      dayNumbers: [1, 2],
      hasTripItems: true,
      tripDaysCount: 2,
    }),
    { action: "REPLACE_TRIP_ITEMS" },
  );
  assert.deepEqual(
    resolveProposalCommitAction({
      explicitMode: undefined,
      dayNumbers: [2],
      hasTripItems: true,
      tripDaysCount: 3,
    }),
    { action: "REPLACE_DAYS", replaceDayNumbers: [2] },
  );
  assert.deepEqual(
    resolveProposalCommitAction({
      explicitMode: "REPLACE_DAYS",
      dayNumbers: [1, 2],
      hasTripItems: false,
      tripDaysCount: 3,
    }),
    { action: "REPLACE_DAYS", replaceDayNumbers: [1, 2] },
  );
});

test("granular day and trip tools call expected trip-service endpoints and sync runtime state", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; url: string; body?: any }> = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url: urlStr, body });

    if (urlStr.endsWith("/api/trips/trip-1/itinerary") && method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            revision: 7,
            destinationName: "Đà Nẵng",
            days: [
              { id: "day-1", dayNumber: 1, version: 2, items: [{ id: "it-1", title: "Old" }] },
              { id: "day-2", dayNumber: 2, version: 3, items: [] },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.includes("/api/places/search") || urlStr.includes("/api/places/batch-snapshots")) {
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.endsWith("/api/trips/trip-1/itinerary/days/day-1/items") && method === "PUT") {
      return new Response(
        JSON.stringify({ success: true, data: { id: "day-1", dayNumber: 1, items: body.items } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.includes("/api/trips/trip-1/itinerary/days/day-2/items") && method === "DELETE") {
      return new Response(
        JSON.stringify({ success: true, data: { id: "day-2", dayNumber: 2, items: [] } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.endsWith("/api/trips/trip-1/itinerary/days/swap") && method === "POST") {
      return new Response(JSON.stringify({ success: true, data: { days: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.endsWith("/api/trips/trip-1/itinerary/items/it-1") && method === "PATCH") {
      return new Response(JSON.stringify({ success: true, data: { id: "it-1", ...body } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.endsWith("/api/trips/trip-1") && method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          data: { id: "trip-1", startDate: "2026-12-01", endDate: "2026-12-02" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (urlStr.endsWith("/api/trips/trip-1") && method === "PATCH") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "trip-1",
            startDate: body.startDate || "2026-12-01",
            endDate: body.endDate || "2026-12-03",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  assert.equal(
    replaceDayItinerarySchema.safeParse({
      dayNumber: 1,
      items: [{ period: "MORNING", title: "Nghỉ ngơi", category: "ACTIVITY" }],
    }).success,
    true,
  );
  assert.equal(
    manageItineraryDaysSchema.safeParse({ action: "SWAP_DAYS", firstDayNumber: 1, secondDayNumber: 2 }).success,
    true,
  );
  assert.equal(updateTripDetailsSchema.safeParse({ durationDays: 3, travelerCount: 4 }).success, true);

  const runtime: any = {
    runId: "run-1",
    tripId: "trip-1",
    tripRevision: 7,
    hasTripItems: true,
    tripDaysCount: 2,
  };
  const tools = getItineraryManagementTools({
    chatId: "chat-1",
    userId: "user-1",
    authorization: "Bearer mock",
    runtime,
  });

  const repDay = await (tools.replaceDayItinerary as any).execute({
    dayNumber: 1,
    items: [
      { period: "MORNING", timeSlot: "09:00 - 11:00", title: "Nghỉ ngơi tại khách sạn", category: "ACTIVITY" },
    ],
  });
  assert.equal(repDay.success, true);
  assert.equal(repDay.replacedCount, 1);
  assert.equal(runtime.tripRevision, 8);

  const clearDay = await (tools.manageItineraryDays as any).execute({
    action: "CLEAR_DAY",
    dayNumber: 2,
  });
  assert.equal(clearDay.success, true);

  const swapDays = await (tools.manageItineraryDays as any).execute({
    action: "SWAP_DAYS",
    firstDayNumber: 1,
    secondDayNumber: 2,
  });
  assert.equal(swapDays.success, true);

  const moveItem = await (tools.updateItineraryItem as any).execute({
    itemId: "it-1",
    targetDayNumber: 2,
    timeSlot: "14:00",
  });
  assert.equal(moveItem.success, true);
  const patchMoveCall = calls.find(
    (c) => c.method === "PATCH" && c.url.endsWith("/items/it-1"),
  );
  assert.equal(patchMoveCall?.body?.targetDayId, "day-2");
  assert.equal(patchMoveCall?.body?.startTime, "14:00:00");

  const updatedTrip = await (tools.updateTripDetails as any).execute({
    durationDays: 3,
    travelerCount: 4,
  });
  assert.equal(updatedTrip.success, true);
  assert.equal(runtime.tripDaysCount, 3);
  const patchTripCall = calls.find(
    (c) => c.method === "PATCH" && c.url.endsWith("/api/trips/trip-1"),
  );
  assert.equal(patchTripCall?.body?.endDate, "2026-12-03");
  assert.equal(patchTripCall?.body?.travelerCount, 4);
});
