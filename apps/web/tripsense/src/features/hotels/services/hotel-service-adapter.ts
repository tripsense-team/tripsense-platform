import { hotelApi } from "./hotels-api";
import { searchPlaces } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import type {
  MindtripHotel,
  HotelOffer,
  HotelBooking,
} from "../types";

/**
 * Normalizes a hotel or place string for fuzzy comparison by lowercasing,
 * stripping diacritics / accents, and removing punctuation.
 */
export function normalizeHotelString(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Determines whether two hotel representations refer to the same physical establishment.
 * Compares normalized names (with stopwords ignored), name substrings, word overlaps,
 * and street addresses.
 */
export function isSameHotel(
  hotelA: { name: string; destination?: string; city?: string; address?: string },
  hotelB: { name: string; destination?: string; city?: string; address?: string }
): boolean {
  if (!hotelA?.name || !hotelB?.name) return false;

  const normNameA = normalizeHotelString(hotelA.name);
  const normNameB = normalizeHotelString(hotelB.name);

  // Exact normalized name match
  if (normNameA === normNameB) return true;

  // Address check: if both have addresses
  const normAddrA = normalizeHotelString(hotelA.address || "");
  const normAddrB = normalizeHotelString(hotelB.address || "");

  const hasStrongAddressMatch =
    normAddrA.length >= 8 &&
    normAddrB.length >= 8 &&
    (normAddrA.includes(normAddrB) || normAddrB.includes(normAddrA));

  // Extract core title without generic stopwords
  const STOP_WORDS = new Set([
    "khach", "san", "hotel", "resort", "motel", "hostel", "homestay",
    "inn", "the", "villa", "suites", "and", "spa", "boutique", "lodging",
    "da", "nang", "ha", "noi", "sai", "gon", "ho", "chi", "minh"
  ]);

  const stripStopWords = (s: string) =>
    s.split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w)).join(" ");

  const coreA = stripStopWords(normNameA);
  const coreB = stripStopWords(normNameB);

  if (coreA && coreB) {
    if (coreA === coreB) return true;
    if (coreA.length >= 6 && coreB.length >= 6) {
      if (coreA.includes(coreB) || coreB.includes(coreA)) {
        if (normAddrA.length >= 8 && normAddrB.length >= 8 && !hasStrongAddressMatch) {
          const streetWordsA = normAddrA.split(" ").slice(0, 4);
          const streetWordsB = normAddrB.split(" ").slice(0, 4);
          const streetShared = streetWordsA.filter(w => streetWordsB.includes(w) && w.length > 2);
          if (streetShared.length === 0) {
            return false;
          }
        }
        return true;
      }
    }

    const wordsA = coreA.split(" ").filter(w => w.length > 2);
    const wordsB = coreB.split(" ").filter(w => w.length > 2);

    if (wordsA.length >= 2 && wordsB.length >= 2) {
      const common = wordsA.filter(w => wordsB.includes(w));
      const overlapA = common.length / wordsA.length;
      const overlapB = common.length / wordsB.length;
      // High overlap (>= 75% on either side or >= 2 distinctive words with majority match)
      if (common.length >= 2 && (overlapA >= 0.7 || overlapB >= 0.7)) {
        // If addresses both exist, ensure they don't point to completely different streets
        if (normAddrA.length >= 8 && normAddrB.length >= 8 && !hasStrongAddressMatch) {
          const streetWordsA = normAddrA.split(" ").slice(0, 4);
          const streetWordsB = normAddrB.split(" ").slice(0, 4);
          const streetShared = streetWordsA.filter(w => streetWordsB.includes(w) && w.length > 2);
          if (streetShared.length === 0) {
            return false;
          }
        }
        return true;
      }
    }
  }

  // If names didn't match closely enough, but address is an exact match and names share at least 1 key word
  if (hasStrongAddressMatch && coreA && coreB) {
    const wordsA = coreA.split(" ").filter(w => w.length > 2);
    const wordsB = coreB.split(" ").filter(w => w.length > 2);
    if (wordsA.some(w => wordsB.includes(w))) return true;
  }

  return false;
}

/**
 * Converts a Place from place-service into a MindtripHotel.
 */
