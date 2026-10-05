"use client";

import * as React from "react";
import { X, Mic, Loader2, Luggage } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { createTrip } from "@/features/trip-management/services/trip-management-api";
import { isoDateFromToday, todayIso } from "@/features/trip-management/utils/date";
import type { TripResponse } from "@/features/trip-management/types";
import { toast } from "sonner";

export interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTripCreated?: (trip: TripResponse, initialPrompt?: string) => void;
  onRequireAuth?: () => void;
  initialDestination?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialTravelers?: number;
}

const COMMON_DESTINATIONS = [
  { name: "China", label: "China, East Asia" },
  { name: "Tokyo", label: "Tokyo, Japan" },
  { name: "Đà Nẵng", label: "Đà Nẵng, Việt Nam" },
  { name: "Hội An", label: "Hội An, Quảng Nam" },
  { name: "Bangkok", label: "Bangkok, Thailand" },
  { name: "Bali", label: "Bali, Indonesia" },
  { name: "Huế", label: "Huế, Thừa Thiên Huế" },
  { name: "Đà Lạt", label: "Đà Lạt, Lâm Đồng" },
  { name: "Phú Quốc", label: "Phú Quốc, Kiên Giang" },
];

export function CreateTripModal({
  isOpen,
  onClose,
  onTripCreated,
  onRequireAuth,
  initialDestination = "",
  initialStartDate,
  initialEndDate,
  initialTravelers = 1,
}: CreateTripModalProps) {
  const { locale } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [prompt, setPrompt] = React.useState("");
  const [destination, setDestination] = React.useState(initialDestination);
  const [startDate, setStartDate] = React.useState(initialStartDate || isoDateFromToday(7));
  const [endDate, setEndDate] = React.useState(initialEndDate || isoDateFromToday(10));
  const [travelers, setTravelers] = React.useState(initialTravelers);
  const [activeSubPicker, setActiveSubPicker] = React.useState<"where" | "when" | "who" | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Sync initial props when opened
  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setDestination(initialDestination);
      if (initialStartDate) setStartDate(initialStartDate);
      if (initialEndDate) setEndDate(initialEndDate);
      if (initialTravelers) setTravelers(initialTravelers);
      setActiveSubPicker(null);
    }
  }

  // First name extraction for greeting matching Screenshot 2
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
      setActiveSubPicker("where");
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
      
      const newTrip = await createTrip({
        name: tripName,
        destinationName: destination.trim(),
        startDate,
        endDate,
        travelerCount: travelers > 0 ? travelers : 1,
        notes: prompt.trim() || undefined,
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        overlayClassName="bg-black/10 backdrop-blur-[2px] dark:bg-black/40"
        className="sm:max-w-[480px] p-0 overflow-hidden border border-border/80 bg-background shadow-2xl rounded-3xl [&>button]:hidden"
      >
        <DialogTitle className="sr-only">
          What should I keep in mind for this trip?
        </DialogTitle>

        <div className="relative p-6 sm:p-7 flex flex-col">
          {/* Top Row: Close button on left */}
          <div className="flex items-center justify-between pb-3">
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Centered Bag with Plus Icon in Teal Circle (Mindtrip Screenshot 2 1:1) */}
          <div className="flex flex-col items-center text-center">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-4 shadow-2xs">
              <Luggage className="size-5.5" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground max-w-sm leading-snug">
              What should I keep in mind for this trip, {firstName}?
            </h2>
          </div>

          {/* Prompt Textarea Box */}
          <div className="mt-5 relative rounded-2xl border border-border/80 bg-muted/20 focus-within:bg-background focus-within:border-foreground/30 focus-within:ring-2 focus-within:ring-foreground/5 transition-all p-3.5 shadow-2xs">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
              placeholder="5-day Tokyo trip this October"
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
            Have details? Share what you know.
          </p>

          {/* 3 Detail Selectors (Where, When, Who) */}
          <div className="space-y-2">
            {/* 1. WHERE */}
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setActiveSubPicker((prev) => (prev === "where" ? null : "where"))}
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left cursor-pointer"
              >
                <span className="font-semibold text-sm text-foreground">Where</span>
                <span className={cn("text-sm truncate max-w-[220px]", destination ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {destination || "Select destination"}
                </span>
              </button>

              {activeSubPicker === "where" && (
                <div className="p-3 pt-0 border-t border-border/40 bg-muted/20 space-y-2 animate-in fade-in-0 duration-150">
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Enter city or country (e.g. China, Tokyo, Da Nang)..."
                    autoFocus
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {COMMON_DESTINATIONS.map((dest) => (
                      <button
                        key={dest.name}
                        type="button"
                        onClick={() => {
                          setDestination(dest.name);
                          setActiveSubPicker(null);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer",
                          destination === dest.name
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border/70 hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {dest.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. WHEN */}
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setActiveSubPicker((prev) => (prev === "when" ? null : "when"))}
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left cursor-pointer"
              >
                <span className="font-semibold text-sm text-foreground">When</span>
                <span className={cn("text-sm", formattedDates ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {formattedDates || "Select dates"}
                </span>
              </button>

              {activeSubPicker === "when" && (
                <div className="p-3 pt-0 border-t border-border/40 bg-muted/20 space-y-3 animate-in fade-in-0 duration-150">
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-micro font-semibold text-muted-foreground mb-1 block">Start date</label>
                      <input
                        type="date"
                        value={startDate}
                        min={todayIso()}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          if (endDate < e.target.value) setEndDate(e.target.value);
                        }}
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-micro font-semibold text-muted-foreground mb-1 block">End date</label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(isoDateFromToday(7));
                        setEndDate(isoDateFromToday(10));
                        setActiveSubPicker(null);
                      }}
                      className="text-xs h-7 rounded-full flex-1"
                    >
                      3-day trip
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(isoDateFromToday(7));
                        setEndDate(isoDateFromToday(12));
                        setActiveSubPicker(null);
                      }}
                      className="text-xs h-7 rounded-full flex-1"
                    >
                      5-day trip
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. WHO */}
            <div className="rounded-2xl border border-border/70 overflow-hidden bg-background">
              <button
                type="button"
                onClick={() => setActiveSubPicker((prev) => (prev === "who" ? null : "who"))}
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left cursor-pointer"
              >
                <span className="font-semibold text-sm text-foreground">Who</span>
                <span className={cn("text-sm", travelers > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {travelers > 0 ? `${travelers} ${travelers === 1 ? "traveler" : "travelers"}` : "Add people"}
                </span>
              </button>

              {activeSubPicker === "who" && (
                <div className="p-3 pt-0 border-t border-border/40 bg-muted/20 flex items-center justify-between animate-in fade-in-0 duration-150">
                  <span className="text-xs font-medium text-foreground">Total travelers</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setTravelers((prev) => Math.max(1, prev - 1))}
                      className="size-8 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted font-bold text-sm cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-semibold text-foreground w-6 text-center">{travelers}</span>
                    <button
                      type="button"
                      onClick={() => setTravelers((prev) => Math.min(20, prev + 1))}
                      className="size-8 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted font-bold text-sm cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action: Create Button */}
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
                  <span>Creating...</span>
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
