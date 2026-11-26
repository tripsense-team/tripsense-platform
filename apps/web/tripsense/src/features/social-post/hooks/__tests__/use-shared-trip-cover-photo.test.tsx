import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSharedTripCoverPhotoCache,
  pickSharedTripCoverQuery,
  useSharedTripCoverPhoto,
} from "../use-shared-trip-cover-photo";
import type { PublicTripSnapshot, SharedTripSummary } from "../../types";

const mockSearchPlaces = vi.fn();

vi.mock("@/features/places/services/places-api", () => ({
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
}));

describe("useSharedTripCoverPhoto", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    clearSharedTripCoverPhotoCache();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("prefers scenic PLACE items over MEAL/HOTEL when selecting a cover query", () => {
    const trip: SharedTripSummary = {
      name: "Du lịch Đà Nẵng",
      destinationName: "Đà Nẵng",
      highlights: [{ title: "Quán ăn", placeName: "Quán ăn", dayNumber: 1 }],
    };
    const publication: PublicTripSnapshot = {
      schemaVersion: 1,
      publicationRevision: 1,
      datePrecision: "DAY_NUMBER_ONLY",
      timePrecision: "NONE",
      summary: {
        name: "Du lịch Đà Nẵng",
        destinationName: "Đà Nẵng",
        coverImageUrl: null,
        dayCount: 1,
        itineraryItemCount: 2,
        highlights: [],
      },
      days: [
        {
          dayNumber: 1,
          items: [
            { order: 1, title: "Nơi lưu trú", type: "HOTEL", placeName: null },
            { order: 2, title: "Mì Quảng", type: "MEAL", placeName: "Mì Quảng" },
            {
              order: 3,
              title: "Bãi biển Mỹ Khê",
              type: "PLACE",
              placeName: "Bãi biển Mỹ Khê",
            },
          ],
        },
      ],
    };

    expect(pickSharedTripCoverQuery(trip, publication)).toBe(
      "Bãi biển Mỹ Khê Đà Nẵng",
    );
  });

  it("skips network calls when coverImageUrl is already present and deduplicates concurrent lookups", async () => {
    mockSearchPlaces.mockResolvedValue({
      success: true,
      data: [
        {
          id: "place-1",
          name: "Bảo Tàng Đà Nẵng",
          primaryPhoto: { url: "https://res.cloudinary.com/demo/museum.jpg" },
        },
      ],
    });

    const withCover: SharedTripSummary = {
      name: "Trip A",
      destinationName: "Đà Nẵng",
      coverImageUrl: "https://res.cloudinary.com/demo/existing.jpg",
    };
    const withoutCover: SharedTripSummary = {
      name: "Trip B",
      destinationName: "Đà Nẵng",
      coverImageUrl: undefined,
      highlights: [
        { title: "Bảo Tàng Đà Nẵng", placeName: "Bảo Tàng Đà Nẵng", dayNumber: 1 },
      ],
    };

    let resultWithCover: string | null = null;
    let resultCard1: string | null = null;
    let resultCard2: string | null = null;

    function Harness() {
      resultWithCover = useSharedTripCoverPhoto(withCover, null, true);
      resultCard1 = useSharedTripCoverPhoto(withoutCover, null, true);
      resultCard2 = useSharedTripCoverPhoto(withoutCover, null, true);
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });

    expect(resultWithCover).toBe("https://res.cloudinary.com/demo/existing.jpg");
    expect(resultCard1).toBe("https://res.cloudinary.com/demo/museum.jpg");
    expect(resultCard2).toBe("https://res.cloudinary.com/demo/museum.jpg");
    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
  });
});
