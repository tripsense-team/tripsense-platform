"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Edit3,
  File,
  GripVertical,
  Info,
  Lightbulb,
  Loader2,
  Mic,
  Plus,
  Search,
  Send,
  Share,
  SlidersHorizontal,
  Star,
  Sparkles,
  Trash2,
  Utensils,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { ApiError } from "@/services/api-client";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { cn } from "@/lib/utils";
import { CreateTripDialog } from "./create-trip-dialog";
import { TripTabs } from "./trip-tabs";
import { TripsScreen } from "./trips-screen";
import {
  archiveTrip,
  createItineraryItem,
  createTrip,
  deleteItineraryItem,
  getItinerary,
  getTrip,
  listTrips,
  reorderItineraryItems,
  updateItineraryItem,
  updateTrip,
} from "../services/trip-management-api";
import type {
  CreateItineraryItemRequest,
  CreateTripRequest,
  ItineraryDayResponse,
  ItineraryItemResponse,
  ItineraryItemStatus,
  ItineraryItemType,
  ItineraryResponse,
  TripResponse,
  UpdateItineraryItemRequest,
  UpdateTripRequest,
} from "../types";
import {
  countTripDays,
  coverImageForTrip,
  displayTripTitle,
  formatDate,
  formatShortRange,
  itemTypeLabel,
  titleCaseDestination,
  tripCoverOptions,
} from "../utils/format";

type TripScreen = "trips" | "calendar" | "detail";
type TripDetailPanel = "overview" | "itinerary";

interface ItinerarySuggestion {
  title: string;
  type: ItineraryItemType;
  category: string;
  area: string;
  rating: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  notes: string;
  imageUrl: string;
}

interface TripManagementViewProps {
  initialTripId?: string;
  initialCreateOpen?: boolean;
  screen?: TripScreen;
}

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function newTripDraft(): CreateTripRequest {
  return {
    name: "",
    destinationName: "",
    startDate: isoDate(14),
    endDate: isoDate(15),
    travelerCount: 2,
    budgetAmount: null,
    budgetCurrency: "VND",
    notes: "",
  };
}

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

