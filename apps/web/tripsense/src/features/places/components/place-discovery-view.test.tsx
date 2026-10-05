import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";

const { searchPlacesMock, getExploreForYouMock, authState } = vi.hoisted(() => ({
  searchPlacesMock: vi.fn(),
  getExploreForYouMock: vi.fn(),
  authState: {
    isAuthenticated: false,
    status: "unauthenticated",
    user: null as { id: string } | null,
  },
}));

vi.mock("next/dynamic", () => ({
  default: () => function MockMap() {
    return <div data-testid="map" />;
  },
}));

vi.mock("../services/places-api", () => ({
  searchPlaces: searchPlacesMock,
  getPlaceDetails: vi.fn(),
}));

vi.mock("../services/recommendations-api", () => ({
  getExploreForYou: getExploreForYouMock,
  recordRecommendationEvent: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) =>
    selector(authState),
}));

vi.mock("@/features/trip-management", () => ({
  prefetchUserTrips: vi.fn(),
}));

vi.mock("@/features/place-actions", () => ({
  AddToTripDialog: () => null,
  SaveToCollectionDialog: () => null,
  usePlaceActions: () => ({
    savedByPlace: new Map(),
    tripsByPlace: new Map(),
    isLoading: false,
  }),
}));

import { PlaceDiscoveryView } from "./place-discovery-view";
import { useExploreStore } from "../store/use-explore-store";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("PlaceDiscoveryView request coordination", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    useExploreStore.getState().resetExploreState();
    searchPlacesMock.mockReset();
    getExploreForYouMock.mockReset();
    authState.isAuthenticated = false;
    authState.status = "unauthenticated";
    authState.user = null;
    searchPlacesMock.mockResolvedValue({
      success: true,
      data: [],
      meta: { query: "", total: 0 },
    });
    getExploreForYouMock.mockResolvedValue({
      recommendationId: "rec-1",
      destinationId: "danang",
      committedQuery: "",
      queryApplied: false,
      resultMode: "PERSONALIZED",
      fallbackLevel: "EXACT",
      stale: false,
      personalization: { enabled: true, applied: true, signalCount: 1 },
      requestedCount: 20,
      returnedCount: 0,
      complete: false,
      rankingStatus: "UNRANKED",
      items: [],
      degradations: [],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("issues only one new search when the destination changes", async () => {
    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PlaceDiscoveryView />
        </I18nProvider>,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(searchPlacesMock).toHaveBeenCalledTimes(1);

    const destinationButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Đà Nẵng"),
    );
    expect(destinationButton).toBeDefined();

    act(() => {
      destinationButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const hueButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Huế",
    );
    expect(hueButton).toBeDefined();

    await act(async () => {
      hueButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.runAllTimersAsync();
    });

    expect(searchPlacesMock).toHaveBeenCalledTimes(2);
    expect(searchPlacesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: "địa điểm nổi tiếng ở Huế",
        lat: 16.4637,
        lng: 107.5909,
      }),
    );
  });

  it("restores cached results immediately without re-fetching when returning to tab", async () => {
    // 1. Initial mount and fetch
    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PlaceDiscoveryView />
        </I18nProvider>,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(searchPlacesMock).toHaveBeenCalledTimes(1);

    // 2. Simulate navigating away (unmount)
    act(() => root.unmount());
    root = createRoot(container);

    // 3. Simulate navigating back to Explore (mount again)
    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PlaceDiscoveryView />
        </I18nProvider>,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should NOT have made a 2nd search because state was preserved in store!
    expect(searchPlacesMock).toHaveBeenCalledTimes(1);
  });

  it("reuses cached category results without re-fetching when switching between category tabs", async () => {
    searchPlacesMock.mockResolvedValue({
      success: true,
      data: [
        {
          id: "food-1",
          name: "Local Food",
          categories: ["restaurant"],
          photos: [],
        },
      ],
      meta: { query: "", total: 1 },
    });
    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PlaceDiscoveryView />
        </I18nProvider>,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(searchPlacesMock).toHaveBeenCalledTimes(1);

    // Switch to Food tab
    const foodButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Ẩm thực") || button.textContent?.includes("Food"),
    );
    expect(foodButton).toBeDefined();

    await act(async () => {
      foodButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.runAllTimersAsync();
    });
    // Should fetch once for Food using the structured taxonomy.
    expect(searchPlacesMock).toHaveBeenCalledTimes(2);
    expect(searchPlacesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "FOOD", limit: 48 }),
    );

    // Switch back to "For you" (Dành cho bạn)
    const forYouButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Dành cho bạn") || button.textContent?.includes("For you"),
    );
    expect(forYouButton).toBeDefined();

    await act(async () => {
      forYouButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.runAllTimersAsync();
    });

    // Switch back to Food again
    await act(async () => {
      foodButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await vi.runAllTimersAsync();
    });

    // Since Food was already fetched and cached, it should NOT make another network call!
    expect(searchPlacesMock).toHaveBeenCalledTimes(2);
  });

  it("shows at most 16 places per page and changes the map/list snapshot together", async () => {
    searchPlacesMock.mockResolvedValue({
      success: true,
      data: Array.from({ length: 17 }, (_, index) => ({
        id: `place-${index + 1}`,
        name: `Place ${index + 1}`,
        categories: ["attraction"],
        photos: [],
        location: { lat: 16.05 + index / 10_000, lng: 108.2 },
      })),
      meta: { query: "", total: 17 },
    });

    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PlaceDiscoveryView />
        </I18nProvider>,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(container.textContent).toContain("Place 16");
    expect(container.textContent).not.toContain("Place 17");
    expect(container.textContent).toContain("Trang 1 / 2");

    const nextButton = container.querySelector(
      'button[aria-label="Trang sau"]',
    );
    expect(nextButton).not.toBeNull();
    act(() => {
      nextButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Place 17");
    expect(container.textContent).not.toContain("Place 1Place");
    expect(container.textContent).toContain("Trang 2 / 2");
  });

  it("uses recommendations for authenticated For You and commits typed text only on Enter", async () => {
    authState.isAuthenticated = true;
    authState.status = "authenticated";
    authState.user = { id: "user-1" };

    act(() => {
      root.render(
        <I18nProvider initialLocale="vi">
          <PlaceDiscoveryView />
        </I18nProvider>,
      );
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(getExploreForYouMock).toHaveBeenCalledTimes(1);
    expect(searchPlacesMock).not.toHaveBeenCalled();

    const input = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "museum");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(getExploreForYouMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await vi.runAllTimersAsync();
    });
    expect(getExploreForYouMock).toHaveBeenCalledTimes(2);
    expect(getExploreForYouMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ destinationId: "danang", query: "museum" }),
    );
  });
});
