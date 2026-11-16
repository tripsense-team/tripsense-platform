import {
  getPlaceDetails,
  normalizePlace,
  searchPlaces,
} from "@/features/places/services/places-api";
import type { Place, PlacePhotoEvidence } from "@/features/places/types";
import {
  approvedPhotoGallery,
  hasFreshPhotoLookup,
} from "@/features/places/utils/approved-photo";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import type { ItineraryItemResponse, ItineraryResponse } from "@/features/trip-management/types";
import { getDestinationCenter, isValidCoordinate } from "@/features/trip-management/utils/map";
import { normalizeSearchText } from "@/features/trip-management/utils/search";
import type { PlaceSearchResult, TripActivity } from "@/lib/types";
import type { UIMessage } from "ai";

const NON_PLACE_ACTIVITY_CATEGORIES = new Set(["ACTIVITY", "LOGISTICS"]);

const GENERIC_PLACE_STOPWORDS = new Set([
  "khach san",
  "nha hang",
  "quan an",
  "quan cafe",
  "cafe",
  "ca phe",
  "bai bien",
  "san bay",
  "ga tau",
  "check in",
  "check out",
  "viet nam",
  "vietnam",
]);

/**
 * Grounded place mention candidate used for auto-linking specific place names
 * inside assistant markdown text and resolving clicks.
 */
export interface PlaceMentionTarget {
  id?: string;
  name: string;
  address?: string;
  location?: { lat: number; lng: number };
  photoUrl?: string;
}

/**
 * Unified input accepted by ChatShell's drawer opener across every touchpoint
 * (ZioMap pin, Trip Detail item, AI markdown link, ItineraryPreview, PlaceCards).
 */
export interface OpenPlaceDetailTarget {
  place?: Place;
  item?: ItineraryItemResponse;
  nameHint?: string;
  placeIdHint?: string;
  knownPhotoUrl?: string;
}

const SYNTHETIC_PLACE_ID_PREFIXES = [
  "geo:",
  "msg-place:",
  "dest:",
  "trip-item:",
  "itinerary-item:",
  "tmp-",
];

/**
 * Lookup index built from chat tool results, place snapshots, AI map pins, and
 * the active itinerary. Used on-demand when a user clicks a place to recover
 * its canonical catalog `placeId`, photos, and metadata.
 */
export interface ChatPlaceLookup {
  byId: Map<string, Place>;
  byNormalizedName: Map<string, Place[]>;
  itineraryItemIds: Set<string>;
  sourceOnlyKeys: Set<string>;
}

/**
 * Options for constructing a canonical initial `Place` from a map pin or
 * itinerary item so `PlaceDetailOverlay` can open immediately at 0ms.
 */
export interface CanonicalPlaceInput {
  place?: Place;
  item?: ItineraryItemResponse;
  nameHint?: string;
  placeIdHint?: string;
  knownPhotoUrl?: string;
  lookup?: ChatPlaceLookup;
}

/**
 * Parameters for resolving a synthetic/snapshot place to its canonical catalog
 * ID and hydrating rich details (photos, rating, hours, reviews).
 */
export interface ResolveAndHydrateChatPlaceParams {
  initialPlace: Place;
  destinationHint?: string;
  destinationCenter?: { lat: number; lng: number } | null;
  lookup?: ChatPlaceLookup;
  detailsCache: Map<string, Place>;
  photoCheckedAtCache: Map<string, number>;
  signal?: AbortSignal;
  now?: number;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: string };
  return (
    err.name === "AbortError" ||
    err.name === "CanceledError" ||
    err.code === "ERR_CANCELED"
  );
}

/**
 * Returns true when `id` represents a real Place Service / catalog identifier
 * rather than a synthetic map key (`geo:...`, `msg-place:...`), an itinerary
 * item row UUID, or a local `sourceItemKey`.
 */
