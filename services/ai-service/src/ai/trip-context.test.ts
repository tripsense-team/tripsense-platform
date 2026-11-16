import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODEL_ID } from "./models.js";
import { getSystemPrompt } from "./prompts.js";
import { extractLatestTripBriefFromMessages } from "./tools/update-trip-planning-brief.js";
import {
  briefFromClientPreferences,
  briefFromTripRecord,
  buildConversationHistory,
  evaluateSpeculativePrefetchPlan,
  formatBudgetTierHint,
  formatClientPreferencesSummary,
  formatPlanningStateSummary,
  formatPrefetchedCandidatesSummary,
  formatTripSummary,
  formatUserPreferencesSummary,
  mergeEffectiveBrief,
  postChatTripPreferencesSchema,
} from "./trip-context.js";

test("briefFromClientPreferences converts flexible header pills into TripPlanningBrief", () => {
  const parsed = postChatTripPreferencesSchema.parse({
    where: { location: "Đà Nẵng", isRoadTrip: false },
    when: {
      type: "flexible",
      durationDays: 3,
      flexibleMonths: ["Tháng 1"],
    },
  });

  const brief = briefFromClientPreferences(parsed);
  assert.deepEqual(brief, {
    where: { destinationText: "Đà Nẵng" },
    when: {
      type: "flexible",
      durationDays: 3,
      flexibleMonths: ["Tháng 1"],
    },
  });

  const summary = formatClientPreferencesSummary(brief);
  assert.equal(
    summary,
    "- Điểm đến: Đà Nẵng | Thời gian: 3 ngày linh hoạt (Tháng 1)",
  );
});

test("briefFromClientPreferences converts fixed dates and traveler counts accurately", () => {
  const parsed = postChatTripPreferencesSchema.parse({
    where: { location: "Phú Quốc" },
    when: {
      type: "dates",
      startDate: "2026-12-10",
      endDate: "2026-12-13",
    },
    who: { adults: 2, children: 1, infants: 0, pets: 0 },
    budget: { mode: "TOTAL", amount: 15000000, currency: "VND" },
  });

  const brief = briefFromClientPreferences(parsed);
  assert.deepEqual(brief, {
    where: { destinationText: "Phú Quốc" },
    when: {
      type: "dates",
      startDate: "2026-12-10",
      endDate: "2026-12-13",
      durationDays: 4,
    },
    who: { adults: 2, children: 1, infants: 0, pets: 0 },
    budget: { mode: "TOTAL", amount: 15000000, currency: "VND" },
  });
});

test("mergeEffectiveBrief keeps authoritative trip record ahead of persisted and client hints", () => {
  const tripRecordBrief = briefFromTripRecord({
    destinationName: "Đà Nẵng",
    startDate: "2027-01-01",
    endDate: "2027-01-03",
    travelerCount: 2,
    notes: "Travel preference: 3 days flexible (Tháng 1)",
  });
  const clientBrief = briefFromClientPreferences({
    where: { location: "Hà Nội" },
    when: { type: "flexible", durationDays: 5 },
    budget: { mode: "FLEXIBLE" },
  });

  const merged = mergeEffectiveBrief({
    tripRecordBrief,
    clientBrief,
  });

  assert.equal(merged?.where?.destinationText, "Đà Nẵng");
  assert.equal(merged?.when?.durationDays, 3);
  assert.deepEqual(merged?.when?.flexibleMonths, ["Tháng 1"]);
  assert.deepEqual(merged?.who, { adults: 2, children: 0, infants: 0, pets: 0 });
  assert.deepEqual(merged?.budget, { mode: "FLEXIBLE" });
});

test("getSystemPrompt injects clientPreferencesSummary when trip is not yet linked", () => {
  const prompt = getSystemPrompt({
    userPreferences: {
      travelParty: "COUPLE",
      budgetTier: "MID_RANGE",
      stayStyles: ["RESORT"],
      foodStyles: ["LOCAL_FOOD"],
      activityInterests: ["BEACH"],
      splurgeCategories: [],
    },
    clientPreferencesSummary: "- Điểm đến: Đà Nẵng | Thời gian: 3 ngày linh hoạt (Tháng 1)",
    planningStatus: "READY",
    planningBrief: {
      where: { destinationText: "Đà Nẵng" },
      when: { type: "flexible", durationDays: 3, flexibleMonths: ["Tháng 1"] },
    },
  });

  assert.match(prompt, /THÔNG TIN CHUYẾN ĐI NGƯỜI DÙNG ĐÃ CHỌN SẴN TRÊN GIAO DIỆN/);
  assert.match(prompt, /Đà Nẵng/);
  assert.match(prompt, /3 ngày linh hoạt \(Tháng 1\)/);
  assert.match(prompt, /Cặp đôi/);
  assert.match(prompt, /Ẩm thực địa phương/);
  assert.match(prompt, /Trạng thái: READY/);
  assert.match(prompt, /TUYỆT ĐỐI KHÔNG hỏi lại Where\/When\/Who/);
});

