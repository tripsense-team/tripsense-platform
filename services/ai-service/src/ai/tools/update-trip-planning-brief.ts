import crypto from "node:crypto";
import { tool } from "ai";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index.js";
import { chats, messages } from "../../db/schema.js";
import {
  commitTripMutation,
  deterministicCommitKey,
  sha256,
  type TripDraft,
} from "../trip-commit.js";

const fieldSchema = z.enum(["WHERE", "WHEN", "WHO", "BUDGET"]);
const statusSchema = z.enum([
  "COLLECTING",
  "READY",
  "CREATING_TRIP",
  "TRIP_LINKED",
  "PLANNING",
  "COMMITTING",
  "COMPLETED",
  "FAILED_RETRYABLE",
  "CANCELLED",
]);

export type TripPlanningBrief = {
  where?: { destinationText: string; destinationPlaceRef?: string | null };
  when?: {
    startDate?: string;
    endDate?: string;
    type?: "dates" | "flexible";
    durationDays?: number;
    flexibleMonths?: string[];
  };
  who?: { adults: number; children: number; infants: number; pets: number };
  budget?:
    | { mode: "FLEXIBLE" }
    | { mode: "TOTAL"; amount: number; currency: string };
};

export type TripBriefPart = {
  type: "data-tripBrief";
  runId: string;
  intentMessageId: string;
  version: number;
  status: z.infer<typeof statusSchema>;
  brief: TripPlanningBrief;
  missingFields: z.infer<typeof fieldSchema>[];
  nextQuestion?: z.infer<typeof fieldSchema>;
  tripId?: string;
  safeErrorCode?: string;
};

export type PlanningRuntimeState = {
  runId?: string;
  tripId?: string;
  tripRevision?: number;
  brief?: TripPlanningBrief;
  autoCommitAuthorized?: boolean;
  state?: TripBriefPart;
  stateMessageId?: string;
  userText?: string;
};

const inputSchema = z.object({
  planningIntent: z
    .boolean()
    .default(true)
    .describe("Đặt true khi ghi nhận ý định lên kế hoạch du lịch"),
  cancel: z.boolean().default(false),
  where: z
    .object({
      destinationText: z.string().trim().min(1).max(255),
      destinationPlaceRef: z.string().trim().max(200).nullable().optional(),
    })
    .optional(),
  when: z
    .object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(["dates", "flexible"]).optional(),
      durationDays: z.number().int().min(1).max(60).optional(),
      flexibleMonths: z.array(z.string()).optional(),
    })
    .optional(),
  who: z
    .object({
      adults: z.number().int().min(0).max(100),
      children: z.number().int().min(0).max(100),
      infants: z.number().int().min(0).max(100),
      pets: z.number().int().min(0).max(20),
    })
    .describe(
      "CHỈ truyền khi người dùng có nói rõ số lượng người/thành viên đi cùng. TUYỆT ĐỐI KHÔNG tự đoán mặc định 2 người nếu user chưa đề cập."
    )
    .optional(),
  budget: z
    .discriminatedUnion("mode", [
      z.object({ mode: z.literal("FLEXIBLE") }),
      z.object({
        mode: z.literal("TOTAL"),
        amount: z.number().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/),
      }),
    ])
    .optional(),
});

function isTripBriefPart(value: unknown): value is TripBriefPart {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TripBriefPart>;
  return (
    candidate.type === "data-tripBrief" &&
    typeof candidate.runId === "string" &&
    typeof candidate.version === "number" &&
    Boolean(candidate.brief)
  );
}

export async function loadLatestTripBrief(chatId: string): Promise<TripBriefPart | null> {
  const recent = await db
    .select({ parts: messages.parts })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(50);

  for (const message of recent) {
    if (!Array.isArray(message.parts)) continue;
    for (let index = message.parts.length - 1; index >= 0; index -= 1) {
      const part = message.parts[index];
      if (isTripBriefPart(part)) return part;
      if (
        part &&
        typeof part === "object" &&
        (part as any).type === "tool-updateTripPlanningBrief"
      ) {
        const output = (part as any).output;
        if (isTripBriefPart(output?.state)) return output.state;
      }
    }
  }
  return null;
}

