"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Briefcase, Check, ChevronDown, Edit3, ImageIcon, Link2, MoreHorizontal, Plus, Share, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { TripResponse } from "../types";
import { coverImageForTrip, displayTripTitle, formatShortRange, titleCaseDestination } from "../utils/format";
import { TripTabs } from "./trip-tabs";

type TripListFilter = "all" | "recent";

interface TripsScreenProps {
  trips: TripResponse[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  onRetry: () => void;
  onCreateTrip: () => void;
  onRequestEditTrip: (trip: TripResponse) => void;
  onRequestDeleteTrip: (trip: TripResponse) => void;
  onRequestChangePhoto: (trip: TripResponse) => void;
}

export function TripsScreen({
  trips,
  loading,
  error,
  submitting,
  onRetry,
  onCreateTrip,
  onRequestEditTrip,
  onRequestDeleteTrip,
  onRequestChangePhoto,
}: TripsScreenProps) {
  const [filter, setFilter] = React.useState<TripListFilter>("all");
  const displayTrips = React.useMemo(() => {
    if (filter !== "recent") {
      return trips;
    }

    return [...trips].sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime());
  }, [filter, trips]);

  return (
    <section className="min-h-screen px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <div className="flex items-start justify-between gap-6">
        <h1 className="text-3xl font-black leading-tight tracking-normal">Your trips</h1>
        <Button onClick={onCreateTrip} className="mt-1 h-10 rounded-full px-5 text-sm font-bold">
          <Plus className="h-5 w-5" />
          New trip
        </Button>
      </div>
      <TripTabs active="trips" />
      <div className="mt-8 flex items-center justify-between">
        <button type="button" className="flex items-center gap-3 text-base font-medium">
          <span className="flex h-7 w-12 items-center rounded-full bg-muted p-1">
            <span className="h-5 w-5 rounded-full bg-background shadow-sm" />
          </span>
          Booked only
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="h-9 rounded-full px-4 text-sm font-semibold">
              {filter === "recent" ? "Recent activity" : "All"}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 rounded-2xl p-2" align="end" sideOffset={8}>
            <DropdownMenuItem className="gap-3 rounded-xl px-3 py-3 text-base" onSelect={() => setFilter("all")}>
              <Check className={cn("h-4 w-4", filter === "all" ? "opacity-100" : "opacity-0")} />
              All
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 rounded-xl px-3 py-3 text-base" onSelect={() => setFilter("recent")}>
              <Check className={cn("h-4 w-4", filter === "recent" ? "opacity-100" : "opacity-0")} />
              Recent activity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h2 className="mt-12 text-xl font-black tracking-normal">{filter === "recent" ? "Recent activity" : "Upcoming"}</h2>
      <div className="mt-6">
        {error && <ErrorState message={error} onRetry={onRetry} />}
        {loading ? (
          <LoadingState text="Loading trips..." />
        ) : displayTrips.length === 0 ? (
          <EmptyState icon={Briefcase} title="No upcoming trips" description="Create your first saved itinerary." action={<Button onClick={onCreateTrip}>New trip</Button>} />
        ) : (
          <div className="grid max-w-6xl grid-cols-[repeat(auto-fill,minmax(260px,320px))] gap-5">
            {displayTrips.map((trip) => (
              <TripPoster
                key={trip.id}
                trip={trip}
                deleting={submitting}
                onRequestEdit={onRequestEditTrip}
                onRequestDelete={onRequestDeleteTrip}
                onRequestChangePhoto={onRequestChangePhoto}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TripPoster({
  trip,
  deleting,
  onRequestEdit,
  onRequestDelete,
  onRequestChangePhoto,
}: {
  trip: TripResponse;
  deleting: boolean;
  onRequestEdit: (trip: TripResponse) => void;
  onRequestDelete: (trip: TripResponse) => void;
  onRequestChangePhoto: (trip: TripResponse) => void;
}) {
  const destination = titleCaseDestination(trip.destinationName);
  const coverImage = coverImageForTrip(trip);

  return (
    <article className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-xs transition-all duration-300 hover:shadow-md">
      <Link href={`/trips/${trip.id}`} className="absolute inset-0 z-10" aria-label={`Open ${displayTripTitle(trip)}`} />
      <Image
        src={coverImage}
        alt={trip.destinationName}
        fill
        sizes="(max-width: 768px) 90vw, 320px"
        unoptimized={coverImage.startsWith("data:")}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/10 to-transparent" />

      <div className="absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4 fill-primary-foreground stroke-primary-foreground" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            className="absolute right-4 top-4 z-30 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            aria-label="Trip actions"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 rounded-2xl p-2" align="end" sideOffset={8}>
          <DropdownMenuItem className="gap-3 rounded-xl px-3 py-3 text-base">
            <Link2 className="h-5 w-5" />
            Invite co-travelers
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 rounded-xl px-3 py-3 text-base">
            <Share className="h-5 w-5" />
            Share trip
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 rounded-xl px-3 py-3 text-base" onSelect={() => onRequestEdit(trip)}>
            <Edit3 className="h-5 w-5" />
            Edit trip
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-3 rounded-xl px-3 py-3 text-base" onSelect={() => onRequestChangePhoto(trip)}>
            <ImageIcon className="h-5 w-5" />
            Change photo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={deleting}
            className="gap-3 rounded-xl px-3 py-3 text-base text-destructive focus:text-destructive"
            onSelect={() => onRequestDelete(trip)}
          >
            <Trash2 className="h-5 w-5" />
            Delete trip
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-5 text-primary-foreground">
        <h3 className="text-base font-black tracking-normal">{displayTripTitle(trip)}</h3>
        <p className="mt-1.5 text-sm font-medium">
          {destination} - {formatShortRange(trip.startDate, trip.endDate)}
        </p>
      </div>
    </article>
  );
}
