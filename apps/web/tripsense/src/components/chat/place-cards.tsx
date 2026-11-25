"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Star,
  Heart,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  BedDouble,
  Utensils,
  Coffee,
  Landmark,
  Sparkles,
  Compass,
  Lightbulb,
} from "lucide-react";
import type { PlaceSearchResult } from "@/lib/types";
import { placeSearchResultToPlace } from "./chat-place-resolver";
import { usePlaceDetailAction } from "./place-detail-action-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTripStore } from "@/features/trip-management/store/use-trip-store";
import {
  addPlaceToTrip,
  getTripMemberships,
  removePlaceFromTrip,
} from "@/features/place-actions/services/place-actions-api";
import { dispatchTripIdeasUpdated } from "@/features/trip-management/hooks/use-trip-ideas";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/features/auth";

interface PlaceCardsProps {
  places: PlaceSearchResult[];
  query?: string;
  total?: number;
  title?: string;
  activeTrip?: { id: string; name: string } | null;
  onSelectPlace?: (place: PlaceSearchResult) => void;
}

function isCatalogPlaceId(id?: string): boolean {
  return Boolean(id && id.trim() && !id.startsWith("ai-rec-"));
}

function getCategoryMeta(categories?: string[]) {
  const catStr = (categories?.join(" ") || "").toLowerCase();
  if (catStr.includes("hotel") || catStr.includes("khách sạn") || catStr.includes("resort") || catStr.includes("lưu trú")) {
    return { icon: BedDouble, label: "Khách sạn" };
  }
  if (catStr.includes("restaurant") || catStr.includes("nhà hàng") || catStr.includes("quán ăn") || catStr.includes("ẩm thực") || catStr.includes("food")) {
    return { icon: Utensils, label: "Nhà hàng" };
  }
  if (catStr.includes("cafe") || catStr.includes("cà phê") || catStr.includes("coffee") || catStr.includes("trà")) {
    return { icon: Coffee, label: "Quán Cafe" };
  }
  if (catStr.includes("park") || catStr.includes("công viên") || catStr.includes("hồ") || catStr.includes("thác")) {
    return { icon: Landmark, label: "Điểm thiên nhiên" };
  }
  if (catStr.includes("attraction") || catStr.includes("tham quan") || catStr.includes("bảo tàng") || catStr.includes("di tích") || catStr.includes("chùa")) {
    return { icon: Landmark, label: "Điểm tham quan" };
  }
  return { icon: Compass, label: categories?.[0] || "Địa điểm" };
}

