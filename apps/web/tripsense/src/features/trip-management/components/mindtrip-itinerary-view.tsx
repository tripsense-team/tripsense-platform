"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Clock,
  Coffee,
  Compass,
  ExternalLink,
  Eye,
  GripVertical,
  Hotel,
  Landmark,
  Loader2,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryResponse,
  TripResponse,
} from "../types";
import { countTripDays } from "../utils/format";
import {
  addMinutesToTime,
  formatHHMM,
  parseTimeToMinutes,
  sortItineraryItemsByTime,
} from "../utils/time";
import {
  resolveInstantPhoto,
  useItineraryPlacePhotos,
} from "../hooks/use-itinerary-place-photos";

export interface UpdateItemTimePayload {
  startTime: string | null;
  endTime: string | null;
  clearTimes?: boolean;
}

export interface MindtripItineraryViewProps {
  trip: TripResponse;
  itinerary: ItineraryResponse | null;
  loading?: boolean;
  submitting?: boolean;
  canEdit?: boolean;
  dayThemes?: Record<number, string>;
  knownPlacePhotos?: Record<string, string>;
  photoUrls?: Record<string, string>;
  selectedItemId?: string | null;
  showIdeasSection?: boolean;
  showInspirationBanner?: boolean;
  onAddItem?: (day: ItineraryDayResponse) => void;
  onAddIdea?: () => void;
  onEditItem?: (item: ItineraryItemResponse) => void;
  onUpdateItemTime?: (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
    payload: UpdateItemTimePayload,
  ) => Promise<void> | void;
  onReorderItems?: (
    day: ItineraryDayResponse,
    orderedItemIds: string[],
    options?: { preserveTimes?: boolean },
  ) => Promise<void> | void;
  onSortAllDaysByTime?: () => Promise<void> | void;
  onDeleteItem?: (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
  ) => Promise<void> | void;
  onOpenPlaceDetail?: (item: ItineraryItemResponse, knownPhotoUrl?: string) => void;
  onSelectItem?: (item: ItineraryItemResponse) => void;
  onOpenMap?: (focusItemId?: string) => void;
  onAskAiForDay?: (day: ItineraryDayResponse) => void;
  className?: string;
}

export function calculateSegmentDistance(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null,
  locale: string = "vi",
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
  const R = 6371;
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
  if (locale === "vi") {
    return `${km.toFixed(1).replace(".", ",")} km`;
  }
  const miles = km * 0.621371;
  return `${miles.toFixed(2)} mi`;
}

