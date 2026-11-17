import { normalizeSearchText } from "./search";

export type DestinationCoordinatesEntry = {
  canonicalName: string;
  aliases: readonly string[];
  center: readonly [number, number]; // [lng, lat]
};

const DEFAULT_DANANG_CENTER: [number, number] = [108.2022, 16.0544];

/**
 * Shared destination coordinate catalog covering all curated WhereModal destinations
 * and major Vietnamese travel hubs. Order longer/specific phrases first for prompt inference.
 */
const DESTINATION_CATALOG: readonly DestinationCoordinatesEntry[] = [
  { canonicalName: "TP. Hồ Chí Minh", aliases: ["ho chi minh", "tp hcm", "tphcm", "sai gon", "saigon", "hcm"], center: [106.6297, 10.8231] },
  { canonicalName: "Kuala Lumpur", aliases: ["kuala lumpur", "kualalumpur"], center: [101.6869, 3.139] },
  { canonicalName: "Phan Thiết", aliases: ["phan thiet", "mui ne"], center: [108.1001, 10.9333] },
  { canonicalName: "Đà Nẵng", aliases: ["da nang", "danang"], center: DEFAULT_DANANG_CENTER },
  { canonicalName: "Hà Nội", aliases: ["ha noi", "hanoi"], center: [105.8342, 21.0278] },
  { canonicalName: "Đà Lạt", aliases: ["da lat", "dalat"], center: [108.4583, 11.9404] },
  { canonicalName: "Phú Quốc", aliases: ["phu quoc", "phuquoc"], center: [103.963, 10.2899] },
  { canonicalName: "Hội An", aliases: ["hoi an", "hoian"], center: [108.3262, 15.8801] },
  { canonicalName: "Nha Trang", aliases: ["nha trang", "nhatrang"], center: [109.1967, 12.2388] },
  { canonicalName: "Hạ Long", aliases: ["ha long", "halong"], center: [107.0431, 20.9505] },
  { canonicalName: "Ninh Bình", aliases: ["ninh binh", "ninhbinh"], center: [105.9745, 20.2506] },
  { canonicalName: "Quy Nhơn", aliases: ["quy nhon", "quynhon"], center: [109.2197, 13.782] },
  { canonicalName: "Vũng Tàu", aliases: ["vung tau", "vungtau"], center: [107.0843, 10.346] },
  { canonicalName: "Hà Giang", aliases: ["ha giang", "hagiang"], center: [104.9833, 22.8233] },
  { canonicalName: "Cần Thơ", aliases: ["can tho", "cantho"], center: [105.7844, 10.0452] },
  { canonicalName: "Mỹ Tho", aliases: ["my tho", "tien giang"], center: [106.3667, 10.3667] },
  { canonicalName: "Bến Tre", aliases: ["ben tre"], center: [106.3756, 10.2415] },
  { canonicalName: "Sa Pa", aliases: ["sa pa", "sapa"], center: [103.8438, 22.3364] },
  { canonicalName: "Huế", aliases: ["hue"], center: [107.5905, 16.4637] },
  { canonicalName: "New York", aliases: ["new york", "newyork"], center: [-74.006, 40.7128] },
  { canonicalName: "Hong Kong", aliases: ["hong kong", "hongkong"], center: [114.1694, 22.3193] },
  { canonicalName: "Singapore", aliases: ["singapore"], center: [103.8198, 1.3521] },
  { canonicalName: "Bangkok", aliases: ["bangkok"], center: [100.5018, 13.7563] },
  { canonicalName: "Tokyo", aliases: ["tokyo"], center: [139.6917, 35.6895] },
  { canonicalName: "Kyoto", aliases: ["kyoto"], center: [135.7681, 35.0116] },
  { canonicalName: "Seoul", aliases: ["seoul"], center: [126.978, 37.5665] },
  { canonicalName: "Taipei", aliases: ["taipei", "dai bac"], center: [121.5654, 25.033] },
  { canonicalName: "Bali", aliases: ["bali"], center: [115.1889, -8.4095] },
  { canonicalName: "Paris", aliases: ["paris"], center: [2.3522, 48.8566] },
  { canonicalName: "London", aliases: ["london"], center: [-0.1276, 51.5072] },
  { canonicalName: "Rome", aliases: ["rome", "roma"], center: [12.4964, 41.9028] },
  { canonicalName: "Sydney", aliases: ["sydney"], center: [151.2093, -33.8688] },
  { canonicalName: "Dubai", aliases: ["dubai"], center: [55.2708, 25.2048] },
];

/**
 * Guards against Null Island (0, 0), NaN, and out-of-range coordinates.
 */
export function isValidCoordinate(
  lat?: number | null,
  lng?: number | null,
): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Resolves [lng, lat] center coordinates for a destination name.
 */
export function getDestinationCenter(destination: string): [number, number] {
  const normalized = normalizeSearchText(destination || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [...DEFAULT_DANANG_CENTER];

  for (const entry of DESTINATION_CATALOG) {
    if (entry.aliases.some((alias) => normalized.includes(alias))) {
      return [entry.center[0], entry.center[1]];
    }
  }

  return [...DEFAULT_DANANG_CENTER];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Infers a known travel destination mentioned in a user prompt using word boundaries
 * without mutating persisted trip brief state.
 */
export function inferDestinationFromPrompt(prompt: string): string | null {
  const normalized = normalizeSearchText(prompt || "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;

  for (const entry of DESTINATION_CATALOG) {
    for (const alias of entry.aliases) {
      const boundaryRegex = new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?:$|\\s)`, "i");
      if (boundaryRegex.test(normalized)) {
        return entry.canonicalName;
      }
    }
  }

  return null;
}

export function mapEmbedForDestination(destination: string): string {
  const normalized = normalizeSearchText(destination);
  if (normalized.includes("da nang")) {
    return "https://www.openstreetmap.org/export/embed.html?bbox=107.85%2C15.90%2C108.38%2C16.22&layer=mapnik&marker=16.0544%2C108.2022";
  }

  return "https://www.openstreetmap.org/export/embed.html?bbox=102.0%2C8.0%2C110.0%2C23.5&layer=mapnik";
}
