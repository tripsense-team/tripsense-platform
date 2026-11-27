import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTripCoverPhotoCache,
  pickCoverCandidatePlaceKeys,
  useTripCoverPhotos,
} from "../use-trip-cover-photos";
import type { ItineraryResponse, TripResponse } from "../../types";

const mockGetItinerary = vi.fn();
const mockGetPlaceBatchSnapshots = vi.fn();
const mockSearchPlaces = vi.fn();

vi.mock("../../services/trip-management-api", () => ({
  getItinerary: (...args: unknown[]) => mockGetItinerary(...args),
}));

vi.mock("@/features/places/services/places-api", () => ({
  getPlaceBatchSnapshots: (...args: unknown[]) =>
    mockGetPlaceBatchSnapshots(...args),
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
}));

function makeTrip(overrides: Partial<TripResponse> = {}): TripResponse {
  return {
    id: "trip-1",
    name: "Lịch trình chuyến đi",
    destinationName: "Đà Nẵng",
    destinationPlaceId: null,
    startDate: "2026-12-24",
    endDate: "2026-12-25",
    status: "DRAFT",
    displayStatus: "UPCOMING",
    ownerId: "user-1",
    travelerCount: 2,
    budgetAmount: 2000000,
    budgetCurrency: "VND",
    notes: null,
    coverImageUrl: null,
    visibility: "PRIVATE",
    version: 1,
    aggregateRevision: 3,
    createdAt: "2026-11-26T16:00:00Z",
    updatedAt: "2026-11-26T16:00:00Z",
    ...overrides,
  };
}

function makeItinerary(
  items: Array<{
    id: string;
    title: string;
    type: ItineraryResponse["days"][number]["items"][number]["type"];
    placeRef?: string | null;
  }>,
): ItineraryResponse {
  return {
    tripId: "trip-1",
    revision: 3,
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        date: "2026-12-24",
        version: 1,
        items: items.map((item, idx) => ({
          id: item.id,
          dayId: "day-1",
          placeId: null,
          placeRef: item.placeRef ?? null,
          title: item.title,
          type: item.type,
          startTime: "09:00",
          endTime: "10:00",
          durationMinutes: 60,
          sortOrder: idx,
          status: "PLANNED",
          notes: null,
          placeNameSnapshot: item.title,
          placeAddressSnapshot: null,
          latSnapshot: null,
          lngSnapshot: null,
          version: 1,
          warnings: [],
        })),
      },
    ],
  };
}

describe("useTripCoverPhotos", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    clearTripCoverPhotoCache();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("orders scenic PLACE/ACTIVITY place refs ahead of HOTEL/MEAL", () => {
    const itinerary = makeItinerary([
      { id: "i1", title: "Hotel", type: "HOTEL", placeRef: "p-hotel" },
      { id: "i2", title: "Food", type: "MEAL", placeRef: "p-food" },
      {
        id: "i3",
        title: "Ngũ Hành Sơn",
        type: "PLACE",
        placeRef: "p-attraction",
      },
      {
        id: "i4",
        title: "Snorkeling",
        type: "ACTIVITY",
        placeRef: "p-activity",
      },
    ]);

    expect(pickCoverCandidatePlaceKeys(itinerary)).toEqual([
      "p-attraction",
      "p-activity",
      "p-hotel",
      "p-food",
    ]);
  });

  it("resolves a real place photo from itinerary items and skips trips with custom coverImageUrl", async () => {
    const tripWithoutCover = makeTrip({ id: "trip-a", coverImageUrl: null });
    const tripWithCustomCover = makeTrip({
      id: "trip-b",
      coverImageUrl: "https://res.cloudinary.com/demo/custom-cover.jpg",
    });

    mockGetItinerary.mockResolvedValue(
      makeItinerary([
        {
          id: "item-1",
          title: "Trình cà phê",
          type: "MEAL",
          placeRef: "place-cafe",
        },
        {
          id: "item-2",
          title: "Ngũ Hành Sơn",
          type: "PLACE",
          placeRef: "place-nhs",
        },
      ]),
    );
    mockGetPlaceBatchSnapshots.mockResolvedValue({
      "place-nhs": {
        id: "place-nhs",
        name: "Ngũ Hành Sơn",
        primaryPhoto: { url: "https://res.cloudinary.com/demo/nhs.jpg" },
      },
      "place-cafe": {
        id: "place-cafe",
        name: "Trình cà phê",
        primaryPhoto: { url: "https://res.cloudinary.com/demo/cafe.jpg" },
      },
    });

    let latest: Record<string, string> = {};
    function Harness({ trips }: { trips: TripResponse[] }) {
      latest = useTripCoverPhotos(trips);
      return null;
    }

    await act(async () => {
      root.render(
        <Harness trips={[tripWithoutCover, tripWithCustomCover]} />,
      );
    });

    expect(mockGetItinerary).toHaveBeenCalledTimes(1);
    expect(mockGetItinerary).toHaveBeenCalledWith("trip-a");
    expect(mockGetPlaceBatchSnapshots).toHaveBeenCalledWith(
      ["place-nhs", "place-cafe"],
      true,
      expect.any(AbortSignal),
    );
    expect(latest["trip-a"]).toBe("https://res.cloudinary.com/demo/nhs.jpg");
    expect(latest["trip-b"]).toBeUndefined();
  });
});
