import { Hono } from "hono";
import {
  isStepCount,
  streamText,
  generateText,
} from "ai";
import { eq, desc, asc, and, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { chats, messages, proposals, votes } from "../db/schema.js";
import { getLanguageModel, resolveLanguageModel } from "../ai/providers.js";
import { geminiKeyManager } from "../ai/gemini-key-manager.js";
import { DEFAULT_MODEL_ID, SUPPORTED_MODELS } from "../ai/models.js";
import { getSystemPrompt } from "../ai/prompts.js";
import {
  briefFromClientPreferences,
  briefFromTripRecord,
  buildConversationHistory,
  formatBudgetTierHint,
  formatClientPreferencesSummary,
  formatTripSummary,
  mergeEffectiveBrief,
  postChatTripPreferencesSchema,
} from "../ai/trip-context.js";
import { getWeather } from "../ai/tools/get-weather.js";
import { getSearchPlacesTool } from "../ai/tools/search-places.js";
import { getPrepareTripCandidatesTool } from "../ai/tools/prepare-trip-candidates.js";
import { getRecommendPlacesTool } from "../ai/tools/recommend-places.js";
import { PlaceGroundingStore } from "../ai/place-grounding.js";
import { getCreateTripProposalTool } from "../ai/tools/create-trip-proposal.js";
import { getItineraryManagementTools } from "../ai/tools/itinerary-management.js";
import {
  extractLatestTripBriefFromMessages,
  getUpdateTripPlanningBriefTool,
  loadLatestTripBrief,
  shouldStopAfterBriefStep,
  type PlanningRuntimeState,
} from "../ai/tools/update-trip-planning-brief.js";
import { config } from "../config.js";
import { subjectFromAuthorization } from "../security/access-token.js";
import { fetchUserContext } from "../personalization/context-preferences.js";
import {
  isGenericChatTitle,
  generateSmartTitle,
  capitalizeWords,
} from "../ai/chat-title.js";

export const chatRouter = new Hono();

// Schema validation for POST /api/chat supporting both Vercel & custom client payloads
const postChatSchema = z.object({
  id: z.string().optional(),
  chatId: z.string().optional(),
  message: z
    .object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant"]),
      content: z.string().optional(),
      parts: z.array(z.any()).optional(),
    })
    .optional(),
  messages: z.array(z.any()).optional(),
  selectedModel: z.string().optional(),
  selectedChatModel: z.string().optional(),
  tripId: z.string().uuid().optional(),
  tripPreferences: postChatTripPreferencesSchema.optional(),
});

const linkChatTripSchema = z.object({
  tripId: z.string().uuid(),
  expectedTripId: z.string().uuid().nullable().optional(),
});

const applyProposalSchema = z.object({
  chatId: z.string().uuid(),
  action: z.enum(["CREATE_TRIP", "ADD_TO_LINKED_TRIP"]),
  selectedItemKeys: z.array(z.string().uuid()).max(200).optional(),
  expectedTripRevision: z.number().int().nonnegative().nullable().optional(),
  tripDraft: z
    .object({
      startDate: z.string().date(),
      endDate: z.string().date(),
      travelerCount: z.number().int().min(1).max(100).optional(),
      budgetAmount: z.number().nonnegative().nullable().optional(),
      budgetCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
    })
    .optional(),
});

const planningBriefPatchSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  patch: z.object({
    where: z
      .object({
        destinationText: z.string().trim().min(1).max(255),
        destinationPlaceRef: z.string().trim().max(200).nullable().optional(),
      })
      .optional(),
    when: z
      .object({
        type: z.enum(["dates", "flexible"]).optional(),
        durationDays: z.number().int().min(1).max(60).optional(),
        flexibleMonths: z.array(z.string()).max(12).optional(),
        startDate: z.string().date().optional(),
        endDate: z.string().date().optional(),
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
      .discriminatedUnion("mode", [
        z.object({ mode: z.literal("FLEXIBLE") }),
        z.object({
          mode: z.literal("TOTAL"),
          amount: z.number().nonnegative(),
          currency: z.string().regex(/^[A-Z]{3}$/),
        }),
      ])
      .optional(),
  }),
});

function userIdFrom(c: any): string {
  return subjectFromAuthorization(c.req.header("Authorization")) || "guest";
}

function authorizationFrom(c: any): string | undefined {
  return c.req.header("Authorization");
}

function safeError(c: any, status: 400 | 401 | 403 | 404 | 409 | 410 | 502 | 503, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

async function ownedChat(chatId: string, userId: string) {
  let [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  // If chat exists under 'guest' and current user is authenticated, claim/adopt the guest chat
  if (!chat && userId !== "guest") {
    const [guestChat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, "guest")))
      .limit(1);

    if (guestChat) {
      await db
        .update(chats)
        .set({ userId, updatedAt: new Date() })
        .where(and(eq(chats.id, chatId), eq(chats.userId, "guest")));
      chat = { ...guestChat, userId };
    }
  }

  return chat;
}

