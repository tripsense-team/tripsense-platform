import type { ItineraryItemType } from "../types";

export interface ItinerarySuggestion {
  title: string;
  type: ItineraryItemType;
  category: string;
  area: string;
  rating: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  imageUrl: string;
}

/**
 * @deprecated Places and itinerary items are now queried directly from ZioMap / Places API via searchPlaces.
 * Mock suggestions have been removed to adhere to the zero-mock requirement.
 */
export function itinerarySuggestions(
  _destination: string,
): ItinerarySuggestion[] {
  return [];
}
