const configuredBase = process.env.NEXT_PUBLIC_AI_SERVICE_URL?.replace(/\/$/, "");

export const AI_API_ROOT = configuredBase
  ? configuredBase.endsWith("/api") ||
    configuredBase.endsWith("/api/ai") ||
    configuredBase.endsWith("/api/ai/v2")
    ? configuredBase
    : `${configuredBase}/api`
  : "/api/ai";

export function aiApiUrl(path: string): string {
  return `${AI_API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
}
