"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  Loader2,
  MapPin,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { TripActivity, TripProposal } from "@/lib/types";
import {
  applyTripProposal,
  getChatTripContext,
} from "@/features/ai-trip-commit/services/ai-trip-commit-api";
import type { ChatTripContext } from "@/features/ai-trip-commit/types";

interface ItineraryPreviewProps {
  proposal: TripProposal;
  chatId?: string;
  variant?: "chat" | "card";
}

const periodConfig = {
  MORNING: { icon: Sun, vi: "Buổi sáng", en: "Morning" },
  AFTERNOON: { icon: CloudSun, vi: "Buổi chiều", en: "Afternoon" },
  EVENING: { icon: Moon, vi: "Buổi tối", en: "Evening" },
  FLEXIBLE: { icon: CalendarDays, vi: "Linh hoạt", en: "Flexible" },
} as const;

const shownToastOperations = new Set<string>();

function ActivityRow({
  activity,
  committed,
  locale,
}: {
  activity: TripActivity;
  committed: boolean;
  locale: string;
}) {
  const config = periodConfig[activity.period] ?? periodConfig.FLEXIBLE;
  const Icon = config.icon;
  return (
    <div className="relative flex flex-col gap-0.5 text-sm leading-relaxed">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 font-medium text-xs text-muted-foreground shrink-0">
          <Icon className="size-3.5 text-amber-500" aria-hidden="true" />
          <span>{locale === "vi" ? config.vi : config.en}</span>
          {activity.timeSlot && (
            <span className="text-muted-foreground/70">· {activity.timeSlot}</span>
          )}
        </span>
        <span className="font-semibold text-foreground text-[14.5px]">
          {activity.title}
        </span>
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
  );
}

export function ItineraryPreview({
  proposal,
  chatId,
  variant = "card",
}: ItineraryPreviewProps) {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const [context, setContext] = useState<ChatTripContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(Boolean(chatId));
  const [isApplying, setIsApplying] = useState(false);

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
    toast.success(
      t("aiPlanner.toastAdded", {
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
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Subtle Trip Sync Confirmation Link - NO "Add to trip" buttons */}
        {context?.trip && (() => {
          const trip = context.trip;
          return (
            <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {locale === "vi" ? "Đã tự động lưu vào chuyến đi" : "Saved to trip"}{" "}
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
