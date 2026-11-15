import { z } from "zod";
import type { DeclaredTravelPreferences } from "../personalization/context-preferences.js";
import type { TripPlanningBrief } from "./tools/update-trip-planning-brief.js";

export const postChatTripPreferencesSchema = z.object({
  where: z
    .object({
      location: z.string().trim().max(255).optional(),
      destinationText: z.string().trim().max(255).optional(),
      isRoadTrip: z.boolean().optional(),
    })
    .optional(),
  when: z
    .object({
      type: z.enum(["dates", "flexible"]).optional(),
      startDate: z.string().trim().max(32).optional(),
      endDate: z.string().trim().max(32).optional(),
      flexiblePeriod: z.string().trim().max(64).optional(),
      flexibleMonths: z.array(z.string().trim().max(64)).max(12).optional(),
      durationDays: z.number().int().min(1).max(60).optional(),
    })
    .optional(),
  who: z
    .object({
      adults: z.number().int().min(0).max(100),
      children: z.number().int().min(0).max(100),
      infants: z.number().int().min(0).max(100),
      pets: z.number().int().min(0).max(20),
    })
    .optional(),
  budget: z
    .union([
      z.enum(["any", "budget", "sensible", "upscale", "luxury"]),
      z.object({ mode: z.literal("FLEXIBLE") }),
      z.object({
        mode: z.literal("TOTAL"),
        amount: z.number().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      }),
    ])
    .optional(),
});

export type ClientTripPreferences = z.infer<typeof postChatTripPreferencesSchema>;

function computeInclusiveDays(startDate?: string, endDate?: string): number | undefined {
  if (!startDate || !endDate) return undefined;
  const s = Date.parse(`${startDate}T00:00:00Z`);
  const e = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return undefined;
  return Math.max(1, Math.floor((e - s) / 86_400_000) + 1);
}

export function briefFromClientPreferences(
  prefs?: ClientTripPreferences,
): TripPlanningBrief | undefined {
  if (!prefs) return undefined;

  const destinationText = (
    prefs.where?.destinationText ||
    prefs.where?.location ||
    ""
  ).trim();

  const where = destinationText ? { destinationText } : undefined;

  let when: TripPlanningBrief["when"];
  if (prefs.when) {
    const durationDays =
      prefs.when.durationDays ||
      computeInclusiveDays(prefs.when.startDate, prefs.when.endDate);
    const flexibleMonths = prefs.when.flexibleMonths?.filter(Boolean);
    const hasDates = Boolean(prefs.when.startDate && prefs.when.endDate);
    const isFlexible =
      prefs.when.type === "flexible" || Boolean(durationDays && !hasDates);

    if (isFlexible && (durationDays || (flexibleMonths && flexibleMonths.length > 0))) {
      when = {
        type: "flexible",
        ...(durationDays ? { durationDays } : {}),
        ...(flexibleMonths && flexibleMonths.length > 0 ? { flexibleMonths } : {}),
        ...(prefs.when.startDate ? { startDate: prefs.when.startDate } : {}),
        ...(prefs.when.endDate ? { endDate: prefs.when.endDate } : {}),
      };
    } else if (hasDates) {
      when = {
        type: "dates",
        startDate: prefs.when.startDate,
        endDate: prefs.when.endDate,
        ...(durationDays ? { durationDays } : {}),
      };
    }
  }

  let who: TripPlanningBrief["who"];
  if (prefs.who) {
    const total = prefs.who.adults + prefs.who.children + prefs.who.infants;
    if (total >= 1 && total <= 100) {
      who = prefs.who;
    }
  }

  let budget: TripPlanningBrief["budget"];
  if (prefs.budget) {
    if (typeof prefs.budget === "object") {
      budget = prefs.budget;
    } else if (prefs.budget === "any") {
      budget = { mode: "FLEXIBLE" };
    }
  }

  if (!where && !when && !who && !budget) {
    return undefined;
  }

  return {
    ...(where ? { where } : {}),
    ...(when ? { when } : {}),
    ...(who ? { who } : {}),
    ...(budget ? { budget } : {}),
  };
}

