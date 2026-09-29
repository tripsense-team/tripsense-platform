"use client";

import * as React from "react";
import Image from "next/image";
import {
  Heart,
  PlusCircle,
  CheckCircle2,
  Star,
  Hotel as HotelIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import type { MindtripHotel } from "../types";

export interface MindtripHotelCardProps {
  hotel: MindtripHotel;
  isSelected?: boolean;
  isFavorite?: boolean;
  isAddedToTrip?: boolean;
  onClick?: () => void;
  onToggleFavorite?: (hotelId: string, isFav: boolean) => void;
  onAddToTrip?: (hotel: MindtripHotel) => void;
  className?: string;
}

export function MindtripHotelCard({
  hotel,
  isSelected = false,
  isFavorite = false,
  isAddedToTrip = false,
  onClick,
  onToggleFavorite,
  onAddToTrip,
  className,
}: MindtripHotelCardProps) {
  const { locale } = useTranslation();
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const [favState, setFavState] = React.useState(isFavorite);
  const [addedState, setAddedState] = React.useState(isAddedToTrip);

  const photos = hotel.photos.length > 0 ? hotel.photos : ["/placeholder-hotel.jpg"];
  const currentPhoto = photos[Math.min(photoIndex, photos.length - 1)];

  const displayLocation = [hotel.district, hotel.city].filter(Boolean).join(", ") || hotel.address;

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handleToggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !favState;
    setFavState(next);
    onToggleFavorite?.(hotel.id, next);
  };

  const handleAddTrip = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !addedState;
    setAddedState(next);
    onAddToTrip?.(hotel);
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group flex flex-col shrink-0 w-full cursor-pointer select-none outline-hidden",
        className
      )}
    >
      {/* 1. Photo Frame with Carousel Dots & Top Right Actions */}
      <div
        className={cn(
          "relative aspect-[4/3] w-full min-h-[180px] shrink-0 overflow-hidden rounded-2xl bg-muted transition-all duration-200 select-none border border-border/80 shadow-xs",
          isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md" : ""
        )}
      >
        <Image
          src={currentPhoto}
          alt={hotel.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Carousel Prev / Next Buttons */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevPhoto}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7.5 w-7.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 duration-200 shadow-md active:scale-95 z-20 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={handleNextPhoto}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7.5 w-7.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-xs flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 duration-200 shadow-md active:scale-95 z-20 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* Top-Right Action Buttons: Heart + Plus Circle */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-20">
          {/* Heart */}
          <button
            type="button"
            onClick={handleToggleFav}
            aria-label="Save hotel"
            className="p-1 text-white hover:scale-110 active:scale-90 transition-transform cursor-pointer"
          >
            <Heart
              className={cn(
                "h-6 w-6 transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]",
                favState
                  ? "fill-rose-500 text-rose-500 stroke-rose-500"
                  : "text-white fill-none stroke-[2]"
              )}
            />
          </button>

          {/* Plus / Add to Trip */}
          <button
            type="button"
            onClick={handleAddTrip}
            aria-label="Add hotel to trip"
            className="p-1 text-white hover:scale-110 active:scale-90 transition-transform cursor-pointer"
          >
            {addedState ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-400 fill-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] stroke-[2]" />
            ) : (
              <PlusCircle className="h-6 w-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] stroke-[2]" />
            )}
          </button>
        </div>

        {/* Center Bottom Carousel Dots */}
        {photos.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 pointer-events-none">
            {photos.slice(0, 5).map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 drop-shadow-sm",
                  idx === photoIndex ? "w-2.5 bg-white" : "w-1.5 bg-white/60"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* 2. Hotel Details (Adapts smoothly to both Light & Dark themes) */}
      <div className="pt-2.5 space-y-1 text-left">
        {/* Row 1: Title and Star Rating */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[15px] sm:text-base leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors flex-1">
            {hotel.name}
          </h3>

          {typeof hotel.rating === "number" && hotel.rating > 0 && (
            <div className="flex items-center gap-1 text-[13px] sm:text-sm shrink-0 font-semibold pt-0.5 text-foreground">
              <Star className="h-3.5 w-3.5 fill-foreground text-foreground shrink-0" />
              <span>{locale === "vi" ? hotel.rating.toFixed(1).replace(".", ",") : hotel.rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Row 2: Category Hotel with Icon */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HotelIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span>{hotel.category}</span>
        </div>

        {/* Row 3: Location */}
        <p className="text-xs text-muted-foreground line-clamp-1">
          {displayLocation}
        </p>

        {/* Row 4: Nightly Price or Truthful Booking Status */}
        {hotel.hasDirectBooking && hotel.pricePerNight ? (
          <p className="text-xs sm:text-sm text-foreground font-semibold pt-0.5">
            <span className="font-bold">{hotel.pricePerNight} {hotel.currency || "US$"}</span>{" "}
            <span className="text-muted-foreground font-normal">{locale === "vi" ? "đêm" : "night"}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground font-medium pt-0.5">
            {locale === "vi" ? "Liên hệ đặt phòng" : "Contact for rates"}
          </p>
        )}
      </div>
    </div>
  );
}