export function isRealCatalogPlaceId(
  id: string | null | undefined,
  itineraryItemIds?: ReadonlySet<string>,
  sourceOnlyKeys?: ReadonlySet<string>,
): boolean {
  const trimmed = id?.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (SYNTHETIC_PLACE_ID_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return false;
  }
  if (itineraryItemIds?.has(trimmed)) {
    return false;
  }
  if (sourceOnlyKeys?.has(trimmed)) {
    return false;
  }
  return true;
}

function approxDistanceKm(
  a?: { lat: number; lng: number } | null,
  b?: { lat: number; lng: number } | null,
): number | null {
  if (
    !a ||
    !b ||
    !isValidCoordinate(a.lat, a.lng) ||
    !isValidCoordinate(b.lat, b.lng)
  ) {
    return null;
  }
  const dLat = (a.lat - b.lat) * 111;
  const avgLatRad = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const dLng = (a.lng - b.lng) * 111 * Math.cos(avgLatRad);
  return Math.hypot(dLat, dLng);
}

function dedupePhotos(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    if (!trimmed || !/^https?:\/\//i.test(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function dedupePhotoGallery(
  entries: Array<PlacePhotoEvidence | undefined | null>,
): PlacePhotoEvidence[] {
  const seen = new Set<string>();
  const result: PlacePhotoEvidence[] = [];
  for (const entry of entries) {
    const url = entry?.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(entry!);
  }
  return result;
}

function collectPlacePhotos(place?: Partial<Place> | null): string[] {
  if (!place) return [];
  const approved = approvedPhotoGallery(
    place.photoGallery,
    place.primaryPhoto,
    place.photos,
  );
  const directUrl = getPlacePhotoUrl(place);
  return dedupePhotos([
    ...approved.map((item) => item.url),
    ...(Array.isArray(place.photos) ? place.photos : []),
    place.primaryPhoto?.url,
    directUrl,
  ]);
}

function mergeTwoPlaces(base: Place, incoming: Place): Place {
  const baseIsReal = isRealCatalogPlaceId(base.id);
  const incomingIsReal = isRealCatalogPlaceId(incoming.id);
  const resolvedId = incomingIsReal
    ? incoming.id
    : baseIsReal
      ? base.id
      : incoming.id || base.id;

  const photos = dedupePhotos([
    ...collectPlacePhotos(incoming),
    ...collectPlacePhotos(base),
  ]);

  const photoGallery = dedupePhotoGallery([
    ...(incoming.photoGallery ?? []),
    ...(base.photoGallery ?? []),
  ]);

  const location =
    incoming.location && isValidCoordinate(incoming.location.lat, incoming.location.lng)
      ? incoming.location
      : base.location && isValidCoordinate(base.location.lat, base.location.lng)
        ? base.location
        : incoming.location ?? base.location;

  return {
    ...base,
    ...incoming,
    id: resolvedId,
    providerPlaceId:
      incoming.providerPlaceId ??
      base.providerPlaceId ??
      (incomingIsReal ? incoming.id : undefined),
    name: incoming.name?.trim() || base.name,
    address: incoming.address ?? base.address,
    district: incoming.district ?? base.district,
    city: incoming.city ?? base.city,
    description: incoming.description ?? base.description,
    rating: typeof incoming.rating === "number" ? incoming.rating : base.rating,
    userRatingCount:
      typeof incoming.userRatingCount === "number"
        ? incoming.userRatingCount
        : base.userRatingCount,
    categories:
      Array.isArray(incoming.categories) && incoming.categories.length > 0
        ? incoming.categories
        : base.categories,
    location,
    photos,
    primaryPhoto: incoming.primaryPhoto ?? base.primaryPhoto,
    photoGallery: photoGallery.length > 0 ? photoGallery : undefined,
    phone: incoming.phone ?? base.phone,
    website: incoming.website ?? base.website,
    openingHours: incoming.openingHours ?? base.openingHours,
    reviews:
      Array.isArray(incoming.reviews) && incoming.reviews.length > 0
        ? incoming.reviews
        : base.reviews,
  };
}

function dedupePlainIds(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const val of values) {
    const trimmed = typeof val === "string" ? val.trim() : "";
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function coerceToPlace(raw: Record<string, unknown>): Place | null {
  const rawName =
    typeof raw.name === "string"
      ? raw.name
      : typeof raw.title === "string"
        ? raw.title
        : "";
  const rawId =
    typeof raw.id === "string"
      ? raw.id
      : typeof raw.placeId === "string"
        ? raw.placeId
        : typeof raw.placeRef === "string"
          ? raw.placeRef
          : "";

  if (!rawName.trim() && !rawId.trim()) return null;

  const extraPhoto = typeof raw.photoUrl === "string" ? raw.photoUrl : undefined;
  const rawPhotos = Array.isArray(raw.photos)
    ? raw.photos.filter((p): p is string => typeof p === "string")
    : [];

  const draft: Place = {
    ...(raw as Partial<Place>),
    id: rawId,
    name: rawName,
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter((c): c is string => typeof c === "string")
      : [],
    photos: dedupePhotos([...rawPhotos, extraPhoto]),
  };

  return normalizePlace(draft);
}

function registerLookupPlace(
  lookup: ChatPlaceLookup,
  raw: unknown,
  aliases: Array<string | null | undefined> = [],
): void {
  if (!raw || typeof raw !== "object") return;
  const extraRecord = raw as Record<string, unknown>;
  const normalized = coerceToPlace(extraRecord);
  if (!normalized) return;

  const candidateIds = dedupePlainIds([
    normalized.id,
    normalized.providerPlaceId,
    typeof extraRecord.placeId === "string" ? extraRecord.placeId : undefined,
    typeof extraRecord.placeRef === "string" ? extraRecord.placeRef : undefined,
    ...aliases,
  ]);

  for (const key of candidateIds) {
    const existing = lookup.byId.get(key);
    lookup.byId.set(key, existing ? mergeTwoPlaces(existing, normalized) : normalized);
  }

  const normName = normalizeSearchText(normalized.name || "").trim();
  if (normName) {
    const bucket = lookup.byNormalizedName.get(normName) ?? [];
    const matchIdx = bucket.findIndex((entry) => entry.id === normalized.id);
    if (matchIdx >= 0) {
      bucket[matchIdx] = mergeTwoPlaces(bucket[matchIdx], normalized);
    } else {
      bucket.push(normalized);
    }
    lookup.byNormalizedName.set(normName, bucket);
  }
}

function placeScore(place: Place, targetLocation?: { lat: number; lng: number } | null): number {
  let score = 0;
  if (isRealCatalogPlaceId(place.id)) score += 10;
  if (collectPlacePhotos(place).length > 0) score += 4;
  if (typeof place.rating === "number") score += 2;
  if (place.address) score += 1;

  const dist = approxDistanceKm(place.location, targetLocation);
  if (dist !== null) {
    score -= Math.min(dist, 50) * 0.25;
  }
  return score;
}

/**
 * Builds an in-memory lookup index from assistant message tool results
 * (including `prepareTripCandidates` candidates for click-time resolution only),
 * prefetched `placeSnapshots`, AI map pins, and the persisted itinerary.
 */
export function buildChatPlaceLookup(params: {
  messages?: UIMessage[];
  placeSnapshots?: Record<string, Place>;
  aiMapPlaces?: Place[];
  itinerary?: ItineraryResponse | null;
}): ChatPlaceLookup {
  const lookup: ChatPlaceLookup = {
    byId: new Map(),
    byNormalizedName: new Map(),
    itineraryItemIds: new Set(),
    sourceOnlyKeys: new Set(),
  };

  const { messages = [], placeSnapshots, aiMapPlaces = [], itinerary } = params;

  if (placeSnapshots) {
    for (const [id, snapshot] of Object.entries(placeSnapshots)) {
      registerLookupPlace(lookup, snapshot, [id]);
    }
  }

  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.parts)) continue;
    for (const part of m.parts) {
      const p = part as Record<string, unknown>;
      const invocation = p.toolInvocation as Record<string, unknown> | undefined;
      const res = (p.output ?? p.result ?? invocation?.result) as
        | Record<string, unknown>
        | undefined;
      if (!res || typeof res !== "object") continue;

      for (const arrayKey of ["places", "candidates", "destinations", "items"] as const) {
        const list = res[arrayKey];
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          registerLookupPlace(lookup, entry);
        }
      }

      if (Array.isArray(res.groups)) {
        for (const grp of res.groups) {
          if (!grp || typeof grp !== "object") continue;
          const grpPlaces = (grp as Record<string, unknown>).places;
          if (!Array.isArray(grpPlaces)) continue;
          for (const entry of grpPlaces) {
            registerLookupPlace(lookup, entry);
          }
        }
      }

      if (Array.isArray(res.days)) {
        for (const day of res.days) {
          if (!day || typeof day !== "object") continue;
          const activities = (day as Record<string, unknown>).activities;
          if (!Array.isArray(activities)) continue;
          for (const act of activities) {
            if (!act || typeof act !== "object") continue;
            const actObj = act as Record<string, unknown>;
            const actPlaceId =
              typeof actObj.placeId === "string" ? actObj.placeId.trim() : "";
            const actItemKey =
              typeof actObj.itemKey === "string" ? actObj.itemKey.trim() : "";
            if (!actPlaceId && actItemKey) {
              lookup.sourceOnlyKeys.add(actItemKey);
            }
            registerLookupPlace(
              lookup,
              {
                id: actObj.placeId ?? actObj.id ?? actObj.itemKey,
                providerPlaceId: actObj.placeId,
                name: actObj.title ?? actObj.name,
                address: actObj.address,
                description: actObj.description,
                categories: Array.isArray(actObj.categories)
                  ? actObj.categories
                  : typeof actObj.category === "string"
                    ? [actObj.category]
                    : [],
                rating: actObj.rating,
                userRatingCount: actObj.userRatingCount,
                location: actObj.location,
                photos: actObj.photoUrl ? [actObj.photoUrl] : [],
              },
              [actPlaceId || undefined, actItemKey || undefined],
            );
          }
        }
      }
    }
  }

  for (const mapPlace of aiMapPlaces) {
    registerLookupPlace(lookup, mapPlace);
  }

  if (itinerary?.days) {
    for (const day of itinerary.days) {
      for (const item of day.items ?? []) {
        lookup.itineraryItemIds.add(item.id);
        const realRef = item.placeRef?.trim() || item.placeId?.trim();
        if (!realRef && item.sourceItemKey?.trim()) {
          lookup.sourceOnlyKeys.add(item.sourceItemKey.trim());
        }
      }
    }
  }

  return lookup;
}

