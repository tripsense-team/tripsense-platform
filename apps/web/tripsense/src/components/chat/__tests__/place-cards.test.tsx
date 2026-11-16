import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaceCards } from "../place-cards";
import { PlaceDetailActionProvider } from "../place-detail-action-context";
import type { PlaceSearchResult } from "@/lib/types";

vi.mock("@/features/auth", () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}));

vi.mock("@/features/trip-management/store/use-trip-store", () => ({
  useTripStore: (selector: (s: { trips: unknown[]; fetchTrips: () => void }) => unknown) =>
    selector({ trips: [], fetchTrips: vi.fn() }),
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
});
