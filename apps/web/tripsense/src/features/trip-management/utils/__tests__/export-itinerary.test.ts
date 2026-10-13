import { describe, expect, it } from "vitest";
import { generateTripIcs } from "../export-itinerary";
import type { ItineraryResponse, TripResponse } from "../../types";

describe("Trip Itinerary Export Utilities", () => {
  const mockTrip: TripResponse = {
    id: "trip-test-1",
    name: "Kỳ nghỉ hè Đà Nẵng",
    destinationName: "Đà Nẵng",
    destinationPlaceId: null,
    startDate: "2026-10-20",
    endDate: "2026-10-22",
    travelerCount: 2,
    budgetAmount: 5000000,
    budgetCurrency: "VND",
    notes: "Chuyến đi nghỉ mát cùng gia đình",
    status: "CONFIRMED",
    displayStatus: "UPCOMING",
    visibility: "PRIVATE",
    ownerId: "user-1",
    coverImageUrl: null,
    version: 1,
    createdAt: "2026-10-12T00:00:00Z",
    updatedAt: "2026-10-12T00:00:00Z",
  };

  const mockItinerary: ItineraryResponse = {
    tripId: "trip-test-1",
    days: [
      {
        id: "day-1",
        version: 1,
        dayNumber: 1,
        date: "2026-10-20",
        items: [
          {
            id: "item-1",
            dayId: "day-1",
            placeId: null,
            title: "Chùa Linh Ứng",
            notes: "Viếng tượng Phật Bà Quan Âm",
            placeNameSnapshot: "Chùa Linh Ứng",
            placeAddressSnapshot: "Hoàng Sa, Thọ Quang, Sơn Trà, Đà Nẵng",
            latSnapshot: null,
            lngSnapshot: null,
            startTime: "09:00",
            endTime: "11:00",
            durationMinutes: 120,
            type: "ACTIVITY",
            status: "PLANNED",
            sortOrder: 1,
            version: 1,
            warnings: [],
          },
        ],
      },
    ],
  };

  it("generates RFC 5545 compliant VCALENDAR string with trip and activities", () => {
    const ics = generateTripIcs(mockTrip, mockItinerary);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//TripSense//Travel Itinerary Planner//VI");
    expect(ics).toContain("X-WR-CALNAME:Kỳ nghỉ hè Đà Nẵng");

    // Master trip event
    expect(ics).toContain("UID:ts-trip-trip-test-1@tripsense.app");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261020");
    expect(ics).toContain("DTEND;VALUE=DATE:20261022");
    expect(ics).toContain("SUMMARY:Kỳ nghỉ hè Đà Nẵng");
    expect(ics).toContain("LOCATION:Đà Nẵng");

    // Activity event
    expect(ics).toContain("UID:ts-item-item-1@tripsense.app");
    expect(ics).toContain("SUMMARY:Chùa Linh Ứng");
    expect(ics).toContain("DTSTART:20261020T090000");
    expect(ics).toContain("DTEND:20261020T110000");
    expect(ics).toContain("LOCATION:Hoàng Sa\\, Thọ Quang\\, Sơn Trà\\, Đà Nẵng");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("handles trip without activities cleanly", () => {
    const ics = generateTripIcs(mockTrip, null);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("UID:ts-trip-trip-test-1@tripsense.app");
    expect(ics).toContain("END:VCALENDAR");
  });
});
