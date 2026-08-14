import * as React from "react";
import { cn } from "@/lib/utils";

export interface SplitViewProps extends React.HTMLAttributes<HTMLDivElement> {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  leftRatio?: "1:1" | "1:2" | "2:1" | "1:3" | "3:1";
}

const ratioMap = {
  "1:1": "lg:grid-cols-2",
  "1:2": "lg:grid-cols-3 [&>:first-child]:lg:col-span-1 [&>:last-child]:lg:col-span-2",
  "2:1": "lg:grid-cols-3 [&>:first-child]:lg:col-span-2 [&>:last-child]:lg:col-span-1",
  "1:3": "lg:grid-cols-4 [&>:first-child]:lg:col-span-1 [&>:last-child]:lg:col-span-3",
  "3:1": "lg:grid-cols-4 [&>:first-child]:lg:col-span-3 [&>:last-child]:lg:col-span-1",
};

export function SplitView({
  leftPane,
  rightPane,
  leftRatio = "1:1",
  className,
  ...props
}: SplitViewProps) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-6", ratioMap[leftRatio], className)}
      {...props}
    >
      <div className="h-full">{leftPane}</div>
      <div className="h-full">{rightPane}</div>
    </div>
  );
}
