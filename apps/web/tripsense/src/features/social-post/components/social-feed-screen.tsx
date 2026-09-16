"use client";

import * as React from "react";
import { Sparkles, Clock, Compass, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared";
import { useSocialFeed } from "../hooks";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";
import { CommunityEmptyState } from "./community-empty-state";
import { cn } from "@/lib/utils";

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

  const composerRef = React.useRef<HTMLDivElement>(null);

  const handleFocusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: "smooth" });
    const textarea = composerRef.current?.querySelector("textarea");
    textarea?.focus();
  };

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Community Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-normal text-foreground">
            Cộng đồng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Khám phá trải nghiệm, mẹo hay và những hành trình thực tế từ cộng đồng du lịch TripSense.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={refetch}
          disabled={loading}
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground self-end sm:self-center"
          aria-label="Làm mới bảng tin"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Post Composer (TF-51) */}
      <div ref={composerRef}>
        <PostComposer onPostCreated={prependPost} />
      </div>

      {/* Feed Filters / Tabs (TF-66) */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0",
            activeTab === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Tất cả
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("newest")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0",
            activeTab === "newest"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          Mới nhất
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("trips")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0",
            activeTab === "trips"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Compass className="h-3.5 w-3.5" />
          Hành trình chia sẻ
        </button>
      </div>

      {/* Posts List / State Handling (TF-64, TF-68, TF-69) */}
      <div className="space-y-4">
        {/* Error state */}
        {error && <ErrorState message={error} onRetry={refetch} />}

        {/* Initial loading state */}
        {loading ? (
          <div className="space-y-4">
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : error ? null : posts.length === 0 ? (
          /* Empty state (TF-69) */
          <CommunityEmptyState
            filter={activeTab}
            onActionClick={handleFocusComposer}
          />
        ) : (
          /* Render post cards (TF-64, TF-65) */
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPostDeleted={removePost}
              />
            ))}
          </div>
        )}

        {/* Load more button (TF-68) */}
        {hasMore && !loading && (
          <div className="pt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full px-6 text-sm font-semibold h-9 shadow-xs hover:bg-primary hover:text-primary-foreground transition-all"
            >
              {loadingMore ? "Đang tải thêm..." : "Xem thêm bài viết"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
