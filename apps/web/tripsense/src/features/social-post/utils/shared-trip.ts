import type { Place } from "@/features/places/types";
import { searchPlaces } from "@/features/places/services/places-api";
import type { SharedTripItineraryDay, SharedTripItineraryItem, SharedTripSummary } from "../types";

export function sharedTripItemCount(days?: SharedTripItineraryDay[] | null) {
  return days?.reduce((total, day) => total + day.items.length, 0) ?? 0;
}

export function sharedTripItems(days?: SharedTripItineraryDay[] | null) {
  return days?.flatMap((day) => day.items.map((item) => ({ ...item, dayNumber: item.dayNumber ?? day.dayNumber }))) ?? [];
}

export function itineraryItemsToPlaces(items: SharedTripItineraryItem[]): Place[] {
  return items
    .filter((item) => item.lat != null && item.lng != null)
    .map((item) => ({
      id: item.placeId || item.id,
      providerPlaceId: item.placeId || undefined,
      name: item.placeName || item.title,
      location: {
        lat: item.lat as number,
        lng: item.lng as number,
      },
      address: item.placeAddress || undefined,
      categories: [item.type.toLowerCase()],
      photos: [],
    }));
}

export async function resolveSharedTripMapPlaces(trip: SharedTripSummary, signal?: AbortSignal): Promise<Place[]> {
  const items = sharedTripItems(trip.itineraryDays);
  const existingPlaces = itineraryItemsToPlaces(items);
  const missingCoordinateItems = items.filter((item) => item.lat == null || item.lng == null);

  if (missingCoordinateItems.length === 0) {
    return existingPlaces;
  }

  const resolved = await Promise.all(
    missingCoordinateItems.slice(0, 8).map(async (item) => {
      const query = [item.placeName || item.title, trip.destinationName].filter(Boolean).join(", ");
      try {
        const response = await searchPlaces({ q: query, limit: 1, signal });
        return response.data[0] ?? null;
      } catch {
        return null;
      }
    })
  );

  return [...existingPlaces, ...resolved.filter((place): place is Place => Boolean(place?.location))];
}
