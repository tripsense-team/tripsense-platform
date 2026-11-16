import { generateText, isStepCount, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL_ID } from "../models.js";
import { getSystemPrompt, type PromptContext } from "../prompts.js";
import {
  formatClientPreferencesSummary,
  formatPrefetchedCandidatesSummary,
  formatPlanningStateSummary,
} from "../trip-context.js";
import { normalizePlaceKey, stripVietnameseAccents } from "../place-grounding.js";
import { createTripProposalSchema } from "../tools/create-trip-proposal.js";
import { prepareTripCandidatesInputSchema } from "../tools/prepare-trip-candidates.js";
import { searchPlacesInputSchema } from "../tools/search-places.js";
import { recommendPlacesSchema } from "../tools/recommend-places.js";
import {
  addItineraryItemsSchema,
  getTripItinerarySchema,
  removeItineraryItemSchema,
  replaceItineraryItemSchema,
  updateItineraryItemSchema,
} from "../tools/itinerary-management.js";
import {
  shouldStopAfterBriefStep,
  updateTripPlanningBriefInputSchema,
} from "../tools/update-trip-planning-brief.js";

export interface GoldenEvalActivity {
  period: string;
  timeSlot?: string;
  title: string;
  description?: string;
  placeId?: string;
  category?: string;
}

export interface GoldenEvalProposal {
  title?: string;
  destination?: string;
  durationDays?: number;
  days?: Array<{
    dayNumber: number;
    theme?: string;
    activities: GoldenEvalActivity[];
  }>;
}

export interface GoldenEvalToolCall {
  toolName: string;
  args?: any;
  output?: any;
}

export interface GoldenEvalTrace {
  text: string;
  toolCalls: GoldenEvalToolCall[];
  briefStatus?: string;
  proposal?: GoldenEvalProposal;
}

export interface GoldenEvalExpectations {
  requiredTools?: string[];
  requiredAnyTool?: string[];
  forbiddenTools?: string[];
  expectedBriefStatus?: string;
  expectedDurationDays?: number;
  forbidDuplicatePlaces?: boolean;
  requireNoonForLunchSlots?: boolean;
  forbidLateCheckout?: boolean;
  forbidMarkdownDayDump?: boolean;
  forbiddenKeywords?: string[];
}

export interface GoldenEvalScenario {
  id: string;
  description: string;
  userPrompt: string;
  promptContext: PromptContext;
  expectations: GoldenEvalExpectations;
}

export interface GoldenEvalResult {
  scenarioId: string;
  passed: boolean;
  failures: string[];
}

export interface FixtureCandidate {
  id: string;
  name: string;
  category: "ATTRACTION" | "FOOD" | "CAFE" | "STAY" | "BEACH" | "ACTIVITY";
  address: string;
  rating: number;
  tags?: string[];
}

