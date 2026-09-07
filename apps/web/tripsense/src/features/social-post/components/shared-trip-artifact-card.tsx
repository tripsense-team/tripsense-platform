"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SharedTripSummary } from "../types";

interface SharedTripArtifactCardProps {
  trip: SharedTripSummary;
  compact?: boolean;
  href?: string;
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return "Dates not set";
  if (!startDate) return endDate ?? "Dates not set";
  if (!endDate || startDate === endDate) return startDate;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} - ${endDate}`;
  }

  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function titleCase(value?: string | null) {
  if (!value) return "Destination not set";

  return value
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function StatPill({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="flex items-center gap-2 text-xs font-black text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

export function SharedTripArtifactCard({ trip, compact = false, href }: SharedTripArtifactCardProps) {
  const highlights = trip.highlights?.slice(0, compact ? 3 : 6) ?? [];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background shadow-xs">
      <div className="relative aspect-[16/7] min-h-56 bg-muted">
        {trip.coverImageUrl ? (
          <Image
            src={trip.coverImageUrl}
            alt={trip.name}
            fill
            sizes="(max-width: 768px) 100vw, 900px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-muted-foreground">
            No cover image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/30 to-transparent" />
        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          <Badge className="rounded-full bg-background text-foreground hover:bg-background">Trip Plan</Badge>
          <Badge className="rounded-full bg-background text-foreground hover:bg-background">API Snapshot</Badge>
        </div>
        <div className="absolute bottom-6 left-6 max-w-[calc(100%-3rem)] text-primary-foreground">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-normal">
            <MapPin className="h-3.5 w-3.5" />
            {titleCase(trip.destinationName)}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">{trip.name}</h3>
        </div>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-3">
        <StatPill icon={CalendarDays} label="Dates & Duration" value={`${formatDateRange(trip.startDate, trip.endDate)} (${trip.dayCount ?? 0} days)`} />
        <StatPill icon={MapPin} label="Destination" value={titleCase(trip.destinationName)} />
        <StatPill icon={Route} label="Curated Stops" value={`${trip.itineraryItemCount ?? 0} places & activities`} />
      </div>

      <div className="px-5 pb-5">
        <p className="text-xs font-black uppercase text-muted-foreground">Featured Highlights</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {highlights.length > 0 ? (
            highlights.map((item) => (
              <Badge key={`${item.dayNumber}-${item.title}`} variant="secondary" className="rounded-full">
                {item.placeName || item.title}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No itinerary highlights yet.</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Basic trip info is rendered from the shared TripSense snapshot.
          </p>
          <Button asChild className="rounded-full">
            <Link href={href ?? `/community/posts/${trip.tripId}`}>
              View Trip
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
