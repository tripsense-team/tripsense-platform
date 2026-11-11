"use client";

import * as React from "react";
import { MindtripHotelDetailOverlay, placeToMindtripHotel, fetchDirectOffersForPlace, type MindtripHotel } from "@/features/hotels";
import {
  RestaurantOverviewCard,
  RentalOverviewCard,
  searchPublicRestaurants,
  searchPublicHotels,
  searchPublicRentals,
  type PublicRestaurantListingDto,
  type PublicHotelListingDto,
  type PublicRentalListingDto,
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

function getCoreBusinessName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(nha hang|quan an|quan|tiem|com|pho|bun|banh|restaurant|cafe|ca phe|bar|pub|bistro|kitchen|eatery|cho thue|thue xe|tu lai|rental|car|motorbike|bike)\b/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function findMatchingPartnerListing<T extends { displayName: string; placeId?: string | null }>(
  results: T[],
  place: Pick<Place, "id" | "providerPlaceId" | "name">,
): T | null {
  const byPlaceId = results.find(
    (r) => r.placeId && (r.placeId === place.id || r.placeId === place.providerPlaceId),
  );
  if (byPlaceId) return byPlaceId;

  const corePlaceName = getCoreBusinessName(place.name);
  const normPlaceName = place.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  return (
    results.find((r) => {
      const coreRName = getCoreBusinessName(r.displayName);
      const normRName = r.displayName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

      if (normPlaceName.length >= 4 && (normRName.includes(normPlaceName) || normPlaceName.includes(normRName))) {
        return true;
      }
      if (corePlaceName.length >= 3 && coreRName.length >= 3) {
        return corePlaceName === coreRName || corePlaceName.includes(coreRName) || coreRName.includes(corePlaceName);
      }
      return false;
    }) ?? null
  );
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
    businessId?: string;
    ownerUserId?: string;
    rooms: MindtripHotel["rooms"];
    pricePerNight: number;
    currency: string;
  } | null>(null);

  const [hotelPartner, setHotelPartner] = React.useState<PublicHotelListingDto | null>(null);

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

  // Resolve hotel partner business from trip-service
  React.useEffect(() => {
    if (!isHotel) return;
    let cancelled = false;
    setHotelPartner(null);

    searchPublicHotels(place.name)
      .then((results) => {
        if (cancelled) return;
        setHotelPartner(findMatchingPartnerListing(results, place));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isHotel, place]);

  const isRental = React.useMemo(() => {
    if (isHotel) return false;
    const cat = (place.categories || []).join(" ").toLowerCase();
    const name = (place.name || "").toLowerCase();
    return (
      cat.includes("rental") ||
      cat.includes("motorbike") ||
      cat.includes("scooter") ||
      cat.includes("bicycle") ||
      cat.includes("bike") ||
      cat.includes("camping") ||
      cat.includes("kayak") ||
      cat.includes("sup") ||
      cat.includes("transportation_service") ||
      cat.includes("thuê xe") ||
      cat.includes("cho thuê") ||
      name.includes("thuê xe") ||
      name.includes("cho thuê") ||
      name.includes("tự lái") ||
      name.includes("car rental") ||
      name.includes("motorbike rental") ||
      name.includes("bike rental") ||
      name.includes("scooter rental")
    );
  }, [isHotel, place.categories, place.name]);

  const [rentalPartner, setRentalPartner] = React.useState<PublicRentalListingDto | null>(null);
  const [loadingRental, setLoadingRental] = React.useState(false);

  React.useEffect(() => {
    if (!isRental) return;
    let cancelled = false;
    setLoadingRental(true);
    setRentalPartner(null);

    searchPublicRentals(place.name)
      .then((results) => {
        if (cancelled) return;
        setRentalPartner(findMatchingPartnerListing(results, place));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRental(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isRental, place]);

  const isRestaurant = React.useMemo(() => {
    if (isHotel || isRental) return false;
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
  }, [isHotel, isRental, place.categories, place.name]);

  const [restaurantPartner, setRestaurantPartner] = React.useState<PublicRestaurantListingDto | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = React.useState(false);

  React.useEffect(() => {
    if (isHotel || isRental) return;
    let cancelled = false;
    setLoadingRestaurant(true);
    setRestaurantPartner(null);

    searchPublicRestaurants(place.name)
      .then((results) => {
        if (cancelled) return;
        setRestaurantPartner(findMatchingPartnerListing(results, place));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRestaurant(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isHotel, isRental, place]);

  if (isHotel) {
    const baseHotel = placeToMindtripHotel(place);
    const hotelPhotos =
      displayPhotos.length > 0
        ? displayPhotos.map((p) => p.url)
        : baseHotel.photos;

    // Merge with direct booking data and verified partner info from trip-service
    const resolvedOwnerUserId = directBooking?.ownerUserId || hotelPartner?.ownerUserId;
    const resolvedBusinessId = directBooking?.businessId || hotelPartner?.id;
    const resolvedPropertyId = directBooking?.propertyId || hotelPartner?.propertyId;

    const hotelData: MindtripHotel = {
      ...baseHotel,
      photos: hotelPhotos,
      description: place.description || undefined,
      ownerUserId: resolvedOwnerUserId,
      businessId: resolvedBusinessId,
      propertyId: resolvedPropertyId,
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
        hotelPartner={hotelPartner}
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
          isRental ? (
            <RentalOverviewCard
              rental={rentalPartner}
              loading={loadingRental}
              placeName={place.name}
              placeAddress={place.address}
              placePhone={place.phone}
            />
          ) : isRestaurant ? (
            <RestaurantOverviewCard
              restaurant={restaurantPartner}
              loading={loadingRestaurant}
              placeName={place.name}
              placeAddress={place.address}
              placePhone={place.phone}
            />
          ) : undefined
        }
      />
    </>
  );
}
