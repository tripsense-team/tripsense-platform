import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchRealHotels, isSameHotel } from "./hotel-service-adapter";

const { hotelApi, searchPlaces } = vi.hoisted(() => ({ hotelApi: vi.fn(), searchPlaces: vi.fn() }));
vi.mock("./hotels-api", () => ({ hotelApi }));
vi.mock("@/features/places/services/places-api", () => ({ searchPlaces }));

const offer = (id: string, name: string, address = "Beach") => ({
  property_id: id,
  room_type_id: `room-${id}`,
  name,
  room_name: "Double",
  destination: "Da Nang",
  address,
  capacity: 2,
  cancellation_policy: "FREE_BEFORE_CHECK_IN",
  free_cancellation_until: "2026-10-01T07:00:00Z",
  total: 1000000,
  currency: "VND",
  available_rooms: 1,
  checked_at: "2026-09-30T00:00:00Z",
});

describe("hotel discovery authority and deduplication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps direct inventory when Place lookup fails", async () => {
    hotelApi.mockResolvedValue([
      offer("property-a", "Ocean Hotel A"),
      offer("property-b", "River Hotel B"),
    ]);
    searchPlaces.mockRejectedValue(new Error("Place unavailable"));
    const hotels = await searchRealHotels("Da Nang", "2026-10-02", "2026-10-04", 2, 2);
    expect(hotels.map((h) => h.id)).toEqual(["property-a", "property-b"]);
    expect(hotels.every((h) => h.hasDirectBooking)).toBe(true);
    expect(hotels[0].pricePerNight).toBe(250000);
    expect(hotels[0].rooms?.[0].sleeps).toBe(2);
  });

  it("merges partner property and Place record of the same hotel into a single rich bookable card", async () => {
    hotelApi.mockResolvedValue([
      offer("property-a", "Khách sạn Mường Thanh Luxury Sông Hàn", "115 Nguyễn Văn Linh, Hải Châu"),
    ]);
    searchPlaces.mockResolvedValue({
      success: true,
      data: [
        {
          id: "place-muong-thanh",
          name: "Khách sạn Mường Thanh Luxury Sông Hàn",
          categories: ["STAY"],
          address: "115 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
          city: "Đà Nẵng",
          district: "Hải Châu",
          rating: 4.1,
          userRatingCount: 824,
          photos: ["https://example.com/han-river-bridge.jpg"],
        },
      ],
    });

    const hotels = await searchRealHotels("Đà Nẵng", "2026-10-02", "2026-10-04");
    // Crucial business logic: must NOT split into two separate cards
    expect(hotels).toHaveLength(1);
    expect(hotels[0].id).toBe("place-muong-thanh");
    expect(hotels[0].name).toBe("Khách sạn Mường Thanh Luxury Sông Hàn");
    expect(hotels[0].hasDirectBooking).toBe(true);
    expect(hotels[0].pricePerNight).toBe(500000);
    expect(hotels[0].rating).toBe(4.1);
    expect(hotels[0].photos).toEqual(["https://example.com/han-river-bridge.jpg"]);
    expect(hotels[0].rooms).toHaveLength(1);
    expect(hotels[0].propertyId).toBe("property-a");
  });

  it("does not mark an unrelated Place record as directly bookable", async () => {
    hotelApi.mockResolvedValue([offer("property-a", "Ocean Luxury Hotel")]);
    searchPlaces.mockResolvedValue({
      success: true,
      data: [
        {
          id: "place-unrelated",
          name: "Mountain Eco Lodge",
          categories: ["STAY"],
          photos: ["https://example.com/mountain.jpg"],
        },
      ],
    });

    const hotels = await searchRealHotels("Da Nang", "2026-10-02", "2026-10-04");
    expect(hotels).toHaveLength(2);
    // Directly bookable partner hotel is prioritized at the top
    expect(hotels[0].name).toBe("Ocean Luxury Hotel");
    expect(hotels[0].hasDirectBooking).toBe(true);
    // Unrelated place remains unbookable
    expect(hotels[1].name).toBe("Mountain Eco Lodge");
    expect(hotels[1].hasDirectBooking).toBe(false);
  });

  it("correctly identifies same hotel with diacritics and prefix variations", () => {
    expect(
      isSameHotel(
        { name: "Khách sạn Mường Thanh Luxury Sông Hàn", address: "115 Nguyễn Văn Linh" },
        { name: "Muong Thanh Luxury Song Han Hotel", address: "115 Nguyễn Văn Linh, Đà Nẵng" }
      )
    ).toBe(true);

    expect(
      isSameHotel(
        { name: "Khách sạn Mường Thanh Grand Đà Nẵng Hotel", address: "962 Ngô Quyền" },
        { name: "Khách sạn Mường Thanh Luxury Sông Hàn", address: "115 Nguyễn Văn Linh" }
      )
    ).toBe(false);
  });
});
