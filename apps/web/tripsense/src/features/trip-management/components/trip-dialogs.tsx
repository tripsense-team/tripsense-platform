import * as React from "react";
import Image from "next/image";
import { Check, ChevronDown, Loader2, Plus, Search, SlidersHorizontal, Star, Utensils, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CreateItineraryItemRequest, ItineraryDayResponse, ItineraryItemResponse, ItineraryItemStatus, ItineraryItemType, TripResponse, UpdateItineraryItemRequest, UpdateTripRequest } from "../types";
import { coverImageForTrip, displayTripTitle, formatDate, itemTypeLabel, titleCaseDestination, tripCoverOptions } from "../utils/format";
import { itinerarySuggestions, type ItinerarySuggestion } from "../utils/itinerary-suggestions";
import { todayIso } from "../utils/date";
import { addMinutesToTime, durationMinutesFromTimeRange, formatHHMM, TIME_OPTIONS_24H } from "../utils/time";

function TimeInput24h({
  value,
  onChange,
  id,
}: {
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  id?: string;
}) {
  const formatted = formatHHMM(value) || "";
  const listId = id ? `list-${id}` : "time-24h-list";

  return (
    <>
      <datalist id={listId}>
        {TIME_OPTIONS_24H.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Input
        type="text"
        placeholder="HH:mm (e.g. 22:30)"
        value={formatted}
        list={listId}
        onChange={(event) => {
          const raw = event.target.value;
          if (!raw) {
            onChange(null);
            return;
          }
          onChange(raw);
        }}
        onBlur={(event) => {
          const raw = event.target.value.trim();
          if (!raw) {
            onChange(null);
            return;
          }
          const clean = raw.replace(/[^0-9:]/g, "");
          if (clean.includes(":")) {
            const [hStr, mStr] = clean.split(":");
            const hour = Math.min(23, Math.max(0, Number(hStr) || 0)).toString().padStart(2, "0");
            const minute = Math.min(59, Math.max(0, Number(mStr) || 0)).toString().padStart(2, "0");
            onChange(`${hour}:${minute}`);
          } else if (clean.length === 3) {
            const hour = clean.substring(0, 1).padStart(2, "0");
            const minute = clean.substring(1, 3);
            onChange(`${hour}:${minute}`);
          } else if (clean.length === 4) {
            const hour = clean.substring(0, 2);
            const minute = clean.substring(2, 4);
            const h = Math.min(23, Math.max(0, Number(hour) || 0)).toString().padStart(2, "0");
            const m = Math.min(59, Math.max(0, Number(minute) || 0)).toString().padStart(2, "0");
            onChange(`${h}:${m}`);
          }
        }}
      />
    </>
  );
}

export function AddItemDialog({
  trip,
  day,
  draft,
  error,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
  onQuickSubmit,
}: {
  trip: TripResponse | null;
  day: ItineraryDayResponse | null;
  draft: CreateItineraryItemRequest;
  error: string | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<CreateItineraryItemRequest>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onQuickSubmit: (payload: CreateItineraryItemRequest) => void;
}) {
  const [tab, setTab] = React.useState<"search" | "ideas" | "saved" | "receipt" | "custom">("search");
  const suggestions = React.useMemo(() => itinerarySuggestions(trip?.destinationName || ""), [trip?.destinationName]);

  function addSuggestion(suggestion: ItinerarySuggestion) {
    const payload: CreateItineraryItemRequest = {
      type: suggestion.type,
      title: suggestion.title,
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
      durationMinutes: suggestion.durationMinutes,
      notes: suggestion.notes,
    };

    onQuickSubmit(payload);
  }

  return (
    <Dialog open={!!day} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-md [&>button]:hidden">
        <DialogHeader className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center border-b border-border px-6 py-5">
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
          <DialogTitle className="text-center text-xl font-black tracking-normal">Add to trip</DialogTitle>
          <span aria-hidden="true" />
        </DialogHeader>

        <div className="max-h-[calc(86vh-5.5rem)] overflow-y-auto px-6 py-6">
          <div className="flex gap-8 border-b border-border text-base font-black">
            {[
              ["search", "Search"],
              ["ideas", "Ideas"],
              ["saved", "Saved"],
              ["receipt", "Receipt"],
              ["custom", "Custom"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn("border-b-2 px-1 pb-3 transition-colors duration-200", tab === value ? "border-foreground text-foreground" : "border-transparent text-muted-foreground")}
                onClick={() => setTab(value as typeof tab)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <div>
              <DialogDescription className="text-3xl font-black text-foreground">
                {titleCaseDestination(trip?.destinationName || "Destination")} <ChevronDown className="inline h-5 w-5" />
              </DialogDescription>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{day ? `Adding to Day ${day.dayNumber} - ${formatDate(day.date)}` : "Choose a day first."}</p>
            </div>
          </div>

          {tab !== "custom" ? (
            <>
              {error && (
                <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  {error}
                </div>
              )}

              <div className="mt-6 flex gap-4">
                <div className="flex h-12 flex-1 items-center gap-3 rounded-full bg-muted px-4 text-muted-foreground">
                  <Search className="h-5 w-5" />
                  <span className="text-lg font-medium">Search</span>
                </div>
                <Button variant="outline" className="h-12 rounded-full px-5 text-base font-bold">
                  <SlidersHorizontal className="h-5 w-5" />
                  Filters
                </Button>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {["For you", "Restaurants", "Things to do", "Stays", "Locations"].map((label, index) => (
                  <Button key={label} variant={index === 0 ? "default" : "ghost"} className="rounded-full px-5 text-sm font-bold">
                    {label}
                  </Button>
                ))}
              </div>

              <h3 className="mt-10 text-xl font-black tracking-normal">Restaurants</h3>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.title}
                    type="button"
                    className="group text-left"
                    onClick={() => addSuggestion(suggestion)}
                    disabled={submitting || !day}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
                      <Image src={suggestion.imageUrl} alt={suggestion.title} fill sizes="(max-width: 768px) 80vw, 260px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      <span className="absolute right-3 top-3 flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-sm font-bold text-primary-foreground shadow-sm">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {submitting ? "Adding" : "Add"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <h4 className="min-w-0 truncate text-base font-black tracking-normal">{suggestion.title}</h4>
                      <span className="flex items-center gap-1 text-sm font-bold">
                        <Star className="h-4 w-4 fill-foreground" />
                        {suggestion.rating}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Utensils className="h-4 w-4" />
                      {suggestion.category}
                    </p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{suggestion.area}</p>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">$$</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <form id="add-itinerary-item-form" className="mt-8 grid gap-4" onSubmit={onSubmit}>
              {error && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Type">
                  <select
                    value={draft.type}
                    onChange={(event) => onDraftChange((current) => ({ ...current, type: event.target.value as ItineraryItemType }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {["PLACE", "MEAL", "HOTEL", "TRANSFER", "ACTIVITY", "NOTE"].map((type) => (
                      <option key={type} value={type}>{itemTypeLabel(type as ItineraryItemType)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Title"><Input required value={draft.title} onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Start"><TimeInput24h id="add-start" value={draft.startTime || ""} onChange={(val) => onDraftChange((current) => ({ ...current, startTime: val || "" }))} /></Field>
                <Field label="End"><TimeInput24h id="add-end" value={draft.endTime || ""} onChange={(val) => onDraftChange((current) => ({ ...current, endTime: val || "" }))} /></Field>
              </div>
              <Field label="Notes"><Textarea value={draft.notes || ""} onChange={(event) => onDraftChange((current) => ({ ...current, notes: event.target.value }))} /></Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Add item</Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditTripDialog({
  trip,
  draft,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  trip: TripResponse | null;
  draft: UpdateTripRequest | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<UpdateTripRequest | null>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const open = !!trip && !!draft;
  const today = todayIso();
  const minEndDate = draft?.startDate || today;
  const startsInPast = !!draft?.startDate && draft.startDate < today;
  const endIsBeforeStart = !!draft?.startDate && !!draft?.endDate && draft.endDate < draft.startDate;
  const canSave = !startsInPast && !endIsBeforeStart && !submitting;

  function updateDraft(patch: UpdateTripRequest) {
    onDraftChange((current) => ({ ...(current || {}), ...patch }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border-border bg-popover p-8 text-popover-foreground shadow-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-normal">Edit trip</DialogTitle>
          <DialogDescription>Update the saved trip details manually.</DialogDescription>
        </DialogHeader>
        {draft && (
          <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Trip name">
                <Input required value={draft.name || ""} onChange={(event) => updateDraft({ name: event.target.value })} />
              </Field>
              <Field label="Destination">
                <Input required value={draft.destinationName || ""} onChange={(event) => updateDraft({ destinationName: event.target.value })} />
              </Field>
              <Field label="Start date">
                <Input
                  type="date"
                  min={today}
                  value={draft.startDate || ""}
                  onClick={(event) => event.currentTarget.showPicker()}
                  onChange={(event) =>
                    onDraftChange((current) => {
                      const nextStart = event.target.value;
                      const currentDraft = current || {};
                      return {
                        ...currentDraft,
                        startDate: nextStart,
                        endDate: currentDraft.endDate && currentDraft.endDate < nextStart ? nextStart : currentDraft.endDate,
                      };
                    })
                  }
                  className="cursor-pointer"
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  min={minEndDate}
                  value={draft.endDate || ""}
                  onClick={(event) => event.currentTarget.showPicker()}
                  onChange={(event) => updateDraft({ endDate: event.target.value })}
                  className="cursor-pointer"
                />
              </Field>
              <Field label="Travelers">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.travelerCount ?? ""}
                  onChange={(event) => updateDraft({ travelerCount: event.target.value ? Number(event.target.value) : null })}
                />
              </Field>
              <Field label="Budget">
                <Input
                  type="number"
                  min={0}
                  value={draft.budgetAmount ?? ""}
                  onChange={(event) => updateDraft({ budgetAmount: event.target.value ? Number(event.target.value) : null })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={draft.notes || ""} onChange={(event) => updateDraft({ notes: event.target.value })} />
            </Field>
            {startsInPast && <p className="text-sm font-medium text-destructive">Start date cannot be in the past.</p>}
            {endIsBeforeStart && <p className="text-sm font-medium text-destructive">End date must be on or after start date.</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={!canSave}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EditItemDialog({
  item,
  draft,
  submitting,
  onOpenChange,
  onDraftChange,
  onSubmit,
}: {
  item: ItineraryItemResponse | null;
  draft: UpdateItineraryItemRequest | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftChange: React.Dispatch<React.SetStateAction<UpdateItineraryItemRequest | null>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const open = !!item && !!draft;

  function updateDraft(patch: UpdateItineraryItemRequest) {
    onDraftChange((current) => ({ ...(current || {}), ...patch }));
  }

  function updateTimeDraft(patch: Pick<UpdateItineraryItemRequest, "startTime" | "endTime">) {
    onDraftChange((current) => {
      const next = { ...(current || {}), ...patch };
      return {
        ...next,
        durationMinutes: durationMinutesFromTimeRange(next.startTime, next.endTime) ?? next.durationMinutes ?? null,
      };
    });
  }

  function updateDurationDraft(durationMinutes: number | null) {
    onDraftChange((current) => {
      const nextEndTime = addMinutesToTime(current?.startTime, durationMinutes);
      return {
        ...(current || {}),
        durationMinutes,
        endTime: nextEndTime ?? current?.endTime ?? null,
      };
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border-border bg-popover p-8 text-popover-foreground shadow-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-normal">Edit itinerary item</DialogTitle>
          <DialogDescription>Update this saved manual item.</DialogDescription>
        </DialogHeader>
        {draft && (
          <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type">
                <select
                  value={draft.type || "ACTIVITY"}
                  onChange={(event) => updateDraft({ type: event.target.value as ItineraryItemType })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {["PLACE", "MEAL", "HOTEL", "FLIGHT", "TRANSFER", "ACTIVITY", "NOTE"].map((type) => (
                    <option key={type} value={type}>{itemTypeLabel(type as ItineraryItemType)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={draft.status || "PLANNED"}
                  onChange={(event) => updateDraft({ status: event.target.value as ItineraryItemStatus })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {["PLANNED", "DONE", "SKIPPED", "CANCELLED"].map((status) => (
                    <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </Field>
              <Field label="Title">
                <Input required value={draft.title || ""} onChange={(event) => updateDraft({ title: event.target.value })} />
              </Field>
              <Field label="Duration minutes">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={draft.durationMinutes ?? ""}
                  onChange={(event) => updateDurationDraft(event.target.value ? Number(event.target.value) : null)}
                />
              </Field>
              <Field label="Start">
                <TimeInput24h id="edit-start" value={draft.startTime || null} onChange={(val) => updateTimeDraft({ startTime: val })} />
              </Field>
              <Field label="End">
                <TimeInput24h id="edit-end" value={draft.endTime || null} onChange={(val) => updateTimeDraft({ endTime: val })} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={draft.notes || ""} onChange={(event) => updateDraft({ notes: event.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save item
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTripDialog({
  trip,
  submitting,
  onOpenChange,
  onConfirm,
}: {
  trip: TripResponse | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border-border bg-popover p-8 text-popover-foreground shadow-md [&>button]:hidden">
        <DialogHeader className="items-center space-y-5 text-center">
          <DialogTitle className="text-2xl font-black tracking-normal">
            Delete &quot;{trip ? displayTripTitle(trip) : "trip"}&quot;?
          </DialogTitle>
          <DialogDescription className="text-base font-medium text-muted-foreground">
            This will also delete its associated chats.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-full bg-transparent text-base font-bold"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 rounded-full text-base font-bold"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Yes, delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeCoverPhotoDialog({
  trip,
  submitting,
  onOpenChange,
  onSelectCover,
}: {
  trip: TripResponse | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCover: (coverImageUrl: string) => void;
}) {
  const currentCover = trip ? coverImageForTrip(trip) : null;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function handleUploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        onSelectCover(reader.result);
      }
    });
    reader.readAsDataURL(file);
  }

  return (
    <Dialog open={!!trip} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-5xl overflow-hidden rounded-2xl border-border bg-popover p-0 text-popover-foreground shadow-md [&>button]:hidden">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center border-b border-border px-6 py-5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 justify-self-start rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
          <DialogHeader className="min-w-0 text-center sm:text-center">
            <DialogTitle className="truncate text-xl font-black tracking-normal">Change cover photo</DialogTitle>
          </DialogHeader>
          <span aria-hidden="true" />
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl bg-muted text-center text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <Upload className="mb-5 h-8 w-8" />
              <span className="max-w-32 text-lg font-medium leading-tight">Upload your own photo</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleUploadPhoto}
                tabIndex={-1}
              />
            </button>

            {tripCoverOptions.map((coverUrl) => {
              const isSelected = currentCover === coverUrl;

              return (
                <button
                  key={coverUrl}
                  type="button"
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted transition-all duration-200 hover:shadow-md",
                    isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-popover"
                  )}
                  onClick={() => onSelectCover(coverUrl)}
                  disabled={submitting}
                  aria-label="Choose cover photo"
                >
                  <Image
                    src={coverUrl}
                    alt="Trip cover option"
                    fill
                    sizes="(max-width: 768px) 44vw, 260px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {isSelected && (
                    <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="h-5 w-5" />
                    </span>
                  )}
                  {submitting && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
