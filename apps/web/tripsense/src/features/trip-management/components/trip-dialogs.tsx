import * as React from "react";
import Image from "next/image";
import {
  Bed,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Utensils,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { searchPlaces } from "@/features/places/services/places-api";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import { listSavedPlaces } from "@/features/place-actions/services/place-actions-api";
import type { Place } from "@/features/places/types";
import type {
  CreateItineraryItemRequest,
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryItemStatus,
  ItineraryItemType,
  TripResponse,
  UpdateItineraryItemRequest,
  UpdateTripRequest,
} from "../types";
import {
  coverImageForTrip,
  displayTripTitle,
  formatDate,
  itemTypeLabel,
  titleCaseDestination,
  tripCoverOptions,
} from "../utils/format";
import { todayIso } from "../utils/date";
import {
  addMinutesToTime,
  durationMinutesFromTimeRange,
  formatHHMM,
  TIME_OPTIONS_24H,
} from "../utils/time";

function TimeInput24h({
  value,
  onChange,
  id,
}: {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  id?: string;
}) {
  const formatted = formatHHMM(value) || "";
  const listId = id ? `list-${id}` : "time-24h-list";

  return (
    <>
      <datalist id={listId}>
        {TIME_OPTIONS_24H.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Input
        type="text"
        placeholder="HH:mm (e.g. 22:30)"
        value={formatted}
        list={listId}
        onChange={(event) => {
          const raw = event.target.value;
          if (!raw) {
            onChange(null);
            return;
          }
          onChange(raw);
        }}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          const clean = raw.replace(/[^0-9:]/g, "");
          if (clean.includes(":")) {
            const [hStr, mStr] = clean.split(":");
            const hour = Math.min(23, Math.max(0, Number(hStr) || 0))
              .toString()
              .padStart(2, "0");
            const minute = Math.min(59, Math.max(0, Number(mStr) || 0))
              .toString()
              .padStart(2, "0");
            onChange(`${hour}:${minute}`);
          } else if (clean.length === 3) {
            const hour = clean.substring(0, 1).padStart(2, "0");
            const minute = clean.substring(1, 3);
            onChange(`${hour}:${minute}`);
          } else if (clean.length === 4) {
            const hour = clean.substring(0, 2);
            const minute = clean.substring(2, 4);
            const h = Math.min(23, Math.max(0, Number(hour) || 0))
              .toString()
              .padStart(2, "0");
            const m = Math.min(59, Math.max(0, Number(minute) || 0))
              .toString()
              .padStart(2, "0");
            onChange(`${h}:${m}`);
          }
        }}
      />
    </>
  );
}

function mapPlaceToItineraryType(
  place: Place,
  category: string,
): ItineraryItemType {
  const cats = (place.categories || []).map((c) => c.toLowerCase());
  if (
    category === "Restaurants" ||
    cats.some(
      (c) =>
        c.includes("restaurant") ||
        c.includes("food") ||
        c.includes("cafe") ||
        c.includes("ẩm thực") ||
        c.includes("ăn"),
    )
  ) {
    return "MEAL";
  }
  if (
    category === "Stays" ||
    cats.some(
      (c) =>
        c.includes("hotel") ||
        c.includes("stay") ||
        c.includes("resort") ||
        c.includes("khách sạn"),
    )
  ) {
    return "HOTEL";
  }
  if (
    category === "Things to do" ||
    cats.some(
      (c) =>
        c.includes("attraction") ||
        c.includes("sight") ||
        c.includes("museum") ||
        c.includes("park") ||
        c.includes("tour"),
    )
  ) {
    return "ACTIVITY";
  }
  return "PLACE";
}

function PlaceCategoryIcon({
  category,
  className = "h-4 w-4",
}: {
  category?: string;
  className?: string;
}) {
  const text = (category || "").toLowerCase();
  if (
    text.includes("restaurant") ||
    text.includes("meal") ||
    text.includes("food") ||
    text.includes("cafe") ||
    text.includes("ẩm thực") ||
    text.includes("ăn")
  ) {
    return <Utensils className={cn(className, "shrink-0 text-amber-500")} />;
  }
  if (
    text.includes("hotel") ||
    text.includes("stay") ||
    text.includes("resort") ||
    text.includes("khách sạn")
  ) {
    return <Bed className={cn(className, "shrink-0 text-blue-500")} />;
  }
  if (
    text.includes("activity") ||
    text.includes("attraction") ||
    text.includes("things to do") ||
    text.includes("park") ||
    text.includes("tour")
  ) {
    return <Compass className={cn(className, "shrink-0 text-emerald-500")} />;
  }
  return <MapPin className={cn(className, "shrink-0 text-primary")} />;
}

