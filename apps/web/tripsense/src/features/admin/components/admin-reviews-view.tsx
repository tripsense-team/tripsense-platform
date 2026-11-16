"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { fetchAdminReviews, updateAdminReviewStatus } from "../api/admin-reviews-api";
import type {
  AdminPlaceReviewItem,
  AdminPlaceReviewPageResponse,
  AdminReviewFilterStatus,
  AdminReviewStatus,
} from "../types/admin-reviews.types";

const PAGE_SIZE = 20;
const FALLBACK_LOAD_ERROR = "__ADMIN_REVIEWS_LOAD_ERROR__";

function formatReviewDate(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

export function AdminReviewsView() {
  const { t } = useTranslation();

  const [searchInput, setSearchInput] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<AdminReviewFilterStatus>("ALL");
  const [page, setPage] = React.useState(0);

  const [pageData, setPageData] = React.useState<AdminPlaceReviewPageResponse | null>(null);
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

  const loadReviews = React.useCallback(
    async (targetPage = page, signal?: { cancelled: boolean }) => {
      try {
        const result = await fetchAdminReviews({
          page: targetPage,
          size: PAGE_SIZE,
          search: debouncedSearch,
          status: statusFilter,
        });
        if (signal?.cancelled) return;
        setPageData(result);
        setLoadError(null);
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
    [debouncedSearch, page, statusFilter],
  );

  React.useEffect(() => {
    const signal = { cancelled: false };
    void (async () => {
      await loadReviews(page, signal);
    })();
    return () => {
      signal.cancelled = true;
    };
  }, [loadReviews, page]);

  const handleRefresh = () => {
    setIsLoading(true);
    void loadReviews(page);
  };

  const handleStatusFilterChange = (nextStatus: AdminReviewFilterStatus) => {
    if (nextStatus !== statusFilter) {
      setIsLoading(true);
    }
    setStatusFilter(nextStatus);
    setPage(0);
  };

  const handleUpdateStatus = async (
    review: AdminPlaceReviewItem,
    nextStatus: AdminReviewStatus,
  ) => {
    setMutatingId(review.id);
    try {
      await updateAdminReviewStatus(review.id, nextStatus, {
        version: review.version,
      });
      toast.success(
        t("admin.reviews.actions.statusUpdated") || "Updated review moderation status",
      );
      await loadReviews(page);
    } catch (err) {
      toast.error(
        getSafeErrorMessage(
          err,
          t("admin.reviews.actions.updateError") || "Could not update review status.",
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
              <MessageSquare className="h-3.5 w-3.5 mr-1" />{" "}
              {t("admin.reviews.userFeedback") || "User Feedback"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("admin.reviews.communityModeration") || "Community Moderation"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("admin.reviews.title") || "Reviews & Feedback"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.reviews.subtitle") ||
              "Moderate traveler reviews, verify authentic experiences, and maintain content quality."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-primary text-primary-foreground font-mono text-xs px-3 py-1">
            {t("admin.reviews.summary.total", { count: summary?.total ?? totalElements }) ||
              `Total: ${summary?.total ?? totalElements} Reviews`}
          </Badge>
          {summary && (
            <>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs"
              >
                {t("admin.reviews.summary.published", { count: summary.published }) ||
                  `${summary.published} Published`}
              </Badge>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-mono text-xs"
              >
                {t("admin.reviews.summary.flagged", { count: summary.flagged }) ||
                  `${summary.flagged} Flagged`}
              </Badge>
              <Badge
                variant="outline"
                className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-xs"
              >
                {t("admin.reviews.summary.removed", { count: summary.removed }) ||
                  `${summary.removed} Removed`}
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
            {t("admin.reviews.refresh") || "Refresh"}
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={
              t("admin.reviews.searchPlaceholder") ||
              "Search by review content, place reference, or ID..."
            }
            aria-label={
              t("admin.reviews.searchPlaceholder") ||
              "Search by review content, place reference, or ID..."
            }
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg text-xs flex-wrap">
          <span className="text-muted-foreground px-2 font-medium">
            {t("admin.reviews.filterStatus") || "Status:"}
          </span>
          {(["ALL", "PUBLISHED", "FLAGGED", "REMOVED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleStatusFilterChange(st)}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                statusFilter === st
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {st === "ALL"
                ? t("admin.reviews.all") || "All"
                : st === "PUBLISHED"
                  ? t("admin.reviews.status.published") || "Published"
                  : st === "FLAGGED"
                    ? t("admin.reviews.status.flagged") || "Flagged"
                    : t("admin.reviews.status.removed") || "Removed"}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              {loadError === FALLBACK_LOAD_ERROR
                ? t("admin.reviews.loadError") || "Could not load reviews. Please try again."
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
            {t("admin.reviews.retry") || "Retry"}
          </Button>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-3">
        {isLoading && items.length === 0 ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="bg-card border-border p-5">
              <Skeleton className="h-20 w-full rounded-lg" />
            </Card>
          ))
        ) : items.length === 0 ? (
          <Card className="bg-card border-border p-8 text-center text-muted-foreground text-xs">
            {t("admin.reviews.empty") || "No reviews match your filter."}
          </Card>
        ) : (
          items.map((rev) => {
            const isBusy = mutatingId === rev.id;
            return (
              <Card
                key={rev.id}
                className="bg-card border-border shadow-2xs p-5 hover:shadow-xs transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {rev.authorName}
                      </span>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                        <MapPin className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{rev.placeName || rev.placeRef}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-micro font-mono text-muted-foreground">
                        {formatReviewDate(rev.createdAt)}
                      </span>
                    </div>

                    {/* Stars */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < rev.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-muted text-muted"
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-foreground ml-1">
                        {rev.rating}/5
                      </span>
                    </div>

                    {/* Review Text */}
                    <p className="text-xs text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50 break-words">
                      &quot;{rev.content}&quot;
                    </p>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {rev.pendingReportCount > 0 && (
                        <Badge
                          variant="outline"
                          className="text-micro font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {t("admin.reviews.flaggedBadge", { count: rev.pendingReportCount }) ||
                            `${rev.pendingReportCount} flagged`}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-micro font-medium ${
                          rev.status === "PUBLISHED"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}
                      >
                        {rev.status === "PUBLISHED"
                          ? t("admin.reviews.status.published") || "Published"
                          : t("admin.reviews.status.removed") || "Removed"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(rev.status !== "PUBLISHED" || rev.pendingReportCount > 0) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void handleUpdateStatus(rev, "PUBLISHED")}
                          className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {rev.status === "REMOVED"
                            ? t("admin.reviews.actions.restore") || "Restore"
                            : t("admin.reviews.actions.approve") || "Approve"}
                        </Button>
                      )}
                      {rev.status !== "REMOVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void handleUpdateStatus(rev, "REMOVED")}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          {t("admin.reviews.actions.remove") || "Remove"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 0 && (
        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground shadow-2xs">
          <span>
            {t("admin.reviews.pagination.pageOf", {
              page: page + 1,
              total: totalPages,
              count: totalElements,
            }) || `Page ${page + 1} of ${totalPages} (${totalElements} reviews)`}
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
              {t("admin.reviews.pagination.previous") || "Previous"}
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
              {t("admin.reviews.pagination.next") || "Next"}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