export function placeToMindtripHotel(place: Place): MindtripHotel {
  return {
    id: place.id,
    name: place.name,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    category: "Hotel",
    destination: place.city || "",
    city: place.city,
    district: place.district,
    address: place.address,
    phone: place.phone,
    website: place.website,
    description: place.description,
    photos: place.photos || [],
    hasDirectBooking: false,
    reviews: place.reviews?.map((r) => ({
      authorName: r.authorName,
      avatarUrl: r.profilePhotoUrl,
      rating: r.rating,
      text: r.text,
    })),
  };
}

/**
 * Fallback hotel images to guarantee no card ever renders a blank or broken frame.
 */
const FALLBACK_HOTEL_PHOTOS = [
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&auto=format&fit=crop&q=80",
];

export function offersToHotel(offers: HotelOffer[], nights: number, quantity = 1): MindtripHotel {
  const first = offers[0];
  return {
    id: first.property_id,
    propertyId: first.property_id,
    name: first.name,
    address: first.address,
    city: first.destination,
    destination: first.destination,
    category: "Hotel",
    photos: FALLBACK_HOTEL_PHOTOS,
    hasDirectBooking: true,
    currency: first.currency,
    pricePerNight: Math.min(...offers.map((o) => o.total)) / nights / quantity,
    rooms: offers.map((o) => ({
      id: o.room_type_id,
      name: o.room_name,
      sleeps: o.capacity,
      roomsLeft: o.available_rooms,
      refundable: o.cancellation_policy === "FREE_BEFORE_CHECK_IN",
      refundPolicyText: o.free_cancellation_until,
      pricePerNight: o.total / nights / quantity,
      totalForStay: o.total,
      totalWithTax: o.total,
      currency: o.currency,
      photos: [] as string[],
      amenities: [] as string[],
    })),
  };
}

/**
 * Searches real hotels by querying place-service and cross-referencing with
 * trip-service direct booking offers.
 *
 * Merges partner offers into matching Place records so that each physical hotel
 * appears exactly once with rich photos, ratings, and active direct booking pricing.
 */
