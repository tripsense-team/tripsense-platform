"use client";

import * as React from "react";
import Image from "next/image";
import { Calendar, Check, Loader2, MapPin, Mic, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { cn } from "@/lib/utils";
import type { CreateTripRequest } from "../types";
import { titleCaseDestination, tripCoverOptions } from "../utils/format";
import { nextDate, todayIso } from "../utils/date";
import { normalizeSearchText } from "../utils/search";

interface CreateTripDialogProps {
  open: boolean;
  draft: CreateTripRequest;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<CreateTripRequest>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const destinationSuggestions = [
  {
    name: "Da Nang",
    label: "Da Nang, Vietnam",
    coverImageUrl: tripCoverOptions[0],
  },
  {
    name: "Hoi An",
    label: "Hoi An, Vietnam",
    coverImageUrl: tripCoverOptions[5],
  },
  {
    name: "Bangkok",
    label: "Bangkok, Thailand",
    coverImageUrl: tripCoverOptions[3],
  },
  {
    name: "Bali",
    label: "Bali, Indonesia",
    coverImageUrl: tripCoverOptions[7],
  },
];

export function CreateTripDialog({
  open,
  draft,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: CreateTripDialogProps) {
  const user = useAuthStore((state) => state.user);
  const firstName = user?.email?.split("@")[0] || "traveler";
  const today = todayIso();
  const minEndDate = draft.startDate ? nextDate(draft.startDate) : today;
  const startsInPast = draft.startDate < today;
  const endIsNotAfterStart = draft.endDate <= draft.startDate;
  const missingDestination = draft.destinationName.trim().length === 0;
  const validationMessage = missingDestination
    ? "Enter a destination to create the trip."
    : startsInPast
      ? "Start date cannot be in the past."
      : endIsNotAfterStart
        ? "End date must be after start date."
        : null;
  const canCreate = !validationMessage && !submitting;
  const normalizedDestination = normalizeSearchText(draft.destinationName);
  const matchingSuggestions = normalizedDestination
    ? destinationSuggestions.filter((suggestion) => normalizeSearchText(suggestion.label).includes(normalizedDestination)).slice(0, 3)
    : [];

  function updateDestination(destinationName: string) {
    onDraftChange((current) => ({
      ...current,
      destinationName,
      name: shouldSyncGeneratedName(current.name) && destinationName.trim() ? `Trip to ${titleCaseDestination(destinationName.trim())}` : current.name,
    }));
  }

  function selectDestinationSuggestion(suggestion: (typeof destinationSuggestions)[number]) {
    onDraftChange((current) => ({
      ...current,
      destinationName: suggestion.name,
      name: `Trip to ${suggestion.name}`,
      coverImageUrl: suggestion.coverImageUrl,
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[88vh] max-w-4xl overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-md [&>button]:hidden">
        <div className="grid h-full min-h-0 md:grid-cols-[0.85fr_1.15fr]">
          <div className="relative hidden overflow-hidden bg-muted md:block">
            <Image
              src={tripCoverOptions[0]}
              alt="Travel inspiration"
              fill
              sizes="360px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-primary/20" />
          </div>

          <form className="relative flex min-h-0 flex-col gap-7 overflow-y-auto px-7 py-8 sm:px-10" onSubmit={onSubmit}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-4 top-4 h-9 w-9 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>

            <div className="pt-10">
              <h2 className="text-3xl font-black tracking-normal">Where to, {firstName}?</h2>
            </div>

            <div className="space-y-3">
              <span className="text-base font-black">Trip details</span>
              <div className="space-y-3">
                <Input
                  value={draft.name}
                  onChange={(event) => onDraftChange((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Trip name"
                  className="h-12 rounded-full text-base"
                />
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    required
                    value={draft.destinationName}
                    onChange={(event) => updateDestination(event.target.value)}
                    placeholder="Where are you headed?"
                    aria-invalid={missingDestination}
                    className={cn("h-12 rounded-full pl-12 text-base", missingDestination && "border-destructive")}
                  />
                </div>
                {matchingSuggestions.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-2 shadow-xs">
                    {matchingSuggestions.map((suggestion) => {
                      const isSelected = normalizeSearchText(draft.destinationName) === normalizeSearchText(suggestion.name);

                      return (
                        <button
                          key={suggestion.label}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-accent",
                            isSelected && "bg-accent"
                          )}
                          onClick={() => selectDestinationSuggestion(suggestion)}
                        >
                          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                            <Image
                              src={suggestion.coverImageUrl}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </span>
                          <span className="font-medium">{suggestion.label}</span>
                          {isSelected && <Check className="ml-auto h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {missingDestination && <p className="text-sm font-medium text-destructive">Enter a destination to create the trip.</p>}
            </div>

            <div className="space-y-3">
              <span className="text-base font-black">Timing</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" className="h-11 rounded-full font-bold">
                  Flexible
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    aria-label="Start date"
                    type="date"
                    value={draft.startDate}
                    min={today}
                    onClick={(event) => event.currentTarget.showPicker()}
                    onChange={(event) =>
                      onDraftChange((current) => ({
                        ...current,
                        startDate: event.target.value,
                        endDate: current.endDate <= event.target.value ? nextDate(event.target.value) : current.endDate,
                      }))
                    }
                    className="h-11 cursor-pointer rounded-full text-sm"
                  />
                  <Input
                    aria-label="End date"
                    type="date"
                    value={draft.endDate}
                    min={minEndDate}
                    onClick={(event) => event.currentTarget.showPicker()}
                    onChange={(event) => onDraftChange((current) => ({ ...current, endDate: event.target.value }))}
                    className="h-11 cursor-pointer rounded-full text-sm"
                  />
                </div>
              </div>
              {startsInPast && <p className="text-sm font-medium text-destructive">Start date cannot be in the past.</p>}
              {endIsNotAfterStart && <p className="text-sm font-medium text-destructive">End date must be after start date.</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-3">
                <span className="text-base font-black">Travelers</span>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.travelerCount ?? ""}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      travelerCount: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                  className="h-12 rounded-full text-base"
                />
              </label>
              <label className="space-y-3">
                <span className="text-base font-black">Budget</span>
                <Input
                  type="number"
                  min={0}
                  value={draft.budgetAmount ?? ""}
                  onChange={(event) =>
                    onDraftChange((current) => ({
                      ...current,
                      budgetAmount: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                  placeholder={draft.budgetCurrency || "VND"}
                  className="h-12 rounded-full text-base"
                />
              </label>
            </div>

            <label className="space-y-3">
              <span className="text-base font-black">Trip preferences</span>
              <div className="relative">
                <Textarea
                  value={draft.notes || ""}
                  onChange={(event) => onDraftChange((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Tell us what you know so far - travel companions, budget, must-dos, preferences"
                  className="min-h-32 resize-none rounded-2xl pr-12 text-base"
                  maxLength={2000}
                />
                <Mic className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-right text-sm text-muted-foreground">{(draft.notes || "").length}/2000 characters</div>
            </label>

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <TripPill icon={Calendar} label="3-5 Days" />
              <TripPill icon={Users} label={`${draft.travelerCount || 1} Travelers`} />
              {draft.budgetAmount ? <TripPill icon={Check} label={`${draft.budgetAmount.toLocaleString("vi-VN")} ${draft.budgetCurrency || "VND"}`} /> : null}
            </div>

            {validationMessage && <p className="text-center text-sm font-medium text-destructive">{validationMessage}</p>}
            <Button type="submit" disabled={!canCreate} title={validationMessage || undefined} className="h-12 rounded-full text-base font-bold">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              Create
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function shouldSyncGeneratedName(name: string): boolean {
  const value = name.trim();
  return !value || /^Trip to\b/i.test(value);
}

function TripPill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold">
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}
