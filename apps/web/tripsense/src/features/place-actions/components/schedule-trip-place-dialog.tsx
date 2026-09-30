"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Clock3, Loader2, MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { createItineraryItem } from "@/features/trip-management/services/trip-management-api";
import type { ItineraryDayResponse } from "@/features/trip-management/types";
import { addMinutesToTime, durationMinutesFromTimeRange } from "@/features/trip-management/utils/time";
import { placeActionKeys } from "../hooks/use-place-actions";
import { removePlaceFromTrip } from "../services/place-actions-api";
import type { TripPlace } from "../types";

interface Props {
  tripId: string;
  place: TripPlace | null;
  days: ItineraryDayResponse[];
  expectedTripRevision?: number;
  onOpenChange: (open: boolean) => void;
  onScheduled: () => Promise<void> | void;
}

const QUICK_TIME_PRESETS = [
  { label: "09:00 - 10:00", start: "09:00", end: "10:00" },
  { label: "12:00 - 13:00", start: "12:00", end: "13:00" },
  { label: "15:00 - 16:00", start: "15:00", end: "16:00" },
  { label: "18:30 - 19:30", start: "18:30", end: "19:30" },
];

export function ScheduleTripPlaceDialog({
  tripId,
  place,
  days,
  expectedTripRevision,
  onOpenChange,
  onScheduled,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dayId, setDayId] = React.useState("");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("10:00");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!place) return;
    const initialDay = days[0];
    setDayId(initialDay?.id ?? "");
    
    // Find smart default start time from last item of initial day if available
    const lastItem = initialDay?.items?.[initialDay.items.length - 1];
    const defaultStart = lastItem?.endTime || lastItem?.startTime || "09:00";
    const defaultEnd = addMinutesToTime(defaultStart, 60) || "10:00";

    setStartTime(defaultStart);
    setEndTime(defaultEnd);
    setNotes("");
    setError(null);
  }, [place, days]);

  function handleDayChange(newDayId: string) {
    setDayId(newDayId);
    const selectedDay = days.find((d) => d.id === newDayId);
    const lastItem = selectedDay?.items?.[selectedDay.items.length - 1];
    const newStart = lastItem?.endTime || lastItem?.startTime || "09:00";
    const newEnd = addMinutesToTime(newStart, 60) || "10:00";
    setStartTime(newStart);
    setEndTime(newEnd);
  }

  function handleStartTimeChange(newStart: string) {
    setStartTime(newStart);
    if (!endTime || endTime <= newStart) {
      const autoEnd = addMinutesToTime(newStart, 60);
      if (autoEnd) setEndTime(autoEnd);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!place || !dayId) return;

    if (!startTime || !endTime) {
      setError(t("trip.scheduleTimeRequired"));
      return;
    }

    const durationMinutes = durationMinutesFromTimeRange(startTime, endTime);
    if (!durationMinutes || durationMinutes <= 0) {
      setError(t("trip.scheduleTimeInvalid"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createItineraryItem(tripId, dayId, {
        placeRef: place.placeRef,
        type: "PLACE",
        title: place.placeNameSnapshot,
        startTime,
        endTime,
        durationMinutes,
        notes: notes.trim() || null,
        expectedTripRevision,
      });
      await removePlaceFromTrip(tripId, place.placeRef);
      await queryClient.invalidateQueries({ queryKey: placeActionKeys.all });
      await onScheduled();
      onOpenChange(false);
    } catch (err) {
      setError(getSafeErrorMessage(err, t("errors.generic")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!place} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-border bg-popover p-0 text-popover-foreground shadow-xl">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-5 pr-12">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-normal">
                {t("trip.schedulePlaceTitle")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {t("trip.schedulePlaceDescription")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {place && (
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 px-6 py-5">
              <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-2xs">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-foreground truncate">{place.placeNameSnapshot}</p>
                    <Badge variant="secondary" className="rounded-md text-[10px] uppercase font-bold shrink-0">
                      PLACE
                    </Badge>
                  </div>
                  {place.placeAddressSnapshot && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">
                      {place.placeAddressSnapshot}
                    </p>
                  )}
                </div>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-foreground">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {t("trip.chooseDay")}
                </span>
                <select
                  required
                  value={dayId}
                  onChange={(event) => handleDayChange(event.target.value)}
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-2xs outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {days.map((day) => (
                    <option key={day.id} value={day.id}>
                      {t("trip.day", { number: day.dayNumber })} · {day.date}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <TimeField
                  label={t("trip.startTime")}
                  value={startTime}
                  onChange={handleStartTimeChange}
                />
                <TimeField
                  label={t("trip.endTime")}
                  value={endTime}
                  onChange={setEndTime}
                />
              </div>

              {/* Quick time slot presets */}
              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t("trip.quickTimePresets")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TIME_PRESETS.map((preset) => {
                    const isSelected = startTime === preset.start && endTime === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setStartTime(preset.start);
                          setEndTime(preset.end);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                            : "border-border bg-muted/50 hover:bg-muted text-foreground"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-foreground">
                <span>{t("trip.notes")}</span>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("trip.notesPlaceholder")}
                  className="min-h-24 rounded-xl"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
              <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="rounded-full gap-1.5 font-bold" disabled={submitting || days.length === 0}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {submitting ? t("trip.scheduling") : t("trip.schedulePlace")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <Input
        required
        type="time"
        step={300}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 cursor-pointer rounded-xl bg-background shadow-2xs"
      />
    </label>
  );
}
