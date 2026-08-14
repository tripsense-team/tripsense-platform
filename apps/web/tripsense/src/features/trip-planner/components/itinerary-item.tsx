import Image from "next/image";
import { MapPin, Utensils, Hotel, Plane, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ItineraryItemType = "place" | "meal" | "hotel" | "flight" | "note";

export interface ItineraryItemProps {
  id?: string;
  type?: ItineraryItemType;
  time?: string;
  title: string;
  subtitle?: string;
  image?: string;
  location?: string;
  notes?: string;
  onClick?: () => void;
  className?: string;
}

const typeIcons = {
  place: MapPin,
  meal: Utensils,
  hotel: Hotel,
  flight: Plane,
  note: FileText,
};

export function ItineraryItem({
  type = "place",
  time,
  title,
  subtitle,
  image,
  location,
  notes,
  onClick,
  className,
}: ItineraryItemProps) {
  const Icon = typeIcons[type];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group relative flex items-start gap-4 p-3.5 rounded-xl border border-border bg-card shadow-2xs hover:shadow-xs hover:border-primary/50 transition-all cursor-pointer",
        className
      )}
    >
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        {time && (
          <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
            {time}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
            {title}
          </h4>
          <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 shrink-0">
            {type}
          </Badge>
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}

        {location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <MapPin className="h-3 w-3 text-primary shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}

        {notes && (
          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md mt-2 border border-border/40">
            {notes}
          </p>
        )}
      </div>

      {image && (
        <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted shrink-0 hidden sm:block">
          <Image src={image} alt={title} fill sizes="64px" className="object-cover" />
        </div>
      )}
    </Card>
  );
}