function todayIso(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function TripManagementView({
  initialTripId,
  initialCreateOpen = false,
  screen = initialTripId ? "detail" : "trips",
}: TripManagementViewProps) {
  const router = useRouter();
  const authStatus = useAuthStore((state) => state.status);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [trips, setTrips] = React.useState<TripResponse[]>([]);
  const [trip, setTrip] = React.useState<TripResponse | null>(null);
  const [itinerary, setItinerary] = React.useState<ItineraryResponse | null>(null);
  const [loadingTrips, setLoadingTrips] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(initialCreateOpen);
  const [addItemDay, setAddItemDay] = React.useState<ItineraryDayResponse | null>(null);
  const [deleteTrip, setDeleteTrip] = React.useState<TripResponse | null>(null);
  const [photoTrip, setPhotoTrip] = React.useState<TripResponse | null>(null);
  const [editingTrip, setEditingTrip] = React.useState<TripResponse | null>(null);
  const [editingItem, setEditingItem] = React.useState<ItineraryItemResponse | null>(null);
  const [tripDraft, setTripDraft] = React.useState<CreateTripRequest>(() => newTripDraft());
  const [editTripDraft, setEditTripDraft] = React.useState<UpdateTripRequest | null>(null);
  const [itemDraft, setItemDraft] = React.useState<CreateItineraryItemRequest>(() => newItemDraft());
  const [editItemDraft, setEditItemDraft] = React.useState<UpdateItineraryItemRequest | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [chatText, setChatText] = React.useState("");
  const [chatMessages, setChatMessages] = React.useState(["Setting Up My Travel Assistant"]);

  const loadTrips = React.useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingTrips(true);
    setError(null);
    try {
      const page = await listTrips();
      setTrips(page.content);
      window.dispatchEvent(new CustomEvent("trip-management:count-changed", { detail: page.totalElements ?? page.content.length }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load trips");
    } finally {
      setLoadingTrips(false);
    }
  }, [isAuthenticated]);

  const loadDetail = React.useCallback(async (tripId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const [nextTrip, nextItinerary] = await Promise.all([getTrip(tripId), getItinerary(tripId)]);
      setTrip(nextTrip);
      setItinerary(nextItinerary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load trip detail");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  React.useEffect(() => {
    void Promise.resolve().then(loadTrips);
  }, [loadTrips]);

  React.useEffect(() => {
    if (isAuthenticated && initialTripId) {
      void Promise.resolve().then(() => loadDetail(initialTripId));
    }
  }, [initialTripId, isAuthenticated, loadDetail]);

  function removeItemFromItinerary(itemId: string) {
    setItinerary((current) =>
      current
        ? {
            ...current,
            days: current.days.map((day) => ({
              ...day,
              items: day.items.filter((candidate) => candidate.id !== itemId),
            })),
          }
        : current
    );
  }

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);

    if (!open && initialCreateOpen) {
      router.replace("/trips");
    }
  }

  function handleStartEditTrip(nextTrip: TripResponse) {
    setEditingTrip(nextTrip);
    setEditTripDraft({
      name: nextTrip.name,
      destinationName: nextTrip.destinationName,
      destinationPlaceId: nextTrip.destinationPlaceId,
      startDate: nextTrip.startDate,
      endDate: nextTrip.endDate,
      dateChangePolicy: "BLOCK_IF_ITEMS_OUTSIDE_RANGE",
      status: nextTrip.status,
      travelerCount: nextTrip.travelerCount,
      budgetAmount: nextTrip.budgetAmount,
      budgetCurrency: nextTrip.budgetCurrency || "VND",
      notes: nextTrip.notes,
      coverImageUrl: nextTrip.coverImageUrl,
    });
  }

  function handleStartEditItem(item: ItineraryItemResponse) {
    setEditingItem(item);
    setEditItemDraft({
      placeId: item.placeId,
      type: item.type,
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      status: item.status,
      notes: item.notes,
      version: item.version,
    });
  }

  async function handleCreateTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const destinationName = tripDraft.destinationName.trim();
      const draftName = tripDraft.name.trim();
      const tripName =
        destinationName && (!draftName || /^Trip to\b/i.test(draftName))
          ? `Trip to ${titleCaseDestination(destinationName)}`
          : draftName || "New trip";
      const created = await createTrip({
        ...tripDraft,
        name: tripName,
        destinationName,
        travelerCount: tripDraft.travelerCount ? Number(tripDraft.travelerCount) : null,
        budgetAmount: tripDraft.budgetAmount ? Number(tripDraft.budgetAmount) : null,
      });
      setCreateOpen(false);
      setTripDraft(newTripDraft());
      await loadTrips();
      router.push(`/trips/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create trip");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trip || !addItemDay) return;
    setSubmitting(true);
    setError(null);
    try {
      await createItineraryItem(trip.id, addItemDay.id, {
        ...itemDraft,
        startTime: itemDraft.startTime || null,
        endTime: itemDraft.endTime || null,
        durationMinutes: itemDraft.durationMinutes ? Number(itemDraft.durationMinutes) : null,
      });
      setAddItemDay(null);
      setItemDraft(newItemDraft());
      await loadDetail(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickAddItem(payload: CreateItineraryItemRequest) {
    if (!trip || !addItemDay) return;

    setSubmitting(true);
    setError(null);
    try {
      await createItineraryItem(trip.id, addItemDay.id, {
        ...payload,
        startTime: payload.startTime || null,
        endTime: payload.endTime || null,
        durationMinutes: payload.durationMinutes ? Number(payload.durationMinutes) : null,
      });
      setAddItemDay(null);
      setItemDraft(newItemDraft());
      await loadDetail(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTrip || !editTripDraft) return;

    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateTrip(editingTrip.id, {
        ...editTripDraft,
        name: editTripDraft.name?.trim() || editingTrip.name,
        destinationName: editTripDraft.destinationName?.trim() || editingTrip.destinationName,
        travelerCount: editTripDraft.travelerCount ? Number(editTripDraft.travelerCount) : null,
        budgetAmount: editTripDraft.budgetAmount ? Number(editTripDraft.budgetAmount) : null,
        budgetCurrency: editTripDraft.budgetCurrency || "VND",
      });
      setEditingTrip(null);
      setEditTripDraft(null);
      setTrip(updated);
      await loadTrips();
      await loadDetail(updated.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update trip");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trip || !editingItem || !editItemDraft) return;

    setSubmitting(true);
    setError(null);
    try {
      await updateItineraryItem(trip.id, editingItem.id, {
        ...editItemDraft,
        title: editItemDraft.title?.trim() || editingItem.title,
        durationMinutes: editItemDraft.durationMinutes ? Number(editItemDraft.durationMinutes) : null,
        version: undefined,
      });
      setEditingItem(null);
      setEditItemDraft(null);
      await loadDetail(trip.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update itinerary item");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteItem(item: ItineraryItemResponse) {
    if (!trip) return;
    setSubmitting(true);
    setError(null);
    removeItemFromItinerary(item.id);
    try {
      await deleteItineraryItem(trip.id, item.id);
      await loadDetail(trip.id);
      removeItemFromItinerary(item.id);
      if (editingItem?.id === item.id) {
        setEditingItem(null);
        setEditItemDraft(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        await loadDetail(trip.id);
        removeItemFromItinerary(item.id);
        if (editingItem?.id === item.id) {
          setEditingItem(null);
          setEditItemDraft(null);
        }
        return;
      }
      setError(err instanceof Error ? err.message : "Could not delete item");
    } finally {
      setSubmitting(false);
    }
  }

  function sendChatMessage() {
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    setChatMessages((current) => [...current, text]);
  }

  const content = (() => {
    if (authStatus !== "initializing" && !isAuthenticated) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8">
          <EmptyState icon={Sparkles} title="Sign in to view your trips" description="Trip management uses your real trip-service data." />
        </div>
      );
    }

    if (screen === "calendar") {
      return <CalendarScreen trips={trips} loading={loadingTrips} error={error} onRetry={loadTrips} />;
    }

    if (screen === "detail") {
      return (
        <TripDetailScreen
          trip={trip}
          itinerary={itinerary}
          loading={loadingDetail}
          error={error}
          submitting={submitting}
          chatText={chatText}
          chatMessages={chatMessages}
          onChatTextChange={setChatText}
          onSendChat={sendChatMessage}
          onEditTrip={handleStartEditTrip}
          onAddItem={setAddItemDay}
          onEditItem={handleStartEditItem}
          onDeleteItem={handleDeleteItem}
          onMoveItem={handleMoveItem}
          onReorderItems={handleReorderItems}
          onCreateTrip={() => setCreateOpen(true)}
        />
      );
    }

    return (
      <TripsScreen
        trips={trips}
        loading={loadingTrips}
        error={error}
        submitting={submitting}
        onRetry={loadTrips}
        onCreateTrip={() => setCreateOpen(true)}
        onRequestEditTrip={handleStartEditTrip}
        onRequestDeleteTrip={setDeleteTrip}
        onRequestChangePhoto={setPhotoTrip}
      />
    );
  })();

  async function handleConfirmDeleteTrip() {
    if (!deleteTrip) return;

    setSubmitting(true);
    setError(null);
    try {
      await archiveTrip(deleteTrip.id);
      setDeleteTrip(null);
      await loadTrips();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete trip");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMoveItem(day: ItineraryDayResponse, item: ItineraryItemResponse, direction: -1 | 1) {
    if (!trip) return;

    const currentIndex = day.items.findIndex((candidate) => candidate.id === item.id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= day.items.length) return;

    const orderedItemIds = day.items.map((candidate) => candidate.id);
    [orderedItemIds[currentIndex], orderedItemIds[nextIndex]] = [orderedItemIds[nextIndex], orderedItemIds[currentIndex]];

    await handleReorderItems(day, orderedItemIds);
  }

  async function handleReorderItems(day: ItineraryDayResponse, orderedItemIds: string[], retryOnConflict = true) {
    if (!trip) return;

    const currentOrder = day.items.map((candidate) => candidate.id).join("|");
    const nextOrder = orderedItemIds.join("|");
    if (currentOrder === nextOrder) return;

    setSubmitting(true);
    setError(null);
    try {
      const nextDay = await reorderItineraryItems(trip.id, day.id, { orderedItemIds, version: day.version });

      setItinerary((current) =>
        current
          ? {
              ...current,
              days: current.days.map((candidate) => (candidate.id === nextDay.id ? nextDay : candidate)),
            }
          : current
      );
    } catch (err) {
      if (retryOnConflict && err instanceof ApiError && err.status === 409) {
        try {
          const freshItinerary = await getItinerary(trip.id);
          setItinerary(freshItinerary);
          const freshDay = freshItinerary.days.find((candidate) => candidate.id === day.id);
          if (freshDay) {
            await handleReorderItems(freshDay, orderedItemIds, false);
            return;
          }
        } catch (retryErr) {
          setError(retryErr instanceof Error ? retryErr.message : "Could not reorder itinerary items");
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Could not reorder itinerary items");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeCoverPhoto(coverImageUrl: string) {
    if (!photoTrip) return;

    setSubmitting(true);
    setError(null);
    try {
      const updated = await updateTrip(photoTrip.id, { coverImageUrl });
      const nextTrip = {
        ...updated,
        coverImageUrl: updated.coverImageUrl || coverImageUrl,
      };

      setTrips((current) => current.map((item) => (item.id === nextTrip.id ? nextTrip : item)));
      setTrip((current) => (current?.id === nextTrip.id ? nextTrip : current));
      setPhotoTrip(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change cover photo");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {content}
      <CreateTripDialog
        open={createOpen}
        draft={tripDraft}
        submitting={submitting}
        onOpenChange={handleCreateOpenChange}
        onDraftChange={setTripDraft}
        onSubmit={handleCreateTrip}
      />
      <DeleteTripDialog
        trip={deleteTrip}
        submitting={submitting}
        onOpenChange={(open) => setDeleteTrip(open ? deleteTrip : null)}
        onConfirm={handleConfirmDeleteTrip}
      />
      <EditTripDialog
        trip={editingTrip}
        draft={editTripDraft}
        submitting={submitting}
        onOpenChange={(open) => {
          setEditingTrip(open ? editingTrip : null);
          setEditTripDraft(open ? editTripDraft : null);
        }}
        onDraftChange={setEditTripDraft}
        onSubmit={handleUpdateTrip}
      />
      <ChangeCoverPhotoDialog
        trip={photoTrip}
        submitting={submitting}
        onOpenChange={(open) => setPhotoTrip(open ? photoTrip : null)}
        onSelectCover={handleChangeCoverPhoto}
      />
      <AddItemDialog
        trip={trip}
        day={addItemDay}
        draft={itemDraft}
        error={error}
        submitting={submitting}
        onOpenChange={(open) => setAddItemDay(open ? addItemDay : null)}
        onDraftChange={setItemDraft}
        onSubmit={handleAddItem}
        onQuickSubmit={handleQuickAddItem}
      />
      <EditItemDialog
        item={editingItem}
        draft={editItemDraft}
        submitting={submitting}
        onOpenChange={(open) => {
          setEditingItem(open ? editingItem : null);
          setEditItemDraft(open ? editItemDraft : null);
        }}
        onDraftChange={setEditItemDraft}
        onSubmit={handleUpdateItem}
      />
    </>
  );
}

function CalendarScreen({
  trips,
  loading,
  error,
  onRetry,
}: {
  trips: TripResponse[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const days = weekDays();
  const hours = ["5am", "6am", "7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm"];

  return (
    <section className="min-h-screen px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <h1 className="text-3xl font-black tracking-normal">Your calendar</h1>
      <TripTabs active="calendar" />
      <div className="mt-10 flex items-center justify-between">
        <div className="flex items-center gap-5 text-base font-black tracking-normal">
          <button type="button" aria-label="Previous week"><ChevronLeft className="h-5 w-5" /></button>
          <span>{formatWeekLabel(days[0], days[6])}</span>
          <button type="button" aria-label="Next week"><ChevronRight className="h-5 w-5" /></button>
        </div>
        <button type="button" className="flex items-center gap-2 text-base font-medium">
          Week <ChevronDown className="h-5 w-5" />
        </button>
      </div>
      {error && <ErrorState className="mt-8" message={error} onRetry={onRetry} />}
      {loading ? <LoadingState className="mt-12" text="Loading calendar..." /> : null}
      <div className="mt-10 overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-[92px_repeat(7,minmax(120px,1fr))] border-b border-border">
            <div />
            {days.map((day) => (
              <div key={day.toISOString()} className="pb-4 text-center text-base font-medium text-muted-foreground">
                {formatDayHeading(day)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[92px_repeat(7,minmax(120px,1fr))]">
            <div className="border-r border-border py-4 text-right text-sm text-muted-foreground">all-day</div>
            {days.map((day) => (
              <CalendarCell key={`all-${day.toISOString()}`} day={day} trips={trips} allDay />
            ))}
            {hours.map((hour) => (
              <React.Fragment key={hour}>
                <div className="border-r border-t border-border px-3 py-6 text-right text-sm font-medium text-muted-foreground">{hour}</div>
                {days.map((day) => (
                  <CalendarCell key={`${hour}-${day.toISOString()}`} day={day} trips={trips} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarCell({ day, trips, allDay = false }: { day: Date; trips: TripResponse[]; allDay?: boolean }) {
  const matchingTrip = allDay ? trips.find((trip) => isDateInsideTrip(day, trip)) : null;
  return (
    <div className="min-h-24 border-r border-t border-border p-2">
      {matchingTrip && (
        <Link href={`/trips/${matchingTrip.id}`} className="block rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          {matchingTrip.destinationName}
        </Link>
      )}
    </div>
  );
}

function TripDetailScreen({
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
                        {itemTypeLabel(item.type)} {item.startTime ? `- ${item.startTime}` : ""} {item.status !== "PLANNED" ? `- ${item.status.toLowerCase()}` : ""}
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

function AddItemDialog({
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
                <Field label="Start"><Input type="time" value={draft.startTime || ""} onChange={(event) => onDraftChange((current) => ({ ...current, startTime: event.target.value }))} /></Field>
                <Field label="End"><Input type="time" value={draft.endTime || ""} onChange={(event) => onDraftChange((current) => ({ ...current, endTime: event.target.value }))} /></Field>
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

function EditTripDialog({
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
  const minEndDate = draft?.startDate ? nextDate(draft.startDate) : today;
  const startsInPast = !!draft?.startDate && draft.startDate < today;
  const endIsNotAfterStart = !!draft?.startDate && !!draft?.endDate && draft.endDate <= draft.startDate;
  const canSave = !startsInPast && !endIsNotAfterStart && !submitting;

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
                        endDate: currentDraft.endDate && currentDraft.endDate <= nextStart ? nextDate(nextStart) : currentDraft.endDate,
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
            {endIsNotAfterStart && <p className="text-sm font-medium text-destructive">End date must be after start date.</p>}
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

function EditItemDialog({
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
                  onChange={(event) => updateDraft({ durationMinutes: event.target.value ? Number(event.target.value) : null })}
                />
              </Field>
              <Field label="Start">
                <Input type="time" value={draft.startTime || ""} onChange={(event) => updateDraft({ startTime: event.target.value || null })} />
              </Field>
              <Field label="End">
                <Input type="time" value={draft.endTime || ""} onChange={(event) => updateDraft({ endTime: event.target.value || null })} />
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

function DeleteTripDialog({
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

function ChangeCoverPhotoDialog({
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

function weekDays(): Date[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatWeekLabel(start: Date, end: Date): string {
  const month = new Intl.DateTimeFormat("en", { month: "short" }).format(start);
  return `${month} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
}

function formatDayHeading(day: Date): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "numeric", day: "numeric" }).format(day);
}

