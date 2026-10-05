"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MapPin,
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
  ExternalLink,
  Sparkles,
  Compass,
} from "lucide-react";
import type { PlaceSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTripStore } from "@/features/trip-management/store/use-trip-store";
import {
  getItinerary,
  createItineraryItem,
} from "@/features/trip-management/services/trip-management-api";
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

export function PlaceCards({ places, query, total, title }: PlaceCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Added to trip state
  const [addedPlaces, setAddedPlaces] = useState<Set<string>>(new Set());
  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const trips = useTripStore((state) => state.trips);
  const fetchTrips = useTripStore((state) => state.fetchTrips);

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

  const handleAddToTrip = async (place: PlaceSearchResult, tripId: string, tripName: string) => {
    setAddingPlaceId(place.id);
    try {
      const itinerary = await getItinerary(tripId);
      const targetDay = itinerary.days?.[0];
      if (!targetDay) {
        toast.error("Chuyến đi này chưa có ngày nào trong lịch trình.");
        return;
      }

      await createItineraryItem(tripId, targetDay.id, {
        title: place.name,
        notes: place.address || "Địa điểm gợi ý từ TripSense AI",
        type: "PLACE",
      });

      setAddedPlaces((prev) => new Set(prev).add(place.id));
      toast.success(`Đã thêm ${place.name} vào chuyến đi "${tripName}"!`);
    } catch {
      toast.error("Không thể thêm địa điểm vào chuyến đi. Vui lòng thử lại!");
    } finally {
      setAddingPlaceId(null);
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
            const isAdded = addedPlaces.has(place.id);
            const meta = getCategoryMeta(place.categories);
            const CategoryIcon = meta.icon;

            return (
              <div
                key={place.id}
                className="w-[210px] sm:w-[225px] shrink-0 snap-start flex flex-col group/card cursor-pointer select-none"
                onClick={() => {
                  if (place.location?.lat && place.location?.lng) {
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`,
                      "_blank"
                    );
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

                    {/* Add to Trip Ideas / Plus Button or Verified Badge */}
                    {isAdded ? (
                      <div
                        title="Đã thêm vào chuyến đi"
                        className="size-7 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-xs backdrop-blur-md"
                      >
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            title="Thêm vào ý tưởng chuyến đi"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (isAuthenticated && trips.length === 0) {
                                await fetchTrips();
                              }
                            }}
                            disabled={addingPlaceId === place.id}
                            className="size-7 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md text-white/90 hover:text-white hover:bg-black/60 transition-transform active:scale-90 cursor-pointer shadow-xs"
                          >
                            <Plus className="size-3.5 stroke-[2.5]" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-56 p-2 text-xs"
                          align="end"
                          side="bottom"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="font-semibold text-foreground px-2 py-1 border-b border-border/40">
                            Thêm vào chuyến đi
                          </p>
                          <div className="mt-1 max-h-40 overflow-y-auto space-y-0.5">
                            {!isAuthenticated ? (
                              <p className="text-muted-foreground p-2 text-center text-[11px]">
                                Vui lòng đăng nhập để lưu vào chuyến đi.
                              </p>
                            ) : trips.length === 0 ? (
                              <p className="text-muted-foreground p-2 text-center text-[11px]">
                                Chưa có chuyến đi nào. Hãy tạo chuyến đi mới trước!
                              </p>
                            ) : (
                              trips.map((trip) => (
                                <button
                                  key={trip.id}
                                  type="button"
                                  onClick={() => handleAddToTrip(place, trip.id, trip.name)}
                                  className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted font-medium text-foreground transition-colors flex items-center justify-between text-xs"
                                >
                                  <span className="truncate">{trip.name}</span>
                                  <Plus className="size-3 text-muted-foreground shrink-0" />
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
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

                  {/* Address preview */}
                  {place.address && (
                    <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                      {place.address}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
