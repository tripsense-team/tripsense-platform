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
  when?: { startDate: string; endDate: string };
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
  planningIntent: z.boolean().default(false),
  cancel: z.boolean().default(false),
  where: z
    .object({
      destinationText: z.string().trim().min(1).max(255),
      destinationPlaceRef: z.string().trim().max(200).nullable().optional(),
    })
    .optional(),
  when: z
    .object({
      startDate: z.string().date(),
      endDate: z.string().date(),
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
  if (!brief.when?.startDate || !brief.when.endDate) missing.push("WHEN");
  const travelerCount = brief.who
    ? brief.who.adults + brief.who.children + brief.who.infants
    : 0;
  if (!brief.who || travelerCount < 1 || travelerCount > 100) missing.push("WHO");
  if (!brief.budget) missing.push("BUDGET");
  return missing;
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

      if (input.when && input.when.startDate > input.when.endDate) {
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

      const who = merged.who!;
      const budget = merged.budget!;
      const tripDraft: TripDraft = {
        name: `Trip to ${merged.where!.destinationText}`,
        destinationName: merged.where!.destinationText,
        startDate: merged.when!.startDate,
        endDate: merged.when!.endDate,
        travelerCount: who.adults + who.children + who.infants,
        budgetAmount: budget.mode === "TOTAL" ? budget.amount : null,
        budgetCurrency: budget.mode === "TOTAL" ? budget.currency : null,
        notes: null,
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

