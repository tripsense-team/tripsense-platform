import crypto from "node:crypto";
import { config } from "../config.js";

type AccessClaims = {
  sub?: string;
  type?: string;
  role?: string;
  roles?: string[];
  exp?: number;
};

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function parseVerifiedClaims(authorization?: string, secretOverride?: string): AccessClaims | null {
  const secret = secretOverride ?? config.jwtAccessSecret;
  if (!authorization?.startsWith("Bearer ") || !secret) return null;
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8"));
    if (header.alg !== "HS256") return null;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest();
    const supplied = decodeBase64Url(parts[2]);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      return null;
    }
    const claims = JSON.parse(decodeBase64Url(parts[1]).toString("utf8")) as AccessClaims;
    if (
      claims.type !== "ACCESS" ||
      !claims.sub ||
      !claims.exp ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function subjectFromAuthorization(authorization?: string): string | null {
  const claims = parseVerifiedClaims(authorization);
  return claims?.sub ?? null;
}

export function verifyAdminAuthorization(
  authorization?: string,
  secretOverride?: string
): { ok: true; sub: string } | { ok: false; status: 401 | 403 } {
  const claims = parseVerifiedClaims(authorization, secretOverride);
  if (!claims || !claims.sub) {
    return { ok: false, status: 401 };
  }
  const roleUpper = (claims.role ?? "").toUpperCase();
  const hasAdminRole =
    roleUpper === "ADMIN" ||
    roleUpper === "ROLE_ADMIN" ||
    (Array.isArray(claims.roles) &&
      claims.roles.some((r) => {
        const ru = String(r).toUpperCase();
        return ru === "ADMIN" || ru === "ROLE_ADMIN";
      }));
  if (!hasAdminRole) {
    return { ok: false, status: 403 };
  }
  return { ok: true, sub: claims.sub };
}
