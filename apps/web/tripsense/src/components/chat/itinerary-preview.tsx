"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Coffee,
  Landmark,
  Loader2,
  MapPin,
  Moon,
  Sparkles,
  Sun,
  SunMedium,
  Utensils,
  Waves,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { TripActivity, TripProposal } from "@/lib/types";
import { tripActivityToPlace } from "./chat-place-resolver";
import { usePlaceDetailAction } from "./place-detail-action-context";
import {
  applyTripProposal,
  getChatTripContext,
} from "@/features/ai-trip-commit/services/ai-trip-commit-api";
import type { ChatTripContext } from "@/features/ai-trip-commit/types";

interface ItineraryPreviewProps {
  proposal: TripProposal;
  chatId?: string;
  variant?: "chat" | "card";
  onSelectActivity?: (activity: TripActivity) => void;
}

const periodConfig = {
  MORNING: { icon: Sun, vi: "Buổi sáng", en: "Morning" },
  NOON: { icon: SunMedium, vi: "Buổi trưa", en: "Noon" },
  AFTERNOON: { icon: CloudSun, vi: "Buổi chiều", en: "Afternoon" },
  EVENING: { icon: Moon, vi: "Buổi tối", en: "Evening" },
  FLEXIBLE: { icon: CalendarDays, vi: "Linh hoạt", en: "Flexible" },
} as const;

