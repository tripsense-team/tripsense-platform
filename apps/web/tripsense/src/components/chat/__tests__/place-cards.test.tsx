import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceCards } from "../place-cards";
import { PlaceDetailActionProvider } from "../place-detail-action-context";
import type { PlaceSearchResult } from "@/lib/types";

const mockAddPlaceToTrip = vi.fn();
const mockRemovePlaceFromTrip = vi.fn();
const mockGetTripMemberships = vi.fn();
const mockTripsState = {
  trips: [{ id: "trip-1", name: "Chuyến đi Đà Nẵng", ownerId: "user-1", status: "DRAFT" }],
  fetchTrips: vi.fn(),
};

vi.mock("@/features/auth", () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean; user?: { id: string } }) => unknown) =>
    selector({ isAuthenticated: true, user: { id: "user-1" } }),
}));

vi.mock("@/features/trip-management/store/use-trip-store", () => ({
  useTripStore: (selector: (s: typeof mockTripsState) => unknown) =>
    selector(mockTripsState),
}));

vi.mock("@/features/place-actions/services/place-actions-api", () => ({
  addPlaceToTrip: (...args: unknown[]) => mockAddPlaceToTrip(...args),
  removePlaceFromTrip: (...args: unknown[]) => mockRemovePlaceFromTrip(...args),
  getTripMemberships: (...args: unknown[]) => mockGetTripMemberships(...args),
}));

const samplePlaces: PlaceSearchResult[] = [
  {
    id: "place-my-khe",
    name: "Bãi biển Mỹ Khê",
    categories: ["beach"],
    address: "Võ Nguyên Giáp, Đà Nẵng",
    rating: 4.8,
    location: { lat: 16.0592, lng: 108.2465 },
    photoUrl: "https://res.cloudinary.com/demo/my-khe.jpg",
    reason: "Bãi cát mịn, nước trong",
  },
];

describe("PlaceCards component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTripMemberships.mockResolvedValue([]);
  });

  it("opens PlaceDetailOverlay via PlaceDetailActionProvider on card click and keeps action pills isolated", async () => {
    const openPlaceDetail = vi.fn();
    const openWindowSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PlaceDetailActionProvider openPlaceDetail={openPlaceDetail}>
          <PlaceCards places={samplePlaces} />
        </PlaceDetailActionProvider>,
      );
    });

    const card = container.querySelector('[data-testid="place-card-place-my-khe"]') as HTMLElement | null;
    expect(card).not.toBeNull();

    const favButton = card?.querySelector('button[title="Lưu vào yêu thích"]') as HTMLButtonElement | null;
    expect(favButton).not.toBeNull();

    await act(async () => {
      favButton?.click();
    });
    expect(openPlaceDetail).not.toHaveBeenCalled();

    await act(async () => {
      card?.click();
    });
    expect(openPlaceDetail).toHaveBeenCalledTimes(1);
    expect(openPlaceDetail).toHaveBeenCalledWith(
      expect.objectContaining({
        placeIdHint: "place-my-khe",
        nameHint: "Bãi biển Mỹ Khê",
        knownPhotoUrl: "https://res.cloudinary.com/demo/my-khe.jpg",
      }),
    );
    expect(openWindowSpy).not.toHaveBeenCalled();

    openWindowSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it("falls back to Google Maps external open when rendered outside PlaceDetailActionProvider", async () => {
    const openWindowSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(<PlaceCards places={samplePlaces} />);
    });

    const card = container.querySelector('[data-testid="place-card-place-my-khe"]') as HTMLElement | null;
    await act(async () => {
      card?.click();
    });

    expect(openWindowSpy).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/?api=1&query=16.0592,108.2465",
      "_blank",
      "noopener,noreferrer",
    );

    openWindowSpy.mockRestore();
    await act(async () => {
      root.unmount();
    });
  });

  it("saves and removes places in Trip Ideas (PUT/DELETE /places) and dispatches trip-ideas-updated", async () => {
    mockAddPlaceToTrip.mockResolvedValue(undefined);
    mockRemovePlaceFromTrip.mockResolvedValue(undefined);

    const dispatchedEvents: CustomEvent[] = [];
    const listener = (e: Event) => dispatchedEvents.push(e as CustomEvent);
    window.addEventListener("tripsense:trip-ideas-updated", listener);

    const hotelPlace: PlaceSearchResult = {
      id: "6ab7874de8e0eb488c68f6e3",
      name: "Sala Danang Beach Hotel",
      categories: ["hotel", "lodging"],
      address: "36-38 Lâm Hoành, Đà Nẵng",
      rating: 4.9,
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PlaceCards
          places={[hotelPlace]}
          activeTrip={{ id: "trip-1", name: "Chuyến đi Đà Nẵng" }}
        />,
      );
    });

    const addTrigger = container.querySelector(
      'button[title="Thêm vào ý tưởng chuyến đi"]',
    ) as HTMLButtonElement | null;
    expect(addTrigger).not.toBeNull();

    await act(async () => {
      addTrigger?.click();
    });

    const tripButton = Array.from(document.body.querySelectorAll("button")).find((btn) =>
      btn.textContent?.includes("Chuyến đi Đà Nẵng"),
    );
    expect(tripButton).toBeTruthy();
    expect(tripButton?.textContent).toContain("Đang mở");

    await act(async () => {
      tripButton?.click();
    });

    expect(mockAddPlaceToTrip).toHaveBeenCalledWith(
      "trip-1",
      "6ab7874de8e0eb488c68f6e3",
    );
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].detail).toEqual({
      tripId: "trip-1",
      placeRef: "6ab7874de8e0eb488c68f6e3",
    });

    // Clicking the same trip again toggles removal from Ideas
    await act(async () => {
      tripButton?.click();
    });

    expect(mockRemovePlaceFromTrip).toHaveBeenCalledWith(
      "trip-1",
      "6ab7874de8e0eb488c68f6e3",
    );

    window.removeEventListener("tripsense:trip-ideas-updated", listener);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