function matchLookupPlace(
  lookup: ChatPlaceLookup | undefined,
  hints: {
    candidateIds: Array<string | null | undefined>;
    name?: string | null;
    location?: { lat: number; lng: number } | null;
  },
): Place | null {
  if (!lookup) return null;

  for (const cid of hints.candidateIds) {
    const trimmed = cid?.trim();
    if (!trimmed) continue;
    const hit = lookup.byId.get(trimmed);
    if (hit && isRealCatalogPlaceId(hit.id, lookup.itineraryItemIds, lookup.sourceOnlyKeys)) {
      return hit;
    }
  }

  const normQuery = normalizeSearchText(hints.name || "").trim();
  if (!normQuery) return null;

  const exactBucket = lookup.byNormalizedName.get(normQuery);
  if (exactBucket && exactBucket.length > 0) {
    const sorted = [...exactBucket].sort(
      (a, b) => placeScore(b, hints.location) - placeScore(a, hints.location),
    );
    return sorted[0];
  }

  if (normQuery.length < 4) return null;

  let bestCandidate: Place | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const [normKey, entries] of lookup.byNormalizedName.entries()) {
    if (normKey.length < 4) continue;
    const sharesPrefixOrContains =
      normKey.includes(normQuery) || normQuery.includes(normKey);
    if (!sharesPrefixOrContains) continue;

    for (const entry of entries) {
      const dist = approxDistanceKm(entry.location, hints.location);
      if (dist !== null && dist > 2.5) continue;
      const score = placeScore(entry, hints.location);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = entry;
      }
    }
  }

  return bestCandidate;
}

