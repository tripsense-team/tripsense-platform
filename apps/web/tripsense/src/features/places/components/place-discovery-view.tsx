"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Compass, Sparkles, Coffee, Utensils, Waves, ShoppingBag } from "lucide-react";
import { SearchBar } from "./search-bar";
import { PlaceDetailModal } from "./place-detail-modal";
import { searchPlaces, getPlaceDetails } from "../services/places-api";
import type { Place } from "../types";

// Dynamically import MapVina container with ssr disabled
const MapVinaContainer = dynamic(
  () => import("@/features/map/components/mapvina-container").then((mod) => mod.MapVinaContainer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-border bg-muted/40 text-muted-foreground text-sm font-medium animate-pulse">
        <span>Đang tải bản đồ MapVina khám phá...</span>
      </div>
    ),
  }
);

const CATEGORY_CHIPS = [
  { id: "all", label: "Tất cả", query: "địa điểm nổi tiếng ở Đà Nẵng", icon: Compass },
  { id: "food", label: "Nhà hàng", query: "nhà hàng quán ăn ngon Đà Nẵng", icon: Utensils },
  { id: "cafe", label: "Quán cafe", query: "quán cafe đẹp Đà Nẵng", icon: Coffee },
  { id: "seafood", label: "Hải sản", query: "quán hải sản tươi ngon Đà Nẵng", icon: Waves },
  { id: "attraction", label: "Tham quan", query: "điểm tham quan du lịch Đà Nẵng", icon: Sparkles },
  { id: "shopping", label: "Mua sắm", query: "trung tâm thương mại siêu thị Đà Nẵng", icon: ShoppingBag },
];