async function fetchTripResource(path: string, authorization?: string, timeoutMs = 2000) {
  return fetch(`${config.tripServiceUrl}${path}`, {
    headers: authorization ? { Authorization: authorization } : {},
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function fetchTripSummary(
  tripId?: string,
  authorization?: string,
  clientBudgetTierHint?: string,
): Promise<{ summary?: string; trip?: any } | undefined> {
  if (!tripId || !authorization) return undefined;
  try {
    const [tripRes, itinRes] = await Promise.allSettled([
      fetchTripResource(`/api/trips/${tripId}`, authorization),
      fetchTripResource(`/api/trips/${tripId}/itinerary`, authorization),
    ]);

    if (tripRes.status !== "fulfilled") {
      console.warn(`[ai-service] fetchTripSummary failed for trip ${tripId}:`, tripRes.reason);
      return undefined;
    }
    if (!tripRes.value.ok) {
      console.warn(`[ai-service] fetchTripSummary returned HTTP ${tripRes.value.status} for trip ${tripId}`);
      return undefined;
    }
    const tripPayload: any = await tripRes.value.json();
    const trip = tripPayload?.data;
    if (!trip) return undefined;

    let days: any[] | undefined;
    if (itinRes.status === "fulfilled" && itinRes.value.ok) {
      const itinPayload: any = await itinRes.value.json();
      if (Array.isArray(itinPayload?.data?.days)) {
        days = itinPayload.data.days;
      }
    }

    return {
      summary: formatTripSummary(trip, days, clientBudgetTierHint),
      trip,
    };
  } catch {
    return undefined;
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function commitSignature(
  timestamp: string,
  userId: string,
  idempotencyKey: string,
  bodyHash: string,
): string {
  return crypto
    .createHmac("sha256", config.aiTripCommitSecret)
    .update(`${timestamp}\n${userId}\n${idempotencyKey}\n${bodyHash}`)
    .digest("hex");
}

/**
 * GET /api/models
 * Returns list of supported models for frontend selector
 */
chatRouter.get("/models", (c) => {
  return c.json({
    models: SUPPORTED_MODELS,
    defaultModel: DEFAULT_MODEL_ID,
  });
});

/**
 * GET /api/chats
 * Returns list of chats for the current user
 */
chatRouter.get("/chats", async (c) => {
  const userId = userIdFrom(c);

  const userChats = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt))
    .limit(50);

  return c.json({ chats: userChats });
});

/**
 * GET /api/chats/:id/messages
 * Returns message history for a specific chat
 */
chatRouter.get("/chats/:id/messages", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);

  if (!(await ownedChat(chatId, userId))) {
    return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
  }

  const chatMessages = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.chatId, chatId),
        inArray(messages.role, ["user", "assistant"]),
      ),
    )
    .orderBy(asc(messages.createdAt));

  return c.json({ messages: chatMessages });
});

/** Returns the persisted chat-trip mapping and authoritative committed item refs. */
chatRouter.get("/chats/:id/context", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  const chat = await ownedChat(chatId, userId);
  if (!chat) {
    const [foreignChat] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    if (foreignChat) return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
    return c.json({ chatId, trip: null, committedSourceRefs: [] });
  }
  if (!chat.tripId) {
    return c.json({ chatId, trip: null, committedSourceRefs: [] });
  }

  const authorization = authorizationFrom(c);
  if (!authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  const [tripResponse, itineraryResponse] = await Promise.all([
    fetchTripResource(`/api/trips/${chat.tripId}`, authorization),
    fetchTripResource(`/api/trips/${chat.tripId}/itinerary`, authorization),
  ]);
  if (tripResponse.status === 403 || itineraryResponse.status === 403) {
    return safeError(c, 403, "TRIP_ACCESS_DENIED", "Trip access is no longer available");
  }
  if (!tripResponse.ok || !itineraryResponse.ok) {
    return safeError(c, 502, "TRIP_CONTEXT_UNAVAILABLE", "Trip context is temporarily unavailable");
  }

  const tripPayload: any = await tripResponse.json();
  const itineraryPayload: any = await itineraryResponse.json();
  const committedSourceRefs = (itineraryPayload?.data?.days || []).flatMap((day: any) =>
    (day.items || [])
      .filter((item: any) => item.sourceProposalId && item.sourceItemKey)
      .map((item: any) => ({
        proposalId: item.sourceProposalId,
        itemKey: item.sourceItemKey,
        itineraryItemId: item.id,
      })),
  );
  return c.json({
    chatId,
    trip: {
      id: tripPayload.data.id,
      name: tripPayload.data.name,
      revision: tripPayload.data.aggregateRevision ?? 0,
      destinationName: tripPayload.data.destinationName,
      startDate: tripPayload.data.startDate,
      endDate: tripPayload.data.endDate,
      travelerCount: tripPayload.data.travelerCount,
      budgetAmount: tripPayload.data.budgetAmount,
      budgetCurrency: tripPayload.data.budgetCurrency,
    },
    committedSourceRefs,
  });
});

/** Returns partial intake state, or the linked Trip as the authoritative brief. */
chatRouter.get("/chats/:id/planning-brief", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  const chat = await ownedChat(chatId, userId);
  if (!chat) return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");

  const state = await loadLatestTripBrief(chatId);
  if (!chat.tripId) return c.json({ chatId, state, trip: null });

  const authorization = authorizationFrom(c);
  if (!authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  const response = await fetchTripResource(`/api/trips/${chat.tripId}`, authorization);
  if (!response.ok) {
    return safeError(c, 502, "TRIP_CONTEXT_UNAVAILABLE", "Trip context is temporarily unavailable");
  }
  const payload: any = await response.json();
  return c.json({ chatId, state, trip: payload.data });
});

