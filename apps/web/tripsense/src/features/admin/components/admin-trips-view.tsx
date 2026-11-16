"use client";

import * as React from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Globe,
  Lock,
  MapPin,
  MoreVertical,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  fetchAdminTrips,
  fetchTripCreatorProfiles,
  updateAdminTripArchive,
} from "../api/admin-trips-api";
import type {
  AdminTripArchiveFilter,
  AdminTripItem,
  AdminTripPageResponse,
  AdminTripVisibilityFilter,
  PublicProfileSummary,
} from "../types/admin-trips.types";

const PAGE_SIZE = 20;
const FALLBACK_LOAD_ERROR = "__ADMIN_TRIPS_LOAD_ERROR__";

function formatTripDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${start} -> ${end}`;
  return start || end || "—";
}

function getInitials(label: string): string {
  const clean = label.trim();
  return clean.length >= 2 ? clean.slice(0, 2).toUpperCase() : clean.toUpperCase() || "U";
}

export function AdminTripsView() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [visibilityFilter, setVisibilityFilter] =
    React.useState<AdminTripVisibilityFilter>("ALL");
  const [archiveFilter, setArchiveFilter] = React.useState<AdminTripArchiveFilter>("ALL");
  const [page, setPage] = React.useState(0);

  const [pageData, setPageData] = React.useState<AdminTripPageResponse | null>(null);
  const [creatorProfiles, setCreatorProfiles] = React.useState<
    Record<string, PublicProfileSummary>
  >({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [mutatingId, setMutatingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) {
          setIsLoading(true);
          setPage(0);
        }
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadTrips = React.useCallback(
    async (targetPage = page, signal?: { cancelled: boolean }) => {
      try {
        const result = await fetchAdminTrips({
          page: targetPage,
          size: PAGE_SIZE,
          search: debouncedSearch,
          visibility: visibilityFilter,
          archived: archiveFilter,
        });
        if (signal?.cancelled) return;
        setPageData(result);
        setLoadError(null);

        const ownerIds = result.items.map((item) => item.ownerUserId).filter(Boolean);
        const profiles = await fetchTripCreatorProfiles(ownerIds);
        if (!signal?.cancelled && profiles) {
          setCreatorProfiles(profiles);
        }
      } catch (err) {
        if (!signal?.cancelled) {
          setLoadError(getSafeErrorMessage(err, FALLBACK_LOAD_ERROR));
        }
      } finally {
        if (!signal?.cancelled) {
          setIsLoading(false);
        }
      }
    },
    [archiveFilter, debouncedSearch, page, visibilityFilter],
  );

  React.useEffect(() => {
    const signal = { cancelled: false };
    void (async () => {
      await loadTrips(page, signal);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [loadTrips, page]);

  const handleRefresh = () => {
    setIsLoading(true);
    void loadTrips(page);
  };

  const handleVisibilityChange = (nextVis: AdminTripVisibilityFilter) => {
    if (nextVis !== visibilityFilter) {
      setIsLoading(true);
    }
    setVisibilityFilter(nextVis);
    setPage(0);
  };

  const handleArchiveFilterChange = (nextArchive: AdminTripArchiveFilter) => {
    if (nextArchive !== archiveFilter) {
      setIsLoading(true);
    }
    setArchiveFilter(nextArchive);
    setPage(0);
  };

  const handleToggleArchive = async (trip: AdminTripItem) => {
    const nextArchived = !trip.archived;
    setMutatingId(trip.id);
    try {
      await updateAdminTripArchive(trip.id, nextArchived, trip.version);
      toast.success(
        nextArchived
          ? t("admin.trips.actions.archiveUpdated") || "Trip archived successfully"
          : t("admin.trips.actions.restoreUpdated") || "Trip restored successfully",
      );
      await loadTrips(page);
    } catch (err) {
      toast.error(
        getSafeErrorMessage(
          err,
          t("admin.trips.actions.updateError") || "Could not update trip archive state.",
        ),
      );
    } finally {
      setMutatingId(null);
    }
  };

  const items = pageData?.items ?? [];
  const summary = pageData?.summary;
  const totalPages = pageData?.totalPages ?? 0;
  const totalElements = pageData?.totalElements ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              <Route className="h-3.5 w-3.5 mr-1" />{" "}
              {t("admin.trips.itineraries") || "Itineraries"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("admin.trips.management") || "Trip Management"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("admin.trips.title") || "Trips & Itineraries"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.trips.subtitle") ||
              "Monitor user-created and AI-generated travel itineraries across the platform."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary text-primary-foreground font-mono text-xs px-3 py-1">
            {t("admin.trips.totalTrips", { count: summary?.totalTrips ?? totalElements }) ||
              `Total: ${summary?.totalTrips ?? totalElements} Trips`}
          </Badge>
          {summary && (
            <>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs"
              >
                {t("admin.trips.summary.active", { count: summary.activeTrips }) ||
                  `${summary.activeTrips} Active`}
              </Badge>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 font-mono text-xs"
              >
                {t("admin.trips.summary.aiCrafted", { count: summary.aiCraftedTrips }) ||
                  `${summary.aiCraftedTrips} AI Crafted`}
              </Badge>
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground font-mono text-xs"
              >
                {t("admin.trips.summary.archived", { count: summary.archivedTrips }) ||
                  `${summary.archivedTrips} Archived`}
              </Badge>
            </>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {t("admin.trips.refresh") || "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={
              t("admin.trips.searchPlaceholder") || "Search by trip name, destination, or ID..."
            }
            aria-label={
              t("admin.trips.searchPlaceholder") || "Search by trip name, destination, or ID..."
            }
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs flex-wrap">
            <span className="text-muted-foreground px-2 font-medium">
              {t("admin.trips.visibilityFilter") || "Visibility:"}
            </span>
            {(["ALL", "PUBLIC", "SHARED", "PRIVATE"] as const).map((vis) => (
              <button
                key={vis}
                type="button"
                onClick={() => handleVisibilityChange(vis)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  visibilityFilter === vis
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {vis === "ALL"
                  ? t("admin.trips.all") || "All"
                  : vis === "PUBLIC"
                    ? t("admin.trips.visibility.public") || "Public"
                    : vis === "SHARED"
                      ? t("admin.trips.visibility.shared") || "Shared"
                      : t("admin.trips.visibility.private") || "Private"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs flex-wrap">
            <span className="text-muted-foreground px-2 font-medium">
              {t("admin.trips.archiveFilter") || "Status:"}
            </span>
            {(["ALL", "ACTIVE", "ARCHIVED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleArchiveFilterChange(st)}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  archiveFilter === st
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL"
                  ? t("admin.trips.all") || "All"
                  : st === "ACTIVE"
                    ? t("admin.trips.status.active") || "Active"
                    : t("admin.trips.status.archived") || "Archived"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              {loadError === FALLBACK_LOAD_ERROR
                ? t("admin.trips.loadError") || "Could not load trips. Please try again."
                : loadError}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {t("admin.trips.retry") || "Retry"}
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="bg-card border-border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-micro tracking-wider font-semibold">
              <tr>
                <th className="p-4">
                  {t("admin.trips.table.tripName") || "Trip Name"} &{" "}
                  {t("admin.trips.table.destination") || "Destination"}
                </th>
                <th className="p-4">{t("admin.trips.table.creator") || "Creator"}</th>
                <th className="p-4">{t("admin.trips.table.dates") || "Dates"}</th>
                <th className="p-4">{t("admin.trips.table.durationPlaces") || "Places"}</th>
                <th className="p-4">{t("admin.trips.table.type") || "Type"}</th>
                <th className="p-4">
                  {t("admin.trips.table.visibility") || "Visibility"} /{" "}
                  {t("admin.trips.table.status") || "Status"}
                </th>
                <th className="p-4 text-right">{t("admin.trips.table.actions") || "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && items.length === 0 ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="p-4" colSpan={7}>
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t("admin.trips.empty") || "No itineraries match your filter."}
                  </td>
                </tr>
              ) : (
                items.map((trip) => {
                  const creatorProfile = creatorProfiles[trip.ownerUserId];
                  const creatorName =
                    creatorProfile?.displayName?.trim() ||
                    `User-${trip.ownerUserId.slice(0, 8)}`;
                  const visibility = (trip.visibility || "PRIVATE").toUpperCase();
                  const isBusy = mutatingId === trip.id;

                  return (
                    <tr key={trip.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-foreground text-sm">{trip.name}</div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" /> {trip.destinationName}
                          </span>
                          {typeof trip.travelerCount === "number" && trip.travelerCount > 0 && (
                            <span className="flex items-center gap-1 text-micro">
                              <Users className="h-3 w-3" />
                              {t("admin.trips.travelersCount", { count: trip.travelerCount }) ||
                                `${trip.travelerCount} travelers`}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-border">
                            {creatorProfile?.avatarUrl && (
                              <AvatarImage src={creatorProfile.avatarUrl} alt={creatorName} />
                            )}
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(creatorName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground">{creatorName}</div>
                            <div className="text-micro font-mono text-muted-foreground">
                              {trip.ownerUserId.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-foreground font-mono">
                          {formatTripDateRange(trip.startDate, trip.endDate)}
                        </div>
                        <div className="text-micro text-muted-foreground">
                          {t("admin.trips.daysPlanned", { count: trip.durationDays }) ||
                            `${trip.durationDays} Days planned`}
                        </div>
                      </td>

                      <td className="p-4 font-mono font-medium text-foreground">
                        {t("admin.trips.spotsCount", { count: trip.spotsCount }) ||
                          `${trip.spotsCount} spots`}
                      </td>

                      <td className="p-4">
                        {trip.isAiGenerated ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 w-fit text-micro">
                            <Sparkles className="h-3 w-3" />{" "}
                            {t("admin.trips.aiCrafted") || "AI Crafted"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-micro text-muted-foreground">
                            {t("admin.trips.manual") || "Manual"}
                          </Badge>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className={`text-micro flex items-center gap-1 w-fit ${
                              visibility === "PUBLIC"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : visibility === "SHARED"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {visibility === "PUBLIC" && <Globe className="h-3 w-3" />}
                            {visibility === "SHARED" && <Share2 className="h-3 w-3" />}
                            {visibility === "PRIVATE" && <Lock className="h-3 w-3" />}
                            <span>
                              {visibility === "PUBLIC"
                                ? t("admin.trips.visibility.public") || "Public"
                                : visibility === "SHARED"
                                  ? t("admin.trips.visibility.shared") || "Shared"
                                  : t("admin.trips.visibility.private") || "Private"}
                            </span>
                          </Badge>

                          <Badge
                            variant="outline"
                            className={`text-micro w-fit ${
                              trip.archived
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-muted/50 text-foreground"
                            }`}
                          >
                            {trip.archived
                              ? t("admin.trips.status.archived") || "Archived"
                              : t("admin.trips.status.active") || "Active"}
                          </Badge>
                        </div>
                      </td>

                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isBusy}
                              className="h-8 w-8 rounded-lg"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            <DropdownMenuItem
                              disabled={isBusy}
                              onClick={() => void handleToggleArchive(trip)}
                              className="cursor-pointer"
                            >
                              {trip.archived ? (
                                <>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  <span>{t("admin.trips.actions.restore") || "Restore Trip"}</span>
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  <span>{t("admin.trips.actions.archive") || "Archive Trip"}</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              {t("admin.trips.pagination.pageOf", {
                page: page + 1,
                total: totalPages,
                count: totalElements,
              }) || `Page ${page + 1} of ${totalPages} (${totalElements} trips)`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 0 || isLoading}
                onClick={() => {
                  setIsLoading(true);
                  setPage((prev) => Math.max(0, prev - 1));
                }}
                className="h-8 gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("admin.trips.pagination.previous") || "Previous"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages || isLoading}
                onClick={() => {
                  setIsLoading(true);
                  setPage((prev) => prev + 1);
                }}
                className="h-8 gap-1 text-xs"
              >
                {t("admin.trips.pagination.next") || "Next"}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

