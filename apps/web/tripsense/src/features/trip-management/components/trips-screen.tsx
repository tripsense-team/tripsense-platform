"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Copy,
  Edit3,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Share,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
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
import { useTranslation } from "@/i18n";
import type { TripResponse } from "../types";
import {
  countTripDays,
  coverImageForTrip,
  displayTripTitle,
  formatShortRange,
  titleCaseDestination,
} from "../utils/format";
import { TripTabs } from "./trip-tabs";

type TripListFilter = "all" | "recent" | "upcoming" | "unscheduled";

interface TripsScreenProps {
  trips: TripResponse[];
  loading: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  totalElements?: number;
  onLoadMore?: () => void;
  error: string | null;
  submitting: boolean;
  onRetry: () => void;
  onCreateTrip: () => void;
  onRequestEditTrip: (trip: TripResponse) => void;
  onRequestDeleteTrip: (trip: TripResponse) => void;
  onRequestChangePhoto: (trip: TripResponse) => void;
  onRequestShareTrip: (trip: TripResponse) => void;
  onRequestCloneTrip?: (trip: TripResponse) => void;
}

export function TripsScreen({
  trips,
  loading,
  loadingMore = false,
  hasMore = false,
  totalElements,
  onLoadMore,
  error,
  submitting,
  onRetry,
  onCreateTrip,
  onRequestEditTrip,
  onRequestDeleteTrip,
  onRequestChangePhoto,
  onRequestShareTrip,
  onRequestCloneTrip,
}: TripsScreenProps) {
  const { t, locale } = useTranslation();
  const [filter, setFilter] = React.useState<TripListFilter>("all");
  const [bookedOnly, setBookedOnly] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const now = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const filteredTrips = React.useMemo(() => {
    let result = [...trips];

    if (bookedOnly) {
      result = result.filter(
        (t) => t.status === "CONFIRMED" || t.displayStatus === "UPCOMING",
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.destinationName.toLowerCase().includes(q),
      );
    }

    if (filter === "upcoming") {
      result = result.filter((trip) => {
        const isDraftOrNoDates =
          trip.status === "DRAFT" ||
          trip.displayStatus === "DRAFT" ||
          !trip.startDate ||
          !trip.endDate;
        if (isDraftOrNoDates) return false;
        const tripEnd = new Date(trip.endDate).getTime();
        return tripEnd >= now;
      });
    } else if (filter === "unscheduled") {
      result = result.filter(
        (trip) =>
          trip.status === "DRAFT" ||
          trip.displayStatus === "DRAFT" ||
          !trip.startDate ||
          !trip.endDate,
      );
    }

    // Always sort recent (updatedAt / createdAt descending) by default or in recent mode
    if (filter === "recent" || filter === "all") {
      result.sort((first, second) => {
        const timeSecond = new Date(
          second.updatedAt || second.createdAt || 0,
        ).getTime();
        const timeFirst = new Date(
          first.updatedAt || first.createdAt || 0,
        ).getTime();
        return timeSecond - timeFirst;
      });
    }

    return result;
  }, [trips, bookedOnly, searchQuery, filter, now]);

  const categorizedGroups = React.useMemo(() => {
    if (searchQuery.trim()) {
      return [
        {
          id: "search",
          title: `${t("common.search", { defaultValue: "Search results" })} (${filteredTrips.length})`,
          trips: filteredTrips,
        },
      ];
    }

    if (filter === "recent") {
      return [
        {
          id: "recent",
          title: t("trip.recentTrips", { defaultValue: "Recent trips" }),
          trips: filteredTrips,
        },
      ];
    }

    if (filter === "upcoming") {
      return [
        {
          id: "upcoming",
          title: t("trip.upcoming", { defaultValue: "Upcoming trips" }),
          trips: filteredTrips,
        },
      ];
    }

    if (filter === "unscheduled") {
      return [
        {
          id: "unscheduled",
          title: t("trip.unscheduled", { defaultValue: "Unscheduled trips" }),
          trips: filteredTrips,
        },
      ];
    }

    const upcoming: TripResponse[] = [];
    const unscheduled: TripResponse[] = [];
    const past: TripResponse[] = [];

    filteredTrips.forEach((trip) => {
      const isDraftOrNoDates =
        trip.status === "DRAFT" ||
        trip.displayStatus === "DRAFT" ||
        !trip.startDate ||
        !trip.endDate;

      if (isDraftOrNoDates) {
        unscheduled.push(trip);
      } else {
        const tripEnd = new Date(trip.endDate).getTime();
        if (tripEnd >= now) {
          upcoming.push(trip);
        } else {
          past.push(trip);
        }
      }
    });

    const groups: Array<{ id: string; title: string; trips: TripResponse[] }> =
      [];

    if (upcoming.length > 0) {
      groups.push({
        id: "upcoming",
        title: t("trip.upcoming", { defaultValue: "Upcoming" }),
        trips: upcoming,
      });
    }

    if (unscheduled.length > 0) {
      groups.push({
        id: "unscheduled",
        title: t("trip.unscheduled", { defaultValue: "Unscheduled" }),
        trips: unscheduled,
      });
    }

    if (past.length > 0) {
      groups.push({
        id: "past",
        title: t("trip.past", { defaultValue: "Past trips" }),
        trips: past,
      });
    }

    if (groups.length === 0 && filteredTrips.length > 0) {
      groups.push({
        id: "all",
        title: t("trip.allTrips", { defaultValue: "All trips" }),
        trips: filteredTrips,
      });
    }

    return groups;
  }, [filteredTrips, searchQuery, filter, now, t]);

  return (
    <section className="min-h-screen px-6 py-10 sm:px-8 lg:px-12 xl:px-16 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-3xl font-extrabold leading-tight tracking-normal text-foreground">
          {t("trip.yourTrips", { defaultValue: "Your trips" })}
        </h1>
        <Button
          onClick={onCreateTrip}
          className="h-10 rounded-full bg-foreground text-background hover:bg-foreground/90 px-5 text-sm font-bold shadow-xs cursor-pointer gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>{t("trip.newTrip", { defaultValue: "New trip" })}</span>
        </Button>
      </div>

      <TripTabs active="trips" />

      {/* Control bar: Booked only, Search, Sort dropdown */}
      <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setBookedOnly(!bookedOnly)}
            className="flex items-center gap-3 text-sm font-semibold cursor-pointer select-none text-foreground"
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center rounded-full p-1 transition-colors duration-200",
                bookedOnly ? "bg-primary justify-end" : "bg-muted justify-start",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full shadow-sm transition-transform duration-200",
                  bookedOnly ? "bg-primary-foreground" : "bg-background",
                )}
              />
            </span>
            <span>
              {t("trip.bookedOnly", { defaultValue: "Booked only" })}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("trip.searchPlaceholder", {
                defaultValue: "Search trips...",
              })}
              className="h-10 w-full rounded-full border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full px-4 text-sm font-semibold border-border gap-1.5 h-10 shadow-2xs hover:bg-muted"
              >
                <span>
                  {filter === "recent"
                    ? t("trip.recentActivity", {
                        defaultValue: "Recent activity",
                      })
                    : filter === "upcoming"
                      ? t("trip.upcoming", { defaultValue: "Upcoming" })
                      : filter === "unscheduled"
                        ? t("trip.unscheduled", { defaultValue: "Unscheduled" })
                        : t("trip.allTrips", { defaultValue: "All" })}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 rounded-2xl p-2"
              align="end"
              sideOffset={8}
            >
              <DropdownMenuItem
                className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
                onSelect={() => setFilter("all")}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    filter === "all" ? "opacity-100" : "opacity-0",
                  )}
                />
                {t("trip.allTrips", { defaultValue: "All" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
                onSelect={() => setFilter("recent")}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    filter === "recent" ? "opacity-100" : "opacity-0",
                  )}
                />
                {t("trip.recentActivity", { defaultValue: "Recent activity" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
                onSelect={() => setFilter("upcoming")}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    filter === "upcoming" ? "opacity-100" : "opacity-0",
                  )}
                />
                {t("trip.upcoming", { defaultValue: "Upcoming" })}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
                onSelect={() => setFilter("unscheduled")}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    filter === "unscheduled" ? "opacity-100" : "opacity-0",
                  )}
                />
                {t("trip.unscheduled", { defaultValue: "Unscheduled" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick Filter Chips: [ Tất cả ] [ 🕒 Gần đây ] [ 📅 Sắp tới ] [ ⏳ Chưa lên lịch ] */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs border flex items-center gap-1.5",
            filter === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
          )}
        >
          <span>{t("trip.allTrips", { defaultValue: "All" })}</span>
          <span className="opacity-80">({trips.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("recent")}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs border flex items-center gap-1.5",
            filter === "recent"
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>{t("trip.recentTrips", { defaultValue: "Recent" })}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("upcoming")}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs border flex items-center gap-1.5",
            filter === "upcoming"
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>{t("trip.upcoming", { defaultValue: "Upcoming" })}</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter("unscheduled")}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs border flex items-center gap-1.5",
            filter === "unscheduled"
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
          )}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>{t("trip.unscheduled", { defaultValue: "Unscheduled" })}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mt-8 space-y-12">
        {error && <ErrorState message={error} onRetry={onRetry} />}

        {loading ? (
          <LoadingState text={t("common.loading", { defaultValue: "Loading trips..." })} />
        ) : filteredTrips.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={
              searchQuery
                ? t("trip.noTripsFound", { defaultValue: "No trips found" })
                : t("trip.noUpcomingTrips", { defaultValue: "No trips yet" })
            }
            description={
              searchQuery
                ? t("trip.noTripsFoundDesc", {
                    defaultValue: "Try searching for a different destination or trip name.",
                  })
                : t("trip.firstTrip", { defaultValue: "Create your first saved itinerary." })
            }
            action={
              !searchQuery && (
                <Button
                  onClick={onCreateTrip}
                  className="rounded-full px-6 font-bold cursor-pointer"
                >
                  {t("trip.newTrip", { defaultValue: "New trip" })}
                </Button>
              )
            }
          />
        ) : (
          categorizedGroups.map((group) => {
            return (
              <div key={group.id} className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {group.title}
                  </h2>
                  <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                    {group.trips.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.trips.map((trip) => (
                    <TripPoster
                      key={trip.id}
                      trip={trip}
                      locale={locale}
                      deleting={submitting}
                      onRequestEdit={onRequestEditTrip}
                      onRequestDelete={onRequestDeleteTrip}
                      onRequestChangePhoto={onRequestChangePhoto}
                      onRequestShare={onRequestShareTrip}
                      onRequestClone={onRequestCloneTrip}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Server-Side Load More Section */}
        {hasMore ? (
          <div className="flex flex-col items-center justify-center pt-8 pb-6 gap-2.5">
            <Button
              variant="outline"
              size="lg"
              disabled={loadingMore}
              onClick={onLoadMore}
              className="rounded-full px-8 py-2.5 text-xs sm:text-sm font-bold gap-2 border-border/80 shadow-xs hover:bg-accent cursor-pointer transition-all"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{t("common.loading", { defaultValue: "Loading..." })}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-primary" />
                  <span>
                    {t("trip.loadMore", {
                      count: Math.max(0, (totalElements ?? trips.length) - trips.length),
                      defaultValue: `Load more (${Math.max(0, (totalElements ?? trips.length) - trips.length)} remaining)`,
                    })}
                  </span>
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("trip.showingCount", {
                showing: trips.length,
                total: totalElements ?? trips.length,
                defaultValue: `Showing ${trips.length} of ${totalElements ?? trips.length} trips`,
              })}
            </p>
          </div>
        ) : trips.length > 0 ? (
          <div className="flex justify-center pt-6 pb-2 text-xs font-medium text-muted-foreground">
            <span>
              {t("trip.allLoaded", {
                count: trips.length,
                defaultValue: `All ${trips.length} trips loaded`,
              })}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function TripPoster({
  trip,
  locale,
  deleting,
  onRequestEdit,
  onRequestDelete,
  onRequestChangePhoto,
  onRequestShare,
  onRequestClone,
}: {
  trip: TripResponse;
  locale: string;
  deleting: boolean;
  onRequestEdit: (trip: TripResponse) => void;
  onRequestDelete: (trip: TripResponse) => void;
  onRequestChangePhoto: (trip: TripResponse) => void;
  onRequestShare: (trip: TripResponse) => void;
  onRequestClone?: (trip: TripResponse) => void;
}) {
  const destination = titleCaseDestination(trip.destinationName);
  const coverImage = coverImageForTrip(trip);
  const isUnscheduled =
    trip.status === "DRAFT" ||
    trip.displayStatus === "DRAFT" ||
    !trip.startDate;
  const days = countTripDays(trip);

  const durationLabel =
    locale === "vi"
      ? `${days} ngày`
      : days > 1
        ? `${days} days`
        : `${days} day`;

  const dateOrDurationSubtitle = isUnscheduled
    ? `${destination} · ${durationLabel}`
    : `${destination} · ${formatShortRange(trip.startDate, trip.endDate)}`;

  return (
    <article className="group relative aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden rounded-3xl bg-muted shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <Link
        href={`/trips/${trip.id}`}
        className="absolute inset-0 z-10"
        aria-label={`Open ${displayTripTitle(trip)}`}
      />
      <Image
        src={coverImage}
        alt={trip.destinationName}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        unoptimized={coverImage.startsWith("data:")}
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

      {/* Top Left Icon */}
      <div className="absolute left-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-black/40 backdrop-blur-md text-white border border-white/20 shadow-xs">
        <Sparkles className="h-4 w-4 fill-white stroke-white" />
      </div>

      {/* Top Right Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            className="absolute right-4 top-4 z-30 h-8 w-8 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 shadow-xs hover:bg-black/60 cursor-pointer"
            aria-label="Trip actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-60 rounded-2xl p-2"
          align="end"
          sideOffset={8}
        >
          <DropdownMenuItem
            className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
            onSelect={() => onRequestShare(trip)}
          >
            <Share className="h-4 w-4" />
            Share trip {trip.visibility === "PUBLIC" && "(Shared)"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
            onSelect={() => onRequestEdit(trip)}
          >
            <Edit3 className="h-4 w-4" />
            Edit trip
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
            onSelect={() => onRequestChangePhoto(trip)}
          >
            <ImageIcon className="h-4 w-4" />
            Change photo
          </DropdownMenuItem>
          {onRequestClone && (
            <DropdownMenuItem
              className="gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer"
              onSelect={() => onRequestClone(trip)}
            >
              <Copy className="h-4 w-4" />
              Clone trip
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={deleting}
            className="gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive focus:text-destructive cursor-pointer"
            onSelect={() => onRequestDelete(trip)}
          >
            <Trash2 className="h-4 w-4" />
            Delete trip
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bottom Information */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-5 text-white">
        <h3 className="text-lg font-bold leading-snug tracking-tight line-clamp-1 drop-shadow-xs">
          {displayTripTitle(trip)}
        </h3>
        <p className="mt-1 text-xs font-semibold text-white/90 drop-shadow-xs">
          {dateOrDurationSubtitle}
        </p>
      </div>
    </article>
  );
}
