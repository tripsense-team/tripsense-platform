import { create } from "zustand";
import type { TripResponse } from "../types";
import { listTrips } from "../services/trip-management-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

export interface TripState {
  trips: TripResponse[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  hasFetched: boolean;

  // Actions
  fetchTrips: (force?: boolean) => Promise<TripResponse[]>;
  setTrips: (trips: TripResponse[]) => void;
  addTrip: (trip: TripResponse) => void;
  updateTripInStore: (trip: TripResponse) => void;
  removeTripFromStore: (tripId: string) => void;
  clearTrips: () => void;
}

let inFlightFetch: Promise<TripResponse[]> | null = null;

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  loading: false,
  error: null,
  lastFetchedAt: null,
  hasFetched: false,

  fetchTrips: async (force = false) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      set({ trips: [], loading: false, hasFetched: false });
      return [];
    }

    // Return active in-flight promise if one is already running
    if (!force && inFlightFetch) {
      return inFlightFetch;
    }

    // Cache valid for 60 seconds unless explicitly forced
    const now = Date.now();
    const last = get().lastFetchedAt;
    if (
      !force &&
      get().hasFetched &&
      last &&
      now - last < 60000 &&
      get().trips.length > 0
    ) {
      return get().trips;
    }

    set({ loading: true, error: null });

    inFlightFetch = (async () => {
      try {
        const page = await listTrips({ size: 50 });
        const content = page?.content || [];
        set({
          trips: content,
          loading: false,
          error: null,
          hasFetched: true,
          lastFetchedAt: Date.now(),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("trip-management:count-changed", {
              detail: page?.totalElements ?? content.length,
            }),
          );
        }

        return content;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load trips";
        set({
          loading: false,
          error: errorMessage,
        });
        return get().trips;
      } finally {
        inFlightFetch = null;
      }
    })();

    return inFlightFetch;
  },

  setTrips: (trips) => {
    set({
      trips,
      hasFetched: true,
      lastFetchedAt: Date.now(),
      error: null,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("trip-management:count-changed", {
          detail: trips.length,
        }),
      );
    }
  },

  addTrip: (trip) => {
    set((state) => {
      const exists = state.trips.some((t) => t.id === trip.id);
      const nextTrips = exists ? state.trips : [trip, ...state.trips];
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trip-management:count-changed", {
            detail: nextTrips.length,
          }),
        );
      }
      return { trips: nextTrips };
    });
  },

  updateTripInStore: (trip) => {
    set((state) => ({
      trips: state.trips.map((t) => (t.id === trip.id ? trip : t)),
    }));
  },

  removeTripFromStore: (tripId) => {
    set((state) => {
      const nextTrips = state.trips.filter((t) => t.id !== tripId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trip-management:count-changed", {
            detail: nextTrips.length,
          }),
        );
      }
      return { trips: nextTrips };
    });
  },

  clearTrips: () => {
    set({
      trips: [],
      loading: false,
      error: null,
      lastFetchedAt: null,
      hasFetched: false,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("trip-management:count-changed", {
          detail: 0,
        }),
      );
    }
  },
}));

// Automatically clear trips when user logs out
useAuthStore.subscribe((state, prevState) => {
  if (!state.isAuthenticated && prevState?.isAuthenticated) {
    useTripStore.getState().clearTrips();
  }
});
