import { describe, expect, it, vi, beforeEach } from "vitest";
import { cloneTrip } from "../clone-trip";
import type { ItineraryResponse, TripResponse } from "../../types";
import * as tripApi from "../../services/trip-management-api";

vi.mock("../../services/trip-management-api", () => ({
  createTrip: vi.fn(),
  getItinerary: vi.fn(),
  createItineraryItem: vi.fn(),
}));

describe("cloneTrip Utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sourceTrip: TripResponse = {
    id: "trip-original-1",
    name: "Khám phá Đà Nẵng",
    destinationName: "Đà Nẵng",
    destinationPlaceId: null,
    startDate: "2026-10-20",
    endDate: "2026-10-23",
    travelerCount: 2,
    budgetAmount: 5000000,
    budgetCurrency: "VND",
    notes: "Chuyến đi mẫu",
    status: "CONFIRMED",
    displayStatus: "UPCOMING",
    visibility: "PRIVATE",
    ownerId: "user-1",
    coverImageUrl: null,
    version: 1,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
  };

  const sourceItinerary: ItineraryResponse = {
    tripId: "trip-original-1",
    days: [
      {
        id: "day-orig-1",
        version: 1,
        dayNumber: 1,
        date: "2026-10-20",
        items: [
          {
            id: "item-orig-1",
            dayId: "day-orig-1",
            placeId: null,
            title: "Cầu Rồng",
            startTime: "18:00",
            endTime: "19:00",
            type: "ACTIVITY",
            durationMinutes: 60,
            notes: null,
            status: "PLANNED",
            sortOrder: 1,
            placeNameSnapshot: "Đà Nẵng",
            placeAddressSnapshot: null,
            latSnapshot: null,
            lngSnapshot: null,
            version: 1,
            warnings: [],
          },
        ],
      },
    ],
  };

  it("creates a new cloned trip and populates itinerary items into target days", async () => {
    const mockCreatedTrip: TripResponse = {
      ...sourceTrip,
      id: "trip-cloned-new",
      name: "Khám phá Đà Nẵng (Bản sao)",
    };

    const mockTargetItinerary: ItineraryResponse = {
      tripId: "trip-cloned-new",
      days: [
        {
          id: "day-new-1",
          version: 1,
          date: "2026-10-20",
          dayNumber: 1,
          items: [],
        },
      ],
    };

    vi.mocked(tripApi.createTrip).mockResolvedValueOnce(mockCreatedTrip);
    vi.mocked(tripApi.getItinerary).mockResolvedValueOnce(mockTargetItinerary);
    vi.mocked(tripApi.createItineraryItem).mockResolvedValueOnce({} as any);

    const result = await cloneTrip(
      sourceTrip,
      { newName: "Khám phá Đà Nẵng (Bản sao)" },
      sourceItinerary,
    );

    expect(tripApi.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Khám phá Đà Nẵng (Bản sao)",
        destinationName: "Đà Nẵng",
        travelerCount: 2,
      }),
    );
    expect(tripApi.createItineraryItem).toHaveBeenCalledWith(
      "trip-cloned-new",
      "day-new-1",
      expect.objectContaining({
        title: "Cầu Rồng",
      }),
    );
    expect(result.id).toBe("trip-cloned-new");
  });
});
