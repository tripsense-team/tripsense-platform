"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Pencil, Star, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmationDialog, EmptyState, ResponsiveDialog } from "@/components/shared";
import { useAuthStore } from "@/features/auth";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  createCommunityReview,
  deleteCommunityReview,
  getCommunityReviews,
  updateCommunityReview,
} from "../services/community-reviews-api";
import type { CommunityReview } from "../types";

const reviewKey = (placeRef: string) => ["community-reviews", placeRef] as const;

export function CommunityReviewsSection({ placeRef, placeName }: { placeRef: string; placeName: string }) {
  const { t, locale } = useTranslation();
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const writesEnabled = process.env.NEXT_PUBLIC_COMMUNITY_REVIEW_WRITES_ENABLED === "true";
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = React.useState(10);
  const [editing, setEditing] = React.useState<CommunityReview | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<CommunityReview | null>(null);
  const [rating, setRating] = React.useState(5);
  const [content, setContent] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: [...reviewKey(placeRef), pageSize],
    queryFn: () => getCommunityReviews(placeRef, 0, pageSize),
  });
  const ownReview = query.data?.currentUserReview ?? query.data?.items.find((review) => review.ownedByCurrentUser);

  const openEditor = (review?: CommunityReview) => {
    setEditing(review ?? null);
    setRating(review?.rating ?? 5);
    setContent(review?.content ?? "");
    setError(null);
    setEditorOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateCommunityReview(editing.id, { rating, content, version: editing.version })
        : createCommunityReview(placeRef, { rating, content }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reviewKey(placeRef) });
      setEditorOpen(false);
    },
    onError: (value) => setError(getSafeErrorMessage(value, t("errors.generic"))),
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => deleteCommunityReview(reviewId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reviewKey(placeRef) });
      setDeleting(null);
    },
    onError: (value) => setError(getSafeErrorMessage(value, t("errors.generic"))),
  });

  if (query.isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (query.isError || !query.data) {
    return <EmptyState icon={MessageSquare} title={t("places.communityReviewsUnavailable")} action={<Button variant="outline" onClick={() => query.refetch()}>{t("common.retry")}</Button>} />;
  }

  return (
    <section className="space-y-4" aria-labelledby="community-reviews-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id="community-reviews-heading" className="text-base font-bold text-foreground">{t("places.communityReviews")}</h4>
          {query.data.summary.reviewCount > 0 && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="font-semibold text-foreground">{query.data.summary.averageRating.toFixed(1)}</span>
              <span>({query.data.summary.reviewCount})</span>
            </div>
          )}
        </div>
        {authenticated && writesEnabled && (
          <Button size="sm" variant="outline" onClick={() => openEditor(ownReview)}>
            {ownReview ? t("places.editReview") : t("places.addReview")}
          </Button>
        )}
      </div>

      {query.data.items.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t("places.noCommunityReviews")} description={t("places.noCommunityReviewsDescription", { place: placeName })} />
      ) : (
        <div className="space-y-3">
          {query.data.items.map((review) => (
            <article key={review.id} className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  {review.author.avatarUrl && <AvatarImage src={review.author.avatarUrl} alt="" />}
                  <AvatarFallback>{review.author.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="truncate text-sm font-semibold text-foreground">{review.author.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
                          Math.round((new Date(review.createdAt).getTime() - query.dataUpdatedAt) / 86_400_000),
                          "day",
                        )}
                        {review.updatedAt !== review.createdAt ? ` · ${t("places.edited")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5" aria-label={t("places.ratingOutOfFive", { rating: review.rating })}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star key={index} className={cn("h-3.5 w-3.5", index < review.rating ? "fill-primary text-primary" : "text-muted-foreground/40")} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{review.content}</p>
                  {review.ownedByCurrentUser && (
                    <div className="mt-3 flex gap-2">
                      <Button size="xs" variant="ghost" onClick={() => openEditor(review)}><Pencil className="h-3.5 w-3.5" />{t("common.edit")}</Button>
                      <Button size="xs" variant="ghost" onClick={() => setDeleting(review)}><Trash2 className="h-3.5 w-3.5" />{t("common.delete")}</Button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {query.data.totalElements > query.data.items.length && (
        <Button variant="outline" className="w-full" onClick={() => setPageSize((value) => value + 10)}>{t("common.loadMore")}</Button>
      )}

      <ResponsiveDialog open={editorOpen} onOpenChange={setEditorOpen} title={editing ? t("places.editReview") : t("places.addReview")} description={placeName}>
        <div className="space-y-4" aria-live="polite">
          <div className="flex gap-1" role="radiogroup" aria-label={t("places.reviewRating")}>
            {Array.from({ length: 5 }, (_, index) => index + 1).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} className="rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Star className={cn("h-7 w-7", value <= rating ? "fill-primary text-primary" : "text-muted-foreground/40")} />
              </button>
            ))}
          </div>
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} minLength={10} maxLength={2000} rows={6} placeholder={t("places.reviewPlaceholder")} />
          <div className="flex justify-between text-xs text-muted-foreground"><span>{t("places.reviewMinimum")}</span><span>{content.length}/2000</span></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>{t("common.cancel")}</Button>
            <Button loading={saveMutation.isPending} disabled={content.trim().length < 10} onClick={() => saveMutation.mutate()}>{t("common.save")}</Button>
          </div>
        </div>
      </ResponsiveDialog>

      <ConfirmationDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("places.deleteReview")}
        description={t("places.deleteReviewDescription")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting ? deleteMutation.mutateAsync(deleting.id) : Promise.resolve()}
      />
    </section>
  );
}
