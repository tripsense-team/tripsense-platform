"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  RotateCcw,
  Map as MapIcon,
  ListFilter,
} from "lucide-react";
import { PlaceDetailOverlay } from "./place-detail-overlay";
import {
  ExploreFeedHeader,
  DESTINATION_PRESETS,
  type DestinationPreset,
  EXPLORE_CATEGORY_TABS,
  type CategoryTabItem,
} from "./explore-feed-header";
import { MindtripPlaceCard } from "./mindtrip-place-card";
import { searchPlaces, getPlaceDetails } from "../services/places-api";
import {
  getExploreForYou,
  recordRecommendationEvent,
} from "../services/recommendations-api";
import { useExploreStore } from "../store/use-explore-store";
import type { Place } from "../types";
import { useAuthStore } from "@/features/auth";
import { prefetchUserTrips } from "@/features/trip-management";
import { approvedPhotoGallery, hasFreshPhotoLookup } from "../utils/approved-photo";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

const PLACES_PER_PAGE = 16;

// Dynamically import MapVina container with SSR disabled
const MapVinaContainer = dynamic(
  () =>
    import("@/features/map/components/mapvina-container").then(
      (mod) => mod.MapVinaContainer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-l-2xl lg:rounded-l-3xl bg-muted/20 text-muted-foreground animate-pulse">
        <Compass className="h-8 w-8 animate-spin text-muted-foreground/40" />
      </div>
    ),
  },
);

