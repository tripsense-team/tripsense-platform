import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MainLayoutLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in-50 duration-200">
      {/* Page Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-72 rounded-lg" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Content Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-2/3 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
