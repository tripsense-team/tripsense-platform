import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";

// Auto-run migrations on startup (matching Spring Boot / Flyway behavior)
try {
  await runMigrations();
} catch (error) {
  console.error("[DB Migration] Failed to run database migrations on startup:", error);
}

const app = new Hono();

// Middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      return config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0];
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-User-Id",
      "X-User-Email",
    ],
    exposeHeaders: ["X-Chat-Id"],
    credentials: true,
  })
);

// Mount routes
app.route("/", healthRouter);
app.route("/api", healthRouter);
app.route("/api/ai", healthRouter);
app.route("/api/ai/v2", healthRouter);
app.route("/api/v2/ai", healthRouter);

app.route("/api", chatRouter);
app.route("/api/ai", chatRouter);
app.route("/api/ai/v2", chatRouter);
app.route("/api/v2/ai", chatRouter);

// Root information route
app.get("/", (c) => {
  return c.json({
    name: "TripSense AI Service",
    version: "1.0.0",
    engine: "Hono + Vercel AI SDK",
    port: config.port,
    endpoints: {
      health: "/health",
      ready: "/ready",
      models: "/api/models",
      chat: "/api/chat",
      chats: "/api/chats",
    },
  });
});

console.log(`Starting TripSense AI Service on http://localhost:${config.port}...`);

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`🚀 AI Service is running on http://localhost:${info.port}`);
  }
);
