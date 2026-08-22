import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Briefcase, Calendar, ChevronDown, ChevronRight, ClipboardCheck, Compass, Edit3, File, GripVertical, Info, Lightbulb, Mic, Plus, Send, Share, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { ItineraryDayResponse, ItineraryItemResponse, ItineraryResponse, TripResponse } from "../types";
import { countTripDays, displayTripTitle, formatDate, formatShortRange, itemTypeLabel, titleCaseDestination, tripTimingPhrase } from "../utils/format";
import { mapEmbedForDestination } from "../utils/map";
import { formatDisplayTimeRange } from "../utils/time";

type TripDetailPanel = "overview" | "itinerary";

export function TripDetailScreen({
  trip,
  itinerary,
  loading,
  error,
  submitting,
  chatText,
  chatMessages,
  onChatTextChange,
  onSendChat,
  onEditTrip,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onMoveItem,
  onReorderItems,
  onCreateTrip,
}: {
  trip: TripResponse | null;
  itinerary: ItineraryResponse | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  chatText: string;
  chatMessages: string[];
  onChatTextChange: (value: string) => void;
  onSendChat: () => void;
  onEditTrip: (trip: TripResponse) => void;
  onAddItem: (day: ItineraryDayResponse) => void;
  onEditItem: (item: ItineraryItemResponse) => void;
  onDeleteItem: (item: ItineraryItemResponse) => void;
  onMoveItem: (day: ItineraryDayResponse, item: ItineraryItemResponse, direction: -1 | 1) => void;
  onReorderItems: (day: ItineraryDayResponse, orderedItemIds: string[]) => Promise<void>;
  onCreateTrip: () => void;
}) {
  const [activePanel, setActivePanel] = React.useState<TripDetailPanel>("overview");

  if (loading) {
    return <LoadingState className="min-h-screen" text="Loading trip..." />;
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <EmptyState icon={Briefcase} title="Trip not found" description={error || "Create or select a trip to continue."} action={<Button onClick={onCreateTrip}>New trip</Button>} />
      </div>
    );
  }

  const destination = titleCaseDestination(trip.destinationName);
  const title = displayTripTitle(trip);

  return (
    <section className="min-h-screen px-6 py-6 sm:px-8 lg:px-12 xl:px-16">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-full">
          <Link href="/trips" aria-label="Back to trips"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 rounded-full px-3 text-sm font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">P</span>
            Invite
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Share"><Share className="h-5 w-5" /></Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label="Edit trip" onClick={() => onEditTrip(trip)}><Edit3 className="h-5 w-5" /></Button>
        </div>
      </div>

      {error && <ErrorState className="mt-8" message={error} />}

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
        <div className="min-w-0">
          <h1 className="text-3xl font-black leading-tight tracking-normal">{title}</h1>
          <div className="mt-5 inline-flex flex-wrap items-center overflow-hidden rounded-full border border-border bg-background text-sm font-semibold shadow-2xs">
            <span className="px-4 py-2">{destination}</span>
            <span className="border-l border-border px-4 py-2">{formatShortRange(trip.startDate, trip.endDate)}</span>
            <span className="border-l border-border px-4 py-2">{trip.travelerCount || 1} travelers</span>
            <span className="border-l border-border px-3 py-2">$</span>
          </div>

          <div className="mt-8 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5 fill-primary-foreground stroke-primary-foreground" />
          </div>
          <p className="mt-5 max-w-2xl text-xl font-black leading-snug tracking-normal">
            {destination} {tripTimingPhrase(trip)} is a quick trip from home - want help picking a first thing to plan for these {countTripDays(trip)} days?
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" className="h-10 rounded-full px-5 text-sm font-semibold">Plan first activities</Button>
            <Button variant="secondary" className="h-10 rounded-full px-5 text-sm font-semibold">Suggest neighborhoods</Button>
          </div>

          <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-4 shadow-sm">
            <Textarea
              value={chatText}
              onChange={(event) => onChatTextChange(event.target.value)}
              placeholder="Ask anything else..."
              className="min-h-16 resize-none border-0 bg-transparent text-base shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSendChat();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full" aria-label="Add attachment"><Plus className="h-5 w-5" /></Button>
              <div className="flex items-center gap-4">
                <Mic className="h-5 w-5 text-muted-foreground" />
                <Button size="icon" className="h-9 w-9 rounded-full" onClick={onSendChat} aria-label="Send"><Send className="h-5 w-5" /></Button>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-xl font-black tracking-normal">Chats <span className="font-medium text-muted-foreground">{chatMessages.length}</span></h2>
            <div className="mt-5 space-y-4">
              {chatMessages.map((message, index) => (
                <div key={`${message}-${index}`} className="flex items-center justify-between rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <div>
                    <h3 className="text-base font-black tracking-normal">{message}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(trip.createdAt)}</p>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {activePanel === "overview" ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
            <ActionTile icon={Lightbulb} label="Ideas" />
            <ActionTile icon={ClipboardCheck} label="Itinerary" onClick={() => setActivePanel("itinerary")} />
            <ActionTile icon={Calendar} label="Bookings" />
            <ActionTile icon={File} label="Media" />
            <ActionTile icon={Info} label="Trip preferences" badge="4" />
            <ActionTile icon={Calendar} label="Calendar" href="/calendar" />
              </div>
              <MapPreview destination={trip.destinationName} />
            </>
          ) : (
            <ItineraryPanel
              trip={trip}
              itinerary={itinerary}
              submitting={submitting}
              onClose={() => setActivePanel("overview")}
              onAddItem={onAddItem}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
              onMoveItem={onMoveItem}
              onReorderItems={onReorderItems}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function ActionTile({
  icon: Icon,
  label,
  badge,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex h-14 items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm font-black shadow-xs transition-all duration-200 hover:bg-accent">
      <span className="flex items-center gap-4">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {badge && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs">{badge}</span>}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return (
    <button type="button" className="text-left" onClick={onClick}>
      {content}
    </button>
  );
}

function MapPreview({ destination }: { destination: string }) {
  const mapUrl = mapEmbedForDestination(destination);

  return (
    <div className="relative h-[360px] overflow-hidden rounded-2xl border border-border bg-muted shadow-xs">
      <iframe
        title={`${destination} map`}
        src={mapUrl}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute bottom-8 right-8 flex flex-col overflow-hidden rounded-full border border-border bg-background shadow-sm">
        <button type="button" className="flex h-8 w-8 items-center justify-center text-base font-bold">+</button>
        <button type="button" className="flex h-8 w-8 items-center justify-center border-t border-border text-base font-bold">-</button>
      </div>
      <button type="button" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background shadow-sm" aria-label="Center map">
        <Compass className="h-5 w-5" />
      </button>
    </div>
  );
}

function ItineraryPanel({
  trip,
  itinerary,
  submitting,
  onClose,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onMoveItem,
  onReorderItems,
}: {
  trip: TripResponse;
  itinerary: ItineraryResponse | null;
  submitting: boolean;
  onClose: () => void;
  onAddItem: (day: ItineraryDayResponse) => void;
  onEditItem: (item: ItineraryItemResponse) => void;
  onDeleteItem: (item: ItineraryItemResponse) => void;
  onMoveItem: (day: ItineraryDayResponse, item: ItineraryItemResponse, direction: -1 | 1) => void;
  onReorderItems: (day: ItineraryDayResponse, orderedItemIds: string[]) => Promise<void>;
}) {
  const [draggingItemId, setDraggingItemId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ itemId: string; position: "before" | "after" } | null>(null);
  const ideaCount = itinerary?.days.reduce((total, day) => total + day.items.filter((item) => item.type === "NOTE").length, 0) ?? 0;

  function updateDropTarget(event: React.DragEvent<HTMLDivElement>, itemId: string) {
    if (!draggingItemId || draggingItemId === itemId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropTarget({ itemId, position });
  }

  async function handleItemDrop(day: ItineraryDayResponse, targetItemId: string) {
    if (!draggingItemId || draggingItemId === targetItemId || submitting) {
      setDraggingItemId(null);
      setDropTarget(null);
      return;
    }

    const draggedItem = day.items.find((item) => item.id === draggingItemId);
    const targetPosition = dropTarget?.itemId === targetItemId ? dropTarget.position : "before";
    if (!draggedItem) {
      setDraggingItemId(null);
      setDropTarget(null);
      return;
    }

    const reorderedItems = day.items.filter((item) => item.id !== draggingItemId);
    const targetIndex = reorderedItems.findIndex((item) => item.id === targetItemId);
    if (targetIndex < 0) {
      setDraggingItemId(null);
      setDropTarget(null);
      return;
    }

    const insertIndex = targetPosition === "after" ? targetIndex + 1 : targetIndex;
    reorderedItems.splice(insertIndex, 0, draggedItem);
    await onReorderItems(day, reorderedItems.map((item) => item.id));
    setDraggingItemId(null);
    setDropTarget(null);
  }

  return (
    <aside className="min-h-[720px] rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onClose} aria-label="Close itinerary">
          <X className="h-5 w-5" />
        </Button>
        <Button variant="outline" className="h-10 rounded-full px-3 text-sm font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">P</span>
          Invite
        </Button>
      </div>

      <h2 className="mt-14 text-4xl font-black tracking-normal">Itinerary</h2>

      <section className="mt-10">
        <div className="flex items-center gap-3">
          <ChevronDown className="h-5 w-5" />
          <h3 className="text-xl font-black tracking-normal">Ideas</h3>
          <span className="text-base font-semibold text-muted-foreground">{ideaCount} items</span>
        </div>
        <button
          type="button"
          className="mt-5 flex h-36 w-40 flex-col items-center justify-center gap-4 rounded-2xl bg-muted text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
          onClick={() => itinerary?.days[0] && onAddItem(itinerary.days[0])}
          disabled={!itinerary?.days[0] || submitting}
        >
          <Plus className="h-8 w-8" />
          <span className="text-sm font-bold">Add</span>
        </button>
      </section>

      <section className="mt-10">
        <div className="flex items-end gap-3">
          <h3 className="text-xl font-black tracking-normal">Itinerary</h3>
          <span className="text-base font-semibold text-muted-foreground">{countTripDays(trip)} days</span>
        </div>

        {!itinerary ? (
          <LoadingState className="mt-8" text="Loading itinerary..." />
        ) : (
          <div className="mt-6 space-y-5">
        {itinerary.days.map((day) => (
          <div key={day.id} className="border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChevronDown className="h-5 w-5" />
                <h4 className="text-base font-black">Day {day.dayNumber}</h4>
                <span className="text-sm font-semibold text-muted-foreground">{formatDate(day.date)}</span>
              </div>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => onAddItem(day)} disabled={submitting}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {day.items.length === 0 ? (
                <div className="rounded-2xl bg-muted p-5 text-sm font-medium text-muted-foreground">
                  No saved items yet. Add a place, meal, transfer, note, or activity manually.
                </div>
              ) : (
                day.items.map((item, index) => (
                  <div
                    key={item.id}
                    draggable={!submitting}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", item.id);
                      setDraggingItemId(item.id);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      updateDropTarget(event, item.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      updateDropTarget(event, item.id);
                    }}
                    onDragLeave={() => {
                      if (dropTarget?.itemId === item.id) setDropTarget(null);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleItemDrop(day, item.id);
                    }}
                    onDragEnd={() => {
                      setDraggingItemId(null);
                      setDropTarget(null);
                    }}
                    className={cn(
                      "flex cursor-grab items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 transition-all duration-200 active:cursor-grabbing",
                      draggingItemId === item.id && "scale-[0.99] opacity-50",
                      dropTarget?.itemId === item.id && dropTarget.position === "before" && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      dropTarget?.itemId === item.id && dropTarget.position === "after" && "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {itemTypeLabel(item.type)}{" "}
                        {formatDisplayTimeRange(item.startTime, item.endTime) ? `- ${formatDisplayTimeRange(item.startTime, item.endTime)}` : ""}{" "}
                        {item.status !== "PLANNED" ? `- ${item.status.toLowerCase()}` : ""}
                      </p>
                      {item.warnings?.includes("TIME_OVERLAP") && (
                        <p className="mt-1 text-xs font-medium text-destructive">Time overlaps another item.</p>
                      )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onMoveItem(day, item, -1)} disabled={submitting || index === 0} aria-label="Move item up">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onMoveItem(day, item, 1)} disabled={submitting || index === day.items.length - 1} aria-label="Move item down">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onEditItem(item)} disabled={submitting} aria-label="Edit item">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item)} disabled={submitting} aria-label="Delete item">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
          </div>
        )}
      </section>
    </aside>
  );
}
