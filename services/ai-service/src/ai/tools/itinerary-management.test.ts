import assert from "node:assert/strict";
import test from "node:test";
import {
  addItineraryItemsSchema,
  getTripItinerarySchema,
  removeItineraryItemSchema,
  updateItineraryItemSchema,
  replaceItineraryItemSchema,
  reorderItineraryItemsSchema,
  sortItineraryItemsByTime,
  getItineraryManagementTools,
} from "./itinerary-management.js";
import { normalizeActivityPeriod } from "./create-trip-proposal.js";

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
