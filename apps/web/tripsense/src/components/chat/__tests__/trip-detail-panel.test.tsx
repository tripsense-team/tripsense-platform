import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveInstantPhoto,
  resolveItemPlaceKey,
  TripDetailPanel,
} from "../trip-detail-panel";
import type { ItineraryResponse, TripResponse } from "@/features/trip-management/types";

const mockGetItinerary = vi.fn();
const mockGetPlaceBatchSnapshots = vi.fn();
const mockSearchPlaces = vi.fn();

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    locale: "vi",
    t: (key: string) => key,
  }),
}));

vi.mock("@/features/trip-management/components/trip-members-dialog", () => ({
  TripMembersDialog: () => null,
}));

vi.mock("@/features/trip-management/services/trip-management-api", () => ({
  getItinerary: (...args: unknown[]) => mockGetItinerary(...args),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  deleteItineraryItem: vi.fn(),
}));

vi.mock("@/features/places/services/places-api", () => ({
  getPlaceBatchSnapshots: (...args: unknown[]) => mockGetPlaceBatchSnapshots(...args),
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
}));

const sampleTrip: TripResponse = {
  id: "trip-1",
  name: "Chuyến đi Đà Nẵng",
  destinationName: "Đà Nẵng",
  startDate: "2026-12-16",
  endDate: "2026-12-18",
  travelerCount: 1,
  budgetAmount: null,
  budgetCurrency: null,
  notes: null,
  status: "DRAFT",
  visibility: "PRIVATE",
  ownerId: "user-1",
  createdAt: "2026-11-14T00:00:00Z",
  updatedAt: "2026-11-14T00:00:00Z",
} as unknown as TripResponse;

const sampleItinerary: ItineraryResponse = {
  tripId: "trip-1",
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      date: "2026-12-16",
      version: 1,
      items: [
        {
          id: "item-linh-ung",
          dayId: "day-1",
          placeId: null,
          placeRef: "place-linh-ung",
          sourceItemKey: "key-linh-ung",
          type: "PLACE",
          title: "Cổng Chùa Linh Ứng",
          startTime: "08:30:00",
          endTime: "11:00:00",
          durationMinutes: 150,
          notes: null,
          status: "PLANNED",
          sortOrder: 100,
          placeNameSnapshot: "Cổng Chùa Linh Ứng",
          placeAddressSnapshot: "Sơn Trà, Đà Nẵng",
          latSnapshot: null,
          lngSnapshot: null,
          version: 1,
          warnings: [],
        },
        {
          id: "item-ngu-hanh-son",
          dayId: "day-1",
          placeId: null,
          placeRef: "place-ngu-hanh-son",
          sourceItemKey: "key-nhs",
          type: "PLACE",
          title: "Ngũ Hành Sơn",
          startTime: "14:00:00",
          endTime: "16:30:00",
          durationMinutes: 150,
          notes: null,
          status: "PLANNED",
          sortOrder: 200,
          placeNameSnapshot: "Ngũ Hành Sơn",
          placeAddressSnapshot: "Ngũ Hành Sơn, Đà Nẵng",
          latSnapshot: null,
          lngSnapshot: null,
          version: 1,
          warnings: [],
        },
      ],
    },
  ],
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("TripDetailPanel canonical photo resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetItinerary.mockResolvedValue(sampleItinerary);
    mockSearchPlaces.mockResolvedValue({ success: true, data: [] });
  });

  it("prefers placeRef over null placeId and matches instant photos by placeRef or sourceItemKey", () => {
    expect(resolveItemPlaceKey({ placeId: null, placeRef: " place-ref-1 " })).toBe("place-ref-1");
    expect(resolveItemPlaceKey({ placeId: "uuid-1", placeRef: null })).toBe("uuid-1");
    expect(
      resolveInstantPhoto(
        { placeId: null, placeRef: "place-linh-ung", sourceItemKey: "k1" },
        { "place-linh-ung": "https://res.cloudinary.com/demo/linh-ung.jpg" },
      ),
    ).toBe("https://res.cloudinary.com/demo/linh-ung.jpg");
    expect(
      resolveInstantPhoto(
        { placeId: null, placeRef: null, sourceItemKey: "k1" },
        { k1: "https://res.cloudinary.com/demo/item-key.jpg" },
      ),
    ).toBe("https://res.cloudinary.com/demo/item-key.jpg");
  });

  it("uses batch-snapshots with item.placeRef (avoiding searchPlaces fallback) when placeId is null", async () => {
    mockGetPlaceBatchSnapshots.mockResolvedValue({
      "place-linh-ung": {
        id: "place-linh-ung",
        name: "Cổng Chùa Linh Ứng",
        primaryPhoto: { url: "https://res.cloudinary.com/demo/linh-ung.jpg" },
      },
      "place-ngu-hanh-son": {
        id: "place-ngu-hanh-son",
        name: "Ngũ Hành Sơn",
        primaryPhoto: { url: "https://res.cloudinary.com/demo/nhs.jpg" },
      },
    });

    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<TripDetailPanel trip={sampleTrip} onClose={vi.fn()} />);
    });
    await flushEffects();

    expect(mockGetPlaceBatchSnapshots).toHaveBeenCalledTimes(1);
    expect(mockGetPlaceBatchSnapshots.mock.calls[0][0]).toEqual([
      "place-linh-ung",
      "place-ngu-hanh-son",
    ]);
    expect(mockGetPlaceBatchSnapshots.mock.calls[0][1]).toBe(true);
    expect(mockSearchPlaces).not.toHaveBeenCalled();

    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.map((img) => img.getAttribute("src"))).toEqual([
      "https://res.cloudinary.com/demo/linh-ung.jpg",
      "https://res.cloudinary.com/demo/nhs.jpg",
    ]);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders knownPlacePhotos immediately at 0ms and skips redundant batch-snapshots calls", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TripDetailPanel
          trip={sampleTrip}
          knownPlacePhotos={{
            "place-linh-ung": "https://res.cloudinary.com/demo/chat-linh-ung.jpg",
            "key-nhs": "https://res.cloudinary.com/demo/chat-nhs.jpg",
          }}
          onClose={vi.fn()}
        />,
      );
    });
    await flushEffects();

    expect(mockGetPlaceBatchSnapshots).not.toHaveBeenCalled();
    expect(mockSearchPlaces).not.toHaveBeenCalled();

    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.map((img) => img.getAttribute("src"))).toEqual([
      "https://res.cloudinary.com/demo/chat-linh-ung.jpg",
      "https://res.cloudinary.com/demo/chat-nhs.jpg",
    ]);

    await act(async () => {
      root.unmount();
    });
  });
});

