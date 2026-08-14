import * as React from "react";
import { cn } from "@/lib/utils";

export interface MapLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  sidePane: React.ReactNode;
  mapPane: React.ReactNode;
  panePosition?: "left" | "right";
}

export function MapLayout({
  sidePane,
  mapPane,
  panePosition = "left",
  className,
  ...props
}: MapLayoutProps) {
  return (
    <div
      className={cn(
        "relative flex h-[calc(100vh-4rem)] w-full overflow-hidden",
        panePosition === "right" && "flex-row-reverse",
        className
      )}
      {...props}
    >
      <div className="w-full lg:w-1/2 overflow-y-auto p-4 lg:p-6 bg-background z-10 shadow-lg">
        {sidePane}
      </div>
      <div className="hidden lg:block lg:w-1/2 h-full relative bg-muted">
        {mapPane}
      </div>
    </div>
  );
}
