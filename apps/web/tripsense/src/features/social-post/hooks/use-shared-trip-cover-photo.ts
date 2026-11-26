"use client";

import * as React from "react";
import { searchPlaces } from "@/features/places/services/places-api";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import type { PublicTripSnapshot, SharedTripSummary } from "../types";

const NEXT_IMAGE_ALLOWED_HOSTS = new Set([
  "maps.mapvina.com",
  "ziomap-api.socibi.com",
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "res.cloudinary.com",
  "img.vietqr.io",
]);

const ITEM_TYPE_PRIORITY: Record<string, number> = {
  PLACE: 0,
  ACTIVITY: 1,
  MEAL: 2,
  HOTEL: 3,
};

const sharedTripCoverCache = new Map<string, string | null>();
const inFlightCoverQueries = new Map<string, Promise<string | null>>();

export function clearSharedTripCoverPhotoCache(): void {
  sharedTripCoverCache.clear();
  inFlightCoverQueries.clear();
}

export function shouldUseUnoptimizedImage(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  if (url.startsWith("/")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (NEXT_IMAGE_ALLOWED_HOSTS.has(host)) return false;
    if (host.endsWith(".googleusercontent.com")) return false;
    return true;
  } catch {
    return true;
  }
}

export function pickSharedTripCoverQuery(
  trip: Pick<SharedTripSummary, "destinationName" | "highlights" | "name">,
  publication?: PublicTripSnapshot | null,
): string | null {
  const destination = trip.destinationName?.trim() || "";

  if (publication?.days?.length) {
    const publicItems = publication.days.flatMap((day) => day.items ?? []);
    const ranked = publicItems
      .map((item, index) => ({
        item,
        index,
        priority: ITEM_TYPE_PRIORITY[item.type] ?? 5,
      }))
      .sort((a, b) => a.priority - b.priority || a.index - b.index);

    for (const { item } of ranked) {
      const label = (item.placeName || item.title || "").trim();
      if (!label) continue;
      if (
        item.type === "HOTEL" ||
        item.type === "FLIGHT" ||
        item.type === "TRANSFER"
      ) {
        continue;
      }
      return [label, destination].filter(Boolean).join(" ").trim();
    }
  }

  if (trip.highlights?.length) {
    for (const highlight of trip.highlights) {
      const label = (highlight.placeName || highlight.title || "").trim();
      if (label) {
        return [label, destination].filter(Boolean).join(" ").trim();
      }
    }
  }

  return destination || null;
}

async function resolveCoverByQuery(query: string): Promise<string | null> {
  const cacheKey = query.toLowerCase();
  if (sharedTripCoverCache.has(cacheKey)) {
    return sharedTripCoverCache.get(cacheKey) ?? null;
  }

  const existing = inFlightCoverQueries.get(cacheKey);
  if (existing) {
    return existing;
  }

  const request = searchPlaces({ q: query, limit: 3 })
    .then((response) => {
      const places = response.data ?? [];
      for (const place of places) {
        const photoUrl = getPlacePhotoUrl(place);
        if (photoUrl) {
          sharedTripCoverCache.set(cacheKey, photoUrl);
          return photoUrl;
        }
      }
      sharedTripCoverCache.set(cacheKey, null);
      return null;
    })
    .catch(() => {
      return null;
    })
    .finally(() => {
      inFlightCoverQueries.delete(cacheKey);
    });

  inFlightCoverQueries.set(cacheKey, request);
  return request;
}

/**
 * Resolves a real place photo for community shared-trip cards when the stored
 * snapshot has no `coverImageUrl` yet (legacy posts). Uses viewport lazy-trigger,
 * module cache, and single-flight request deduplication for optimal performance.
 */
export function useSharedTripCoverPhoto(
  trip: Pick<
    SharedTripSummary,
    "coverImageUrl" | "destinationName" | "highlights" | "name"
  >,
  publication?: PublicTripSnapshot | null,
  enabled = true,
): string | null {
  const explicitCover =
    publication?.summary?.coverImageUrl?.trim() ||
    trip.coverImageUrl?.trim() ||
    null;

  const query = React.useMemo(
    () => (explicitCover ? null : pickSharedTripCoverQuery(trip, publication)),
    [explicitCover, trip, publication],
  );

  const [resolvedUrl, setResolvedUrl] = React.useState<string | null>(() => {
    if (explicitCover) return explicitCover;
    if (!query) return null;
    return sharedTripCoverCache.get(query.toLowerCase()) ?? null;
  });

  React.useEffect(() => {
    if (explicitCover) {
      setResolvedUrl(explicitCover);
      return;
    }
    if (!enabled || !query) {
      return;
    }
    const cached = sharedTripCoverCache.get(query.toLowerCase());
    if (cached !== undefined) {
      setResolvedUrl(cached);
      return;
    }

    let active = true;
    void resolveCoverByQuery(query).then((url) => {
      if (active && url) {
        setResolvedUrl(url);
      }
    });

    return () => {
      active = false;
    };
  }, [explicitCover, enabled, query]);

  return explicitCover || resolvedUrl;
}
