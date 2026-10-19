import assert from "node:assert/strict";
import test from "node:test";
import {
  addItineraryItemsSchema,
  getTripItinerarySchema,
  removeItineraryItemSchema,
  updateItineraryItemSchema,
  replaceItineraryItemSchema,
  getItineraryManagementTools,
} from "./itinerary-management.js";

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
});
