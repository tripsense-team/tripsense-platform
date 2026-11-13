import crypto from "node:crypto";
import { config } from "../config.js";
import type { DeclaredTravelPreferences } from "../personalization/context-preferences.js";

export interface PlaceSearchResult {
  id: string;
  name: string;
  address?: string;
  city?: string;
  categories: string[];
  location?: { lat: number; lng: number };
  photoUrl?: string;
  rating?: number;
  userRatingCount?: number;
  phone?: string;
  reason?: string;
  grounded?: boolean;
  source?: "recommendation" | "place-service" | "ai-fallback";
}

export type BrowseCategory = "FOOD" | "CAFE" | "STAY" | "ATTRACTION" | "BEACH" | "ACTIVITY";

export const DEFAULT_CATEGORY_PHOTOS: Record<string, string> = {
  BEACH: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
  ATTRACTION: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80",
  FOOD: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80",
  CAFE: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80",
  STAY: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
  ACTIVITY: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
};

const RECOMMENDATION_CATEGORIES: Record<string, string[]> = {
  FOOD: ["restaurant", "food"],
  CAFE: ["cafe", "coffee"],
  STAY: ["hotel", "lodging", "resort"],
  ATTRACTION: ["tourist_attraction", "landmark", "museum"],
  BEACH: ["beach"],
  ACTIVITY: ["park", "amusement_park", "spa"],
};

const DESTINATION_NOISE_TOKENS = new Set(["thanh", "pho", "tinh", "tp", "thi", "xa", "huyen", "viet", "nam"]);

const NAME_MATCH_STOP_WORDS = new Set([
  "quan",
  "nha",
  "hang",
  "tiem",
  "khach",
  "san",
  "bai",
  "bien",
  "chua",
  "bao",
  "tang",
  "cho",
  "dem",
  "khu",
  "du",
  "lich",
  "tai",
  "o",
  "va",
  "the",
  "and",
]);

const GENERIC_ACTIVITY_PATTERNS = [
  "nghi ngoi",
  "tu do",
  "di chuyen",
  "check in",
  "check-in",
  "check out",
  "check-out",
  "nhan phong",
  "tra phong",
  "ra san bay",
  "den san bay",
  "ve lai",
  "khoi hanh",
  "chuan bi hanh ly",
  "an sang tai khach san",
];

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/.+/i.test(value.trim());
}

