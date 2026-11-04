import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Place } from "../types";

const { getPlaceDetails } = vi.hoisted(() => ({
  getPlaceDetails: vi.fn(),
}));

vi.mock("./places-api", () => ({ getPlaceDetails }));

import { loadPlacePhotoGallery } from "./place-photo-enrichment";

function place(id: string): Place {
  return {
    id,
    name: "Chùa Pháp Lâm",
    categories: ["tourist_attraction"],
    photos: [],
    location: { lat: 16.0604, lng: 108.2205 },
  };
}

describe("place photo enrichment", () => {
  beforeEach(() => {
    getPlaceDetails.mockReset();
  });

  it("refreshes expired media once and deduplicates concurrent card lookups", async () => {
    let resolveRequest!: (value: unknown) => void;
    getPlaceDetails.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const stalePlace = {
      ...place("place-stale-photo"),
      photoGallery: [
        {
          url: "https://lh3.googleusercontent.com/expired-photo",
          source: "ziomap",
          attribution: [],
          fetchedAt: "2026-09-24T12:00:00Z",
          displayApproved: true,
        },
      ],
    };

    const first = loadPlacePhotoGallery(stalePlace);
    const second = loadPlacePhotoGallery(stalePlace);

    expect(getPlaceDetails).toHaveBeenCalledTimes(1);
    expect(getPlaceDetails).toHaveBeenCalledWith(
      stalePlace.id,
      stalePlace.name,
      stalePlace.location?.lat,
      stalePlace.location?.lng,
      undefined,
      true,
    );

    resolveRequest({
      success: true,
      data: {
        ...stalePlace,
        photos: [],
        photoGallery: [
          {
            url: "https://lh3.googleusercontent.com/refreshed-photo",
            source: "ziomap",
            attribution: [],
            fetchedAt: new Date().toISOString(),
            displayApproved: true,
          },
        ],
      },
    });

    const [firstPhotos, secondPhotos] = await Promise.all([first, second]);
    expect(firstPhotos).toHaveLength(1);
    expect(secondPhotos).toEqual(firstPhotos);
  });

  it("reuses recent approved evidence without another provider lookup", async () => {
    const currentPlace = {
      ...place("place-fresh-photo"),
      photoGallery: [
        {
          url: "https://lh3.googleusercontent.com/fresh-photo",
          source: "ziomap",
          attribution: [],
          fetchedAt: new Date().toISOString(),
          displayApproved: true,
        },
      ],
    };

    await expect(loadPlacePhotoGallery(currentPlace)).resolves.toHaveLength(1);
    expect(getPlaceDetails).not.toHaveBeenCalled();
  });

  it("keeps the truthful empty state when refresh returns no approved media", async () => {
    const emptyPlace = place("place-empty-photo");
    getPlaceDetails.mockResolvedValue({
      success: true,
      data: { ...emptyPlace, photoGallery: [], primaryPhoto: undefined },
    });

    await expect(loadPlacePhotoGallery(emptyPlace)).resolves.toEqual([]);
  });
});
