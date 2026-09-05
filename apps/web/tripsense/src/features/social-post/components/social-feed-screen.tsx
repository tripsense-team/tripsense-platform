"use client";

import * as React from "react";
import { Compass, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/shared";
import { useSocialFeed } from "../hooks";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import { PostCardSkeleton } from "./post-card-skeleton";

export function SocialFeedScreen() {
  const {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
    prependPost,
    removePost,
  } = useSocialFeed();

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Community Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-normal text-foreground">
            Cộng đồng
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Khám phá và chia sẻ những khoảnh khắc hành trình đáng nhớ.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={refetch}
          disabled={loading}
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Làm mới bảng tin"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Post Composer (TF-51) */}
      <PostComposer onPostCreated={prependPost} />

      {/* Posts List / State Handling */}
      <div className="space-y-4">
        {/* Error state */}
        {error && (
          <ErrorState message={error} onRetry={refetch} />
        )}

        {/* Initial loading state */}
        {loading ? (
          <div className="space-y-4">
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </div>
        ) : error ? null : posts.length === 0 ? (
          /* Empty state */
          <EmptyState
            icon={Compass}
            title="Chưa có bài viết nào"
            description="Hãy là người đầu tiên chia sẻ câu chuyện du lịch của bạn lên cộng đồng!"
          />
        ) : (
          /* Render post cards */
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

        {/* Load more button */}
        {hasMore && !loading && (
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full px-6 text-sm font-semibold h-9"
            >
              {loadingMore ? "Đang tải thêm..." : "Xem thêm bài viết"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