async function runPlanningStateMutation(input: {
  chatId: string;
  userId: string;
  authorization: string;
  currentVersion: number;
  patch?: z.infer<typeof planningBriefPatchSchema>["patch"];
  cancel?: boolean;
}) {
  const messageId = crypto.randomUUID();
  await db.insert(messages).values({
    id: messageId,
    chatId: input.chatId,
    role: "planning_state",
    parts: [],
  });
  const runtime: PlanningRuntimeState = { autoCommitAuthorized: false };
  const planningTool = getUpdateTripPlanningBriefTool({
    chatId: input.chatId,
    userId: input.userId,
    userMessageId: messageId,
    userText: "",
    authorization: input.authorization,
    runtime,
    expectedVersion: input.currentVersion,
    isDirectPatch: true,
  }) as any;
  return planningTool.execute(
    {
      planningIntent: false,
      cancel: input.cancel ?? false,
      ...(input.patch ?? {}),
    },
    { toolCallId: `planning-state-${messageId}`, messages: [] },
  );
}

chatRouter.patch("/chats/:id/planning-brief", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  const authorization = authorizationFrom(c);
  if (userId === "guest" || !authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!(await ownedChat(chatId, userId))) {
    return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
  }
  const parsed = planningBriefPatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return safeError(c, 400, "INVALID_PLANNING_BRIEF", "Planning brief is invalid");
  }
  const current = await loadLatestTripBrief(chatId);
  if (!current) {
    return safeError(c, 409, "PLANNING_RUN_REQUIRED", "Start planning in chat first");
  }
  if (["COMPLETED", "CANCELLED"].includes(current.status)) {
    return safeError(c, 409, "PLANNING_RUN_NOT_ACTIVE", "Planning run is not active");
  }
  if (current.version !== parsed.data.expectedVersion) {
    return safeError(c, 409, "BRIEF_VERSION_CONFLICT", "Planning brief changed");
  }
  const result = await runPlanningStateMutation({
    chatId,
    userId,
    authorization,
    currentVersion: current.version,
    patch: parsed.data.patch,
  });
  if (!result?.accepted) {
    return safeError(c, 409, "BRIEF_VERSION_CONFLICT", "Planning brief changed");
  }
  return c.json(result);
});

chatRouter.post("/chats/:id/planning-brief/cancel", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  const authorization = authorizationFrom(c);
  if (userId === "guest" || !authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!(await ownedChat(chatId, userId))) {
    return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
  }
  const current = await loadLatestTripBrief(chatId);
  if (!current) {
    return safeError(c, 409, "PLANNING_RUN_REQUIRED", "No active planning run");
  }
  if (["COMPLETED", "CANCELLED"].includes(current.status)) {
    return safeError(c, 409, "PLANNING_RUN_NOT_ACTIVE", "Planning run is not active");
  }
  const result = await runPlanningStateMutation({
    chatId,
    userId,
    authorization,
    currentVersion: current.version,
    cancel: true,
  });
  if (!result?.accepted) {
    return safeError(c, 409, "PLANNING_CANCEL_CONFLICT", "Planning state changed");
  }
  return c.json(result);
});

chatRouter.post("/chats/:id/planning-brief/retry", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  const authorization = authorizationFrom(c);
  if (userId === "guest" || !authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!(await ownedChat(chatId, userId))) {
    return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
  }
  const current = await loadLatestTripBrief(chatId);
  if (!current || current.status !== "FAILED_RETRYABLE") {
    return safeError(c, 409, "PLANNING_RETRY_NOT_AVAILABLE", "Planning cannot be retried");
  }
  const result = await runPlanningStateMutation({
    chatId,
    userId,
    authorization,
    currentVersion: current.version,
  });
  if (!result?.accepted) {
    return safeError(c, 409, "PLANNING_RETRY_CONFLICT", "Planning state changed");
  }
  return c.json(result);
});

