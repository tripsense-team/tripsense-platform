"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Share2,
  MoreHorizontal,
  Plus,
  Calendar,
  MapPin,
  Sparkles,
  Map as MapIcon,
  ChevronDown,
  Pencil,
  Trash2,
  Loader2,
  Luggage,
  Check,
  Compass,
  Utensils,
  Hotel,
  UserPlus,
  Clock,
  Coffee,
  Landmark,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TripMembersDialog } from "@/features/trip-management/components/trip-members-dialog";
import {
  getItinerary,
  updateTrip,
  deleteTrip,
  deleteItineraryItem,
} from "@/features/trip-management/services/trip-management-api";
import { getPlaceDetails, searchPlaces } from "@/features/places/services/places-api";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import type { TripResponse, ItineraryResponse } from "@/features/trip-management/types";
import { formatShortRange, countTripDays } from "@/features/trip-management/utils/format";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface TripDetailPanelProps {
  trip: TripResponse;
  dayThemes?: Record<number, string>;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onTripUpdated?: (updatedTrip: TripResponse) => void;
  onTripDeleted?: (tripId: string) => void;
  onOpenWhere?: () => void;
  onOpenWhen?: () => void;
  onOpenWho?: () => void;
  onOpenBudget?: () => void;
  className?: string;
}

export type TripDetailTab = "itinerary" | "ideas" | "bookings" | "calendar" | "chats" | "media";

function calculateDistanceMiles(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
): string | null {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    (lat1 === lat2 && lng1 === lng2)
  ) {
    return null;
  }
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  if (km < 0.05) return null;
  const miles = km * 0.621371;
  return `${miles.toFixed(2).replace(".", ",")} dặm`;
}

function formatTimeRange(startTime?: string | null, endTime?: string | null): string | null {
  if (!startTime) return null;
  const formatHour = (t: string) => {
    const parts = t.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      return `${h}:${parts[1]}`;
    }
    return t;
  };
  const startStr = formatHour(startTime);
  if (!endTime) return startStr;
  const endStr = formatHour(endTime);
  return `${startStr} – ${endStr}`;
}

function getItemCategoryIcon(type: string, title?: string) {
  const lower = (title || "").toLowerCase();
  if (type === "HOTEL" || lower.includes("khách sạn") || lower.includes("hotel") || lower.includes("resort")) {
    return <Hotel className="size-4 text-blue-500 shrink-0" />;
  }
  if (type === "MEAL" || lower.includes("bún") || lower.includes("mì") || lower.includes("quán") || lower.includes("ăn") || lower.includes("hải sản")) {
    return <Utensils className="size-4 text-amber-500 shrink-0" />;
  }
  if (lower.includes("cafe") || lower.includes("cà phê") || lower.includes("coffee")) {
    return <Coffee className="size-4 text-orange-500 shrink-0" />;
  }
  if (lower.includes("chùa") || lower.includes("núi") || lower.includes("cầu") || lower.includes("phố cổ") || lower.includes("chợ") || lower.includes("bà nà") || lower.includes("bảo tàng") || lower.includes("văn miếu") || lower.includes("lăng") || lower.includes("cung") || lower.includes("động") || lower.includes("thác")) {
    return <Landmark className="size-4 text-emerald-500 shrink-0" />;
  }
  return <MapPin className="size-4 text-rose-500 shrink-0" />;
}

