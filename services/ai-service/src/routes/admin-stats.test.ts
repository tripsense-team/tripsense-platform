import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyAdminAuthorization } from "../security/access-token.js";

function signHs256(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `Bearer ${header}.${body}.${sig}`;
}

test("verifyAdminAuthorization rejects missing or invalid token with 401", () => {
  const secret = "test-secret-key-for-admin-stats-32bytes";
  assert.deepEqual(verifyAdminAuthorization(undefined, secret), { ok: false, status: 401 });
  assert.deepEqual(verifyAdminAuthorization("Bearer malformed", secret), { ok: false, status: 401 });
});

test("verifyAdminAuthorization rejects non-admin role with 403 and accepts ADMIN role", () => {
  const secret = "test-secret-key-for-admin-stats-32bytes";
  const exp = Math.floor(Date.now() / 1000) + 600;
  const userToken = signHs256({ sub: "u-1", type: "ACCESS", role: "USER", exp }, secret);
  assert.deepEqual(verifyAdminAuthorization(userToken, secret), { ok: false, status: 403 });

  const adminToken = signHs256({ sub: "admin-1", type: "ACCESS", role: "ADMIN", exp }, secret);
  assert.deepEqual(verifyAdminAuthorization(adminToken, secret), { ok: true, sub: "admin-1" });
});