chatRouter.put("/chats/:id/trip", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  const authorization = authorizationFrom(c);
  if (userId === "guest" || !authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  const parsed = linkChatTripSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return safeError(c, 400, "INVALID_CHAT_TRIP_LINK", "Trip link payload is invalid");
  }
  const chat = await ownedChat(chatId, userId);
  if (!chat) {
    const [foreignChat] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);
    if (foreignChat) return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");

    const [tripAccessRes, tripDetailRes] = await Promise.all([
      fetchTripResource(`/api/trips/${parsed.data.tripId}/edit-access`, authorization),
      fetchTripResource(`/api/trips/${parsed.data.tripId}`, authorization),
    ]);

    if (tripAccessRes.status === 403) {
      return safeError(c, 403, "TRIP_ACCESS_DENIED", "You cannot edit this trip");
    }
    if (!tripAccessRes.ok) {
      return safeError(c, 404, "TRIP_NOT_FOUND", "Trip not found");
    }

    let tripTitle = "Lịch trình chuyến đi";
    if (tripDetailRes.ok) {
      const tripPayload: any = await tripDetailRes.json();
      const tripData = tripPayload?.data;
      if (tripData?.destinationName) {
        tripTitle = `Lịch trình ${capitalizeWords(tripData.destinationName)}`;
      } else if (tripData?.name) {
        tripTitle = tripData.name;
      }
    }

    await db.insert(chats).values({
      id: chatId,
      userId,
      tripId: parsed.data.tripId,
      title: tripTitle,
      tripLinkedAt: new Date(),
    });
    return c.json({ chatId, tripId: parsed.data.tripId, title: tripTitle, linked: true });
  }
  const expectedTripId = parsed.data.expectedTripId ?? null;
  if ((chat.tripId ?? null) !== expectedTripId) {
    return safeError(c, 409, "CHAT_TRIP_LINK_CONFLICT", "Conversation trip link changed");
  }
  const [tripAccessRes, tripDetailRes] = await Promise.all([
    fetchTripResource(`/api/trips/${parsed.data.tripId}/edit-access`, authorization),
    fetchTripResource(`/api/trips/${parsed.data.tripId}`, authorization),
  ]);

  if (tripAccessRes.status === 403) {
    return safeError(c, 403, "TRIP_ACCESS_DENIED", "You cannot edit this trip");
  }
  if (!tripAccessRes.ok) {
    return safeError(c, 404, "TRIP_NOT_FOUND", "Trip not found");
  }

  const updateFields: any = {
    tripId: parsed.data.tripId,
    tripLinkedAt: new Date(),
    updatedAt: new Date(),
  };

  // If chat currently has a generic title, upgrade it to the trip title
  if (isGenericChatTitle(chat.title)) {
    if (tripDetailRes.ok) {
      const tripPayload: any = await tripDetailRes.json();
      const tripData = tripPayload?.data;
      if (tripData?.destinationName) {
        updateFields.title = `Lịch trình ${capitalizeWords(tripData.destinationName)}`;
      } else if (tripData?.name) {
        updateFields.title = tripData.name;
      }
    }
  }

  await db
    .update(chats)
    .set(updateFields)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  return c.json({
    chatId,
    tripId: parsed.data.tripId,
    title: updateFields.title || chat.title,
    linked: true,
  });
});

chatRouter.delete("/chats/:id/trip", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  if (userId === "guest") {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!(await ownedChat(chatId, userId))) {
    return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
  }
  await db
    .update(chats)
    .set({ tripId: null, tripLinkedAt: null, updatedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  return c.json({ chatId, tripId: null, linked: false });
});

/**
 * PATCH /api/chats/:id
 * Renames a chat session
 */
chatRouter.patch("/chats/:id", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);
  try {
    if (!(await ownedChat(chatId, userId))) {
      return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
    }
    const { title } = await c.req.json();
    if (!title || typeof title !== "string") {
      return c.json({ error: "Title is required" }, 400);
    }

    const trimmedTitle = title.trim();
    await db
      .update(chats)
      .set({ title: trimmedTitle, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));

    return c.json({ success: true, chatId, title: trimmedTitle });
  } catch {
    return safeError(c, 503, "CHAT_UPDATE_FAILED", "Conversation could not be updated");
  }
});

/**
 * DELETE /api/chats/:id
 * Deletes a chat session and all related records
 */
chatRouter.delete("/chats/:id", async (c) => {
  const chatId = c.req.param("id");
  const userId = userIdFrom(c);

  try {
    if (!(await ownedChat(chatId, userId))) {
      return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
    }
    await db.delete(messages).where(eq(messages.chatId, chatId));
    await db.delete(proposals).where(eq(proposals.chatId, chatId));
    await db.delete(votes).where(eq(votes.chatId, chatId));
    await db.delete(chats).where(eq(chats.id, chatId));

    return c.json({ success: true, deletedChatId: chatId });
  } catch {
    return safeError(c, 503, "CHAT_DELETE_FAILED", "Conversation could not be deleted");
  }
});

/**
 * GET /api/vote
 * Returns votes for a given chat (matches Vercel AI Vote_v2)
 */
chatRouter.get("/vote", async (c) => {
  const chatId = c.req.query("chatId");
  if (!chatId) {
    return c.json({ votes: [] });
  }
  if (!(await ownedChat(chatId, userIdFrom(c)))) {
    return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
  }

  const chatVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.chatId, chatId));

  return c.json({ votes: chatVotes });
});

/**
 * PATCH /api/vote
 * Upvote or downvote a message
 */
chatRouter.patch("/vote", async (c) => {
  try {
    const json = await c.req.json();
    const { chatId, messageId, isUpvoted } = json;

    if (!chatId || !messageId || typeof isUpvoted !== "boolean") {
      return c.json({ error: "Invalid vote payload" }, 400);
    }
    if (!(await ownedChat(chatId, userIdFrom(c)))) {
      return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
    }
    const [ownedMessage] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.chatId, chatId)))
      .limit(1);
    if (!ownedMessage) {
      return safeError(c, 404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    const existing = await db
      .select()
      .from(votes)
      .where(and(eq(votes.chatId, chatId), eq(votes.messageId, messageId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(votes)
        .set({ isUpvoted, createdAt: new Date() })
        .where(and(eq(votes.chatId, chatId), eq(votes.messageId, messageId)));
    } else {
      await db.insert(votes).values({
        chatId,
        messageId,
        isUpvoted,
      });
    }

    return c.json({ success: true, chatId, messageId, isUpvoted });
  } catch {
    return safeError(c, 503, "VOTE_UPDATE_FAILED", "Vote could not be updated");
  }
});

/**
 * GET /api/proposals/:id
 * Returns a trip proposal details by ID
 */
chatRouter.get("/proposals/:id", async (c) => {
  const proposalId = c.req.param("id");
  const userId = userIdFrom(c);

  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), eq(proposals.userId, userId)))
    .limit(1);

  if (!proposal) {
    return c.json({ error: "Proposal not found" }, 404);
  }

  return c.json({ proposal });
});

