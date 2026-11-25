"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Share2,
  MoreHorizontal,
  Calendar,
  Sparkles,
  Map as MapIcon,
  Pencil,
  Trash2,
  Luggage,
  Check,
  Hotel,
  UserPlus,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarCollapseButton } from "@/components/layout/shared/sidebar-collapse-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TripMembersDialog } from "@/features/trip-management/components/trip-members-dialog";
import { AddItemDialog } from "@/features/trip-management/components/trip-dialogs";
import {
  MindtripItineraryView,
  type UpdateItemTimePayload,
} from "@/features/trip-management/components/mindtrip-itinerary-view";
import {
  resolveInstantPhoto,
  resolveItemPlaceKey,
} from "@/features/trip-management/hooks/use-itinerary-place-photos";
import {
  createItineraryItem,
  deleteItineraryItem,
  deleteTrip,
  getItinerary,
  isUuid,
  reorderItineraryItems,
  updateItineraryItem,
  updateTrip,
} from "@/features/trip-management/services/trip-management-api";
import { useTripIdeas } from "@/features/trip-management/hooks/use-trip-ideas";
import type { TripPlace } from "@/features/place-actions/types";
import type {
  CreateItineraryItemRequest,
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryResponse,
  TripResponse,
} from "@/features/trip-management/types";
import { formatShortRange, countTripDays } from "@/features/trip-management/utils/format";
import {
  formatWhenSelection,
  parseFlexiblePreferenceFromNotes,
} from "@/features/trip-management/utils/date";
import {
  chainItineraryItemsTimes,
  itemDurationMinutes,
  sortItineraryItemsByTime,
} from "@/features/trip-management/utils/time";
import { ApiError } from "@/services/api-client";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { useTranslation } from "@/i18n";
import { formatTripTitle } from "@/components/chat/sidebar-flyout";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export { resolveInstantPhoto, resolveItemPlaceKey };

export interface TripDetailPanelProps {
  trip: TripResponse;
  dayThemes?: Record<number, string>;
  knownPlacePhotos?: Record<string, string>;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onTripUpdated?: (updatedTrip: TripResponse) => void;
  onTripDeleted?: (tripId: string) => void;
  onOpenPlaceDetail?: (item: ItineraryItemResponse, knownPhotoUrl?: string) => void;
  onOpenIdeaDetail?: (idea: TripPlace, knownPhotoUrl?: string) => void;
  onOpenMap?: (focusItemId?: string) => void;
  onOpenWhere?: () => void;
  onOpenWhen?: () => void;
  onOpenWho?: () => void;
  onOpenBudget?: () => void;
  className?: string;
}

export type TripDetailTab = "itinerary" | "ideas" | "bookings" | "calendar" | "chats" | "media";

function newItemDraft(): CreateItineraryItemRequest {
  return {
    type: "ACTIVITY",
    title: "",
    startTime: "",
    endTime: "",
    durationMinutes: null,
    notes: "",
  };
}