export function hasExplicitPlanningIntent(text: string): boolean {
  return /\b(plan\s+(?:me\s+)?a\s+trip|create\s+(?:me\s+)?a\s+trip|build\s+(?:me\s+)?an?\s+itinerary)\b/i.test(text)
    || /(?:lên|lập|tạo|xây dựng|thiết kế)\s+(?:giúp\s+(?:mình|tôi)\s+)?(?:một\s+)?(?:lịch trình|kế hoạch|chuyến đi)/i.test(text);
}

export function hasCancellationIntent(text: string): boolean {
  return /\b(cancel|stop|not now|later)\b/i.test(text)
    || /(?:^|\s)(?:hủy|huỷ|dừng|để sau|thôi)(?:\s|$|[.!?])/i.test(text);
}

export function hasTravelerMention(text: string): boolean {
  if (!text) return false;
  return (
    /\b(\d+)\s*(?:người|khách|thành viên|pax|people|person|travelers?|adults?|kids?|trẻ em)\b/i.test(text) ||
    /(?:solo|một mình|cặp đôi|couple|vợ chồng|gia đình|family|nhóm bạn|bạn bè|đồng nghiệp|tụi mình|chúng mình|tụi tôi)/i.test(text)
  );
}

export function missingFields(brief: TripPlanningBrief) {
  const missing: z.infer<typeof fieldSchema>[] = [];
  if (!brief.where?.destinationText) missing.push("WHERE");

  const hasValidDates = Boolean(brief.when?.startDate && brief.when?.endDate);
  const hasValidDuration = Boolean(brief.when?.durationDays && brief.when.durationDays > 0);
  if (!brief.when || (!hasValidDates && !hasValidDuration)) {
    missing.push("WHEN");
  }

  // If destination is missing OR time/duration is missing, we require full field list
  if (!brief.where?.destinationText || (!hasValidDates && !hasValidDuration)) {
    const travelerCount = brief.who
      ? brief.who.adults + brief.who.children + brief.who.infants
      : 0;
    if (!brief.who || travelerCount < 1 || travelerCount > 100) missing.push("WHO");
    if (!brief.budget) missing.push("BUDGET");
  }

  return missing;
}

export function formatLocalDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ENGLISH_MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function inferYear(targetMonth: number, baseDate: Date): number {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1;
  if (targetMonth < currentMonth) {
    return currentYear + 1;
  }
  return currentYear;
}

function getSafeStartDateInMonth(year: number, month: number, baseDate: Date): Date {
  const currentYear = baseDate.getFullYear();
  const currentMonth = baseDate.getMonth() + 1;
  const currentDay = baseDate.getDate();

  if (year === currentYear && month === currentMonth) {
    const proposed = new Date(year, month - 1, currentDay + 3);
    if (proposed.getMonth() + 1 === month) {
      return proposed;
    }
    return new Date(year, month - 1, currentDay);
  }

  return new Date(year, month - 1, 1);
}

export function parseFlexibleMonth(monthStr: string, baseDate: Date = new Date()): Date | null {
  if (!monthStr || typeof monthStr !== "string") return null;
  const trimmed = monthStr.trim();

  const yyyyMm = trimmed.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyyMm) {
    const year = parseInt(yyyyMm[1], 10);
    const month = parseInt(yyyyMm[2], 10);
    if (month >= 1 && month <= 12) {
      return getSafeStartDateInMonth(year, month, baseDate);
    }
  }

  const monthWithYear = trimmed.match(/(?:tháng\s*|t\s*)?(\d{1,2})[\s/]+(\d{4})/i);
  if (monthWithYear) {
    const month = parseInt(monthWithYear[1], 10);
    const year = parseInt(monthWithYear[2], 10);
    if (month >= 1 && month <= 12) {
      return getSafeStartDateInMonth(year, month, baseDate);
    }
  }

  const englishMatch = trimmed.match(/([a-zA-Z]{3,9})(?:\s+(\d{4}))?/i);
  if (englishMatch) {
    const mName = englishMatch[1].toLowerCase();
    const mNum = ENGLISH_MONTHS[mName];
    if (mNum) {
      const explicitYear = englishMatch[2] ? parseInt(englishMatch[2], 10) : undefined;
      const year = explicitYear ?? inferYear(mNum, baseDate);
      return getSafeStartDateInMonth(year, mNum, baseDate);
    }
  }

  const vnMatch = trimmed.match(/(?:tháng\s*|t\s*)?(\d{1,2})/i);
  if (vnMatch) {
    const month = parseInt(vnMatch[1], 10);
    if (month >= 1 && month <= 12) {
      const year = inferYear(month, baseDate);
      return getSafeStartDateInMonth(year, month, baseDate);
    }
  }

  return null;
}

