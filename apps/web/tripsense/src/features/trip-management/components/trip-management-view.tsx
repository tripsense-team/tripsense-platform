"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared";
import { ApiError } from "@/services/api-client";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { CreateTripDialog } from "./create-trip-dialog";
import { CalendarScreen } from "./calendar-screen";
import { AddItemDialog, ChangeCoverPhotoDialog, DeleteTripDialog, EditItemDialog, EditTripDialog } from "./trip-dialogs";
import { TripDetailScreen } from "./trip-detail-screen";
import { TripsScreen } from "./trips-screen";
import {
  deleteTrip as deleteTripRequest,
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
  ItineraryResponse,
  TripResponse,
  UpdateItineraryItemRequest,
  UpdateTripRequest,
} from "../types";
import { titleCaseDestination } from "../utils/format";
import { isoDateFromToday } from "../utils/date";

type TripScreen = "trips" | "calendar" | "detail";

interface TripManagementViewProps {
  initialTripId?: string;
  initialCreateOpen?: boolean;
  screen?: TripScreen;
}

function newTripDraft(): CreateTripRequest {
  return {
    name: "",
    destinationName: "",
    startDate: isoDateFromToday(14),
    endDate: isoDateFromToday(15),
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
      await deleteTripRequest(deleteTrip.id);
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
