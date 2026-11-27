"use client";

import * as React from "react";
import {
  getPlaceBatchSnapshots,
  searchPlaces,
} from "@/features/places/services/places-api";
import type { Place } from "@/features/places/types";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import { getItinerary } from "../services/trip-management-api";
import type {
  ItineraryItemResponse,
  ItineraryItemType,
  ItineraryResponse,
  TripResponse,
} from "../types";
import { resolveItemPlaceKey } from "./use-itinerary-place-photos";

const ITEM_TYPE_PRIORITY: Record<ItineraryItemType, number> = {
  PLACE: 0,
  ACTIVITY: 1,
  HOTEL: 2,
  MEAL: 3,
  TRANSFER: 4,
  FLIGHT: 5,
  NOTE: 6,
};

const MAX_CACHE_ENTRIES = 200;
const tripCoverPhotoCache = new Map<string, string | null>();

function setBoundedTripCoverCache(key: string, value: string | null): void {
  if (tripCoverPhotoCache.size >= MAX_CACHE_ENTRIES && !tripCoverPhotoCache.has(key)) {
    const oldestKey = tripCoverPhotoCache.keys().next().value;
    if (oldestKey !== undefined) {
      tripCoverPhotoCache.delete(oldestKey);
    }
  }
  tripCoverPhotoCache.set(key, value);
}

export function clearTripCoverPhotoCache(): void {
  tripCoverPhotoCache.clear();
}

function cacheKeyForTrip(trip: TripResponse): string {
  return `${trip.id}:${trip.aggregateRevision ?? trip.updatedAt ?? ""}`;
}

