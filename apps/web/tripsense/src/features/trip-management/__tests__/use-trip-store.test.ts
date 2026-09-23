import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTripStore } from "../store/use-trip-store";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import * as tripApi from "../services/trip-management-api";
import type { TripResponse, PageResponse } from "../types";
import { UserRole, UserStatus } from "@/features/auth/types";

vi.mock("../services/trip-management-api", () => ({
  listTrips: vi.fn(),
  createTrip: vi.fn(),
  getTrip: vi.fn(),
  updateTrip: vi.fn(),
  deleteTrip: vi.fn(),
  getItinerary: vi.fn(),
}));

describe("useTripStore - Proactive User Trip Prefetching & Zustand State", () => {
  const mockTrip1: TripResponse = {
    id: "trip-1",
    name: "Khám phá Đà Nẵng - Hội An",
    destinationName: "Đà Nẵng",
    destinationPlaceId: "place-1",
    startDate: "2026-10-01",
    endDate: "2026-10-05",
    status: "CONFIRMED",
    displayStatus: "UPCOMING",
    visibility: "PUBLIC",
    ownerId: "user-1",
    version: 1,
    travelerCount: 2,
    budgetAmount: 15000000,
    budgetCurrency: "VND",
    notes: "Chuyến đi mùa thu",
    coverImageUrl: "https://example.com/cover1.jpg",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
  };

  const mockTrip2: TripResponse = {
    id: "trip-2",
    name: "Săn mây Tà Xùa",
    destinationName: "Sơn La",
    destinationPlaceId: "place-2",
    startDate: "2026-11-10",
    endDate: "2026-11-12",
    status: "DRAFT",
    displayStatus: "DRAFT",
    visibility: "PRIVATE",
    ownerId: "user-1",
    version: 1,
    travelerCount: 4,
    budgetAmount: 5000000,
    budgetCurrency: "VND",
    notes: "Đi cuối tuần",
    coverImageUrl: null,
    createdAt: "2026-09-10T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useTripStore.getState().clearTrips();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      accessToken: null,
      status: "unauthenticated",
    });
  });

  it("returns empty array and does not call listTrips if user is unauthenticated", async () => {
    const trips = await useTripStore.getState().fetchTrips();
    expect(trips).toEqual([]);
    expect(tripApi.listTrips).not.toHaveBeenCalled();
    expect(useTripStore.getState().trips).toEqual([]);
    expect(useTripStore.getState().hasFetched).toBe(false);
  });

  it("fetches trips and stores them in Zustand when authenticated", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: "user-1",
        email: "test@tripsense.app",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      accessToken: "mock-token",
      status: "authenticated",
    });

    const mockPage: PageResponse<TripResponse> = {
      content: [mockTrip1, mockTrip2],
      page: 0,
      size: 50,
      totalElements: 2,
      totalPages: 1,
    };

    vi.mocked(tripApi.listTrips).mockResolvedValueOnce(mockPage);

    const result = await useTripStore.getState().fetchTrips();

    expect(tripApi.listTrips).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(useTripStore.getState().trips).toEqual([mockTrip1, mockTrip2]);
    expect(useTripStore.getState().hasFetched).toBe(true);
    expect(useTripStore.getState().loading).toBe(false);
  });

  it("proactively reuses cached trips on subsequent fetch calls unless force is true", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: "user-1",
        email: "test@tripsense.app",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      accessToken: "mock-token",
      status: "authenticated",
    });

    const mockPage: PageResponse<TripResponse> = {
      content: [mockTrip1],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
    };

    vi.mocked(tripApi.listTrips).mockResolvedValueOnce(mockPage);

    // First call (e.g. from Explore view mount)
    await useTripStore.getState().fetchTrips();
    expect(tripApi.listTrips).toHaveBeenCalledTimes(1);

    // Second call (e.g. when opening PostComposer in Community or My Trips)
    const cachedResult = await useTripStore.getState().fetchTrips(false);
    expect(cachedResult).toEqual([mockTrip1]);
    expect(tripApi.listTrips).toHaveBeenCalledTimes(1); // Not called again!

    // Forced re-fetch
    vi.mocked(tripApi.listTrips).mockResolvedValueOnce({
      ...mockPage,
      content: [mockTrip1, mockTrip2],
      totalElements: 2,
    });
    const forcedResult = await useTripStore.getState().fetchTrips(true);
    expect(forcedResult).toHaveLength(2);
    expect(tripApi.listTrips).toHaveBeenCalledTimes(2);
  });

  it("handles in-flight request deduplication so concurrent calls share the same promise", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: "user-1",
        email: "test@tripsense.app",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
      accessToken: "mock-token",
      status: "authenticated",
    });

    let resolvePromise: (value: PageResponse<TripResponse>) => void;
    const promise = new Promise<PageResponse<TripResponse>>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(tripApi.listTrips).mockReturnValueOnce(promise);

    const call1 = useTripStore.getState().fetchTrips();
    const call2 = useTripStore.getState().fetchTrips();

    expect(tripApi.listTrips).toHaveBeenCalledTimes(1);

    resolvePromise!({
      content: [mockTrip1],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
    });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1).toEqual([mockTrip1]);
    expect(res2).toEqual([mockTrip1]);
  });

  it("supports addTrip, updateTripInStore, and removeTripFromStore mutations", () => {
    useTripStore.getState().setTrips([mockTrip1]);
    expect(useTripStore.getState().trips).toHaveLength(1);

    // Add trip
    useTripStore.getState().addTrip(mockTrip2);
    expect(useTripStore.getState().trips).toHaveLength(2);
    expect(useTripStore.getState().trips[0].id).toBe(mockTrip2.id);

    // Update trip
    const updatedTrip1 = { ...mockTrip1, name: "Đà Nẵng updated" };
    useTripStore.getState().updateTripInStore(updatedTrip1);
    expect(
      useTripStore.getState().trips.find((t) => t.id === mockTrip1.id)?.name,
    ).toBe("Đà Nẵng updated");

    // Remove trip
    useTripStore.getState().removeTripFromStore(mockTrip2.id);
    expect(useTripStore.getState().trips).toHaveLength(1);
    expect(useTripStore.getState().trips[0].id).toBe(mockTrip1.id);
  });

  it("clears cached trips when user logs out", () => {
    useTripStore.getState().setTrips([mockTrip1, mockTrip2]);
    expect(useTripStore.getState().trips).toHaveLength(2);

    useTripStore.getState().clearTrips();
    expect(useTripStore.getState().trips).toEqual([]);
    expect(useTripStore.getState().hasFetched).toBe(false);
  });
});
