"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  DollarSign,
  Compass,
  Copy,
  ExternalLink,
  Check,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SharedTripSummary } from "../types";
import type { TripResponse } from "@/features/trip-management/types";
import {
  coverImageForTrip,
  displayTripTitle,
  formatShortRange,
  titleCaseDestination,
} from "@/features/trip-management/utils/format";
import { cn } from "@/lib/utils";

export interface SharedTripCardProps {
  trip: SharedTripSummary | TripResponse;
  className?: string;
  isCompact?: boolean;
  variant?: "feed" | "grid";
}

function GridTripCard({
  trip,
  className,
}: {
  trip: TripResponse | SharedTripSummary;
  className?: string;
}) {
  const destination = trip.destinationName
    ? titleCaseDestination(trip.destinationName)
    : "Điểm đến";
  const coverImage =
    "coverImageUrl" in trip && trip.coverImageUrl
      ? trip.coverImageUrl
      : "id" in trip && typeof trip.id === "string"
        ? coverImageForTrip(trip as TripResponse)
        : "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80";
  const title =
    "name" in trip && trip.name
      ? "status" in trip
        ? displayTripTitle(trip as TripResponse)
        : trip.name
      : `Chuyến đi ${destination}`;
  const dateRange =
    trip.startDate && trip.endDate
      ? formatShortRange(trip.startDate, trip.endDate)
      : "";

  return (
    <article
      className={cn(
        "group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted shadow-xs transition-all duration-300 hover:shadow-md",
        className
      )}
    >
      <Link
        href={`/trips/${trip.id}`}
        className="absolute inset-0 z-10"
        aria-label={`Open ${title}`}
      />

      <Image
        src={coverImage}
        alt={trip.destinationName || "Trip cover"}
        fill
        sizes="(max-width: 768px) 90vw, 320px"
        unoptimized={coverImage.startsWith("data:")}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        priority={false}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/10 to-transparent" />

      <div className="absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4 fill-primary-foreground stroke-primary-foreground" />
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-5 text-primary-foreground">
        <h3 className="text-base font-black tracking-normal line-clamp-1">
          {title}
        </h3>
        <p className="mt-1.5 text-sm font-medium opacity-90 line-clamp-1">
          {destination} {dateRange ? `• ${dateRange}` : ""}
        </p>
      </div>
    </article>
  );
}

function FeedTripCard({
  trip,
  className,
  isCompact = false,
}: {
  trip: SharedTripSummary | TripResponse;
  className?: string;
  isCompact?: boolean;
}) {
  const router = useRouter();
  const [cloning, setCloning] = React.useState(false);
  const [cloned, setCloned] = React.useState(false);

  const formatDuration = React.useMemo(() => {
    if ("durationDays" in trip && trip.durationDays) {
      return `${trip.durationDays} ngày ${Math.max(1, trip.durationDays - 1)} đêm`;
    }
    if (trip.startDate && trip.endDate) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return `${diffDays} ngày ${Math.max(1, diffDays - 1)} đêm`;
    }
    return null;
  }, [trip]);

  const formatBudget = React.useMemo(() => {
    if (!trip.budgetAmount) return null;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: trip.budgetCurrency || "VND",
      maximumFractionDigits: 0,
    }).format(trip.budgetAmount);
  }, [trip.budgetAmount, trip.budgetCurrency]);

  const handleCloneTrip = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cloning || cloned) return;

    setCloning(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCloned(true);
    } finally {
      setCloning(false);
    }
  };

  const handleViewTrip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/trips/${trip.id}`);
  };

  const coverImage = trip.coverImageUrl;

  return (
    <div
      onClick={handleViewTrip}
      className={cn(
        "group/trip relative overflow-hidden rounded-2xl border border-border bg-muted/40 transition-all duration-200 hover:border-primary/40 hover:bg-muted/60 hover:shadow-xs cursor-pointer",
        isCompact ? "p-3" : "p-4",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {coverImage ? (
          <div className="relative h-32 sm:h-28 sm:w-40 shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image
              src={coverImage}
              alt={trip.name}
              fill
              className="object-cover transition-transform duration-300 group-hover/trip:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur-xs font-semibold px-1.5 py-0.5"
            >
              Hành trình
            </Badge>
          </div>
        ) : (
          <div className="relative h-32 sm:h-28 sm:w-40 shrink-0 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/15 via-primary/10 to-indigo-500/15 border border-primary/10 text-primary shadow-inner">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background/80 shadow-xs backdrop-blur-xs">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] bg-background/90 backdrop-blur-xs font-semibold px-1.5 py-0.5 shadow-xs"
            >
              Hành trình
            </Badge>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{trip.destinationName}</span>
              </span>
              {formatDuration && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  • <Calendar className="h-3 w-3 shrink-0" />
                  <span>{formatDuration}</span>
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-foreground line-clamp-1 group-hover/trip:text-primary transition-colors">
              {trip.name}
            </h4>

            {formatBudget && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <span>Dự toán: {formatBudget}</span>
              </p>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleViewTrip}
              className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Xem chi tiết
            </Button>

            <Button
              type="button"
              variant={cloned ? "secondary" : "outline"}
              size="sm"
              onClick={handleCloneTrip}
              disabled={cloning}
              className="h-8 px-3 text-xs font-semibold rounded-lg gap-1.5 border-border hover:bg-primary hover:text-primary-foreground transition-all"
            >
              {cloned ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Đã lưu lịch trình
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {cloning ? "Đang lưu..." : "Lưu lịch trình"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SharedTripCard(props: SharedTripCardProps) {
  const isGrid =
    props.variant === "grid" ||
    (!props.isCompact &&
      "status" in props.trip &&
      !("durationDays" in props.trip));

  if (isGrid) {
    return <GridTripCard trip={props.trip} className={props.className} />;
  }

  return (
    <FeedTripCard
      trip={props.trip}
      className={props.className}
      isCompact={props.isCompact}
    />
  );
}
