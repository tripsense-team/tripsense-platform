/**
 * Validates whether a given URL is a safe internal relative path.
 * Protects against Open Redirect attacks (e.g. `//evil.com`, `/\evil.com`, `javascript:...`).
 */
export function isSafeInternalUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  // Must start with exactly a single slash and not followed by another slash or backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return false;
  }
  // Disallow control characters and protocol indicators
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
  return true;
}

export function sanitizeReturnUrl(
  url?: string | null,
  fallback = "/explore"
): string {
  if (isSafeInternalUrl(url)) {
    const trimmed = url!.trim();
    if (trimmed !== "/") return trimmed;
  }
  return fallback;
}
