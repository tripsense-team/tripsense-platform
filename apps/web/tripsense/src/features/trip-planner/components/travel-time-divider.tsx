import { Footprints, Car, Bus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TravelTimeDividerProps {
  duration: string;
  distance?: string;
  mode?: "walk" | "drive" | "transit";
  className?: string;
}

const modeIcons = {
  walk: Footprints,
  drive: Car,
  transit: Bus,
};

export function TravelTimeDivider({
  duration,
  distance,
  mode = "walk",
  className,
}: TravelTimeDividerProps) {
  const Icon = modeIcons[mode];

  return (
    <div className={cn("flex items-center gap-3 my-2 pl-4 text-xs text-muted-foreground", className)}>
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-border" />
        <div className="p-1 rounded-full bg-muted border border-border">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="w-0.5 h-4 bg-border" />
      </div>

      <div className="flex items-center gap-1.5 font-medium py-1 px-2.5 rounded-full bg-muted/50 border border-border/50">
        <span>{duration}</span>
        {distance && <span>• {distance}</span>}
      </div>
    </div>
  );
}