/**
 * Converts a `PlaceSearchResult` card payload into a canonical catalog `Place`
 * ready for `PlaceDetailOverlay` and `resolveAndHydrateChatPlace`.
 */
export function placeSearchResultToPlace(result: PlaceSearchResult): Place {
  return {
    id: result.id,
    providerPlaceId: result.id,
    name: result.name,
    address: result.address,
    city: result.city,
    phone: result.phone,
    description: result.reason,
    rating: result.rating,
    categories: Array.isArray(result.categories) ? result.categories : [],
    location: result.location,
    photos: dedupePhotos([result.photoUrl]),
  };
}

/**
 * Converts an AI-generated `TripActivity` row from `ItineraryPreview` into an
 * initial `Place` for instant right-drawer display & background hydration.
 */
export function tripActivityToPlace(activity: TripActivity): Place {
  const realId = activity.placeId?.trim();
  const slug =
    normalizeSearchText(activity.title || "").replace(/\s+/g, "-").trim() ||
    activity.itemKey;
  return {
    id: realId || `msg-place:${activity.itemKey}:${slug}`,
    providerPlaceId: realId || undefined,
    name: activity.title,
    address: activity.address,
    description: activity.description,
    categories: activity.category ? [activity.category] : [],
    location: activity.location,
    photos: dedupePhotos([activity.photoUrl]),
  };
}

