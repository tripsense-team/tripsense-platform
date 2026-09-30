import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";
import { config } from "../config.js";

if (!config.databaseUrl) {
  console.warn("Database connection string could not be resolved from environment!");
}

// Disable prefetch as it is not supported for "Transaction" pool mode if using Supabase/Neon
const client = postgres(config.databaseUrl, {
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
export { schema };