export function resolveFlexibleDates(
  durationDays: number = 3,
  flexibleMonths?: string[],
  baseDate: Date = new Date()
): { startDate: string; endDate: string } {
  const safeDuration = Math.max(1, durationDays);

  if (flexibleMonths && flexibleMonths.length > 0) {
    for (const monthStr of flexibleMonths) {
      const parsed = parseFlexibleMonth(monthStr, baseDate);
      if (parsed) {
        const start = parsed;
        const end = new Date(start);
        end.setDate(end.getDate() + safeDuration - 1);
        return {
          startDate: formatLocalDateIso(start),
          endDate: formatLocalDateIso(end),
        };
      }
    }
  }

  const start = new Date(baseDate);
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + safeDuration - 1);
  return {
    startDate: formatLocalDateIso(start),
    endDate: formatLocalDateIso(end),
  };
}

export function isDateInFlexibleMonth(
  dateStr: string,
  monthStr: string,
  baseDate: Date = new Date()
): boolean {
  if (!dateStr || !monthStr) return false;
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
    const parsed = parseFlexibleMonth(monthStr, baseDate);
    if (!parsed) return false;
    return d.getFullYear() === parsed.getFullYear() && d.getMonth() === parsed.getMonth();
  } catch {
    return false;
  }
}

async function persistState(messageId: string, userText: string, state: TripBriefPart) {
  await db
    .update(messages)
    .set({ parts: [{ type: "text", text: userText }, state] })
    .where(eq(messages.id, messageId));
}

