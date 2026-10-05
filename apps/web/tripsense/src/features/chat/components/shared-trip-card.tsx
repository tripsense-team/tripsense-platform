"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, MapPin, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedTripPreview } from "../types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface SharedTripCardProps {
  trip: SharedTripPreview;
  className?: string;
}

export function SharedTripCard({ trip, className }: SharedTripCardProps) {
  const { t } = useTranslation();

  if (trip.available === false) {
    return <div className={cn("rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground",className)}>
      {t("chat.sharedTrip.unavailable")}
    </div>;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md transition-all group max-w-sm",
        className
      )}
    >
      {/* Cover Image */}
      {trip.coverImage && <div className="relative h-36 w-full overflow-hidden bg-muted">
        <img
          src={trip.coverImage}
          alt={trip.title}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-background/90 backdrop-blur-xs text-xs font-bold text-primary shadow-xs">
          <Compass className="h-3.5 w-3.5" />
          <span>{t("chat.sharedTrip.tag")}</span>
        </div>
      </div>}

      {/* Details */}
      <div className="p-4 space-y-2.5">
        <h4 className="font-bold text-base text-foreground leading-snug line-clamp-2">
          {trip.title}
        </h4>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{trip.location}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {t("chat.sharedTrip.duration", {
                days: trip.durationDays,
                nights: trip.durationNights,
              })}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50 flex justify-end">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-3.5 text-xs text-primary font-bold bg-primary/10 hover:bg-primary/20 hover:text-primary gap-1.5 rounded-full"
          >
            <Link href={`/community/posts/${trip.id}`}>
              <span>{t("chat.sharedTrip.viewTrip")}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