export function sortItemsForCoverPriority(
  itinerary: ItineraryResponse | null | undefined,
): ItineraryItemResponse[] {
  if (!itinerary?.days?.length) return [];
  const items = itinerary.days.flatMap((day) => day.items ?? []);
  return items
    .map((item, index) => ({
      item,
      index,
      priority: ITEM_TYPE_PRIORITY[item.type] ?? 5,
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map((entry) => entry.item);
}

export function pickCoverCandidatePlaceKeys(
  itinerary: ItineraryResponse | null | undefined,
): string[] {
  const orderedItems = sortItemsForCoverPriority(itinerary);
  const seen = new Set<string>();
  const keys: string[] = [];

  for (const item of orderedItems) {
    const key = resolveItemPlaceKey(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

/**
 * Resolves a real place photo from inside each trip's itinerary to use as the
 * outer trip card cover whenever the user has not explicitly set `coverImageUrl`.
 */
export function useTripCoverPhotos(
  trips: TripResponse[],
): Record<string, string> {
  const [resolvedCovers, setResolvedCovers] = React.useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {};
    for (const trip of trips) {
      if (trip.coverImageUrl) continue;
      const cached = tripCoverPhotoCache.get(cacheKeyForTrip(trip));
      if (cached) {
        initial[trip.id] = cached;
      }
    }
    return initial;
  });

  const tripsRef = React.useRef(trips);
  tripsRef.current = trips;

  const targetSignature = React.useMemo(
    () =>
      trips
        .filter((trip) => !trip.coverImageUrl)
        .map((trip) => cacheKeyForTrip(trip))
        .join("|"),
    [trips],
  );

  React.useEffect(() => {
    const targets = tripsRef.current.filter((trip) => !trip.coverImageUrl);
    if (targets.length === 0) return;

    const cachedHits: Record<string, string> = {};
    const uncachedTrips: TripResponse[] = [];

    for (const trip of targets) {
      const key = cacheKeyForTrip(trip);
      if (tripCoverPhotoCache.has(key)) {
        const url = tripCoverPhotoCache.get(key);
        if (url) cachedHits[trip.id] = url;
      } else {
        uncachedTrips.push(trip);
      }
    }

    if (Object.keys(cachedHits).length > 0) {
      setResolvedCovers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, url] of Object.entries(cachedHits)) {
          if (next[id] !== url) {
            next[id] = url;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    if (uncachedTrips.length === 0) return;

    let active = true;
    const controller = new AbortController();

    async function loadTripCovers() {
      const CONCURRENCY = 4;
      const itinerariesByTripId = new Map<string, ItineraryResponse | null>();

      for (let i = 0; i < uncachedTrips.length; i += CONCURRENCY) {
        if (!active || controller.signal.aborted) return;
        const slice = uncachedTrips.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map(async (trip) => {
            try {
              const itinerary = await getItinerary(trip.id);
              return [trip.id, itinerary] as const;
            } catch {
              return [trip.id, null] as const;
            }
          }),
        );
        for (const [tripId, itinerary] of results) {
          itinerariesByTripId.set(tripId, itinerary);
        }
      }

      if (!active || controller.signal.aborted) return;

      const candidateKeysByTripId = new Map<string, string[]>();
      const allUniquePlaceKeys = new Set<string>();

      for (const trip of uncachedTrips) {
        const keys = pickCoverCandidatePlaceKeys(
          itinerariesByTripId.get(trip.id),
        );
        candidateKeysByTripId.set(trip.id, keys);
        for (const key of keys) {
          allUniquePlaceKeys.add(key);
        }
      }

      let snapshotsById: Record<string, Place> = {};
      if (allUniquePlaceKeys.size > 0) {
        try {
          snapshotsById = await getPlaceBatchSnapshots(
            Array.from(allUniquePlaceKeys),
            true,
            controller.signal,
          );
        } catch {
          snapshotsById = {};
        }
      }

      if (!active || controller.signal.aborted) return;

      const updates: Record<string, string> = {};
      const fallbackSearchTrips: Array<{
        trip: TripResponse;
        query: string;
      }> = [];

      for (const trip of uncachedTrips) {
        const keys = candidateKeysByTripId.get(trip.id) ?? [];
        let foundUrl: string | null = null;
        for (const placeKey of keys) {
          const snap = snapshotsById[placeKey];
          const url = snap ? getPlacePhotoUrl(snap) : null;
          if (url) {
            foundUrl = url;
            break;
          }
        }

        if (foundUrl) {
          setBoundedTripCoverCache(cacheKeyForTrip(trip), foundUrl);
          updates[trip.id] = foundUrl;
        } else {
          const topNamedItem = sortItemsForCoverPriority(
            itinerariesByTripId.get(trip.id),
          ).find((item) => Boolean((item.placeNameSnapshot || item.title)?.trim()));
          const query = topNamedItem
            ? [
                topNamedItem.placeNameSnapshot || topNamedItem.title,
                trip.destinationName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim()
            : "";

          if (query) {
            fallbackSearchTrips.push({ trip, query });
          } else {
            setBoundedTripCoverCache(cacheKeyForTrip(trip), null);
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        setResolvedCovers((prev) => ({ ...prev, ...updates }));
      }

      if (fallbackSearchTrips.length === 0) return;

      const fallbackUpdates: Record<string, string> = {};
      for (let i = 0; i < fallbackSearchTrips.length; i += 3) {
        if (!active || controller.signal.aborted) return;
        const slice = fallbackSearchTrips.slice(i, i + 3);
        const results = await Promise.all(
          slice.map(async ({ trip, query }) => {
            try {
              const res = await searchPlaces({
                q: query,
                limit: 1,
                signal: controller.signal,
              });
              const candidate = res.data?.[0];
              const url = candidate ? getPlacePhotoUrl(candidate) : null;
              return { trip, url };
            } catch {
              return { trip, url: null };
            }
          }),
        );
        for (const { trip, url } of results) {
          setBoundedTripCoverCache(cacheKeyForTrip(trip), url);
          if (url) {
            fallbackUpdates[trip.id] = url;
          }
        }
      }

      if (!active || controller.signal.aborted) return;
      if (Object.keys(fallbackUpdates).length > 0) {
        setResolvedCovers((prev) => ({ ...prev, ...fallbackUpdates }));
      }
    }

    void loadTripCovers();

    return () => {
      active = false;
      controller.abort();
    };
  }, [targetSignature]);

  return resolvedCovers;
}
