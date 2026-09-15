import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { TripResponse } from "@/features/trip-management/types";
import { coverImageForTrip, displayTripTitle, formatShortRange, titleCaseDestination } from "@/features/trip-management/utils/format";

interface SharedTripCardProps {
  trip: TripResponse;
}

export function SharedTripCard({ trip }: SharedTripCardProps) {
  const destination = titleCaseDestination(trip.destinationName);
  const coverImage = coverImageForTrip(trip);

  return (
    <article className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-xs transition-all duration-300 hover:shadow-md">
      {/* Clickable area for the entire card */}
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
      
      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/10 to-transparent" />

      {/* Decorative icon */}
      <div className="absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4 fill-primary-foreground stroke-primary-foreground" />
      </div>

      {/* Trip Information */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-5 text-primary-foreground">
        <h3 className="text-base font-black tracking-normal line-clamp-1">{displayTripTitle(trip)}</h3>
        <p className="mt-1.5 text-sm font-medium opacity-90 line-clamp-1">
          {destination} • {formatShortRange(trip.startDate, trip.endDate)}
        </p>
      </div>
    </article>
  );
}
