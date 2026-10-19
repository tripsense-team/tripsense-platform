"use client";

import * as React from "react";
import { useTranslation } from "@/i18n";
import { MindtripPlaceCard } from "@/features/places/components/mindtrip-place-card";
import type { Place } from "@/features/places/types";
import type { MindtripHotel } from "../types";
import { getExistingHotelPhotos, loadHotelPhotoGallery } from "../services/hotel-photo-enrichment";

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
  const visibilityRef = React.useRef<HTMLDivElement>(null);
  const [loadedPhotos, setLoadedPhotos] = React.useState(hotel.photoGallery ?? []);

  React.useEffect(() => {
    if (getExistingHotelPhotos(hotel).length > 0) return;
    const element = visibilityRef.current;
    if (!element) return;

    let active = true;
    let requested = false;
    const requestPhotos = () => {
      if (requested) return;
      requested = true;
      void loadHotelPhotoGallery(hotel).then((photos) => {
        if (active && photos.length > 0) setLoadedPhotos(photos);
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      requestPhotos();
    } else {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          requestPhotos();
          observer.disconnect();
        }
      }, { rootMargin: "200px" });
      observer.observe(element);
      return () => {
        active = false;
        observer.disconnect();
      };
    }

    return () => { active = false; };
  }, [hotel]);

  const place: Place = React.useMemo(() => {
    const photoGallery = loadedPhotos.length > 0 ? loadedPhotos : getExistingHotelPhotos(hotel);
    const photos = photoGallery.map((photo) => photo.url);

    return {
      id: hotel.placeId || hotel.id,
      name: hotel.name,
      rating: hotel.rating,
      userRatingCount: hotel.reviewCount,
      categories: [hotel.category || "Hotel"],
      district: hotel.district,
      city: hotel.city || hotel.destination,
      address: hotel.address,
      phone: hotel.phone,
      website: hotel.website,
      description: hotel.description,
      photos,
      primaryPhoto: photoGallery[0],
      photoGallery,
    };
  }, [hotel, loadedPhotos]);

  const priceLabel = React.useMemo(() => {
    if (hotel.hasDirectBooking && hotel.pricePerNight) {
      return (
        <p className="text-xs sm:text-sm text-foreground font-semibold pt-0.5">
          <span className="font-bold">
            {new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(hotel.pricePerNight)}{" "}
            {hotel.currency || "US$"}
          </span>{" "}
          <span className="text-muted-foreground font-normal">
            {locale === "vi" ? "đêm" : "night"}
          </span>
        </p>
      );
    }
    return (
      <p className="text-xs text-muted-foreground font-medium pt-0.5">
        {locale === "vi" ? "Liên hệ đặt phòng" : "Contact for rates"}
      </p>
    );
  }, [hotel.hasDirectBooking, hotel.pricePerNight, hotel.currency, locale]);

  return (
    <div ref={visibilityRef}>
      <MindtripPlaceCard
        place={place}
        isSelected={isSelected}
        isFavorite={isFavorite}
        isAddedToTrip={isAddedToTrip}
        onClick={onClick}
        onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(hotel.id, !isFavorite) : undefined}
        onAddToTrip={onAddToTrip ? () => onAddToTrip(hotel) : undefined}
        priceLabel={priceLabel}
        className={className}
      />
    </div>
  );
}
