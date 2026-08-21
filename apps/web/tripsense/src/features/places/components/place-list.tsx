"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { PlaceCard } from "./place-card";
import { cn } from "@/lib/utils";
import type { Place } from "../types";

export interface PlaceListProps {
  places: Place[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  onViewDetails: (place: Place) => void;
  isLoading?: boolean;
  className?: string;
}

export function PlaceList({
  places,
  selectedPlaceId,
  onSelectPlace,
  onViewDetails,
  isLoading = false,
  className,
}: PlaceListProps) {
  const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll selected place card into view when selectedPlaceId changes
  React.useEffect(() => {
    if (selectedPlaceId && itemRefs.current[selectedPlaceId]) {
      itemRefs.current[selectedPlaceId]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedPlaceId]);

  if (isLoading) {
    return (
      <div className={cn("space-y-3 p-1", className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-36 w-full animate-pulse rounded-2xl border border-border bg-card p-3 shadow-xs"
          >
            <div className="w-36 sm:w-44 h-full rounded-xl bg-muted shrink-0" />
            <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
              <div className="space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded-md" />
                <div className="h-3 w-1/3 bg-muted rounded-md" />
                <div className="h-3 w-1/2 bg-muted rounded-md" />
              </div>
              <div className="h-4 w-1/4 bg-muted rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-border bg-card/40 my-4 space-y-3">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <SearchX className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-sm text-foreground">Không tìm thấy địa điểm phù hợp</h4>
          <p className="text-xs text-muted-foreground max-w-xs">
            Hãy thử tìm kiếm với từ khóa khác như &quot;quán cafe view biển&quot;, &quot;hải sản Đà Nẵng&quot;, hoặc &quot;món ăn địa phương&quot;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 overflow-y-auto pr-1 pb-4 scrollbar-thin", className)}>
      <div className="text-xs font-medium text-muted-foreground px-1 flex items-center justify-between">
        <span>Tìm thấy {places.length} địa điểm tại Đà Nẵng</span>
      </div>

      {places.map((place, idx) => (
        <div
          key={place.id}
          ref={(el) => {
            itemRefs.current[place.id] = el;
          }}
        >
          <PlaceCard
            place={place}
            index={idx + 1}
            isSelected={place.id === selectedPlaceId}
            onClick={() => onSelectPlace(place.id)}
            onViewDetails={() => onViewDetails(place)}
          />
        </div>
      ))}
    </div>
  );
}
