import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchRealHotels } from "./hotel-service-adapter";

const { hotelApi, searchPlaces } = vi.hoisted(() => ({ hotelApi: vi.fn(), searchPlaces: vi.fn() }));
vi.mock("./hotels-api", () => ({ hotelApi }));
vi.mock("@/features/places/services/places-api", () => ({ searchPlaces }));

const offer = (id: string, name: string) => ({
  property_id: id, room_type_id: `room-${id}`, name, room_name: "Double",
  destination: "Da Nang", address: "Beach", capacity: 2, cancellation_policy: "FREE_BEFORE_CHECK_IN",
  free_cancellation_until: "2026-10-01T07:00:00Z", total: 1000000, currency: "VND",
  available_rooms: 1, checked_at: "2026-09-30T00:00:00Z",
});

describe("hotel discovery authority", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("keeps direct inventory when Place lookup fails and never merges same-name properties", async () => {
    hotelApi.mockResolvedValue([offer("property-a", "Ocean Hotel"), offer("property-b", "Ocean Hotel")]);
    searchPlaces.mockRejectedValue(new Error("Place unavailable"));
    const hotels = await searchRealHotels("Da Nang", "2026-10-02", "2026-10-04", 2, 2);
    expect(hotels.map(h => h.id)).toEqual(["property-a", "property-b"]);
    expect(hotels.every(h => h.hasDirectBooking)).toBe(true);
    expect(hotels[0].pricePerNight).toBe(250000);
    expect(hotels[0].rooms?.[0].sleeps).toBe(2);
  });

  it("does not mark an unrelated Place record as directly bookable", async () => {
    hotelApi.mockResolvedValue([offer("property-a", "Ocean Hotel")]);
    searchPlaces.mockResolvedValue({ success: true, data: [{ id: "place-x", name: "Ocean Hotel", categories: ["STAY"], photos: [] }] });
    const hotels = await searchRealHotels("Da Nang", "2026-10-02", "2026-10-04");
    expect(hotels).toHaveLength(2);
    expect(hotels[0].hasDirectBooking).toBe(true);
    expect(hotels[1].hasDirectBooking).toBe(false);
  });
});
