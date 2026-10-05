import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCardSkeleton } from "@/features/social-post";

export default function PostDetailLoading() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-in fade-in-50 duration-200">
      {/* Back button skeleton */}
      <Skeleton className="h-8 w-28 rounded-lg" />

      {/* Main post skeleton */}
      <PostCardSkeleton />

      {/* Comments section skeleton */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-4 w-3/4 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
