"use client";

import * as React from "react";
import Image from "next/image";
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  Loader2,
  Star,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { searchPlaces } from "../services/places-api";
import type { Place, PlaceBrowseCategory } from "../types";

export interface DestinationPreset {
  id: string;
  name: string;
  lat: number;
  lng: number;
  defaultQuery: string;
}

export const DESTINATION_PRESETS: DestinationPreset[] = [
  {
    id: "danang",
    name: "Đà Nẵng",
    lat: 16.0544,
    lng: 108.2022,
    defaultQuery: "địa điểm nổi tiếng ở Đà Nẵng",
  },
  {
    id: "hue",
    name: "Huế",
    lat: 16.4637,
    lng: 107.5909,
    defaultQuery: "địa điểm nổi tiếng ở Huế",
  },
  {
    id: "hoian",
    name: "Hội An",
    lat: 15.8801,
    lng: 108.338,
    defaultQuery: "địa điểm nổi tiếng ở Hội An",
  },
];

export interface CategoryTabItem {
  id: string;
  label: string;
  queryKeyword: string;
  category?: PlaceBrowseCategory;
}

export const EXPLORE_CATEGORY_TABS: CategoryTabItem[] = [
  { id: "for-you", label: "For you", queryKeyword: "địa điểm nổi tiếng" },
  { id: "food", label: "Food", queryKeyword: "nhà hàng địa phương", category: "FOOD" },
  { id: "cafes", label: "Cafés", queryKeyword: "quán cà phê", category: "CAFE" },
  { id: "stays", label: "Stays", queryKeyword: "khách sạn", category: "STAY" },
  {
    id: "attractions",
    label: "Attractions",
    queryKeyword: "điểm tham quan",
    category: "ATTRACTION",
  },
];

export interface ExploreFeedHeaderProps {
  currentDestination: DestinationPreset;
  onSelectDestination: (dest: DestinationPreset) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (q: string) => void;
  onSelectPlace?: (place: Place) => void | Promise<void>;
  activeCategoryId: string;
  onSelectCategory: (tab: CategoryTabItem) => void;
  onToggleFilters?: () => void;
  isLoading?: boolean;
  className?: string;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (words.length === 0) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = words.some(
          (w) => w.toLowerCase() === part.toLowerCase()
        );
        return isMatch ? (
          <span key={index} className="font-bold text-foreground">
            {part}
          </span>
        ) : (
          <span key={index} className="font-normal text-foreground/80">
            {part}
          </span>
        );
      })}
    </span>
  );
}