function resolveDisplayPeriod(
  period: TripActivity["period"],
  timeSlot?: string,
): TripActivity["period"] {
  if (period === "FLEXIBLE") return "FLEXIBLE";
  const rangeMatch = timeSlot?.match(/(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?/);
  if (!rangeMatch) return period;

  const startHour = Number(rangeMatch[1]);
  const startMinute = Number(rangeMatch[2]);
  if (startHour > 23 || startMinute > 59) return period;

  const startMinutes = startHour * 60 + startMinute;
  const endHour = rangeMatch[3] ? Number(rangeMatch[3]) : null;
  const endMinute = rangeMatch[4] ? Number(rangeMatch[4]) : null;
  const endMinutes =
    endHour !== null && endMinute !== null && endHour <= 23 && endMinute <= 59
      ? endHour * 60 + endMinute
      : null;

  if (startMinutes >= 300 && startMinutes < 660 && period === "NOON") {
    return "MORNING";
  }
  const isNoonSlot =
    (startMinutes >= 690 && startMinutes < 810) ||
    (startMinutes >= 660 && startMinutes < 690 && endMinutes !== null && endMinutes > 720);
  if (isNoonSlot) {
    return "NOON";
  }
  if (startMinutes >= 810 && startMinutes < 1050 && (period === "MORNING" || period === "NOON")) {
    return "AFTERNOON";
  }
  if (startMinutes >= 1050 && (period === "MORNING" || period === "NOON")) {
    return "EVENING";
  }
  return period;
}

const shownToastOperations = new Set<string>();

const categoryBadgeConfig: Record<
  string,
  { icon: typeof BedDouble; vi: string; en: string; highlight?: boolean }
> = {
  STAY: { icon: BedDouble, vi: "Khách sạn", en: "Stay", highlight: true },
  HOTEL: { icon: BedDouble, vi: "Khách sạn", en: "Stay", highlight: true },
  FOOD: { icon: Utensils, vi: "Ẩm thực", en: "Food" },
  CAFE: { icon: Coffee, vi: "Cà phê", en: "Cafe" },
  ATTRACTION: { icon: Landmark, vi: "Tham quan", en: "Attraction" },
  BEACH: { icon: Waves, vi: "Biển", en: "Beach" },
};

function isStayActivity(activity: TripActivity): boolean {
  const cat = activity.category?.toUpperCase().trim();
  return cat === "STAY" || cat === "HOTEL";
}

function isPlaceActivity(activity: TripActivity): boolean {
  if (activity.placeId?.trim()) return true;
  if (activity.address?.trim()) return true;
  if (
    activity.location &&
    Number.isFinite(activity.location.lat) &&
    Number.isFinite(activity.location.lng) &&
    (activity.location.lat !== 0 || activity.location.lng !== 0)
  ) {
    return true;
  }
  const cat = activity.category?.toUpperCase().trim();
  return Boolean(cat && cat !== "ACTIVITY" && cat !== "LOGISTICS");
}

function ActivityRow({
  activity,
  committed,
  locale,
  onSelect,
  viewLabel,
}: {
  activity: TripActivity;
  committed: boolean;
  locale: string;
  onSelect?: (activity: TripActivity) => void;
  viewLabel?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const displayPeriod = resolveDisplayPeriod(activity.period, activity.timeSlot);
  const config = periodConfig[displayPeriod] ?? periodConfig.FLEXIBLE;
  const Icon = config.icon;
  const hasPhoto =
    typeof activity.photoUrl === "string" &&
    /^https?:\/\//i.test(activity.photoUrl.trim()) &&
    !imageFailed;
  const canOpenPlace = Boolean(onSelect && isPlaceActivity(activity));
  const photoContent = hasPhoto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={activity.photoUrl}
      alt={activity.title}
      loading="lazy"
      className="size-full object-cover"
      onError={() => setImageFailed(true)}
    />
  ) : null;

  const catKey = activity.category?.toUpperCase().trim() || "";
  const categoryBadge = categoryBadgeConfig[catKey];
  const CategoryBadgeIcon = categoryBadge?.icon;

  return (
    <div className="relative flex items-start gap-3 text-sm leading-relaxed">
      {photoContent && (
        canOpenPlace ? (
          <button
            type="button"
            onClick={() => onSelect?.(activity)}
            aria-label={viewLabel ? `${viewLabel}: ${activity.title}` : activity.title}
            className="mt-0.5 size-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted cursor-pointer transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {photoContent}
          </button>
        ) : (
          <div className="mt-0.5 size-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
            {photoContent}
          </div>
        )
      )}

      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-xs text-muted-foreground shrink-0">
            <Icon className="size-3.5 text-amber-500" aria-hidden="true" />
            <span>{locale === "vi" ? config.vi : config.en}</span>
            {activity.timeSlot && (
              <span className="text-muted-foreground/70">· {activity.timeSlot}</span>
            )}
          </span>
          {categoryBadge && CategoryBadgeIcon && (
            <span
              className={
                categoryBadge.highlight
                  ? "inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary shrink-0"
                  : "inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground shrink-0"
              }
            >
              <CategoryBadgeIcon className="size-3 shrink-0" aria-hidden="true" />
              <span>{locale === "vi" ? categoryBadge.vi : categoryBadge.en}</span>
            </span>
          )}
          {canOpenPlace ? (
            <button
              type="button"
              data-testid={`itinerary-activity-link-${activity.itemKey}`}
              onClick={() => onSelect?.(activity)}
              title={viewLabel}
              className="font-semibold text-foreground text-[14.5px] text-left underline decoration-primary/40 decoration-[1.5px] underline-offset-[3px] hover:text-primary hover:decoration-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xs"
            >
              {activity.title}
            </button>
          ) : (
            <span className="font-semibold text-foreground text-[14.5px]">
              {activity.title}
            </span>
          )}
          {committed && (
            <CheckCircle2
              className="inline size-3.5 fill-primary text-primary-foreground shrink-0"
              aria-label={locale === "vi" ? "Đã lưu vào chuyến đi" : "Saved to trip"}
            />
          )}
        </div>

        {activity.description && (
          <p className="text-xs sm:text-[13px] text-muted-foreground/90 pl-0.5">
            {activity.description}
          </p>
        )}

        {activity.address && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 pl-0.5">
            <MapPin className="size-3 shrink-0 text-primary/70" />
            <span className="truncate">{activity.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ItineraryPreview({
  proposal,
  chatId,
  variant = "card",
  onSelectActivity,
}: ItineraryPreviewProps) {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const { openPlaceDetail } = usePlaceDetailAction();
  const [context, setContext] = useState<ChatTripContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(Boolean(chatId));
  const [isApplying, setIsApplying] = useState(false);

  const handleSelectActivity = useCallback(
    (activity: TripActivity) => {
      if (onSelectActivity) {
        onSelectActivity(activity);
        return;
      }
      openPlaceDetail?.({
        place: tripActivityToPlace(activity),
        placeIdHint: activity.placeId,
        nameHint: activity.title,
        knownPhotoUrl: activity.photoUrl,
      });
    },
    [onSelectActivity, openPlaceDetail],
  );
  const activityClickHandler =
    onSelectActivity || openPlaceDetail ? handleSelectActivity : undefined;
  const viewPlaceLabel = t("aiPlanner.viewPlaceDetails");

  const refreshContext = useCallback(async () => {
    if (!chatId) return;
    setIsLoadingContext(true);
    try {
      setContext(await getChatTripContext(chatId));
    } catch {
      setContext(null);
    } finally {
      setIsLoadingContext(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    let mounted = true;
    void getChatTripContext(chatId)
      .then((value) => {
        if (mounted) setContext(value);
      })
      .catch(() => {
        if (mounted) setContext(null);
      })
      .finally(() => {
        if (mounted) setIsLoadingContext(false);
      });
    return () => {
      mounted = false;
    };
  }, [chatId]);

  useEffect(() => {
    if (!chatId || proposal.autoCommit?.status !== "APPLIED") return;
    const result = proposal.autoCommit;
    if (shownToastOperations.has(result.operationId)) return;
    shownToastOperations.add(result.operationId);

    window.dispatchEvent(
      new CustomEvent("tripsense:chat-trip-linked", {
        detail: { chatId, tripId: result.tripId },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("tripsense:itinerary-updated", {
        detail: { tripId: result.tripId },
      }),
    );
    const isReplaced =
      result.action === "REPLACE_TRIP_ITEMS" || result.action === "REPLACE_DAYS";
    toast.success(
      t(isReplaced ? "aiPlanner.toastReplaced" : "aiPlanner.toastAdded", {
        count: result.appliedCount,
        tripName: proposal.title,
      }),
      {
        id: result.operationId,
        action: {
          label: t("aiPlanner.viewTrip"),
          onClick: () => router.push(`/trips/${result.tripId}`),
        },
      },
    );
  }, [chatId, proposal.autoCommit, proposal.title, router, t]);

  const stayStops = (() => {
    const seen = new Set<string>();
    const stops: Array<{ dayNumber: number; activity: TripActivity }> = [];
    for (const day of proposal.days) {
      for (const activity of day.activities) {
        if (!isStayActivity(activity)) continue;
        const dedupeKey = (activity.placeId || activity.title).trim().toLowerCase();
        if (!dedupeKey || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        stops.push({ dayNumber: day.dayNumber, activity });
      }
    }
    return stops;
  })();

  const staySummarySection =
    stayStops.length > 0 ? (
      <div
        data-testid="itinerary-stay-summary"
        className="rounded-2xl border border-border/60 bg-card/80 p-3.5 shadow-2xs space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <BedDouble className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{t("aiPlanner.staySummaryTitle")}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {t("aiPlanner.staySummaryCount", { count: stayStops.length })}
          </span>
        </div>
        <div className="space-y-2">
          {stayStops.map(({ dayNumber, activity }) => {
            const hasPhoto =
              typeof activity.photoUrl === "string" &&
              /^https?:\/\//i.test(activity.photoUrl.trim());
            const clickable = Boolean(activityClickHandler && isPlaceActivity(activity));
            return (
              <div
                key={`stay-${activity.itemKey}`}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/25 p-2"
              >
                {hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activity.photoUrl}
                    alt={activity.title}
                    loading="lazy"
                    className="size-12 shrink-0 rounded-lg object-cover border border-border/50 bg-muted"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BedDouble className="size-5" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {clickable ? (
                    <button
                      type="button"
                      data-testid={`itinerary-stay-link-${activity.itemKey}`}
                      onClick={() => activityClickHandler?.(activity)}
                      className="text-left text-sm font-semibold text-foreground underline decoration-primary/40 decoration-[1.5px] underline-offset-[3px] hover:text-primary hover:decoration-primary transition-colors cursor-pointer line-clamp-1"
                    >
                      {activity.title}
                    </button>
                  ) : (
                    <p className="text-sm font-semibold text-foreground line-clamp-1">
                      {activity.title}
                    </p>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span>
                      {locale === "vi" ? `Nhận phòng Ngày ${dayNumber}` : `Check-in Day ${dayNumber}`}
                      {activity.timeSlot ? ` · ${activity.timeSlot}` : ""}
                    </span>
                    {activity.address && (
                      <span className="inline-flex items-center gap-1 truncate max-w-full">
                        <MapPin className="size-3 shrink-0 text-primary/70" aria-hidden="true" />
                        <span className="truncate">{activity.address}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  const committedKeys = new Set([
    ...(context?.committedSourceRefs ?? [])
      .filter((ref) => ref.proposalId === proposal.proposalId)
      .map((ref) => ref.itemKey),
    ...(proposal.autoCommit?.status === "APPLIED"
      ? proposal.autoCommit.committedItemKeys
      : []),
  ]);
  const activityCount = proposal.days.reduce(
    (total, day) => total + day.activities.length,
    0,
  );
  const isFullyApplied = activityCount > 0 && committedKeys.size >= activityCount;

  const handleApply = async () => {
    if (!chatId || isApplying || isFullyApplied) return;
    setIsApplying(true);
    try {
      const action = context?.trip ? "ADD_TO_LINKED_TRIP" : "CREATE_TRIP";
      const storageKey = `tripsense:proposal-apply:${chatId}:${proposal.proposalId}:${action}`;
      const existingKey = sessionStorage.getItem(storageKey);
      const idempotencyKey = existingKey || crypto.randomUUID();
      if (!existingKey) sessionStorage.setItem(storageKey, idempotencyKey);
      const result = await applyTripProposal({
        chatId,
        proposalId: proposal.proposalId,
        action,
        expectedTripRevision: context?.trip?.revision ?? null,
        idempotencyKey,
      });
      await refreshContext();
      window.dispatchEvent(
        new CustomEvent("tripsense:chat-trip-linked", {
          detail: { chatId, tripId: result.tripId },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("tripsense:itinerary-updated", {
          detail: { tripId: result.tripId },
        }),
      );
      if (!shownToastOperations.has(result.operationId)) {
        shownToastOperations.add(result.operationId);
        toast.success(
          t("aiPlanner.toastAdded", {
            count: result.appliedCount,
            tripName: result.tripName,
          }),
          {
            id: result.operationId,
            action: {
              label: t("aiPlanner.viewTrip"),
              onClick: () => router.push(`/trips/${result.tripId}`),
            },
          },
        );
      }
    } catch {
      toast.error(t("aiPlanner.commitError"));
    } finally {
      setIsApplying(false);
    }
  };

  if (variant === "chat") {
    return (
      <div className="w-full my-2 space-y-4 text-foreground animate-in fade-in duration-300">
        {/* Header: Title & Editorial Summary */}
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {proposal.title}
          </h3>
          {proposal.summary && (
            <p className="text-sm leading-relaxed text-muted-foreground italic">
              {proposal.summary}
            </p>
          )}
        </div>

        {/* Accommodation Highlight */}
        {staySummarySection}

        {/* Day-by-Day Timeline */}
        <div className="space-y-5 pt-1">
          {proposal.days.map((day) => (
            <div key={day.dayNumber} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                  {day.dayNumber}
                </span>
                <h4 className="text-[15px] font-bold text-foreground">
                  {locale === "vi" ? `Ngày ${day.dayNumber}` : `Day ${day.dayNumber}`} — {day.theme}
                </h4>
              </div>

              <div className="ml-3 border-l-2 border-border/40 pl-5 space-y-3.5 my-1.5">
                {day.activities.map((activity) => (
                  <ActivityRow
                    key={activity.itemKey}
                    activity={activity}
                    committed={committedKeys.has(activity.itemKey)}
                    locale={locale}
                    onSelect={activityClickHandler}
                    viewLabel={viewPlaceLabel}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Subtle Trip Sync Confirmation Link - NO "Add to trip" buttons */}
        {context?.trip && (() => {
          const trip = context.trip;
          const wasReplaced =
            proposal.autoCommit?.status === "APPLIED" &&
            (proposal.autoCommit.action === "REPLACE_TRIP_ITEMS" ||
              proposal.autoCommit.action === "REPLACE_DAYS");
          return (
            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {wasReplaced
                  ? locale === "vi"
                    ? "Đã cập nhật lại lịch trình cho chuyến đi"
                    : "Updated itinerary for trip"
                  : locale === "vi"
                    ? "Đã tự động lưu vào chuyến đi"
                    : "Saved to trip"}{" "}
                <button
                  type="button"
                  onClick={() => router.push(`/trips/${trip.id}`)}
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                >
                  “{trip.name}” <ArrowUpRight className="size-3" />
                </button>
              </span>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <section className="my-3 w-full max-w-3xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <header className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-7 text-foreground">{proposal.title}</h3>
            <p className="mt-1 text-sm italic leading-6 text-muted-foreground">
              {proposal.summary}
            </p>
          </div>
        </div>
      </header>

      {staySummarySection && <div className="px-5 pt-4">{staySummarySection}</div>}

      <div className="divide-y divide-border/60 px-5">
        {proposal.days.map((day) => (
          <article key={day.dayNumber} className="py-5 first:pt-4">
            <h4 className="text-base font-bold text-foreground">
              {locale === "vi" ? `Ngày ${day.dayNumber}` : `Day ${day.dayNumber}`} — {day.theme}
            </h4>
            <div className="mt-2 divide-y divide-border/40">
              {day.activities.map((activity) => (
                <ActivityRow
                  key={activity.itemKey}
                  activity={activity}
                  committed={committedKeys.has(activity.itemKey)}
                  locale={locale}
                  onSelect={activityClickHandler}
                  viewLabel={viewPlaceLabel}
                />
              ))}
            </div>
          </article>
        ))}
      </div>

      <footer className="flex flex-col gap-3 border-t border-border/60 bg-muted/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {isLoadingContext
            ? t("aiPlanner.checkingTrip")
            : context?.trip
              ? t("aiPlanner.linkedToTrip", { tripName: context.trip.name })
              : t("aiPlanner.notLinkedToTrip")}
        </p>
        {proposal.autoCommit?.status === "FAILED_RETRYABLE" ? (
          <Button
            onClick={handleApply}
            disabled={!chatId || isLoadingContext || isApplying}
            className="min-w-44 rounded-full"
          >
            {isApplying && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("common.retry")}
          </Button>
        ) : (
          <Button
            onClick={handleApply}
            disabled={!chatId || isLoadingContext || isApplying || isFullyApplied}
            className="min-w-44 rounded-full"
          >
            {isApplying && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isFullyApplied
              ? t("aiPlanner.addedToTrip")
              : context?.trip
                ? t("aiPlanner.addToTripConfirm")
                : t("aiPlanner.createTripConfirm")}
          </Button>
        )}
      </footer>
    </section>
  );
}
