import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TripDetailLoading() {
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in-50 duration-200">
      {/* Header skeleton with back button and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Main trip layout: Days / itinerary left, Map right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex gap-2 pb-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-2xs">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-40 rounded-md" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3.5 w-2/3 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 h-80 lg:h-[500px] rounded-2xl overflow-hidden border border-border">
          <Skeleton className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