export function briefFromTripRecord(trip: any): TripPlanningBrief | undefined {
  if (!trip || !trip.destinationName) return undefined;

  const duration = computeInclusiveDays(trip.startDate, trip.endDate) ?? 3;
  const flexibleMatch = trip.notes?.match(
    /Travel preference:\s*(\d+)\s*days\s*flexible(?:\s*\(([^)]+)\))?/i,
  );
  const isFlexible = Boolean(flexibleMatch);
  const flexDuration = flexibleMatch ? parseInt(flexibleMatch[1], 10) : duration;
  const flexMonths =
    flexibleMatch && flexibleMatch[2]
      ? flexibleMatch[2]
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : undefined;

  return {
    where: { destinationText: trip.destinationName },
    when: isFlexible
      ? {
          type: "flexible",
          durationDays: flexDuration,
          ...(flexMonths && flexMonths.length > 0 ? { flexibleMonths: flexMonths } : {}),
          startDate: trip.startDate,
          endDate: trip.endDate,
        }
      : {
          type: "dates",
          startDate: trip.startDate,
          endDate: trip.endDate,
          durationDays: duration,
        },
    ...(trip.travelerCount
      ? { who: { adults: trip.travelerCount, children: 0, infants: 0, pets: 0 } }
      : {}),
    ...(trip.budgetAmount != null && trip.budgetCurrency
      ? {
          budget: {
            mode: "TOTAL" as const,
            amount: Number(trip.budgetAmount),
            currency: String(trip.budgetCurrency),
          },
        }
      : {}),
  };
}

export function mergeEffectiveBrief(input: {
  tripRecordBrief?: TripPlanningBrief;
  persistedBrief?: TripPlanningBrief;
  clientBrief?: TripPlanningBrief;
}): TripPlanningBrief | undefined {
  const { tripRecordBrief, persistedBrief, clientBrief } = input;
  const where = tripRecordBrief?.where ?? persistedBrief?.where ?? clientBrief?.where;
  const when = tripRecordBrief?.when ?? persistedBrief?.when ?? clientBrief?.when;
  const who = tripRecordBrief?.who ?? persistedBrief?.who ?? clientBrief?.who;
  const budget = tripRecordBrief?.budget ?? persistedBrief?.budget ?? clientBrief?.budget;

  if (!where && !when && !who && !budget) return undefined;

  return {
    ...(where ? { where } : {}),
    ...(when ? { when } : {}),
    ...(who ? { who } : {}),
    ...(budget ? { budget } : {}),
  };
}

const BUDGET_TIER_LABELS: Record<string, string> = {
  budget: "Tiết kiệm (budget)",
  sensible: "Hợp lý / tầm trung (sensible)",
  upscale: "Cao cấp (upscale)",
  luxury: "Sang trọng (luxury)",
  BUDGET: "Tiết kiệm",
  MID_RANGE: "Tầm trung",
  PREMIUM: "Cao cấp",
};

const ONBOARDING_DIMENSION_LABELS: Record<string, string> = {
  SOLO: "Đi một mình",
  COUPLE: "Cặp đôi",
  FRIENDS: "Nhóm bạn",
  FAMILY: "Gia đình",
  HOTEL: "Khách sạn",
  HOMESTAY: "Homestay",
  RESORT: "Resort",
  HOSTEL: "Hostel",
  LOCAL_FOOD: "Ẩm thực địa phương",
  STREET_FOOD: "Ẩm thực đường phố",
  FINE_DINING: "Nhà hàng cao cấp",
  CAFE: "Quán cà phê",
  NATURE: "Thiên nhiên",
  HIKING: "Leo núi / trekking",
  CULTURE: "Văn hóa - lịch sử",
  BEACH: "Biển",
  NIGHTLIFE: "Giải trí về đêm",
};

function mapOptionLabels(values: string[] | undefined): string {
  if (!values || values.length === 0) return "";
  return values.map((v) => ONBOARDING_DIMENSION_LABELS[v] || v).join(", ");
}

export function formatBudgetTierHint(
  rawBudget?: ClientTripPreferences["budget"],
): string | undefined {
  if (typeof rawBudget !== "string" || rawBudget === "any") return undefined;
  return BUDGET_TIER_LABELS[rawBudget] || rawBudget;
}

export function formatClientPreferencesSummary(
  brief?: TripPlanningBrief,
  rawBudget?: ClientTripPreferences["budget"],
): string | undefined {
  if (!brief) return undefined;

  const parts: string[] = [];
  if (brief.where?.destinationText) {
    parts.push(`Điểm đến: ${brief.where.destinationText}`);
  }
  if (brief.when) {
    if (brief.when.type === "flexible") {
      const daysText = brief.when.durationDays
        ? `${brief.when.durationDays} ngày linh hoạt`
        : "Thời gian linh hoạt";
      const monthsText =
        brief.when.flexibleMonths && brief.when.flexibleMonths.length > 0
          ? ` (${brief.when.flexibleMonths.join(", ")})`
          : "";
      parts.push(`Thời gian: ${daysText}${monthsText}`);
    } else if (brief.when.startDate && brief.when.endDate) {
      parts.push(`Thời gian: ${brief.when.startDate} đến ${brief.when.endDate}`);
    }
  }
  if (brief.who) {
    const total = brief.who.adults + brief.who.children + brief.who.infants;
    if (total > 0) {
      parts.push(`Số người: ${total}`);
    }
  }
  if (brief.budget?.mode === "TOTAL") {
    parts.push(`Ngân sách: ${brief.budget.amount} ${brief.budget.currency}`);
  } else {
    const tierLabel = formatBudgetTierHint(rawBudget);
    if (tierLabel) {
      parts.push(`Ngân sách: ${tierLabel}`);
    }
  }

  return parts.length > 0 ? `- ${parts.join(" | ")}` : undefined;
}

