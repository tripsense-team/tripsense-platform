import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check candidate paths for root env/.env
const candidatePaths = [
  path.resolve(__dirname, "../../../env/.env"),
  path.resolve(__dirname, "../../env/.env"),
  path.resolve(process.cwd(), "../../env/.env"),
  path.resolve(process.cwd(), "env/.env"),
];

for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export function normalizePostgresUrl(raw: string): string {
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

function getDatabaseUrl(): string {
  const rawUrl =
    process.env.AI_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.AI_V2_DATABASE_URL;
  if (!rawUrl) {
    throw new Error("Missing AI_DATABASE_URL in env/.env");
  }
  return normalizePostgresUrl(rawUrl);
}

export const config = {
  port: Number(process.env.AI_SERVICE_PORT || process.env.AI_SERVICE_V2_PORT || 8089),
  databaseUrl: getDatabaseUrl(),
  googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.AI_MODEL_BASE_URL || "",
  placeServiceUrl: process.env.PLACE_SERVICE_URL || "http://localhost:8083",
  tripServiceUrl: process.env.TRIP_SERVICE_URL || "http://localhost:8084",
  aiTripCommitSecret: process.env.AI_TRIP_COMMIT_SECRET || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  allowedOrigins: (process.env.AI_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000").split(","),
};