test("DEFAULT_MODEL_ID defaults to gemini-3.8-flash", () => {
  assert.equal(DEFAULT_MODEL_ID, "gemini-3.8-flash");
});

test("formatBudgetTierHint and formatClientPreferencesSummary include tier budgets", () => {
  assert.equal(formatBudgetTierHint("sensible"), "Hợp lý / tầm trung (sensible)");
  assert.equal(formatBudgetTierHint("any"), undefined);

  const brief = briefFromClientPreferences({
    where: { location: "Huế" },
    when: { type: "flexible", durationDays: 2 },
    budget: "upscale",
  });
  const summary = formatClientPreferencesSummary(brief, "upscale");
  assert.equal(
    summary,
    "- Điểm đến: Huế | Thời gian: 2 ngày linh hoạt | Ngân sách: Cao cấp (upscale)",
  );
});

test("formatTripSummary includes destinationPlaceId, budget, notes, and item refs", () => {
  const summary = formatTripSummary(
    {
      name: "Chuyến đi Đà Nẵng",
      destinationName: "Đà Nẵng",
      destinationPlaceId: "place_dn_1",
      startDate: "2027-01-01",
      endDate: "2027-01-03",
      travelerCount: 2,
      budgetAmount: 8000000,
      budgetCurrency: "VND",
      notes: "Travel preference: 3 days flexible (Tháng 1)\nƯu tiên gần biển Mỹ Khê",
    },
    [
      {
        dayNumber: 1,
        items: [
          {
            id: "item-1",
            type: "MEAL",
            title: "Mì Quảng Bà Mua",
            startTime: "08:00:00",
            endTime: "09:00:00",
            placeRef: "ChIJ-mi-quang",
          },
        ],
      },
    ],
  );

  assert.ok(summary);
  assert.match(summary, /ID điểm đến: place_dn_1/);
  assert.match(summary, /Ngân sách: 8000000 VND/);
  assert.match(summary, /Ghi chú chuyến đi: Ưu tiên gần biển Mỹ Khê/);
  assert.match(summary, /\[08:00-09:00\] MEAL: Mì Quảng Bà Mua \(itemId:item-1, placeRef:ChIJ-mi-quang\)/);
});

test("formatUserPreferencesSummary and formatPlanningStateSummary produce human-readable Vietnamese", () => {
  const prefsText = formatUserPreferencesSummary({
    travelParty: "FAMILY",
    budgetTier: "PREMIUM",
    stayStyles: ["HOTEL", "RESORT"],
    foodStyles: ["SEAFOOD" as string],
    activityInterests: ["NATURE", "CULTURE"],
    splurgeCategories: ["FINE_DINING"],
  });
  assert.ok(prefsText);
  assert.match(prefsText, /Nhóm đi: Gia đình/);
  assert.match(prefsText, /Mức chi tiêu: Cao cấp/);
  assert.match(prefsText, /Lưu trú: Khách sạn, Resort/);

  const stateText = formatPlanningStateSummary("TRIP_LINKED", {
    where: { destinationText: "Đà Lạt" },
    when: { type: "flexible", durationDays: 4 },
  });
  assert.equal(stateText, "Trạng thái: TRIP_LINKED | Where: Đà Lạt | When: 4 ngày linh hoạt");
});

test("buildConversationHistory preserves text and compact tool outputs across turns", () => {
  const messages = buildConversationHistory([
    {
      role: "user",
      parts: [{ type: "text", text: "Tìm quán hải sản ở Đà Nẵng" }],
    },
    {
      role: "assistant",
      parts: [
        {
          type: "tool-searchPlaces",
          output: {
            query: "hải sản Đà Nẵng",
            places: [{ id: "ChIJ-be-man", name: "Hải sản Bé Mặn" }],
          },
        },
        { type: "text", text: "Bạn có thể thử Hải sản Bé Mặn." },
      ],
    },
  ]);

  assert.equal(messages.length, 2);
  assert.equal(messages[0].content, "Tìm quán hải sản ở Đà Nẵng");
  assert.match(messages[1].content, /Bạn có thể thử Hải sản Bé Mặn\./);
  assert.match(messages[1].content, /searchPlaces\("hải sản Đà Nẵng"\) -> Hải sản Bé Mặn \(id:ChIJ-be-man\)/);
});

