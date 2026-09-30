import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export default function AiPlannerLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background animate-in fade-in-50 duration-150">
      {/* Top Header Skeleton matching ChatHeader */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-border/40 bg-background/80 px-4 md:px-6 backdrop-blur-md">
        {/* Left: Chat Title skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </div>

        {/* Center: Preferences pills skeleton (desktop) */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-2 py-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        {/* Right: Actions skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="flex flex-col items-center justify-center text-center space-y-3 max-w-md">
          <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
            <Sparkles className="size-6 text-primary" />
          </div>
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-md" />
        </div>
      </div>

      {/* Bottom Input Area Skeleton */}
      <div className="p-4 md:p-6 max-w-3xl w-full mx-auto shrink-0">
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-xs space-y-3">
          <Skeleton className="h-10 w-full rounded-xl bg-muted/40" />
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-lg" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