export const DANANG_EVAL_FIXTURES: FixtureCandidate[] = [
  {
    id: "dn-attr-linh-ung",
    name: "Cổng Chùa Linh Ứng",
    category: "ATTRACTION",
    address: "472H+435 Hoàng Sa, Sơn Trà, Đà Nẵng",
    rating: 4.8,
  },
  {
    id: "dn-attr-ngu-hanh-son",
    name: "Ngũ Hành Sơn",
    category: "ATTRACTION",
    address: "81 Huyền Trân Công Chúa, Ngũ Hành Sơn, Đà Nẵng",
    rating: 4.7,
  },
  {
    id: "dn-attr-cham-museum",
    name: "Bảo tàng Điêu khắc Chăm Đà Nẵng",
    category: "ATTRACTION",
    address: "02 Đ. 2 Tháng 9, Hải Châu, Đà Nẵng",
    rating: 4.6,
  },
  {
    id: "dn-attr-cho-han",
    name: "Chợ Hàn",
    category: "ATTRACTION",
    address: "119 Trần Phú, Hải Châu, Đà Nẵng",
    rating: 4.4,
  },
  {
    id: "dn-beach-my-khe",
    name: "Bãi biển Mỹ Khê",
    category: "BEACH",
    address: "Võ Nguyên Giáp, Sơn Trà, Đà Nẵng",
    rating: 4.8,
  },
  {
    id: "dn-food-am-thuc-tran",
    name: "Ẩm thực Trần - 11 Nguyễn Văn Linh",
    category: "FOOD",
    address: "11 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
    rating: 4.5,
  },
  {
    id: "dn-food-mi-quang-ba-mua",
    name: "Mì Quảng Bà Mua",
    category: "FOOD",
    address: "95A Nguyễn Tri Phương, Thanh Khê, Đà Nẵng",
    rating: 4.5,
  },
  {
    id: "dn-food-am-thuc-ganh",
    name: "Ẩm Thực Gánh",
    category: "FOOD",
    address: "202 Phan Đăng Lưu, Hải Châu, Đà Nẵng",
    rating: 4.6,
  },
  {
    id: "dn-food-be-man",
    name: "Hải sản Bé Mặn",
    category: "FOOD",
    address: "Lô 14 Hoàng Sa, Sơn Trà, Đà Nẵng",
    rating: 4.5,
    tags: ["seafood", "hải sản"],
  },
  {
    id: "dn-cafe-nam-house",
    name: "NAM house Cafe (Egg Coffee)",
    category: "CAFE",
    address: "15/1 Lê Hồng Phong, Hải Châu, Đà Nẵng",
    rating: 4.7,
  },
  {
    id: "dn-cafe-son-tra-marina",
    name: "Sơn Trà Marina Cafe",
    category: "CAFE",
    address: "Hồ Xanh, Thọ Quang, Sơn Trà, Đà Nẵng",
    rating: 4.6,
  },
  {
    id: "dn-stay-bien-vang",
    name: "Khách Sạn Biển Vàng - Đà Nẵng",
    category: "STAY",
    address: "118 Phạm Văn Đồng, Sơn Trà, Đà Nẵng",
    rating: 4.4,
  },
  {
    id: "dn-stay-sala",
    name: "Sala Danang Beach Hotel",
    category: "STAY",
    address: "36-38 Lâm Hoành, Sơn Trà, Đà Nẵng",
    rating: 4.7,
  },
];

function buildPrefetchedDaNangSummary(excludeSeafood = false): string | undefined {
  const categories = ["ATTRACTION", "FOOD", "CAFE", "STAY"] as const;
  const groups = categories.map((cat) => ({
    category: cat,
    places: DANANG_EVAL_FIXTURES.filter((p) => {
      if (p.category !== cat && !(cat === "ATTRACTION" && p.category === "BEACH")) return false;
      if (excludeSeafood && p.tags?.includes("seafood")) return false;
      return true;
    }).map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      rating: p.rating,
    })),
  }));
  return formatPrefetchedCandidatesSummary("Đà Nẵng", groups);
}

