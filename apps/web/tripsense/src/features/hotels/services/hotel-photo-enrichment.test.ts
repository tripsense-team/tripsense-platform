import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MindtripHotel } from "../types";

const { getPlaceDetails, searchPlaces } = vi.hoisted(() => ({
  getPlaceDetails: vi.fn(),
  searchPlaces: vi.fn(),
}));

vi.mock("@/features/places/services/places-api", () => ({ getPlaceDetails, searchPlaces }));

import { loadHotelPhotoGallery } from "./hotel-photo-enrichment";

const makeHotel = (placeId: string): MindtripHotel => ({
  id: placeId,
  placeId,
  name: "Hotel Samdi",
  category: "Hotel",
  destination: "Da Nang",
  photos: [],
});

describe("hotel photo enrichment", () => {
  beforeEach(() => {
    getPlaceDetails.mockReset();
    searchPlaces.mockReset();
  });

  it("requests Place Details with includePhoto and deduplicates concurrent lookups", async () => {
    let resolveRequest!: (value: unknown) => void;
    getPlaceDetails.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));

    const hotel = makeHotel("place-samdi-test");
    const first = loadHotelPhotoGallery(hotel);
    const second = loadHotelPhotoGallery(hotel);

    expect(getPlaceDetails).toHaveBeenCalledTimes(1);
    expect(getPlaceDetails).toHaveBeenCalledWith("place-samdi-test", "Hotel Samdi", undefined, undefined, undefined, true);

    resolveRequest({
      success: true,
      data: {
        id: "place-samdi-test",
        name: "Hotel Samdi",
        categories: ["Hotel"],
        photos: [],
        photoGallery: [{
          url: "https://lh3.googleusercontent.com/hotel-samdi-photo",
          source: "google",
          attribution: [],
          fetchedAt: new Date().toISOString(),
          displayApproved: true,
        }],
      },
    });

    const [firstPhotos, secondPhotos] = await Promise.all([first, second]);
    expect(firstPhotos).toHaveLength(1);
    expect(secondPhotos).toEqual(firstPhotos);
  });

  it("keeps missing or rejected provider photos empty", async () => {
    getPlaceDetails.mockResolvedValue({
      success: true,
      data: {
        id: "place-empty-test",
        name: "Hotel Samdi",
        categories: ["Hotel"],
        photos: [],
        photoGallery: [{
          url: "https://unapproved.example/photo.jpg",
          source: "unknown",
          attribution: [],
          fetchedAt: new Date().toISOString(),
          displayApproved: true,
        }],
      },
    });

    await expect(loadHotelPhotoGallery(makeHotel("place-empty-test"))).resolves.toEqual([]);
    expect(getPlaceDetails).toHaveBeenCalledTimes(1);
  });

  it("does not request details when hotel has no stable Place ID", async () => {
    const hotel = makeHotel("partner-property-id");
    delete hotel.placeId;
    searchPlaces.mockResolvedValue({ success: true, data: [] });

    await expect(loadHotelPhotoGallery(hotel)).resolves.toEqual([]);
    expect(getPlaceDetails).not.toHaveBeenCalled();
    expect(searchPlaces).toHaveBeenCalledWith({ q: hotel.name, category: "STAY", limit: 5 });
  });

  it("matches a booking hotel to Place Service before requesting photos", async () => {
    const hotel = makeHotel("partner-property-fallback-test");
    delete hotel.placeId;
    searchPlaces.mockResolvedValue({
      success: true,
      data: [{
        id: "matched-place-fallback-test",
        name: hotel.name,
        categories: ["Hotel"],
        photos: [],
        location: { lat: 16.05, lng: 108.2 },
      }],
    });
    getPlaceDetails.mockResolvedValue({
      success: true,
      data: {
        id: "matched-place-fallback-test",
        name: hotel.name,
        categories: ["Hotel"],
        photos: [],
        photoGallery: [{
          url: "https://lh3.googleusercontent.com/matched-live-photo",
          source: "google",
          attribution: [],
          fetchedAt: new Date().toISOString(),
          displayApproved: true,
        }],
      },
    });

    const result = await loadHotelPhotoGallery(hotel);
    expect(result).toHaveLength(1);
    expect(getPlaceDetails).toHaveBeenCalledWith(
      "matched-place-fallback-test", hotel.name, 16.05, 108.2, undefined, true,
    );
  });

  it("does not request details when approved photos already exist", async () => {
    const hotel = makeHotel("place-existing-photo-test");
    hotel.photoGallery = [{
      url: "https://lh3.googleusercontent.com/existing-photo",
      source: "google",
      attribution: [],
      fetchedAt: new Date().toISOString(),
      displayApproved: true,
    }];

    await expect(loadHotelPhotoGallery(hotel)).resolves.toEqual(hotel.photoGallery);
    expect(getPlaceDetails).not.toHaveBeenCalled();
  });
});
