"use client";

import * as React from "react";
import { Mic, Loader2, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { createTrip } from "@/features/trip-management/services/trip-management-api";
import { isoDateFromToday } from "@/features/trip-management/utils/date";
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
}

export function CreateTripModal({
  isOpen,
  onClose,
  onTripCreated,
  onRequireAuth,
  initialDestination = "",
  initialStartDate,
  initialEndDate,
  initialTravelers = 1,
  initialPromptText = "",
}: CreateTripModalProps) {
  const { locale, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [prompt, setPrompt] = React.useState(initialPromptText);
  const [destination, setDestination] = React.useState(initialDestination);
  const [startDate, setStartDate] = React.useState(initialStartDate || isoDateFromToday(7));
  const [endDate, setEndDate] = React.useState(initialEndDate || isoDateFromToday(10));

  const [whoCounts, setWhoCounts] = React.useState({
    adults: initialTravelers > 0 ? initialTravelers : 1,
    children: 0,
    infants: 0,
    pets: 0,
  });

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
      if (initialStartDate) setStartDate(initialStartDate);
      if (initialEndDate) setEndDate(initialEndDate);
      if (initialTravelers) {
        setWhoCounts({
          adults: initialTravelers > 0 ? initialTravelers : 1,
          children: 0,
          infants: 0,
          pets: 0,
        });
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
    if (!startDate || !endDate) return null;
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const sMonth = s.getMonth() + 1;
      const eMonth = e.getMonth() + 1;
      if (locale === "vi") {
        if (sMonth === eMonth) {
          return `${s.getDate()} – ${e.getDate()} thg ${sMonth}`;
        }
        return `${s.getDate()} thg ${sMonth} – ${e.getDate()} thg ${eMonth}`;
      }
      const sMonthStr = s.toLocaleString("en-US", { month: "short" });
      const eMonthStr = e.toLocaleString("en-US", { month: "short" });
      if (sMonth === eMonth) {
        return `${sMonthStr} ${s.getDate()} – ${e.getDate()}`;
      }
      return `${sMonthStr} ${s.getDate()} – ${eMonthStr} ${e.getDate()}`;
    } catch {
      return `${startDate} → ${endDate}`;
    }
  }, [startDate, endDate, locale]);

  const totalTravelers = whoCounts.adults + whoCounts.children + whoCounts.infants;
  const whoSummaryText = React.useMemo(() => {
    if (totalTravelers === 0 && whoCounts.pets === 0) return null;
    if (locale === "vi") {
      const base = `${totalTravelers} khách`;
      return whoCounts.pets > 0 ? `${base}, ${whoCounts.pets} thú cưng` : base;
    }
    const base = totalTravelers === 1 ? "1 traveler" : `${totalTravelers} travelers`;
    if (whoCounts.pets > 0) {
      return `${base}, ${whoCounts.pets} pet${whoCounts.pets > 1 ? "s" : ""}`;
    }
    return base;
  }, [totalTravelers, whoCounts.pets, locale]);

  const canSubmit = destination.trim().length > 0 && !isSubmitting;

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

    if (!destination.trim()) {
      setIsWhereOpen(true);
      toast.error(
        locale === "vi"
          ? "Vui lòng chọn điểm đến cho chuyến đi."
          : "Please select a destination for your trip."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const tripName = `Trip to ${destination.trim()}`;

      const travelerBreakdown = [
        `${whoCounts.adults} adult${whoCounts.adults > 1 ? "s" : ""}`,
        whoCounts.children > 0 ? `${whoCounts.children} child${whoCounts.children > 1 ? "ren" : ""}` : null,
        whoCounts.infants > 0 ? `${whoCounts.infants} infant${whoCounts.infants > 1 ? "s" : ""}` : null,
        whoCounts.pets > 0 ? `${whoCounts.pets} pet${whoCounts.pets > 1 ? "s" : ""}` : null,
      ].filter(Boolean).join(", ");

      const combinedNotes = [
        prompt.trim() || null,
        travelerBreakdown ? `Travelers: ${travelerBreakdown}` : null,
      ].filter(Boolean).join("\n\n");

      const newTrip = await createTrip({
        name: tripName,
        destinationName: destination.trim(),
        startDate,
        endDate,
        travelerCount: totalTravelers > 0 ? totalTravelers : 1,
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
              {locale === "vi"
                ? `Tôi nên lưu ý điều gì cho chuyến đi này, ${firstName}?`
                : `What should I keep in mind for this trip, ${firstName}?`}
            </h2>
          </div>

          {/* Prompt Textarea Box */}
          <div className="mt-5 relative rounded-2xl border border-border/80 bg-muted/20 focus-within:bg-background focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-foreground/5 transition-all p-3.5 shadow-2xs">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
              placeholder={
                locale === "vi"
                  ? "Chuyến đi 5 ngày đến Tokyo tháng 10 này"
                  : "5-day Tokyo trip this October"
              }
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
                title="Voice input"
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
              disabled={!canSubmit}
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
        initialStartDate={startDate}
        initialEndDate={endDate}
        onSave={(data) => {
          if (data.type === "dates" && data.startDate && data.endDate) {
            setStartDate(data.startDate);
            setEndDate(data.endDate);
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
