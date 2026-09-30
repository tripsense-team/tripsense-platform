"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth";
import {
  getSavedStatuses,
  getTripMemberships,
} from "../services/place-actions-api";

export const placeActionKeys = {
  all: ["place-actions"] as const,
  collections: ["place-actions", "collections"] as const,
  saved: (collectionId?: string, page = 0) =>
    ["place-actions", "saved", collectionId ?? "all", page] as const,
  savedStatuses: (refs: string[]) =>
    ["place-actions", "saved-statuses", [...refs].sort().join("|")] as const,
  tripMemberships: (refs: string[]) =>
    ["place-actions", "trip-memberships", [...refs].sort().join("|")] as const,
  tripPlaces: (tripId: string) =>
    ["place-actions", "trip-places", tripId] as const,
};

export function usePlaceActions(placeRefs: string[]) {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const refs = React.useMemo(
    () => [...new Set(placeRefs.filter(Boolean))].slice(0, 100),
    [placeRefs],
  );
  const saved = useQuery({
    queryKey: placeActionKeys.savedStatuses(refs),
    queryFn: () => getSavedStatuses(refs),
    enabled: authenticated && refs.length > 0,
  });
  const trips = useQuery({
    queryKey: placeActionKeys.tripMemberships(refs),
    queryFn: () => getTripMemberships(refs),
    enabled: authenticated && refs.length > 0,
  });

  const savedByPlace = React.useMemo(
    () => new Map((saved.data ?? []).map((item) => [item.placeRef, item])),
    [saved.data],
  );
  const tripsByPlace = React.useMemo(
    () => new Map((trips.data ?? []).map((item) => [item.placeRef, item])),
    [trips.data],
  );

  return { savedByPlace, tripsByPlace, isLoading: saved.isLoading || trips.isLoading };
}

export function useRefreshPlaceActions() {
  const queryClient = useQueryClient();
  return React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: placeActionKeys.all });
  }, [queryClient]);
}
