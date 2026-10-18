import {
  createItineraryItem,
  createTrip,
  getItinerary,
} from "../services/trip-management-api";
import type { ItineraryResponse, TripResponse } from "../types";

export interface CloneTripOptions {
  newName: string;
  startDate?: string;
  endDate?: string;
}

export async function cloneTrip(
  sourceTrip: TripResponse,
  options: CloneTripOptions,
  sourceItinerary?: ItineraryResponse | null,
): Promise<TripResponse> {
  // 1. Create the new cloned trip
  const createdTrip = await createTrip({
    name: options.newName.trim(),
    destinationName: sourceTrip.destinationName,
    startDate: options.startDate || sourceTrip.startDate,
    endDate: options.endDate || sourceTrip.endDate,
    travelerCount: sourceTrip.travelerCount,
    budgetAmount: sourceTrip.budgetAmount,
    budgetCurrency: sourceTrip.budgetCurrency,
    notes: sourceTrip.notes
      ? `Bản sao từ "${sourceTrip.name}".\n${sourceTrip.notes}`
      : `Bản sao từ "${sourceTrip.name}".`,
  });

  // 2. Fetch or reuse source itinerary
  let itineraryToCopy = sourceItinerary;
  if (!itineraryToCopy && sourceTrip.id) {
    try {
      itineraryToCopy = await getItinerary(sourceTrip.id);
    } catch {
      // If unable to fetch source itinerary, return created trip as-is
      return createdTrip;
    }
  }

  // 3. Populate activities into the new trip's initial itinerary
  if (itineraryToCopy?.days && itineraryToCopy.days.length > 0) {
    try {
      const newItinerary = await getItinerary(createdTrip.id);

      for (let dIdx = 0; dIdx < itineraryToCopy.days.length; dIdx++) {
        const sourceDay = itineraryToCopy.days[dIdx];
        const targetDay = newItinerary.days[dIdx] || newItinerary.days[0];
        if (!targetDay) continue;

        for (const item of sourceDay.items) {
          try {
            await createItineraryItem(createdTrip.id, targetDay.id, {
              title: item.title,
              type: item.type,
              placeId: item.placeId,
              placeRef: item.placeId,
              startTime: item.startTime,
              endTime: item.endTime,
              durationMinutes: item.durationMinutes,
              notes: item.notes,
            });
          } catch {
            // Continue copying remaining items
          }
        }
      }
    } catch {
      // Ignore background item population failure
    }
  }

  return createdTrip;
}