export function formatTripSummary(
  trip: any,
  days?: any[],
  clientBudgetTierHint?: string,
): string | undefined {
  if (!trip) return undefined;

  const flexibleMatch = trip.notes?.match(
    /Travel preference:\s*(\d+)\s*days\s*flexible(?:\s*\(([^)]+)\))?/i,
  );
  const timeSummary = flexibleMatch
    ? `${flexibleMatch[1]} ngày linh hoạt${flexibleMatch[2] ? ` (${flexibleMatch[2]})` : ""} (tạm tính mốc ${trip.startDate} đến ${trip.endDate})`
    : `${trip.startDate} đến ${trip.endDate}`;

  const headerParts = [
    `Tên chuyến đi: "${trip.name}"`,
    `Điểm đến: ${trip.destinationName}`,
    ...(trip.destinationPlaceId ? [`ID điểm đến: ${trip.destinationPlaceId}`] : []),
    `Thời gian: ${timeSummary}`,
    ...(trip.travelerCount ? [`Số người: ${trip.travelerCount}`] : []),
  ];

  if (trip.budgetAmount != null && Number(trip.budgetAmount) > 0) {
    headerParts.push(
      `Ngân sách: ${trip.budgetAmount}${trip.budgetCurrency ? ` ${trip.budgetCurrency}` : ""}`,
    );
  } else if (clientBudgetTierHint) {
    headerParts.push(`Ngân sách ưu tiên: ${clientBudgetTierHint}`);
  }

  let summary = `- ${headerParts.join(" | ")}`;

  const cleanedNotes =
    typeof trip.notes === "string"
      ? trip.notes
          .replace(/Travel preference:\s*\d+\s*days\s*flexible(?:\s*\([^)]+\))?\.?/gi, "")
          .trim()
      : "";
  if (cleanedNotes) {
    summary += `\n- Ghi chú chuyến đi: ${cleanedNotes}`;
  }

  if (Array.isArray(days) && days.length > 0) {
    const lines = days.map((d: any) => {
      const itemsText = (d.items || [])
        .map((it: any) => {
          const title = it.title || it.placeName;
          if (!title) return null;
          const timePrefix =
            it.startTime && it.endTime
              ? `[${String(it.startTime).slice(0, 5)}-${String(it.endTime).slice(0, 5)}] `
              : it.startTime
                ? `[${String(it.startTime).slice(0, 5)}] `
                : "";
          const typeTag = it.type ? `${it.type}: ` : "";
          const refs = [
            it.id ? `itemId:${it.id}` : null,
            it.placeRef || it.placeId ? `placeRef:${it.placeRef || it.placeId}` : null,
          ]
            .filter(Boolean)
            .join(", ");
          return `${timePrefix}${typeTag}${title}${refs ? ` (${refs})` : ""}`;
        })
        .filter(Boolean);
      return `  + Ngày ${d.dayNumber || 1}: ${itemsText.length > 0 ? itemsText.join(" ; ") : "Chưa có địa điểm"}`;
    });
    summary += `\n- Các địa điểm đã lưu trong lịch trình:\n${lines.join("\n")}`;
  }

  return summary;
}

export function formatUserPreferencesSummary(
  prefs?: DeclaredTravelPreferences,
): string | undefined {
  if (!prefs) return undefined;
  const parts: string[] = [];
  if (prefs.travelParty) {
    parts.push(`Nhóm đi: ${ONBOARDING_DIMENSION_LABELS[prefs.travelParty] || prefs.travelParty}`);
  }
  if (prefs.budgetTier) {
    parts.push(`Mức chi tiêu: ${BUDGET_TIER_LABELS[prefs.budgetTier] || prefs.budgetTier}`);
  }
  const stay = mapOptionLabels(prefs.stayStyles);
  if (stay) parts.push(`Lưu trú: ${stay}`);
  const food = mapOptionLabels(prefs.foodStyles);
  if (food) parts.push(`Ẩm thực: ${food}`);
  const activities = mapOptionLabels(prefs.activityInterests);
  if (activities) parts.push(`Hoạt động: ${activities}`);
  const splurge = mapOptionLabels(prefs.splurgeCategories);
  if (splurge) parts.push(`Sẵn sàng chi mạnh: ${splurge}`);

  return parts.length > 0 ? parts.join(" | ") : undefined;
}

