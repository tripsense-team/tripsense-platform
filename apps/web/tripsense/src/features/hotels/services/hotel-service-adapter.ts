import { hotelApi } from "./hotels-api";
import { searchPlaces } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import type {
  MindtripHotel,
  HotelOffer,
  HotelBooking,
} from "../types";

/**
 * Converts a Place from place-service into a MindtripHotel.
 * If backend direct offers exist for this hotel, marks hasDirectBooking = true
 * with the real room rates. Otherwise, truthfully sets hasDirectBooking = false.
 */
export function placeToMindtripHotel(place: Place): MindtripHotel {
  return {id:place.id,name:place.name,rating:place.rating,reviewCount:place.userRatingCount,
    category:"Hotel",destination:place.city || "",city:place.city,district:place.district,
    address:place.address,phone:place.phone,website:place.website,description:place.description,
    photos:place.photos || [],hasDirectBooking:false,
    reviews:place.reviews?.map(r=>({authorName:r.authorName,avatarUrl:r.profilePhotoUrl,rating:r.rating,text:r.text})),
  };
}

/**
 * Searches real hotels by querying place-service and cross-referencing with
 * trip-service direct booking offers.
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
  const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

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
  const directOffers = await hotelApi<HotelOffer[]>(`/search?${query}`).catch(() => []);

  let placeHotels: MindtripHotel[] = [];

  // 2. Query places of category STAY from place-service
  try {
    const placesRes = await searchPlaces({
      q: destination && destination !== "all" ? `khách sạn ở ${destination}` : "khách sạn",
      category: "STAY",
      limit: 24,
    });

    if (placesRes.success && Array.isArray(placesRes.data) && placesRes.data.length > 0) {
      placeHotels = placesRes.data.map((place) =>
        placeToMindtripHotel(place)
      );
    }
  } catch {
    // Handled gracefully, returns empty if unavailable
  }

  // 3. Deduplicate by hotel ID and preserve real places
  const seenIds = new Set<string>();
  const grouped = new Map<string, HotelOffer[]>();
  for (const offer of directOffers) grouped.set(offer.property_id,[...(grouped.get(offer.property_id) ?? []),offer]);
  const combined: MindtripHotel[] = [...grouped.values()].map(offers => offersToHotel(offers,nights,quantity));
  for (const c of combined) seenIds.add(c.id);

  for (const h of placeHotels) {
    if (!seenIds.has(h.id)) {
      seenIds.add(h.id);
      combined.push(h);
    }
  }

  return combined;
}

export function offersToHotel(offers: HotelOffer[], nights: number, quantity = 1): MindtripHotel {
  const first=offers[0];
  return {
    id:first.property_id,name:first.name,address:first.address,city:first.destination,
    destination:first.destination,category:"Hotel",photos:[],hasDirectBooking:true,
    currency:first.currency,pricePerNight:Math.min(...offers.map(o=>o.total))/nights/quantity,
    rooms:offers.map(o=>({id:o.room_type_id,name:o.room_name,sleeps:o.capacity,
      roomsLeft:o.available_rooms,refundable:o.cancellation_policy === "FREE_BEFORE_CHECK_IN",
      refundPolicyText:o.free_cancellation_until,pricePerNight:o.total/nights/quantity,
      totalForStay:o.total,totalWithTax:o.total,currency:o.currency,photos:[],amenities:[]})),
  };
}

export type DirectBookingCriteria = {
  roomTypeId:string; checkIn:string; checkOut:string; guests:number; quantity:number;
};

export function bookingIntentKey(actorId:string,criteria:DirectBookingCriteria):string {
  const storageKey="hotel-intent:"+actorId+":"+JSON.stringify(criteria);
  const existing=sessionStorage.getItem(storageKey);
  if(existing) return existing;
  const key=crypto.randomUUID(); sessionStorage.setItem(storageKey,key); return key;
}

export function clearBookingIntent(actorId:string,criteria:DirectBookingCriteria) {
  sessionStorage.removeItem("hotel-intent:"+actorId+":"+JSON.stringify(criteria));
}

/** Hold only. Confirmation is a separate, explicit action after reviewing the server snapshot. */
export async function createDirectHold(params:DirectBookingCriteria,intentKey:string):Promise<HotelBooking> {
  return hotelApi<HotelBooking>("/holds","POST",params,intentKey);
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
  place: { id: string; name: string; city?: string; district?: string },
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
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

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

    const offers = await hotelApi<HotelOffer[]>(`/search?${query}`).catch(() => [] as HotelOffer[]);
    if (!offers || offers.length === 0) return null;

    // Normalise name for fuzzy match: lower, strip diacritics where possible
    const normalizeName = (s: string) =>
      s.toLowerCase().replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
        .replace(/[èéẹẻẽêềếệểễ]/g, "e")
        .replace(/[ìíịỉĩ]/g, "i")
        .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
        .replace(/[ùúụủũưừứựửữ]/g, "u")
        .replace(/[ỳýỵỷỹ]/g, "y")
        .replace(/[đ]/g, "d")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ").trim();

    const placeNorm = normalizeName(place.name);

    // Group offers by property_id, then try to find a matching property
    const grouped = new Map<string, HotelOffer[]>();
    for (const offer of offers) grouped.set(offer.property_id, [...(grouped.get(offer.property_id) ?? []), offer]);

    let bestMatch: HotelOffer[] | null = null;
    for (const [, propOffers] of grouped) {
      const offerNorm = normalizeName(propOffers[0].name);
      // Accept if name contains significant words in common (>=2 words or exact substring)
      const placeWords = placeNorm.split(" ").filter(w => w.length > 2);
      const matchedWords = placeWords.filter(w => offerNorm.includes(w));
      if (matchedWords.length >= 2 || offerNorm.includes(placeNorm) || placeNorm.includes(offerNorm)) {
        bestMatch = propOffers;
        break;
      }
    }

    if (!bestMatch) return null;

    const propertyId = bestMatch[0].property_id;
    const rooms = bestMatch.map(o => ({
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
    const pricePerNight = Math.min(...bestMatch.map(o => o.total)) / nights / quantity;
    const currency = bestMatch[0].currency;

    return { hasDirectBooking: true, propertyId, rooms, pricePerNight, currency };
  } catch {
    return null;
  }
}
