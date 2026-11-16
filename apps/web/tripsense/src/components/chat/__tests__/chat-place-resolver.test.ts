import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import {
  buildChatPlaceLookup,
  extractPlaceMentionTargets,
  isRealCatalogPlaceId,
  resolveAndHydrateChatPlace,
  toCanonicalDetailPlace,
} from "../chat-place-resolver";
import type { ItineraryResponse } from "@/features/trip-management/types";
import type { Place } from "@/features/places/types";

const mockGetPlaceDetails = vi.fn();
const mockSearchPlaces = vi.fn();

vi.mock("@/features/places/services/places-api", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/places/services/places-api")
  >();
  return {
    ...actual,
    getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
    searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
  };
});

describe("chat-place-resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("distinguishes real catalog place IDs from synthetic map keys, itinerary item UUIDs, and source-only keys", () => {
    const itemIds = new Set(["item-uuid-1"]);
    const sourceOnlyKeys = new Set(["day1_linh_ung"]);

    expect(isRealCatalogPlaceId("place-bao-tang", itemIds, sourceOnlyKeys)).toBe(true);
    expect(isRealCatalogPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4", itemIds, sourceOnlyKeys)).toBe(true);
    expect(isRealCatalogPlaceId("", itemIds, sourceOnlyKeys)).toBe(false);
    expect(isRealCatalogPlaceId("geo:cho-han::16.0680,108.2240", itemIds, sourceOnlyKeys)).toBe(false);
    expect(isRealCatalogPlaceId("msg-place:1:linh-ung", itemIds, sourceOnlyKeys)).toBe(false);
    expect(isRealCatalogPlaceId("item-uuid-1", itemIds, sourceOnlyKeys)).toBe(false);
    expect(isRealCatalogPlaceId("day1_linh_ung", itemIds, sourceOnlyKeys)).toBe(false);
  });

  it("normalizes ZioMap pin item.id back to canonical providerPlaceId when opening detail drawer", () => {
    const itinerary: ItineraryResponse = {
      tripId: "trip-dn",
      days: [
        {
          id: "day-1",
          dayNumber: 1,
          date: "2026-11-20",
          version: 1,
          items: [
            {
              id: "item-uuid-bao-tang",
              dayId: "day-1",
              placeId: null,
              placeRef: "place-bao-tang-my-thuat",
              sourceItemKey: "k-bao-tang",
              type: "PLACE",
              title: "Bảo tàng Mỹ thuật Đà Nẵng",
              startTime: "09:00:00",
              endTime: "10:30:00",
              durationMinutes: 90,
              notes: null,
              status: "PLANNED",
              sortOrder: 100,
              placeNameSnapshot: "Bảo tàng Mỹ thuật Đà Nẵng",
              placeAddressSnapshot: "78 Lê Duẩn, Hải Châu, Đà Nẵng",
              latSnapshot: 16.0715,
              lngSnapshot: 108.2195,
              version: 1,
              warnings: [],
            },
          ],
        },
      ],
    };

    const messages = [
      {
        id: "m1",
        role: "assistant",
        parts: [
          {
            type: "tool-prepareTripCandidates",
            output: {
              places: [
                {
                  id: "place-bao-tang-my-thuat",
                  name: "Bảo tàng Mỹ thuật Đà Nẵng",
                  rating: 4.5,
                  userRatingCount: 1700,
                  location: { lat: 16.0715, lng: 108.2195 },
                  photos: ["https://res.cloudinary.com/demo/bao-tang-1.jpg"],
                },
              ],
            },
          },
        ],
      },
    ] as unknown as UIMessage[];

    const lookup = buildChatPlaceLookup({ messages, itinerary });

    // ZioMap places created from saved itinerary items carry item.id as place.id and item.placeRef as providerPlaceId
    const ziopin: Place = {
      id: "item-uuid-bao-tang",
      providerPlaceId: "place-bao-tang-my-thuat",
      name: "Bảo tàng Mỹ thuật Đà Nẵng",
      categories: ["PLACE"],
      location: { lat: 16.0715, lng: 108.2195 },
      photos: [],
    };

    const canonical = toCanonicalDetailPlace({ place: ziopin, lookup });
    expect(canonical.id).toBe("place-bao-tang-my-thuat");
    expect(canonical.rating).toBe(4.5);
    expect(canonical.photos).toContain("https://res.cloudinary.com/demo/bao-tang-1.jpg");
  });

  it("resolves clicked TripDetailPanel itinerary item using lookup candidates and preserves instant photo", () => {
    const lookup = buildChatPlaceLookup({
      placeSnapshots: {
        "place-cau-rong": {
          id: "place-cau-rong",
          name: "Cầu Rồng",
          address: "Đ. Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
          categories: ["ATTRACTION"],
          location: { lat: 16.0611, lng: 108.2275 },
          photos: ["https://res.cloudinary.com/demo/cau-rong-2.jpg"],
          rating: 4.7,
        },
      },
    });

    const canonical = toCanonicalDetailPlace({
      item: {
        id: "item-cau-rong",
        dayId: "day-1",
        placeId: null,
        placeRef: null,
        sourceItemKey: "day1_cau_rong",
        type: "PLACE",
        title: "Cầu Rồng",
        startTime: "19:30:00",
        endTime: "21:00:00",
        durationMinutes: 90,
        notes: null,
        status: "PLANNED",
        sortOrder: 400,
        placeNameSnapshot: "Cầu Rồng",
        placeAddressSnapshot: null,
        latSnapshot: null,
        lngSnapshot: null,
        version: 1,
        warnings: [],
      },
      knownPhotoUrl: "https://res.cloudinary.com/demo/cau-rong-instant.jpg",
      lookup,
    });

    expect(canonical.id).toBe("place-cau-rong");
    expect(canonical.photos[0]).toBe("https://res.cloudinary.com/demo/cau-rong-instant.jpg");
    expect(canonical.photos).toContain("https://res.cloudinary.com/demo/cau-rong-2.jpg");
    expect(canonical.rating).toBe(4.7);
  });

  it("hydrates full details once and hits 5-minute cache on subsequent opens", async () => {
    const detailsCache = new Map<string, Place>();
    const photoCheckedAtCache = new Map<string, number>();

    mockGetPlaceDetails.mockResolvedValue({
      success: true,
      data: {
        id: "place-123",
        name: "Bảo tàng Điêu khắc Chăm Đà Nẵng",
        address: "02 Đ. 2 Tháng 9, Hải Châu, Đà Nẵng",
        rating: 4.6,
        userRatingCount: 8200,
        categories: ["museum"],
        photos: [
          "https://res.cloudinary.com/demo/cham-1.jpg",
          "https://res.cloudinary.com/demo/cham-2.jpg",
        ],
        openingHours: { openNow: true, weekdayDescriptions: ["07:00 - 17:00"] },
        reviews: [
          {
            authorName: "Lan Anh",
            rating: 5,
            text: "Rất đẹp và giàu giá trị lịch sử.",
          },
        ],
      },
    });

    const initialPlace: Place = {
      id: "place-123",
      name: "Bảo tàng Điêu khắc Chăm Đà Nẵng",
      categories: ["museum"],
      location: { lat: 16.0607, lng: 108.2236 },
      photos: [],
    };

    const first = await resolveAndHydrateChatPlace({
      initialPlace,
      detailsCache,
      photoCheckedAtCache,
    });

    expect(mockGetPlaceDetails).toHaveBeenCalledTimes(1);
    expect(mockGetPlaceDetails).toHaveBeenCalledWith(
      "place-123",
      "Bảo tàng Điêu khắc Chăm Đà Nẵng",
      16.0607,
      108.2236,
      undefined,
      true,
    );
    expect(first?.reviews).toHaveLength(1);
    expect(first?.photos).toHaveLength(2);

    const second = await resolveAndHydrateChatPlace({
      initialPlace,
      detailsCache,
      photoCheckedAtCache,
    });

    expect(mockGetPlaceDetails).toHaveBeenCalledTimes(1);
    expect(second?.id).toBe("place-123");
    expect(second?.reviews).toHaveLength(1);
  });

  it("falls back to searchPlaces for synthetic IDs and honors AbortSignal on rapid re-selection", async () => {
    const detailsCache = new Map<string, Place>();
    const photoCheckedAtCache = new Map<string, number>();

    mockSearchPlaces.mockResolvedValue({
      success: true,
      data: [
        {
          id: "place-my-khe-real",
          name: "Bãi biển Mỹ Khê",
          categories: ["beach"],
          location: { lat: 16.0592, lng: 108.2465 },
          photos: ["https://res.cloudinary.com/demo/my-khe.jpg"],
        },
      ],
    });
    mockGetPlaceDetails.mockResolvedValue({
      success: true,
      data: {
        id: "place-my-khe-real",
        name: "Bãi biển Mỹ Khê",
        categories: ["beach"],
        location: { lat: 16.0592, lng: 108.2465 },
        photos: ["https://res.cloudinary.com/demo/my-khe.jpg"],
        openingHours: { openNow: true },
        reviews: [{ rating: 5, text: "Biển xanh cát mịn" }],
      },
    });

    const syntheticInitial: Place = {
      id: "geo:bai-bien-my-khe::16.0592,108.2465",
      name: "Bãi biển Mỹ Khê",
      categories: ["beach"],
      location: { lat: 16.0592, lng: 108.2465 },
      photos: [],
    };

    const resolved = await resolveAndHydrateChatPlace({
      initialPlace: syntheticInitial,
      destinationHint: "Đà Nẵng",
      detailsCache,
      photoCheckedAtCache,
    });

    expect(mockSearchPlaces).toHaveBeenCalledTimes(1);
    expect(mockGetPlaceDetails).toHaveBeenCalledWith(
      "place-my-khe-real",
      "Bãi biển Mỹ Khê",
      16.0592,
      108.2465,
      undefined,
      true,
    );
    expect(resolved?.id).toBe("place-my-khe-real");

    const controller = new AbortController();
    controller.abort();
    const abortedResult = await resolveAndHydrateChatPlace({
      initialPlace: syntheticInitial,
      detailsCache,
      photoCheckedAtCache,
      signal: controller.signal,
    });
    expect(abortedResult).toBeNull();
  });

  it("degrades gracefully when getPlaceDetails rejects instead of throwing", async () => {
    const detailsCache = new Map<string, Place>();
    const photoCheckedAtCache = new Map<string, number>();

    mockGetPlaceDetails.mockRejectedValue(new Error("Upstream 503"));

    const initialPlace: Place = {
      id: "place-fallback-safe",
      name: "Cầu Tình Yêu Đà Nẵng",
      address: "Trần Hưng Đạo, Sơn Trà, Đà Nẵng",
      categories: ["landmark"],
      location: { lat: 16.0631, lng: 108.2294 },
      photos: ["https://res.cloudinary.com/demo/cau-tinh-yeu.jpg"],
    };

    const result = await resolveAndHydrateChatPlace({
      initialPlace,
      detailsCache,
      photoCheckedAtCache,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("place-fallback-safe");
    expect(result?.address).toBe("Trần Hưng Đạo, Sơn Trà, Đà Nẵng");
  });

  it("extracts grounded mention targets longest-first while filtering destination names and plain activities", () => {
    const messages = [
      {
        id: "m-extract",
        role: "assistant",
        parts: [
          {
            type: "tool-createTripProposal",
            output: {
              days: [
                {
                  dayNumber: 1,
                  activities: [
                    {
                      itemKey: "k-rest",
                      title: "Nghỉ ngơi tại khách sạn",
                      category: "ACTIVITY",
                    },
                    {
                      itemKey: "k-chua",
                      placeId: "place-chua-linh-ung",
                      title: "Cổng Chùa Linh Ứng",
                      category: "ATTRACTION",
                      location: { lat: 16.1, lng: 108.27 },
                    },
                  ],
                },
              ],
            },
          },
          {
            type: "tool-recommendPlaces",
            output: {
              places: [
                { id: "place-son-tra", name: "Sơn Trà" },
                { id: "place-dest", name: "Đà Nẵng" },
              ],
            },
          },
        ],
      },
    ] as unknown as UIMessage[];

    const targets = extractPlaceMentionTargets({
      messages,
      excludedDestinationNames: ["Đà Nẵng, Việt Nam"],
    });

    expect(targets.map((t) => t.name)).toEqual([
      "Cổng Chùa Linh Ứng",
      "Sơn Trà",
    ]);

    const lookup = buildChatPlaceLookup({ messages });
    const resolvedFromName = toCanonicalDetailPlace({
      nameHint: "Cổng Chùa Linh Ứng",
      lookup,
    });
    expect(resolvedFromName.id).toBe("place-chua-linh-ung");

    const unknownHint = toCanonicalDetailPlace({
      nameHint: "Cầu Vàng Bà Nà",
      lookup,
    });
    expect(unknownHint.id).toBe("msg-place:cau-vang-ba-na");
    expect(unknownHint.name).toBe("Cầu Vàng Bà Nà");
  });
});
