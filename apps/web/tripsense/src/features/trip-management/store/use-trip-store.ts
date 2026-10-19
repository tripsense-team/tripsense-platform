import { create } from "zustand";
import type { TripResponse } from "../types";
import { listTrips } from "../services/trip-management-api";
import { useAuthStore } from "@/features/auth/store/use-auth-store";

export interface TripState {
  trips: TripResponse[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  hasMore: boolean;
  lastFetchedAt: number | null;
  hasFetched: boolean;

  // Actions
  fetchTrips: (force?: boolean, size?: number) => Promise<TripResponse[]>;
  loadMoreTrips: () => Promise<TripResponse[]>;
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
  loadingMore: false,
  error: null,
  page: 0,
  pageSize: 3,
  totalElements: 0,
  totalPages: 0,
  hasMore: false,
  lastFetchedAt: null,
  hasFetched: false,

  fetchTrips: async (force = false, requestedSize?: number) => {
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      set({
        trips: [],
        loading: false,
        loadingMore: false,
        hasFetched: false,
        page: 0,
        totalElements: 0,
        totalPages: 0,
        hasMore: false,
      });
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

    const size = requestedSize ?? 3;
    set({ loading: true, error: null });

    inFlightFetch = (async () => {
      try {
        const pageResponse = await listTrips({ page: 0, size });
        const content = pageResponse?.content || [];
        const totalElements = pageResponse?.totalElements ?? content.length;
        const totalPages = pageResponse?.totalPages ?? 1;
        const hasMore =
          (pageResponse?.page ?? 0) + 1 < totalPages || content.length < totalElements;

        set({
          trips: content,
          page: 0,
          pageSize: size,
          totalElements,
          totalPages,
          hasMore,
          loading: false,
          loadingMore: false,
          error: null,
          hasFetched: true,
          lastFetchedAt: Date.now(),
        });

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("trip-management:count-changed", {
              detail: totalElements,
            }),
          );
        }

        return content;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load trips";
        set({
          loading: false,
          loadingMore: false,
          error: errorMessage,
        });
        return get().trips;
      } finally {
        inFlightFetch = null;
      }
    })();

    return inFlightFetch;
  },

  loadMoreTrips: async () => {
    const state = get();
    if (state.loadingMore || !state.hasMore) {
      return state.trips;
    }

    set({ loadingMore: true, error: null });
    const nextPage = state.page + 1;
    try {
      const pageResponse = await listTrips({
        page: nextPage,
        size: state.pageSize,
      });
      const nextContent = pageResponse?.content || [];
      const totalElements =
        pageResponse?.totalElements ?? state.totalElements;
      const totalPages = pageResponse?.totalPages ?? state.totalPages;

      // Merge and deduplicate by id
      const existingIds = new Set(state.trips.map((t) => t.id));
      const newItems = nextContent.filter((t) => !existingIds.has(t.id));
      const merged = [...state.trips, ...newItems];
      const hasMore =
        nextPage + 1 < totalPages && merged.length < totalElements;

      set({
        trips: merged,
        page: nextPage,
        totalElements,
        totalPages,
        hasMore,
        loadingMore: false,
        error: null,
      });

      return merged;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load more trips";
      set({
        loadingMore: false,
        error: errorMessage,
      });
      return get().trips;
    }
  },

  setTrips: (trips) => {
    set({
      trips,
      totalElements: trips.length,
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
      const nextTotal = exists ? state.totalElements : state.totalElements + 1;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trip-management:count-changed", {
            detail: nextTotal,
          }),
        );
      }
      return { trips: nextTrips, totalElements: nextTotal };
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
      const nextTotal = Math.max(0, state.totalElements - 1);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("trip-management:count-changed", {
            detail: nextTotal,
          }),
        );
      }
      return { trips: nextTrips, totalElements: nextTotal };
    });
  },

  clearTrips: () => {
    set({
      trips: [],
      loading: false,
      loadingMore: false,
      error: null,
      page: 0,
      pageSize: 3,
      totalElements: 0,
      totalPages: 0,
      hasMore: false,
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
