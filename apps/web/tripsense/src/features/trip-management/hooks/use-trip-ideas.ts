"use client";

import * as React from "react";
import {
  listTripPlaces,
  removePlaceFromTrip,
} from "@/features/place-actions/services/place-actions-api";
import type { TripPlace } from "@/features/place-actions/types";
import { getPlaceBatchSnapshots } from "@/features/places/services/places-api";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";

export const TRIP_IDEAS_UPDATED_EVENT = "tripsense:trip-ideas-updated";

export function dispatchTripIdeasUpdated(tripId: string, placeRef?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(TRIP_IDEAS_UPDATED_EVENT, {
      detail: { tripId, placeRef },
    }),
  );
}

export function useTripIdeas({
  tripId,
  enabled = true,
  knownPlacePhotos,
}: {
  tripId?: string | null;
  enabled?: boolean;
  knownPlacePhotos?: Record<string, string>;
}) {
  const [ideas, setIdeas] = React.useState<TripPlace[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const fetchedPhotoRefsRef = React.useRef<Set<string>>(new Set());

  const loadIdeas = React.useCallback(async () => {
    if (!tripId || !enabled) {
      setIdeas([]);
      return;
    }
    setLoading(true);
    try {
      const page = await listTripPlaces(tripId);
      setIdeas(page.content ?? []);
    } catch {
      // Non-owners or unauthenticated states degrade silently to empty ideas list.
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [tripId, enabled]);

  React.useEffect(() => {
    fetchedPhotoRefsRef.current.clear();
    setPhotoUrls({});
    void loadIdeas();
  }, [loadIdeas]);

  React.useEffect(() => {
    if (!tripId || !enabled || typeof window === "undefined") return;
    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ tripId?: string }>).detail;
      if (!detail?.tripId || detail.tripId === tripId) {
        void loadIdeas();
      }
    };
    window.addEventListener(TRIP_IDEAS_UPDATED_EVENT, handleUpdated);
    return () => {
      window.removeEventListener(TRIP_IDEAS_UPDATED_EVENT, handleUpdated);
    };
  }, [tripId, enabled, loadIdeas]);

  React.useEffect(() => {
    if (!ideas.length) return;
    const missingRefs = ideas
      .map((idea) => idea.placeRef?.trim())
      .filter(
        (ref): ref is string =>
          Boolean(ref) &&
          !fetchedPhotoRefsRef.current.has(ref) &&
          !knownPlacePhotos?.[ref],
      );
    if (missingRefs.length === 0) return;

    const uniqueRefs = Array.from(new Set(missingRefs));
    for (const ref of uniqueRefs) {
      fetchedPhotoRefsRef.current.add(ref);
    }

    let active = true;
    const controller = new AbortController();

    void getPlaceBatchSnapshots(uniqueRefs, true, controller.signal)
      .then((snapshots) => {
        if (!active || controller.signal.aborted) return;
        const resolved: Record<string, string> = {};
        for (const ref of uniqueRefs) {
          const snap = snapshots[ref];
          const url = snap ? getPlacePhotoUrl(snap) : null;
          if (url) resolved[ref] = url;
        }
        if (Object.keys(resolved).length > 0) {
          setPhotoUrls((prev) => ({ ...prev, ...resolved }));
        }
      })
      .catch(() => {
        // Ignore non-critical photo backfill errors.
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [ideas, knownPlacePhotos]);

  const removeIdea = React.useCallback(
    async (placeRef: string) => {
      if (!tripId) return;
      await removePlaceFromTrip(tripId, placeRef);
      setIdeas((prev) => prev.filter((item) => item.placeRef !== placeRef));
      dispatchTripIdeasUpdated(tripId, placeRef);
    },
    [tripId],
  );

  const mergedPhotos = React.useMemo(
    () => ({ ...photoUrls, ...(knownPlacePhotos ?? {}) }),
    [photoUrls, knownPlacePhotos],
  );

  return {
    ideas,
    photoUrls: mergedPhotos,
    loading,
    refresh: loadIdeas,
    removeIdea,
  };
}
