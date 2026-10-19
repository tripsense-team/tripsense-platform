import { getPlaceDetails, searchPlaces } from "@/features/places/services/places-api";
import type { Place, PlacePhotoEvidence } from "@/features/places/types";
import { approvedPhotoGallery } from "@/features/places/utils/approved-photo";
import { isSameHotel } from "./hotel-service-adapter";
import type { MindtripHotel } from "../types";

const MAX_CONCURRENT_LOOKUPS = 3;
const PHOTO_CACHE_TTL_MS = 5 * 60_000;
const EMPTY_CACHE_TTL_MS = 30_000;

type PhotoCacheEntry = { photos: PlacePhotoEvidence[]; expiresAt: number };

const cache = new Map<string, PhotoCacheEntry>();
const inFlight = new Map<string, Promise<PlacePhotoEvidence[]>>();
let activeLookups = 0;
const queuedLookups: Array<() => void> = [];

export function getExistingHotelPhotos(hotel: MindtripHotel): PlacePhotoEvidence[] {
  return approvedPhotoGallery(
    hotel.photoGallery,
    hotel.primaryPhoto,
    hotel.photos,
  );
}

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

/** Fetches real, approved photos once per Place ID, with bounded concurrency and short-lived caching. */
export function loadHotelPhotoGallery(
  hotel: MindtripHotel,
): Promise<PlacePhotoEvidence[]> {
  const existing = getExistingHotelPhotos(hotel);
  if (existing.length > 0) return Promise.resolve(existing);

  const cacheKey = hotel.placeId || `hotel:${hotel.id}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.photos);
  if (cached) cache.delete(cacheKey);

  const currentRequest = inFlight.get(cacheKey);
  if (currentRequest) return currentRequest;

  const request = withLookupLimit(async () => {
    try {
      let matchedPlace: Place | undefined;
      let placeId = hotel.placeId;
      if (!placeId) {
        const search = await searchPlaces({ q: hotel.name, category: "STAY", limit: 5 });
        matchedPlace = search.data?.find((candidate) => isSameHotel(
          {
            name: hotel.name,
            destination: hotel.destination,
            city: hotel.city,
            address: hotel.address,
          },
          {
            name: candidate.name,
            destination: candidate.city,
            city: candidate.city,
            address: candidate.address,
          },
        ));
        placeId = matchedPlace?.id;
      }
      if (!placeId) {
        cache.set(cacheKey, { photos: [], expiresAt: Date.now() + EMPTY_CACHE_TTL_MS });
        return [];
      }

      const response = await getPlaceDetails(
        placeId,
        matchedPlace?.name || hotel.name,
        matchedPlace?.location?.lat ?? hotel.location?.lat,
        matchedPlace?.location?.lng ?? hotel.location?.lng,
        undefined,
        true,
      );
      const place = response.data;
      if (!place || place.id !== placeId) {
        cache.set(cacheKey, { photos: [], expiresAt: Date.now() + EMPTY_CACHE_TTL_MS });
        return [];
      }
      const photos = approvedPhotoGallery(
        place?.photoGallery,
        place?.primaryPhoto,
        place?.photos,
      );
      cache.set(cacheKey, {
        photos,
        expiresAt: Date.now() + (photos.length ? PHOTO_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS),
      });
      return photos;
    } catch {
      cache.set(cacheKey, { photos: [], expiresAt: Date.now() + EMPTY_CACHE_TTL_MS });
      return [];
    }
  }).finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, request);
  return request;
}
