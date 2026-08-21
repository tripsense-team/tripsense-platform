import type { Place } from "../types";

/**
 * Returns the exact photo URL returned by ZioMap/Google Places API.
 * If the place has no photo provided by the API, returns null (no mock photos).
 */
export function getPlacePhotoUrl(place: Partial<Place>): string | null {
  if (place.photos && place.photos.length > 0) {
    const first = place.photos[0];
    if (typeof first === "string" && (first.startsWith("http://") || first.startsWith("https://"))) {
      return first;
    }
  }
  return null;
}

/**
 * Returns list of direct photo URLs from the API.
 * Never generates synthetic or mock image URLs.
 */
export function getPlaceGalleryPhotos(place: Partial<Place>): string[] {
  if (!place.photos || !Array.isArray(place.photos)) {
    return [];
  }
  return place.photos.filter(
    (p) => typeof p === "string" && (p.startsWith("http://") || p.startsWith("https://"))
  );
}