export const GOLDEN_EVAL_SCENARIOS: GoldenEvalScenario[] = [
  {
    id: "intake_missing_when",
    description: "Destination only without duration or dates must stay in COLLECTING intake",
    userPrompt: "Mình muốn đi Đà Nẵng",
    promptContext: {
      userName: "Bảo",
      planningStatus: "COLLECTING",
    },
    expectations: {
      requiredTools: ["updateTripPlanningBrief"],
      forbiddenTools: ["createTripProposal", "recommendPlaces"],
      expectedBriefStatus: "COLLECTING",
    },
  },
  {
    id: "plan_complete_danang_3d",
    description: "Full 3-day Da Nang request calls createTripProposal adhering to Group 1 rules",
    userPrompt: "Lên lịch trình Đà Nẵng 3 ngày 2 đêm vào tháng 2 giúp mình",
    promptContext: {
      userName: "Bảo",
      clientPreferencesSummary: formatClientPreferencesSummary({
        where: { destinationText: "Đà Nẵng" },
        when: { type: "flexible", durationDays: 3, flexibleMonths: ["2027-02"] },
      }),
      planningStatus: formatPlanningStateSummary("READY", {
        where: { destinationText: "Đà Nẵng" },
        when: { type: "flexible", durationDays: 3 },
      }),
    },
    expectations: {
      requiredTools: ["createTripProposal"],
      forbiddenTools: ["recommendPlaces"],
      expectedDurationDays: 3,
      forbidDuplicatePlaces: true,
      requireNoonForLunchSlots: true,
      forbidLateCheckout: true,
      forbidMarkdownDayDump: true,
    },
  },
  {
    id: "plan_with_prefetched_candidates",
    description: "Prefetched candidates eliminate redundant prepareTripCandidates round-trip",
    userPrompt: "Lên kế hoạch du lịch Đà Nẵng 2 ngày nhé",
    promptContext: {
      userName: "Bảo",
      currentTripSummary:
        '- Tên chuyến đi: "Chuyến đi Đà Nẵng"\n- Điểm đến: Đà Nẵng\n- Thời gian: 2 ngày linh hoạt',
      planningStatus: "TRIP_LINKED",
      prefetchedCandidatesSummary: buildPrefetchedDaNangSummary(false),
    },
    expectations: {
      requiredTools: ["createTripProposal"],
      forbiddenTools: ["prepareTripCandidates", "recommendPlaces"],
      expectedDurationDays: 2,
      forbidDuplicatePlaces: true,
      requireNoonForLunchSlots: true,
      forbidMarkdownDayDump: true,
    },
  },
  {
    id: "curated_cafe_discovery_only",
    description: "Ad-hoc cafe recommendation asks places without creating an itinerary proposal",
    userPrompt: "Gợi ý cho mình vài quán cafe view đẹp ở Đà Nẵng",
    promptContext: {
      userName: "Bảo",
    },
    expectations: {
      requiredAnyTool: ["recommendPlaces", "searchPlaces"],
      forbiddenTools: ["createTripProposal"],
    },
  },
  {
    id: "general_weather_question",
    description: "Weather inquiry answers directly or via getWeather without triggering trip intake",
    userPrompt: "Thời tiết Đà Nẵng tháng 2 thường thế nào, có lạnh không?",
    promptContext: {
      userName: "Bảo",
    },
    expectations: {
      forbiddenTools: ["createTripProposal", "updateTripPlanningBrief"],
    },
  },
  {
    id: "refine_replace_day1_place",
    description: "Linked trip replace request invokes replaceItineraryItem with existing itemId",
    userPrompt: "Đổi quán ăn tối Ngày 1 Hải sản Bé Mặn sang Mì Quảng Bà Mua giúp mình",
    promptContext: {
      userName: "Bảo",
      planningStatus: "TRIP_LINKED",
      currentTripSummary: [
        '- Tên chuyến đi: "Chuyến đi Đà Nẵng" | Điểm đến: Đà Nẵng | Thời gian: 2027-02-10 đến 2027-02-11',
        "- Các địa điểm đã lưu trong lịch trình:",
        "  + Ngày 1: [18:30-20:00] MEAL: Hải sản Bé Mặn (itemId:it-food-1, placeRef:dn-food-be-man)",
      ].join("\n"),
    },
    expectations: {
      requiredTools: ["replaceItineraryItem"],
      forbiddenTools: ["createTripProposal"],
    },
  },
  {
    id: "refine_remove_day2_item",
    description: "Linked trip delete request removes item without recreating proposal",
    userPrompt: "Xóa hoạt động Bãi biển Mỹ Khê ở Ngày 2 giúp mình",
    promptContext: {
      userName: "Bảo",
      planningStatus: "TRIP_LINKED",
      currentTripSummary: [
        '- Tên chuyến đi: "Chuyến đi Đà Nẵng" | Điểm đến: Đà Nẵng',
        "- Các địa điểm đã lưu trong lịch trình:",
        "  + Ngày 2: [15:30-17:00] PLACE: Bãi biển Mỹ Khê (itemId:it-beach-2, placeRef:dn-beach-my-khe)",
      ].join("\n"),
    },
    expectations: {
      requiredTools: ["removeItineraryItem"],
      forbiddenTools: ["createTripProposal"],
    },
  },
  {
    id: "personalization_respect_dislikes",
    description: "Explicit dislike of seafood and bars must be respected in generated proposal",
    userPrompt: "Lên lịch trình Đà Nẵng 2 ngày, nhớ tránh hải sản và quán bar nhé",
    promptContext: {
      userName: "Bảo",
      clientPreferencesSummary: formatClientPreferencesSummary({
        where: { destinationText: "Đà Nẵng" },
        when: { type: "flexible", durationDays: 2 },
      }),
      planningStatus: "READY",
      prefetchedCandidatesSummary: buildPrefetchedDaNangSummary(true),
    },
    expectations: {
      requiredTools: ["createTripProposal"],
      expectedDurationDays: 2,
      forbiddenKeywords: ["hải sản", "quán bar", "nightclub", "bé mặn"],
    },
  },
];

