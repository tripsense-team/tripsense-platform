import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCardSkeleton } from "@/features/social-post";

export default function CommunityLoading() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 space-y-6 animate-in fade-in-50 duration-200">
      {/* Header Skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>

      {/* Composer Skeleton */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <Skeleton className="h-20 flex-1 rounded-xl" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>

      {/* Post Skeletons Feed */}
      <div className="space-y-4">
        <PostCardSkeleton />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    </div>
  );
}
