import Image from "next/image";
import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/shared/rating";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceDisplay } from "@/components/shared/price-display";
import { cn } from "@/lib/utils";

export interface DestinationCardProps {
  id?: string;
  image?: string;
  name: string;
  location?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  priceLevel?: 1 | 2 | 3 | 4;
  favorite?: boolean;
  tags?: string[];
  onFavoriteToggle?: (isFavorite: boolean) => void;
  onClick?: () => void;
  className?: string;
}

export function DestinationCard({
  image,
  name,
  location,
  description,
  rating,
  reviewCount,
  category,
  priceLevel,
  favorite = false,
  tags,
  onFavoriteToggle,
  onClick,
  className,
}: DestinationCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col h-full",
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs font-medium">
            No Image
          </div>
        )}
        <div className="absolute top-3 right-3 z-10">
          <FavoriteButton isFavorite={favorite} onToggle={onFavoriteToggle} />
        </div>
        {category && (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur font-medium">
              {category}
            </Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {name}
            </h3>
            {priceLevel !== undefined && (
              <PriceDisplay priceLevel={priceLevel} className="shrink-0 mt-0.5" />
            )}
          </div>

          {location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}

          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {description}
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between gap-2 mt-auto">
          {rating !== undefined ? (
            <Rating value={rating} reviewCount={reviewCount} />
          ) : (
            <span className="text-xs text-muted-foreground">New destination</span>
          )}

          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
