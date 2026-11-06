"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared";
import { useTranslation } from "@/i18n";
import type { SavedPostItem } from "../types";
import { socialPostRepository } from "../services";
import { PostCard } from "./post-card";

export function SavedTripSharesScreen() {
  const { t } = useTranslation();
  const [items, setItems] = React.useState<SavedPostItem[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (nextCursor?: string) => {
    if (nextCursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await socialPostRepository.listSavedTripShares(nextCursor);
      setItems((current) => (nextCursor ? [...current, ...page.items] : page.items));
      setCursor(page.nextCursor || null);
    } catch {
      setError(t("social.savedTripsLoadFailed"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [t]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Bookmark className="h-4 w-4" /> {t("social.savedTripsEyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{t("social.savedTripsTitle")}</h1>
          <p className="mt-2 text-muted-foreground">{t("social.savedTripsDescription")}</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/community">{t("social.backToCommunity")}</Link>
        </Button>
      </header>

      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={t("social.savedTripsEmptyTitle")}
          description={t("social.savedTripsEmptyDescription")}
          action={<Button asChild><Link href="/community">{t("social.exploreCommunity")}</Link></Button>}
        />
      ) : (
        <div className="space-y-5">
          {items.map(({ post }) => (
            <PostCard
              key={post.id}
              post={post}
              onPostDeleted={(postId) =>
                setItems((current) => current.filter((item) => item.post.id !== postId))
              }
            />
          ))}
          {cursor && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={loadingMore}
                onClick={() => void load(cursor)}
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("social.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
