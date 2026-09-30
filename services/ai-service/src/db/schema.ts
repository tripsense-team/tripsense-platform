import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const aiSchema = pgSchema("tripsense_ai_v2");

// 1. CHATS (Conversations)
export const chats = aiSchema.table(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    title: text("title").notNull().default("Cuộc trò chuyện mới"),
    tripId: uuid("trip_id"),
    tripLinkedAt: timestamp("trip_linked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTripIdx: index("idx_ai_v2_chats_user_trip")
      .on(table.userId, table.tripId)
      .where(sql`${table.tripId} is not null`),
  }),
);

export type Chat = InferSelectModel<typeof chats>;
export type NewChat = InferInsertModel<typeof chats>;

// 2. MESSAGES (Text, Tool-calls, and Tool-results stored as structured JSON parts)
export const messages = aiSchema.table("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant' | 'system'
  parts: jsonb("parts").notNull(), // Array of message parts (e.g. { type: 'text', text: '...' })
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;

// 3. PROPOSALS (Draft travel plans pending user confirmation)
export const proposals = aiSchema.table("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 64 }).notNull(),
  itineraryJson: jsonb("itinerary_json").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("PENDING"),
  proposalHash: varchar("proposal_hash", { length: 64 }),
  appliedTripId: uuid("applied_trip_id"),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Proposal = InferSelectModel<typeof proposals>;
export type NewProposal = InferInsertModel<typeof proposals>;

// 4. VOTES (Upvote / Downvote messages, matching Vercel AI Vote_v2)
export const votes = aiSchema.table(
  "votes",
  {
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    isUpvoted: boolean("is_upvoted").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof votes>;
export type NewVote = InferInsertModel<typeof votes>;