function formatDayDateHeader(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  if (locale === "vi") {
    const daysVi = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    return `${daysVi[d.getDay()]}, ${d.getDate()} thg ${d.getMonth() + 1}`;
  }
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDayTheme(theme?: string): string | null {
  if (!theme) return null;
  const trimmed = theme.trim();
  const hasEmoji = /^\p{Extended_Pictographic}/u.test(trimmed);
  return hasEmoji ? trimmed : `🏯 ${trimmed}`;
}

export function TripDetailPanel({
  trip,
  dayThemes,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  onTripUpdated,
  onTripDeleted,
  onOpenWhere,
  onOpenWhen,
  onOpenWho,
  onOpenBudget,
  className,
}: TripDetailPanelProps) {
  const { locale } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TripDetailTab>("itinerary");
  const [itinerary, setItinerary] = React.useState<ItineraryResponse | null>(null);
  const [isLoadingItinerary, setIsLoadingItinerary] = React.useState(true);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const [showInspirationBanner, setShowInspirationBanner] = React.useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(trip.name);
  const [prevTripName, setPrevTripName] = React.useState(trip.name);
  const [collapsedDays, setCollapsedDays] = React.useState<Record<string, boolean>>({});
  const [isIdeasSectionOpen, setIsIdeasSectionOpen] = React.useState(true);
  const [isMapActive, setIsMapActive] = React.useState(false);
  const fetchedItemIdsRef = React.useRef<Set<string>>(new Set());

  // Sync title during render if trip name changed externally
  if (prevTripName !== trip.name) {
    setPrevTripName(trip.name);
    setEditedTitle(trip.name);
  }

  // Load itinerary from trip-service
  React.useEffect(() => {
    let active = true;
    getItinerary(trip.id)
      .then((res) => {
        if (active) {
          setItinerary(res);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch itinerary:", err);
      })
      .finally(() => {
        if (active) setIsLoadingItinerary(false);
      });

    return () => {
      active = false;
    };
  }, [trip.id]);

  // Reactive listener: automatically reload itinerary when AI commits or finishes streaming
  React.useEffect(() => {
    const handleItineraryUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ tripId?: string }>).detail;
      if (!detail?.tripId || detail.tripId === trip.id) {
        getItinerary(trip.id)
          .then((res) => {
            setItinerary(res);
            setIsLoadingItinerary(false);
          })
          .catch(() => {});
      }
    };

    window.addEventListener("tripsense:itinerary-updated", handleItineraryUpdated);
    return () => {
      window.removeEventListener("tripsense:itinerary-updated", handleItineraryUpdated);
    };
  }, [trip.id]);

  // Reset photo cache when viewing a different trip
  React.useEffect(() => {
    fetchedItemIdsRef.current.clear();
    setPhotoUrls({});
  }, [trip.id]);

  // Resolve photo URLs for itinerary items
  React.useEffect(() => {
    if (!itinerary?.days) return;
    const items = itinerary.days.flatMap((d) => d.items || []);
    if (items.length === 0) return;

    const unrequestedItems = items.filter(
      (item) => !fetchedItemIdsRef.current.has(item.id)
    );
    if (unrequestedItems.length === 0) return;

    for (const item of unrequestedItems) {
      fetchedItemIdsRef.current.add(item.id);
    }

    let active = true;
    const controller = new AbortController();

    async function loadPhotos() {
      const resolved = await Promise.all(
        unrequestedItems.map(async (item) => {
          try {
            let place: any = null;
            if (item.placeId) {
              try {
                const details = await getPlaceDetails(
                  item.placeId,
                  item.placeNameSnapshot || item.title,
                  item.latSnapshot ?? undefined,
                  item.lngSnapshot ?? undefined,
                  controller.signal
                );
                place = details.data;
              } catch {
                place = null;
              }
            }
            if (!place || !getPlacePhotoUrl(place)) {
              const query = [item.placeNameSnapshot || item.title, trip.destinationName]
                .filter(Boolean)
                .join(" ");
              const search = await searchPlaces({
                q: query,
                limit: 1,
                signal: controller.signal,
              });
              if (search.data && search.data[0]) {
                place = search.data[0];
              }
            }
            const photoUrl = place ? getPlacePhotoUrl(place) : null;
            return photoUrl ? ([item.id, photoUrl] as const) : null;
          } catch {
            return null;
          }
        })
      );

      if (!active || controller.signal.aborted) return;
      const valid = resolved.filter((r): r is readonly [string, string] => Boolean(r));
      if (valid.length > 0) {
        setPhotoUrls((prev) => {
          const next = { ...prev };
          for (const [id, url] of valid) {
            next[id] = url;
          }
          return next;
        });
      }
    }

    void loadPhotos();
    return () => {
      active = false;
      controller.abort();
    };
  }, [itinerary, trip.destinationName]);

  // Format date range (e.g. "19 – 21 thg 10" or "Oct 19 – 21")
  const dateRangeStr = React.useMemo(() => {
    if (!trip.startDate || !trip.endDate) return "Chưa chọn ngày";
    return formatShortRange(trip.startDate, trip.endDate);
  }, [trip.startDate, trip.endDate]);

  // Days count
  const daysCount = countTripDays(trip);

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle.trim() === trip.name) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const updated = await updateTrip(trip.id, { name: editedTitle.trim() });
      if (onTripUpdated) onTripUpdated(updated);
      toast.success(
        locale === "vi" ? "Đã cập nhật tên chuyến đi" : "Trip title updated"
      );
    } catch {
      toast.error(
        locale === "vi" ? "Không thể cập nhật tên" : "Failed to update title"
      );
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(`${window.location.origin}/trips/${trip.id}`);
      toast.success(
        locale === "vi"
          ? "Đã sao chép liên kết chuyến đi vào clipboard!"
          : "Trip link copied to clipboard!"
      );
    }
  };

  const handleDelete = async () => {
    if (!confirm(locale === "vi" ? "Bạn có chắc chắn muốn xoá chuyến đi này?" : "Are you sure you want to delete this trip?")) {
      return;
    }
    try {
      await deleteTrip(trip.id);
      toast.success(locale === "vi" ? "Đã xoá chuyến đi" : "Trip deleted");
      if (onTripDeleted) onTripDeleted(trip.id);
      onClose();
    } catch {
      toast.error(locale === "vi" ? "Lỗi khi xoá chuyến đi" : "Failed to delete trip");
    }
  };

  const toggleDayCollapse = (dayId: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  const handleDeleteItem = async (dayId: string, itemId: string) => {
    try {
      await deleteItineraryItem(trip.id, itemId);
      setItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.id === dayId
              ? { ...d, items: (d.items || []).filter((it) => it.id !== itemId) }
              : d
          ),
        };
      });
      toast.success(
        locale === "vi"
          ? "Đã xoá địa điểm khỏi lịch trình"
          : "Removed place from itinerary"
      );
    } catch {
      toast.error(
        locale === "vi"
          ? "Không thể xoá địa điểm"
          : "Failed to remove place"
      );
    }
  };

  return (
    <aside
      className={cn(
        "relative z-20 flex h-full shrink-0 flex-col overflow-hidden bg-background transition-all duration-300 ease-in-out select-none",
        isCollapsed
          ? "w-14 rounded-l-xl rounded-r-none border-l border-border/70"
          : "w-full md:w-[50%] lg:w-[48%] xl:w-[46%] rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l border-border/70 shadow-xl",
        className
      )}
    >
      {/* When Collapsed: Vertical Minimized Strip */}
      {isCollapsed ? (
        <div className="flex flex-1 flex-col items-center py-3.5 gap-2.5 select-none h-full w-full">
          {/* Top: Expand (Booklet) & Close (X) Buttons cleanly aligned on vertical center axis */}
          {onToggleCollapse && (
            <SidebarCollapseButton
              collapsed={true}
              onToggleCollapse={onToggleCollapse}
              collapseTitle={locale === "vi" ? "Thu gọn bảng chi tiết" : "Collapse panel"}
              expandTitle={locale === "vi" ? "Mở rộng bảng chi tiết" : "Expand panel"}
              tooltipSide="left"
              iconClassName="h-4.5 w-4.5"
              className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer bg-background/95 dark:bg-card/95 shadow-none shrink-0"
            />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={locale === "vi" ? "Đóng bảng chi tiết" : "Close panel"}
            title={locale === "vi" ? "Đóng bảng chi tiết" : "Close panel"}
            className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="w-6 h-px bg-border/40 my-1 shrink-0" />

          {/* Vertical Trip Destination / Name */}
          <div className="flex-1 flex items-center justify-center [writing-mode:vertical-rl] text-xs font-semibold text-muted-foreground tracking-wider uppercase select-none py-2">
            {trip.destinationName || trip.name}
          </div>
        </div>
      ) : (
        <>
          {/* 1. STICKY TOP ACTION BAR matching Mindtrip Screenshot 1 */}
          <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-md">
            {/* Left: Collapse button and Close button side-by-side on same horizontal row */}
            <div className="flex items-center gap-2">
              {onToggleCollapse && (
                <SidebarCollapseButton
                  collapsed={false}
                  onToggleCollapse={onToggleCollapse}
                  collapseTitle={locale === "vi" ? "Thu gọn bảng chi tiết" : "Collapse panel"}
                  expandTitle={locale === "vi" ? "Mở rộng bảng chi tiết" : "Expand panel"}
                  tooltipSide="bottom"
                  iconClassName="h-4.5 w-4.5"
                  className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer bg-background/95 dark:bg-card/95 shadow-none shrink-0"
                />
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label={locale === "vi" ? "Đóng" : "Close"}
                className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                title={locale === "vi" ? "Đóng bảng chi tiết" : "Close panel"}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Right Action Buttons: Go to trip, Invite, Share, More */}
            <div className="flex items-center gap-2">
              {/* Go to trip pill button */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3.5 text-xs font-semibold border-border/70 hover:bg-muted text-foreground transition-all cursor-pointer"
              >
                <Link href={`/trips/${trip.id}`}>
                  <span>{locale === "vi" ? "Xem toàn bộ" : "Go to trip"}</span>
                </Link>
              </Button>

              {/* Invite button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInviteDialogOpen(true)}
                className="h-8 rounded-full px-3 text-xs font-semibold border-border/70 hover:bg-muted text-foreground gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="size-3.5 text-primary" />
                <span>{locale === "vi" ? "Mời" : "Invite"}</span>
              </Button>

              {/* Share icon button */}
              <button
                type="button"
                onClick={handleShare}
                className="size-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Share trip"
                aria-label="Share trip"
              >
                <Share2 className="size-3.5" />
              </button>

              {/* More dropdown (...) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="size-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="More options"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5 shadow-xl">
                  <DropdownMenuItem
                    onClick={() => setIsEditingTitle(true)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer"
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                    <span>{locale === "vi" ? "Đổi tên chuyến đi" : "Rename trip"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive focus:text-destructive rounded-xl cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>{locale === "vi" ? "Xoá chuyến đi" : "Delete trip"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded Full Content matching Screenshot 1 */}
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0">
          {/* 2. TITLE & TAGS SECTION */}
          <div className="px-6 pt-5 pb-3">
            {/* Trip Title */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="text-2xl font-bold text-foreground bg-muted/30 border border-primary/50 rounded-xl px-2.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" onClick={handleSaveTitle} className="h-8 rounded-lg px-3">
                  <Check className="size-3.5" />
                </Button>
              </div>
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground hover:opacity-85 transition-opacity cursor-pointer mb-3"
                title="Click để đổi tên chuyến đi"
              >
                {trip.name || `Trip to ${trip.destinationName}`}
              </h1>
            )}

            {/* Tags / Attributes Row matching Screenshot 1: [China] [19 – 21 thg 10] [5 travelers] [Budget] [Preferences] */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Destination Tag */}
              <button
                type="button"
                onClick={onOpenWhere}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border/50 transition-colors cursor-pointer"
              >
                <span>{trip.destinationName || "Điểm đến"}</span>
              </button>

              {/* Dates Tag */}
              <button
                type="button"
                onClick={onOpenWhen}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border/50 transition-colors cursor-pointer"
              >
                <span>{dateRangeStr}</span>
              </button>

              {/* Travelers Tag */}
              <button
                type="button"
                onClick={onOpenWho}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted/60 hover:bg-muted text-foreground border border-border/50 transition-colors cursor-pointer"
              >
                <span>
                  {trip.travelerCount
                    ? `${trip.travelerCount} travelers`
                    : "Travelers"}
                </span>
              </button>

              {/* Budget Tag */}
              <button
                type="button"
                onClick={onOpenBudget}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <span>Budget</span>
              </button>
            </div>
          </div>

          {/* 3. NAVIGATION TABS BAR matching Screenshot 1 */}
          <div className="px-6 border-b border-border/50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-5 sm:gap-6 overflow-x-auto scrollbar-none">
              {(
                [
                  { id: "itinerary", label: locale === "vi" ? "Lịch trình" : "Itinerary" },
                  { id: "ideas", label: "Ideas" },
                  { id: "bookings", label: "Bookings" },
                  { id: "calendar", label: "Calendar" },
                  { id: "chats", label: "Chats" },
                  { id: "media", label: "Media" },
                ] as const
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "py-3 text-xs sm:text-sm font-semibold transition-colors relative cursor-pointer whitespace-nowrap",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground/80 hover:text-foreground"
                    )}
                  >
                    {tab.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Map toggle icon button at right edge of tab bar */}
            <button
              type="button"
              onClick={() => setIsMapActive((prev) => !prev)}
              className={cn(
                "size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2",
                isMapActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title="Toggle interactive map"
            >
              <MapIcon className="size-4" />
            </button>
          </div>

          {/* 4. TAB CONTENTS */}
          <div className="flex-1 p-6 space-y-6">
            {/* TAB 1: ITINERARY (Screenshot 1 Primary View) */}
            {activeTab === "itinerary" && (
              <>
                {/* 4.1 Section: Ideas (0 items) */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsIdeasSectionOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-sm font-bold text-foreground hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform duration-200",
                        !isIdeasSectionOpen && "-rotate-90"
                      )}
                    />
                    <span>Ideas</span>
                    <span className="text-xs font-normal text-muted-foreground">0 items</span>
                  </button>

                  {isIdeasSectionOpen && (
                    <div className="flex items-center gap-3 overflow-x-auto pb-1">
                      {/* + Add Card */}
                      <button
                        type="button"
                        onClick={() => {
                          toast.info(
                            locale === "vi"
                              ? "Hãy chat với AI bên trái để gợi ý và thêm địa điểm vào kho Ý tưởng!"
                              : "Ask the AI assistant on the left to add places to your Ideas!"
                          );
                        }}
                        className="w-28 h-28 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-dashed border-border/80 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all cursor-pointer group"
                      >
                        <div className="size-8 rounded-full bg-background border border-border/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="size-4" />
                        </div>
                        <span className="text-xs font-semibold">Add</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 4.2 Section: Itinerary (X ngày) */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">
                      {locale === "vi" ? `Lịch trình ${daysCount} ngày` : `Itinerary ${daysCount} days`}
                    </h2>
                  </div>

                  {/* Banner: Start shaping your trip matching Screenshot 1 */}
                  {showInspirationBanner && (
                    <div className="relative rounded-2xl bg-muted/30 border border-border/50 p-4 sm:p-5 flex items-center justify-between gap-4 text-left overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowInspirationBanner(false)}
                        className="absolute top-2.5 right-2.5 size-6 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                        title="Dismiss banner"
                      >
                        <X className="size-3.5" />
                      </button>

                      {/* Stacked Illustrations with badges "1", "2" */}
                      <div className="relative size-16 shrink-0 hidden sm:flex items-center justify-center">
                        <div className="absolute top-1 left-0 size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 rotate-[-8deg] flex items-center justify-center shadow-xs">
                          <Compass className="size-5 text-amber-600" />
                          <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background border border-border text-micro font-bold flex items-center justify-center">1</span>
                        </div>
                        <div className="absolute bottom-1 right-0 size-11 rounded-xl bg-teal-500/10 border border-teal-500/20 rotate-[6deg] flex items-center justify-center shadow-xs">
                          <MapPin className="size-5 text-teal-600" />
                          <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background border border-border text-micro font-bold flex items-center justify-center">2</span>
                        </div>
                      </div>

                      <div className="space-y-0.5 min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-foreground">
                          Start shaping your trip.
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Lay out your days by adding places you plan to visit.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Day-by-Day Accordion from trip-service Itinerary */}
                  {isLoadingItinerary ? (
                    <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>{locale === "vi" ? "Đang tải lịch trình..." : "Loading itinerary..."}</span>
                    </div>
                  ) : itinerary?.days && itinerary.days.length > 0 ? (
                    <div className="space-y-6">
                      {itinerary.days.map((day) => {
                        const isDayCollapsed = Boolean(collapsedDays[day.id]);
                        const dayDateStr = formatDayDateHeader(day.date, locale);
                        const rawTheme = dayThemes?.[day.dayNumber];
                        const dayTheme = formatDayTheme(rawTheme);

                        return (
                          <div key={day.id} className="space-y-3">
                            {/* Day Accordion Header */}
                            <button
                              type="button"
                              onClick={() => toggleDayCollapse(day.id)}
                              className="w-full flex items-center justify-between py-1.5 px-1 hover:bg-muted/40 rounded-xl transition-colors text-left cursor-pointer group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                                <ChevronDown
                                  className={cn(
                                    "size-4.5 text-muted-foreground transition-transform duration-200 shrink-0",
                                    isDayCollapsed && "-rotate-90"
                                  )}
                                />
                                <span className="font-bold text-sm text-foreground shrink-0">
                                  {locale === "vi"
                                    ? `Ngày ${day.dayNumber}`
                                    : `Day ${day.dayNumber}`}
                                </span>
                                {dayTheme && (
                                  <span className="font-semibold text-sm text-foreground/90 truncate">
                                    {dayTheme}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-muted-foreground font-medium">
                                  {dayDateStr}
                                </span>
                              </div>
                            </button>

                            {/* Day Items List */}
                            {!isDayCollapsed && (
                              <div className="space-y-0 pl-1 sm:pl-2">
                                {day.items && day.items.length > 0 ? (
                                  <div>
                                    {day.items.map((item, idx) => {
                                      const photoUrl = photoUrls[item.id];
                                      const timeRange = formatTimeRange(item.startTime, item.endTime);
                                      const nextItem = day.items[idx + 1];
                                      const distance = nextItem
                                        ? calculateDistanceMiles(
                                            item.latSnapshot ?? null,
                                            item.lngSnapshot ?? null,
                                            nextItem.latSnapshot ?? null,
                                            nextItem.lngSnapshot ?? null
                                          )
                                        : null;

                                      return (
                                        <React.Fragment key={item.id}>
                                          {/* Item Card */}
                                          <div className="group relative flex items-center justify-between gap-3.5 p-3 rounded-2xl border border-border/70 bg-card hover:border-border hover:shadow-xs transition-all">
                                            {/* Left: Thumbnail Image */}
                                            <div className="size-16 sm:size-18 rounded-xl overflow-hidden bg-muted/50 border border-border/40 shrink-0 relative flex items-center justify-center">
                                              {photoUrl ? (
                                                <img
                                                  src={photoUrl}
                                                  alt={item.title}
                                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                  loading="lazy"
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted/40">
                                                  {getItemCategoryIcon(item.type, item.title)}
                                                </div>
                                              )}
                                            </div>

                                            {/* Center: Info */}
                                            <div className="min-w-0 flex-1 space-y-1">
                                              <div className="flex items-center gap-1.5">
                                                {getItemCategoryIcon(item.type, item.title)}
                                                <h4
                                                  className="font-bold text-sm text-foreground truncate"
                                                  title={item.title}
                                                >
                                                  {item.title}
                                                </h4>
                                              </div>

                                              {timeRange ? (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                  <Clock className="size-3.5 text-muted-foreground/80 shrink-0" />
                                                  <span>{timeRange}</span>
                                                </div>
                                              ) : item.placeAddressSnapshot ? (
                                                <p className="text-micro text-muted-foreground truncate">
                                                  {item.placeAddressSnapshot}
                                                </p>
                                              ) : null}
                                            </div>

                                            {/* Right: Actions menu */}
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <button
                                                  type="button"
                                                  className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
                                                  title={locale === "vi" ? "Tuỳ chọn" : "Options"}
                                                >
                                                  <MoreHorizontal className="size-4" />
                                                </button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem
                                                  onClick={() => {
                                                    const query = item.placeNameSnapshot || item.title;
                                                    window.open(
                                                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                                                      "_blank",
                                                      "noopener,noreferrer"
                                                    );
                                                  }}
                                                  className="cursor-pointer gap-2 text-xs"
                                                >
                                                  <ExternalLink className="size-3.5 text-muted-foreground" />
                                                  <span>{locale === "vi" ? "Xem trên bản đồ" : "View on Google Maps"}</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  onClick={() => handleDeleteItem(day.id, item.id)}
                                                  className="cursor-pointer gap-2 text-xs text-destructive focus:text-destructive"
                                                >
                                                  <Trash2 className="size-3.5" />
                                                  <span>{locale === "vi" ? "Xoá khỏi ngày" : "Remove from day"}</span>
                                                </DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>

                                          {/* Distance connector between items matching screenshot */}
                                          {idx < day.items.length - 1 && (
                                            <div className="flex flex-col items-start pl-6 sm:pl-7 py-1">
                                              <div className="w-0.5 h-3 border-l border-dashed border-border/80 ml-0.5" />
                                              {distance ? (
                                                <>
                                                  <span className="text-xs font-medium text-muted-foreground/85 py-1 select-none">
                                                    {distance}
                                                  </span>
                                                  <div className="w-0.5 h-3 border-l border-dashed border-border/80 ml-0.5" />
                                                </>
                                              ) : (
                                                <div className="w-0.5 h-3 border-l border-dashed border-border/80 ml-0.5" />
                                              )}
                                            </div>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="py-6 text-center space-y-2 rounded-2xl border border-dashed border-border/70 p-4">
                                    <p className="text-xs text-muted-foreground italic">
                                      {locale === "vi"
                                        ? "Chưa có địa điểm nào được thêm vào ngày này."
                                        : "No places added for this day yet."}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        toast.info(
                                          locale === "vi"
                                            ? `Gợi ý: Hãy chat "Gợi ý lịch trình cho Ngày ${day.dayNumber}" với AI ở khung bên trái!`
                                            : `Tip: Ask "Suggest itinerary for Day ${day.dayNumber}" in the AI chat on the left!`
                                        );
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                                    >
                                      <Sparkles className="size-3.5" />
                                      <span>
                                        {locale === "vi" ? "Hỏi AI gợi ý địa điểm" : "Ask AI to suggest places"}
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </>
            )}

            {/* TAB 2: IDEAS */}
            {activeTab === "ideas" && (
              <div className="py-8 text-center space-y-3">
                <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                  <Sparkles className="size-6" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Ideas & Recommendations</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Places, restaurants, and activities you saved or want to explore during your trip to {trip.destinationName}.
                </p>
              </div>
            )}

            {/* TAB 3: BOOKINGS */}
            {activeTab === "bookings" && (
              <div className="py-8 text-center space-y-3">
                <div className="size-12 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                  <Hotel className="size-6" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Flights & Accommodations</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Keep your reservation confirmations and hotel bookings organized here.
                </p>
              </div>
            )}

            {/* TAB 4: CALENDAR */}
            {activeTab === "calendar" && (
              <div className="py-8 text-center space-y-3">
                <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                  <Calendar className="size-6" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Trip Calendar Timeline</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {dateRangeStr} ({daysCount} days)
                </p>
              </div>
            )}

            {/* TAB 5: CHATS */}
            {activeTab === "chats" && (
              <div className="py-8 text-center space-y-3">
                <div className="size-12 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
                  <Sparkles className="size-6" />
                </div>
                <h3 className="font-bold text-sm text-foreground">AI Travel Conversations</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  All AI planning threads for this trip are automatically linked to your trip history.
                </p>
              </div>
            )}

            {/* TAB 6: MEDIA */}
            {activeTab === "media" && (
              <div className="py-8 text-center space-y-3">
                <div className="size-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                  <Luggage className="size-6" />
                </div>
                <h3 className="font-bold text-sm text-foreground">Photos & Memories</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Share photos and moments captured during your journey.
                </p>
              </div>
            )}
          </div>
        </div>
      </>
    )}

      {/* Collaboration Dialog */}
      <TripMembersDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        tripId={trip.id}
        tripName={trip.name}
      />
    </aside>
  );
}
