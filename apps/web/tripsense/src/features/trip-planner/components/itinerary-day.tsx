import * as React from "react";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ItineraryDayProps {
  dayNumber: number;
  dateText?: string;
  title?: string;
  children?: React.ReactNode;
  onAddItem?: () => void;
  className?: string;
}

export function ItineraryDay({
  dayNumber,
  dateText,
  title,
  children,
  onAddItem,
  className,
}: ItineraryDayProps) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card/60 p-4 space-y-4 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
            D{dayNumber}
          </div>
          <div>
            <h3 className="font-semibold text-base text-foreground leading-tight">
              {title || `Day ${dayNumber}`}
            </h3>
            {dateText && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3 w-3" />
                <span>{dateText}</span>
              </p>
            )}
          </div>
        </div>

        {onAddItem && (
          <Button variant="ghost" size="sm" onClick={onAddItem} className="gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </Button>
        )}
      </div>

      <div className="space-y-2">{children}</div>
    </div>
  );
}