export function getUpdateTripPlanningBriefTool(context: {
  chatId: string;
  userId: string;
  userMessageId: string;
  userText: string;
  authorization?: string;
  runtime: PlanningRuntimeState;
  expectedVersion?: number;
  isDirectPatch?: boolean;
}) {
  return tool({
    description:
      "Ghi nhận ý định lập chuyến đi và cập nhật các trường Where, When, Who, Budget. Phải gọi công cụ này trước khi tạo lịch trình khi user muốn lập/tạo trip, và gọi lại cho mỗi câu trả lời intake.",
    inputSchema,
    execute: async (input) => {
      if (context.userId === "guest" || !context.authorization) {
        return { accepted: false, reason: "AUTH_REQUIRED" };
      }
      const existing = await loadLatestTripBrief(context.chatId);
      if (
        context.expectedVersion !== undefined &&
        existing?.version !== context.expectedVersion
      ) {
        return { accepted: false, reason: "BRIEF_VERSION_CONFLICT" };
      }
      const intentAllowed = hasExplicitPlanningIntent(context.userText);
      if (!existing && (!input.planningIntent || !intentAllowed)) {
        return { accepted: false, reason: "NO_EXPLICIT_PLANNING_INTENT" };
      }

      const terminalExisting =
        existing?.status === "COMPLETED" || existing?.status === "CANCELLED";
      if (terminalExisting && (!input.planningIntent || !intentAllowed)) {
        return { accepted: false, reason: "PLANNING_RUN_NOT_ACTIVE" };
      }

      const runId = terminalExisting ? crypto.randomUUID() : (existing?.runId ?? crypto.randomUUID());
      const intentMessageId = terminalExisting
        ? context.userMessageId
        : (existing?.intentMessageId ?? context.userMessageId);

      // Discard hallucinated who if called during chat and user did not mention travelers
      let sanitizedWho = input.who;
      if (
        !context.isDirectPatch &&
        context.userText &&
        input.who &&
        !existing?.brief?.who &&
        !hasTravelerMention(context.userText)
      ) {
        sanitizedWho = undefined;
      }

      const merged: TripPlanningBrief = {
        ...(existing?.brief ?? {}),
        ...(input.where ? { where: input.where } : {}),
        ...(input.when ? { when: input.when } : {}),
        ...(sanitizedWho ? { who: sanitizedWho } : {}),
        ...(input.budget ? { budget: input.budget } : {}),
      };

      // Auto-default budget when where and when are both satisfied, but preserve unspecified who
      const hasValidDates = Boolean(merged.when?.startDate && merged.when?.endDate);
      const hasValidDuration = Boolean(merged.when?.durationDays && merged.when.durationDays > 0);
      if (merged.where?.destinationText && (hasValidDates || hasValidDuration)) {
        if (!merged.budget) {
          merged.budget = { mode: "FLEXIBLE" };
        }
      }

      if (
        input.when &&
        input.when.startDate &&
        input.when.endDate &&
        input.when.startDate > input.when.endDate
      ) {
        return { accepted: false, reason: "INVALID_DATE_RANGE" };
      }

      if (input.cancel || hasCancellationIntent(context.userText)) {
        const cancelled: TripBriefPart = {
          type: "data-tripBrief",
          runId,
          intentMessageId,
          version: terminalExisting ? 1 : (existing?.version ?? 0) + 1,
          status: "CANCELLED",
          brief: merged,
          missingFields: missingFields(merged),
        };
        await persistState(context.userMessageId, context.userText, cancelled);
        return { accepted: true, state: cancelled };
      }

      const missing = missingFields(merged);
      let state: TripBriefPart = {
        type: "data-tripBrief",
        runId,
        intentMessageId,
        version: terminalExisting ? 1 : (existing?.version ?? 0) + 1,
        status: missing.length === 0 ? "READY" : "COLLECTING",
        brief: merged,
        missingFields: missing,
        nextQuestion: missing[0],
      };
      await persistState(context.userMessageId, context.userText, state);

      if (missing.length > 0) {
        context.runtime.runId = runId;
        context.runtime.brief = merged;
        context.runtime.autoCommitAuthorized = true;
        context.runtime.state = state;
        context.runtime.stateMessageId = context.userMessageId;
        context.runtime.userText = context.userText;
        return { accepted: true, state };
      }

      const [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, context.chatId), eq(chats.userId, context.userId)))
        .limit(1);
      if (!chat) return { accepted: false, reason: "CHAT_NOT_FOUND" };

      if (chat.tripId) {
        state = { ...state, status: "TRIP_LINKED", tripId: chat.tripId };
        await persistState(context.userMessageId, context.userText, state);
        Object.assign(context.runtime, {
          runId,
          tripId: chat.tripId,
          brief: merged,
          autoCommitAuthorized: true,
          state,
          stateMessageId: context.userMessageId,
          userText: context.userText,
        });
        return { accepted: true, state };
      }

      const who = merged.who;
      const budget = merged.budget || { mode: "FLEXIBLE" };

      let startDate = merged.when?.startDate;
      let endDate = merged.when?.endDate;
      const isFlexible =
        merged.when?.type === "flexible" ||
        Boolean(merged.when?.durationDays && !merged.when?.startDate);
      const flexibleMonths = merged.when?.flexibleMonths;

      if (
        !startDate ||
        !endDate ||
        (isFlexible && flexibleMonths && flexibleMonths.length > 0 && !isDateInFlexibleMonth(startDate, flexibleMonths[0]))
      ) {
        const days = merged.when?.durationDays || 3;
        const resolved = resolveFlexibleDates(days, flexibleMonths);
        startDate = resolved.startDate;
        endDate = resolved.endDate;
        merged.when = {
          ...merged.when,
          type: "flexible",
          durationDays: days,
          startDate,
          endDate,
        };
      }

      const flexibleNote = isFlexible
        ? `Travel preference: ${merged.when?.durationDays || 3} days flexible${
            flexibleMonths && flexibleMonths.length > 0
              ? ` (${flexibleMonths.join(", ")})`
              : ""
          }`
        : null;

      const tripDraft: TripDraft = {
        name: `Trip to ${merged.where!.destinationText}`,
        destinationName: merged.where!.destinationText,
        startDate,
        endDate,
        travelerCount: who ? who.adults + who.children + who.infants : null,
        budgetAmount: budget.mode === "TOTAL" ? budget.amount : null,
        budgetCurrency: budget.mode === "TOTAL" ? budget.currency : null,
        notes: flexibleNote,
      };
      state = { ...state, status: "CREATING_TRIP" };
      await persistState(context.userMessageId, context.userText, state);

      try {
        const canonicalBrief = JSON.stringify(merged);
        const result = await commitTripMutation({
          authorization: context.authorization,
          userId: context.userId,
          // A chat can own only one initial Trip. Keying creation by chat makes
          // concurrent planning turns converge on the same Trip Service receipt.
          idempotencyKey: deterministicCommitKey(context.chatId, "CREATE_TRIP"),
          request: {
            action: "CREATE_TRIP",
            targetTripId: null,
            proposalId: runId,
            proposalHash: sha256(canonicalBrief),
            expectedTripRevision: null,
            tripDraft,
            items: [],
          },
        });

        const linked = await db
          .update(chats)
          .set({ tripId: result.tripId, tripLinkedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(chats.id, context.chatId),
              eq(chats.userId, context.userId),
              isNull(chats.tripId),
            ),
          )
          .returning({ id: chats.id });
        if (linked.length === 0) {
          const [current] = await db
            .select({ tripId: chats.tripId })
            .from(chats)
            .where(and(eq(chats.id, context.chatId), eq(chats.userId, context.userId)))
            .limit(1);
          if (current?.tripId !== result.tripId) {
            throw new Error("CHAT_TRIP_LINK_CONFLICT");
          }
        }

        state = {
          ...state,
          status: "TRIP_LINKED",
          tripId: result.tripId,
          safeErrorCode: undefined,
        };
        await persistState(context.userMessageId, context.userText, state);
        Object.assign(context.runtime, {
          runId,
          tripId: result.tripId,
          tripRevision: result.tripRevision,
          brief: merged,
          autoCommitAuthorized: true,
          state,
          stateMessageId: context.userMessageId,
          userText: context.userText,
        });
        return {
          accepted: true,
          state,
          trip: {
            id: result.tripId,
            name: result.tripName,
            operationId: result.operationId,
            replayed: result.replayed,
          },
        };
      } catch (error) {
        const code = error instanceof Error ? error.message : "TRIP_COMMIT_FAILED";
        state = {
          ...state,
          status: "FAILED_RETRYABLE",
          safeErrorCode: code.startsWith("TRIP_") ? code : "TRIP_COMMIT_FAILED",
        };
        await persistState(context.userMessageId, context.userText, state);
        return { accepted: true, state };
      }
    },
  });
}

export function shouldStopAfterBriefStep(
  steps: Array<{ toolResults?: any[] }>,
  runtimeStatus?: string
): boolean {
  if (runtimeStatus === "COLLECTING" || runtimeStatus === "CANCELLED") {
    return true;
  }
  const lastStep = steps.at(-1);
  if (!lastStep?.toolResults) return false;
  return lastStep.toolResults.some((tr: any) => {
    const toolName = tr.toolName || tr.toolInvocation?.toolName;
    if (toolName === "updateTripPlanningBrief") {
      const status =
        tr.result?.state?.status ||
        tr.output?.state?.status ||
        tr.result?.status;
      return status === "COLLECTING" || status === "CANCELLED";
    }
    return false;
  });
}