test("getSystemPrompt avoids duplicating brief details when currentTripSummary is present", () => {
  const prompt = getSystemPrompt({
    currentTripSummary: "- Tên chuyến đi: \"Đà Nẵng\" | Điểm đến: Đà Nẵng | Thời gian: 3 ngày linh hoạt",
    planningStatus: "TRIP_LINKED",
    planningBrief: {
      where: { destinationText: "Đà Nẵng" },
      when: { type: "flexible", durationDays: 3 },
    },
  });

  assert.match(prompt, /- Trạng thái intake hiện tại: Trạng thái: TRIP_LINKED$/m);
  assert.doesNotMatch(prompt, /Where: Đà Nẵng \| When: 3 ngày linh hoạt/);
});

test("extractLatestTripBriefFromMessages finds latest brief part across tool and planning_state messages", () => {
  const brief = {
    where: { destinationText: "Phú Quốc" },
    when: { type: "flexible" as const, durationDays: 3 },
  };
  const extracted = extractLatestTripBriefFromMessages([
    { parts: [{ type: "text", text: "ignored" }] },
    {
      parts: [
        {
          type: "tool-updateTripPlanningBrief",
          output: {
            state: {
              type: "data-tripBrief",
              runId: "run-2",
              intentMessageId: "msg-2",
              version: 2,
              status: "READY",
              brief,
              missingFields: [],
            },
          },
        },
      ],
    },
  ]);

  assert.equal(extracted?.runId, "run-2");
  assert.equal(extracted?.brief.where?.destinationText, "Phú Quốc");
});

test("evaluateSpeculativePrefetchPlan triggers only on actionable non-duplicate planning requests", () => {
  assert.deepEqual(
    evaluateSpeculativePrefetchPlan({
      destinationHint: "Đà Nẵng",
      hasWhen: true,
      isTripLinked: false,
      hasExistingProposal: false,
      hasExplicitIntent: true,
      hasCancelIntent: false,
    }),
    { shouldPrefetch: true, destination: "Đà Nẵng" },
  );

  // Skips pure questions, cancellations, missing when/destination, and chats that already created a proposal
  assert.equal(
    evaluateSpeculativePrefetchPlan({
      destinationHint: "Đà Nẵng",
      hasWhen: true,
      isTripLinked: false,
      hasExistingProposal: false,
      hasExplicitIntent: false,
      hasCancelIntent: false,
    }).shouldPrefetch,
    false,
  );
  assert.equal(
    evaluateSpeculativePrefetchPlan({
      destinationHint: "Đà Nẵng",
      hasWhen: true,
      isTripLinked: true,
      hasExistingProposal: true,
      hasExplicitIntent: true,
      hasCancelIntent: false,
    }).shouldPrefetch,
    false,
  );
  assert.equal(
    evaluateSpeculativePrefetchPlan({
      destinationHint: "Đà Nẵng",
      hasWhen: true,
      isTripLinked: false,
      hasExistingProposal: false,
      hasExplicitIntent: true,
      hasCancelIntent: true,
    }).shouldPrefetch,
    false,
  );
  assert.equal(
    evaluateSpeculativePrefetchPlan({
      destinationHint: "Đà Nẵng",
      hasWhen: false,
      isTripLinked: false,
      hasExistingProposal: false,
      hasExplicitIntent: true,
      hasCancelIntent: false,
    }).shouldPrefetch,
    false,
  );
});

test("formatPrefetchedCandidatesSummary emits compact lines without photo URLs and injects into system prompt", () => {
  const summary = formatPrefetchedCandidatesSummary("Đà Nẵng", [
    {
      category: "ATTRACTION",
      places: [
        {
          id: "place-linh-ung",
          name: "Chùa Linh Ứng",
          address: "Sơn Trà, Đà Nẵng",
          rating: 4.8,
        },
      ],
    },
    {
      category: "FOOD",
      places: [],
    },
  ]);

  assert.ok(summary);
  assert.match(summary, /\+ \[ATTRACTION\] Chùa Linh Ứng \(id:place-linh-ung \| Sơn Trà, Đà Nẵng \| ★4\.8\)/);
  assert.doesNotMatch(summary, /FOOD/);

  const prompt = getSystemPrompt({
    prefetchedCandidatesSummary: summary,
  });
  assert.match(prompt, /ỨNG VIÊN ĐỊA ĐIỂM ĐÃ NẠP SẴN CHO "Đà Nẵng"/);
});