function parseSlotMinutes(timeSlot?: string): { start: number; end: number | null } | null {
  const match = timeSlot?.match(/(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  const endH = match[3] ? Number(match[3]) : null;
  const endM = match[4] ? Number(match[4]) : null;
  const end =
    endH !== null && endM !== null && endH <= 23 && endM <= 59
      ? endH * 60 + endM
      : null;
  return { start: h * 60 + m, end };
}

function isStayOrLogisticActivity(act: GoldenEvalActivity): boolean {
  if (act.category?.toUpperCase() === "STAY") return true;
  const norm = normalizePlaceKey(act.title);
  return norm.includes("check in") || norm.includes("check out") || norm.includes("khach san");
}

function findDuplicateVenuesAcrossDays(proposal: GoldenEvalProposal): string[] {
  const seenByDay = new Map<string, number>();
  const duplicates: string[] = [];

  for (const day of proposal.days ?? []) {
    for (const act of day.activities ?? []) {
      if (isStayOrLogisticActivity(act)) continue;
      const venueKey = act.placeId?.trim() || normalizePlaceKey(act.title);
      if (!venueKey) continue;
      const prevDay = seenByDay.get(venueKey);
      if (prevDay !== undefined && prevDay !== day.dayNumber) {
        duplicates.push(`${act.title} (Ngày ${prevDay} & Ngày ${day.dayNumber})`);
      } else if (prevDay === undefined) {
        seenByDay.set(venueKey, day.dayNumber);
      }
    }
  }
  return duplicates;
}

/**
 * Deterministically grades an assistant trace against scenario expectations.
 */
export function evaluateGoldenScenario(
  scenario: GoldenEvalScenario,
  trace: GoldenEvalTrace,
): GoldenEvalResult {
  const failures: string[] = [];
  const calledTools = new Set(trace.toolCalls.map((tc) => tc.toolName));
  const { expectations, id } = scenario;

  for (const required of expectations.requiredTools ?? []) {
    if (!calledTools.has(required)) {
      failures.push(`MISSING_REQUIRED_TOOL:${required}`);
    }
  }

  if (
    expectations.requiredAnyTool &&
    expectations.requiredAnyTool.length > 0 &&
    !expectations.requiredAnyTool.some((t) => calledTools.has(t))
  ) {
    failures.push(`MISSING_ANY_TOOL:${expectations.requiredAnyTool.join("|")}`);
  }

  for (const forbidden of expectations.forbiddenTools ?? []) {
    if (calledTools.has(forbidden)) {
      failures.push(`FORBIDDEN_TOOL_CALLED:${forbidden}`);
    }
  }

  if (
    expectations.expectedBriefStatus &&
    trace.briefStatus !== expectations.expectedBriefStatus
  ) {
    failures.push(
      `BRIEF_STATUS_MISMATCH:expected=${expectations.expectedBriefStatus},actual=${trace.briefStatus ?? "NONE"}`,
    );
  }

  const proposal = trace.proposal;
  if (expectations.expectedDurationDays !== undefined) {
    const actualDays = proposal?.days?.length ?? proposal?.durationDays ?? 0;
    if (!proposal || actualDays !== expectations.expectedDurationDays) {
      failures.push(
        `DURATION_DAYS_MISMATCH:expected=${expectations.expectedDurationDays},actual=${actualDays}`,
      );
    }
  }

  if (expectations.forbidDuplicatePlaces && proposal?.days) {
    const duplicates = findDuplicateVenuesAcrossDays(proposal);
    if (duplicates.length > 0) {
      failures.push(`DUPLICATE_PLACE:${duplicates.join(", ")}`);
    }
  }

  if (expectations.requireNoonForLunchSlots && proposal?.days) {
    for (const day of proposal.days) {
      for (const act of day.activities) {
        const slot = parseSlotMinutes(act.timeSlot);
        const isNoonLunch =
          slot !== null &&
          ((slot.start >= 690 && slot.start < 810) ||
            (slot.start >= 660 && slot.start < 690 && slot.end !== null && slot.end > 720));
        if (isNoonLunch && act.period !== "NOON") {
          failures.push(
            `MISSING_NOON_PERIOD:Day${day.dayNumber}:${act.title}(${act.timeSlot},period=${act.period})`,
          );
        }
      }
    }
  }

  if (expectations.forbidLateCheckout && proposal?.days) {
    for (const day of proposal.days) {
      for (const act of day.activities) {
        const normTitle = normalizePlaceKey(act.title);
        const isCheckout = normTitle.includes("check out") || normTitle.includes("tra phong");
        if (!isCheckout) continue;
        const slot = parseSlotMinutes(act.timeSlot);
        if (slot !== null && slot.start > 720) {
          failures.push(`LATE_CHECKOUT:Day${day.dayNumber}:${act.title}(${act.timeSlot})`);
        }
      }
    }
  }

  if (expectations.forbidMarkdownDayDump && trace.text) {
    const hasMarkdownDump =
      /(?:^|\n)#{2,4}\s*(?:Day|Ngày)\s*\d+/i.test(trace.text) ||
      /(?:☀️\s*Morning:|🌤️\s*Afternoon:|🌙\s*Evening:)/i.test(trace.text);
    if (hasMarkdownDump) {
      failures.push("FORBIDDEN_MARKDOWN_DAY_DUMP");
    }
  }

  if (expectations.forbiddenKeywords && expectations.forbiddenKeywords.length > 0 && proposal?.days) {
    for (const kw of expectations.forbiddenKeywords) {
      const normalizedKw = stripVietnameseAccents(kw).toLowerCase().trim();
      if (!normalizedKw) continue;
      for (const day of proposal.days) {
        let foundMatch = false;
        for (const act of day.activities) {
          const rawCombined = `${act.title} ${act.description ?? ""}`;
          const normalizedAct = stripVietnameseAccents(rawCombined).toLowerCase();
          if (normalizedAct.includes(normalizedKw)) {
            failures.push(`DISLIKED_KEYWORD_PRESENT:${kw}[Day${day.dayNumber}:${act.title}]`);
            foundMatch = true;
            break;
          }
        }
        if (foundMatch) break;
      }
    }
  }

  return {
    scenarioId: id,
    passed: failures.length === 0,
    failures,
  };
}

function createEvalHarnessTools(trace: GoldenEvalTrace) {
  let tripLinked = false;

  return {
    getWeather: tool({
      description: "Get the current weather forecast for a city.",
      inputSchema: z.object({ city: z.string().optional() }),
      execute: async ({ city }) => {
        const output = {
          cityName: city || "Đà Nẵng",
          current: { temperature_2m: 23 },
          daily: { temperature_2m_max: [25], temperature_2m_min: [20] },
        };
        trace.toolCalls.push({ toolName: "getWeather", args: { city }, output });
        return output;
      },
    }),

    prepareTripCandidates: tool({
      description:
        "Chuẩn bị trước bộ ứng viên địa điểm có gu theo từng danh mục cho chuyến đi.",
      inputSchema: prepareTripCandidatesInputSchema,
      execute: async (args) => {
        const categories = args.categories ?? ["ATTRACTION", "FOOD", "CAFE", "STAY"];
        const groups = categories.map((cat) => ({
          category: cat,
          source: "recommendation",
          places: DANANG_EVAL_FIXTURES.filter(
            (p) => p.category === cat || (cat === "ATTRACTION" && p.category === "BEACH"),
          ).map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            rating: p.rating,
          })),
        }));
        const output = {
          success: true,
          destination: args.destination || "Đà Nẵng",
          total: groups.reduce((n, g) => n + g.places.length, 0),
          groups,
        };
        trace.toolCalls.push({ toolName: "prepareTripCandidates", args, output });
        return output;
      },
    }),

    searchPlaces: tool({
      description: "Tìm kiếm địa điểm du lịch, ăn uống, cafe, khách sạn có thật.",
      inputSchema: searchPlacesInputSchema,
      execute: async (args) => {
        const query = args.query || args.queries?.[0]?.query || "";
        const normQ = normalizePlaceKey(query);
        const matches = DANANG_EVAL_FIXTURES.filter((p) => {
          const matchCat = !args.category || p.category === args.category;
          const matchName = !normQ || normalizePlaceKey(`${p.name} ${p.address}`).includes(normQ.split(" ")[0] || "");
          return matchCat && matchName;
        });
        const places = (matches.length > 0 ? matches : DANANG_EVAL_FIXTURES.slice(0, 5)).map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          categories: [p.category.toLowerCase()],
          rating: p.rating,
        }));
        const output = { success: true, query, total: places.length, places };
        trace.toolCalls.push({ toolName: "searchPlaces", args, output });
        return output;
      },
    }),

    recommendPlaces: tool({
      description: "Hiển thị thẻ carousel địa điểm gợi ý khi người dùng hỏi tìm quán/điểm đến.",
      inputSchema: recommendPlacesSchema,
      execute: async (args) => {
        const output = {
          success: true,
          title: args.title,
          places: args.places.map((p, i) => ({
            id: p.placeId || `eval-rec-${i}`,
            name: p.name,
            categories: [p.category.toLowerCase()],
          })),
        };
        trace.toolCalls.push({ toolName: "recommendPlaces", args, output });
        return output;
      },
    }),

    updateTripPlanningBrief: tool({
      description: "Ghi nhận và cập nhật Trip Planning Brief (Where/When/Who/Budget).",
      inputSchema: updateTripPlanningBriefInputSchema,
      execute: async (args) => {
        const hasWhen = Boolean(args.when?.startDate || args.when?.durationDays);
        const status = args.cancel
          ? "CANCELLED"
          : hasWhen && args.where?.destinationText
            ? "TRIP_LINKED"
            : "COLLECTING";
        if (status === "TRIP_LINKED") tripLinked = true;
        trace.briefStatus = status;
        const output = {
          accepted: true,
          state: {
            type: "data-tripBrief",
            runId: "eval-run-1",
            intentMessageId: "eval-msg-1",
            version: 1,
            status,
            brief: {
              ...(args.where ? { where: args.where } : {}),
              ...(args.when ? { when: args.when } : {}),
              ...(args.who ? { who: args.who } : {}),
              ...(args.budget ? { budget: args.budget } : {}),
            },
            missingFields: hasWhen ? [] : ["WHEN"],
            ...(tripLinked ? { tripId: "eval-trip-1" } : {}),
          },
        };
        trace.toolCalls.push({ toolName: "updateTripPlanningBrief", args, output });
        return output;
      },
    }),

    createTripProposal: tool({
      description: "Tạo lịch trình nhiều ngày và lưu vào bảng chuyến đi.",
      inputSchema: createTripProposalSchema,
      execute: async (args) => {
        trace.proposal = args;
        const output = {
          success: true,
          proposalId: "eval-proposal-1",
          status: "APPLIED",
          ...args,
        };
        trace.toolCalls.push({ toolName: "createTripProposal", args, output });
        return output;
      },
    }),

    addItineraryItems: tool({
      description: "Thêm hoạt động vào một ngày cụ thể trong chuyến đi.",
      inputSchema: addItineraryItemsSchema,
      execute: async (args) => {
        const output = { success: true, dayNumber: args.dayNumber, appliedCount: args.items.length };
        trace.toolCalls.push({ toolName: "addItineraryItems", args, output });
        return output;
      },
    }),

    getTripItinerary: tool({
      description: "Lấy lịch trình hiện tại của chuyến đi.",
      inputSchema: getTripItinerarySchema,
      execute: async (args) => {
        const output = {
          success: true,
          days: [
            {
              dayNumber: 1,
              items: [{ itemId: "it-food-1", title: "Hải sản Bé Mặn", placeRef: "dn-food-be-man" }],
            },
            {
              dayNumber: 2,
              items: [{ itemId: "it-beach-2", title: "Bãi biển Mỹ Khê", placeRef: "dn-beach-my-khe" }],
            },
          ],
        };
        trace.toolCalls.push({ toolName: "getTripItinerary", args, output });
        return output;
      },
    }),

    removeItineraryItem: tool({
      description: "Xóa một hoạt động khỏi lịch trình.",
      inputSchema: removeItineraryItemSchema,
      execute: async (args) => {
        const output = { success: true, removedItemId: args.itemId };
        trace.toolCalls.push({ toolName: "removeItineraryItem", args, output });
        return output;
      },
    }),

    updateItineraryItem: tool({
      description: "Cập nhật tên, khung giờ hoặc ghi chú của một hoạt động.",
      inputSchema: updateItineraryItemSchema,
      execute: async (args) => {
        const output = { success: true, updatedItemId: args.itemId };
        trace.toolCalls.push({ toolName: "updateItineraryItem", args, output });
        return output;
      },
    }),

    replaceItineraryItem: tool({
      description: "Thay thế một địa điểm hiện có bằng một địa điểm mới.",
      inputSchema: replaceItineraryItemSchema,
      execute: async (args) => {
        const output = { success: true, itemId: args.itemId, newTitle: args.newTitle };
        trace.toolCalls.push({ toolName: "replaceItineraryItem", args, output });
        return output;
      },
    }),
  };
}

