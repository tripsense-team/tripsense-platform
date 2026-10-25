import { db } from "../src/db/index.js";
import { messages, proposals, chats } from "../src/db/schema.js";
import { asc, eq } from "drizzle-orm";

async function run() {
  const chatId = "0d744cd8-8380-4137-ae07-88bd4e974d12";
  const msgs = await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.createdAt));
  console.log("Total messages:", msgs.length);
  for (const m of msgs) {
    console.log("=== ROLE:", m.role);
    console.log("Content:", m.content);
    console.log("Parts:", JSON.stringify(m.parts, null, 2));
  }
  const props = await db.select().from(proposals).where(eq(proposals.chatId, chatId));
  console.log("Proposals:", props);
  process.exit(0);
}
run().catch(console.error);
