import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateGoldenScenario,
  GOLDEN_EVAL_SCENARIOS,
  type GoldenEvalScenario,
} from "./golden-eval.js";

function findScenario(id: string): GoldenEvalScenario {
  const found = GOLDEN_EVAL_SCENARIOS.find((s) => s.id === id);
  assert.ok(found, `Missing scenario ${id}`);
  return found;
}

test("GOLDEN_EVAL_SCENARIOS covers 8 distinct scenarios with unique IDs", () => {
  assert.equal(GOLDEN_EVAL_SCENARIOS.length, 8);
  const uniqueIds = new Set(GOLDEN_EVAL_SCENARIOS.map((s) => s.id));
  assert.equal(uniqueIds.size, 8);
});

test("evaluateGoldenScenario passes a compliant 3-day Da Nang proposal", () => {
  const scenario = findScenario("plan_complete_danang_3d");
  const result = evaluateGoldenScenario(scenario, {
    text: "Mình đã thiết kế xong lịch trình Đà Nẵng 3N2Đ đúng gu của bạn!\n- Tháng 2 mát mẻ, nhớ mang áo khoác mỏng buổi tối.",
    toolCalls: [{ toolName: "prepareTripCandidates" }, { toolName: "createTripProposal" }],
    proposal: {
      title: "Khám phá Đà Nẵng 3N2Đ",
      destination: "Đà Nẵng",
      durationDays: 3,
      days: [
        {
          dayNumber: 1,
          theme: "Sơn Trà & Biển Mỹ Khê",
          activities: [
            {
              period: "MORNING",
              timeSlot: "08:30 - 10:30",
              title: "Cổng Chùa Linh Ứng",
              placeId: "dn-attr-linh-ung",
              category: "ATTRACTION",
            },
            {
              period: "NOON",
              timeSlot: "11:30 - 13:00",
              title: "Ẩm thực Trần - 11 Nguyễn Văn Linh",
              placeId: "dn-food-am-thuc-tran",
              category: "FOOD",
            },
            {
              period: "AFTERNOON",
              timeSlot: "14:00 - 15:00",
              title: "Khách Sạn Biển Vàng - Đà Nẵng",
              placeId: "dn-stay-bien-vang",
              category: "STAY",
            },
          ],
        },
        {
          dayNumber: 2,
          theme: "Ngũ Hành Sơn & Ẩm Thực",
          activities: [
            {
              period: "MORNING",
              timeSlot: "08:00 - 10:30",
              title: "Ngũ Hành Sơn",
              placeId: "dn-attr-ngu-hanh-son",
              category: "ATTRACTION",
            },
          ],
        },
        {
          dayNumber: 3,
          theme: "Di Sản & Tạm Biệt",
          activities: [
            {
              period: "NOON",
              timeSlot: "11:00 - 11:45",
              title: "Check-out khách sạn & gửi hành lý",
              category: "STAY",
            },
            {
              period: "AFTERNOON",
              timeSlot: "13:30 - 15:00",
              title: "Chợ Hàn",
              placeId: "dn-attr-cho-han",
              category: "ATTRACTION",
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.passed, true);
  assert.deepEqual(result.failures, []);
});

test("evaluateGoldenScenario flags duplicate places, wrong lunch period, late checkout, forbidden tools, and markdown dumps", () => {
  const scenario = findScenario("plan_complete_danang_3d");
  const result = evaluateGoldenScenario(scenario, {
    text: "### Day 1 – Biển Mỹ Khê\n- ☀️ Morning: Bãi biển Mỹ Khê",
    toolCalls: [{ toolName: "recommendPlaces" }, { toolName: "createTripProposal" }],
    proposal: {
      durationDays: 3,
      days: [
        {
          dayNumber: 1,
          activities: [
            {
              period: "MORNING",
              timeSlot: "11:30 - 13:00",
              title: "Bãi biển Mỹ Khê",
              placeId: "dn-beach-my-khe",
              category: "BEACH",
            },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            {
              period: "AFTERNOON",
              timeSlot: "16:00 - 17:30",
              title: "Bãi biển Mỹ Khê",
              placeId: "dn-beach-my-khe",
              category: "BEACH",
            },
          ],
        },
        {
          dayNumber: 3,
          activities: [
            {
              period: "AFTERNOON",
              timeSlot: "15:30 - 16:30",
              title: "Check-out khách sạn & Tạm biệt Đà Nẵng",
              category: "ACTIVITY",
            },
          ],
        },
      ],
    },
  });

  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.startsWith("FORBIDDEN_TOOL_CALLED:recommendPlaces")));
  assert.ok(result.failures.some((f) => f.startsWith("DUPLICATE_PLACE:")));
  assert.ok(result.failures.some((f) => f.startsWith("MISSING_NOON_PERIOD:")));
  assert.ok(result.failures.some((f) => f.startsWith("LATE_CHECKOUT:")));
  assert.ok(result.failures.includes("FORBIDDEN_MARKDOWN_DAY_DUMP"));
});

test("evaluateGoldenScenario validates intake collection and dislike enforcement", () => {
  const intakeScenario = findScenario("intake_missing_when");
  const intakePass = evaluateGoldenScenario(intakeScenario, {
    text: "Bạn dự định đi Đà Nẵng mấy ngày nhỉ?",
    toolCalls: [{ toolName: "updateTripPlanningBrief" }],
    briefStatus: "COLLECTING",
  });
  assert.equal(intakePass.passed, true);

  const dislikeScenario = findScenario("personalization_respect_dislikes");
  const dislikeFail = evaluateGoldenScenario(dislikeScenario, {
    text: "Đã tạo xong lịch trình.",
    toolCalls: [{ toolName: "createTripProposal" }],
    proposal: {
      durationDays: 2,
      days: [
        {
          dayNumber: 1,
          activities: [
            {
              period: "EVENING",
              timeSlot: "19:00 - 21:00",
              title: "Hải sản Bé Mặn",
              description: "Ăn tối hải sản tươi sống.",
              placeId: "dn-food-be-man",
            },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            {
              period: "MORNING",
              timeSlot: "09:00 - 11:00",
              title: "Ngũ Hành Sơn",
              placeId: "dn-attr-ngu-hanh-son",
            },
          ],
        },
      ],
    },
  });
  assert.equal(dislikeFail.passed, false);
  assert.ok(dislikeFail.failures.some((f) => f.includes("DISLIKED_KEYWORD_PRESENT")));
});