function isLinkablePlaceName(
  rawName: string | null | undefined,
  excludedSet: ReadonlySet<string>,
): boolean {
  const trimmed = rawName?.trim() || "";
  if (trimmed.length < 4) return false;
  const norm = normalizeSearchText(trimmed).replace(/\s+/g, " ").trim();
  if (!norm || norm.length < 4) return false;
  if (excludedSet.has(norm)) return false;
  if (GENERIC_PLACE_STOPWORDS.has(norm)) return false;
  return true;
}

/**
 * Extracts grounded, specific place mentions from the active chat context so
 * assistant markdown prose can safely link real places without linking city
 * names, generic words, or streaming noise.
 */
export function extractPlaceMentionTargets(params: {
  messages?: UIMessage[];
  placeSnapshots?: Record<string, Place>;
  aiMapPlaces?: Place[];
  itinerary?: ItineraryResponse | null;
  excludedDestinationNames?: ReadonlyArray<string | null | undefined>;
}): PlaceMentionTarget[] {
  const excludedSet = new Set<string>();
  for (const raw of params.excludedDestinationNames ?? []) {
    if (!raw?.trim()) continue;
    for (const part of raw.split(/[,–—|]/)) {
      const norm = normalizeSearchText(part).replace(/\s+/g, " ").trim();
      if (norm) excludedSet.add(norm);
    }
  }

  const byNormName = new Map<string, PlaceMentionTarget>();

  const recordTarget = (candidate: {
    id?: string | null;
    name?: string | null;
    address?: string | null;
    location?: { lat: number; lng: number } | null;
    photoUrl?: string | null;
    category?: string | null;
  }) => {
    if (!isLinkablePlaceName(candidate.name, excludedSet)) return;
    const cat = candidate.category?.toUpperCase().trim();
    const hasCoords = isValidCoordinate(
      candidate.location?.lat,
      candidate.location?.lng,
    );
    const hasRealId = isRealCatalogPlaceId(candidate.id);
    if (cat && NON_PLACE_ACTIVITY_CATEGORIES.has(cat) && !hasRealId && !hasCoords) {
      return;
    }

    const name = candidate.name!.trim();
    const norm = normalizeSearchText(name).replace(/\s+/g, " ").trim();
    const existing = byNormName.get(norm);
    if (!existing) {
      byNormName.set(norm, {
        id: hasRealId ? candidate.id!.trim() : undefined,
        name,
        address: candidate.address?.trim() || undefined,
        location: hasCoords ? candidate.location! : undefined,
        photoUrl: candidate.photoUrl?.trim() || undefined,
      });
      return;
    }

    byNormName.set(norm, {
      id: existing.id || (hasRealId ? candidate.id!.trim() : undefined),
      name: existing.name,
      address: existing.address || candidate.address?.trim() || undefined,
      location: existing.location || (hasCoords ? candidate.location! : undefined),
      photoUrl: existing.photoUrl || candidate.photoUrl?.trim() || undefined,
    });
  };

  const lookup = buildChatPlaceLookup({
    messages: params.messages,
    placeSnapshots: params.placeSnapshots,
    aiMapPlaces: params.aiMapPlaces,
    itinerary: params.itinerary,
  });

  for (const entries of lookup.byNormalizedName.values()) {
    for (const entry of entries) {
      const candidateId = entry.providerPlaceId || entry.id;
      const validId = isRealCatalogPlaceId(
        candidateId,
        lookup.itineraryItemIds,
        lookup.sourceOnlyKeys,
      )
        ? candidateId
        : undefined;
      recordTarget({
        id: validId,
        name: entry.name,
        address: entry.address,
        location: entry.location,
        photoUrl: collectPlacePhotos(entry)[0],
        category: entry.categories?.[0],
      });
    }
  }

  if (params.itinerary?.days) {
    for (const day of params.itinerary.days) {
      for (const item of day.items ?? []) {
        recordTarget({
          id: item.placeRef || item.placeId,
          name: item.placeNameSnapshot || item.title,
          address: item.placeAddressSnapshot,
          location: isValidCoordinate(item.latSnapshot, item.lngSnapshot)
            ? { lat: item.latSnapshot as number, lng: item.lngSnapshot as number }
            : undefined,
          category: item.type,
        });
      }
    }
  }

  return Array.from(byNormName.values()).sort(
    (a, b) => b.name.length - a.name.length,
  );
}

