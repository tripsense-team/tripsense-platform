import { Hono } from "hono";
import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

export const healthRouter = new Hono();

healthRouter.get("/health", (c) => {
  return c.json({
    status: "UP",
    service: "ai-service",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/ready", async (c) => {
  try {
    // Check DB liveness
    await db.execute(sql`SELECT 1;`);
    return c.json({
      status: "READY",
      service: "ai-service",
      database: "CONNECTED",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return c.json(
      {
        status: "NOT_READY",
        service: "ai-service",
        database: "DISCONNECTED",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});
