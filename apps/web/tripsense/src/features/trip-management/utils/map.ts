import { normalizeSearchText } from "./search";

export function mapEmbedForDestination(destination: string): string {
  const normalized = normalizeSearchText(destination);
  if (normalized.includes("da nang")) {
    return "https://www.openstreetmap.org/export/embed.html?bbox=107.85%2C15.90%2C108.38%2C16.22&layer=mapnik&marker=16.0544%2C108.2022";
  }

  return "https://www.openstreetmap.org/export/embed.html?bbox=102.0%2C8.0%2C110.0%2C23.5&layer=mapnik";
}