export function stripVietnameseAccents(input: string): string {
  return input
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizePlaceKey(input: string): string {
  return stripVietnameseAccents(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSyntheticPlaceId(id?: string | null): boolean {
  return !id || !id.trim() || id.startsWith("ai-rec-");
}

/**
 * Extracts the best usable HTTP image URL from a place-service or recommendation-service DTO.
 * Prefers hydrated Cloudinary/primaryPhoto URLs, then ready media primary asset, gallery, and photos[].
 */
export function extractPhotoUrl(raw: any): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  if (isHttpUrl(raw.primaryPhoto?.url)) {
    return raw.primaryPhoto.url.trim();
  }
  if (raw.media?.state === "READY" && isHttpUrl(raw.media?.primary?.url)) {
    return raw.media.primary.url.trim();
  }
  if (Array.isArray(raw.photoGallery)) {
    for (const item of raw.photoGallery) {
      const candidate = typeof item === "string" ? item : item?.url;
      if (isHttpUrl(candidate)) return candidate.trim();
    }
  }
  if (Array.isArray(raw.photos)) {
    const valid = raw.photos
      .map((item: unknown) => (typeof item === "string" ? item : (item as any)?.url))
      .filter(isHttpUrl);
    const cloudinary = valid.find((url: string) => url.includes("res.cloudinary.com"));
    if (cloudinary) return cloudinary.trim();
    if (valid.length > 0) return valid[0].trim();
  }
  if (isHttpUrl(raw.photoUrl)) {
    return raw.photoUrl.trim();
  }
  return undefined;
}

export function dtoToPlaceResult(raw: any, extras: Partial<PlaceSearchResult> = {}): PlaceSearchResult | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;

  const location =
    raw.location && typeof raw.location.lat === "number" && typeof raw.location.lng === "number"
      ? { lat: raw.location.lat, lng: raw.location.lng }
      : undefined;

  return {
    id: raw.id.trim(),
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    address: typeof raw.address === "string" && raw.address.trim() ? raw.address.trim() : undefined,
    city: typeof raw.city === "string" && raw.city.trim() ? raw.city.trim() : undefined,
    categories: Array.isArray(raw.categories) ? raw.categories : [],
    location,
    photoUrl: extractPhotoUrl(raw),
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
    userRatingCount: typeof raw.userRatingCount === "number" ? raw.userRatingCount : undefined,
    phone: typeof raw.phone === "string" && raw.phone.trim() ? raw.phone.trim() : undefined,
    reason: typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : undefined,
    grounded: true,
    ...extras,
  };
}

/**
 * Per-request in-memory cache of grounded places returned by search/recommendation tools
 * so recommendPlaces and itinerary commit tools can reuse verified IDs, photos, and addresses.
 */
export class PlaceGroundingStore {
  private readonly byId = new Map<string, PlaceSearchResult>();
  private readonly byName = new Map<string, PlaceSearchResult>();

  add(places: PlaceSearchResult[]): void {
    for (const place of places) {
      if (!place?.id || isSyntheticPlaceId(place.id)) continue;
      const existing = this.byId.get(place.id);
      const merged = existing ? mergePlaceRecords(existing, place) : place;
      this.byId.set(place.id, merged);
      const nameKey = normalizePlaceKey(merged.name);
      if (nameKey) {
        this.byName.set(nameKey, merged);
      }
    }
  }

  getById(id?: string | null): PlaceSearchResult | undefined {
    if (!id) return undefined;
    return this.byId.get(id.trim());
  }

  findBestByName(name: string): PlaceSearchResult | undefined {
    const queryKey = normalizePlaceKey(name);
    if (!queryKey) return undefined;
    const exact = this.byName.get(queryKey);
    if (exact) return exact;

    let best: PlaceSearchResult | undefined;
    let bestScore = 0;
    for (const candidate of this.byId.values()) {
      const score = computeNameSimilarity(name, candidate.name);
      if (score >= 0.65 && score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  list(): PlaceSearchResult[] {
    return Array.from(this.byId.values());
  }
}

export function mergePlaceRecords(base: PlaceSearchResult, incoming: PlaceSearchResult): PlaceSearchResult {
  const categories = base.categories.length > 0 ? base.categories : incoming.categories;
  return {
    ...base,
    ...incoming,
    name: incoming.name || base.name,
    address: incoming.address || base.address,
    city: incoming.city || base.city,
    categories,
    location: incoming.location || base.location,
    photoUrl: preferPhotoUrl(base.photoUrl, incoming.photoUrl),
    rating: incoming.rating ?? base.rating,
    userRatingCount: incoming.userRatingCount ?? base.userRatingCount,
    phone: incoming.phone || base.phone,
    reason: incoming.reason || base.reason,
    grounded: Boolean(base.grounded || incoming.grounded),
  };
}

function preferPhotoUrl(first?: string, second?: string): string | undefined {
  if (first && first.includes("res.cloudinary.com")) return first;
  if (second && second.includes("res.cloudinary.com")) return second;
  return first || second;
}

/**
 * Injects the trip destination into a place search query unless already present (accent-insensitive).
 */
export function buildDestinationQuery(query: string, destinationHint?: string): string {
  const cleanQuery = query.trim();
  const cleanDestination = destinationHint?.trim();
  if (!cleanQuery || !cleanDestination) return cleanQuery;

  const normQuery = normalizePlaceKey(cleanQuery);
  const destTokens = normalizePlaceKey(cleanDestination)
    .split(" ")
    .filter((token) => token.length >= 2 && !DESTINATION_NOISE_TOKENS.has(token));

  if (destTokens.length === 0) return cleanQuery;
  const normalizedDest = destTokens.join(" ");
  if (normQuery.includes(normalizedDest)) {
    return cleanQuery;
  }
  return `${cleanQuery} ${cleanDestination}`;
}

export function computeNameSimilarity(queryName: string, candidateName: string): number {
  const qNorm = normalizePlaceKey(queryName);
  const cNorm = normalizePlaceKey(candidateName);
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 1;
  if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) return 0.9;

  const qTokens = tokenizeSignificant(qNorm);
  const cTokens = new Set(tokenizeSignificant(cNorm));
  if (qTokens.length === 0 || cTokens.size === 0) return 0;

  let hits = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) hits += 1;
  }
  return hits / Math.max(qTokens.length, cTokens.size);
}

function tokenizeSignificant(normalized: string): string[] {
  const raw = normalized.split(" ").filter((t) => t.length > 1);
  const filtered = raw.filter((t) => !NAME_MATCH_STOP_WORDS.has(t));
  return filtered.length > 0 ? filtered : raw;
}

/**
 * Calls place-service POST /api/places/batch-snapshots to verify canonical IDs and optionally
 * backfill Cloudinary/ZioMap display photos for places missing them.
 */
export async function fetchBatchSnapshots(
  ids: string[],
  options: { includePhoto?: boolean; timeoutMs?: number } = {}
): Promise<Map<string, PlaceSearchResult>> {
  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => !isSyntheticPlaceId(id))));
  const resultMap = new Map<string, PlaceSearchResult>();
  if (uniqueIds.length === 0) return resultMap;

  const includePhoto = options.includePhoto ?? true;
  const timeoutMs = options.timeoutMs ?? 4000;

  try {
    const url = new URL(`${config.placeServiceUrl}/api/places/batch-snapshots`);
    if (includePhoto) {
      url.searchParams.set("includePhoto", "true");
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(uniqueIds),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return resultMap;
    const json: any = await res.json();
    const list = Array.isArray(json?.data) ? json.data : [];

    for (const raw of list) {
      const mapped = dtoToPlaceResult(raw, { source: "place-service", grounded: true });
      if (!mapped) continue;
      resultMap.set(mapped.id, mapped);
      if (typeof raw.providerPlaceId === "string" && raw.providerPlaceId.trim()) {
        resultMap.set(raw.providerPlaceId.trim(), mapped);
      }
    }
  } catch {
    // Graceful degradation when place-service is unavailable or times out.
  }

  return resultMap;
}

