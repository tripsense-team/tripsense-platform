import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import type { ItineraryResponse, TripResponse } from "@/features/trip-management/types";
import type { Place } from "@/features/places/types";
import { extractAiChatMapData } from "../chat-map-places";

function toolPart(type: string, output: unknown): ChatMessage["parts"][number] {
  return { type, output } as unknown as ChatMessage["parts"][number];
}

describe("extractAiChatMapData", () => {
  it("returns 0 places and single destinationPin when user only selected Where", () => {
    const result = extractAiChatMapData({
      messages: [],
      selectedWhere: "Đà Nẵng",
    });

    expect(result.places).toEqual([]);
    expect(result.resolvedDestination).toBe("Đà Nẵng");
    expect(result.destinationPin).toEqual({
      name: "Đà Nẵng",
      lat: 16.0544,
      lng: 108.2022,
    });
    expect(result.weatherText).toBeUndefined();
  });

  it("ignores raw prepareTripCandidates and plots strictly places chosen in createTripProposal", () => {
    const messages: ChatMessage[] = [
      {
        id: "m1",
        role: "assistant",
        parts: [
          toolPart("tool-prepareTripCandidates", {
            success: true,
            groups: [
              {
                category: "FOOD",
                places: [
                  {
                    id: "raw-candidate-1",
                    name: "Quán nền chưa chọn",
                    categories: ["FOOD"],
                    location: { lat: 16.07, lng: 108.24 },
                  },
                ],
              },
            ],
          }),
          toolPart("tool-createTripProposal", {
            proposalId: "prop-1",
            title: "Đà Nẵng 2 ngày",
            destination: "Đà Nẵng",
            durationDays: 2,
            summary: "Gọn nhẹ",
            days: [
              {
                dayNumber: 1,
                theme: "Biển Mỹ Khê",
                activities: [
                  {
                    itemKey: "k1",
                    period: "MORNING",
                    timeSlot: "08:00 - 10:00",
                    title: "Bãi biển Mỹ Khê",
                    description: "Tắm biển",
                    placeId: "place-mykhe",
                    category: "BEACH",
                    location: { lat: 16.0592, lng: 108.2465 },
                  },
                  {
                    itemKey: "k-null-island",
                    period: "MORNING",
                    timeSlot: "11:00 - 11:30",
                    title: "Check-out khách sạn",
                    description: "Trả phòng",
                    category: "ACTIVITY",
                    location: { lat: 0, lng: 0 },
                  },
                ],
              },
            ],
          }),
        ],
      },
    ];

    const result = extractAiChatMapData({ messages });
    expect(result.places.map((p) => p.name)).toEqual(["Bãi biển Mỹ Khê"]);
    expect(result.places[0].location).toEqual({ lat: 16.0592, lng: 108.2465 });
  });

  it("prioritizes curated recommendPlaces over intermediate searchPlaces in the same message", () => {
    const messages: ChatMessage[] = [
      {
        id: "m-cafe",
        role: "assistant",
        parts: [
          toolPart("tool-searchPlaces", {
            places: [
              {
                id: "raw-cafe-1",
                name: "Raw Unchosen Cafe",
                categories: ["CAFE"],
                location: { lat: 16.06, lng: 108.22 },
              },
            ],
          }),
          toolPart("tool-recommendPlaces", {
            destination: "Đà Nẵng",
            places: [
              {
                id: "curated-cafe-1",
                name: "Reply 1988 Cafe",
                categories: ["CAFE"],
                location: { lat: 16.071, lng: 108.223 },
              },
            ],
          }),
        ],
      },
    ];

    const result = extractAiChatMapData({ messages });
    expect(result.places.map((p) => p.id)).toEqual(["curated-cafe-1"]);
  });

  it("includes standalone searchPlaces when message did not invoke recommendPlaces or createTripProposal", () => {
    const messages: ChatMessage[] = [
      {
        id: "m-direct-search",
        role: "assistant",
        parts: [
          toolPart("tool-searchPlaces", {
            places: [
              {
                id: "direct-place-1",
                name: "Mì Quảng Bà Mua",
                categories: ["FOOD"],
                location: { lat: 16.068, lng: 108.215 },
              },
            ],
          }),
        ],
      },
    ];

    const result = extractAiChatMapData({ messages });
    expect(result.places.map((p) => p.id)).toEqual(["direct-place-1"]);
  });

  it("filters saved itinerary items by selectedDayNumber and resolves missing coordinates via placeSnapshots", () => {
    const trip = {
      id: "trip-1",
      name: "Đà Nẵng",
      destinationName: "Đà Nẵng",
    } as TripResponse;

    const itinerary: ItineraryResponse = {
      tripId: "trip-1",
      days: [
        {
          id: "d1",
          dayNumber: 1,
          date: "2026-12-10",
          version: 1,
          items: [
            {
              id: "item-1",
              dayId: "d1",
              placeId: null,
              placeRef: "place-linh-ung",
              sourceItemKey: "k1",
              type: "PLACE",
              title: "Chùa Linh Ứng",
              startTime: "08:00:00",
              endTime: "10:00:00",
              durationMinutes: 120,
              notes: null,
              status: "PLANNED",
              sortOrder: 1,
              placeNameSnapshot: "Chùa Linh Ứng",
              placeAddressSnapshot: "Sơn Trà, Đà Nẵng",
              latSnapshot: 16.1003,
              lngSnapshot: 108.2775,
              version: 1,
              warnings: [],
            },
          ],
        },
        {
          id: "d2",
          dayNumber: 2,
          date: "2026-12-11",
          version: 1,
          items: [
            {
              id: "item-2",
              dayId: "d2",
              placeId: null,
              placeRef: "place-ba-na",
              sourceItemKey: "k2",
              type: "PLACE",
              title: "Bà Nà Hills",
              startTime: "08:30:00",
              endTime: "15:00:00",
              durationMinutes: 390,
              notes: null,
              status: "PLANNED",
              sortOrder: 1,
              placeNameSnapshot: "Bà Nà Hills",
              placeAddressSnapshot: "Hòa Vang, Đà Nẵng",
              latSnapshot: null,
              lngSnapshot: null,
              version: 1,
              warnings: [],
            },
          ],
        },
      ],
    };

    const placeSnapshots: Record<string, Place> = {
      "place-ba-na": {
        id: "place-ba-na",
        name: "Bà Nà Hills",
        categories: ["ATTRACTION"],
        location: { lat: 15.9977, lng: 107.988 },
        photos: [],
      },
    };

    const allDays = extractAiChatMapData({
      messages: [],
      activeTrip: trip,
      itinerary,
      placeSnapshots,
      selectedDayNumber: null,
    });
    expect(allDays.dayNumbers).toEqual([1, 2]);
    expect(allDays.places.map((p) => p.id)).toEqual(["item-1", "item-2"]);
    expect(allDays.places.map((p) => p.name)).toEqual(["Chùa Linh Ứng", "Bà Nà Hills"]);

    const day2Only = extractAiChatMapData({
      messages: [],
      activeTrip: trip,
      itinerary,
      placeSnapshots,
      selectedDayNumber: 2,
    });
    expect(day2Only.dayNumbers).toEqual([1, 2]);
    expect(day2Only.places.map((p) => p.name)).toEqual(["Bà Nà Hills"]);
  });

  it("collects missingPlaceIds for coordinate hydration and extracts weatherText from getWeather", () => {
    const messages: ChatMessage[] = [
      {
        id: "m-user",
        role: "user",
        parts: [{ type: "text", text: "Lên lịch trình đi Đà Lạt giúp mình" }],
      },
      {
        id: "m-ai",
        role: "assistant",
        parts: [
          toolPart("tool-getWeather", {
            cityName: "Đà Lạt",
            current: { temperature_2m: 20.6 },
            current_units: { temperature_2m: "°C" },
          }),
          toolPart("tool-recommendPlaces", {
            places: [
              {
                id: "catalog-uuid-123",
                name: "Hồ Xuân Hương",
                categories: ["ATTRACTION"],
              },
            ],
          }),
        ],
      },
    ];

    const result = extractAiChatMapData({ messages });
    expect(result.resolvedDestination).toBe("Đà Lạt");
    expect(result.destinationPin?.name).toBe("Đà Lạt");
    expect(result.missingPlaceIds).toEqual(["catalog-uuid-123"]);
    expect(result.weatherText).toBe("21°C · Đà Lạt");
  });
});