export interface LiveEvalScenarioReport extends GoldenEvalResult {
  durationMs: number;
  modelId: string;
  calledTools: string[];
}

export async function runGoldenEval(options: {
  model: LanguageModel;
  modelId?: string;
  scenarios?: GoldenEvalScenario[];
}): Promise<{
  total: number;
  passed: number;
  failed: number;
  reports: LiveEvalScenarioReport[];
}> {
  const modelId = options.modelId || DEFAULT_MODEL_ID;
  const scenarios = options.scenarios || GOLDEN_EVAL_SCENARIOS;
  const reports: LiveEvalScenarioReport[] = [];

  for (const scenario of scenarios) {
    const started = Date.now();
    const trace: GoldenEvalTrace = { text: "", toolCalls: [] };
    const tools = createEvalHarnessTools(trace);

    const res = await generateText({
      model: options.model,
      system: getSystemPrompt({
        currentDate: "Thứ Hai, 16 tháng 11, 2026",
        ...scenario.promptContext,
      }),
      messages: [{ role: "user", content: scenario.userPrompt }],
      tools,
      stopWhen: [
        isStepCount(8),
        ({ steps }: { steps: any[] }) =>
          shouldStopAfterBriefStep(steps, trace.briefStatus),
      ],
    });

    trace.text = res.text;
    const evaluation = evaluateGoldenScenario(scenario, trace);
    reports.push({
      ...evaluation,
      durationMs: Date.now() - started,
      modelId,
      calledTools: trace.toolCalls.map((tc) => tc.toolName),
    });
  }

  const passed = reports.filter((r) => r.passed).length;
  return {
    total: reports.length,
    passed,
    failed: reports.length - passed,
    reports,
  };
}