export async function searchRealHotels(
  destination: string,
  checkIn?: string,
  checkOut?: string,
  guests: number = 2,
  quantity: number = 1
): Promise<MindtripHotel[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const effectiveCheckIn = checkIn || toIsoDate(tomorrow);
  const effectiveCheckOut = checkOut || toIsoDate(dayAfter);

  const nights = Math.max(
    Math.round(
      (new Date(effectiveCheckOut).getTime() - new Date(effectiveCheckIn).getTime()) /
        (1000 * 60 * 60 * 24)
    ),
    1
  );

  const query = new URLSearchParams({
    destination: destination || "all",
    checkIn: effectiveCheckIn,
    checkOut: effectiveCheckOut,
    guests: String(guests),
    quantity: String(quantity),
  });

  // 1. Fetch direct booking offers from partner / trip-service
  const directOffers = await hotelApi<HotelOffer[]>(`/search?${query}`).catch(() => []);
  let allOffers: HotelOffer[] = [];
  if (destination !== "all") {
    const allQuery = new URLSearchParams({
      destination: "all",
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
      guests: String(guests),
      quantity: String(quantity),
    });
    allOffers = await hotelApi<HotelOffer[]>(`/search?${allQuery}`).catch(() => []);
  }

  // Pool directOffers and allOffers so that ANY place in the catalog that matches a registered
  // partner hotel will be enriched with active direct booking inventory
  const groupedOffers = new Map<string, HotelOffer[]>();
  for (const offer of directOffers) {
    groupedOffers.set(offer.property_id, [...(groupedOffers.get(offer.property_id) ?? []), offer]);
  }
  for (const offer of allOffers) {
    if (!groupedOffers.has(offer.property_id)) {
      groupedOffers.set(offer.property_id, [offer]);
    }
  }

  // 2. Query places of category STAY from place-service
  let placeHotels: MindtripHotel[] = [];
  try {
    const placesRes = await searchPlaces({
      q: destination && destination !== "all" ? `khách sạn ở ${destination}` : "khách sạn",
      category: "STAY",
      limit: 24,
    });

    if (placesRes.success && Array.isArray(placesRes.data) && placesRes.data.length > 0) {
      placeHotels = placesRes.data.map((place) => placeToMindtripHotel(place));
    }
  } catch {
    // Handled gracefully, returns empty if unavailable
  }

  // 3. Match direct partner offers with place catalog records
  const matchedPropertyIds = new Set<string>();
  const rawMergedHotels: MindtripHotel[] = [];

  for (const placeHotel of placeHotels) {
    let matchedPropOffers: HotelOffer[] | null = null;
    for (const [propId, offers] of groupedOffers.entries()) {
      if (matchedPropertyIds.has(propId)) continue;
      const first = offers[0];
      if (
        isSameHotel(
          { name: first.name, destination: first.destination, address: first.address },
          { name: placeHotel.name, destination: placeHotel.destination, city: placeHotel.city, address: placeHotel.address }
        )
      ) {
        matchedPropOffers = offers;
        matchedPropertyIds.add(propId);
        break;
      }
    }

    if (matchedPropOffers && matchedPropOffers.length > 0) {
      // Unified entry: place photos + ratings + direct booking inventory & rates
      const directData = offersToHotel(matchedPropOffers, nights, quantity);
      rawMergedHotels.push({
        ...placeHotel,
        hasDirectBooking: true,
        propertyId: matchedPropOffers[0].property_id,
        pricePerNight: directData.pricePerNight,
        currency: directData.currency,
        rooms: directData.rooms,
      });
    } else {
      rawMergedHotels.push(placeHotel);
    }
  }

  // 4. Handle remaining partner properties that were not in the top 24 place results
  for (const [propId, offers] of groupedOffers.entries()) {
    if (matchedPropertyIds.has(propId)) continue;
    const first = offers[0];
    if (destination !== "all") {
      const normDest = normalizeHotelString(destination);
      const matchesDest =
        normalizeHotelString(first.destination).includes(normDest) ||
        normDest.includes(normalizeHotelString(first.destination)) ||
        normalizeHotelString(first.address).includes(normDest);
      if (!matchesDest) continue;
    }

    const propHotel = offersToHotel(offers, nights, quantity);

    // Try to enrich catalog metadata from place-service
    try {
      const singleSearch = await searchPlaces({
        q: propHotel.name,
        category: "STAY",
        limit: 1,
      });
      if (singleSearch.success && Array.isArray(singleSearch.data) && singleSearch.data.length > 0) {
        const foundPlace = singleSearch.data[0];
        if (
          isSameHotel(
            { name: propHotel.name, destination: propHotel.destination, address: propHotel.address },
            { name: foundPlace.name, destination: foundPlace.city, address: foundPlace.address }
          )
        ) {
          const placeConverted = placeToMindtripHotel(foundPlace);
          if (placeConverted.photos && placeConverted.photos.length > 0) {
            propHotel.photos = placeConverted.photos;
          }
          if (typeof placeConverted.rating === "number" && placeConverted.rating > 0) {
            propHotel.rating = placeConverted.rating;
            propHotel.reviewCount = placeConverted.reviewCount;
          }
          if (placeConverted.reviews && placeConverted.reviews.length > 0) {
            propHotel.reviews = placeConverted.reviews;
          }
          if (placeConverted.address) propHotel.address = placeConverted.address;
          if (placeConverted.city) propHotel.city = placeConverted.city;
          if (placeConverted.district) propHotel.district = placeConverted.district;
          if (placeConverted.description) propHotel.description = placeConverted.description;
          if (placeConverted.phone) propHotel.phone = placeConverted.phone;
          if (placeConverted.website) propHotel.website = placeConverted.website;
        }
      }
    } catch {
      // Ignored
    }

    rawMergedHotels.push(propHotel);
  }

  // 5. Strict deduplication by normalized hotel name to guarantee no two cards ever appear for the same hotel
  const seenHotelKeys = new Set<string>();
  const deduplicatedHotels: MindtripHotel[] = [];

  for (const h of rawMergedHotels) {
    const key = normalizeHotelString(h.name);
    if (key && seenHotelKeys.has(key)) {
      // If already added, prioritize the version with direct booking
      const existingIdx = deduplicatedHotels.findIndex((item) => normalizeHotelString(item.name) === key);
      if (existingIdx !== -1 && !deduplicatedHotels[existingIdx].hasDirectBooking && h.hasDirectBooking) {
        deduplicatedHotels[existingIdx] = h;
      }
      continue;
    }
    if (key) seenHotelKeys.add(key);
    deduplicatedHotels.push(h);
  }

  // 6. Prioritize directly bookable hotels at the top
  deduplicatedHotels.sort((a, b) => {
    if (a.hasDirectBooking && !b.hasDirectBooking) return -1;
    if (!a.hasDirectBooking && b.hasDirectBooking) return 1;
    return 0;
  });

  return deduplicatedHotels;
}

