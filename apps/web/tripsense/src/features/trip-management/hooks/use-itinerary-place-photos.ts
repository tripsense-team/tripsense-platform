"use client";

import * as React from "react";
import { getPlaceBatchSnapshots, searchPlaces } from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import type { ItineraryResponse } from "../types";

export function resolveItemPlaceKey(item: {
  placeRef?: string | null;
  placeId?: string | null;
}): string | null {
  const ref = item.placeRef?.trim();
  if (ref) return ref;
  const id = item.placeId?.trim();
  return id || null;
}

export function resolveInstantPhoto(
  item: {
    placeRef?: string | null;
    placeId?: string | null;
    sourceItemKey?: string | null;
  },
  knownPlacePhotos?: Record<string, string>,
): string | null {
  if (!knownPlacePhotos) return null;
  const placeKey = resolveItemPlaceKey(item);
  if (placeKey && knownPlacePhotos[placeKey]) {
    return knownPlacePhotos[placeKey];
  }
  const itemKey = item.sourceItemKey?.trim();
  if (itemKey && knownPlacePhotos[itemKey]) {
    return knownPlacePhotos[itemKey];
  }
  return null;
}

export function useItineraryPlacePhotos({
  tripId,
  destinationName,
  itinerary,
  knownPlacePhotos,
}: {
  tripId?: string | null;
  destinationName?: string | null;
  itinerary: ItineraryResponse | null;
  knownPlacePhotos?: Record<string, string>;
}): Record<string, string> {
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const fetchedItemIdsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    fetchedItemIdsRef.current.clear();
    setPhotoUrls({});
  }, [tripId]);

  React.useEffect(() => {
    if (!itinerary?.days) return;
    const items = itinerary.days.flatMap((d) => d.items || []);
    if (items.length === 0) return;

    const fetchedIds = fetchedItemIdsRef.current;
    const unrequestedItems = items.filter(
      (item) =>
        !fetchedIds.has(item.id) &&
        !resolveInstantPhoto(item, knownPlacePhotos),
    );
    if (unrequestedItems.length === 0) return;

    const pendingIds = unrequestedItems.map((item) => item.id);
    for (const id of pendingIds) {
      fetchedIds.add(id);
    }
    const resolvedIds = new Set<string>();

    let active = true;
    let completed = false;
    const controller = new AbortController();

    async function loadPhotos() {
      const resolvedEntries: Array<readonly [string, string]> = [];
      const fallbackItems: typeof unrequestedItems = [];

      const batchPlaceIds = Array.from(
        new Set(
          unrequestedItems
            .map(resolveItemPlaceKey)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let snapshotsById: Record<string, Place> = {};
      if (batchPlaceIds.length > 0) {
        try {
          snapshotsById = await getPlaceBatchSnapshots(
            batchPlaceIds,
            true,
            controller.signal,
          );
        } catch {
          snapshotsById = {};
        }
      }

      if (!active || controller.signal.aborted) return;

      for (const item of unrequestedItems) {
        const placeKey = resolveItemPlaceKey(item);
        const snap = placeKey ? snapshotsById[placeKey] : undefined;
        const photoUrl = snap ? getPlacePhotoUrl(snap) : null;
        if (photoUrl) {
          resolvedEntries.push([item.id, photoUrl]);
        } else {
          fallbackItems.push(item);
        }
      }

      if (resolvedEntries.length > 0) {
        for (const [id] of resolvedEntries) {
          resolvedIds.add(id);
        }
        setPhotoUrls((prev) => {
          const next = { ...prev };
          for (const [id, url] of resolvedEntries) {
            next[id] = url;
          }
          return next;
        });
      }

      const FALLBACK_CONCURRENCY = 3;
      const fallbackEntries: Array<readonly [string, string]> = [];
      for (let i = 0; i < fallbackItems.length; i += FALLBACK_CONCURRENCY) {
        if (!active || controller.signal.aborted) return;
        const slice = fallbackItems.slice(i, i + FALLBACK_CONCURRENCY);
        const batchResults = await Promise.all(
          slice.map(async (item) => {
            try {
              const query = [item.placeNameSnapshot || item.title, destinationName]
                .filter(Boolean)
                .join(" ")
                .trim();
              if (!query) return null;
              const search = await searchPlaces({
                q: query,
                limit: 1,
                signal: controller.signal,
              });
              const candidate = search.data?.[0];
              const photoUrl = candidate ? getPlacePhotoUrl(candidate) : null;
              return photoUrl ? ([item.id, photoUrl] as const) : null;
            } catch {
              return null;
            }
          }),
        );
        for (const entry of batchResults) {
          if (entry) fallbackEntries.push(entry);
        }
      }

      if (!active || controller.signal.aborted) return;
      completed = true;
      if (fallbackEntries.length === 0) return;

      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [id, url] of fallbackEntries) {
          next[id] = url;
        }
        return next;
      });
    }

    void loadPhotos();
    return () => {
      active = false;
      controller.abort();
      if (!completed) {
        for (const id of pendingIds) {
          if (!resolvedIds.has(id)) {
            fetchedIds.delete(id);
          }
        }
      }
    };
  }, [itinerary, destinationName, knownPlacePhotos]);

  return photoUrls;
}