/**
 * Converts a clicked map `Place`, `ItineraryItemResponse`, or markdown place
 * link hint into an initial `Place` whose `id` is normalized to the canonical
 * catalog `placeId` whenever known, ready for instant `PlaceDetailOverlay`.
 */
export function toCanonicalDetailPlace({
  place,
  item,
  nameHint,
  placeIdHint,
  knownPhotoUrl,
  lookup,
}: CanonicalPlaceInput): Place {
  if (place) {
    const candidateIds = [placeIdHint, place.providerPlaceId, place.id];
    const matched = matchLookupPlace(lookup, {
      candidateIds,
      name: place.name || nameHint,
      location: place.location,
    });

    const seed: Place = matched ? mergeTwoPlaces(place, matched) : place;
    const preferredRealId = [
      placeIdHint,
      place.providerPlaceId,
      matched?.providerPlaceId,
      matched?.id,
      seed.id,
    ].find((id) =>
      isRealCatalogPlaceId(id, lookup?.itineraryItemIds, lookup?.sourceOnlyKeys),
    );

    const photos = dedupePhotos([
      knownPhotoUrl,
      ...collectPlacePhotos(seed),
    ]);

    return {
      ...seed,
      id: preferredRealId ?? seed.id,
      providerPlaceId:
        preferredRealId ?? place.providerPlaceId ?? matched?.providerPlaceId,
      photos,
    };
  }

  if (item) {
    const rawItem = item;
    const canonicalRef =
      rawItem.placeRef?.trim() || rawItem.placeId?.trim() || undefined;
    const matched = matchLookupPlace(lookup, {
      candidateIds: [canonicalRef, rawItem.sourceItemKey],
      name: rawItem.placeNameSnapshot || rawItem.title,
      location:
        isValidCoordinate(rawItem.latSnapshot, rawItem.lngSnapshot)
          ? { lat: rawItem.latSnapshot as number, lng: rawItem.lngSnapshot as number }
          : null,
    });

    const baseFromItem: Place = {
      id: canonicalRef || matched?.id || rawItem.id,
      providerPlaceId: canonicalRef || matched?.providerPlaceId,
      name: rawItem.placeNameSnapshot || rawItem.title,
      address: rawItem.placeAddressSnapshot ?? undefined,
      description: rawItem.notes ?? undefined,
      categories: rawItem.type ? [rawItem.type] : [],
      location:
        isValidCoordinate(rawItem.latSnapshot, rawItem.lngSnapshot)
          ? { lat: rawItem.latSnapshot as number, lng: rawItem.lngSnapshot as number }
          : matched?.location,
      photos: dedupePhotos([knownPhotoUrl]),
    };

    const merged = matched ? mergeTwoPlaces(baseFromItem, matched) : baseFromItem;
    const preferredRealId = [
      canonicalRef,
      matched?.providerPlaceId,
      matched?.id,
      merged.id,
    ].find((id) =>
      isRealCatalogPlaceId(id, lookup?.itineraryItemIds, lookup?.sourceOnlyKeys),
    );

    return {
      ...merged,
      id: preferredRealId ?? merged.id,
      providerPlaceId: preferredRealId ?? canonicalRef,
      photos: dedupePhotos([knownPhotoUrl, ...collectPlacePhotos(merged)]),
    };
  }

  const trimmedName = (nameHint || "").trim();
  const trimmedId = (placeIdHint || "").trim();
  const matched = matchLookupPlace(lookup, {
    candidateIds: [trimmedId],
    name: trimmedName,
  });

  if (matched) {
    const photos = dedupePhotos([knownPhotoUrl, ...collectPlacePhotos(matched)]);
    return {
      ...matched,
      name: matched.name || trimmedName,
      photos,
    };
  }

  const fallbackSlug =
    normalizeSearchText(trimmedName).replace(/\s+/g, "-").trim() || "lookup";
  return {
    id: trimmedId || `msg-place:${fallbackSlug}`,
    providerPlaceId: trimmedId || undefined,
    name: trimmedName || trimmedId || "Place",
    categories: [],
    photos: dedupePhotos([knownPhotoUrl]),
  };
}