export type DirectBookingCriteria = {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  quantity: number;
};

export function bookingIntentKey(actorId: string, criteria: DirectBookingCriteria): string {
  const storageKey = "hotel-intent:" + actorId + ":" + JSON.stringify(criteria);
  const existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = crypto.randomUUID();
  sessionStorage.setItem(storageKey, key);
  return key;
}

export function clearBookingIntent(actorId: string, criteria: DirectBookingCriteria) {
  sessionStorage.removeItem("hotel-intent:" + actorId + ":" + JSON.stringify(criteria));
}

/** Hold only. Confirmation is a separate, explicit action after reviewing the server snapshot. */
export async function createDirectHold(params: DirectBookingCriteria, intentKey: string): Promise<HotelBooking> {
  return hotelApi<HotelBooking>("/holds", "POST", params, intentKey);
}

/**
 * For a place shown in the place detail overlay, attempts to find matching
 * direct booking offers from trip-service by searching the place's city/destination
 * and matching by hotel name similarity.
 *
 * Returns an enriched MindtripHotel with hasDirectBooking=true and room data
 * if a match is found; otherwise returns null.
 */
export async function fetchDirectOffersForPlace(
  place: { id: string; name: string; city?: string; district?: string; address?: string },
  checkIn: string,
  checkOut: string,
  guests = 2,
  quantity = 1
): Promise<{ hasDirectBooking: true; propertyId: string; rooms: MindtripHotel["rooms"]; pricePerNight: number; currency: string } | null> {
  try {
    const destination = place.city || place.district || "all";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const toIsoDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const effectiveCheckIn = checkIn || toIsoDate(tomorrow);
    const effectiveCheckOut = checkOut || toIsoDate(dayAfter);

    const nights = Math.max(
      Math.round(
        (new Date(effectiveCheckOut).getTime() - new Date(effectiveCheckIn).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
      1
    );

    const query = new URLSearchParams({
      destination,
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
      guests: String(guests),
      quantity: String(quantity),
    });

    let offers = await hotelApi<HotelOffer[]>(`/search?${query}`).catch(() => [] as HotelOffer[]);
    if ((!offers || offers.length === 0) && destination !== "all") {
      const allQuery = new URLSearchParams({
        destination: "all",
        checkIn: effectiveCheckIn,
        checkOut: effectiveCheckOut,
        guests: String(guests),
        quantity: String(quantity),
      });
      offers = await hotelApi<HotelOffer[]>(`/search?${allQuery}`).catch(() => [] as HotelOffer[]);
    }
    if (!offers || offers.length === 0) return null;

    // Group offers by property_id, then try to find a matching property
    const grouped = new Map<string, HotelOffer[]>();
    for (const offer of offers) grouped.set(offer.property_id, [...(grouped.get(offer.property_id) ?? []), offer]);

    let bestMatch: HotelOffer[] | null = null;
    for (const [, propOffers] of grouped) {
      const first = propOffers[0];
      if (
        isSameHotel(
          { name: first.name, destination: first.destination, address: first.address },
          { name: place.name, destination: place.city, city: place.city, address: place.address }
        )
      ) {
        bestMatch = propOffers;
        break;
      }
    }

    if (!bestMatch) return null;

    const propertyId = bestMatch[0].property_id;
    const rooms = bestMatch.map((o) => ({
      id: o.room_type_id,
      name: o.room_name,
      sleeps: o.capacity,
      roomsLeft: o.available_rooms,
      refundable: o.cancellation_policy === "FREE_BEFORE_CHECK_IN",
      refundPolicyText: o.free_cancellation_until,
      pricePerNight: o.total / nights / quantity,
      totalForStay: o.total,
      totalWithTax: o.total,
      currency: o.currency,
      photos: [] as string[],
      amenities: [] as string[],
    }));
    const pricePerNight = Math.min(...bestMatch.map((o) => o.total)) / nights / quantity;
    const currency = bestMatch[0].currency;

    return { hasDirectBooking: true, propertyId, rooms, pricePerNight, currency };
  } catch {
    return null;
  }
}
