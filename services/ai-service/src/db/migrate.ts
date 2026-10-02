import { db } from "./index.js";
import { sql } from "drizzle-orm";
import "dotenv/config";

export async function runMigrations() {
  console.log("[DB Migration] Ensuring schema tripsense_ai_v2 and tables exist...");
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS tripsense_ai_v2;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tripsense_ai_v2.chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(64) NOT NULL,
      title TEXT NOT NULL DEFAULT 'Cuộc trò chuyện mới',
      trip_id UUID NULL,
      trip_linked_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    ALTER TABLE tripsense_ai_v2.chats
      ADD COLUMN IF NOT EXISTS trip_id UUID NULL,
      ADD COLUMN IF NOT EXISTS trip_linked_at TIMESTAMPTZ NULL;
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_ai_v2_chats_user_trip
      ON tripsense_ai_v2.chats(user_id, trip_id)
      WHERE trip_id IS NOT NULL;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tripsense_ai_v2.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES tripsense_ai_v2.chats(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      parts JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tripsense_ai_v2.proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES tripsense_ai_v2.chats(id) ON DELETE CASCADE,
      user_id VARCHAR(64) NOT NULL,
      itinerary_json JSONB NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
      proposal_hash VARCHAR(64) NULL,
      applied_trip_id UUID NULL,
      applied_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.execute(sql`
    ALTER TABLE tripsense_ai_v2.proposals
      ADD COLUMN IF NOT EXISTS proposal_hash VARCHAR(64) NULL,
      ADD COLUMN IF NOT EXISTS applied_trip_id UUID NULL,
      ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NULL;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tripsense_ai_v2.votes (
      chat_id UUID NOT NULL REFERENCES tripsense_ai_v2.chats(id) ON DELETE CASCADE,
      message_id UUID NOT NULL REFERENCES tripsense_ai_v2.messages(id) ON DELETE CASCADE,
      is_upvoted BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chat_id, message_id)
    );
  `);

  console.log("[DB Migration] Schema tripsense_ai_v2 is ready.");
}

async function main() {
  await runMigrations();
  process.exit(0);
}

if (process.argv[1]?.includes("migrate")) {
  main().catch((err) => {
    console.error("[DB Migration] Error:", err);
    process.exit(1);
  });
}
