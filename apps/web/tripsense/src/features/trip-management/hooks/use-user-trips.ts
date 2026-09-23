"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import {
  listTrips,
  createTrip,
  updateTrip,
  deleteTrip,
} from "../services/trip-management-api";
import { useTripStore } from "../store/use-trip-store";
import { tripQueryKeys, getQueryClient } from "@/lib/react-query";
import type {
  CreateTripRequest,
  TripResponse,
  UpdateTripRequest,
} from "../types";

export async function fetchUserTripsQueryFn(): Promise<TripResponse[]> {
  const page = await listTrips({ size: 50 });
  const trips = page?.content || [];
  // Keep Zustand store in sync
  useTripStore.getState().setTrips(trips);
  return trips;
}

/**
 * Proactively prefetch user trips into both React Query cache and Zustand store.
 * Safe to call on mount in Explore page or navigation events.
 */
export async function prefetchUserTrips(): Promise<void> {
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  if (!isAuthenticated) return;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: tripQueryKeys.userTrips(),
    queryFn: fetchUserTripsQueryFn,
    staleTime: 60 * 1000,
  });
}

/**
 * React hook combining TanStack React Query server state with Zustand client state.
 */
export function useUserTrips() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const zustandTrips = useTripStore((state) => state.trips);

  const query = useQuery({
    queryKey: tripQueryKeys.userTrips(),
    queryFn: fetchUserTripsQueryFn,
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    initialData: zustandTrips.length > 0 ? zustandTrips : undefined,
  });

  // Sync React Query updates into Zustand
  React.useEffect(() => {
    if (query.data && query.data.length >= 0) {
      useTripStore.getState().setTrips(query.data);
    }
  }, [query.data]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateTripRequest) => createTrip(payload),
    onSuccess: (newTrip) => {
      useTripStore.getState().addTrip(newTrip);
      void queryClient.invalidateQueries({
        queryKey: tripQueryKeys.userTrips(),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      tripId,
      payload,
    }: {
      tripId: string;
      payload: UpdateTripRequest;
    }) => updateTrip(tripId, payload),
    onSuccess: (updatedTrip) => {
      useTripStore.getState().updateTripInStore(updatedTrip);
      void queryClient.invalidateQueries({
        queryKey: tripQueryKeys.userTrips(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tripId: string) => deleteTrip(tripId),
    onSuccess: (_, tripId) => {
      useTripStore.getState().removeTripFromStore(tripId);
      void queryClient.invalidateQueries({
        queryKey: tripQueryKeys.userTrips(),
      });
    },
  });

  return {
    ...query,
    trips: query.data || zustandTrips,
    createTrip: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTrip: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTrip: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refetchTrips: () => query.refetch(),
  };
}
