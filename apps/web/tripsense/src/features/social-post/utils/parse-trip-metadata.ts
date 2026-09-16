import type { SharedTripSummary } from "../types";

export function parsePostContent(rawContent: string): {
  cleanContent: string;
  tripSummary?: SharedTripSummary;
} {
  if (!rawContent) return { cleanContent: "" };

  const match = rawContent.match(/\n*<!--TRIP_METADATA:([\s\S]*?)-->$/);
  if (match && match[1]) {
    try {
      const tripSummary = JSON.parse(match[1]) as SharedTripSummary;
      const cleanContent = rawContent.replace(/\n*<!--TRIP_METADATA:([\s\S]*?)-->$/, "").trim();
      return { cleanContent, tripSummary };
    } catch {
      // Return as is if parse fails
    }
  }
  return { cleanContent: rawContent };
}

export function formatContentWithTrip(content: string, trip?: SharedTripSummary | null): string {
  const trimmed = content.trim();
  if (!trip) return trimmed;
  return `${trimmed}\n\n<!--TRIP_METADATA:${JSON.stringify(trip)}-->`;
}
