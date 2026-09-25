"use client";

import * as React from "react";
import {
  Camera,
  Compass,
  Lightbulb,
  Map,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useSocialFeed } from "../hooks";
import type { FeedFilterTab } from "../hooks/use-social-feed";
import { CommunityEmptyState } from "./community-empty-state";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { PostComposer } from "./post-composer";
import { useTranslation } from "@/i18n";
import { useCommunityDiscovery } from "../hooks/use-community-discovery";
import { DestinationWeatherWidget } from "./destination-weather-widget";
import { SuggestedCreatorsWidget } from "./suggested-creators-widget";
import { TrendingDestinationsWidget } from "./trending-destinations-widget";

export function SocialFeedScreen() {
  const {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    activeTab,
    setActiveTab,
    loadMore,
    refetch,
    prependPost,
    removePost,
  } = useSocialFeed();
  const { t } = useTranslation();
  const composerRef = React.useRef<HTMLDivElement>(null);

  const filters: Array<{
    value: FeedFilterTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { value: "all", label: t("social.all"), icon: Sparkles },
    {
      value: "updates",
      label: t("social.postTypeUpdate"),
      icon: MessageCircle,
    },
    { value: "trips", label: t("social.postTypeTrip"), icon: Compass },
  ];

  function focusComposer() {
    composerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(
      () => composerRef.current?.querySelector("textarea")?.focus(),
      400,
    );
  }

  return (
    <main className="w-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_32rem)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        <CommunityHero onCreate={focusComposer} />

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(18rem,.82fr)]">
          <section
            className="min-w-0 space-y-5"
            aria-label={t("social.communityFeed")}
          >
            <div ref={composerRef}>
              <PostComposer onPostCreated={prependPost} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-2 shadow-xs">
              <div className="flex min-w-0 gap-1 overflow-x-auto">
                {filters.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition sm:text-sm cursor-pointer",
                      activeTab === value
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={refetch}
                disabled={loading}
                className="shrink-0 rounded-xl"
                aria-label={t("social.refreshFeed")}
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </Button>
            </div>

            <div className="space-y-4">
              {error && <ErrorState message={error} onRetry={refetch} />}
              {loading ? (
                <>
                  <PostCardSkeleton />
                  <PostCardSkeleton />
                </>
              ) : error ? null : posts.length === 0 ? (
                <CommunityEmptyState
                  filter={activeTab}
                  onActionClick={focusComposer}
                />
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onPostDeleted={removePost}
                  />
                ))
              )}
              {hasMore && !loading && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full px-6 font-bold"
                  >
                    {loadingMore
                      ? t("social.loadingMore")
                      : t("social.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          </section>

          <CommunityRail />
        </div>
      </div>
    </main>
  );
}

function CommunityHero({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();

  return (
    <header className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card px-6 py-7 shadow-sm sm:px-9 sm:py-9">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <Compass className="h-4 w-4" /> {t("social.communityTag")}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("social.communityHeroTitle")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            {t("social.communityHeroSubtitle")}
          </p>
        </div>
        <Button
          onClick={onCreate}
          className="w-fit rounded-full px-6 font-bold shadow-sm"
        >
          <Sparkles className="h-4 w-4" /> {t("social.publishNow")}
        </Button>
      </div>
    </header>
  );
}

function CommunityRail() {
  const { t } = useTranslation();
  const {
    creators,
    weather,
    trendingDestinations,
    selectedCity,
    changeCity,
    toggleFollow,
    followingMap,
    loading,
    weatherLoading,
  } = useCommunityDiscovery();

  return (
    <aside
      className="space-y-5 lg:sticky lg:top-6"
      aria-label={t("social.communityFeed")}
    >
      {/* 1. Destination Weather Widget */}
      <DestinationWeatherWidget
        weather={weather}
        selectedCity={selectedCity}
        onCityChange={changeCity}
        loading={loading || weatherLoading}
      />

      {/* 2. Suggested Creators to Follow Widget */}
      <SuggestedCreatorsWidget
        creators={creators}
        onToggleFollow={toggleFollow}
        followingMap={followingMap}
      />

      {/* 3. Trending Destinations Widget */}
      <TrendingDestinationsWidget destinations={trendingDestinations} />

      {/* 4. Community Guidelines */}
      <RailCard
        icon={ShieldCheck}
        title={t("social.safeSharingTitle")}
        description={t("social.safeSharingDesc")}
      >
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• {t("social.safeSharingRule1")}</li>
          <li>• {t("social.safeSharingRule2")}</li>
          <li>• {t("social.safeSharingRule3")}</li>
        </ul>
      </RailCard>
    </aside>
  );
}

function RailCard({
  icon: Icon,
  title,
  description,
  children,
}: React.PropsWithChildren<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}>) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-xs">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 border-t border-border pt-4">{children}</div>
    </section>
  );
}

function RailTip({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" />
      <span>{text}</span>
    </div>
  );
}
