"use client";

import * as React from "react";
import { Mic, Loader2, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { createTrip } from "@/features/trip-management/services/trip-management-api";
import {
  isoDateFromToday,
  formatWhenSelection,
  resolveFlexibleDates,
} from "@/features/trip-management/utils/date";
import type { TripResponse } from "@/features/trip-management/types";
import { toast } from "sonner";
import { ModalBackdrop } from "./modal-backdrop";
import { WhereModal } from "./where-modal";
import { WhenModal } from "./when-modal";
import { WhoModal } from "./who-modal";

export interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated?: (trip: TripResponse, initialPrompt?: string) => void;
  onRequireAuth?: () => void;
  initialDestination?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialTravelers?: number;
  initialPromptText?: string;
  initialWhenType?: "dates" | "flexible";
  initialDurationDays?: number;
  initialFlexibleMonths?: string[];
}

export function CreateTripModal({
  isOpen,
  onClose,
  onTripCreated,
  onRequireAuth,
  initialDestination = "",
  initialStartDate,
  initialEndDate,
  initialTravelers,
  initialPromptText = "",
  initialWhenType,
  initialDurationDays,
  initialFlexibleMonths,
}: CreateTripModalProps) {
  const { locale, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [prompt, setPrompt] = React.useState(initialPromptText);
  const [destination, setDestination] = React.useState(initialDestination);
  const [whenType, setWhenType] = React.useState<"dates" | "flexible">(
    initialWhenType || "dates"
  );
  const [durationDays, setDurationDays] = React.useState<number>(
    initialDurationDays || 3
  );
  const [flexibleMonths, setFlexibleMonths] = React.useState<string[]>(
    initialFlexibleMonths || []
  );
  const [startDate, setStartDate] = React.useState(initialStartDate || isoDateFromToday(7));
  const [endDate, setEndDate] = React.useState(initialEndDate || isoDateFromToday(10));

  const [whoCounts, setWhoCounts] = React.useState<
    | {
        adults: number;
        children: number;
        infants: number;
        pets: number;
      }
    | undefined
  >(
    initialTravelers && initialTravelers > 0
      ? {
          adults: initialTravelers,
          children: 0,
          infants: 0,
          pets: 0,
        }
      : undefined
  );

  const [isWhereOpen, setIsWhereOpen] = React.useState(false);
  const [isWhenOpen, setIsWhenOpen] = React.useState(false);
  const [isWhoOpen, setIsWhoOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync initial props when opened
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setPrompt(initialPromptText);
      setDestination(initialDestination);
      if (initialWhenType) setWhenType(initialWhenType);
      if (initialDurationDays) setDurationDays(initialDurationDays);
      if (initialFlexibleMonths) setFlexibleMonths(initialFlexibleMonths);
      if (initialStartDate) setStartDate(initialStartDate);
      if (initialEndDate) setEndDate(initialEndDate);
      if (initialTravelers && initialTravelers > 0) {
        setWhoCounts({
          adults: initialTravelers,
          children: 0,
          infants: 0,
          pets: 0,
        });
      } else {
        setWhoCounts(undefined);
      }
      setIsWhereOpen(false);
      setIsWhenOpen(false);
      setIsWhoOpen(false);
    }
  }

  // First name extraction for greeting matching Screenshot 8
  const firstName = React.useMemo(() => {
    if (!user) return locale === "vi" ? "bạn" : "traveler";
    if (user.name) {
      const parts = user.name.trim().split(" ");
      return parts[parts.length - 1]; // Vietnamese name last word is first name
    }
    return user.email?.split("@")[0] || "traveler";
  }, [user, locale]);

  // Format date range label
  const formattedDates = React.useMemo(() => {
    return formatWhenSelection({
      type: whenType,
      startDate,
      endDate,
      durationDays,
      flexibleMonths,
      locale,
    });
  }, [whenType, startDate, endDate, durationDays, flexibleMonths, locale]);

  const totalTravelers = whoCounts
    ? whoCounts.adults + whoCounts.children + whoCounts.infants
    : 0;
  const whoSummaryText = React.useMemo(() => {
    if (!whoCounts || (totalTravelers === 0 && whoCounts.pets === 0)) return null;
    const base =
      totalTravelers === 1
        ? t("trip.travelerCountOne")
        : t("trip.travelerCountMultiple", { count: totalTravelers });
    if (whoCounts.pets > 0) {
      const pets =
        whoCounts.pets === 1
          ? t("trip.petCountOne")
          : t("trip.petCountMultiple", { count: whoCounts.pets });
      return t("trip.travelerSummaryWithPets", {
        travelers: base,
        pets,
      });
    }
    return base;
  }, [whoCounts, totalTravelers, t]);

  const handleCreate = async () => {
    // 1. Auth check
    if (!isAuthenticated) {
      toast.error(
        locale === "vi"
          ? "Vui lòng đăng nhập để tạo và lưu chuyến đi."
          : "Please sign in to create and save your trip."
      );
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    // 2. Destination check (auto-extract from prompt if user hasn't explicitly picked one)
    let finalDestination = destination.trim();
    if (!finalDestination && prompt.trim()) {
      const match = prompt.match(
        /(?:đi|đến|ở|tại|khám\s+phá|du\s+lịch|tới|về)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s]+?)(?:\s+(?:khoảng\s+)?\d+\s*(?:ngày|đêm|tháng|vào|cùng)|\s*[,.]|$)/i
      );
      if (match && match[1]?.trim() && match[1].trim().length >= 2) {
        finalDestination = match[1].trim();
        setDestination(finalDestination);
      }
    }

    if (!finalDestination) {
      toast.error(
        locale === "vi"
          ? "Vui lòng chọn điểm đến cho chuyến đi."
          : "Please select a destination for your trip."
      );
      setIsWhereOpen(true);
      return;
    }

    try {
      setIsSubmitting(true);
      const tripName = locale === "vi" ? `Chuyến đi ${finalDestination}` : `Trip to ${finalDestination}`;

      const travelerBreakdown = whoCounts
        ? [
            `${whoCounts.adults} adult${whoCounts.adults > 1 ? "s" : ""}`,
            whoCounts.children > 0 ? `${whoCounts.children} child${whoCounts.children > 1 ? "ren" : ""}` : null,
            whoCounts.infants > 0 ? `${whoCounts.infants} infant${whoCounts.infants > 1 ? "s" : ""}` : null,
            whoCounts.pets > 0 ? `${whoCounts.pets} pet${whoCounts.pets > 1 ? "s" : ""}` : null,
          ].filter(Boolean).join(", ")
        : null;

      const flexibleNote =
        whenType === "flexible"
          ? `Travel preference: ${durationDays} days flexible${flexibleMonths.length > 0 ? ` (${flexibleMonths.join(", ")})` : ""}`
          : null;

      const combinedNotes = [
        prompt.trim() || null,
        flexibleNote,
        travelerBreakdown ? `Travelers: ${travelerBreakdown}` : null,
      ].filter(Boolean).join("\n\n");

      const newTrip = await createTrip({
        name: tripName,
        destinationName: destination.trim(),
        startDate,
        endDate,
        travelerCount: whoCounts && totalTravelers > 0 ? totalTravelers : undefined,
        notes: combinedNotes || undefined,
      });

      toast.success(
        locale === "vi"
          ? `Đã tạo chuyến đi ${newTrip.name} thành công!`
          : `Trip "${newTrip.name}" created successfully!`
      );

      onClose();
      if (onTripCreated) {
        onTripCreated(newTrip, prompt.trim());
      }
    } catch {
      toast.error(
        locale === "vi"
          ? "Không thể tạo chuyến đi. Vui lòng thử lại."
          : "The trip could not be created. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ModalBackdrop
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="max-w-[480px]"
        zIndexClassName="z-[50]"
        hideHeader={true}
      >
        <div className="flex flex-col pt-2">
          {/* Centered Bag with Plus Icon in Teal Circle (Mindtrip Screenshot 8) */}
          <div className="flex flex-col items-center text-center">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3.5 shadow-2xs">
              <Luggage className="size-5.5" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground max-w-sm leading-snug">
              {firstName
                ? t("aiPlanner.createTripModalTitle", { name: firstName })
                : t("aiPlanner.createTripModalTitleDefault")}
            </h2>
          </div>

          {/* Prompt Textarea Box */}
          <div className="mt-5 relative rounded-2xl border border-border/80 bg-muted/20 focus-within:bg-background focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-foreground/5 transition-all p-3.5 shadow-2xs">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
              placeholder={t("aiPlanner.createTripPromptPlaceholder")}
              rows={3}
              className="w-full bg-transparent resize-none border-0 p-0 text-sm md:text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 leading-relaxed"
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground/75 font-mono select-none">
                {prompt.length}/2000
              </span>
              <button
                type="button"
                className="size-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                title={t("aiPlanner.voiceInput")}
              >
                <Mic className="size-4" />
              </button>
            </div>
          </div>

          {/* Subheading: Have details? Share what you know. */}
          <p className="text-xs font-semibold text-muted-foreground/90 mt-5 mb-2.5">
            {t("trip.intakeDetailsPrompt") || "Have details? Share what you know."}
          </p>

          {/* EXACTLY 3 Detail Selectors (Where, When, Who) matching Screenshot 8 */}
          <div className="space-y-2.5">
            {/* 1. WHERE */}
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-background/50 hover:bg-muted/40 transition-colors">
              <button
                type="button"
                onClick={() => setIsWhereOpen(true)}
                className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
              >
                <span className="font-semibold text-sm text-foreground">
                  {t("trip.intakeWhere") || "Where"}
                </span>
                <span
                  className={cn(
                    "text-sm truncate max-w-[220px]",
                    destination ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {destination || t("trip.intakeSelectDestination") || "Select destination"}
                </span>
              </button>
            </div>

            {/* 2. WHEN */}
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-background/50 hover:bg-muted/40 transition-colors">
              <button
                type="button"
                onClick={() => setIsWhenOpen(true)}
                className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
              >
                <span className="font-semibold text-sm text-foreground">
                  {t("trip.intakeWhen") || "When"}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    formattedDates ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {formattedDates || t("trip.intakeSelectDates") || "Select dates"}
                </span>
              </button>
            </div>

            {/* 3. WHO */}
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-background/50 hover:bg-muted/40 transition-colors">
              <button
                type="button"
                onClick={() => setIsWhoOpen(true)}
                className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
              >
                <span className="font-semibold text-sm text-foreground">
                  {t("trip.intakeWho") || "Who"}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    whoSummaryText ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {whoSummaryText || t("trip.intakeAddPeople") || "Add people"}
                </span>
              </button>
            </div>
          </div>

          {/* Bottom Action: Create Button matching Screenshot 8 */}
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="rounded-full px-8 py-2.5 h-10 font-semibold text-sm bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  <span>{t("common.loading") || "Creating..."}</span>
                </>
              ) : (
                t("trip.intakeCreate") || "Create"
              )}
            </Button>
          </div>
        </div>
      </ModalBackdrop>

      {/* Sub-modals rendered at z-[60], smoothly floating over CreateTripModal at z-[50] */}
      <WhereModal
        isOpen={isWhereOpen}
        onClose={() => setIsWhereOpen(false)}
        initialLocation={destination}
        onSave={(data) => {
          setDestination(data.location);
          setIsWhereOpen(false);
        }}
        zIndexClassName="z-[60]"
      />

      <WhenModal
        isOpen={isWhenOpen}
        onClose={() => setIsWhenOpen(false)}
        initialType={whenType}
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialDurationDays={durationDays}
        initialFlexibleMonths={flexibleMonths}
        onSave={(data) => {
          if (data.type === "dates" && data.startDate && data.endDate) {
            setWhenType("dates");
            setStartDate(data.startDate);
            setEndDate(data.endDate);
          } else if (data.type === "flexible") {
            setWhenType("flexible");
            const dDays = data.durationDays || 3;
            setDurationDays(dDays);
            const months = data.flexibleMonths || [];
            setFlexibleMonths(months);

            const resolved = resolveFlexibleDates(dDays, months);
            setStartDate(resolved.startDate);
            setEndDate(resolved.endDate);
          }
          setIsWhenOpen(false);
        }}
        zIndexClassName="z-[60]"
      />

      <WhoModal
        isOpen={isWhoOpen}
        onClose={() => setIsWhoOpen(false)}
        initialCounts={whoCounts}
        onSave={(counts) => {
          setWhoCounts(counts);
          setIsWhoOpen(false);
        }}
        zIndexClassName="z-[60]"
      />
    </>
  );
}
