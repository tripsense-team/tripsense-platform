import { getPlaceDetails } from "./places-api";
import type { Place, PlacePhotoEvidence } from "../types";
import {
  freshApprovedPhotoGallery,
  PHOTO_CACHE_MS,
} from "../utils/approved-photo";

const MAX_CONCURRENT_LOOKUPS = 3;
const EMPTY_CACHE_TTL_MS = 30_000;

type PhotoCacheEntry = {
  photos: PlacePhotoEvidence[];
  expiresAt: number;
};

const cache = new Map<string, PhotoCacheEntry>();
const inFlight = new Map<string, Promise<PlacePhotoEvidence[]>>();
const queuedLookups: Array<() => void> = [];
let activeLookups = 0;

async function withLookupLimit<T>(operation: () => Promise<T>): Promise<T> {
  if (activeLookups >= MAX_CONCURRENT_LOOKUPS) {
    await new Promise<void>((resolve) => queuedLookups.push(resolve));
  }
  activeLookups += 1;
  try {
    return await operation();
  } finally {
    activeLookups -= 1;
    queuedLookups.shift()?.();
  }
}

/**
 * Refreshes short-lived provider media for one visible place card.
 * Requests are deduplicated, bounded, and never expose provider credentials.
 */
export function loadPlacePhotoGallery(
  place: Pick<Place, "id" | "name" | "location" | "photos" | "photoGallery" | "primaryPhoto">,
): Promise<PlacePhotoEvidence[]> {
  const existing = freshApprovedPhotoGallery(place);
  if (existing.length > 0) return Promise.resolve(existing);

  const cacheKey = place.id;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.photos);
  }
  if (cached) cache.delete(cacheKey);

  const currentRequest = inFlight.get(cacheKey);
  if (currentRequest) return currentRequest;

  const request = withLookupLimit(async () => {
    try {
      const response = await getPlaceDetails(
        place.id,
        place.name,
        place.location?.lat,
        place.location?.lng,
        undefined,
        true,
      );
      if (!response.data || response.data.id !== place.id) {
        cache.set(cacheKey, {
          photos: [],
          expiresAt: Date.now() + EMPTY_CACHE_TTL_MS,
        });
        return [];
      }
      const photos = freshApprovedPhotoGallery(response.data);
      cache.set(cacheKey, {
        photos,
        expiresAt:
          Date.now() + (photos.length > 0 ? PHOTO_CACHE_MS : EMPTY_CACHE_TTL_MS),
      });
      return photos;
    } catch {
      cache.set(cacheKey, {
        photos: [],
        expiresAt: Date.now() + EMPTY_CACHE_TTL_MS,
      });
      return [];
    }
  }).finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, request);
  return request;
}