export function formatPlanningStateSummary(
  status?: string,
  brief?: TripPlanningBrief | unknown,
): string | undefined {
  const b = (brief && typeof brief === "object" ? brief : undefined) as TripPlanningBrief | undefined;
  if (!status && !b) return undefined;

  const parts: string[] = [];
  if (status) parts.push(`Trạng thái: ${status}`);
  if (b?.where?.destinationText) parts.push(`Where: ${b.where.destinationText}`);
  if (b?.when) {
    const whenText =
      b.when.type === "flexible"
        ? `${b.when.durationDays ?? "?"} ngày linh hoạt${b.when.flexibleMonths?.length ? ` (${b.when.flexibleMonths.join(", ")})` : ""}`
        : `${b.when.startDate ?? "?"} -> ${b.when.endDate ?? "?"}${b.when.durationDays ? ` (${b.when.durationDays} ngày)` : ""}`;
    parts.push(`When: ${whenText}`);
  }
  if (b?.who) {
    parts.push(
      `Who: ${b.who.adults} người lớn, ${b.who.children} trẻ em, ${b.who.infants} em bé`,
    );
  }
  if (b?.budget) {
    parts.push(
      b.budget.mode === "TOTAL"
        ? `Budget: ${b.budget.amount} ${b.budget.currency}`
        : "Budget: Linh hoạt",
    );
  }
  return parts.length > 0 ? parts.join(" | ") : undefined;
}

function summarizeToolPart(part: any): string | undefined {
  if (!part || typeof part !== "object") return undefined;
  const type = String(part.type || "");
  const toolName =
    part.toolInvocation?.toolName ||
    (type.startsWith("tool-") ? type.slice("tool-".length) : undefined);
  const output = part.output ?? part.result ?? part.toolInvocation?.result;
  if (!toolName || !output || typeof output !== "object") return undefined;

  if (toolName === "searchPlaces" && Array.isArray(output.places) && output.places.length > 0) {
    const items = output.places
      .slice(0, 8)
      .map((p: any) => (p?.name && p?.id ? `${p.name} (id:${p.id})` : p?.name))
      .filter(Boolean);
    return items.length > 0 ? `searchPlaces("${output.query ?? ""}") -> ${items.join(", ")}` : undefined;
  }

  if (toolName === "createTripProposal" && output.proposal?.title) {
    const dayCount = Array.isArray(output.proposal.days) ? output.proposal.days.length : 0;
    return `createTripProposal("${output.proposal.title}", ${dayCount} ngày, autoCommit:${output.autoCommit?.status ?? "NONE"})`;
  }

  if (toolName === "addItineraryItems" && Array.isArray(output.addedItems)) {
    return `addItineraryItems(Ngày ${output.dayNumber ?? "?"}) -> ${output.addedItems.join(", ")}`;
  }

  if (toolName === "replaceItineraryItem" && output.newTitle) {
    return `replaceItineraryItem -> ${output.newTitle}`;
  }

  if (toolName === "removeItineraryItem" && output.removedItemId) {
    return `removeItineraryItem(${output.removedItemId})`;
  }

  return undefined;
}

/**
 * Converts persisted chat message rows (in chronological order) into LLM prompt messages,
 * retaining compact summaries of prior tool outputs so subsequent turns keep grounded IDs.
 */
export function buildConversationHistory(
  chronologicalRows: Array<{ role: string; parts: unknown }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return chronologicalRows
    .map((row) => {
      const parts = Array.isArray(row.parts) ? row.parts : [];
      const textContent = parts
        .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text.trim())
        .filter(Boolean)
        .join("\n");

      let combined = textContent;
      if (row.role === "assistant") {
        const toolNotes = parts
          .map((p: any) => summarizeToolPart(p))
          .filter((note): note is string => Boolean(note));
        if (toolNotes.length > 0) {
          const summaryBlock = `[Ngữ cảnh công cụ lượt trước: ${toolNotes.join(" | ")}]`;
          combined = combined ? `${combined}\n${summaryBlock}` : summaryBlock;
        }
      }

      return {
        role: row.role as "user" | "assistant",
        content: combined.trim(),
      };
    })
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.length > 0);
}