function hasRichPlaceDetails(place?: Place | null): boolean {
  if (!place) return false;
  return (
    Array.isArray(place.reviews) &&
    (place.openingHours !== undefined || Boolean(place.address)) &&
    collectPlacePhotos(place).length > 0
  );
}

function pickBestSearchMatch(
  candidates: Place[],
  targetName: string,
  targetLocation?: { lat: number; lng: number } | null,
): Place | null {
  if (candidates.length === 0) return null;
  const normTarget = normalizeSearchText(targetName).trim();

  let best: Place | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const normCand = normalizeSearchText(candidate.name || "").trim();
    if (!normCand) continue;

    let matchBonus = 0;
    if (normCand === normTarget) {
      matchBonus = 20;
    } else if (
      normTarget.length >= 4 &&
      normCand.length >= 4 &&
      (normCand.includes(normTarget) || normTarget.includes(normCand))
    ) {
      matchBonus = 8;
    } else {
      continue;
    }

    const dist = approxDistanceKm(candidate.location, targetLocation);
    if (dist !== null && dist > 10) continue;

    const score = matchBonus + placeScore(candidate, targetLocation);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

/**
 * Resolves a synthetic or partially hydrated `initialPlace` to its canonical
 * catalog ID (searching Place Service by name + destination center if needed)
 * and fetches full place details with a 5-minute photo lookup cache.
 * Returns `null` when aborted by a newer selection.
 */
export async function resolveAndHydrateChatPlace({
  initialPlace,
  destinationHint,
  destinationCenter,
  lookup,
  detailsCache,
  photoCheckedAtCache,
  signal,
  now = Date.now(),
}: ResolveAndHydrateChatPlaceParams): Promise<Place | null> {
  if (signal?.aborted) return null;

  let workingPlace = initialPlace;
  let canonicalId = [workingPlace.id, workingPlace.providerPlaceId].find((id) =>
    isRealCatalogPlaceId(id, lookup?.itineraryItemIds, lookup?.sourceOnlyKeys),
  );

  // Fallback text + geo search when the item or AI link only carried a synthetic key
  if (!canonicalId && workingPlace.name.trim()) {
    const fallbackCenter =
      destinationHint?.trim() ? getDestinationCenter(destinationHint) : null;
    const searchLat = isValidCoordinate(
      workingPlace.location?.lat,
      workingPlace.location?.lng,
    )
      ? workingPlace.location?.lat
      : destinationCenter &&
          isValidCoordinate(destinationCenter.lat, destinationCenter.lng)
        ? destinationCenter.lat
        : fallbackCenter?.[1];
    const searchLng = isValidCoordinate(
      workingPlace.location?.lat,
      workingPlace.location?.lng,
    )
      ? workingPlace.location?.lng
      : destinationCenter &&
          isValidCoordinate(destinationCenter.lat, destinationCenter.lng)
        ? destinationCenter.lng
        : fallbackCenter?.[0];

    const query = destinationHint?.trim()
      ? `${workingPlace.name.trim()} ${destinationHint.trim()}`
      : workingPlace.name.trim();

    try {
      const searchResult = await searchPlaces({
        q: query,
        lat: searchLat,
        lng: searchLng,
        limit: 5,
        signal,
      });
      if (signal?.aborted) return null;

      const matched = pickBestSearchMatch(
        searchResult.data ?? [],
        workingPlace.name,
        workingPlace.location ?? destinationCenter,
      );
      if (matched && isRealCatalogPlaceId(matched.id)) {
        canonicalId = matched.id;
        workingPlace = mergeTwoPlaces(workingPlace, matched);
      }
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return null;
    }
  }

  if (!canonicalId) {
    return workingPlace;
  }

  const cached = detailsCache.get(canonicalId);
  const checkedAt = photoCheckedAtCache.get(canonicalId);

  if (cached && hasRichPlaceDetails(cached) && hasFreshPhotoLookup(cached, checkedAt, now)) {
    return mergeTwoPlaces(workingPlace, cached);
  }

  const baseForDetails = cached ? mergeTwoPlaces(workingPlace, cached) : workingPlace;
  const includePhoto = !hasFreshPhotoLookup(baseForDetails, checkedAt, now);

  const validLat = isValidCoordinate(
    baseForDetails.location?.lat,
    baseForDetails.location?.lng,
  )
    ? baseForDetails.location?.lat
    : undefined;
  const validLng = isValidCoordinate(
    baseForDetails.location?.lat,
    baseForDetails.location?.lng,
  )
    ? baseForDetails.location?.lng
    : undefined;

  try {
    const detailResponse = await getPlaceDetails(
      canonicalId,
      baseForDetails.name,
      validLat,
      validLng,
      signal,
      includePhoto,
    );
    if (signal?.aborted) return null;

    const detailed = detailResponse?.data;
    if (!detailed) {
      return baseForDetails;
    }

    if (includePhoto) {
      photoCheckedAtCache.set(canonicalId, Date.now());
    }

    const hydrated = mergeTwoPlaces(baseForDetails, detailed);
    detailsCache.set(canonicalId, hydrated);
    if (hydrated.id && hydrated.id !== canonicalId) {
      detailsCache.set(hydrated.id, hydrated);
    }
    return hydrated;
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) return null;
    return baseForDetails;
  }
}
