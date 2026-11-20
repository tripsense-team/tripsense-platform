import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  calculateSegmentDistance,
  MindtripItineraryView,
} from "../mindtrip-itinerary-view";
import type { ItineraryResponse, TripResponse } from "../../types";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "vi",
    t: (key: string) => key,
  }),
}));

vi.mock("@/features/places/services/places-api", () => ({
  getPlaceBatchSnapshots: vi.fn().mockResolvedValue({}),
  searchPlaces: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

const sampleTrip: TripResponse = {
  id: "trip-dn",
  name: "Trip to Da Nang",
  destinationName: "Da Nang",
  startDate: "2026-11-26",
  endDate: "2026-11-28",
  travelerCount: 2,
  budgetAmount: 3000000,
  budgetCurrency: "VND",
  notes: null,
  status: "DRAFT",
  visibility: "PRIVATE",
  ownerId: "user-1",
  createdAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
} as unknown as TripResponse;

const sampleItinerary: ItineraryResponse = {
  tripId: "trip-dn",
  revision: 5,
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2026-11-26",
      version: 1,
      items: [
        {
          id: "item-afternoon",
          dayId: "day-1",
          placeId: null,
          placeRef: "place-marble",
          type: "ACTIVITY",
          title: "The Marble Mountains",
          startTime: "13:00:00",
          endTime: "15:00:00",
          durationMinutes: 120,
          notes: null,
          status: "PLANNED",
          sortOrder: 100,
          placeNameSnapshot: "The Marble Mountains",
          placeAddressSnapshot: "Ngũ Hành Sơn, Đà Nẵng",
          latSnapshot: 16.0033,
          lngSnapshot: 108.2633,
          version: 1,
          warnings: [],
        },
        {
          id: "item-morning",
          dayId: "day-1",
          placeId: null,
          placeRef: "place-mykhe",
          type: "PLACE",
          title: "My Khe Beach",
          startTime: "09:00:00",
          endTime: "11:00:00",
          durationMinutes: 120,
          notes: null,
          status: "PLANNED",
          sortOrder: 200,
          placeNameSnapshot: "My Khe Beach",
          placeAddressSnapshot: "Sơn Trà, Đà Nẵng",
          latSnapshot: 16.0598,
          lngSnapshot: 108.2478,
          version: 1,
          warnings: [],
        },
      ],
    },
  ],
};

describe("MindtripItineraryView", () => {
  it("formats segment distances in km for vi and miles for en", () => {
    const viDist = calculateSegmentDistance(16.0598, 108.2478, 16.0033, 108.2633, "vi");
    const enDist = calculateSegmentDistance(16.0598, 108.2478, 16.0033, 108.2633, "en");
    expect(viDist).toMatch(/km$/);
    expect(enDist).toMatch(/mi$/);
    expect(calculateSegmentDistance(null, 108.2, 16.0, 108.2, "vi")).toBeNull();
  });

  it("renders distance connectors and hides them when Distances switch is toggled off", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MindtripItineraryView
          trip={sampleTrip}
          itinerary={sampleItinerary}
          photoUrls={{}}
          onReorderItems={vi.fn()}
          onUpdateItemTime={vi.fn()}
        />,
      );
    });

    expect(
      container.querySelectorAll('[data-testid="itinerary-distance-connector"]').length,
    ).toBe(1);

    const switchBtn = container.querySelector('[role="switch"]') as HTMLButtonElement | null;
    expect(switchBtn).not.toBeNull();

    await act(async () => {
      switchBtn?.click();
    });

    expect(
      container.querySelectorAll('[data-testid="itinerary-distance-connector"]').length,
    ).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("invokes onReorderItems with chronologically sorted IDs and preserveTimes=true", async () => {
    const onReorderItems = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MindtripItineraryView
          trip={sampleTrip}
          itinerary={sampleItinerary}
          photoUrls={{}}
          onReorderItems={onReorderItems}
          onUpdateItemTime={vi.fn()}
        />,
      );
    });

    const sortBtn = container.querySelector(
      '[data-testid="sort-day-by-time-day-1"]',
    ) as HTMLButtonElement | null;
    expect(sortBtn).not.toBeNull();

    await act(async () => {
      sortBtn?.click();
    });

    expect(onReorderItems).toHaveBeenCalledTimes(1);
    expect(onReorderItems).toHaveBeenCalledWith(
      sampleItinerary.days[0],
      ["item-morning", "item-afternoon"],
      { preserveTimes: true },
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("hides editing and sorting controls in read-only mode (canEdit=false)", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MindtripItineraryView
          trip={sampleTrip}
          itinerary={sampleItinerary}
          photoUrls={{}}
          canEdit={false}
          onReorderItems={vi.fn()}
          onUpdateItemTime={vi.fn()}
        />,
      );
    });

    expect(
      container.querySelector('[data-testid="sort-day-by-time-day-1"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="edit-time-trigger-item-morning"]'),
    ).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
