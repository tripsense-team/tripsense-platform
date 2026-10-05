"use client";

import * as React from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { getPlaceDetails } from "@/features/places/services/places-api";
import { getPlacePhotoUrl } from "@/features/places/utils/place-photo";
import { tripCoverOptions } from "@/features/trip-management/utils/format";
import { placeActionKeys } from "../hooks/use-place-actions";
import { listTripPlaces, removePlaceFromTrip } from "../services/place-actions-api";
import type { TripPlace } from "../types";

interface Props {
  tripId: string;
  canEdit: boolean;
  onSchedule?: (place: TripPlace) => void;
}

function hashString(value: string): number {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function fallbackImageForPlace(place: TripPlace): string {
  const seed = [place.placeRef, place.placeNameSnapshot, place.id].filter(Boolean).join("|");
  return tripCoverOptions[hashString(seed) % tripCoverOptions.length];
}

function useTripPlacePhotoMap(places: TripPlace[] = []) {
  const [photos, setPhotos] = React.useState<Record<string, string>>({});
  const fetchedRefs = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (places.length === 0) return;

    const controller = new AbortController();
    const unfetched = places.filter((p) => p.placeRef && !fetchedRefs.current.has(p.placeRef)).slice(0, 8);
    if (unfetched.length === 0) return;

    unfetched.forEach((p) => fetchedRefs.current.add(p.placeRef));

    async function loadPhotos() {
      const entries = await Promise.all(
        unfetched.map(async (p) => {
          try {
            const details = await getPlaceDetails(p.placeRef, p.placeNameSnapshot, undefined, undefined, controller.signal);
            const photoUrl = details.data ? getPlacePhotoUrl(details.data) : null;
            return photoUrl ? ([p.id, photoUrl] as const) : null;
          } catch {
            return null;
          }
        })
      );

      if (controller.signal.aborted) return;
      const valid = entries.filter((e): e is readonly [string, string] => Boolean(e));
      if (valid.length === 0) return;

      setPhotos((prev) => {
        const next = { ...prev };
        valid.forEach(([id, url]) => {
          next[id] = url;
        });
        return next;
      });
    }

    void loadPhotos();
    return () => controller.abort();
  }, [places]);

  return photos;
}

export function TripPlacePool({ tripId, canEdit, onSchedule }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: placeActionKeys.tripPlaces(tripId),
    queryFn: () => listTripPlaces(tripId),
  });

  const photoMap = useTripPlacePhotoMap(query.data?.content ?? []);

  const removeMutation = useMutation({
    mutationFn: (placeRef: string) => removePlaceFromTrip(tripId, placeRef),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: placeActionKeys.all });
    },
  });

  const placesList = query.data?.content ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-foreground">{t("trip.addedPlaces")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("trip.addedPlacesDescription")}
          </p>
        </div>
        {query.isFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {query.isError ? (
        <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <p>{getSafeErrorMessage(query.error, t("errors.generic"))}</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => query.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : !query.isLoading && placesList.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("trip.noAddedPlaces")}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placesList.map((place) => {
            const photoUrl = photoMap[place.id] || fallbackImageForPlace(place);

            return (
              <article
                key={place.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-xs transition-all duration-200 hover:shadow-md"
              >
                <div>
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted text-muted-foreground">
                    {photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={place.placeNameSnapshot}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/5">
                        <MapPin className="h-8 w-8 text-primary/40" />
                      </div>
                    )}
                    <Badge
                      variant="secondary"
                      className="absolute left-2 top-2 rounded-md bg-background/80 text-xs font-semibold backdrop-blur-xs shadow-xs"
                    >
                      PLACE
                    </Badge>
                  </div>
                  <div className="mt-3 min-w-0">
                    <h3 className="truncate font-bold text-base text-foreground" title={place.placeNameSnapshot}>
                      {place.placeNameSnapshot}
                    </h3>
                    {place.placeAddressSnapshot ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" title={place.placeAddressSnapshot}>
                        {place.placeAddressSnapshot}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground italic">
                        {t("trip.addedPlacesDescription")}
                      </p>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                    {onSchedule && (
                      <Button
                        size="sm"
                        variant="default"
                        className="rounded-full text-xs font-bold gap-1.5 shadow-2xs flex-1"
                        onClick={() => onSchedule(place)}
                      >
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span>{t("trip.schedulePlace")}</span>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 transition-colors"
                      disabled={removeMutation.isPending}
                      aria-label={t("trip.removeAddedPlace")}
                      title={t("trip.removeAddedPlace")}
                      onClick={() => removeMutation.mutate(place.placeRef)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