export function PlaceDiscoveryView() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  React.useEffect(() => {
    if (isAuthenticated) {
      void prefetchUserTrips();
    }
  }, [isAuthenticated]);

  const {
    currentDestination,
    setCurrentDestination,
    activeCategoryId,
    setActiveCategoryId,
    query,
    setQuery,
    committedQuery,
    setCommittedQuery,
    places,
    setPlaces,
    selectedPlaceId,
    setSelectedPlaceId,
    detailPlace,
    setDetailPlace,
    isDetailOpen,
    setIsDetailOpen,
    isLoading,
    setIsLoading,
    isLoadingDetails,
    setIsLoadingDetails,
    isPanelCollapsed,
    setIsPanelCollapsed,
    showExploreAreaBtn,
    setShowExploreAreaBtn,
    mobileTab,
    setMobileTab,
    hasInitialFetched,
    setHasInitialFetched,
    recommendationId,
    recommendationRanks,
    recommendationFallbackLevel,
    recommendationIsStale,
    setRecommendationMeta,
    loadedUserId,
    cacheCategoryResult,
    getCachedCategoryResult,
    resetExploreState,
  } = useExploreStore();

  const currentViewportRef = React.useRef<{
    lat: number;
    lng: number;
    zoom: number;
    radius: number;
  }>({
    lat: DESTINATION_PRESETS[0].lat,
    lng: DESTINATION_PRESETS[0].lng,
    zoom: 13,
    radius: 12000,
  });

  const activeCategoryQueryRef = React.useRef(DESTINATION_PRESETS[0].defaultQuery);
  const viewportDebounceTimer = React.useRef<NodeJS.Timeout | null>(null);
  const explicitSearchControllerRef = React.useRef<AbortController | null>(null);
  const recommendationControllerRef = React.useRef<AbortController | null>(null);
  const viewportSearchControllerRef = React.useRef<AbortController | null>(null);
  const explicitSearchRequestIdRef = React.useRef(0);
  const viewportSearchRequestIdRef = React.useRef(0);
  const explicitSearchPendingRef = React.useRef(false);
  const initialSearchPendingRef = React.useRef(true);
  const inMemoryGridCacheRef = React.useRef<Set<string>>(new Set());
  const recommendationRequestIdRef = React.useRef(0);
  const feedbackKeysRef = React.useRef<Set<string>>(new Set());
  const feedHeadingRef = React.useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sessionId] = React.useState(() =>
    typeof crypto !== "undefined"
      ? `explore.${crypto.randomUUID()}`
      : "explore.session",
  );

  // In-memory cache for deep details
  const detailsCacheRef = React.useRef<Record<string, Place>>({});
  const photoCheckedAtRef = React.useRef<Record<string, number>>({});
  const inflightRef = React.useRef<Set<string>>(new Set());

  const executeSearch = React.useCallback(
    async (
      searchQuery: string,
      autoPinFirstMatch: boolean = false,
      useCurrentViewport: boolean = true,
      categoryOverride?: string
    ) => {
      const catId = categoryOverride || activeCategoryId;
      const category = EXPLORE_CATEGORY_TABS.find((tab) => tab.id === catId)?.category;
      const q =
        searchQuery.trim() ||
        activeCategoryQueryRef.current ||
        currentDestination.defaultQuery;

      setIsLoading(true);
      explicitSearchPendingRef.current = true;

      if (viewportDebounceTimer.current) {
        clearTimeout(viewportDebounceTimer.current);
        viewportDebounceTimer.current = null;
      }
      viewportSearchRequestIdRef.current += 1;
      viewportSearchControllerRef.current?.abort();
      viewportSearchControllerRef.current = null;

      explicitSearchControllerRef.current?.abort();
      const controller = new AbortController();
      explicitSearchControllerRef.current = controller;
      const requestId = ++explicitSearchRequestIdRef.current;

      try {
        const searchParams: {
          q: string;
          lat?: number;
          lng?: number;
          radius?: number;
          limit?: number;
          category?: CategoryTabItem["category"];
          signal: AbortSignal;
        } = {
          q,
          signal: controller.signal,
          limit: category ? 48 : 20,
          category,
        };

        if (useCurrentViewport && currentViewportRef.current) {
          searchParams.lat = currentViewportRef.current.lat;
          searchParams.lng = currentViewportRef.current.lng;
          searchParams.radius = currentViewportRef.current.radius;
        } else {
          searchParams.lat = currentDestination.lat;
          searchParams.lng = currentDestination.lng;
        }

        const res = await searchPlaces(searchParams);
        if (
          requestId === explicitSearchRequestIdRef.current &&
          !controller.signal.aborted &&
          res.success &&
          Array.isArray(res.data)
        ) {
          if (res.data.length > 0) {
            setPlaces(res.data);
            setCurrentPage(1);
          }
          const cacheSuffix =
            catId === "for-you" || category ? "" : searchQuery.trim();
          const cacheKey = `${currentDestination.id}:${catId}:${cacheSuffix}`;
          if (res.data.length > 0) cacheCategoryResult(cacheKey, res.data);
          setShowExploreAreaBtn(false);
          if (autoPinFirstMatch && res.data.length > 0) {
            setSelectedPlaceId(res.data[0].id);
          } else if (!autoPinFirstMatch) {
            setSelectedPlaceId((prev) =>
              prev && res.data.some((p) => p.id === prev) ? prev : null
            );
          }
        }
      } catch (err: unknown) {
        if (
          requestId === explicitSearchRequestIdRef.current &&
          (err as Error)?.name !== "AbortError"
        ) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[PlaceDiscovery] Search failed", { operation: "place_search" });
          }
        }
      } finally {
        if (
          requestId === explicitSearchRequestIdRef.current &&
          explicitSearchControllerRef.current === controller
        ) {
          if (!useCurrentViewport) {
            initialSearchPendingRef.current = false;
          }
          explicitSearchPendingRef.current = false;
          explicitSearchControllerRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [
      currentDestination.id,
      currentDestination.lat,
      currentDestination.lng,
      currentDestination.defaultQuery,
      activeCategoryId,
      cacheCategoryResult,
      setPlaces,
      setShowExploreAreaBtn,
      setSelectedPlaceId,
      setIsLoading,
    ]
  );

  const executeForYou = React.useCallback(
    async (submittedQuery: string) => {
      if (!isAuthenticated || authStatus !== "authenticated") return;
      recommendationControllerRef.current?.abort();
      const controller = new AbortController();
      recommendationControllerRef.current = controller;
      const requestId = ++recommendationRequestIdRef.current;
      setIsLoading(true);
      explicitSearchPendingRef.current = true;
      try {
        const response = await getExploreForYou({
          destinationId: currentDestination.id,
          query: submittedQuery,
          sessionId,
          limit: 48,
          signal: controller.signal,
        });
        if (
          requestId !== recommendationRequestIdRef.current ||
          controller.signal.aborted
        ) {
          return;
        }
        const nextPlaces = response.items.map((item) => item.place);
        if (nextPlaces.length > 0) {
          setPlaces(nextPlaces);
          setCurrentPage(1);
          cacheCategoryResult(
            `${currentDestination.id}:for-you:${submittedQuery.trim()}`,
            nextPlaces,
          );
          setSelectedPlaceId((previous) =>
            previous && nextPlaces.some((place) => place.id === previous)
              ? previous
              : null,
          );
          setRecommendationMeta({
            recommendationId: response.recommendationId,
            ranks: Object.fromEntries(
              response.items.map((item) => [item.place.id, item.rank]),
            ),
            fallbackLevel: response.fallbackLevel,
            stale: response.stale,
          });
          feedbackKeysRef.current.clear();
        }
        setShowExploreAreaBtn(false);
      } catch (error: unknown) {
        if (
          requestId === recommendationRequestIdRef.current &&
          (error as Error)?.name !== "AbortError"
        ) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[PlaceDiscovery] Recommendation unavailable; preserving current feed", {
              operation: "explore_for_you",
            });
          }
          // Keep the last compatible feed. The server owns deterministic recommendation fallback.
        }
      } finally {
        if (
          requestId === recommendationRequestIdRef.current &&
          recommendationControllerRef.current === controller
        ) {
          recommendationControllerRef.current = null;
          explicitSearchPendingRef.current = false;
          initialSearchPendingRef.current = false;
          setIsLoading(false);
        }
      }
    }, [
      isAuthenticated,
      authStatus,
      currentDestination.id,
      sessionId,
      cacheCategoryResult,
      setIsLoading,
      setPlaces,
      setRecommendationMeta,
      setSelectedPlaceId,
      setShowExploreAreaBtn,
    ],
  );

  const executeForYouRef = React.useRef(executeForYou);
  const executeSearchRef = React.useRef(executeSearch);

  React.useEffect(() => {
    executeForYouRef.current = executeForYou;
    executeSearchRef.current = executeSearch;
  }, [executeForYou, executeSearch]);

  React.useEffect(() => {
    const nextUserId = userId;
    if (loadedUserId === nextUserId) return;
    recommendationControllerRef.current?.abort();
    recommendationRequestIdRef.current += 1;
    resetExploreState(nextUserId);
  }, [
    userId,
    loadedUserId,
    resetExploreState,
  ]);

  // Initial load
  React.useEffect(() => {
    if (authStatus === "checking") return;
    if (hasInitialFetched) return;

    setHasInitialFetched(true);
    if (isAuthenticated) {
      void executeForYouRef.current("");
    } else {
      void executeSearchRef.current(currentDestination.defaultQuery, false, false);
    }
  }, [
    authStatus,
    isAuthenticated,
    currentDestination.defaultQuery,
    hasInitialFetched,
    setHasInitialFetched,
  ]);

  React.useEffect(() => {
    return () => {
      if (viewportDebounceTimer.current) {
        clearTimeout(viewportDebounceTimer.current);
      }
      explicitSearchRequestIdRef.current += 1;
      viewportSearchRequestIdRef.current += 1;
      explicitSearchControllerRef.current?.abort();
      viewportSearchControllerRef.current?.abort();
      recommendationControllerRef.current?.abort();
    };
  }, []);

  // Handle Destination Switcher (e.g. Hue, Da Nang, Hoi An)
  const handleSelectDestination = (dest: DestinationPreset) => {
    setCurrentDestination(dest);
    setQuery("");
    setCommittedQuery("");
    setActiveCategoryId("for-you");
    activeCategoryQueryRef.current = dest.defaultQuery;
    currentViewportRef.current = {
      lat: dest.lat,
      lng: dest.lng,
      zoom: 13,
      radius: 12000,
    };
    inMemoryGridCacheRef.current.clear();
    setPlaces([]);
    setHasInitialFetched(false);
    setRecommendationMeta(null);
    setCurrentPage(1);
  };

  // Handle category tab switch (Food, Cafés, Stays, Attractions).
  const handleSelectCategory = (tab: CategoryTabItem) => {
    setActiveCategoryId(tab.id);
    setCurrentPage(1);
    if (tab.id === "for-you") {
      setQuery("");
      setCommittedQuery("");
      const cachedForYou = getCachedCategoryResult(
        `${currentDestination.id}:for-you:`,
      );
      if (cachedForYou !== undefined) {
        setPlaces(cachedForYou);
        setCurrentPage(1);
        setIsLoading(false);
        setShowExploreAreaBtn(false);
        return;
      }
      setPlaces([]);
      setRecommendationMeta(null);
      if (isAuthenticated) {
        void executeForYou("");
      } else {
        void executeSearch(currentDestination.defaultQuery, false, false, tab.id);
      }
      return;
    }
    setQuery("");
    setCommittedQuery("");
    setRecommendationMeta(null);
    const combinedQuery = `${tab.queryKeyword} ở ${currentDestination.name}`;
    activeCategoryQueryRef.current = combinedQuery;

    const cacheKey = `${currentDestination.id}:${tab.id}:`;
    const cached = getCachedCategoryResult(cacheKey);
    if (cached !== undefined) {
      setPlaces(cached);
      setCurrentPage(1);
      setIsLoading(false);
      setShowExploreAreaBtn(false);
      return;
    }

    setPlaces([]);
    executeSearch(combinedQuery, false, true, tab.id);
  };

  // Viewport change on map pan/zoom
  const handleViewportChange = React.useCallback(
    (viewport: { lat: number; lng: number; zoom: number; radius: number }) => {
      currentViewportRef.current = viewport;
      if (activeCategoryId === "for-you") {
        setShowExploreAreaBtn(false);
        return;
      }
      setShowExploreAreaBtn(true);

      const activeQ =
        query.trim() ||
        activeCategoryQueryRef.current ||
        currentDestination.defaultQuery;
      const gridKey = `${activeQ}_${viewport.lat.toFixed(2)}_${viewport.lng.toFixed(2)}_${Math.round(viewport.zoom)}`;

      if (inMemoryGridCacheRef.current.has(gridKey)) {
        setShowExploreAreaBtn(false);
        return;
      }

      if (viewportDebounceTimer.current) {
        clearTimeout(viewportDebounceTimer.current);
      }

      // Idle debounced search
      viewportDebounceTimer.current = setTimeout(async () => {
        viewportDebounceTimer.current = null;
        if (initialSearchPendingRef.current || explicitSearchPendingRef.current) return;

        viewportSearchControllerRef.current?.abort();
        const controller = new AbortController();
        viewportSearchControllerRef.current = controller;
        const requestId = ++viewportSearchRequestIdRef.current;

        try {
          const res = await searchPlaces({
            q: activeQ,
            category: EXPLORE_CATEGORY_TABS.find((tab) => tab.id === activeCategoryId)
              ?.category,
            lat: viewport.lat,
            lng: viewport.lng,
            radius: viewport.radius,
            limit: 48,
            signal: controller.signal,
          });

          if (
            requestId === viewportSearchRequestIdRef.current &&
            !controller.signal.aborted &&
            !explicitSearchPendingRef.current &&
            res.success &&
            Array.isArray(res.data) &&
            res.data.length > 0
          ) {
            inMemoryGridCacheRef.current.add(gridKey);
            setShowExploreAreaBtn(false);
            setCurrentPage(1);
            setPlaces((prev) => {
              const map = new Map<string, Place>();
              prev.forEach((p) => map.set(p.id, p));
              res.data.forEach((p) => map.set(p.id, p));
              return Array.from(map.values());
            });
          }
        } catch (err: unknown) {
          if (
            requestId === viewportSearchRequestIdRef.current &&
            (err as Error)?.name !== "AbortError"
          ) {
            if (process.env.NODE_ENV === "development") {
              console.warn("[PlaceDiscovery] Viewport search failed", { operation: "viewport_search" });
            }
          }
        } finally {
          if (
            requestId === viewportSearchRequestIdRef.current &&
            viewportSearchControllerRef.current === controller
          ) {
            viewportSearchControllerRef.current = null;
          }
        }
      }, 700);
    },
    [
      query,
      currentDestination,
      activeCategoryId,
      setPlaces,
      setShowExploreAreaBtn,
    ]
  );

  const handleManualExploreArea = () => {
    if (activeCategoryId === "for-you" && isAuthenticated) {
      void executeForYou(committedQuery);
      return;
    }
    executeSearch(
      query || activeCategoryQueryRef.current || currentDestination.defaultQuery,
      false,
      true
    );
  };

  const handleSelectPlace = (id: string | null) => {
    setSelectedPlaceId(id);
  };

  const isNameMatch = React.useCallback(
    (nameA: string, nameB: string): boolean => {
      const normalize = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/gi, "d")
          .toLowerCase()
          .trim();

      const a = normalize(nameA);
      const b = normalize(nameB);
      if (a === b || a.includes(b) || b.includes(a)) return true;

      const tokensA = a.split(/[\s,\-_/.]+/).filter((t) => t.length >= 2);
      const tokensB = b.split(/[\s,\-_/.]+/).filter((t) => t.length >= 2);
      const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
      const longerSet = new Set(
        tokensA.length > tokensB.length ? tokensA : tokensB
      );
      if (shorter.length === 0) return false;
      return shorter.filter((t) => longerSet.has(t)).length / shorter.length >= 0.5;
    },
    []
  );

  const handleAddAndSelectPlace = React.useCallback(
    async (place: Place) => {
      setSelectedPlaceId(place.id);
      setPlaces((prev) => {
        if (
          !prev.some(
            (p) =>
              p.id === place.id ||
              (p.name === place.name &&
                Math.abs((p.location?.lat || 0) - (place.location?.lat || 0)) < 0.001)
          )
        ) {
          return [place, ...prev];
        }
        return prev;
      });

      if (place.name && place.location) {
        try {
          const res = await searchPlaces({
            q: place.name,
            lat: place.location.lat,
            lng: place.location.lng,
            radius: 2000,
            limit: 5,
          });
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            const match = res.data.find((candidate) => {
              if (!candidate.name) return false;
              if (!isNameMatch(place.name, candidate.name)) return false;
              return true;
            });
            if (match) {
              const enriched: Place = {
                ...place,
                ...match,
                id: place.id,
                providerPlaceId: match.providerPlaceId || match.id,
                address: match.address || place.address,
                categories:
                  match.categories && match.categories.length > 0
                    ? match.categories
                    : place.categories,
              };
              setPlaces((prev) =>
                prev.map((p) => (p.id === place.id ? enriched : p))
              );
            }
          }
        } catch {
          if (process.env.NODE_ENV === "development") {
            console.warn("[PlaceDiscovery] Background enrichment failed", {
              operation: "place_enrichment",
            });
          }
        }
      }
    },
    [isNameMatch, setPlaces, setSelectedPlaceId]
  );

  const handleOpenDetails = React.useCallback(
    async (
      place: Place,
      openImmediately: boolean = true,
      addToFeed: boolean = true,
    ) => {
      const lookupId =
        place.providerPlaceId && !place.providerPlaceId.startsWith("poi_")
          ? place.providerPlaceId
          : place.id;
      setSelectedPlaceId(place.id);

      if (addToFeed) {
        setPlaces((prev) => {
          if (
            !prev.some(
              (p) =>
                p.id === place.id ||
                (p.name === place.name &&
                  Math.abs((p.location?.lat || 0) - (place.location?.lat || 0)) < 0.001)
            )
          ) {
            return [place, ...prev];
          }
          return prev;
        });
      }

      const cached = lookupId ? detailsCacheRef.current[lookupId] : undefined;
      const photoEnabled = process.env.NEXT_PUBLIC_PLACE_PHOTOS_ENABLED === "true";
      const photoCheckedAt = lookupId ? photoCheckedAtRef.current[lookupId] : undefined;
      if (cached && (!photoEnabled || hasFreshPhotoLookup(cached, photoCheckedAt))) {
        setDetailPlace(cached);
        setIsDetailOpen(true);
        setIsLoadingDetails(false);
        return;
      }

      if (openImmediately) {
        setDetailPlace(place);
        setIsDetailOpen(true);
      }

      const existingPhoto = approvedPhotoGallery(place.photoGallery, place.primaryPhoto)[0];
      const existingPhotoCheckedAt = existingPhoto ? Date.parse(existingPhoto.fetchedAt) : undefined;
      const hasFullRichData =
        place.reviews &&
        place.reviews.length > 0 &&
        place.openingHours &&
        (!photoEnabled || hasFreshPhotoLookup(place, existingPhotoCheckedAt));

      if (hasFullRichData) {
        if (lookupId) {
          detailsCacheRef.current[lookupId] = place;
          if (photoEnabled && existingPhotoCheckedAt !== undefined) {
            photoCheckedAtRef.current[lookupId] = existingPhotoCheckedAt;
          }
        }
        setDetailPlace(place);
        setIsDetailOpen(true);
        setIsLoadingDetails(false);
        return;
      }

      if (!lookupId || inflightRef.current.has(lookupId)) {
        if (!openImmediately) {
          setDetailPlace(place);
          setIsDetailOpen(true);
        }
        return;
      }

      inflightRef.current.add(lookupId);
      setIsLoadingDetails(true);

      try {
        const res = await getPlaceDetails(
          lookupId,
          place.name,
          place.location?.lat,
          place.location?.lng,
          undefined,
          photoEnabled
        );
        if (res && res.success && res.data) {
          const enriched = photoEnabled
            ? { ...place, ...res.data, primaryPhoto: res.data.primaryPhoto, photoGallery: res.data.photoGallery }
            : { ...place, ...res.data };
          detailsCacheRef.current[lookupId] = enriched;
          if (photoEnabled) photoCheckedAtRef.current[lookupId] = Date.now();

          setDetailPlace(enriched);
          setIsDetailOpen(true);

          setPlaces((prevPlaces) =>
            prevPlaces.map((p) =>
              p.id === place.id || p.providerPlaceId === place.providerPlaceId
                ? enriched
                : p
            )
          );
        } else if (!openImmediately) {
          setDetailPlace(place);
          setIsDetailOpen(true);
        }
      } catch {
        if (process.env.NODE_ENV === "development") {
          console.warn("[PlaceDiscovery] Details fetch failed", { operation: "place_details" });
        }
        if (!openImmediately) {
          setDetailPlace(place);
          setIsDetailOpen(true);
        }
      } finally {
        inflightRef.current.delete(lookupId);
        setIsLoadingDetails(false);
      }
    },
    [
      setDetailPlace,
      setIsDetailOpen,
      setIsLoadingDetails,
      setPlaces,
      setSelectedPlaceId,
    ]
  );

  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(() => new Set());
  const [addedPlaceIds, setAddedPlaceIds] = React.useState<Set<string>>(() => new Set());

  const emitFeedback = React.useCallback(
    async (
      placeId: string,
      eventType:
        | "IMPRESSION"
        | "CLICK"
        | "DETAIL_VIEW"
        | "SAVE"
        | "UNSAVE"
        | "ADD_TO_TRIP"
        | "REMOVE_FROM_TRIP",
    ) => {
      if (!isAuthenticated) return;
      const position = recommendationRanks[placeId];
      if (!recommendationId || !position) return;
      const key = `${recommendationId}:${placeId}:${eventType}`;
      if (feedbackKeysRef.current.has(key)) return;
      feedbackKeysRef.current.add(key);
      try {
        await recordRecommendationEvent({
          recommendationId,
          placeId,
          eventType,
          position,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch {
        if (eventType !== "IMPRESSION") {
          feedbackKeysRef.current.delete(key);
        }
      }
    },
    [isAuthenticated, recommendationId, recommendationRanks],
  );

  const handleToggleFavorite = React.useCallback(
    (placeId: string, isFav: boolean) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(placeId);
        else next.delete(placeId);
        return next;
      });
      void emitFeedback(placeId, isFav ? "SAVE" : "UNSAVE");
    },
    [emitFeedback],
  );

  const handleAddToTrip = React.useCallback(
    (place: Place) => {
      const isRemoving = addedPlaceIds.has(place.id);
      setAddedPlaceIds((prev) => {
        const next = new Set(prev);
        if (next.has(place.id)) next.delete(place.id);
        else next.add(place.id);
        return next;
      });
      void emitFeedback(
        place.id,
        isRemoving ? "REMOVE_FROM_TRIP" : "ADD_TO_TRIP",
      );
    },
    [addedPlaceIds, emitFeedback],
  );

  const handleSelectCard = React.useCallback(
    (place: Place) => {
      setSelectedPlaceId(place.id);
      void emitFeedback(place.id, "CLICK");
      void handleOpenDetails(place);
    },
    [emitFeedback, handleOpenDetails, setSelectedPlaceId],
  );

  const handleOpenDetailsForPlace = React.useCallback(
    (place: Place) => {
      void emitFeedback(place.id, "DETAIL_VIEW");
      void handleOpenDetails(place);
    },
    [emitFeedback, handleOpenDetails]
  );

  const handleMapAddAndSelectPlace = React.useCallback(
    async (place: Place) => {
      if (activeCategoryId === "for-you") {
        setSelectedPlaceId(place.id);
        await handleOpenDetails(place, true, false);
        return;
      }
      await handleAddAndSelectPlace(place);
    },
    [
      activeCategoryId,
      handleAddAndSelectPlace,
      handleOpenDetails,
      setSelectedPlaceId,
    ],
  );

  const handleMapViewDetails = React.useCallback(
    async (place: Place) => {
      void emitFeedback(place.id, "DETAIL_VIEW");
      await handleOpenDetails(place, true, activeCategoryId !== "for-you");
    },
    [activeCategoryId, emitFeedback, handleOpenDetails],
  );

  const totalPages = Math.max(1, Math.ceil(places.length / PLACES_PER_PAGE));
  const displayedPage = Math.min(currentPage, totalPages);
  const pagePlaces = React.useMemo(
    () =>
      places.slice(
        (displayedPage - 1) * PLACES_PER_PAGE,
        displayedPage * PLACES_PER_PAGE,
      ),
    [displayedPage, places],
  );

  React.useEffect(() => {
    if (!isAuthenticated || !recommendationId || pagePlaces.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    pagePlaces.forEach((place, index) => {
      if (recommendationRanks[place.id]) {
        const timer = setTimeout(() => {
          void emitFeedback(place.id, "IMPRESSION");
        }, index * 60);
        timers.push(timer);
      }
    });
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [emitFeedback, isAuthenticated, pagePlaces, recommendationId, recommendationRanks]);

  const changePage = React.useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(page, 1), totalPages));
      setSelectedPlaceId(null);
      feedHeadingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    },
    [setSelectedPlaceId, totalPages],
  );

  const activeCategoryTitle = React.useMemo(() => {
    const tab = EXPLORE_CATEGORY_TABS.find((t) => t.id === activeCategoryId);
    if (!tab) return t("places.categories.food", { defaultValue: "Food" });
    const catKey = tab.id === "for-you" ? "forYou" : tab.id;
    return t(`places.categories.${catKey}`, { defaultValue: tab.label });
  }, [activeCategoryId, t]);

  return (
    <div className="relative flex flex-col lg:flex-row h-full w-full overflow-hidden bg-background">
      {/* Mobile Tab Switcher (Floating at bottom center on mobile/tablet) */}
      <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center rounded-full bg-background/95 border border-border/80 shadow-lg p-1">
        <button
          type="button"
          onClick={() => setMobileTab("list")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
            mobileTab === "list"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ListFilter className="h-3.5 w-3.5" />
          <span>{t("places.listTab", { defaultValue: "List" })}</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("map")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
            mobileTab === "map"
              ? "bg-primary text-primary-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MapIcon className="h-3.5 w-3.5" />
          <span>{t("places.mapTab", { defaultValue: "Map" })}</span>
        </button>
      </div>

      {/* LEFT PANEL: Explore Feed & Controls (Mindtrip 2-Column Cards) */}
      <div
        style={isPanelCollapsed ? { display: "none" } : undefined}
        className={cn(
          "h-full overflow-y-auto scrollbar-thin shrink-0 w-full lg:w-[48%] xl:w-[46%] px-4 py-4 sm:px-6 sm:py-5 border-r border-border/70 flex flex-col",
          mobileTab === "map" && "hidden lg:flex"
        )}
      >
        {/* Feed Header */}
        <ExploreFeedHeader
          currentDestination={currentDestination}
          onSelectDestination={handleSelectDestination}
          searchQuery={query}
          onSearchChange={setQuery}
          onSearchSubmit={(val) => {
            const normalized = val.trim();
            if (activeCategoryId === "for-you" && isAuthenticated) {
              setCommittedQuery(normalized);
              void executeForYou(normalized);
              return;
            }
            void executeSearch(normalized, true, false);
          }}
          onSelectPlace={async (place) => {
            setSelectedPlaceId(place.id);
            await handleOpenDetails(
              place,
              false,
              activeCategoryId !== "for-you",
            );
          }}
          activeCategoryId={activeCategoryId}
          onSelectCategory={handleSelectCategory}
          isLoading={isLoading}
          className="shrink-0 mb-4"
        />

        {/* Section Heading & Result Count */}
        {activeCategoryId === "for-you" &&
          (recommendationIsStale ||
            recommendationFallbackLevel === "DESTINATION_BASELINE" ||
            recommendationFallbackLevel === "RELAXED_RETRIEVAL") && (
            <p className="mb-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {recommendationIsStale
                ? t("places.forYouShowingSaved")
                : recommendationFallbackLevel === "DESTINATION_BASELINE"
                  ? t("places.forYouRelatedAlternatives")
                  : t("places.forYouExpandedArea")}
            </p>
          )}
        <div
          ref={feedHeadingRef}
          className="flex items-center justify-between gap-2 pt-1 pb-3 shrink-0"
        >
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {activeCategoryTitle}
          </h2>
          <span className="text-xs text-muted-foreground font-medium">
            {t("places.placesCount", { count: places.length })}
          </span>
        </div>

        {/* 2-Column Grid of Mindtrip Place Cards */}
        {isLoading && places.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1 min-h-[400px]">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="flex flex-col rounded-2xl border border-border/50 bg-card overflow-hidden animate-pulse shadow-xs"
              >
                <div className="aspect-[4/3] min-h-[160px] w-full bg-muted" />
                <div className="p-3.5 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center flex-1 text-muted-foreground space-y-3 min-h-[300px]">
            <Compass className="h-10 w-10 text-muted-foreground/60 stroke-1" />
            <div>
              <p className="font-semibold text-sm text-foreground">
                {t("places.noPlacesFound", { defaultValue: "No places found" })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("places.noPlacesFoundHint", {
                  defaultValue: "Try changing search keywords or selecting another category",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCommittedQuery("");
                setActiveCategoryId("for-you");
                if (isAuthenticated) void executeForYou("");
                else void executeSearch(currentDestination.defaultQuery, false, false);
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t("places.resetFilters", { defaultValue: "Reset filters" })}</span>
            </button>
          </div>
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-7 pb-16 lg:pb-8 shrink-0 transition-opacity duration-200",
              isLoading && places.length > 0 && "opacity-60 pointer-events-none"
            )}
          >
            {pagePlaces.map((place) => (
              <MindtripPlaceCard
                key={place.id}
                place={place}
                isSelected={selectedPlaceId === place.id}
                isFavorite={favoriteIds.has(place.id)}
                isAddedToTrip={addedPlaceIds.has(place.id)}
                onToggleFavorite={handleToggleFavorite}
                onAddToTrip={handleAddToTrip}
                onClick={() => handleSelectCard(place)}
                onViewDetails={() => handleOpenDetailsForPlace(place)}
              />
            ))}
            {totalPages > 1 && (
              <nav
                aria-label={t("places.pageOf", {
                  page: displayedPage,
                  total: totalPages,
                })}
                className="col-span-full flex items-center justify-center gap-5 pt-3"
              >
                <button
                  type="button"
                  aria-label={t("places.previousPage")}
                  disabled={displayedPage === 1}
                  onClick={() => changePage(displayedPage - 1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-24 text-center text-sm font-medium text-muted-foreground">
                  {t("places.pageOf", { page: displayedPage, total: totalPages })}
                </span>
                <button
                  type="button"
                  aria-label={t("places.nextPage")}
                  disabled={displayedPage === totalPages}
                  onClick={() => changePage(displayedPage + 1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Interactive Map Canvas & Place Detail Overlay */}
      <div
        className={cn(
          "h-full relative overflow-hidden flex-1 min-w-0 w-full",
          mobileTab === "list" && !isPanelCollapsed && !isDetailOpen ? "hidden lg:block" : "block"
        )}
      >
        <MapVinaContainer
          places={pagePlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={handleSelectPlace}
          onAddAndSelectPlace={handleMapAddAndSelectPlace}
          onViewDetails={handleMapViewDetails}
          onViewportChange={handleViewportChange}
          center={[currentDestination.lng, currentDestination.lat]}
          zoom={13}
          showExploreThisArea={showExploreAreaBtn}
          onExploreAreaClick={handleManualExploreArea}
          onToggleCollapsePanel={() => setIsPanelCollapsed((prev) => !prev)}
          isPanelCollapsed={isPanelCollapsed}
          weatherText={`⛅ 79°F ${t("places.weatherBrokenClouds", { defaultValue: "Broken clouds" })}`}
          className={cn(
            "h-full w-full rounded-r-none border-0 shadow-none",
            isPanelCollapsed ? "rounded-none" : "rounded-l-2xl lg:rounded-l-3xl",
          )}
        />

        {/* Place Detail Map Overlay (Mindtrip 1:1) */}
        {isDetailOpen && detailPlace && (
          <PlaceDetailOverlay
            place={detailPlace}
            isLoadingDetails={isLoadingDetails}
            isFavorite={favoriteIds.has(detailPlace.id)}
            isAddedToTrip={addedPlaceIds.has(detailPlace.id)}
            onClose={() => {
              setIsDetailOpen(false);
              setIsLoadingDetails(false);
            }}
            onToggleFavorite={handleToggleFavorite}
            onAddToTrip={handleAddToTrip}
            isPanelCollapsed={isPanelCollapsed}
            onTogglePanel={() => setIsPanelCollapsed((prev) => !prev)}
          />
        )}
      </div>
    </div>
  );
}