/**
 * POST /api/proposals/:id/confirm
 * Confirms a proposal and creates a real trip in trip-service
 */
chatRouter.post("/proposals/:id/confirm", async (c) =>
  safeError(
    c,
    410,
    "LEGACY_PROPOSAL_CONFIRM_REMOVED",
    "Use the authenticated proposal apply endpoint",
  ),
);

chatRouter.post("/proposals/:id/apply", async (c) => {
  const proposalId = c.req.param("id");
  const userId = userIdFrom(c);
  const authorization = authorizationFrom(c);
  const idempotencyKey = c.req.header("Idempotency-Key") || crypto.randomUUID();
  if (userId === "guest" || !authorization) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!config.aiTripCommitSecret) {
    return safeError(c, 503, "TRIP_COMMIT_UNAVAILABLE", "Trip updates are temporarily unavailable");
  }

  const parsed = applyProposalSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return safeError(c, 400, "INVALID_PROPOSAL_APPLY", "Proposal apply payload is invalid");
  }
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.id, proposalId),
        eq(proposals.userId, userId),
        eq(proposals.chatId, parsed.data.chatId),
      ),
    )
    .limit(1);
  const chat = await ownedChat(parsed.data.chatId, userId);
  if (!proposal || !chat) {
    return safeError(c, 404, "PROPOSAL_NOT_FOUND", "Proposal not found");
  }
  if (parsed.data.action === "ADD_TO_LINKED_TRIP" && !chat.tripId) {
    return safeError(c, 409, "CHAT_TRIP_REQUIRED", "Conversation is not linked to a trip");
  }

  const itinerary: any = proposal.itineraryJson;
  const selectedKeys = parsed.data.selectedItemKeys
    ? new Set(parsed.data.selectedItemKeys)
    : null;
  const parseTimes = (timeSlot: string | undefined) => {
    const matches = timeSlot?.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!matches) return { startTime: null, endTime: null };
    const normalize = (hour: string, minute: string) =>
      `${hour.padStart(2, "0")}:${minute}:00`;
    return {
      startTime: normalize(matches[1], matches[2]),
      endTime: normalize(matches[3], matches[4]),
    };
  };
  const itemType = (category?: string) => {
    if (category === "FOOD" || category === "CAFE") return "MEAL";
    if (category === "STAY") return "HOTEL";
    if (category === "ATTRACTION" || category === "BEACH") return "PLACE";
    return "ACTIVITY";
  };
  const items = (itinerary.days || []).flatMap((day: any) =>
    (day.activities || [])
      .filter((activity: any) => activity.itemKey && (!selectedKeys || selectedKeys.has(activity.itemKey)))
      .map((activity: any) => ({
        sourceItemKey: activity.itemKey,
        dayNumber: day.dayNumber,
        title: activity.title,
        itemType: itemType(activity.category),
        placeRef: activity.placeId || null,
        ...parseTimes(activity.timeSlot),
        notes: activity.description || null,
      })),
  );
  if (items.length === 0) {
    return safeError(c, 400, "INVALID_PROPOSAL_ITEM", "No proposal items were selected");
  }

  const duration = Math.max(Number(itinerary.durationDays) || 1, 1);
  const defaultStart = new Date();
  defaultStart.setUTCDate(defaultStart.getUTCDate() + 1);
  const startDate = parsed.data.tripDraft?.startDate || defaultStart.toISOString().slice(0, 10);
  const defaultEnd = new Date(`${startDate}T00:00:00.000Z`);
  defaultEnd.setUTCDate(defaultEnd.getUTCDate() + duration - 1);
  const endDate = parsed.data.tripDraft?.endDate || defaultEnd.toISOString().slice(0, 10);
  const internalRequest = {
    action: parsed.data.action === "CREATE_TRIP" ? "CREATE_TRIP" : "ADD_TO_TRIP",
    targetTripId: parsed.data.action === "ADD_TO_LINKED_TRIP" ? chat.tripId : null,
    proposalId,
    proposalHash: proposal.proposalHash || sha256(JSON.stringify(itinerary)),
    expectedTripRevision: parsed.data.expectedTripRevision ?? null,
    tripDraft:
      parsed.data.action === "CREATE_TRIP"
        ? {
            name: itinerary.title || `Trip to ${itinerary.destination}`,
            destinationName: itinerary.destination || "Unknown destination",
            startDate,
            endDate,
            travelerCount: parsed.data.tripDraft?.travelerCount ?? null,
            budgetAmount: parsed.data.tripDraft?.budgetAmount ?? null,
            budgetCurrency: parsed.data.tripDraft?.budgetCurrency || "VND",
            notes: itinerary.summary || null,
          }
        : null,
    items,
  };
  const rawBody = JSON.stringify(internalRequest);
  const bodyHash = sha256(rawBody);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = commitSignature(timestamp, userId, idempotencyKey, bodyHash);

  let tripResponse: Response;
  try {
    tripResponse = await fetch(`${config.tripServiceUrl}/internal/ai/itinerary-commits`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "X-AI-Commit-Timestamp": timestamp,
        "X-AI-Commit-Body-Sha256": bodyHash,
        "X-AI-Commit-Signature": signature,
      },
      body: rawBody,
    });
  } catch {
    return safeError(c, 502, "TRIP_COMMIT_UNAVAILABLE", "Trip updates are temporarily unavailable");
  }
  if (!tripResponse.ok) {
    if (tripResponse.status === 409) {
      return safeError(c, 409, "TRIP_VERSION_CONFLICT", "Trip changed; refresh and try again");
    }
    if (tripResponse.status === 403) {
      return safeError(c, 403, "TRIP_ACCESS_DENIED", "You cannot edit this trip");
    }
    return safeError(c, 502, "TRIP_COMMIT_FAILED", "Trip could not be updated");
  }

  const tripPayload: any = await tripResponse.json();
  const result = tripPayload.data;
  await db.transaction(async (tx) => {
    if (parsed.data.action === "CREATE_TRIP") {
      await tx
        .update(chats)
        .set({ tripId: result.tripId, tripLinkedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(chats.id, chat.id), eq(chats.userId, userId)));
    }
    const allItemCount = (itinerary.days || []).reduce(
      (count: number, day: any) => count + (day.activities?.length || 0),
      0,
    );
    await tx
      .update(proposals)
      .set({
        status: result.items.length >= allItemCount ? "APPLIED" : "PARTIALLY_APPLIED",
        appliedTripId: result.tripId,
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(proposals.id, proposalId), eq(proposals.userId, userId)));
  });
  return c.json({ ...result, chatId: chat.id });
});

