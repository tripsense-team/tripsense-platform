import assert from "node:assert/strict";
import test from "node:test";
import { GeminiKeyManager } from "./gemini-key-manager.js";

test("GeminiKeyManager.maskKey masks long API keys properly", () => {
  assert.equal(GeminiKeyManager.maskKey("AIzaSyD1234567890abcdef"), "AIzaSy...cdef");
  assert.equal(GeminiKeyManager.maskKey("short"), "***");
  assert.equal(GeminiKeyManager.maskKey(null), "empty");
});

test("GeminiKeyManager falls back to config key when place-service is unreachable", async () => {
  // Test instance with unreachable port
  const manager = new GeminiKeyManager(1000, "http://localhost:59999");
  
  // getActiveKey should gracefully fallback without throwing
  const key = await manager.getActiveKey();
  assert.ok(key && key.length > 0, "Expected a valid fallback key");
  assert.ok(manager.getCachedState() !== null, "Key should be cached");
});

test("GeminiKeyManager invalidates cache on reportFailure", async () => {
  const manager = new GeminiKeyManager(1000, "http://localhost:59999");
  await manager.getActiveKey();
  assert.ok(manager.getCachedState() !== null);

  await manager.reportFailure("some-failed-key", 429, "Quota exhausted");
  assert.equal(manager.getCachedState(), null, "Cache should be invalidated immediately");
});

test("GeminiKeyManager prioritizes GOOGLE_GENERATIVE_AI_API_KEY over place-service pool and falls back when empty", async (t) => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response(
      JSON.stringify({
        success: true,
        data: { provider: "GEMINI", key: "pool-key-should-not-override" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const envPreferredManager = new GeminiKeyManager(1000, "http://localhost:8083", "env-chat-key-123456");
  const envKey = await envPreferredManager.getActiveKey();
  assert.equal(envKey, "env-chat-key-123456");
  assert.equal(envPreferredManager.getCachedState()?.source, "env");
  assert.equal(fetchCalled, false);

  const fallbackManager = new GeminiKeyManager(1000, "http://localhost:8083", "");
  const poolKey = await fallbackManager.getActiveKey();
  assert.equal(poolKey, "pool-key-should-not-override");
  assert.equal(fallbackManager.getCachedState()?.source, "pool");
  assert.equal(fetchCalled, true);
});