function isDateInsideTrip(day: Date, trip: TripResponse): boolean {
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const value = new Date(day.toISOString().slice(0, 10));
  return value >= start && value <= end;
}

function mapEmbedForDestination(destination: string): string {
  const normalized = normalizeSearchText(destination);
  if (normalized.includes("da nang")) {
    return "https://www.openstreetmap.org/export/embed.html?bbox=107.85%2C15.90%2C108.38%2C16.22&layer=mapnik&marker=16.0544%2C108.2022";
  }

  return "https://www.openstreetmap.org/export/embed.html?bbox=102.0%2C8.0%2C110.0%2C23.5&layer=mapnik";
}

function itinerarySuggestions(destination: string): ItinerarySuggestion[] {
  const normalized = normalizeSearchText(destination);
  const destinationName = titleCaseDestination(destination || "the city");

  if (normalized.includes("da nang")) {
    return [
      {
        title: "Nha hang Madame Lan",
        type: "MEAL",
        category: "Vietnamese",
        area: "Hai Chau, Da Nang Region",
        rating: "4.2",
        startTime: "09:00",
        endTime: "10:30",
        durationMinutes: 90,
        notes: "Popular Vietnamese restaurant suggestion added manually.",
        imageUrl: tripCoverOptions[0],
      },
      {
        title: "Moc Quan Seafood",
        type: "MEAL",
        category: "Seafood",
        area: "An Hai Dong, Da Nang Region",
        rating: "4.6",
        startTime: "12:00",
        endTime: "13:30",
        durationMinutes: 90,
        notes: "Seafood meal idea added manually.",
        imageUrl: tripCoverOptions[1],
      },
      {
        title: "Van May",
        type: "MEAL",
        category: "Vietnamese",
        area: "My An, Da Nang",
        rating: "4.8",
        startTime: "18:00",
        endTime: "19:15",
        durationMinutes: 75,
        notes: "Vietnamese food stop added manually.",
        imageUrl: tripCoverOptions[2],
      },
    ];
  }

  return [
    {
      title: `${destinationName} local lunch`,
      type: "MEAL",
      category: "Restaurant",
      area: destinationName,
      rating: "4.5",
      startTime: "09:00",
      endTime: "10:30",
      durationMinutes: 90,
      notes: "Manual restaurant idea.",
      imageUrl: tripCoverOptions[0],
    },
    {
      title: `${destinationName} highlights walk`,
      type: "ACTIVITY",
      category: "Things to do",
      area: destinationName,
      rating: "4.7",
      startTime: "14:00",
      endTime: "16:00",
      durationMinutes: 120,
      notes: "Manual sightseeing idea.",
      imageUrl: tripCoverOptions[1],
    },
    {
      title: `${destinationName} coffee break`,
      type: "MEAL",
      category: "Cafe",
      area: destinationName,
      rating: "4.4",
      startTime: "16:30",
      endTime: "17:15",
      durationMinutes: 45,
      notes: "Manual cafe idea.",
      imageUrl: tripCoverOptions[2],
    },
  ];
}

function tripTimingPhrase(trip: TripResponse): string {
  const start = new Date(trip.startDate);
  const day = start.getDate();
  const month = new Intl.DateTimeFormat("en", { month: "long" }).format(start);

  if (day >= 24) return `at the end of ${month}`;
  if (day <= 7) return `at the beginning of ${month}`;
  return `in the middle of ${month}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
