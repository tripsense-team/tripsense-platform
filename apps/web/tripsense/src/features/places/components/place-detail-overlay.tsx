"use client";

import * as React from "react";
import { MindtripHotelDetailOverlay, placeToMindtripHotel, fetchDirectOffersForPlace, type MindtripHotel } from "@/features/hotels";
import type { Place } from "../types";
import { approvedPhotoGallery } from "../utils/approved-photo";
import { PlaceDetailContent } from "./place-detail-content";

export interface PlaceDetailOverlayProps {
  place: Place;
  isLoadingDetails?: boolean;
  isFavorite?: boolean;
  isAddedToTrip?: boolean;
  onClose: () => void;
  onToggleFavorite?: (placeId: string, isFav: boolean) => void;
  onAddToTrip?: (place: Place) => void;
  isPanelCollapsed?: boolean;
  onTogglePanel?: () => void;
  className?: string;
}

export function PlaceDetailOverlay({
  place,
  isFavorite = false,
  isAddedToTrip = false,
  onClose,
  onToggleFavorite,
  onAddToTrip,
  isPanelCollapsed = false,
  onTogglePanel,
  className,
}: PlaceDetailOverlayProps) {
  const [directBooking, setDirectBooking] = React.useState<{
    hasDirectBooking: true;
    propertyId: string;
    rooms: MindtripHotel["rooms"];
    pricePerNight: number;
    currency: string;
  } | null>(null);

  const displayPhotos = React.useMemo(() => {
    return approvedPhotoGallery(
      place.photoGallery,
      place.primaryPhoto,
      place.photos
    );
  }, [place.photoGallery, place.primaryPhoto, place.photos]);

  const isHotel = React.useMemo(() => {
    const cat = (place.categories || []).join(" ").toLowerCase();
    const name = (place.name || "").toLowerCase();
    return (
      cat.includes("stay") ||
      cat.includes("lodging") ||
      cat.includes("hotel") ||
      cat.includes("resort") ||
      cat.includes("khách sạn") ||
      cat.includes("nhà nghỉ") ||
      cat.includes("homestay") ||
      name.includes("hotel") ||
      name.includes("khách sạn") ||
      name.includes("resort") ||
      name.includes("homestay")
    );
  }, [place.categories, place.name]);

  // Fetch direct booking data from trip-service when this is a hotel place
  React.useEffect(() => {
    if (!isHotel) return;
    let cancelled = false;
    setDirectBooking(null);
    fetchDirectOffersForPlace(
      { id: place.id, name: place.name, city: place.city, district: place.district, address: place.address },
      "",
      "",
      2,
      1
    )
      .then((result) => {
        if (!cancelled) setDirectBooking(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isHotel, place.id, place.name, place.city, place.district, place.address]);

  if (isHotel) {
    const baseHotel = placeToMindtripHotel(place);
    const hotelPhotos =
      displayPhotos.length > 0
        ? displayPhotos.map((p) => p.url)
        : baseHotel.photos;

    // Merge with direct booking data fetched from trip-service (if available)
    const hotelData: MindtripHotel = {
      ...baseHotel,
      photos: hotelPhotos,
      description: place.description || undefined,
      ...(directBooking
        ? {
            id: directBooking.propertyId,
            propertyId: directBooking.propertyId,
            hasDirectBooking: true,
            rooms: directBooking.rooms,
            pricePerNight: directBooking.pricePerNight,
            currency: directBooking.currency,
          }
        : {}),
    };

    return (
      <MindtripHotelDetailOverlay
        hotel={hotelData}
        isFavorite={isFavorite}
        isAddedToTrip={isAddedToTrip}
        onClose={onClose}
        onToggleFavorite={onToggleFavorite}
        onAddToTrip={() => onAddToTrip?.(place)}
        isPanelCollapsed={isPanelCollapsed}
        onTogglePanel={onTogglePanel}
        className={className}
      />
    );
  }

  return (
    <PlaceDetailContent
      place={place}
      isFavorite={isFavorite}
      isAddedToTrip={isAddedToTrip}
      onClose={onClose}
      onToggleFavorite={onToggleFavorite}
      onAddToTrip={onAddToTrip}
      isPanelCollapsed={isPanelCollapsed}
      onTogglePanel={onTogglePanel}
      className={className}
    />
  );
}