export function AddItemDialog({
  trip,
  day,
  days,
  onSelectDay,
  draft,
  error,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
  onQuickSubmit,
}: {
  trip: TripResponse | null;
  day: ItineraryDayResponse | null;
  days?: ItineraryDayResponse[];
  onSelectDay?: (day: ItineraryDayResponse) => void;
  draft: CreateItineraryItemRequest;
  error: string | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<
    React.SetStateAction<CreateItineraryItemRequest>
  >;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onQuickSubmit: (payload: CreateItineraryItemRequest) => void;
}) {
  const { t, locale } = useTranslation();
  const [tab, setTab] = React.useState<
    "search" | "ideas" | "saved" | "receipt" | "custom"
  >("search");
  const [selectedCategory, setSelectedCategory] = React.useState("For you");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [places, setPlaces] = React.useState<Place[]>([]);
  const [savedPlaces, setSavedPlaces] = React.useState<Place[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = React.useState(false);
  const [addingPlaceId, setAddingPlaceId] = React.useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const categoryOptions = React.useMemo(
    () => [
      { id: "For you", label: locale === "vi" ? "Dành cho bạn" : "For you" },
      { id: "Restaurants", label: locale === "vi" ? "Nhà hàng" : "Restaurants" },
      { id: "Things to do", label: locale === "vi" ? "Hoạt động" : "Things to do" },
      { id: "Stays", label: locale === "vi" ? "Lưu trú" : "Stays" },
      { id: "Locations", label: locale === "vi" ? "Địa điểm" : "Locations" },
    ],
    [locale],
  );

  const tabsList = React.useMemo(
    () => [
      { id: "search", label: locale === "vi" ? "Tìm kiếm" : "Search" },
      { id: "ideas", label: locale === "vi" ? "Gợi ý" : "Ideas" },
      { id: "saved", label: locale === "vi" ? "Đã lưu" : "Saved" },
      { id: "receipt", label: locale === "vi" ? "Hóa đơn / Đặt chỗ" : "Receipt" },
      { id: "custom", label: locale === "vi" ? "Tùy chỉnh" : "Custom" },
    ],
    [locale],
  );

  const executeSearch = React.useCallback(
    async (queryOverride?: string) => {
      if (!day) return;
      const dest = trip?.destinationName?.trim() || "";
      const rawQ = queryOverride !== undefined ? queryOverride : searchQuery;
      let q = rawQ.trim();
      if (!q) {
        if (tab === "ideas") {
          q = `${dest} điểm tham quan nổi bật`.trim();
        } else if (selectedCategory === "For you") {
          q = dest || "Việt Nam";
        } else if (selectedCategory === "Restaurants") {
          q = `nhà hàng ẩm thực ${dest}`.trim();
        } else if (selectedCategory === "Things to do") {
          q = `điểm tham quan vui chơi ${dest}`.trim();
        } else if (selectedCategory === "Stays") {
          q = `khách sạn ${dest}`.trim();
        } else if (selectedCategory === "Locations") {
          q = `địa điểm ${dest}`.trim();
        } else {
          q = `${selectedCategory} ${dest}`.trim();
        }
      }

      try {
        setIsLoadingPlaces(true);
        const res = await searchPlaces({ q, limit: 12 });
        setPlaces(res.data || []);
      } catch {
        setPlaces([]);
      } finally {
        setIsLoadingPlaces(false);
      }
    },
    [day, trip?.destinationName, searchQuery, tab, selectedCategory],
  );

  // Fetch real places via ZioMap / Places API (never mock)
  React.useEffect(() => {
    if (!day || tab === "custom" || tab === "receipt") return;

    if (tab === "saved") {
      let active = true;
      setIsLoadingPlaces(true);
      listSavedPlaces({ size: 30 })
        .then((res) => {
          const list = (res.content || [])
            .map((item) => item.place)
            .filter((p): p is Place => Boolean(p));
          if (active) setSavedPlaces(list);
        })
        .catch(() => {
          if (active) setSavedPlaces([]);
        })
        .finally(() => {
          if (active) setIsLoadingPlaces(false);
        });
      return () => {
        active = false;
      };
    }

    let active = true;
    const controller = new AbortController();
    const dest = trip?.destinationName?.trim() || "";

    const timer = setTimeout(async () => {
      try {
        setIsLoadingPlaces(true);
        let q = searchQuery.trim();
        if (!q) {
          if (tab === "ideas") {
            q = `${dest} điểm tham quan nổi bật`.trim();
          } else if (selectedCategory === "For you") {
            q = dest || "Việt Nam";
          } else if (selectedCategory === "Restaurants") {
            q = `nhà hàng ẩm thực ${dest}`.trim();
          } else if (selectedCategory === "Things to do") {
            q = `điểm tham quan vui chơi ${dest}`.trim();
          } else if (selectedCategory === "Stays") {
            q = `khách sạn ${dest}`.trim();
          } else if (selectedCategory === "Locations") {
            q = `địa điểm ${dest}`.trim();
          } else {
            q = `${selectedCategory} ${dest}`.trim();
          }
        }

        const res = await searchPlaces({
          q,
          limit: 12,
          signal: controller.signal,
        });
        if (active) {
          setPlaces(res.data || []);
        }
      } catch {
        if (active) {
          setPlaces([]);
        }
      } finally {
        if (active) {
          setIsLoadingPlaces(false);
        }
      }
    }, searchQuery ? 300 : 0);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [day, tab, selectedCategory, searchQuery, trip?.destinationName]);

  async function handleAddPlace(place: Place) {
    if (!day || submitting || addingPlaceId) return;
    setAddingPlaceId(place.id);
    const type = mapPlaceToItineraryType(place, selectedCategory);
    const duration = type === "MEAL" ? 90 : type === "HOTEL" ? 120 : 60;
    const payload: CreateItineraryItemRequest = {
      placeId: place.id,
      placeRef: place.id,
      type,
      title: place.name,
      startTime: null,
      endTime: null,
      durationMinutes: duration,
      notes: place.address || null,
    };
    try {
      await onQuickSubmit(payload);
    } finally {
      setAddingPlaceId(null);
    }
  }

  const displayList = tab === "saved" ? savedPlaces : places;

  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-3xl border-border bg-popover p-0 text-popover-foreground shadow-2xl [&>button]:hidden">
        <DialogHeader className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center border-b border-border/80 px-6 py-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full hover:bg-muted"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
          <DialogTitle className="text-center text-xl font-bold tracking-normal">
            {t("places.addToTrip") || "Add to trip"}
          </DialogTitle>
          <span aria-hidden="true" />
        </DialogHeader>

        <div className="max-h-[calc(88vh-5.5rem)] overflow-y-auto px-6 py-6">
          {/* Tabs row matching Screenshot 12 */}
          <div className="flex gap-8 border-b border-border text-base font-bold">
            {tabsList.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "border-b-2 px-1 pb-3 transition-colors duration-200 cursor-pointer",
                  tab === item.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setTab(item.id as typeof tab)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Subheader: Destination + Adding to Day with optional multi-day selector */}
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <DialogDescription className="text-3xl font-bold text-foreground flex items-center gap-2">
                <span>{titleCaseDestination(trip?.destinationName || "Destination")}</span>
                <ChevronDown className="inline h-6 w-6 text-muted-foreground" />
              </DialogDescription>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {day
                  ? locale === "vi"
                    ? `Đang thêm vào Ngày ${day.dayNumber} · ${formatDate(day.date)}`
                    : `Adding to Day ${day.dayNumber} · ${formatDate(day.date)}`
                  : "Choose a day first."}
              </p>
            </div>

            {/* If trip has multiple days, show day selector right in dialog */}
            {days && days.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  {locale === "vi" ? "Chuyển ngày:" : "Switch day:"}
                </span>
                {days.map((d) => {
                  const isCurrentDay = d.id === day?.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectDay?.(d)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
                        isCurrentDay
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/60",
                      )}
                    >
                      Day {d.dayNumber}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {tab !== "custom" && tab !== "receipt" ? (
            <>
              {error && (
                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  {error}
                </div>
              )}

              {/* Functional Search Bar with Clickable Search Button matching Screenshot 12 */}
              <div className="mt-6 flex gap-3 items-center">
                <div
                  onClick={() => searchInputRef.current?.focus()}
                  className="relative flex h-12 flex-1 items-center rounded-full bg-muted/80 border border-border/80 px-4 focus-within:border-foreground/50 focus-within:bg-background transition-all cursor-text"
                >
                  <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void executeSearch();
                      }
                    }}
                    placeholder={
                      locale === "vi"
                        ? `Tìm kiếm địa điểm tại ${titleCaseDestination(trip?.destinationName || "chuyến đi")}...`
                        : `Search places in ${titleCaseDestination(trip?.destinationName || "destination")}...`
                    }
                    className="w-full bg-transparent px-3 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchQuery("");
                        void executeSearch("");
                        searchInputRef.current?.focus();
                      }}
                      className="p-1 rounded-full text-muted-foreground hover:text-foreground cursor-pointer mr-1"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}

                  {/* Functional Search Button */}
                  <Button
                    type="button"
                    size="sm"
                    disabled={isLoadingPlaces}
                    onClick={(e) => {
                      e.stopPropagation();
                      void executeSearch();
                    }}
                    className="rounded-full px-4 text-xs font-bold gap-1.5 shrink-0 h-8 shadow-2xs cursor-pointer"
                  >
                    {isLoadingPlaces ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    <span>{t("common.search") || "Search"}</span>
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="h-12 rounded-full px-5 text-sm font-bold gap-2 border-border/80 hover:bg-muted shrink-0"
                  onClick={() => {
                    setSelectedCategory((prev) =>
                      prev === "Restaurants" ? "For you" : "Restaurants",
                    );
                  }}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>{t("common.filter") || "Filters"}</span>
                </Button>
              </div>

              {/* Category Filter Pills matching Screenshot 12 */}
              {tab === "search" && (
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {categoryOptions.map((cat) => (
                    <Button
                      key={cat.id}
                      type="button"
                      variant={selectedCategory === cat.id ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "rounded-full px-4 text-xs font-semibold transition-all cursor-pointer",
                        selectedCategory === cat.id
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-2xs"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSearchQuery("");
                      }}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Section Header */}
              <h3 className="mt-8 text-xl font-bold tracking-tight text-foreground">
                {searchQuery.trim()
                  ? locale === "vi"
                    ? `Kết quả tìm kiếm cho "${searchQuery.trim()}"`
                    : `Search results for "${searchQuery.trim()}"`
                  : tab === "ideas"
                  ? locale === "vi"
                    ? "Gợi ý nổi bật"
                    : "Popular Ideas"
                  : tab === "saved"
                  ? locale === "vi"
                    ? "Địa điểm đã lưu"
                    : "Saved Places"
                  : categoryOptions.find((c) => c.id === selectedCategory)?.label ||
                    selectedCategory}
              </h3>

              {/* Grid of Real Place Cards from ZioMap / Places API matching Screenshot 12 */}
              {isLoadingPlaces ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground gap-2.5 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>{t("common.loading") || "Loading places from ZioMap..."}</span>
                </div>
              ) : displayList.length > 0 ? (
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {displayList.map((place) => {
                    const photoUrl = getPlacePhotoUrl(place);
                    const categoryLabel = place.categories?.[0] || selectedCategory;
                    const isAdding = addingPlaceId === place.id;

                    return (
                      <div
                        key={place.id}
                        className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-3 shadow-xs transition-all duration-200 hover:shadow-md"
                      >
                        <div>
                          {/* Image Thumbnail with Real CDN Photo or elegant gradient fallback */}
                          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
                            {photoUrl ? (
                              <Image
                                src={photoUrl}
                                alt={place.name}
                                fill
                                sizes="(max-width: 768px) 100vw, 320px"
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted/80 text-muted-foreground p-4">
                                <div className="size-11 rounded-2xl bg-background/90 border border-border/60 shadow-2xs flex items-center justify-center text-primary mb-1.5">
                                  <PlaceCategoryIcon
                                    category={categoryLabel}
                                    className="h-5 w-5"
                                  />
                                </div>
                                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground/80 truncate max-w-[140px]">
                                  {categoryLabel}
                                </span>
                              </div>
                            )}

                            {/* Top-Right "+ Add" Button matching Screenshot 12 */}
                            <button
                              type="button"
                              onClick={() => handleAddPlace(place)}
                              disabled={submitting || isAdding || !day}
                              className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-neutral-900/90 hover:bg-neutral-900 text-white dark:bg-white/95 dark:hover:bg-white dark:text-neutral-900 px-3.5 py-1.5 text-xs font-bold shadow-md backdrop-blur-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-60"
                            >
                              {isAdding ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  <span>Adding</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Place Details */}
                          <div className="mt-3 flex items-start justify-between gap-2">
                            <h4
                              className="min-w-0 font-bold text-base text-foreground truncate"
                              title={place.name}
                            >
                              {place.name}
                            </h4>
                            {place.rating ? (
                              <span className="flex items-center gap-1 text-xs font-bold text-foreground shrink-0 mt-0.5">
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                {place.rating.toFixed(1)}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <PlaceCategoryIcon category={categoryLabel} />
                            <span className="truncate">{categoryLabel}</span>
                          </p>

                          <p
                            className="mt-0.5 text-xs text-muted-foreground truncate"
                            title={place.address}
                          >
                            {place.address || place.city || trip?.destinationName}
                          </p>

                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            $$
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {tab === "saved"
                    ? locale === "vi"
                      ? "Bạn chưa lưu địa điểm nào. Hãy lưu địa điểm từ mục Khám phá để thấy tại đây."
                      : "You have no saved places yet. Save places from Explore to see them here."
                    : locale === "vi"
                    ? "Không tìm thấy địa điểm nào. Thử tìm từ khóa khác hoặc tạo mục tùy chỉnh."
                    : "No places found. Try another search or create a custom item."}
                </div>
              )}
            </>
          ) : tab === "receipt" ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {locale === "vi"
                ? "Chưa có hóa đơn hoặc đặt chỗ nào cho chuyến đi này."
                : "No receipts or reservations found for this trip."}
            </div>
          ) : (
            <form
              id="add-itinerary-item-form"
              className="mt-8 grid gap-4"
              onSubmit={onSubmit}
            >
              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select
                    value={draft.type}
                    onChange={(event) =>
                      onDraftChange((current) => ({
                        ...current,
                        type: event.target.value as ItineraryItemType,
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {[
                      "PLACE",
                      "MEAL",
                      "HOTEL",
                      "TRANSFER",
                      "ACTIVITY",
                      "NOTE",
                    ].map((type) => (
                      <option key={type} value={type}>
                        {itemTypeLabel(type as ItineraryItemType)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Title">
                  <Input
                    required
                    value={draft.title}
                    onChange={(event) =>
                      onDraftChange((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Start">
                  <TimeInput24h
                    id="add-start"
                    value={draft.startTime || ""}
                    onChange={(val) =>
                      onDraftChange((current) => ({
                        ...current,
                        startTime: val || "",
                      }))
                    }
                  />
                </Field>
                <Field label="End">
                  <TimeInput24h
                    id="add-end"
                    value={draft.endTime || ""}
                    onChange={(val) =>
                      onDraftChange((current) => ({
                        ...current,
                        endTime: val || "",
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea
                  value={draft.notes || ""}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add item
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditTripDialog({
  trip,
  draft,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  trip: TripResponse | null;
  draft: UpdateTripRequest | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<UpdateTripRequest | null>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const open = !!trip && !!draft;
  const today = todayIso();
  const minEndDate = draft?.startDate || today;
  const startsInPast = !!draft?.startDate && draft.startDate < today;
  const endIsBeforeStart =
    !!draft?.startDate && !!draft?.endDate && draft.endDate < draft.startDate;
  const canSave = !startsInPast && !endIsBeforeStart && !submitting;

  function updateDraft(patch: UpdateTripRequest) {
    onDraftChange((current) => ({ ...(current || {}), ...patch }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border-border bg-popover p-8 text-popover-foreground shadow-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-normal">
            Edit trip
          </DialogTitle>
          <DialogDescription>
            Update the saved trip details manually.
          </DialogDescription>
        </DialogHeader>
        {draft && (
          <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Trip name">
                <Input
                  required
                  value={draft.name || ""}
                  onChange={(event) =>
                    updateDraft({ name: event.target.value })
                  }
                />
              </Field>
              <Field label="Destination">
                <Input
                  required
                  value={draft.destinationName || ""}
                  onChange={(event) =>
                    updateDraft({ destinationName: event.target.value })
                  }
                />
              </Field>
              <Field label="Start date">
                <Input
                  type="date"
                  min={today}
                  value={draft.startDate || ""}
                  onClick={(event) => event.currentTarget.showPicker()}
                  onChange={(event) =>
                    onDraftChange((current) => {
                      const nextStart = event.target.value;
                      const currentDraft = current || {};
                      return {
                        ...currentDraft,
                        startDate: nextStart,
                        endDate:
                          currentDraft.endDate &&
                          currentDraft.endDate < nextStart
                            ? nextStart
                            : currentDraft.endDate,
                      };
                    })
                  }
                  className="cursor-pointer"
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  min={minEndDate}
                  value={draft.endDate || ""}
                  onClick={(event) => event.currentTarget.showPicker()}
                  onChange={(event) =>
                    updateDraft({ endDate: event.target.value })
                  }
                  className="cursor-pointer"
                />
              </Field>
              <Field label="Travelers">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.travelerCount ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      travelerCount: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="Budget">
                <Input
                  type="number"
                  min={0}
                  value={draft.budgetAmount ?? ""}
                  onChange={(event) =>
                    updateDraft({
                      budgetAmount: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={draft.notes || ""}
                onChange={(event) => updateDraft({ notes: event.target.value })}
              />
            </Field>
            {startsInPast && (
              <p className="text-sm font-medium text-destructive">
                Start date cannot be in the past.
              </p>
            )}
            {endIsBeforeStart && (
              <p className="text-sm font-medium text-destructive">
                End date must be on or after start date.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save changes
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EditItemDialog({
  item,
  draft,
  error,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  item: ItineraryItemResponse | null;
  draft: UpdateItineraryItemRequest | null;
  error?: string | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<
    React.SetStateAction<UpdateItineraryItemRequest | null>
  >;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useTranslation();
  const open = !!item && !!draft;

  function updateDraft(patch: UpdateItineraryItemRequest) {
    onDraftChange((current) => ({ ...(current || {}), ...patch }));
  }

  function updateTimeDraft(
    patch: Pick<UpdateItineraryItemRequest, "startTime" | "endTime">,
  ) {
    onDraftChange((current) => {
      const next = { ...(current || {}), ...patch };
      return {
        ...next,
        durationMinutes:
          durationMinutesFromTimeRange(next.startTime, next.endTime) ??
          next.durationMinutes ??
          null,
      };
    });
  }

  function updateDurationDraft(durationMinutes: number | null) {
    onDraftChange((current) => {
      const nextEndTime = addMinutesToTime(current?.startTime, durationMinutes);
      return {
        ...(current || {}),
        durationMinutes,
        endTime: nextEndTime ?? current?.endTime ?? null,
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-border bg-popover p-0 text-popover-foreground shadow-xl">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 pr-12">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
              <Pencil className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-normal">
                {t("trip.editItemTitle")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {t("trip.editItemDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {draft && (
          <form className="space-y-5 px-6 py-5" onSubmit={onSubmit}>
            {item && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground truncate">{item.title}</p>
                  {item.placeNameSnapshot && item.placeNameSnapshot !== item.title && (
                    <p className="text-xs text-muted-foreground truncate">{item.placeNameSnapshot}</p>
                  )}
                </div>
                <span className="rounded-md bg-muted px-2 py-1 text-micro font-bold uppercase shrink-0 text-muted-foreground">
                  {item.type}
                </span>
              </div>
            )}

            <Field label={t("trip.title")}>
              <Input
                required
                value={draft.title || ""}
                onChange={(event) => updateDraft({ title: event.target.value })}
                className="h-11 rounded-xl bg-background shadow-2xs"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("trip.type")}>
                <select
                  value={draft.type || "ACTIVITY"}
                  onChange={(event) =>
                    updateDraft({
                      type: event.target.value as ItineraryItemType,
                    })
                  }
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {[
                    "PLACE",
                    "MEAL",
                    "HOTEL",
                    "FLIGHT",
                    "TRANSFER",
                    "ACTIVITY",
                    "NOTE",
                  ].map((type) => (
                    <option key={type} value={type}>
                      {itemTypeLabel(type as ItineraryItemType)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("trip.status")}>
                <select
                  value={draft.status || "PLANNED"}
                  onChange={(event) =>
                    updateDraft({
                      status: event.target.value as ItineraryItemStatus,
                    })
                  }
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {["PLANNED", "DONE", "SKIPPED", "CANCELLED"].map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("trip.startTime")}>
                <TimeInput24h
                  id="edit-start"
                  value={draft.startTime || null}
                  onChange={(val) => updateTimeDraft({ startTime: val })}
                />
              </Field>
              <Field label={t("trip.endTime")}>
                <TimeInput24h
                  id="edit-end"
                  value={draft.endTime || null}
                  onChange={(val) => updateTimeDraft({ endTime: val })}
                />
              </Field>
            </div>

            {/* Quick duration presets */}
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t("trip.durationMinutes")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {[30, 45, 60, 90, 120].map((mins) => {
                  const isSelected = draft.durationMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => updateDurationDraft(mins)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                          : "border-border bg-muted/50 hover:bg-muted text-foreground"
                      }`}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label={t("trip.notes")}>
              <Textarea
                value={draft.notes || ""}
                onChange={(event) => updateDraft({ notes: event.target.value })}
                placeholder={t("trip.notesPlaceholder")}
                className="min-h-24 rounded-xl"
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4 -mx-6 -mb-5 mt-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="rounded-full gap-1.5 font-bold" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t("common.save")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTripDialog({
  trip,
  submitting,
  onOpenChange,
  onConfirm,
}: {
  trip: TripResponse | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border-border bg-popover p-8 text-popover-foreground shadow-md [&>button]:hidden">
        <DialogHeader className="items-center space-y-5 text-center">
          <DialogTitle className="text-2xl font-bold tracking-normal">
            Delete &quot;{trip ? displayTripTitle(trip) : "trip"}&quot;?
          </DialogTitle>
          <DialogDescription className="text-base font-medium text-muted-foreground">
            This will also delete its associated chats.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full bg-transparent text-base font-bold"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 rounded-full text-base font-bold"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Yes, delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeCoverPhotoDialog({
  trip,
  submitting,
  onOpenChange,
  onSelectCover,
}: {
  trip: TripResponse | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCover: (coverImageUrl: string) => void;
}) {
  const currentCover = trip ? coverImageForTrip(trip) : null;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleUploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        onSelectCover(reader.result);
      }
    });
    reader.readAsDataURL(file);
  }

  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-md [&>button]:hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center border-b border-border px-6 py-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 justify-self-start rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
          <DialogHeader className="min-w-0 text-center sm:text-center">
            <DialogTitle className="truncate text-xl font-bold tracking-normal">
              Change cover photo
            </DialogTitle>
          </DialogHeader>
          <span aria-hidden="true" />
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl bg-muted text-center text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <Upload className="mb-5 h-8 w-8" />
              <span className="max-w-32 text-lg font-medium leading-tight">
                Upload your own photo
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleUploadPhoto}
                tabIndex={-1}
              />
            </button>

            {tripCoverOptions.map((coverUrl) => {
              const isSelected = currentCover === coverUrl;

              return (
                <button
                  key={coverUrl}
                  type="button"
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted transition-all duration-200 hover:shadow-md",
                    isSelected &&
                      "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                  )}
                  onClick={() => onSelectCover(coverUrl)}
                  disabled={submitting}
                  aria-label="Choose cover photo"
                >
                  <Image
                    src={coverUrl}
                    alt="Trip cover option"
                    fill
                    sizes="(max-width: 768px) 44vw, 260px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-5 w-5" />
                    </span>
                  )}
                  {submitting && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