/**
 * POST /api/chat
 * Core chat endpoint with Vercel AI SDK v7 createUIMessageStreamResponse (SSE protocol)
 */
chatRouter.post("/chat", async (c) => {
  let body: z.infer<typeof postChatSchema>;
  try {
    const json = await c.req.json();
    body = postChatSchema.parse(json);
  } catch {
    return c.json({ error: "Invalid request payload" }, 400);
  }

  const isUUID = (str?: string): boolean =>
    typeof str === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

  const authorization = authorizationFrom(c);
  if (authorization?.startsWith("Bearer ") && !subjectFromAuthorization(authorization)) {
    return safeError(c, 401, "AUTH_REQUIRED", "Authentication token expired or invalid");
  }
  const userId = userIdFrom(c);
  let activeChatId = isUUID(body.id) ? body.id : (isUUID(body.chatId) ? body.chatId : undefined);

  // Extract user text
  let userText = "";
  if (body.message?.content) {
    userText = body.message.content;
  } else if (Array.isArray(body.message?.parts)) {
    userText = body.message.parts
      .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("\n");
  } else if (Array.isArray(body.messages) && body.messages.length > 0) {
    const last = body.messages.at(-1);
    if (last?.content) {
      userText = last.content;
    } else if (Array.isArray(last?.parts)) {
      userText = last.parts
        .filter((p: any) => p && p.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("\n");
    }
  }

  let shouldGenerateTitle = false;
  let currentChatTitle: string | undefined;
  let isNewChat = false;
  let existingChatTripId: string | undefined;

  // 1. Resolve or create chat
  if (activeChatId) {
    let existing = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, activeChatId), eq(chats.userId, userId)))
      .limit(1);

    if (existing.length === 0 && userId !== "guest") {
      const [guestChat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, activeChatId), eq(chats.userId, "guest")))
        .limit(1);
      if (guestChat) {
        await db
          .update(chats)
          .set({ userId, updatedAt: new Date() })
          .where(and(eq(chats.id, activeChatId), eq(chats.userId, "guest")));
        existing = [{ ...guestChat, userId }];
      }
    }

    if (existing.length === 0) {
      const [foreignChat] = await db
        .select({ id: chats.id })
        .from(chats)
        .where(eq(chats.id, activeChatId))
        .limit(1);
      if (foreignChat) {
        return safeError(c, 404, "CHAT_NOT_FOUND", "Conversation not found");
      }
      const initialTitle = generateSmartTitle(userText);
      await db.insert(chats).values({
        id: activeChatId,
        userId,
        title: initialTitle,
      });
      isNewChat = true;
      currentChatTitle = initialTitle;
      shouldGenerateTitle = isGenericChatTitle(initialTitle);
    } else {
      currentChatTitle = existing[0].title;
      existingChatTripId = existing[0].tripId ?? undefined;
      shouldGenerateTitle = isGenericChatTitle(existing[0].title);
    }
  } else {
    const initialTitle = generateSmartTitle(userText);
    const [newChat] = await db
      .insert(chats)
      .values({
        userId,
        title: initialTitle,
      })
      .returning();

    activeChatId = newChat.id;
    isNewChat = true;
    currentChatTitle = initialTitle;
    shouldGenerateTitle = isGenericChatTitle(initialTitle);
  }

  // 2. Persist user message
  const userMessageId = isUUID(body.message?.id) ? body.message!.id! : crypto.randomUUID();
  if (userText) {
    await db.insert(messages).values({
      id: userMessageId,
      chatId: activeChatId,
      role: "user",
      parts: [{ type: "text", text: userText }],
    });

    if (!isNewChat) {
      await db
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(and(eq(chats.id, activeChatId), eq(chats.userId, userId)));
    }
  }

  // 3. Assemble recent history & persisted planning state without duplicate DB queries
  let modelMessages: Array<{ role: "user" | "assistant"; content: string }>;
  let priorPlanningState: Awaited<ReturnType<typeof loadLatestTripBrief>> = null;

  if (isNewChat) {
    modelMessages = userText ? [{ role: "user", content: userText }] : [];
  } else {
    const [dbHistoryDesc, planningStateRows] = await Promise.all([
      db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.chatId, activeChatId),
            inArray(messages.role, ["user", "assistant"]),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(20),
      db
        .select({
          id: messages.id,
          createdAt: messages.createdAt,
          parts: messages.parts,
        })
        .from(messages)
        .where(
          and(
            eq(messages.chatId, activeChatId),
            eq(messages.role, "planning_state"),
          ),
        )
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(1),
    ]);

    modelMessages = buildConversationHistory([...dbHistoryDesc].reverse());
    const briefCandidateRows = [
      ...dbHistoryDesc
        .filter((row) => row.role === "assistant")
        .map((row) => ({ id: row.id, createdAt: row.createdAt, parts: row.parts })),
      ...planningStateRows,
    ].sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        String(b.id).localeCompare(String(a.id)),
    );
    priorPlanningState = extractLatestTripBriefFromMessages(briefCandidateRows);
  }

  const selectedModelId =
    body.selectedChatModel || body.selectedModel || DEFAULT_MODEL_ID;

  const persistedTripId = priorPlanningState?.tripId ?? existingChatTripId ?? undefined;
  const candidateTripId = persistedTripId ?? body.tripId ?? undefined;
  const clientBudgetTierHint = formatBudgetTierHint(body.tripPreferences?.budget);
  const shouldCheckEditAccess = Boolean(
    !persistedTripId && body.tripId && userId !== "guest" && authorization,
  );

  // Fetch user personalization, trip summary, edit-access, and active AI model key concurrently
  const [userProfile, tripData, editAccessRes, modelResolution] = await Promise.all([
    fetchUserContext(config, authorization),
    fetchTripSummary(candidateTripId, authorization, clientBudgetTierHint),
    shouldCheckEditAccess
      ? fetchTripResource(`/api/trips/${body.tripId}/edit-access`, authorization).catch((err) => {
          console.warn(`[ai-service] Could not verify edit access for trip ${body.tripId}:`, err);
          return undefined;
        })
      : Promise.resolve(undefined),
    resolveLanguageModel(selectedModelId)
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, error })),
  ]);

  if (!modelResolution.ok) {
    console.error("Failed to resolve AI language model:", modelResolution.error);
    return c.json({ error: "AI model invocation failed" }, 500);
  }

  let resolvedTripId = persistedTripId;
  let linkedFromClientHint = false;
  if (shouldCheckEditAccess && body.tripId && tripData?.trip && editAccessRes?.ok) {
    try {
      const linkedRows = await db
        .update(chats)
        .set({
          tripId: body.tripId,
          tripLinkedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chats.id, activeChatId),
            eq(chats.userId, userId),
            isNull(chats.tripId),
          ),
        )
        .returning({ tripId: chats.tripId });
      if (linkedRows.length > 0) {
        resolvedTripId = body.tripId;
        linkedFromClientHint = true;
      }
    } catch (err) {
      console.warn(`[ai-service] Could not link chat to trip ${body.tripId}:`, err);
    }
  }

  const clientBrief = briefFromClientPreferences(body.tripPreferences);
  const tripRecordBrief = briefFromTripRecord(tripData?.trip);
  const effectiveBrief = mergeEffectiveBrief({
    tripRecordBrief,
    persistedBrief: priorPlanningState?.brief,
    clientBrief,
  });

  const currentTripSummary = tripData?.summary;
  const clientPreferencesSummary = !currentTripSummary
    ? formatClientPreferencesSummary(effectiveBrief, body.tripPreferences?.budget)
    : undefined;

  const isTripLinked =
    Boolean(resolvedTripId) &&
    (priorPlanningState?.status === "TRIP_LINKED" ||
      priorPlanningState?.status === "COMPLETED" ||
      Boolean(existingChatTripId) ||
      linkedFromClientHint);

  const destinationHint = tripData?.trip?.destinationName || effectiveBrief?.where?.destinationText;
  const placeStore = new PlaceGroundingStore();

  const planningRuntime: PlanningRuntimeState = {
    runId: priorPlanningState?.runId ?? crypto.randomUUID(),
    tripId: resolvedTripId,
    brief: effectiveBrief,
    // Auto-commit is authorized if the trip was already linked during the intake phase or via trip creation,
    // or when updateTripPlanningBrief transitions to TRIP_LINKED in this turn.
    autoCommitAuthorized: isTripLinked,
    state: priorPlanningState ?? undefined,
    stateMessageId: priorPlanningState?.intentMessageId,
    userText,
    destinationHint,
    placeStore,
  };

  if (shouldGenerateTitle && userText) {
    const smartTitle = generateSmartTitle(userText, destinationHint);
    if (!isGenericChatTitle(smartTitle) && smartTitle !== currentChatTitle) {
      currentChatTitle = smartTitle;
      void db
        .update(chats)
        .set({ title: smartTitle, updatedAt: new Date() })
        .where(and(eq(chats.id, activeChatId!), eq(chats.userId, userId)))
        .catch((err) => console.error("Failed to update AI chat title:", err));
    }
  }

  const currentDate = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 4. Stream response using Vercel AI SDK streamText.toUIMessageStreamResponse
  try {
    const { model, activeKey } = modelResolution.value;

    const itineraryTools = getItineraryManagementTools({
      chatId: activeChatId!,
      userId,
      authorization,
      runtime: planningRuntime,
    });

    const result = streamText({
      model,
      system: getSystemPrompt({
        userId,
        userName: userProfile.displayName,
        userPreferences: userProfile.preferences,
        currentTripSummary,
        clientPreferencesSummary,
        currentDate,
        planningBrief: effectiveBrief,
        planningStatus: isTripLinked ? "TRIP_LINKED" : priorPlanningState?.status,
      }),
      messages: modelMessages,
      tools: {
        getWeather,
        prepareTripCandidates: getPrepareTripCandidatesTool({
          destinationHint: () =>
            planningRuntime.brief?.where?.destinationText || destinationHint,
          tripId: () => planningRuntime.tripId,
          authorization,
          userPreferences: userProfile.preferences,
          store: placeStore,
        }),
        searchPlaces: getSearchPlacesTool({
          destinationHint: () =>
            planningRuntime.brief?.where?.destinationText || destinationHint,
          tripId: () => planningRuntime.tripId,
          authorization,
          userPreferences: userProfile.preferences,
          store: placeStore,
        }),
        recommendPlaces: getRecommendPlacesTool({
          destinationHint: () =>
            planningRuntime.brief?.where?.destinationText || destinationHint,
          tripId: () => planningRuntime.tripId,
          authorization,
          store: placeStore,
        }),
        updateTripPlanningBrief: getUpdateTripPlanningBriefTool({
          chatId: activeChatId!,
          userId,
          userMessageId,
          userText,
          authorization,
          runtime: planningRuntime,
          isDirectPatch: false,
        }),
        createTripProposal: getCreateTripProposalTool({
          chatId: activeChatId!,
          userId,
          authorization,
          runtime: planningRuntime,
        }),
        ...itineraryTools,
      },
      stopWhen: [
        isStepCount(12),
        ({ steps }: { steps: any[] }) =>
          shouldStopAfterBriefStep(steps, planningRuntime.state?.status),
      ],
      onError: async ({ error }) => {
        console.error(">>> streamText ERROR:", error);
        if (activeKey) {
          const errStr = String((error as any)?.message || error);
          const statusCode =
            (error as any)?.status ||
            (error as any)?.statusCode ||
            (error as any)?.response?.status;
          await geminiKeyManager.reportFailure(activeKey, statusCode, errStr);
        }
      },
      onFinish: async ({ text, steps }) => {
        if (activeKey) {
          geminiKeyManager.reportSuccess(activeKey);
        }
        try {
          const toolParts: any[] = [];
          const stepTexts: string[] = [];
          let proposalOutput: any = null;
          let addedItemsOutput: any = null;

          if (steps && steps.length > 0) {
            for (const step of steps) {
              if (typeof (step as any).text === "string" && (step as any).text.trim()) {
                stepTexts.push((step as any).text.trim());
              }
              if (step.toolCalls && step.toolCalls.length > 0) {
                for (const tc of step.toolCalls) {
                  const resultObj = step.toolResults?.find(
                    (tr: any) => tr.toolCallId === tc.toolCallId
                  );
                  const output =
                    (resultObj as any)?.result ||
                    (resultObj as any)?.output;
                  if (tc.toolName === "createTripProposal" && output?.proposalId) {
                    proposalOutput = output;
                  } else if (tc.toolName === "addItineraryItems" && output?.success) {
                    addedItemsOutput = output;
                  }
                  toolParts.push({
                    type: `tool-${tc.toolName}`,
                    toolCallId: tc.toolCallId,
                    state: "output-available",
                    input: (tc as any).args || (tc as any).input,
                    output,
                  });
                }
              }
            }
          }

          let resolvedText = text?.trim() || stepTexts.join("\n\n").trim();
          if (!resolvedText) {
            if (proposalOutput) {
              const title = proposalOutput.title || proposalOutput.destination || "chuyến đi";
              resolvedText = `Dưới đây là kế hoạch **${title}** được thiết kế theo yêu cầu của bạn và đã tự động đồng bộ vào bảng lịch trình bên phải.`;
            } else if (addedItemsOutput) {
              resolvedText = "Mình đã thêm các hoạt động mới vào lịch trình chuyến đi của bạn!";
            }
          }

          const parts: any[] = [];
          if (resolvedText) {
            parts.push({ type: "text", text: resolvedText });
          }
          parts.push(...toolParts);

          await db.insert(messages).values({
            chatId: activeChatId!,
            role: "assistant",
            parts:
              parts.length > 0
                ? parts
                : [{ type: "text", text: "" }],
          });
        } catch (dbErr) {
          console.error("Failed to persist assistant message to DB:", dbErr);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "X-Chat-Id": activeChatId,
        ...(currentChatTitle ? { "X-Chat-Title": encodeURIComponent(currentChatTitle) } : {}),
        "Access-Control-Expose-Headers": "X-Chat-Id, X-Chat-Title",
      },
      onError: (err) => {
        console.error(">>> toUIMessageStream ERROR:", err);
        return String((err as any)?.message || err || "AI stream error");
      },
    });
  } catch (err: any) {
    console.error("streamText execution error:", err);
    return c.json({ error: "AI model invocation failed" }, 500);
  }
});