export function ExploreFeedHeader({
  currentDestination,
  onSelectDestination,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSelectPlace,
  activeCategoryId,
  onSelectCategory,
  onToggleFilters,
  isLoading = false,
  className,
}: ExploreFeedHeaderProps) {
  const { t } = useTranslation();
  const [isDestDropdownOpen, setIsDestDropdownOpen] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [placeSuggestions, setPlaceSuggestions] = React.useState<Place[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] =
    React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [loadingPlaceId, setLoadingPlaceId] = React.useState<string | null>(null);

  const destDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const searchContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Close destination dropdown and search dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (loadingPlaceId) return;
      if (
        destDropdownRef.current &&
        !destDropdownRef.current.contains(e.target as Node)
      ) {
        setIsDestDropdownOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [loadingPlaceId]);

  // Debounced search for matching places
  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setPlaceSuggestions([]);
        setIsDropdownOpen(false);
        setIsSearchingSuggestions(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await searchPlaces({
          q: trimmed,
          lat: currentDestination.lat,
          lng: currentDestination.lng,
          limit: 5,
          signal: controller.signal,
        });
        if (res.success && Array.isArray(res.data)) {
          setPlaceSuggestions(res.data);
          setIsDropdownOpen(true);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setPlaceSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingSuggestions(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery, currentDestination.lat, currentDestination.lng]);

  // Query suggestions (e.g. "xe múc huế" and "xe múc in Hue")
  const querySuggestions = React.useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return [];

    const destEn =
      currentDestination.id === "hue"
        ? "Hue"
        : currentDestination.id === "danang"
          ? "Da Nang"
          : "Hoi An";

    const list = [trimmed];

    // Clean destination keywords to build formatted "query in Destination"
    const destPattern = new RegExp(
      `\\s*(ở|tại|in|near)?\\s*(${currentDestination.name}|${currentDestination.id}|${destEn})\\b`,
      "gi"
    );
    const baseQuery = trimmed.replace(destPattern, "").trim();
    const secondOption = `${baseQuery || trimmed} in ${destEn}`;

    if (secondOption.toLowerCase() !== trimmed.toLowerCase()) {
      list.push(secondOption);
    }

    return list;
  }, [searchQuery, currentDestination.name, currentDestination.id]);

  const totalItems = querySuggestions.length + placeSuggestions.length;

  const handleSelectQuerySuggestion = (sug: string) => {
    onSearchChange(sug);
    setIsDropdownOpen(false);
  };

  const handleSelectPlaceItem = async (place: Place) => {
    if (loadingPlaceId) return;
    const targetId = place.id || place.providerPlaceId || null;
    setLoadingPlaceId(targetId);
    try {
      if (onSelectPlace) {
        await onSelectPlace(place);
      }
      onSearchChange(place.name);
      setIsDropdownOpen(false);
    } catch {
      onSearchChange(place.name);
      setIsDropdownOpen(false);
    } finally {
      setLoadingPlaceId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen || totalItems === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        onSearchSubmit(searchQuery);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < querySuggestions.length) {
        handleSelectQuerySuggestion(querySuggestions[selectedIndex]);
      } else if (selectedIndex >= querySuggestions.length) {
        const placeIdx = selectedIndex - querySuggestions.length;
        if (placeSuggestions[placeIdx]) {
          handleSelectPlaceItem(placeSuggestions[placeIdx]);
        }
      } else {
        setIsDropdownOpen(false);
        onSearchSubmit(searchQuery);
      }
    } else if (e.key === "Escape") {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className={cn("space-y-3.5", className)}>
      {/* 1. Destination Title Dropdown */}
      <div className="relative inline-block" ref={destDropdownRef}>
        <button
          type="button"
          onClick={() => setIsDestDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1.5 text-2xl sm:text-3xl font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <span>
            {t(`places.destinations.${currentDestination.id}`, {
              defaultValue: currentDestination.name,
            })}
          </span>
          <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground mt-0.5" />
        </button>

        {isDestDropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-popover p-1 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150">
            {DESTINATION_PRESETS.map((dest) => (
              <button
                key={dest.id}
                type="button"
                onClick={() => {
                  onSelectDestination(dest);
                  setIsDestDropdownOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  dest.id === currentDestination.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-foreground hover:bg-muted"
                )}
              >
                {t(`places.destinations.${dest.id}`, { defaultValue: dest.name })}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Search & Filter Bar Row */}
      <div className="relative flex items-center gap-2.5 z-20" ref={searchContainerRef}>
        {/* Pill Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setSelectedIndex(-1);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) {
                setIsDropdownOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("places.searchPlaceholder", { defaultValue: "Search" })}
            className="h-10 w-full rounded-full border border-border/80 bg-muted/30 pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          {isLoading || isSearchingSuggestions ? (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          ) : searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                setPlaceSuggestions([]);
                setIsDropdownOpen(false);
              }}
              aria-label={t("places.clearSearch", { defaultValue: "Clear search" })}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {/* Autocomplete Dropdown Popup */}
          {isDropdownOpen &&
            (querySuggestions.length > 0 || placeSuggestions.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 z-50 animate-in fade-in-0 zoom-in-95 duration-150 max-h-[380px] overflow-y-auto scrollbar-thin">
                {/* Section 1: Query Suggestions */}
                {querySuggestions.length > 0 && (
                  <div className="space-y-0.5 pb-1">
                    {querySuggestions.map((sug, idx) => {
                      const isSelected = selectedIndex === idx;
                      return (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleSelectQuerySuggestion(sug)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left rounded-xl transition-colors cursor-pointer text-sm font-medium",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground hover:bg-muted/70"
                          )}
                        >
                          <Search className="h-4 w-4 text-foreground/80 shrink-0" />
                          <span className="truncate">{sug}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Section 2: Place Results */}
                {placeSuggestions.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    {placeSuggestions.map((place, idx) => {
                      const placeIndex = querySuggestions.length + idx;
                      const isSelected = selectedIndex === placeIndex;
                      const locationText =
                        [place.district, place.city].filter(Boolean).join(", ") ||
                        place.address;
                      const targetId = place.id || place.providerPlaceId;
                      const isThisItemLoading = loadingPlaceId === targetId;

                      return (
                        <button
                          key={place.id || idx}
                          type="button"
                          disabled={Boolean(loadingPlaceId)}
                          onClick={() => void handleSelectPlaceItem(place)}
                          className={cn(
                            "w-full flex items-center gap-3 px-2.5 py-2 text-left rounded-xl transition-colors cursor-pointer",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted/70",
                            isThisItemLoading && "bg-primary/5 dark:bg-primary/10",
                            loadingPlaceId && !isThisItemLoading && "opacity-50 pointer-events-none"
                          )}
                        >
                          {/* Thumbnail / Star Placeholder / Spinner */}
                          {(() => {
                            if (isThisItemLoading) {
                              return (
                                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                </div>
                              );
                            }
                            const photoUrl =
                              place.primaryPhoto?.url || place.photos?.[0];
                            if (photoUrl) {
                              return (
                                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-muted">
                                  <Image
                                    src={photoUrl}
                                    alt={place.name}
                                    fill
                                    unoptimized
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                </div>
                              );
                            }
                            return (
                              <div className="w-10 h-10 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                              </div>
                            );
                          })()}

                          {/* Place Name & Subtitle */}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium text-foreground truncate">
                              <HighlightedText
                                text={place.name}
                                query={searchQuery}
                              />
                            </span>
                            {locationText && (
                              <span className="text-xs text-muted-foreground truncate">
                                {locationText}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Filters Button */}
        <button
          type="button"
          onClick={onToggleFilters}
          className="h-10 px-4 rounded-full border border-border/80 bg-card text-foreground hover:bg-muted text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-2xs transition-colors shrink-0 cursor-pointer"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>{t("places.filters", { defaultValue: "Filters" })}</span>
        </button>
      </div>

      {/* 3. Category Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {EXPLORE_CATEGORY_TABS.map((tab) => {
          const isActive = tab.id === activeCategoryId;
          const catKey = tab.id === "for-you" ? "forYou" : tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectCategory(tab)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70"
              )}
            >
              {t(`places.categories.${catKey}`, { defaultValue: tab.label })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
