import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../../env/.env") });

function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/^"|"$/g, "");
  url = url.replace(/^postgresql\+psycopg:\/\//, "postgresql://");
  if (url.startsWith("jdbc:postgresql://")) {
    const stripped = url.replace(/^jdbc:/, "");
    try {
      const parsed = new URL(stripped);
      const user = parsed.searchParams.get("user");
      const password = parsed.searchParams.get("password");
      if (user) {
        parsed.username = user;
        parsed.searchParams.delete("user");
      }
      if (password) {
        parsed.password = password;
        parsed.searchParams.delete("password");
      }
      parsed.searchParams.delete("channelBinding");
      return parsed.toString();
    } catch {
      return stripped;
    }
  }
  return url;
}

const rawUrl = process.env.AI_DATABASE_URL || process.env.DATABASE_URL || "";
const dbUrl = normalizeUrl(rawUrl);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
  schemaFilter: ["tripsense_ai_v2"],
});
