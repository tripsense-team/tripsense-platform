import type { Place, PlacePhotoEvidence } from "../types";

const approvedMediaHosts = new Set([
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "ziomap-api.socibi.com",
  "res.cloudinary.com",
  "maps.mapvina.com",
]);

export function isApprovedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (approvedMediaHosts.has(host)) return true;
  if (host.endsWith(".googleusercontent.com")) return true;
  return false;
}
const PHOTO_CACHE_MS = 5 * 60_000;
const EMPTY_PHOTO_CACHE_MS = 60_000;

export function approvedPhoto(value: PlacePhotoEvidence | undefined): PlacePhotoEvidence | null {
  if (!value || value.displayApproved !== true || !value.source) return null;
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:" || url.username || url.password || !isApprovedMediaHost(url.hostname)) return null;
    if ([...url.searchParams.keys()].some((key) => /^(key|api_key|token|secret)$/i.test(key))) return null;
    return {
      ...value,
      attribution: Array.isArray(value.attribution) ? value.attribution : [],
    };
  } catch {
    return null;
  }
}

export function approvedPhotoGallery(
  gallery: PlacePhotoEvidence[] | undefined,
  primary: PlacePhotoEvidence | undefined,
  fallbackUrls?: string[]
): PlacePhotoEvidence[] {
  let candidates = gallery?.length ? gallery : primary ? [primary] : [];
  if (!candidates.length && fallbackUrls?.length) {
    candidates = fallbackUrls.map((url) => ({
      url,
      source: "database",
      attribution: [],
      fetchedAt: new Date().toISOString(),
      displayApproved: true,
    }));
  }
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    const photo = approvedPhoto(candidate);
    if (!photo || seen.has(photo.url)) return [];
    seen.add(photo.url);
    return [photo];
  }).slice(0, 5);
}

/** A short-lived, per-page lookup marker; never persists provider media URLs. */
export function hasFreshPhotoLookup(place: Place, checkedAt: number | undefined, now = Date.now()): boolean {
  if (checkedAt === undefined || !Number.isFinite(checkedAt) || checkedAt > now) return false;
  const photos = approvedPhotoGallery(place.photoGallery, place.primaryPhoto);
  const ttl = photos.length ? PHOTO_CACHE_MS : EMPTY_PHOTO_CACHE_MS;
  if (now - checkedAt >= ttl) return false;
  return photos.every((photo) => {
    const fetchedAt = Date.parse(photo.fetchedAt);
    return Number.isFinite(fetchedAt) && fetchedAt <= now && now - fetchedAt < PHOTO_CACHE_MS;
  });
}

export function approvedAttributionUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}