export function TripDetailPanel({
  trip,
  dayThemes,
  knownPlacePhotos,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  onTripUpdated,
  onTripDeleted,
  onOpenPlaceDetail,
  onOpenIdeaDetail,
  onOpenMap,
  onOpenWhere,
  onOpenWhen,
  onOpenWho,
  onOpenBudget,
  className,
}: TripDetailPanelProps) {
  const { locale, t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TripDetailTab>("itinerary");
  const [itinerary, setItinerary] = React.useState<ItineraryResponse | null>(null);
  const [loadedTripId, setLoadedTripId] = React.useState<string | null>(null);
  const isLoadingItinerary = loadedTripId !== trip.id;
  const [isMutating, setIsMutating] = React.useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = React.useState(false);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(trip.name);

  // Live Trip Ideas saved from AI Chat carousels or Explore
  const {
    ideas: tripIdeas,
    photoUrls: ideaPhotoUrls,
    removeIdea,
  } = useTripIdeas({
    tripId: trip.id,
    knownPlacePhotos,
  });

  // Add item dialog inside AI Chat TripDetailPanel
  const [addItemDay, setAddItemDay] = React.useState<ItineraryDayResponse | null>(null);
  const [itemDraft, setItemDraft] = React.useState<CreateItineraryItemRequest>(() =>
    newItemDraft(),
  );
  const [addItemError, setAddItemError] = React.useState<string | null>(null);

  const notifyItineraryChanged = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("tripsense:itinerary-updated", {
          detail: { tripId: trip.id, source: "trip-detail-panel" },
        }),
      );
    }
  }, [trip.id]);

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
        if (active) {
          toast.error(getSafeErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoadedTripId(trip.id);
      });

    return () => {
      active = false;
    };
  }, [trip.id]);

  // Reactive listener: automatically reload itinerary when AI commits or finishes streaming
  React.useEffect(() => {
    const handleItineraryUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{ tripId?: string; source?: string }>).detail;
      if (detail?.source === "trip-detail-panel") return;
      if (!detail?.tripId || detail.tripId === trip.id) {
        getItinerary(trip.id)
          .then((res) => {
            setItinerary(res);
            setLoadedTripId(trip.id);
          })
          .catch(() => {});
      }
    };

    window.addEventListener("tripsense:itinerary-updated", handleItineraryUpdated);
    return () => {
      window.removeEventListener("tripsense:itinerary-updated", handleItineraryUpdated);
    };
  }, [trip.id]);

  // Format date range
  const dateRangeStr = React.useMemo(() => {
    const flexInfo = parseFlexiblePreferenceFromNotes(trip.notes);
    if (flexInfo) {
      return formatWhenSelection({
        type: "flexible",
        durationDays: flexInfo.durationDays,
        flexibleMonths: flexInfo.flexibleMonths,
        locale,
      });
    }
    if (!trip.startDate || !trip.endDate) {
      return locale === "vi" ? "Chưa chọn ngày" : "Dates not selected";
    }
    return formatShortRange(trip.startDate, trip.endDate);
  }, [trip.notes, trip.startDate, trip.endDate, locale]);

  const daysCount = itinerary?.days?.length || countTripDays(trip);

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle.trim() === trip.name) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const updated = await updateTrip(trip.id, { name: editedTitle.trim() });
      if (onTripUpdated) onTripUpdated(updated);
      toast.success(
        locale === "vi" ? "Đã cập nhật tên chuyến đi" : "Trip title updated",
      );
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      void navigator.clipboard.writeText(`${window.location.origin}/trips/${trip.id}`);
      toast.success(t("trip.copiedInviteLink"));
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        locale === "vi"
          ? "Bạn có chắc chắn muốn xoá chuyến đi này?"
          : "Are you sure you want to delete this trip?",
      )
    ) {
      return;
    }
    try {
      await deleteTrip(trip.id);
      toast.success(locale === "vi" ? "Đã xoá chuyến đi" : "Trip deleted");
      if (onTripDeleted) onTripDeleted(trip.id);
      onClose();
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    }
  };

  const handleUpdateItemTime = async (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
    payload: UpdateItemTimePayload,
    retryOnConflict = true,
  ) => {
    const clearTimes = Boolean(payload.clearTimes);
    const nextStartTime = clearTimes ? null : payload.startTime || null;
    const nextEndTime = clearTimes ? null : payload.endTime || null;
    const nextDuration = clearTimes
      ? null
      : itemDurationMinutes({
          startTime: nextStartTime,
          endTime: nextEndTime,
          durationMinutes: null,
        });

    setIsMutating(true);
    try {
      const updated = await updateItineraryItem(trip.id, item.id, {
        startTime: nextStartTime,
        endTime: nextEndTime,
        durationMinutes: nextDuration,
        clearTimes,
        version: item.version,
        expectedTripRevision: itinerary?.revision,
      });

      setItinerary((current) =>
        current
          ? {
              ...current,
              revision:
                current.revision != null ? current.revision + 1 : current.revision,
              days: current.days.map((candidate) =>
                candidate.id === day.id
                  ? {
                      ...candidate,
                      items: candidate.items.map((existing) =>
                        existing.id === updated.id ? updated : existing,
                      ),
                    }
                  : candidate,
              ),
            }
          : current,
      );
      notifyItineraryChanged();
      toast.success(t("trip.timeUpdated"));
    } catch (err) {
      if (retryOnConflict && err instanceof ApiError && err.status === 409) {
        try {
          const freshItinerary = await getItinerary(trip.id);
          setItinerary(freshItinerary);
          const freshDay = freshItinerary.days.find((d) => d.id === day.id);
          const freshItem = freshDay?.items.find((i) => i.id === item.id);
          if (freshDay && freshItem) {
            const retried = await updateItineraryItem(trip.id, freshItem.id, {
              startTime: nextStartTime,
              endTime: nextEndTime,
              durationMinutes: nextDuration,
              clearTimes,
              version: freshItem.version,
              expectedTripRevision: freshItinerary.revision,
            });
            setItinerary({
              ...freshItinerary,
              revision:
                freshItinerary.revision != null
                  ? freshItinerary.revision + 1
                  : freshItinerary.revision,
              days: freshItinerary.days.map((candidate) =>
                candidate.id === freshDay.id
                  ? {
                      ...candidate,
                      items: candidate.items.map((existing) =>
                        existing.id === retried.id ? retried : existing,
                      ),
                    }
                  : candidate,
              ),
            });
            notifyItineraryChanged();
            toast.success(t("trip.timeUpdated"));
            return;
          }
        } catch (retryErr) {
          toast.error(getSafeErrorMessage(retryErr));
          return;
        }
      }
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsMutating(false);
    }
  };

  const handleReorderItems = async (
    day: ItineraryDayResponse,
    orderedItemIds: string[],
    options?: { preserveTimes?: boolean },
    retryOnConflict = true,
  ) => {
    const preserveTimes = options?.preserveTimes ?? true;
    const currentOrder = day.items.map((candidate) => candidate.id).join("|");
    const nextOrder = orderedItemIds.join("|");
    if (preserveTimes && currentOrder === nextOrder) return;

    const itemMap = new Map(day.items.map((item) => [item.id, item]));
    const reorderedRaw = orderedItemIds
      .map((id) => itemMap.get(id))
      .filter((item): item is ItineraryItemResponse => Boolean(item));
    const optimisticItems = preserveTimes
      ? reorderedRaw
      : chainItineraryItemsTimes(reorderedRaw);

    const previousItinerary = itinerary;
    setItinerary((current) =>
      current
        ? {
            ...current,
            days: current.days.map((candidate) =>
              candidate.id === day.id
                ? { ...candidate, items: optimisticItems }
                : candidate,
            ),
          }
        : current,
    );

    setIsMutating(true);
    try {
      const nextDay = await reorderItineraryItems(trip.id, day.id, {
        orderedItemIds,
        version: day.version,
        expectedTripRevision: itinerary?.revision,
        preserveTimes,
      });

      setItinerary((current) =>
        current
          ? {
              ...current,
              revision:
                current.revision != null ? current.revision + 1 : current.revision,
              days: current.days.map((candidate) =>
                candidate.id === nextDay.id ? nextDay : candidate,
              ),
            }
          : current,
      );
      notifyItineraryChanged();
      toast.success(t("trip.orderUpdated"));
    } catch (err) {
      if (retryOnConflict && err instanceof ApiError && err.status === 409) {
        try {
          const freshItinerary = await getItinerary(trip.id);
          setItinerary(freshItinerary);
          const freshDay = freshItinerary.days.find((d) => d.id === day.id);
          if (freshDay) {
            const nextDay = await reorderItineraryItems(trip.id, freshDay.id, {
              orderedItemIds,
              version: freshDay.version,
              expectedTripRevision: freshItinerary.revision,
              preserveTimes,
            });
            setItinerary({
              ...freshItinerary,
              revision:
                freshItinerary.revision != null
                  ? freshItinerary.revision + 1
                  : freshItinerary.revision,
              days: freshItinerary.days.map((candidate) =>
                candidate.id === nextDay.id ? nextDay : candidate,
              ),
            });
            notifyItineraryChanged();
            toast.success(t("trip.orderUpdated"));
            return;
          }
        } catch (retryErr) {
          toast.error(getSafeErrorMessage(retryErr));
          return;
        }
      }
      setItinerary(previousItinerary);
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsMutating(false);
    }
  };

  const handleSortAllDaysByTime = async () => {
    if (!itinerary?.days) return;
    setIsMutating(true);
    try {
      let currentItinerary = itinerary;
      let changedCount = 0;

      for (const day of currentItinerary.days) {
        if (!day.items || day.items.length < 2) continue;
        const sortedIds = sortItineraryItemsByTime(day.items).map((it) => it.id);
        const currentIds = day.items.map((it) => it.id);
        if (sortedIds.every((id, idx) => id === currentIds[idx])) continue;

        const nextDay = await reorderItineraryItems(trip.id, day.id, {
          orderedItemIds: sortedIds,
          version: day.version,
          expectedTripRevision: currentItinerary.revision,
          preserveTimes: true,
        });
        changedCount += 1;
        currentItinerary = {
          ...currentItinerary,
          revision:
            currentItinerary.revision != null
              ? currentItinerary.revision + 1
              : currentItinerary.revision,
          days: currentItinerary.days.map((candidate) =>
            candidate.id === nextDay.id ? nextDay : candidate,
          ),
        };
      }

      setItinerary(currentItinerary);
      if (changedCount > 0) {
        notifyItineraryChanged();
        toast.success(t("trip.orderUpdated"));
      } else {
        toast.info(t("trip.alreadySortedByTime"));
      }
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
      try {
        const fresh = await getItinerary(trip.id);
        setItinerary(fresh);
      } catch {
        // Ignore refresh error
      }
    } finally {
      setIsMutating(false);
    }
  };

  const handleDeleteItem = async (
    day: ItineraryDayResponse,
    item: ItineraryItemResponse,
  ) => {
    setIsMutating(true);
    try {
      await deleteItineraryItem(trip.id, item.id, itinerary?.revision, item.version);
      setItinerary((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          revision: prev.revision != null ? prev.revision + 1 : prev.revision,
          days: prev.days.map((d) =>
            d.id === day.id
              ? { ...d, items: (d.items || []).filter((it) => it.id !== item.id) }
              : d,
          ),
        };
      });
      notifyItineraryChanged();
      toast.success(t("trip.itemRemoved"));
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsMutating(false);
    }
  };

  const submitAddItem = async (payload: CreateItineraryItemRequest) => {
    if (!addItemDay) return;
    setIsMutating(true);
    setAddItemError(null);
    try {
      await createItineraryItem(trip.id, addItemDay.id, {
        ...payload,
        startTime: payload.startTime || null,
        endTime: payload.endTime || null,
        durationMinutes: itemDurationMinutes(payload),
        expectedTripRevision: itinerary?.revision,
      });
      const fresh = await getItinerary(trip.id);
      setItinerary(fresh);
      setAddItemDay(null);
      setItemDraft(newItemDraft());
      notifyItineraryChanged();
      toast.success(t("trip.itemAdded"));
    } catch (err) {
      const msg = getSafeErrorMessage(err);
      setAddItemError(msg);
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
  };

  const handlePromoteIdeaToDay = async (
    idea: TripPlace,
    day: ItineraryDayResponse,
  ) => {
    setIsMutating(true);
    try {
      await createItineraryItem(trip.id, day.id, {
        placeId: isUuid(idea.placeRef) ? idea.placeRef : null,
        placeRef: idea.placeRef,
        type: "PLACE",
        title: idea.placeNameSnapshot,
        notes: idea.placeAddressSnapshot || undefined,
        expectedTripRevision: itinerary?.revision,
      });
      const fresh = await getItinerary(trip.id);
      setItinerary(fresh);
      notifyItineraryChanged();
      toast.success(
        t("trip.ideaAddedToDay", {
          name: idea.placeNameSnapshot,
          day: day.dayNumber,
        }),
      );
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveIdea = async (idea: TripPlace) => {
    setIsMutating(true);
    try {
      await removeIdea(idea.placeRef);
      toast.info(t("trip.ideaRemoved", { name: idea.placeNameSnapshot }));
    } catch (err) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <aside
      className={cn(
        "relative z-20 flex h-full shrink-0 flex-col overflow-hidden bg-background transition-all duration-300 ease-in-out select-none",
        isCollapsed
          ? "w-14 rounded-l-xl rounded-r-none border-l border-border/70"
          : "w-full md:w-[50%] lg:w-[48%] xl:w-[46%] rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l border-border/70 shadow-xl",
        className,
      )}
    >
      {/* When Collapsed: Vertical Minimized Strip */}
      {isCollapsed ? (
        <div className="flex flex-1 flex-col items-center py-3.5 gap-2.5 select-none h-full w-full">
          {onToggleCollapse && (
            <SidebarCollapseButton
              collapsed={true}
              onToggleCollapse={onToggleCollapse}
              collapseTitle={
                locale === "vi" ? "Thu gọn bảng chi tiết" : "Collapse panel"
              }
              expandTitle={
                locale === "vi" ? "Mở rộng bảng chi tiết" : "Expand panel"
              }
              tooltipSide="left"
              iconClassName="h-4.5 w-4.5"
              className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer bg-background/95 dark:bg-card/95 shadow-none shrink-0"
            />
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="w-6 h-px bg-border/40 my-1 shrink-0" />

          <div className="flex-1 flex items-center justify-center [writing-mode:vertical-rl] text-xs font-semibold text-muted-foreground tracking-wider uppercase select-none py-2">
            {trip.destinationName || trip.name}
          </div>
        </div>
      ) : (
        <>
          {/* 1. STICKY TOP ACTION BAR */}
          <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/95 px-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              {onToggleCollapse && (
                <SidebarCollapseButton
                  collapsed={false}
                  onToggleCollapse={onToggleCollapse}
                  collapseTitle={
                    locale === "vi" ? "Thu gọn bảng chi tiết" : "Collapse panel"
                  }
                  expandTitle={
                    locale === "vi" ? "Mở rộng bảng chi tiết" : "Expand panel"
                  }
                  tooltipSide="bottom"
                  iconClassName="h-4.5 w-4.5"
                  className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer bg-background/95 dark:bg-card/95 shadow-none shrink-0"
                />
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close")}
                className="h-8.5 w-8.5 rounded-full border border-border/70 flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                title={t("common.close")}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
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

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInviteDialogOpen(true)}
                className="h-8 rounded-full px-3 text-xs font-semibold border-border/70 hover:bg-muted text-foreground gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="size-3.5 text-primary" />
                <span>{t("trip.invite")}</span>
              </Button>

              <button
                type="button"
                onClick={handleShare}
                className="size-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={t("trip.copyInviteLink")}
                aria-label={t("trip.copyInviteLink")}
              >
                <Share2 className="size-3.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="size-8 rounded-full border border-border/70 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title={t("common.actions")}
                    aria-label={t("common.actions")}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-2xl p-1.5 shadow-xl"
                >
                  <DropdownMenuItem
                    onClick={() => setIsEditingTitle(true)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer"
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                    <span>
                      {locale === "vi" ? "Đổi tên chuyến đi" : "Rename trip"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive focus:text-destructive rounded-xl cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>{t("trip.deleteTrip")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded Full Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col min-h-0">
            {/* 2. TITLE & SEGMENTED METADATA BAR */}
            <div className="px-6 pt-5 pb-3">
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSaveTitle();
                      if (e.key === "Escape") setIsEditingTitle(false);
                    }}
                    autoFocus
                    className="text-2xl font-bold text-foreground bg-muted/30 border border-primary/50 rounded-xl px-2.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleSaveTitle()}
                    className="h-8 rounded-lg px-3 cursor-pointer"
                  >
                    <Check className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <h1
                  onClick={() => {
                    setEditedTitle(trip.name);
                    setIsEditingTitle(true);
                  }}
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground hover:opacity-85 transition-opacity cursor-pointer mb-3"
                  title={
                    locale === "vi"
                      ? "Bấm để đổi tên chuyến đi"
                      : "Click to rename trip"
                  }
                >
                  {formatTripTitle(trip.name, trip.destinationName, locale)}
                </h1>
              )}

              <div className="inline-flex flex-wrap items-center rounded-full border border-border/80 bg-card divide-x divide-border/70 text-xs shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={onOpenWhere}
                  className="px-3 py-1.5 font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  {trip.destinationName || t("trip.destination")}
                </button>
                <button
                  type="button"
                  onClick={onOpenWhen}
                  className="px-3 py-1.5 font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  {dateRangeStr}
                </button>
                <button
                  type="button"
                  onClick={onOpenWho}
                  className={cn(
                    "px-3 py-1.5 hover:bg-muted/60 transition-colors cursor-pointer",
                    trip.travelerCount
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {trip.travelerCount
                    ? trip.travelerCount === 1
                      ? t("trip.travelerCountOne")
                      : t("trip.travelerCountMultiple", {
                          count: trip.travelerCount,
                        })
                    : t("trip.intakeWho")}
                </button>
                <button
                  type="button"
                  onClick={onOpenBudget}
                  className={cn(
                    "px-3 py-1.5 hover:bg-muted/60 transition-colors cursor-pointer",
                    trip.budgetAmount
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {trip.budgetAmount
                    ? `${trip.budgetAmount.toLocaleString()} ${trip.budgetCurrency || "VND"}`
                    : t("trip.budget")}
                </button>
              </div>
            </div>

            {/* 3. NAVIGATION TABS BAR */}
            <div className="px-6 border-b border-border/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5 sm:gap-6 overflow-x-auto scrollbar-none">
                {(
                  [
                    { id: "itinerary", label: t("trip.itinerary") },
                    { id: "ideas", label: t("trip.ideas") },
                    { id: "bookings", label: t("trip.bookings") },
                    { id: "calendar", label: t("trip.calendar") },
                    { id: "chats", label: t("trip.chats") },
                    { id: "media", label: t("trip.media") },
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
                          : "text-muted-foreground/80 hover:text-foreground",
                      )}
                    >
                      {tab.label}
                      {tab.id === "ideas" && tripIdeas.length > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                          {tripIdeas.length}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              {onOpenMap && (
                <button
                  type="button"
                  data-testid="trip-detail-map-toggle"
                  onClick={() => onOpenMap()}
                  className="size-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title={t("aiPlanner.mapToggle")}
                  aria-label={t("aiPlanner.mapToggle")}
                >
                  <MapIcon className="size-4" />
                </button>
              )}
            </div>

            {/* 4. TAB CONTENTS */}
            <div className="flex-1 p-6 space-y-6">
              {activeTab === "itinerary" && (
                <MindtripItineraryView
                  trip={trip}
                  itinerary={itinerary}
                  loading={isLoadingItinerary}
                  submitting={isMutating}
                  dayThemes={dayThemes}
                  knownPlacePhotos={knownPlacePhotos}
                  showIdeasSection={true}
                  showInspirationBanner={true}
                  ideas={tripIdeas}
                  ideaPhotoUrls={ideaPhotoUrls}
                  onPromoteIdeaToDay={handlePromoteIdeaToDay}
                  onRemoveIdea={handleRemoveIdea}
                  onOpenIdeaDetail={onOpenIdeaDetail}
                  onAddItem={(day) => {
                    setAddItemError(null);
                    setItemDraft(newItemDraft());
                    setAddItemDay(day);
                  }}
                  onAddIdea={() => {
                    if (itinerary?.days?.[0]) {
                      setAddItemError(null);
                      setItemDraft(newItemDraft());
                      setAddItemDay(itinerary.days[0]);
                    } else {
                      toast.info(t("trip.askAiIdeasHint"));
                    }
                  }}
                  onUpdateItemTime={handleUpdateItemTime}
                  onReorderItems={handleReorderItems}
                  onSortAllDaysByTime={handleSortAllDaysByTime}
                  onDeleteItem={handleDeleteItem}
                  onOpenPlaceDetail={onOpenPlaceDetail}
                  onOpenMap={onOpenMap}
                  onAskAiForDay={(day) => {
                    toast.info(
                      locale === "vi"
                        ? `Gợi ý: Hãy chat "Gợi ý lịch trình cho Ngày ${day.dayNumber}" với AI ở khung bên trái!`
                        : `Tip: Ask "Suggest itinerary for Day ${day.dayNumber}" in the AI chat on the left!`,
                    );
                  }}
                />
              )}

              {activeTab === "ideas" && (
                tripIdeas.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                      <Sparkles className="size-6" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground">
                      {t("trip.ideas")}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {t("trip.askAiIdeasHint")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="trip-panel-ideas-list">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">
                        {t("trip.savedTripIdeasTitle")}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {t("trip.ideasItemCount", { count: tripIdeas.length })}
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {tripIdeas.map((idea) => {
                        const photoUrl = ideaPhotoUrls[idea.placeRef] || null;
                        const days = itinerary?.days ?? [];
                        return (
                          <div
                            key={idea.id}
                            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-2.5 shadow-2xs hover:border-primary/40 transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                onOpenIdeaDetail?.(idea, photoUrl || undefined)
                              }
                              className="size-14 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted flex items-center justify-center cursor-pointer"
                            >
                              {photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={photoUrl}
                                  alt={idea.placeNameSnapshot}
                                  loading="lazy"
                                  className="size-full object-cover"
                                />
                              ) : (
                                <MapPin className="size-5 text-muted-foreground/60" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenIdeaDetail?.(idea, photoUrl || undefined)
                                }
                                className="text-left text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-1 cursor-pointer"
                              >
                                {idea.placeNameSnapshot}
                              </button>
                              {idea.placeAddressSnapshot && (
                                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                                  {idea.placeAddressSnapshot}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {days.length > 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={isMutating}
                                      className="h-8 rounded-full px-2.5 text-xs gap-1 cursor-pointer"
                                    >
                                      <Plus className="size-3.5" />
                                      <span>{t("trip.addToDay")}</span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    align="end"
                                    side="bottom"
                                    className="w-44 p-1.5 text-xs"
                                  >
                                    <div className="space-y-0.5 max-h-44 overflow-y-auto">
                                      {days.map((day) => (
                                        <button
                                          key={day.id}
                                          type="button"
                                          disabled={isMutating}
                                          onClick={() =>
                                            void handlePromoteIdeaToDay(idea, day)
                                          }
                                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted font-medium text-foreground flex items-center justify-between cursor-pointer"
                                        >
                                          <span>
                                            {locale === "vi"
                                              ? `Ngày ${day.dayNumber}`
                                              : `Day ${day.dayNumber}`}
                                          </span>
                                          <Plus className="size-3 text-muted-foreground" />
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}

                              <button
                                type="button"
                                disabled={isMutating}
                                title={t("trip.removeIdea")}
                                aria-label={t("trip.removeIdea")}
                                onClick={() => void handleRemoveIdea(idea)}
                                className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              {activeTab === "bookings" && (
                <div className="py-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                    <Hotel className="size-6" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {t("trip.bookings")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {locale === "vi"
                      ? "Quản lý xác nhận đặt phòng khách sạn, vé tham quan và dịch vụ tại đây."
                      : "Keep your reservation confirmations and hotel bookings organized here."}
                  </p>
                </div>
              )}

              {activeTab === "calendar" && (
                <div className="py-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                    <Calendar className="size-6" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {t("trip.calendar")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {dateRangeStr} ({daysCount} {t("trip.daysCount")})
                  </p>
                </div>
              )}

              {activeTab === "chats" && (
                <div className="py-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center mx-auto">
                    <Sparkles className="size-6" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {t("trip.chats")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {locale === "vi"
                      ? "Tất cả cuộc trò chuyện lập kế hoạch AI cho chuyến đi này đều được liên kết tự động."
                      : "All AI planning threads for this trip are automatically linked to your trip history."}
                  </p>
                </div>
              )}

              {activeTab === "media" && (
                <div className="py-8 text-center space-y-3">
                  <div className="size-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
                    <Luggage className="size-6" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {t("trip.media")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {locale === "vi"
                      ? "Lưu giữ hình ảnh và khoảnh khắc trong chuyến đi của bạn."
                      : "Share photos and moments captured during your journey."}
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

      {/* Add Place Dialog directly inside AI Chat TripDetailPanel */}
      {addItemDay && (
        <AddItemDialog
          trip={trip}
          day={addItemDay}
          days={itinerary?.days ?? []}
          onSelectDay={setAddItemDay}
          draft={itemDraft}
          error={addItemError}
          submitting={isMutating}
          onOpenChange={(open) => {
            if (!open) {
              setAddItemDay(null);
              setAddItemError(null);
            }
          }}
          onDraftChange={setItemDraft}
          onSubmit={(event) => {
            event.preventDefault();
            void submitAddItem(itemDraft);
          }}
          onQuickSubmit={(payload) => {
            void submitAddItem(payload);
          }}
        />
      )}
    </aside>
  );
}