export function PlaceDiscoveryView() {
  const [query, setQuery] = React.useState("");
  const [places, setPlaces] = React.useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = React.useState<string | null>(null);
  const [detailPlace, setDetailPlace] = React.useState<Place | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState("all");

  const currentViewportRef = React.useRef<{ lat: number; lng: number; zoom: number; radius: number } | null>(null);
  const activeCategoryQueryRef = React.useRef("địa điểm nổi tiếng ở Đà Nẵng");
  const viewportDebounceTimer = React.useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const inMemoryGridCacheRef = React.useRef<Set<string>>(new Set());

  // In-memory cache for deep details to avoid redundant API calls and prevent layout jumps
  const detailsCacheRef = React.useRef<Record<string, Place>>({});
  const inflightRef = React.useRef<Set<string>>(new Set());

  const executeSearch = React.useCallback(
    async (searchQuery: string, autoPinFirstMatch: boolean = false, useCurrentViewport: boolean = true) => {
      const q = searchQuery.trim() || activeCategoryQueryRef.current || "địa điểm nổi tiếng ở Đà Nẵng";
      setIsLoading(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const searchParams: {
          q: string;
          lat?: number;
          lng?: number;
          radius?: number;
          signal: AbortSignal;
        } = {
          q,
          signal: controller.signal,
        };

        if (useCurrentViewport && currentViewportRef.current) {
          searchParams.lat = currentViewportRef.current.lat;
          searchParams.lng = currentViewportRef.current.lng;
          searchParams.radius = currentViewportRef.current.radius;
        }

        const res = await searchPlaces(searchParams);
        if (res.success && Array.isArray(res.data)) {
          setPlaces(res.data);
          if (autoPinFirstMatch && res.data.length > 0) {
            setSelectedPlaceId(res.data[0].id);
          } else if (!autoPinFirstMatch) {
            setSelectedPlaceId((prev) => (prev && res.data.some((p) => p.id === prev) ? prev : null));
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          console.error("Place search error:", err);
          setPlaces([]);
          setSelectedPlaceId(null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load: Fetch real places across Da Nang directly on open without filling search input
  React.useEffect(() => {
    let ignore = false;

    searchPlaces({ q: "địa điểm nổi tiếng ở Đà Nẵng" })
      .then((res) => {
        if (!ignore && res.success && Array.isArray(res.data)) {
          setPlaces(res.data);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Place search error:", err);
          setPlaces([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Performance-Optimized Complete-Stop Viewport Discovery
  const handleViewportChange = React.useCallback(
    (viewport: { lat: number; lng: number; zoom: number; radius: number }) => {
      currentViewportRef.current = viewport;
      const activeQ = query.trim() || activeCategoryQueryRef.current || "quán ăn ẩm thực địa điểm";
      const gridKey = `${activeQ}_${viewport.lat.toFixed(2)}_${viewport.lng.toFixed(2)}_${Math.round(viewport.zoom)}`;

      // Zero network call if this specific quadrant has already been queried in this session
      if (inMemoryGridCacheRef.current.has(gridKey)) {
        return;
      }

      if (viewportDebounceTimer.current) {
        clearTimeout(viewportDebounceTimer.current);
      }

      // User must come to a COMPLETE REST for 600ms before sending query
      viewportDebounceTimer.current = setTimeout(async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
          const res = await searchPlaces({
            q: activeQ,
            lat: viewport.lat,
            lng: viewport.lng,
            radius: viewport.radius,
            signal: controller.signal,
          });

          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            inMemoryGridCacheRef.current.add(gridKey);
            setPlaces((prev) => {
              const map = new Map<string, Place>();
              prev.forEach((p) => map.set(p.id, p));
              res.data.forEach((p) => map.set(p.id, p));
              return Array.from(map.values());
            });
          }
        } catch (err: unknown) {
          if ((err as Error)?.name !== "AbortError") {
            console.warn("Viewport dynamic discovery error:", err);
          }
        }
      }, 600);
    },
    [query]
  );

  // Synchronize selection
  const handleSelectPlace = (id: string | null) => {
    setSelectedPlaceId(id);
  };

  // Add and select a base map POI, enriching with full MapVina address in background
  const handleAddAndSelectPlace = React.useCallback(async (place: Place) => {
    setSelectedPlaceId(place.id);

    // 1. Add to places state immediately so marker and popup card appear
    setPlaces((prev) => {
      if (!prev.some((p) => p.id === place.id || (p.name === place.name && Math.abs((p.location?.lat || 0) - (place.location?.lat || 0)) < 0.001))) {
        return [place, ...prev];
      }
      return prev;
    });

    // 2. Enrich in background via MapVina search to get full official address, district, ward & categories
    if (place.name && place.location) {
      try {
        const res = await searchPlaces({
          q: place.name,
          lat: place.location.lat,
          lng: place.location.lng,
          radius: 2000,
          limit: 1,
        });
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const match = res.data[0];
          const enriched: Place = {
            ...place,
            ...match,
            id: place.id, // keep id stable for selection
            address: match.address || place.address,
            categories: match.categories && match.categories.length > 0 ? match.categories : place.categories,
          };
          setPlaces((prev) => prev.map((p) => (p.id === place.id ? enriched : p)));
        }
      } catch (e) {
        console.debug("Background place enrichment error:", e);
      }
    }
  }, []);

  // Synchronized details opener with intelligent caching
  const handleOpenDetails = React.useCallback(async (place: Place) => {
    const lookupId = place.id || place.providerPlaceId;
    setSelectedPlaceId(place.id);

    // Ensure place is present in places state so it renders a marker on the map
    setPlaces((prev) => {
      if (!prev.some((p) => p.id === place.id || (p.name === place.name && Math.abs((p.location?.lat || 0) - (place.location?.lat || 0)) < 0.001))) {
        return [place, ...prev];
      }
      return prev;
    });

    // Check if we already have deep details in cache
    if (lookupId && detailsCacheRef.current[lookupId]) {
      setDetailPlace(detailsCacheRef.current[lookupId]);
      setIsDetailOpen(true);
      setIsLoadingDetails(false);
      return;
    }

    // Open modal immediately with current known data
    setDetailPlace(place);
    setIsDetailOpen(true);

    // If place already has full rich reviews and opening hours, cache and finish
    const hasFullRichData = place.reviews && place.reviews.length > 0 && place.openingHours;
    if (hasFullRichData) {
      if (lookupId) {
        detailsCacheRef.current[lookupId] = place;
      }
      setIsLoadingDetails(false);
      return;
    }

    if (!lookupId || inflightRef.current.has(lookupId)) {
      return;
    }

    // Fetch deep details in the background and smoothly merge
    inflightRef.current.add(lookupId);
    setIsLoadingDetails(true);

    try {
      const res = await getPlaceDetails(lookupId, place.name, place.location?.lat, place.location?.lng);
      if (res && res.success && res.data) {
        const enriched = { ...place, ...res.data };
        detailsCacheRef.current[lookupId] = enriched;

        // Smoothly update detail place only if user is still looking at this place
        setDetailPlace((prev) => (prev && (prev.id === place.id || prev.providerPlaceId === place.providerPlaceId) ? enriched : prev));

        // Synchronize with places list
        setPlaces((prevPlaces) =>
          prevPlaces.map((p) => (p.id === place.id || p.providerPlaceId === place.providerPlaceId ? enriched : p))
        );
      }
    } catch (err) {
      console.warn("Place details fetch error:", err);
    } finally {
      inflightRef.current.delete(lookupId);
      setIsLoadingDetails(false);
    }
  }, []);

  const handleCategoryClick = (cat: typeof CATEGORY_CHIPS[0]) => {
    setActiveCategory(cat.id);
    activeCategoryQueryRef.current = cat.query;
    executeSearch(cat.query, false, true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] w-full overflow-hidden p-2 sm:p-4 lg:p-5 max-w-7xl mx-auto space-y-3">
      {/* Top Header: Search Bar & Filter Chips (Clean & Unobstructed) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <div className="flex-1 max-w-2xl">
          <SearchBar
            initialQuery={query}
            onSearch={(val, suggestion) => {
              setQuery(val);
              // Explicit keyword search searches city-wide and flies to top match
              executeSearch(val, true, false);
            }}
            onClear={() => {
              setQuery("");
              setActiveCategory("all");
              activeCategoryQueryRef.current = "địa điểm nổi tiếng ở Đà Nẵng";
              executeSearch("địa điểm nổi tiếng ở Đà Nẵng", false, false);
            }}
            isLoading={isLoading}
          />
        </div>

        {/* Quick Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0 scrollbar-none">
          {CATEGORY_CHIPS.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-xs"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-Width Unobstructed Discovery Map Canvas with Google Maps Style Viewport Discovery */}
      <div className="flex-1 min-h-[500px] h-full w-full overflow-hidden rounded-3xl">
        <MapVinaContainer
          places={places}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={handleSelectPlace}
          onAddAndSelectPlace={handleAddAndSelectPlace}
          onViewDetails={handleOpenDetails}
          onViewportChange={handleViewportChange}
          center={[108.2208, 16.0678]} // Da Nang center
          zoom={13}
          className="h-full w-full shadow-md"
        />
      </div>

      {/* Place Detail Modal */}
      <PlaceDetailModal
        place={detailPlace}
        isOpen={isDetailOpen}
        isLoadingDetails={isLoadingDetails}
        onClose={() => {
          setIsDetailOpen(false);
          setIsLoadingDetails(false);
        }}
      />
    </div>
  );
}