function formatCompactTimeRange(
  startTime?: string | null,
  endTime?: string | null,
): string | null {
  if (!startTime) return null;
  const formatHour = (raw: string) => {
    const parts = raw.split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      return `${Number.isNaN(h) ? parts[0] : h}:${parts[1]}`;
    }
    return raw;
  };
  const startStr = formatHour(startTime);
  if (!endTime) return startStr;
  const endStr = formatHour(endTime);
  if (startStr === endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

function getItemCategoryIcon(type: string, title?: string) {
  const lower = (title || "").toLowerCase();
  if (
    type === "HOTEL" ||
    lower.includes("khách sạn") ||
    lower.includes("hotel") ||
    lower.includes("resort")
  ) {
    return <Hotel className="size-3.5 text-primary shrink-0" />;
  }
  if (
    type === "MEAL" ||
    lower.includes("bún") ||
    lower.includes("mì") ||
    lower.includes("quán") ||
    lower.includes("nhà hàng") ||
    lower.includes("restaurant") ||
    lower.includes("hải sản")
  ) {
    return <Utensils className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />;
  }
  if (lower.includes("cafe") || lower.includes("cà phê") || lower.includes("coffee")) {
    return <Coffee className="size-3.5 text-orange-600 dark:text-orange-400 shrink-0" />;
  }
  if (
    lower.includes("chùa") ||
    lower.includes("núi") ||
    lower.includes("cầu") ||
    lower.includes("phố cổ") ||
    lower.includes("chợ") ||
    lower.includes("bà nà") ||
    lower.includes("bảo tàng") ||
    lower.includes("beach") ||
    lower.includes("biển") ||
    lower.includes("mountain")
  ) {
    return <Landmark className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  return <MapPin className="size-3.5 text-rose-500 shrink-0" />;
}

function isHotelStop(item: ItineraryItemResponse): boolean {
  const lower = (item.title || "").toLowerCase();
  return (
    item.type === "HOTEL" ||
    lower.includes("hotel") ||
    lower.includes("khách sạn") ||
    lower.includes("resort")
  );
}

function isBookableStop(item: ItineraryItemResponse): boolean {
  return isHotelStop(item) || item.type === "MEAL" || item.type === "ACTIVITY";
}

function formatDayDateHeader(dateStr: string, locale: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  if (locale === "vi") {
    const daysVi = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
    return `${daysVi[d.getDay()]}, ${d.getDate()} thg ${d.getMonth() + 1}`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDayTheme(theme?: string): string | null {
  if (!theme) return null;
  const trimmed = theme.trim();
  return trimmed || null;
}

const DURATION_PRESETS = [
  { label: "+30m", minutes: 30 },
  { label: "+1h", minutes: 60 },
  { label: "+1.5h", minutes: 90 },
  { label: "+2h", minutes: 120 },
] as const;

interface InlineTimeEditorPopoverProps {
  item: ItineraryItemResponse;
  disabled?: boolean;
  onSave: (payload: UpdateItemTimePayload) => Promise<void> | void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger: React.ReactNode;
}

function InlineTimeEditorPopover({
  item,
  disabled,
  onSave,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: InlineTimeEditorPopoverProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [startTime, setStartTime] = React.useState(formatHHMM(item.startTime) || "");
  const [endTime, setEndTime] = React.useState(formatHHMM(item.endTime) || "");
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStartTime(formatHHMM(item.startTime) || "");
      setEndTime(formatHHMM(item.endTime) || "");
      setValidationError(null);
    }
    setOpen(nextOpen);
  };

  const handleApplyPreset = (minutes: number) => {
    const baseStart = startTime || "09:00";
    const nextEnd = addMinutesToTime(baseStart, minutes);
    setStartTime(baseStart);
    if (nextEnd) setEndTime(nextEnd);
    setValidationError(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const s = startTime.trim();
    const e = endTime.trim();
    if (!s && !e) {
      setSaving(true);
      try {
        await onSave({ startTime: null, endTime: null, clearTimes: true });
        setOpen(false);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!s) {
      setValidationError(t("trip.startTimeRequired"));
      return;
    }

    if (e) {
      const startMin = parseTimeToMinutes(s);
      const endMin = parseTimeToMinutes(e);
      if (startMin === null || endMin === null || endMin <= startMin) {
        setValidationError(t("trip.invalidTimeRange"));
        return;
      }
    }

    setValidationError(null);
    setSaving(true);
    try {
      await onSave({
        startTime: s,
        endTime: e || null,
        clearTimes: false,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onSave({ startTime: null, endTime: null, clearTimes: true });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("trip.editScheduleTime")}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="size-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label={t("common.close")}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {t("trip.startTime")}
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setValidationError(null);
                }}
                aria-label={t("trip.startTime")}
                className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {t("trip.endTime")}
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setValidationError(null);
                }}
                aria-label={t("trip.endTime")}
                className="h-9 w-full rounded-xl border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset.minutes)}
                className="rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {validationError && (
            <p className="text-[11px] font-medium text-destructive" role="alert">
              {validationError}
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving || (!item.startTime && !item.endTime)}
              onClick={handleClear}
              className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
            >
              {t("trip.clearTime")}
            </Button>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-7 rounded-full px-3 text-xs cursor-pointer"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="h-7 rounded-full px-3 text-xs font-semibold cursor-pointer"
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function MindtripItineraryView({
  trip,
  itinerary,
  loading = false,
  submitting = false,
  canEdit: canEditProp,
  dayThemes,
  knownPlacePhotos,
  photoUrls: externalPhotoUrls,
  selectedItemId,
  showIdeasSection = true,
  showInspirationBanner: showInspirationBannerProp = false,
  onAddItem,
  onAddIdea,
  onEditItem,
  onUpdateItemTime,
  onReorderItems,
  onSortAllDaysByTime,
  onDeleteItem,
  onOpenPlaceDetail,
  onSelectItem,
  onOpenMap,
  onAskAiForDay,
  className,
}: MindtripItineraryViewProps) {
  const { locale, t } = useTranslation();
  const canEdit = canEditProp ?? itinerary?.capabilities?.canEdit !== false;

  const internalPhotoUrls = useItineraryPlacePhotos({
    tripId: externalPhotoUrls ? null : trip.id,
    destinationName: trip.destinationName,
    itinerary: externalPhotoUrls ? null : itinerary,
    knownPlacePhotos,
  });
  const resolvedPhotoUrls = externalPhotoUrls ?? internalPhotoUrls;

  const [isIdeasSectionOpen, setIsIdeasSectionOpen] = React.useState(true);
  const [showDistances, setShowDistances] = React.useState(true);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [collapsedDays, setCollapsedDays] = React.useState<Record<string, boolean>>({});
  const [editingTimeItemId, setEditingTimeItemId] = React.useState<string | null>(null);

  // Native drag-and-drop state (within a single day)
  const [dragState, setDragState] = React.useState<{
    dayId: string;
    itemId: string;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = React.useState<{
    dayId: string;
    itemId: string;
  } | null>(null);

  const daysCount = itinerary?.days?.length || countTripDays(trip);
  const totalItemsCount = React.useMemo(
    () =>
      itinerary?.days?.reduce((sum, d) => sum + (d.items?.length || 0), 0) ?? 0,
    [itinerary],
  );

  const toggleDayCollapse = (dayId: string) => {
    setCollapsedDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }));
  };

  const handleSortDayByTime = async (day: ItineraryDayResponse) => {
    if (!canEdit || !onReorderItems || !day.items || day.items.length < 2) return;
    const sortedIds = sortItineraryItemsByTime(day.items).map((it) => it.id);
    const currentIds = day.items.map((it) => it.id);
    if (sortedIds.join("|") === currentIds.join("|")) {
      toast.info(t("trip.alreadySortedByTime"));
      return;
    }
    await onReorderItems(day, sortedIds, { preserveTimes: true });
  };

  const handleAutoChainAllDays = async () => {
    if (!canEdit || !onReorderItems || !itinerary?.days) return;
    for (const day of itinerary.days) {
      if (day.items && day.items.length >= 2) {
        const ids = day.items.map((it) => it.id);
        await onReorderItems(day, ids, { preserveTimes: false });
      }
    }
  };

  const handleMoveItem = async (
    day: ItineraryDayResponse,
    itemIndex: number,
    direction: -1 | 1,
  ) => {
    if (!canEdit || !onReorderItems) return;
    const nextIndex = itemIndex + direction;
    if (nextIndex < 0 || nextIndex >= day.items.length) return;
    const ids = day.items.map((it) => it.id);
    [ids[itemIndex], ids[nextIndex]] = [ids[nextIndex], ids[itemIndex]];
    await onReorderItems(day, ids, { preserveTimes: true });
  };

  const handleDropOnItem = async (
    day: ItineraryDayResponse,
    targetItemId: string,
  ) => {
    if (!dragState || dragState.dayId !== day.id || dragState.itemId === targetItemId) {
      setDragState(null);
      setDragOverTarget(null);
      return;
    }
    if (!canEdit || !onReorderItems) {
      setDragState(null);
      setDragOverTarget(null);
      return;
    }

    const ids = day.items.map((it) => it.id);
    const fromIdx = ids.indexOf(dragState.itemId);
    const toIdx = ids.indexOf(targetItemId);
    setDragState(null);
    setDragOverTarget(null);

    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    const nextIds = [...ids];
    const [moved] = nextIds.splice(fromIdx, 1);
    nextIds.splice(toIdx, 0, moved);
    await onReorderItems(day, nextIds, { preserveTimes: true });
  };

  const showBanner =
    showInspirationBannerProp && !bannerDismissed && totalItemsCount === 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. Collapsible Ideas Strip (matches Mindtrip Reference Image 3) */}
      {showIdeasSection && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setIsIdeasSectionOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-sm font-bold text-foreground hover:opacity-80 transition-opacity cursor-pointer"
          >
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                !isIdeasSectionOpen && "-rotate-90",
              )}
            />
            <span>{t("trip.ideas")}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("trip.ideasItemCount", { count: 0 })}
            </span>
          </button>

          {isIdeasSectionOpen && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  if (onAddIdea) {
                    onAddIdea();
                  } else if (onAddItem && itinerary?.days?.[0]) {
                    onAddItem(itinerary.days[0]);
                  }
                }}
                disabled={!canEdit && !onAddIdea}
                className="w-28 h-28 rounded-2xl bg-muted/60 hover:bg-muted border border-border/50 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="size-5 text-foreground/80 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-foreground/80">
                  {t("trip.addPlace")}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Itinerary Subheader with Distances Switch & Options Menu */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="text-base font-bold text-foreground">
              {t("trip.itinerary")}
            </h2>
            <span className="text-xs font-medium text-muted-foreground">
              {daysCount} {t("trip.daysCount")}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-medium text-muted-foreground">
                {t("trip.distances")}
              </span>
              <Switch
                checked={showDistances}
                onCheckedChange={setShowDistances}
                aria-label={t("trip.distances")}
                className={cn(
                  "h-5 w-9 [&>span]:h-4 [&>span]:w-4",
                  showDistances
                    ? "bg-foreground [&>span]:translate-x-4"
                    : "bg-muted [&>span]:translate-x-0",
                )}
              />
            </label>

            {(canEdit || onOpenMap) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    aria-label={t("trip.itineraryOptions")}
                    title={t("trip.itineraryOptions")}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
                  {canEdit && (onSortAllDaysByTime || onReorderItems) && (
                    <DropdownMenuItem
                      disabled={submitting || totalItemsCount < 2}
                      onClick={() => {
                        if (onSortAllDaysByTime) {
                          void onSortAllDaysByTime();
                        } else if (itinerary?.days) {
                          void (async () => {
                            for (const day of itinerary.days) {
                              await handleSortDayByTime(day);
                            }
                          })();
                        }
                      }}
                      className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                    >
                      <ArrowUpDown className="size-3.5 text-primary" />
                      <span>{t("trip.sortAllDaysByTime")}</span>
                    </DropdownMenuItem>
                  )}
                  {canEdit && onReorderItems && (
                    <DropdownMenuItem
                      disabled={submitting || totalItemsCount < 2}
                      onClick={() => void handleAutoChainAllDays()}
                      className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                    >
                      <Clock className="size-3.5 text-muted-foreground" />
                      <span>{t("trip.autoChainTimes")}</span>
                    </DropdownMenuItem>
                  )}
                  {onOpenMap && (
                    <>
                      {canEdit && <DropdownMenuSeparator />}
                      <DropdownMenuItem
                        onClick={() => onOpenMap()}
                        className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                      >
                        <MapIcon className="size-3.5 text-primary" />
                        <span>{t("aiPlanner.mapToggle")}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Optional Empty Inspiration Banner */}
        {showBanner && (
          <div className="relative rounded-2xl bg-muted/30 border border-border/50 p-4 sm:p-5 flex items-center justify-between gap-4 text-left overflow-hidden">
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="absolute top-2.5 right-2.5 size-6 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              aria-label={t("common.close")}
            >
              <X className="size-3.5" />
            </button>

            <div className="relative size-14 shrink-0 hidden sm:flex items-center justify-center">
              <div className="absolute top-0.5 left-0 size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 -rotate-6 flex items-center justify-center">
                <Compass className="size-4 text-amber-600" />
              </div>
              <div className="absolute bottom-0.5 right-0 size-10 rounded-xl bg-primary/10 border border-primary/20 rotate-6 flex items-center justify-center">
                <MapPin className="size-4 text-primary" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0 flex-1 pr-4">
              <h3 className="text-sm font-bold text-foreground">
                {t("trip.startShapingTitle")}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("trip.startShapingDesc")}
              </p>
            </div>
          </div>
        )}

        {/* 3. Day-by-Day Accordions */}
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>{t("common.loading")}</span>
          </div>
        ) : itinerary?.days && itinerary.days.length > 0 ? (
          <div className="space-y-6">
            {itinerary.days.map((day) => {
              const isDayCollapsed = Boolean(collapsedDays[day.id]);
              const dayDateStr = formatDayDateHeader(day.date, locale);
              const dayTheme = formatDayTheme(dayThemes?.[day.dayNumber]);
              const items = day.items || [];
              const canReorderDay = canEdit && Boolean(onReorderItems) && items.length > 1;

              return (
                <div key={day.id} className="space-y-3">
                  {/* Day Header Row */}
                  <div className="flex items-center justify-between gap-2 group/day">
                    <button
                      type="button"
                      onClick={() => toggleDayCollapse(day.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 py-1 px-1 -ml-1 rounded-xl hover:bg-muted/50 transition-colors text-left cursor-pointer"
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-200 shrink-0",
                          isDayCollapsed && "-rotate-90",
                        )}
                      />
                      <span className="font-bold text-sm text-foreground shrink-0">
                        {t("trip.day", { number: day.dayNumber })}
                      </span>
                      {dayTheme ? (
                        <span className="font-semibold text-sm text-foreground/90 truncate">
                          {dayTheme}
                        </span>
                      ) : dayDateStr ? (
                        <span className="text-xs font-medium text-muted-foreground truncate">
                          {dayDateStr}
                        </span>
                      ) : null}
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {dayTheme && dayDateStr && (
                        <span className="text-xs text-muted-foreground font-medium mr-1 hidden sm:inline">
                          {dayDateStr}
                        </span>
                      )}
                      {canReorderDay && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void handleSortDayByTime(day)}
                          data-testid={`sort-day-by-time-${day.id}`}
                          className="inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                          title={t("trip.sortByTime")}
                        >
                          <ArrowUpDown className="size-3" />
                          <span className="hidden sm:inline">{t("trip.sortByTime")}</span>
                        </button>
                      )}
                      {canEdit && onAddItem && (
                        <button
                          type="button"
                          onClick={() => onAddItem(day)}
                          className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title={t("trip.addSpot")}
                          aria-label={t("trip.addSpot")}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Day Stop Cards */}
                  {!isDayCollapsed && (
                    <div className="pl-1 sm:pl-2">
                      {items.length > 0 ? (
                        <div>
                          {items.map((item, idx) => {
                            const photoUrl =
                              resolvedPhotoUrls[item.id] ??
                              resolveInstantPhoto(item, knownPlacePhotos) ??
                              undefined;
                            const timeRange = formatCompactTimeRange(
                              item.startTime,
                              item.endTime,
                            );
                            const nextItem = items[idx + 1];
                            const distance =
                              showDistances && nextItem
                                ? calculateSegmentDistance(
                                    item.latSnapshot ?? null,
                                    item.lngSnapshot ?? null,
                                    nextItem.latSnapshot ?? null,
                                    nextItem.lngSnapshot ?? null,
                                    locale,
                                  )
                                : null;
                            const isSelected = selectedItemId === item.id;
                            const isDragging = dragState?.itemId === item.id;
                            const isDropTarget =
                              dragOverTarget?.dayId === day.id &&
                              dragOverTarget?.itemId === item.id &&
                              dragState?.itemId !== item.id;
                            const hotelStop = isHotelStop(item);
                            const showBookCta = isBookableStop(item);

                            const timeBadgeButton = canEdit && onUpdateItemTime ? (
                              <InlineTimeEditorPopover
                                key={`${item.id}-${item.startTime ?? ""}-${item.endTime ?? ""}`}
                                item={item}
                                disabled={submitting}
                                open={editingTimeItemId === item.id}
                                onOpenChange={(nextOpen) =>
                                  setEditingTimeItemId(nextOpen ? item.id : null)
                                }
                                onSave={(payload) => onUpdateItemTime(day, item, payload)}
                                trigger={
                                  <button
                                    type="button"
                                    data-testid={`edit-time-trigger-${item.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(
                                      "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -ml-1.5 text-xs transition-colors cursor-pointer",
                                      timeRange
                                        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        : "text-muted-foreground/75 hover:bg-muted hover:text-foreground",
                                    )}
                                    title={t("trip.editScheduleTime")}
                                  >
                                    <Clock className="size-3.5 shrink-0" />
                                    <span>
                                      {timeRange || t("trip.setTime")}
                                    </span>
                                  </button>
                                }
                              />
                            ) : timeRange ? (
                              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="size-3.5 shrink-0" />
                                <span>{timeRange}</span>
                              </div>
                            ) : null;

                            return (
                              <React.Fragment key={item.id}>
                                <div
                                  draggable={canReorderDay}
                                  onDragStart={(e) => {
                                    if (!canReorderDay) return;
                                    setDragState({ dayId: day.id, itemId: item.id });
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData("text/plain", item.id);
                                  }}
                                  onDragOver={(e) => {
                                    if (!dragState || dragState.dayId !== day.id) return;
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                    if (dragOverTarget?.itemId !== item.id) {
                                      setDragOverTarget({ dayId: day.id, itemId: item.id });
                                    }
                                  }}
                                  onDragLeave={() => {
                                    if (dragOverTarget?.itemId === item.id) {
                                      setDragOverTarget(null);
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    void handleDropOnItem(day, item.id);
                                  }}
                                  onDragEnd={() => {
                                    setDragState(null);
                                    setDragOverTarget(null);
                                  }}
                                  onClick={() => onSelectItem?.(item)}
                                  className={cn(
                                    "group relative flex items-center justify-between gap-3 rounded-2xl border border-border/75 bg-card p-3 transition-all duration-200 hover:border-border hover:shadow-xs",
                                    isSelected && "border-primary/70 ring-2 ring-primary/20",
                                    isDragging && "opacity-50",
                                    isDropTarget && "border-t-2 border-t-primary ring-1 ring-primary/30",
                                    !showDistances && idx > 0 && "mt-2.5",
                                  )}
                                >
                                  {/* Left: Drag Handle + Thumbnail + Info */}
                                  <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
                                    {canReorderDay && (
                                      <div
                                        className="flex items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 -ml-1"
                                        title={t("trip.dragToReorder")}
                                        aria-hidden="true"
                                      >
                                        <GripVertical className="size-4" />
                                      </div>
                                    )}

                                    {/* Thumbnail Image */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onOpenPlaceDetail) {
                                          onOpenPlaceDetail(item, photoUrl);
                                        } else {
                                          onSelectItem?.(item);
                                        }
                                      }}
                                      className="size-14 sm:size-16 rounded-xl overflow-hidden bg-muted/60 border border-border/40 shrink-0 relative flex items-center justify-center cursor-pointer"
                                      aria-label={item.title}
                                    >
                                      {photoUrl ? (
                                        <img
                                          src={photoUrl}
                                          alt={item.title}
                                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                          {getItemCategoryIcon(item.type, item.title)}
                                        </div>
                                      )}
                                    </button>

                                    {/* Title & Schedule Time */}
                                    <div className="min-w-0 flex-1 space-y-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {getItemCategoryIcon(item.type, item.title)}
                                        {onOpenPlaceDetail ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onOpenPlaceDetail(item, photoUrl);
                                            }}
                                            data-testid={`trip-item-detail-${item.id}`}
                                            aria-label={`${t("aiPlanner.viewPlaceDetails")}: ${item.title}`}
                                            className="font-semibold text-sm text-foreground truncate text-left hover:text-primary transition-colors cursor-pointer"
                                            title={item.title}
                                          >
                                            {item.title}
                                          </button>
                                        ) : (
                                          <h4
                                            className="font-semibold text-sm text-foreground truncate"
                                            title={item.title}
                                          >
                                            {item.title}
                                          </h4>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        {timeBadgeButton}
                                        {!timeRange && item.placeAddressSnapshot && (
                                          <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                            {item.placeAddressSnapshot}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Book Pill CTA + Actions Menu */}
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {showBookCta &&
                                      (hotelStop ? (
                                        <Link
                                          href={`/hotels?q=${encodeURIComponent(item.placeNameSnapshot || item.title)}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex h-8 items-center gap-1 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors cursor-pointer"
                                        >
                                          <span>{t("trip.bookAction")}</span>
                                          <ExternalLink className="size-3" />
                                        </Link>
                                      ) : onOpenPlaceDetail ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenPlaceDetail(item, photoUrl);
                                          }}
                                          className="hidden sm:inline-flex h-8 items-center gap-1 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors cursor-pointer"
                                        >
                                          <span>{t("trip.bookAction")}</span>
                                        </button>
                                      ) : (
                                        <Link
                                          href={`/services?q=${encodeURIComponent(item.placeNameSnapshot || item.title)}`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="hidden sm:inline-flex h-8 items-center gap-1 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background hover:bg-foreground/90 transition-colors cursor-pointer"
                                        >
                                          <span>{t("trip.bookAction")}</span>
                                          <ExternalLink className="size-3" />
                                        </Link>
                                      ))}

                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => e.stopPropagation()}
                                          className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                                          title={t("common.actions")}
                                          aria-label={t("common.actions")}
                                        >
                                          <MoreHorizontal className="size-4" />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-52 rounded-2xl p-1.5"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {canEdit && onUpdateItemTime && (
                                          <DropdownMenuItem
                                            onClick={() => setEditingTimeItemId(item.id)}
                                            className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                                          >
                                            <Clock className="size-3.5 text-primary" />
                                            <span>{t("trip.editScheduleTime")}</span>
                                          </DropdownMenuItem>
                                        )}
                                        {canReorderDay && (
                                          <>
                                            <DropdownMenuItem
                                              disabled={idx === 0 || submitting}
                                              onClick={() => void handleMoveItem(day, idx, -1)}
                                              className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                                            >
                                              <ArrowUp className="size-3.5 text-muted-foreground" />
                                              <span>{t("trip.moveUp")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              disabled={idx === items.length - 1 || submitting}
                                              onClick={() => void handleMoveItem(day, idx, 1)}
                                              className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                                            >
                                              <ArrowDown className="size-3.5 text-muted-foreground" />
                                              <span>{t("trip.moveDown")}</span>
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                        {canEdit && onEditItem && (
                                          <DropdownMenuItem
                                            onClick={() => onEditItem(item)}
                                            className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                                          >
                                            <Pencil className="size-3.5 text-muted-foreground" />
                                            <span>{t("trip.editItemDetails")}</span>
                                          </DropdownMenuItem>
                                        )}
                                        {(onOpenPlaceDetail || onOpenMap) && canEdit && (
                                          <DropdownMenuSeparator />
                                        )}
                                        {onOpenPlaceDetail && (
                                          <DropdownMenuItem
                                            onClick={() => onOpenPlaceDetail(item, photoUrl)}
                                            className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                                          >
                                            <Eye className="size-3.5 text-primary" />
                                            <span>{t("aiPlanner.viewPlaceDetails")}</span>
                                          </DropdownMenuItem>
                                        )}
                                        {onOpenMap && (
                                          <DropdownMenuItem
                                            onClick={() => onOpenMap(item.id)}
                                            className="cursor-pointer gap-2 rounded-xl text-xs font-medium"
                                          >
                                            <MapPin className="size-3.5 text-primary" />
                                            <span>{t("aiPlanner.locateOnMap")}</span>
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          onClick={() => {
                                            const query = item.placeNameSnapshot || item.title;
                                            window.open(
                                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                                              "_blank",
                                              "noopener,noreferrer",
                                            );
                                          }}
                                          className="cursor-pointer gap-2 rounded-xl text-xs"
                                        >
                                          <ExternalLink className="size-3.5 text-muted-foreground" />
                                          <span>{t("trip.viewOnGoogleMaps")}</span>
                                        </DropdownMenuItem>
                                        {canEdit && onDeleteItem && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              onClick={() => void onDeleteItem(day, item)}
                                              className="cursor-pointer gap-2 rounded-xl text-xs text-destructive focus:text-destructive"
                                            >
                                              <Trash2 className="size-3.5" />
                                              <span>{t("trip.removeFromDay")}</span>
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>

                                {/* Dashed Distance Connector */}
                                {showDistances && idx < items.length - 1 && (
                                  <div
                                    className="flex flex-col items-start pl-6 sm:pl-7 py-0.5"
                                    data-testid="itinerary-distance-connector"
                                  >
                                    <div className="h-2.5 border-l border-dashed border-border ml-0.5" />
                                    {distance ? (
                                      <>
                                        <span className="text-[11px] font-medium text-muted-foreground py-0.5 select-none">
                                          {distance}
                                        </span>
                                        <div className="h-2.5 border-l border-dashed border-border ml-0.5" />
                                      </>
                                    ) : (
                                      <div className="h-2 border-l border-dashed border-border ml-0.5" />
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-5 px-4 text-center space-y-2 rounded-2xl border border-dashed border-border/70 bg-muted/20">
                          <p className="text-xs text-muted-foreground">
                            {t("trip.noPlacesPlanned")}
                          </p>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {canEdit && onAddItem && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onAddItem(day)}
                                className="h-7 rounded-full px-3 text-xs font-medium gap-1 cursor-pointer"
                              >
                                <Plus className="size-3.5" />
                                <span>{t("trip.addSpot")}</span>
                              </Button>
                            )}
                            {onAskAiForDay && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onAskAiForDay(day)}
                                className="h-7 rounded-full px-3 text-xs font-medium gap-1 cursor-pointer"
                              >
                                <Sparkles className="size-3.5 text-primary" />
                                <span>{t("trip.askAiSuggestPlaces")}</span>
                              </Button>
                            )}
                          </div>
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
    </div>
  );
}
