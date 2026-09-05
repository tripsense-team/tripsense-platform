import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlacesLoading() {
  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col md:flex-row animate-in fade-in-50 duration-200">
      {/* Left Column: Search + List Skeleton */}
      <div className="w-full md:w-[480px] lg:w-[540px] h-full overflow-y-auto border-r border-border p-4 sm:p-5 space-y-5 shrink-0">
        {/* Search bar skeleton */}
        <Skeleton className="h-11 w-full rounded-2xl" />

        {/* Category chips skeleton */}
        <div className="flex gap-2 overflow-x-hidden">
          <Skeleton className="h-8 w-20 rounded-full shrink-0" />
          <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          <Skeleton className="h-8 w-28 rounded-full shrink-0" />
          <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        </div>

        {/* Places cards list skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3.5 rounded-2xl border border-border bg-card p-3.5 shadow-2xs">
              <Skeleton className="h-24 w-24 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3.5 w-1/2 rounded-md" />
                <div className="flex items-center gap-2 pt-1">
                  <Skeleton className="h-3 w-12 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Map Skeleton */}
      <div className="hidden md:flex flex-1 h-full bg-muted/30 items-center justify-center relative">
        <Skeleton className="w-full h-full" />
        <div className="absolute text-center space-y-2">
          <div className="h-10 w-10 mx-auto rounded-full bg-primary/10 border border-primary/20 animate-pulse" />
          <p className="text-xs font-medium text-muted-foreground">Đang tải bản đồ...</p>
        </div>
      </div>
    </div>
  );
}
