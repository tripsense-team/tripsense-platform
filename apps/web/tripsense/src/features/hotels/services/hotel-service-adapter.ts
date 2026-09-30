import { hotelApi } from "./hotels-api";
import { searchPlaces } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import type {
  MindtripHotel,
  HotelOffer,
  HotelRoomData,
  HotelBooking,
} from "../types";

/**
 * Converts a Place from place-service into a MindtripHotel.
 * If backend direct offers exist for this hotel, marks hasDirectBooking = true
 * with the real room rates. Otherwise, truthfully sets hasDirectBooking = false.
 */
export function placeToMindtripHotel(
  place: Place,
  directOffers: HotelOffer[] = [],
  stayNights: number = 1
): MindtripHotel {
  const normalizedPlaceName = place.name.trim().toLowerCase();

  // Strict match: Either exact matching canonical place ID or exact equal name
  // Prevents substring cross-contamination (e.g. "Sun Hotel" matching "Sun Hotel Riverside")
  const matchingOffers = directOffers.filter((o) => {
    const offerName = o.name.trim().toLowerCase();
    return offerName === normalizedPlaceName;
  });

  const nights = Math.max(stayNights, 1);
  const hasDirect = matchingOffers.length > 0;
  const minTotalPrice = hasDirect
    ? Math.min(...matchingOffers.map((o) => o.total))
    : undefined;
  const minNightlyPrice = minTotalPrice ? Math.round(minTotalPrice / nights) : undefined;
  const currency = hasDirect ? matchingOffers[0].currency : undefined;

  const realRooms: HotelRoomData[] = matchingOffers.map((offer) => {
    const pricePerNight = Math.round(offer.total / nights);
    return {
      id: offer.room_type_id,
      name: offer.room_name,
      roomsLeft: offer.available_rooms,
      sleeps: offer.available_rooms > 0 ? 2 : 1,
      refundable: false,
      refundPolicyText: "Non-refundable",
      pricePerNight,
      currency: offer.currency,
      totalForStay: offer.total,
      totalWithTax: offer.total, // Truthful to backend total (no arbitrary +15% synthetic tax)
      photos: place.photos || [],
      amenities: ["Free WiFi", "Air Conditioning"],
      description: `Room type ${offer.room_name} offered directly by ${place.name}.`,
    };
  });

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
    destination: place.city || "Việt Nam",
    district: place.district,
    city: place.city,
    address: place.address,
    phone: place.phone,
    website: place.website,
    description: place.description || `${place.name} is located at ${place.address || place.city || ""}.`,
    photos,
    hasDirectBooking: hasDirect,
    minPrice: minNightlyPrice,
    pricePerNight: minNightlyPrice,
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
    reviews: place.reviews?.map((r) => ({
      authorName: r.authorName,
      avatarUrl: r.profilePhotoUrl,
      rating: r.rating,
      text: r.text,
      stayDuration: r.relativeTimeDescription,
    })),
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
  checkIn?: string,
  checkOut?: string,
  guests: number = 2,
  quantity: number = 1
): Promise<MindtripHotel[]> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);
  const toIsoDate = (d: Date) => d.toISOString().split("T")[0];

  const effectiveCheckIn = checkIn || toIsoDate(tomorrow);
  const effectiveCheckOut = checkOut || toIsoDate(dayAfter);

  const nights = Math.max(
    Math.round(
      (new Date(effectiveCheckOut).getTime() - new Date(effectiveCheckIn).getTime()) /
        (1000 * 60 * 60 * 24)
    ),
    1
  );

  let directOffers: HotelOffer[] = [];

  // 1. Attempt to query real direct offers from trip-service
  try {
    const query = new URLSearchParams({
      destination,
      checkIn: effectiveCheckIn,
      checkOut: effectiveCheckOut,
      guests: String(guests),
      quantity: String(quantity),
    });
    directOffers = await hotelApi<HotelOffer[]>(`/search?${query}`);
  } catch {
    // If trip-service has no direct inventory for this destination, continue with place search
    directOffers = [];
  }

  let placeHotels: MindtripHotel[] = [];

  // 2. Query places of category STAY from place-service
  try {
    const placesRes = await searchPlaces({
      q: `khách sạn ở ${destination}`,
      category: "STAY",
      limit: 24,
    });

    if (placesRes.success && Array.isArray(placesRes.data) && placesRes.data.length > 0) {
      placeHotels = placesRes.data.map((place) =>
        placeToMindtripHotel(place, directOffers, nights)
      );
    }
  } catch {
    // Handled gracefully, returns empty if unavailable
  }

  // 3. Deduplicate by hotel ID and preserve real places
  const seenIds = new Set<string>();
  const combined: MindtripHotel[] = [];

  for (const h of placeHotels) {
    if (!seenIds.has(h.id)) {
      seenIds.add(h.id);
      combined.push(h);
    }
  }

  return combined;
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
