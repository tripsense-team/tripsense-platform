import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { chats, messages, proposals } from "../db/schema.js";
import { verifyAdminAuthorization } from "../security/access-token.js";

const ALLOWED_PERIODS = new Set([7, 30, 90, 365]);

export const adminStatsRouter = new Hono();

adminStatsRouter.get("/admin/stats", async (c) => {
  const authCheck = verifyAdminAuthorization(c.req.header("Authorization"));
  if (!authCheck.ok) {
    return c.json(
      { error: authCheck.status === 401 ? "Unauthorized" : "Forbidden" },
      authCheck.status
    );
  }

  const rawPeriod = Number.parseInt(c.req.query("periodDays") ?? "30", 10);
  const periodDays = ALLOWED_PERIODS.has(rawPeriod) ? rawPeriod : 30;
  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [chatRow] = await db
    .select({
      totalChats: sql<number>`count(*)::int`,
      linkedTripsChats: sql<number>`count(*) filter (where ${chats.tripId} is not null)::int`,
      periodChats: sql<number>`count(*) filter (where ${chats.createdAt} >= ${sinceDate})::int`,
    })
    .from(chats);

  const [msgRow] = await db
    .select({
      totalMessages: sql<number>`count(*)::int`,
      userMessages: sql<number>`count(*) filter (where ${messages.role} = 'user')::int`,
      assistantMessages: sql<number>`count(*) filter (where ${messages.role} = 'assistant')::int`,
    })
    .from(messages);

  const [propRow] = await db
    .select({
      totalProposals: sql<number>`count(*)::int`,
      periodProposals: sql<number>`count(*) filter (where ${proposals.createdAt} >= ${sinceDate})::int`,
    })
    .from(proposals);

  const totalChats = Number(chatRow?.totalChats ?? 0);
  const totalMessages = Number(msgRow?.totalMessages ?? 0);
  const avgMessagesPerChat =
    totalChats > 0 ? Math.round((totalMessages / totalChats) * 100) / 100 : 0;

  return c.json({
    periodDays,
    totalChats,
    periodChats: Number(chatRow?.periodChats ?? 0),
    linkedTripsChats: Number(chatRow?.linkedTripsChats ?? 0),
    totalMessages,
    userMessages: Number(msgRow?.userMessages ?? 0),
    assistantMessages: Number(msgRow?.assistantMessages ?? 0),
    avgMessagesPerChat,
    totalProposals: Number(propRow?.totalProposals ?? 0),
    periodProposals: Number(propRow?.periodProposals ?? 0),
  });
});

