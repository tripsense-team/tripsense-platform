"use client";

import * as React from "react";
import { MindtripHotelDetailOverlay, placeToMindtripHotel, fetchDirectOffersForPlace, type MindtripHotel } from "@/features/hotels";
import {
  RestaurantOverviewCard,
  RestaurantReservationDialog,
  searchPublicRestaurants,
  type PublicRestaurantListingDto,
} from "@/features/partner";
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

  const isRestaurant = React.useMemo(() => {
    if (isHotel) return false;
    const cat = (place.categories || []).join(" ").toLowerCase();
    const name = (place.name || "").toLowerCase();
    return (
      cat.includes("food") ||
      cat.includes("restaurant") ||
      cat.includes("quán") ||
      cat.includes("ăn") ||
      cat.includes("ẩm thực") ||
      cat.includes("bún") ||
      cat.includes("phở") ||
      cat.includes("mì") ||
      cat.includes("cơm") ||
      cat.includes("bánh") ||
      cat.includes("lẩu") ||
      cat.includes("nướng") ||
      cat.includes("hải sản") ||
      cat.includes("cà phê") ||
      cat.includes("cafe") ||
      cat.includes("coffee") ||
      cat.includes("drink") ||
      cat.includes("tea") ||
      cat.includes("bar") ||
      cat.includes("pub") ||
      name.includes("food") ||
      name.includes("kitchen") ||
      name.includes("quán") ||
      name.includes("nhà hàng") ||
      name.includes("restaurant") ||
      name.includes("ẩm thực") ||
      name.includes("cơm") ||
      name.includes("phở") ||
      name.includes("bún") ||
      name.includes("mì") ||
      name.includes("bánh") ||
      name.includes("lẩu") ||
      name.includes("nướng") ||
      name.includes("bbq") ||
      name.includes("cafe") ||
      name.includes("coffee") ||
      name.includes("cà phê") ||
      name.includes("tiệm") ||
      name.includes("chè") ||
      name.includes("trà") ||
      name.includes("tea") ||
      name.includes("pizza") ||
      name.includes("burger") ||
      name.includes("buffet") ||
      name.includes("seafood") ||
      name.includes("hải sản")
    );
  }, [isHotel, place.categories, place.name]);

  const [restaurantPartner, setRestaurantPartner] = React.useState<PublicRestaurantListingDto | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = React.useState(false);
  const [reservationOpen, setReservationOpen] = React.useState(false);

  React.useEffect(() => {
    if (isHotel) return;
    let cancelled = false;
    setLoadingRestaurant(true);
    setRestaurantPartner(null);

    searchPublicRestaurants(place.name)
      .then((results) => {
        if (cancelled) return;
        const normPlaceName = place.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        let match = results.find((r) => {
          const normRName = r.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
          return normRName.includes(normPlaceName) || normPlaceName.includes(normRName);
        });

        if (match) {
          setRestaurantPartner(match);
        } else {
          // If query with place.name did not return a match, fetch all public restaurants to fuzzy match
          searchPublicRestaurants()
            .then((all) => {
              if (cancelled) return;
              const fuzzy = all.find((r) => {
                const normRName = r.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
                return (
                  normRName.includes(normPlaceName) ||
                  normPlaceName.includes(normRName) ||
                  (normPlaceName.length >= 6 && normRName.length >= 6 && normPlaceName.slice(0, 6) === normRName.slice(0, 6))
                );
              });
              setRestaurantPartner(fuzzy || null);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRestaurant(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isHotel, place.name]);

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
    <>
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
        overviewAside={
          isRestaurant ? (
            <RestaurantOverviewCard
              restaurant={restaurantPartner}
              loading={loadingRestaurant}
              placeName={place.name}
              placeAddress={place.address}
              placePhone={place.phone}
              onOpenReservation={() => setReservationOpen(true)}
            />
          ) : undefined
        }
      />

      {restaurantPartner && (
        <RestaurantReservationDialog
          businessId={restaurantPartner.id}
          restaurantName={restaurantPartner.displayName}
          open={reservationOpen}
          onOpenChange={setReservationOpen}
        />
      )}
    </>
  );
}
