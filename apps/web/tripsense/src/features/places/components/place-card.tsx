"use client";

import * as React from "react";
import Image from "next/image";
import { MapPin, Clock, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPlacePhotoUrl } from "../utils/place-photo";
import type { Place } from "../types";

export interface PlaceCardProps {
  place: Place;
  index?: number;
  isSelected?: boolean;
  onClick?: () => void;
  onViewDetails?: () => void;
  variant?: "vertical" | "horizontal";
  className?: string;
}

export function PlaceCard({
  place,
  index,
  isSelected = false,
  onClick,
  onViewDetails,
  variant = "horizontal",
  className,
}: PlaceCardProps) {
  const photoUrl = getPlacePhotoUrl(place);
  const primaryCategory = place.categories && place.categories.length > 0 ? place.categories[0] : null;

  if (variant === "vertical") {
    return (
      <Card
        onClick={onClick}
        className={cn(
          "group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all cursor-pointer",
          isSelected
            ? "border-primary ring-2 ring-primary/20 shadow-md scale-[1.01]"
            : "border-border shadow-xs hover:border-primary/40 hover:shadow-md",
          className
        )}
      >
        {/* Photo Container */}
        <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={place.name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted/80 text-muted-foreground text-xs font-medium p-4 text-center gap-1.5">
              <MapPin className="h-6 w-6 text-primary/70" />
              <span className="line-clamp-1 font-semibold text-foreground">{place.name}</span>
            </div>
          )}

          {typeof index === "number" && (
            <div className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/80 text-white font-extrabold text-xs shadow-md backdrop-blur-xs">
              {index}
            </div>
          )}

          {primaryCategory && (
            <Badge
              variant="secondary"
              className="absolute top-2.5 left-2.5 bg-background/90 text-foreground backdrop-blur-md border border-border/40 font-medium text-[11px] px-2.5 py-0.5 shadow-2xs capitalize"
            >
              {primaryCategory.replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        {/* Card Details */}
        <div className="p-4 flex flex-col flex-1 justify-between gap-3">
          <div className="space-y-1.5">
            <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {place.name}
            </h3>

            {/* Rating & Reviews */}
            {typeof place.rating === "number" && place.rating > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <div className="flex items-center gap-1 text-amber-500 font-semibold">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{place.rating.toFixed(1)}</span>
                </div>
                {typeof place.userRatingCount === "number" && place.userRatingCount > 0 && (
                  <span className="text-muted-foreground">
                    ({place.userRatingCount.toLocaleString()} đánh giá)
                  </span>
                )}
              </div>
            )}

            {/* Address */}
            {place.address && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-relaxed">{place.address}</span>
              </div>
            )}

            {/* Opening Hours */}
            {place.openingHours && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="line-clamp-1">{place.openingHours}</span>
              </div>
            )}
          </div>

          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              className="w-full rounded-xl text-xs font-semibold h-8 mt-1 hover:bg-primary hover:text-primary-foreground transition-all"
            >
              Xem chi tiết
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Horizontal Variant (Default for List View on Desktop/Split)
  return (
    <Card
      onClick={onClick}
      className={cn(
        "group flex flex-row overflow-hidden rounded-2xl border bg-card transition-all cursor-pointer h-36 w-full",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-md bg-accent/20 scale-[1.01]"
          : "border-border shadow-xs hover:border-primary/40 hover:shadow-md",
        className
      )}
    >
      {/* Photo Container */}
      <div className="relative w-36 sm:w-44 h-full shrink-0 bg-muted overflow-hidden">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={place.name}
            fill
            sizes="176px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-muted to-muted/80 text-muted-foreground text-xs font-medium text-center p-3 gap-1">
            <MapPin className="h-5 w-5 text-primary/70" />
            <span className="line-clamp-1 font-semibold text-foreground text-[11px]">{place.name}</span>
          </div>
        )}

        {typeof index === "number" && (
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/80 text-white font-extrabold text-[10px] shadow-sm backdrop-blur-xs">
            {index}
          </div>
        )}

        {primaryCategory && (
          <Badge
            variant="secondary"
            className="absolute top-2 left-2 bg-background/90 text-foreground backdrop-blur-md border border-border/40 font-medium text-[10px] px-2 py-0.5 shadow-2xs capitalize"
          >
            {primaryCategory.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between overflow-hidden">
        <div className="space-y-1">
          <h4 className="font-bold text-sm sm:text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {place.name}
          </h4>

          {/* Rating */}
          {typeof place.rating === "number" && place.rating > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex items-center gap-1 text-amber-500 font-semibold">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{place.rating.toFixed(1)}</span>
              </div>
              {typeof place.userRatingCount === "number" && place.userRatingCount > 0 && (
                <span className="text-muted-foreground text-[11px]">
                  ({place.userRatingCount.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {/* Address */}
          {place.address && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{place.address}</span>
            </div>
          )}

          {/* Opening Hours */}
          {place.openingHours && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{place.openingHours}</span>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40 mt-1">
          <span className="text-[11px] font-medium text-primary">Đà Nẵng</span>
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              className="h-7 text-xs font-semibold px-2.5 hover:bg-primary hover:text-primary-foreground rounded-lg transition-all"
            >
              Chi tiết
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
