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
  const manager = new GeminiKeyManager(1000);
  
  // getActiveKey should gracefully fallback without throwing
  const key = await manager.getActiveKey();
  assert.ok(key && key.length > 0, "Expected a valid fallback key");
  assert.ok(manager.getCachedState() !== null, "Key should be cached");
});

test("GeminiKeyManager invalidates cache on reportFailure", async () => {
  const manager = new GeminiKeyManager(1000);
  await manager.getActiveKey();
  assert.ok(manager.getCachedState() !== null);

  await manager.reportFailure("some-failed-key", 429, "Quota exhausted");
  assert.equal(manager.getCachedState(), null, "Cache should be invalidated immediately");
});
