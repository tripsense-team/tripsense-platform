import crypto from "node:crypto";
import { config } from "../config.js";

type AccessClaims = {
  sub?: string;
  type?: string;
  exp?: number;
};

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function subjectFromAuthorization(authorization?: string): string | null {
  if (!authorization?.startsWith("Bearer ") || !config.jwtAccessSecret) return null;
  const token = authorization.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(decodeBase64Url(parts[0]).toString("utf8"));
    if (header.alg !== "HS256") return null;
    const expected = crypto
      .createHmac("sha256", config.jwtAccessSecret)
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
    return claims.sub;
  } catch {
    return null;
  }
}
