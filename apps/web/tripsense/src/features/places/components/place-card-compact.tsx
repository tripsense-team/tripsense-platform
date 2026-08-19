import Image from "next/image";
import { Rating } from "@/components/shared/rating";
import { cn } from "@/lib/utils";

export interface PlaceCardCompactProps {
  image?: string;
  name: string;
  category?: string;
  rating?: number;
  onClick?: () => void;
  className?: string;
}

export function PlaceCardCompact({
  image,
  name,
  category,
  rating,
  onClick,
  className,
}: PlaceCardCompactProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg border border-border bg-card shadow-xs hover:border-primary/50 transition-all cursor-pointer w-full",
        className
      )}
    >
      <div className="relative h-12 w-12 rounded-md overflow-hidden bg-muted shrink-0">
        {image ? (
          <Image src={image} alt={name} fill sizes="48px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            No Img
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="font-semibold text-xs text-foreground truncate">{name}</h5>
        {category && <p className="text-[11px] text-muted-foreground truncate">{category}</p>}
      </div>
      {rating !== undefined && (
        <Rating value={rating} showText={false} className="shrink-0 text-xs" />
      )}
    </div>
  );
}