/**
 * Hydrates missing photos (and any missing metadata like address/rating/location) on top search results
 * via place-service batch-snapshots?includePhoto=true.
 */
export async function hydratePlacesPhotos(
  places: PlaceSearchResult[],
  store?: PlaceGroundingStore
): Promise<PlaceSearchResult[]> {
  const missingPhotoIds = places
    .filter((p) => !p.photoUrl && !isSyntheticPlaceId(p.id))
    .slice(0, 12)
    .map((p) => p.id);

  if (missingPhotoIds.length === 0) return places;

  const hydratedMap = await fetchBatchSnapshots(missingPhotoIds, {
    includePhoto: true,
    timeoutMs: 3800,
  });

  if (hydratedMap.size === 0) return places;

  const updated = places.map((place) => {
    const snap = hydratedMap.get(place.id);
    return snap ? mergePlaceRecords(place, snap) : place;
  });

  store?.add(updated);
  return updated;
}

type SearchResponsePayload = {
  places: PlaceSearchResult[];
  ok: boolean;
  semanticScores: Map<string, number>;
};

async function queryPlaceServiceSearch(params: {
  query: string;
  category?: BrowseCategory;
  limit: number;
  lat?: number;
  lng?: number;
}): Promise<{ places: PlaceSearchResult[]; ok: boolean }> {
  try {
    const url = new URL(`${config.placeServiceUrl}/api/places/search`);
    url.searchParams.set("q", params.query);
    url.searchParams.set("limit", String(params.limit));
    if (params.category && params.category !== "BEACH" && params.category !== "ACTIVITY") {
      url.searchParams.set("category", params.category);
    }
    if (params.lat !== undefined && params.lng !== undefined) {
      url.searchParams.set("lat", String(params.lat));
      url.searchParams.set("lng", String(params.lng));
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { places: [], ok: false };

    const json: any = await res.json();
    const rawPlaces = Array.isArray(json?.data) ? json.data : [];
    const places = rawPlaces
      .map((item: any) => dtoToPlaceResult(item, { source: "place-service", grounded: true }))
      .filter((item: PlaceSearchResult | null): item is PlaceSearchResult => item !== null);
    return { places, ok: true };
  } catch {
    return { places: [], ok: false };
  }
}

const SAFE_CATEGORY_PATTERN = /^[A-Za-z0-9_ -]{1,80}$/;

const ONBOARDING_TO_PLACE_CATEGORIES: Record<string, string[]> = {
  HOTEL: ["hotel", "lodging"],
  HOMESTAY: ["homestay", "lodging"],
  RESORT: ["resort", "hotel"],
  HOSTEL: ["hostel", "lodging"],
  LOCAL_FOOD: ["restaurant", "food"],
  STREET_FOOD: ["street_food", "restaurant", "food"],
  FINE_DINING: ["fine_dining", "restaurant"],
  CAFE: ["cafe", "coffee"],
  NATURE: ["nature", "park", "scenic"],
  HIKING: ["hiking", "park", "mountain"],
  CULTURE: ["museum", "culture", "landmark"],
  BEACH: ["beach", "seaside"],
  NIGHTLIFE: ["nightlife", "bar", "night_market"],
};

function normalizeCategoryList(values: Iterable<string>, limit = 20): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || !SAFE_CATEGORY_PATTERN.test(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * Maps onboarding DeclaredTravelPreferences into sanitized recommendation categories,
 * optionally scoped to a specific browse facet so STAY searches aren't diluted by FOOD tags.
 */
export function mapUserPreferencesToCategories(
  preferences?: DeclaredTravelPreferences,
  facet?: BrowseCategory,
): string[] {
  if (!preferences) return [];
  const rawTokens: string[] = [];
  if (!facet || facet === "STAY") {
    rawTokens.push(...preferences.stayStyles);
  }
  if (!facet || facet === "FOOD" || facet === "CAFE") {
    rawTokens.push(...preferences.foodStyles);
  }
  if (!facet || facet === "ATTRACTION" || facet === "BEACH" || facet === "ACTIVITY") {
    rawTokens.push(...preferences.activityInterests);
  }
  if (!facet) {
    rawTokens.push(...preferences.splurgeCategories);
  }
  const expanded: string[] = [];
  for (const token of rawTokens) {
    const mapped = ONBOARDING_TO_PLACE_CATEGORIES[token.toUpperCase()];
    if (mapped) {
      expanded.push(...mapped);
    } else {
      expanded.push(token);
    }
  }
  return normalizeCategoryList(expanded, 20);
}

async function queryRecommendationService(params: {
  query: string;
  category?: BrowseCategory;
  limit: number;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  preferredCategories?: string[];
  dislikedCategories?: string[];
  destinationHint?: string;
  tripId?: string;
  authorization?: string;
}): Promise<SearchResponsePayload> {
  const semanticScores = new Map<string, number>();
  if (!params.authorization || !config.recommendationServiceUrl) {
    return { places: [], ok: false, semanticScores };
  }

  try {
    const categoryTerms = params.category ? RECOMMENDATION_CATEGORIES[params.category] ?? [] : [];
    const dislikedCategories = normalizeCategoryList(params.dislikedCategories ?? [], 20);
    const dislikedSet = new Set(dislikedCategories);
    const preferredCategories = normalizeCategoryList(
      [...categoryTerms, ...(params.preferredCategories ?? [])],
      20
    ).filter((term) => !dislikedSet.has(term));

    const hasValidCoords =
      typeof params.lat === "number" &&
      Number.isFinite(params.lat) &&
      params.lat >= -90 &&
      params.lat <= 90 &&
      typeof params.lng === "number" &&
      Number.isFinite(params.lng) &&
      params.lng >= -180 &&
      params.lng <= 180;

    const boundedRadius =
      hasValidCoords && typeof params.radiusMeters === "number" && Number.isFinite(params.radiusMeters)
        ? Math.min(Math.max(Math.round(params.radiusMeters), 100), 50_000)
        : undefined;

    const rankingCriteria = [
      { feature: "SEMANTIC", direction: "MAXIMIZE", importance: "HIGH" },
      { feature: "PREFERENCE", direction: "MAXIMIZE", importance: "HIGH" },
      { feature: "RATING", direction: "MAXIMIZE", importance: "HIGH" },
      { feature: "POPULARITY", direction: "MAXIMIZE", importance: "MEDIUM" },
      ...(hasValidCoords ? [{ feature: "DISTANCE", direction: "MINIMIZE", importance: "MEDIUM" }] : []),
    ];

    const body: Record<string, unknown> = {
      query: params.query.slice(0, 200),
      tripId: params.tripId,
      preferredCategories,
      ...(dislikedCategories.length > 0 ? { dislikedCategories } : {}),
      ...(hasValidCoords ? { lat: params.lat, lng: params.lng } : {}),
      ...(boundedRadius !== undefined ? { radiusMeters: boundedRadius } : {}),
      geographicScope: params.destinationHint
        ? { name: params.destinationHint, strictNamedArea: false }
        : undefined,
      rankingCriteria,
      limit: Math.min(Math.max(params.limit * 2, 6), 20),
    };

    const res = await fetch(`${config.recommendationServiceUrl}/api/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: params.authorization,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.recommendationTimeoutMs),
    });

    if (!res.ok) return { places: [], ok: false, semanticScores };

    const json: any = await res.json();
    const items = Array.isArray(json?.data?.items) ? json.data.items : [];
    const places: PlaceSearchResult[] = [];

    for (const item of items) {
      const reasons = Array.isArray(item?.reasons) ? item.reasons.filter((r: unknown) => typeof r === "string") : [];
      const mapped = dtoToPlaceResult(item?.place, {
        source: "recommendation",
        grounded: true,
        reason: reasons[0],
      });
      if (!mapped) continue;
      places.push(mapped);
      if (typeof item?.score === "number") {
        semanticScores.set(mapped.id, item.score);
      }
    }

    return { places, ok: true, semanticScores };
  } catch {
    return { places: [], ok: false, semanticScores };
  }
}

function rankHybridCandidates(
  candidates: PlaceSearchResult[],
  semanticScores: Map<string, number>,
  query: string,
  destinationHint?: string
): PlaceSearchResult[] {
  const normDest = destinationHint ? normalizePlaceKey(destinationHint) : "";

  return [...candidates].sort((a, b) => {
    const scoreA = computeHybridRankScore(a, semanticScores.get(a.id), query, normDest);
    const scoreB = computeHybridRankScore(b, semanticScores.get(b.id), query, normDest);
    return scoreB - scoreA;
  });
}

function computeHybridRankScore(
  place: PlaceSearchResult,
  semanticScore: number | undefined,
  query: string,
  normDest: string
): number {
  let total = computeNameSimilarity(query, place.name) * 2.2;
  if (typeof semanticScore === "number") {
    total += Math.min(Math.max(semanticScore, 0), 2) * 1.8;
  }
  if (typeof place.rating === "number") {
    total += (place.rating / 5) * 1.4;
  }
  if (typeof place.userRatingCount === "number" && place.userRatingCount > 0) {
    total += Math.min(Math.log10(place.userRatingCount + 1) * 0.35, 1.2);
  }
  if (place.photoUrl) {
    total += place.photoUrl.includes("res.cloudinary.com") ? 0.55 : 0.35;
  }
  if (normDest && place.city && normalizePlaceKey(place.city).includes(normDest)) {
    total += 0.6;
  }
  return total;
}

/**
 * Executes a hybrid place search across place-service (catalog + live ZioMap discovery) and
 * recommendation-service (semantic Qdrant + user preferences when JWT authorization is present),
 * merges & deduplicates candidates, hydrates missing real photos, and populates the session store.
 */
export async function executeHybridPlaceSearch(params: {
  query: string;
  category?: BrowseCategory;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  preferredCategories?: string[];
  dislikedCategories?: string[];
  destinationHint?: string;
  tripId?: string;
  authorization?: string;
  store?: PlaceGroundingStore;
}): Promise<{
  success: boolean;
  effectiveQuery: string;
  places: PlaceSearchResult[];
  errorCode?: string;
}> {
  const safeLimit = Math.min(Math.max(params.limit || 5, 1), 10);
  const effectiveQuery =
    params.lat === undefined || params.lng === undefined
      ? buildDestinationQuery(params.query, params.destinationHint)
      : params.query.trim();

  const [catalogRes, recRes] = await Promise.all([
    queryPlaceServiceSearch({
      query: effectiveQuery,
      category: params.category,
      limit: safeLimit,
      lat: params.lat,
      lng: params.lng,
    }),
    queryRecommendationService({
      query: effectiveQuery,
      category: params.category,
      limit: safeLimit,
      lat: params.lat,
      lng: params.lng,
      radiusMeters: params.radiusMeters,
      preferredCategories: params.preferredCategories,
      dislikedCategories: params.dislikedCategories,
      destinationHint: params.destinationHint,
      tripId: params.tripId,
      authorization: params.authorization,
    }),
  ]);

  if (!catalogRes.ok && !recRes.ok) {
    return {
      success: false,
      effectiveQuery,
      places: [],
      errorCode: "PLACE_SEARCH_UNAVAILABLE",
    };
  }

  const mergedById = new Map<string, PlaceSearchResult>();
  for (const item of [...recRes.places, ...catalogRes.places]) {
    const existing = mergedById.get(item.id);
    mergedById.set(item.id, existing ? mergePlaceRecords(existing, item) : item);
  }

  const ranked = rankHybridCandidates(
    Array.from(mergedById.values()),
    recRes.semanticScores,
    params.query,
    params.destinationHint
  ).slice(0, safeLimit);

  const hydrated = await hydratePlacesPhotos(ranked, params.store);
  params.store?.add(hydrated);

  return {
    success: true,
    effectiveQuery,
    places: hydrated,
  };
}

export interface PrepareTripCandidatesGroup {
  category: BrowseCategory;
  places: PlaceSearchResult[];
  source: "recommendation" | "hybrid-fallback" | "place-service";
}

/**
 * Recommendation-first pre-fetch pipeline for multi-day trip planning:
 * queries recommendation-service (Qdrant + MMR diversity + user onboarding preferences) across
 * requested travel categories, falls back to place-service only when Qdrant coverage is sparse
 * (also triggering async ZioMap -> Qdrant indexing downstream), hydrates photos in batch, and
 * populates the session PlaceGroundingStore.
 */
export async function prepareTripCandidates(params: {
  destination: string;
  categories?: BrowseCategory[];
  limitPerCategory?: number;
  vibeQuery?: string;
  preferredCategories?: string[];
  dislikedCategories?: string[];
  userPreferences?: DeclaredTravelPreferences;
  lat?: number;
  lng?: number;
  tripId?: string;
  authorization?: string;
  store?: PlaceGroundingStore;
}): Promise<{
  success: boolean;
  destination: string;
  groups: PrepareTripCandidatesGroup[];
  places: PlaceSearchResult[];
  recommendationCount: number;
  fallbackTriggered: boolean;
}> {
  const destination = params.destination.trim();
  const categories: BrowseCategory[] =
    params.categories && params.categories.length > 0
      ? params.categories.slice(0, 4)
      : ["ATTRACTION", "FOOD", "CAFE", "STAY"];
  const limitPerCategory = Math.min(Math.max(params.limitPerCategory ?? 5, 2), 8);
  const minThreshold = Math.min(3, limitPerCategory);

  const dislikedSet = new Set(normalizeCategoryList(params.dislikedCategories ?? [], 20));
  const queryPrefix = params.vibeQuery?.trim() ? `${params.vibeQuery.trim()} ` : "";
  const categoryQueryTerms: Record<BrowseCategory, string> = {
    ATTRACTION: "tham quan check in noi bat",
    FOOD: "nha hang mon ngon dia phuong",
    CAFE: "quan cafe dep view chill",
    STAY: "khach san resort homestay luu tru",
    BEACH: "bai bien view bien",
    ACTIVITY: "hoat dong vui choi trai nghiem",
  };

  // Phase 1: prioritize recommendation-service (Qdrant semantic + MMR + facet-scoped preferences).
  const recPayloads = await Promise.all(
    categories.map(async (cat) => {
      const semanticQuery = buildDestinationQuery(
        `${queryPrefix}${categoryQueryTerms[cat]}`.trim(),
        destination
      );
      const facetPrefs = mapUserPreferencesToCategories(params.userPreferences, cat);
      const combinedPrefs = normalizeCategoryList(
        [...(params.preferredCategories ?? []), ...facetPrefs],
        20
      ).filter((item) => !dislikedSet.has(item));

      const res = await queryRecommendationService({
        query: semanticQuery,
        category: cat,
        limit: limitPerCategory,
        lat: params.lat,
        lng: params.lng,
        preferredCategories: combinedPrefs,
        dislikedCategories: params.dislikedCategories,
        destinationHint: destination,
        tripId: params.tripId,
        authorization: params.authorization,
      });
      return { category: cat, query: semanticQuery, res };
    })
  );

  // Phase 2: fallback to place-service only for categories below threshold (new/unindexed destinations).
  let fallbackTriggered = false;
  const rawGroups = await Promise.all(
    recPayloads.map(async ({ category, query, res }) => {
      if (res.ok && res.places.length >= minThreshold) {
        return {
          category,
          places: res.places.slice(0, limitPerCategory),
          source: "recommendation" as const,
          ok: true,
        };
      }

      fallbackTriggered = true;
      const catalogRes = await queryPlaceServiceSearch({
        query,
        category,
        limit: limitPerCategory,
        lat: params.lat,
        lng: params.lng,
      });

      const merged = new Map<string, PlaceSearchResult>();
      for (const item of [...res.places, ...catalogRes.places]) {
        const existing = merged.get(item.id);
        merged.set(item.id, existing ? mergePlaceRecords(existing, item) : item);
      }

      const ranked = rankHybridCandidates(
        Array.from(merged.values()),
        res.semanticScores,
        query,
        destination
      ).slice(0, limitPerCategory);

      return {
        category,
        places: ranked,
        source: res.places.length > 0 ? ("hybrid-fallback" as const) : ("place-service" as const),
        ok: res.ok || catalogRes.ok,
      };
    })
  );

  const deduped = new Map<string, PlaceSearchResult>();
  let recommendationCount = 0;
  for (const group of rawGroups) {
    for (const p of group.places) {
      if (p.source === "recommendation") recommendationCount += 1;
      const existing = deduped.get(p.id);
      deduped.set(p.id, existing ? mergePlaceRecords(existing, p) : p);
    }
  }

  const allPlaces = Array.from(deduped.values());
  const hydratedAll = await hydratePlacesPhotos(allPlaces, params.store);
  const hydratedById = new Map(hydratedAll.map((p) => [p.id, p]));
  params.store?.add(hydratedAll);

  const groups: PrepareTripCandidatesGroup[] = rawGroups.map((group) => ({
    category: group.category,
    source: group.source,
    places: group.places.map((p) => hydratedById.get(p.id) ?? p),
  }));

  const anyOk = rawGroups.some((g) => g.ok);

  return {
    success: anyOk || hydratedAll.length > 0,
    destination,
    groups,
    places: hydratedAll,
    recommendationCount,
    fallbackTriggered,
  };
}

export interface RawRecommendationPlaceInput {
  placeId?: string;
  name: string;
  category: string;
  reason?: string;
  address?: string;
  rating?: number;
  photoUrl?: string;
  lat?: number;
  lng?: number;
}

function collectMissingPhotoIds(
  ids: Array<string | null | undefined>,
  store?: PlaceGroundingStore
): string[] {
  const uniqueIds = new Set<string>();
  for (const rawId of ids) {
    if (isSyntheticPlaceId(rawId)) continue;
    const id = rawId!.trim();
    const cached = store?.getById(id);
    if (!cached || !cached.photoUrl) {
      uniqueIds.add(id);
    }
  }
  return Array.from(uniqueIds);
}

/**
 * Grounds AI-curated recommendation carousel cards against real catalog entities and real photos.
 * Reuses session grounding cache first, verifies explicit placeIds via batch-snapshots?includePhoto=true,
 * searches missing items in parallel, and preserves graceful offline fallback.
 */
export async function groundRecommendations(params: {
  places: RawRecommendationPlaceInput[];
  destination?: string;
  authorization?: string;
  tripId?: string;
  store?: PlaceGroundingStore;
}): Promise<PlaceSearchResult[]> {
  const { places, destination, authorization, tripId, store } = params;

  const missingFromStoreIds = collectMissingPhotoIds(
    places.map((p) => p.placeId),
    store
  );

  const explicitSnapshots = await fetchBatchSnapshots(missingFromStoreIds, {
    includePhoto: true,
    timeoutMs: 3800,
  });

  const resolvedMatches = new Array<PlaceSearchResult | undefined>(places.length);
  const needSearchIndices: number[] = [];

  for (let i = 0; i < places.length; i += 1) {
    const input = places[i];
    if (!isSyntheticPlaceId(input.placeId)) {
      const fromSnap = explicitSnapshots.get(input.placeId!.trim());
      const fromStore = store?.getById(input.placeId);
      const hit = fromSnap && fromStore ? mergePlaceRecords(fromStore, fromSnap) : fromSnap || fromStore;
      if (hit) {
        resolvedMatches[i] = hit;
        continue;
      }
    }

    const byName = store?.findBestByName(input.name);
    if (byName) {
      resolvedMatches[i] = byName;
      continue;
    }

    needSearchIndices.push(i);
  }

  if (needSearchIndices.length > 0) {
    await Promise.all(
      needSearchIndices.map(async (idx) => {
        const input = places[idx];
        const category = toBrowseCategory(input.category);
        const searchRes = await executeHybridPlaceSearch({
          query: input.name,
          category,
          limit: 3,
          destinationHint: destination,
          tripId,
          authorization,
          store,
        });
        if (!searchRes.success || searchRes.places.length === 0) return;

        let best: PlaceSearchResult | undefined;
        let bestScore = 0;
        for (const candidate of searchRes.places) {
          const score = computeNameSimilarity(input.name, candidate.name);
          if (score >= 0.5 && score > bestScore) {
            best = candidate;
            bestScore = score;
          }
        }
        if (best) {
          resolvedMatches[idx] = best;
        }
      })
    );
  }

  const missingPhotoIds = resolvedMatches
    .filter((m): m is PlaceSearchResult => Boolean(m && !m.photoUrl && !isSyntheticPlaceId(m.id)))
    .map((m) => m.id);

  const hydratedMap =
    missingPhotoIds.length > 0
      ? await fetchBatchSnapshots(missingPhotoIds, { includePhoto: true, timeoutMs: 3800 })
      : new Map<string, PlaceSearchResult>();

  return places.map((input, idx) => {
    const categoryKey = input.category.toUpperCase();
    const fallbackPhoto = DEFAULT_CATEGORY_PHOTOS[categoryKey] || DEFAULT_CATEGORY_PHOTOS.ATTRACTION;
    const rawMatch = resolvedMatches[idx];
    const hydratedMatch = rawMatch ? hydratedMap.get(rawMatch.id) : undefined;
    const match = rawMatch && hydratedMatch ? mergePlaceRecords(rawMatch, hydratedMatch) : rawMatch;

    if (match) {
      store?.add([match]);
      return {
        id: match.id,
        name: match.name || input.name,
        categories:
          match.categories.length > 0 ? match.categories : [input.category.toLowerCase()],
        address: match.address || input.address,
        city: match.city || destination,
        rating: match.rating ?? input.rating,
        userRatingCount: match.userRatingCount,
        photoUrl: match.photoUrl || (isHttpUrl(input.photoUrl) ? input.photoUrl : fallbackPhoto),
        location:
          match.location ||
          (input.lat !== undefined && input.lng !== undefined
            ? { lat: input.lat, lng: input.lng }
            : undefined),
        phone: match.phone,
        reason: input.reason || match.reason,
        grounded: true,
        source: match.source || "place-service",
      };
    }

    return {
      id: `ai-rec-${idx + 1}-${crypto.randomUUID().slice(0, 8)}`,
      name: input.name,
      categories: [input.category.toLowerCase()],
      address: input.address,
      city: destination,
      rating: input.rating || 4.7,
      photoUrl: isHttpUrl(input.photoUrl) ? input.photoUrl : fallbackPhoto,
      location:
        input.lat !== undefined && input.lng !== undefined
          ? { lat: input.lat, lng: input.lng }
          : undefined,
      reason: input.reason,
      grounded: false,
      source: "ai-fallback",
    };
  });
}

function toBrowseCategory(category?: string): BrowseCategory | undefined {
  const upper = category?.trim().toUpperCase();
  if (
    upper === "FOOD" ||
    upper === "CAFE" ||
    upper === "STAY" ||
    upper === "ATTRACTION" ||
    upper === "BEACH" ||
    upper === "ACTIVITY"
  ) {
    return upper;
  }
  return undefined;
}

function isGenericActivityTitle(title: string): boolean {
  const normalized = normalizePlaceKey(title);
  if (!normalized || normalized.length < 4) return true;
  return GENERIC_ACTIVITY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export interface ActivityPlaceResolutionInput {
  placeId?: string | null;
  title: string;
  category?: string;
}

/**
 * Resolves canonical place snapshots for itinerary activities (createTripProposal, addItineraryItems,
 * replaceItineraryItem) using explicit placeIds, session grounding store, and targeted fallback lookup
 * for concrete venue titles while ignoring generic logistics like "Nghỉ ngơi" or "Tự do".
 */
export async function resolveCanonicalActivityPlaces(params: {
  items: ActivityPlaceResolutionInput[];
  destinationHint?: string;
  authorization?: string;
  tripId?: string;
  store?: PlaceGroundingStore;
}): Promise<Map<number, PlaceSearchResult>> {
  const { items, destinationHint, authorization, tripId, store } = params;
  const resolved = new Map<number, PlaceSearchResult>();

  const missingSnapshotIds = collectMissingPhotoIds(
    items.map((item) => item.placeId),
    store
  );

  const snapshotMap =
    missingSnapshotIds.length > 0
      ? await fetchBatchSnapshots(missingSnapshotIds, {
          includePhoto: true,
          timeoutMs: 4000,
        })
      : new Map<string, PlaceSearchResult>();

  const unresolvedIndices: number[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!isSyntheticPlaceId(item.placeId)) {
      const snap = snapshotMap.get(item.placeId!.trim());
      const cached = store?.getById(item.placeId);
      const hit = snap && cached ? mergePlaceRecords(cached, snap) : snap || cached;
      if (hit) {
        if (snap) store?.add([hit]);
        resolved.set(i, hit);
        continue;
      }
    }

    if (isGenericActivityTitle(item.title)) {
      continue;
    }

    const fromStore = store?.findBestByName(item.title);
    if (fromStore) {
      resolved.set(i, fromStore);
      continue;
    }

    unresolvedIndices.push(i);
  }

  // Bound live lookups to keep itinerary commit snappy.
  const searchCandidates = unresolvedIndices.slice(0, 6);
  if (searchCandidates.length > 0) {
    await Promise.all(
      searchCandidates.map(async (idx) => {
        const item = items[idx];
        const searchRes = await executeHybridPlaceSearch({
          query: item.title,
          category: toBrowseCategory(item.category),
          limit: 2,
          destinationHint,
          tripId,
          authorization,
          store,
        });
        if (!searchRes.success || searchRes.places.length === 0) return;

        let best: PlaceSearchResult | undefined;
        let bestScore = 0;
        for (const candidate of searchRes.places) {
          const score = computeNameSimilarity(item.title, candidate.name);
          if (score >= 0.65 && score > bestScore) {
            best = candidate;
            bestScore = score;
          }
        }
        if (best) {
          resolved.set(idx, best);
        }
      })
    );
  }

  return resolved;
}
