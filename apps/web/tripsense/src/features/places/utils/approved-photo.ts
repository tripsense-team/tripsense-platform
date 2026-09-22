import type { Place, PlacePhotoEvidence } from "../types";

const approvedMediaHosts = new Set([
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "ziomap-api.socibi.com",
  "images.unsplash.com",
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

export const FALLBACK_PLACE_PHOTOS: PlacePhotoEvidence[] = [
  {
    url: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Cầu Rồng & Thành phố Đà Nẵng", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
  {
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Bãi biển Mỹ Khê & Bờ biển", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
  {
    url: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Di sản & Chùa Linh Ứng", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
  {
    url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Ngũ Hành Sơn & Thiên nhiên", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
  {
    url: "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Ẩm thực & Quán ăn địa phương", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
  {
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Chợ Hàn & Phố đêm khám phá", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
  {
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=640&q=80",
    source: "TripSense Curated",
    attribution: [{ displayName: "Điểm đến du lịch Việt Nam", uri: "https://unsplash.com" }],
    fetchedAt: "2026-09-20T00:00:00Z",
    displayApproved: true,
  },
];

export function getFallbackPlacePhoto(name = "", category = ""): PlacePhotoEvidence {
  const text = `${name} ${category}`.toLowerCase();
  if (/biển|bãi|beach|sea|đảo|ocean|mỹ khê/i.test(text)) return FALLBACK_PLACE_PHOTOS[1];
  if (/chùa|temple|pagoda|linh ứng|tháp|nhà thờ|di tích|lăng|heritage/i.test(text)) return FALLBACK_PLACE_PHOTOS[2];
  if (/núi|hills|bà nà|sơn trà|đèo|hải vân|ngũ hành sơn|rừng|nature/i.test(text)) return FALLBACK_PLACE_PHOTOS[3];
  if (/ăn|quán|cà phê|cafe|coffee|bún|phở|mì|mỳ|cao lầu|cơm|bánh|lẩu|restaurant|food|ẩm thực/i.test(text)) return FALLBACK_PLACE_PHOTOS[4];
  if (/chợ|market|phố|đêm|mua sắm|shop/i.test(text)) return FALLBACK_PLACE_PHOTOS[5];
  if (/cầu\b|bridge|rồng|sông hàn|sông\b/i.test(text)) return FALLBACK_PLACE_PHOTOS[0];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PLACE_PHOTOS[hash % FALLBACK_PLACE_PHOTOS.length];
}

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
