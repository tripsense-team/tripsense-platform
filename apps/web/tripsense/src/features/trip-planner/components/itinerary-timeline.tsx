import * as React from "react";
import { cn } from "@/lib/utils";

interface ItineraryTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ItineraryTimeline({
  children,
  className,
  ...props
}: ItineraryTimelineProps) {
  return (
    <div className={cn("space-y-3 relative my-4", className)} {...props}>
      {children}
    </div>
  );
}
