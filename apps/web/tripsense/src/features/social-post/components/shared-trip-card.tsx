"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  DollarSign,
  Compass,
  Copy,
  ExternalLink,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SharedTripSummary } from "../types";
import { cn } from "@/lib/utils";

interface SharedTripCardProps {
  trip: SharedTripSummary;
  className?: string;
  isCompact?: boolean;
}

export function SharedTripCard({
  trip,
  className,
  isCompact = false,
}: SharedTripCardProps) {
  const router = useRouter();
  const [cloning, setCloning] = React.useState(false);
  const [cloned, setCloned] = React.useState(false);

  const formatDuration = React.useMemo(() => {
    if (trip.durationDays) {
      return `${trip.durationDays} ngày ${Math.max(1, trip.durationDays - 1)} đêm`;
    }
    if (trip.startDate && trip.endDate) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return `${diffDays} ngày ${Math.max(1, diffDays - 1)} đêm`;
    }
    return null;
  }, [trip.durationDays, trip.startDate, trip.endDate]);

  const formatBudget = React.useMemo(() => {
    if (!trip.budgetAmount) return null;
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: trip.budgetCurrency || "VND",
      maximumFractionDigits: 0,
    }).format(trip.budgetAmount);
  }, [trip.budgetAmount, trip.budgetCurrency]);

  const handleCloneTrip = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cloning || cloned) return;

    setCloning(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCloned(true);
    } finally {
      setCloning(false);
    }
  };

  const handleViewTrip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/trips/${trip.id}`);
  };

  return (
    <div
      onClick={handleViewTrip}
      className={cn(
        "group/trip relative overflow-hidden rounded-2xl border border-border bg-muted/40 transition-all duration-200 hover:border-primary/40 hover:bg-muted/60 hover:shadow-xs cursor-pointer",
        isCompact ? "p-3" : "p-4",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Cover Thumbnail */}
        {trip.coverImageUrl ? (
          <div className="relative h-32 sm:h-28 sm:w-40 shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image
              src={trip.coverImageUrl}
              alt={trip.name}
              fill
              className="object-cover transition-transform duration-300 group-hover/trip:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur-xs font-semibold px-1.5 py-0.5"
            >
              Hành trình
            </Badge>
          </div>
        ) : (
          <div className="relative h-32 sm:h-28 sm:w-40 shrink-0 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/15 via-primary/10 to-indigo-500/15 border border-primary/10 text-primary shadow-inner">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background/80 shadow-xs backdrop-blur-xs">
              <Compass className="h-5 w-5 text-primary" />
            </div>
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 text-[10px] bg-background/90 backdrop-blur-xs font-semibold px-1.5 py-0.5 shadow-xs"
            >
              Hành trình
            </Badge>
          </div>
        )}

        {/* Details & Action */}
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{trip.destinationName}</span>
              </span>
              {formatDuration && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  • <Calendar className="h-3 w-3 shrink-0" />
                  <span>{formatDuration}</span>
                </span>
              )}
            </div>

            <h4 className="text-base font-bold text-foreground line-clamp-1 group-hover/trip:text-primary transition-colors">
              {trip.name}
            </h4>

            {formatBudget && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <span>Dự toán: {formatBudget}</span>
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleViewTrip}
              className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-lg gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Xem chi tiết
            </Button>

            <Button
              type="button"
              variant={cloned ? "secondary" : "outline"}
              size="sm"
              onClick={handleCloneTrip}
              disabled={cloning}
              className="h-8 px-3 text-xs font-semibold rounded-lg gap-1.5 border-border hover:bg-primary hover:text-primary-foreground transition-all"
            >
              {cloned ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Đã lưu lịch trình
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {cloning ? "Đang lưu..." : "Lưu lịch trình"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
