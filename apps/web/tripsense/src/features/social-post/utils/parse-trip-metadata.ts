import type { SharedTripSummary } from "../types";

/**
 * Read-only compatibility for historical client-authored metadata.
 * New posts must use the typed Trip Share publication API.
 */
export function parsePostContent(rawContent: string): {
  cleanContent: string;
  tripSummary?: SharedTripSummary;
} {
  if (!rawContent) return { cleanContent: "" };

  const match = rawContent.match(/\n*<!--TRIP_METADATA:([\s\S]*?)-->$/);
  if (match?.[1]) {
    try {
      const tripSummary = JSON.parse(match[1]) as SharedTripSummary;
      return {
        cleanContent: rawContent
          .replace(/\n*<!--TRIP_METADATA:([\s\S]*?)-->$/, "")
          .trim(),
        tripSummary,
      };
    } catch {
      // Malformed legacy metadata remains plain post text.
    }
  }
  return { cleanContent: rawContent };
}
