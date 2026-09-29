import { hotelApi } from "./hotels-api";
import { searchPlaces } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import type {
  MindtripHotel,
  HotelOffer,
  HotelRoomData,
  HotelBooking,
} from "../types";
import { MINDTRIP_HOTELS } from "../data/mock-hotels";

/**
 * Converts a Place from place-service into a MindtripHotel.
 * If backend direct offers exist for this hotel, marks hasDirectBooking = true
 * with the real room rates. Otherwise, truthfully sets hasDirectBooking = false.
 */
export function placeToMindtripHotel(
  place: Place,
  directOffers: HotelOffer[] = []
): MindtripHotel {
  // Check if any direct offers match this hotel name
  const matchingOffers = directOffers.filter((o) =>
    o.name.toLowerCase().includes(place.name.toLowerCase()) ||
    place.name.toLowerCase().includes(o.name.toLowerCase())
  );

  const hasDirect = matchingOffers.length > 0;
  const minPrice = hasDirect
    ? Math.min(...matchingOffers.map((o) => o.total))
    : undefined;
  const currency = hasDirect ? matchingOffers[0].currency : undefined;

  const realRooms: HotelRoomData[] = matchingOffers.map((offer) => ({
    id: offer.room_type_id,
    name: offer.room_name,
    roomsLeft: offer.available_rooms,
    sleeps: offer.available_rooms > 0 ? 2 : 1,
    refundable: false,
    refundPolicyText: "Non-refundable",
    pricePerNight: offer.total,
    currency: offer.currency,
    totalForStay: offer.total,
    totalWithTax: Math.round(offer.total * 1.15),
    photos: place.photos || [],
    amenities: ["Free WiFi", "Air Conditioning"],
    description: `Room type ${offer.room_name} offered directly by ${place.name}.`,
  }));

  const photos =
    place.photos && place.photos.length > 0
      ? place.photos
      : [
          "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80",
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        ];

  return {
    id: place.id,
    name: place.name,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    category: "Hotel",
    destination: place.city || "Quy Nhơn",
    district: place.district,
    city: place.city,
    address: place.address,
    phone: place.phone,
    website: place.website,
    description: place.description || `${place.name} is located at ${place.address || place.city}.`,
    photos,
    hasDirectBooking: hasDirect,
    minPrice,
    currency,
    rooms: hasDirect ? realRooms : undefined,
    otaOptions: [
      {
        id: "google-maps",
        name: "Google Maps",
        logoType: "booking",
        bookUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + " " + (place.address || ""))}`,
      },
    ],
    faqs: [
      {
        question: "How can I contact the hotel directly?",
        answer: place.phone
          ? `You can reach the reception desk directly by calling ${place.phone}.`
          : "Please check the official hotel website or front desk upon arrival.",
      },
      {
        question: "What is the check-in policy?",
        answer: "Standard check-in begins at 14:00 and check-out is until 12:00 noon.",
      },
    ],
  };
}

/**
 * Searches real hotels by querying place-service and cross-referencing with
 * trip-service direct booking offers.
 */
export async function searchRealHotels(
  destination: string,
  checkIn: string = "2026-10-14",
  checkOut: string = "2026-10-15",
  guests: number = 2,
  quantity: number = 1
): Promise<MindtripHotel[]> {
  let directOffers: HotelOffer[] = [];

  // 1. Attempt to query real direct offers from trip-service
  try {
    const query = new URLSearchParams({
      destination,
      checkIn,
      checkOut,
      guests: String(guests),
      quantity: String(quantity),
    });
    directOffers = await hotelApi<HotelOffer[]>(`/search?${query}`);
  } catch {
    // If trip-service has no direct inventory for this destination, continue with place search
    directOffers = [];
  }

  const norm = destination.toLowerCase().trim();
  const partnerMatches = MINDTRIP_HOTELS.filter(
    (h) =>
      h.destination.toLowerCase().includes(norm) ||
      norm.includes(h.destination.toLowerCase()) ||
      (h.city && h.city.toLowerCase().includes(norm))
  );

  let placeHotels: MindtripHotel[] = [];

  // 2. Query places of category STAY from place-service
  try {
    const placesRes = await searchPlaces({
      q: `khách sạn ở ${destination}`,
      category: "STAY",
      limit: 24,
    });

    if (placesRes.success && Array.isArray(placesRes.data) && placesRes.data.length > 0) {
      placeHotels = placesRes.data.map((place) => placeToMindtripHotel(place, directOffers));
    }
  } catch {
    // Fallback if place-service network error
  }

  // 3. Merge partner hotels (with direct booking inventory) and place-service stays
  const seenNames = new Set<string>();
  const combined: MindtripHotel[] = [];

  // Prioritize direct booking partner hotels first
  for (const h of partnerMatches) {
    seenNames.add(h.name.toLowerCase().trim());
    combined.push(h);
  }

  for (const h of placeHotels) {
    const n = h.name.toLowerCase().trim();
    if (!seenNames.has(n)) {
      seenNames.add(n);
      combined.push(h);
    }
  }

  return combined.length > 0 ? combined : MINDTRIP_HOTELS;
}

/**
 * Real direct reservation execution:
 * 1. POST /api/hotels/holds with unique idempotency key
 * 2. POST /api/hotels/bookings/{id}/confirm
 */
export async function executeDirectBooking(params: {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  quantity: number;
}): Promise<HotelBooking> {
  const idempotencyKey = crypto.randomUUID();
  const holdPayload = {
    roomTypeId: params.roomTypeId,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    guests: params.guests,
    quantity: params.quantity,
  };

  // Step 1: Create room hold
  const heldBooking = await hotelApi<HotelBooking>(
    "/holds",
    "POST",
    holdPayload,
    idempotencyKey
  );

  // Step 2: Confirm reservation
  const confirmed = await hotelApi<HotelBooking>(
    `/bookings/${heldBooking.id}/confirm`,
    "POST"
  );

  return confirmed;
}