export function PlaceCards({
  places,
  total,
  title,
  activeTrip,
  onSelectPlace,
}: PlaceCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openPlaceDetail } = usePlaceDetailAction();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Trip Ideas memberships per placeRef -> Set<tripId>
  const [tripMemberships, setTripMemberships] = useState<Record<string, string[]>>({});
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const trips = useTripStore((state) => state.trips);
  const fetchTrips = useTripStore((state) => state.fetchTrips);

  const tripOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ id: string; name: string; isActive?: boolean }> = [];
    if (activeTrip?.id) {
      seen.add(activeTrip.id);
      list.push({ id: activeTrip.id, name: activeTrip.name, isActive: true });
    }
    for (const trip of trips) {
      if (!trip?.id || seen.has(trip.id)) continue;
      if (trip.status === "ARCHIVED" || trip.status === "CANCELLED") continue;
      if (currentUserId && trip.ownerId && trip.ownerId !== currentUserId) continue;
      seen.add(trip.id);
      list.push({ id: trip.id, name: trip.name });
    }
    return list;
  }, [activeTrip, trips, currentUserId]);

  // Hydrate existing Trip Ideas memberships for catalog places when authenticated
  const catalogPlaceIdsKey = useMemo(
    () =>
      Array.from(
        new Set(places.map((p) => p.id).filter((id) => isCatalogPlaceId(id))),
      ).join(","),
    [places],
  );

  useEffect(() => {
    if (!isAuthenticated || !catalogPlaceIdsKey) return;
    const refs = catalogPlaceIdsKey.split(",").filter(Boolean);
    let active = true;
    void getTripMemberships(refs)
      .then((items) => {
        if (!active) return;
        const map: Record<string, string[]> = {};
        for (const item of items) {
          map[item.placeRef] = item.tripIds ?? [];
        }
        setTripMemberships((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {
        // Non-critical hydration failure; users can still add ideas directly.
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, catalogPlaceIdsKey]);

  // Initialize favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tripsense_favorites");
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)));
      }
    } catch {
      // Ignore localStorage error
    }
  }, []);

  // Check scroll position
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [places]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = 360;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const toggleFavorite = (place: PlaceSearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(place.id)) {
        next.delete(place.id);
        toast.info(`Đã bỏ ${place.name} khỏi danh sách yêu thích`);
      } else {
        next.add(place.id);
        toast.success(`Đã lưu ${place.name} vào danh sách yêu thích!`);
      }
      try {
        localStorage.setItem("tripsense_favorites", JSON.stringify(Array.from(next)));
      } catch {
        // Ignore localStorage error
      }
      return next;
    });
  };

  const handleToggleTripIdea = async (
    place: PlaceSearchResult,
    tripId: string,
    tripName: string,
  ) => {
    if (!isCatalogPlaceId(place.id)) {
      toast.error("Thông tin địa điểm này chưa được đồng bộ với danh mục để lưu vào Ý tưởng.");
      return;
    }

    const currentIds = tripMemberships[place.id] ?? [];
    const alreadyInTrip = currentIds.includes(tripId);
    const key = `${place.id}:${tripId}`;
    setMutatingKey(key);

    try {
      if (alreadyInTrip) {
        await removePlaceFromTrip(tripId, place.id);
        setTripMemberships((prev) => ({
          ...prev,
          [place.id]: (prev[place.id] ?? []).filter((id) => id !== tripId),
        }));
        dispatchTripIdeasUpdated(tripId, place.id);
        toast.info(`Đã gỡ ${place.name} khỏi Ý tưởng của "${tripName}"`);
      } else {
        await addPlaceToTrip(tripId, place.id);
        setTripMemberships((prev) => {
          const existing = prev[place.id] ?? [];
          return {
            ...prev,
            [place.id]: existing.includes(tripId) ? existing : [...existing, tripId],
          };
        });
        dispatchTripIdeasUpdated(tripId, place.id);
        toast.success(`Đã lưu ${place.name} vào Ý tưởng của "${tripName}"!`);
      }
    } catch (error) {
      toast.error(
        getSafeErrorMessage(
          error,
          "Không thể cập nhật Ý tưởng chuyến đi. Vui lòng thử lại!",
        ),
      );
    } finally {
      setMutatingKey(null);
    }
  };

  const handleCardClick = (place: PlaceSearchResult) => {
    if (onSelectPlace) {
      onSelectPlace(place);
      return;
    }
    if (openPlaceDetail) {
      openPlaceDetail({
        place: placeSearchResultToPlace(place),
        placeIdHint: place.id,
        nameHint: place.name,
        knownPhotoUrl: place.photoUrl,
      });
      return;
    }
    if (place.location?.lat && place.location?.lng) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  if (!places || places.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 my-3 w-full">
      {/* Header Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
        <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-[13px]">
          <Sparkles className="size-3.5 text-primary" />
          {title || "Địa điểm gợi ý cho chuyến đi"}
        </span>
        <span className="text-[11px] font-medium">{total ?? places.length} địa điểm</span>
      </div>

      {/* Mindtrip Horizontal Carousel Container */}
      <div className="relative group/carousel w-full">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll("left")}
            aria-label="Cuộn sang trái"
            className="absolute -left-3 top-1/3 -translate-y-1/2 z-20 flex size-8 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md border border-border/80 hover:bg-background hover:scale-105 transition-all opacity-0 group-hover/carousel:opacity-100 cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll("right")}
            aria-label="Cuộn sang phải"
            className="absolute -right-3 top-1/3 -translate-y-1/2 z-20 flex size-8 items-center justify-center rounded-full bg-background/95 text-foreground shadow-md border border-border/80 hover:bg-background hover:scale-105 transition-all opacity-0 group-hover/carousel:opacity-100 cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* Horizontal Scroll Track */}
        <div
          ref={scrollRef}
          className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar py-1 px-0.5"
        >
          {places.map((place) => {
            const isFav = favorites.has(place.id);
            const savedTripIds = tripMemberships[place.id] ?? [];
            const isSavedAsIdea = savedTripIds.length > 0;
            const meta = getCategoryMeta(place.categories);
            const CategoryIcon = meta.icon;

            return (
              <div
                key={place.id}
                role="button"
                tabIndex={0}
                data-testid={`place-card-${place.id}`}
                className="w-[210px] sm:w-[225px] shrink-0 snap-start flex flex-col group/card cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl"
                onClick={() => handleCardClick(place)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(place);
                  }
                }}
              >
                {/* 4:3 Image Container with Mindtrip aesthetic */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-2xs">
                  {place.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.photoUrl}
                      alt={place.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/60 text-muted-foreground/50">
                      <CategoryIcon className="size-8" />
                    </div>
                  )}

                  {/* Top-Right Action Pill Buttons */}
                  <div
                    className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Favorite Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(place, e)}
                      title={isFav ? "Bỏ yêu thích" : "Lưu vào yêu thích"}
                      className={cn(
                        "size-7 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md transition-transform active:scale-90 cursor-pointer shadow-xs",
                        isFav
                          ? "text-rose-500 hover:bg-black/60"
                          : "text-white/90 hover:text-white hover:bg-black/60"
                      )}
                    >
                      <Heart
                        className={cn(
                          "size-3.5",
                          isFav && "fill-rose-500 text-rose-500"
                        )}
                      />
                    </button>

                    {/* Add to Trip Ideas / Plus Button or Saved Idea Badge */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          title={
                            isSavedAsIdea
                              ? "Đã lưu vào ý tưởng chuyến đi"
                              : "Thêm vào ý tưởng chuyến đi"
                          }
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isAuthenticated && trips.length === 0) {
                              await fetchTrips();
                            }
                          }}
                          className={cn(
                            "size-7 flex items-center justify-center rounded-full backdrop-blur-md transition-transform active:scale-90 cursor-pointer shadow-xs",
                            isSavedAsIdea
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-black/45 text-white/90 hover:text-white hover:bg-black/60",
                          )}
                        >
                          {isSavedAsIdea ? (
                            <Check className="size-3.5 stroke-[3]" />
                          ) : (
                            <Plus className="size-3.5 stroke-[2.5]" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-60 p-2 text-xs"
                        align="end"
                        side="bottom"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="px-2 py-1 border-b border-border/40">
                          <p className="font-semibold text-foreground flex items-center gap-1.5">
                            <Lightbulb className="size-3.5 text-primary shrink-0" />
                            <span>Lưu vào Ý tưởng chuyến đi</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Lưu làm ý tưởng dự phòng, chưa thêm vào ngày lịch trình
                          </p>
                        </div>
                        <div className="mt-1 max-h-44 overflow-y-auto space-y-0.5">
                          {!isAuthenticated ? (
                            <p className="text-muted-foreground p-2 text-center text-[11px]">
                              Vui lòng đăng nhập để lưu vào Ý tưởng chuyến đi.
                            </p>
                          ) : tripOptions.length === 0 ? (
                            <p className="text-muted-foreground p-2 text-center text-[11px]">
                              Chưa có chuyến đi nào. Hãy tạo chuyến đi mới trước!
                            </p>
                          ) : (
                            tripOptions.map((trip) => {
                              const isInThisTrip = savedTripIds.includes(trip.id);
                              const isBusy = mutatingKey === `${place.id}:${trip.id}`;
                              return (
                                <button
                                  key={trip.id}
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() =>
                                    handleToggleTripIdea(place, trip.id, trip.name)
                                  }
                                  className={cn(
                                    "w-full text-left px-2 py-1.5 rounded-md font-medium transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer",
                                    isInThisTrip
                                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                                      : "text-foreground hover:bg-muted",
                                  )}
                                >
                                  <span className="min-w-0 flex-1 flex items-center gap-1.5">
                                    <span className="truncate">{trip.name}</span>
                                    {trip.isActive && (
                                      <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                                        Đang mở
                                      </span>
                                    )}
                                  </span>
                                  {isInThisTrip ? (
                                    <Check className="size-3.5 text-primary shrink-0" />
                                  ) : (
                                    <Plus className="size-3 text-muted-foreground shrink-0" />
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Rating Tag (Bottom Left of photo) */}
                  {place.rating !== undefined && place.rating > 0 && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-amber-300 backdrop-blur-sm shadow-xs">
                      <Star className="size-3 fill-amber-300" />
                      <span>{place.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Place Information */}
                <div className="mt-2 flex flex-col min-w-0">
                  <h4 className="text-[13px] font-semibold text-foreground group-hover/card:text-primary transition-colors line-clamp-1">
                    {place.name}
                  </h4>

                  {/* Category icon and name */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <CategoryIcon className="size-3 text-muted-foreground/80 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </div>

                  {/* AI Reason / Highlight OR Address preview */}
                  {place.reason ? (
                    <p className="text-[11px] text-muted-foreground/90 line-clamp-2 mt-0.5" title={place.reason}>
                      💡 {place.reason}
                    </p>
                  ) : place.address ? (
                    <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                      {place.address}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
