import Image from "next/image";
import { MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/shared/rating";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceDisplay } from "@/components/shared/price-display";
import { cn } from "@/lib/utils";

export interface PlaceCardProps {
  id?: string;
  image?: string;
  name: string;
  category?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  openingHours?: string;
  favorite?: boolean;
  onFavoriteToggle?: (favorite: boolean) => void;
  actionButton?: React.ReactNode;
  variant?: "default" | "horizontal" | "compact";
  onClick?: () => void;
  className?: string;
}

export function PlaceCard({
  image,
  name,
  category,
  location,
  rating,
  reviewCount,
  priceLevel,
  openingHours,
  favorite = false,
  onFavoriteToggle,
  actionButton,
  variant = "default",
  onClick,
  className,
}: PlaceCardProps) {
  if (variant === "horizontal") {
    return (
      <Card
        onClick={onClick}
        className={cn(
          "group flex flex-row overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all cursor-pointer h-32 w-full",
          className
        )}
      >
        <div className="relative w-36 h-full shrink-0 bg-muted overflow-hidden">
          {image ? (
            <Image
              src={image}
              alt={name}
              fill
              sizes="144px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs font-medium">
              No Image
            </div>
          )}
        </div>
        <div className="p-3 flex-1 flex flex-col justify-between overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                {name}
              </h4>
              {priceLevel !== undefined && (
                <PriceDisplay priceLevel={priceLevel} className="shrink-0" />
              )}
            </div>
            {category && (
              <span className="text-xs font-medium text-muted-foreground block">
                {category}
              </span>
            )}
            {location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="line-clamp-1">{location}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            {rating !== undefined && <Rating value={rating} reviewCount={reviewCount} />}
            {actionButton}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      onClick={onClick}
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col h-full",
        className
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs font-medium">
            No Image
          </div>
        )}
        <div className="absolute top-2.5 right-2.5 z-10">
          <FavoriteButton isFavorite={favorite} onToggle={onFavoriteToggle} />
        </div>
        {category && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur font-medium text-[11px] px-2 py-0.5">
              {category}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {name}
            </h3>
            {priceLevel !== undefined && (
              <PriceDisplay priceLevel={priceLevel} className="shrink-0" />
            )}
          </div>

          {location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary shrink-0" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}

          {openingHours && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{openingHours}</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between gap-2 mt-auto">
          {rating !== undefined ? (
            <Rating value={rating} reviewCount={reviewCount} />
          ) : (
            <span className="text-xs text-muted-foreground">Unrated</span>
          )}
          {actionButton}
        </div>
      </div>
    </Card>
  );
}
