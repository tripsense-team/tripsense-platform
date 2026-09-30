"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2 } from "lucide-react";
import { ResponsiveDialog, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import type { Place } from "@/features/places/types";
import { useUserTrips } from "@/features/trip-management";
import { addPlaceToTrip, removePlaceFromTrip } from "../services/place-actions-api";
import { placeActionKeys } from "../hooks/use-place-actions";
import { reconcileMemberships } from "../utils/reconcile-memberships";

interface Props {
  place: Place | null;
  open: boolean;
  selectedTripIds: string[];
  onOpenChange: (open: boolean) => void;
  onAdded?: (added: boolean) => void;
}

export function AddToTripDialog({ place, open, selectedTripIds, onOpenChange, onAdded }: Props) {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const { trips, isLoading, isError, error, refetchTrips } = useUserTrips();
  const selectableTrips = trips.filter((trip) => trip.status !== "ARCHIVED" && trip.status !== "CANCELLED");
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(selectedTripIds),
  );
  const [message, setMessage] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!place) return;
      await reconcileMemberships(
        selectedTripIds,
        selected,
        (id) => addPlaceToTrip(id, place.id),
        (id) => removePlaceFromTrip(id, place.id),
      );
    },
    onSuccess: () => {
      onAdded?.(selected.size > 0);
      onOpenChange(false);
    },
    onError: (error) => setMessage(getSafeErrorMessage(error, t("errors.generic"))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: placeActionKeys.all }),
  });

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={t("places.addToTrip")} description={place?.name}>
      <div className="space-y-4" aria-live="polite">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : isError ? (
          <EmptyState
            icon={CalendarDays}
            title={getSafeErrorMessage(error, t("errors.generic"))}
            action={<Button variant="outline" onClick={() => void refetchTrips()}>{t("common.retry")}</Button>}
          />
        ) : selectableTrips.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t("trip.noTrips")}
            description={t("trip.noTripsForPlace")}
            action={<Button asChild><Link href="/trips/new">{t("trip.createTrip")}</Link></Button>}
          />
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {selectableTrips.map((trip) => (
              <label key={trip.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={selected.has(trip.id)}
                  onChange={() => setSelected((current) => {
                    const next = new Set(current);
                    if (next.has(trip.id)) next.delete(trip.id); else next.add(trip.id);
                    return next;
                  })}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{trip.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {trip.destinationName} · {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(trip.startDate))}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        {message && <p className="text-sm text-destructive">{message}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="button" disabled={!place || mutation.isPending || selectableTrips.length === 0} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
