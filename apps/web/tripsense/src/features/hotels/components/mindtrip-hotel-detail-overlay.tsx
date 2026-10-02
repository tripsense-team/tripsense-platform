"use client";

import * as React from "react";
import {
  Bell,
  BellRing,
  Info,
  Phone,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { PlaceDetailContent } from "@/features/places/components/place-detail-content";
import type { Place } from "@/features/places/types";
import type { MindtripHotel } from "../types";
import { MindtripBookStayModal } from "./mindtrip-book-stay-modal";
import { MindtripAvailableRoomsView } from "./mindtrip-available-rooms-view";
import { fetchDirectOffersForPlace } from "../services/hotel-service-adapter";

export interface MindtripHotelDetailOverlayProps {
  hotel: MindtripHotel;
  isFavorite?: boolean;
  isAddedToTrip?: boolean;
  onClose: () => void;
  onToggleFavorite?: (hotelId: string, isFav: boolean) => void;
  onAddToTrip?: (hotel: MindtripHotel) => void;
  isPanelCollapsed?: boolean;
  onTogglePanel?: () => void;
  className?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guestCount?: number;
  quantity?: number;
}

export function MindtripHotelDetailOverlay({
  hotel,
  isFavorite = false,
  isAddedToTrip = false,
  onClose,
  onToggleFavorite,
  onAddToTrip,
  isPanelCollapsed = false,
  onTogglePanel,
  className,
  checkInDate: propCheckIn,
  checkOutDate: propCheckOut,
  guestCount: propGuestCount,
  quantity = 1,
}: MindtripHotelDetailOverlayProps) {
  const { locale } = useTranslation();

  const [isBookModalOpen, setIsBookModalOpen] = React.useState(false);
  const [isAvailableRoomsViewOpen, setIsAvailableRoomsViewOpen] = React.useState(false);
  const [priceAlertActive, setPriceAlertActive] = React.useState(false);

  const [directBooking, setDirectBooking] = React.useState<{
    hasDirectBooking: true;
    propertyId: string;
    rooms: MindtripHotel["rooms"];
    pricePerNight: number;
    currency: string;
  } | null>(() => {
    if (hotel.hasDirectBooking && hotel.pricePerNight) {
      return {
        hasDirectBooking: true,
        propertyId: hotel.propertyId || hotel.id,
        rooms: hotel.rooms,
        pricePerNight: hotel.pricePerNight,
        currency: hotel.currency || "VND",
      };
    }
    return null;
  });

  // Dynamic default dates (tomorrow and day-after)
  const { dynamicCheckIn, dynamicCheckOut } = React.useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return {
      dynamicCheckIn: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`,
      dynamicCheckOut: `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, "0")}-${String(dayAfter.getDate()).padStart(2, "0")}`,
    };
  }, []);

  const activeCheckIn = propCheckIn || dynamicCheckIn;
  const activeCheckOut = propCheckOut || dynamicCheckOut;
  const activeGuests = propGuestCount ?? 2;

  // Resolve direct booking offer dynamically if not already populated on hotel prop
  React.useEffect(() => {
    if (hotel.hasDirectBooking && hotel.pricePerNight) {
      setDirectBooking({
        hasDirectBooking: true,
        propertyId: hotel.propertyId || hotel.id,
        rooms: hotel.rooms,
        pricePerNight: hotel.pricePerNight,
        currency: hotel.currency || "VND",
      });
      return;
    }

    let cancelled = false;
    void fetchDirectOffersForPlace(
      {
        id: hotel.id,
        name: hotel.name,
        city: hotel.city || hotel.destination,
        district: hotel.district,
        address: hotel.address,
      },
      activeCheckIn,
      activeCheckOut,
      activeGuests,
      quantity
    ).then((result) => {
      if (!cancelled && result) {
        setDirectBooking(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    hotel.id,
    hotel.name,
    hotel.city,
    hotel.destination,
    hotel.district,
    hotel.address,
    hotel.hasDirectBooking,
    hotel.pricePerNight,
    hotel.rooms?.length,
    hotel.currency,
    hotel.propertyId,
    activeCheckIn,
    activeCheckOut,
    activeGuests,
    quantity,
  ]);

  const isDirectBookable = Boolean(directBooking || (hotel.hasDirectBooking && hotel.pricePerNight));
  const effectivePrice = directBooking?.pricePerNight ?? hotel.pricePerNight;
  const effectiveCurrency = directBooking?.currency ?? hotel.currency ?? "VND";

  const currentHotelForBooking: MindtripHotel = React.useMemo(() => {
    if (!directBooking) return hotel;
    return {
      ...hotel,
      hasDirectBooking: true,
      propertyId: directBooking.propertyId,
      pricePerNight: directBooking.pricePerNight,
      currency: directBooking.currency,
      rooms: directBooking.rooms,
    };
  }, [hotel, directBooking]);

  const place: Place = React.useMemo(() => {
    const photos = hotel.photos.length > 0 ? hotel.photos : [];
    const photoGallery = photos.map((url) => ({
      url,
      source: "database",
      attribution: [],
      fetchedAt: new Date().toISOString(),
      displayApproved: true,
    }));

    return {
      id: hotel.id,
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
      reviews: hotel.reviews?.map((r) => ({
        authorName: r.authorName,
        profilePhotoUrl: r.avatarUrl,
        rating: r.rating,
        text: r.text,
        relativeTimeDescription: r.stayDuration || r.date,
      })),
    };
  }, [hotel]);

  // If user chose to see Available Rooms
  if (isAvailableRoomsViewOpen) {
    return (
      <div className={cn("absolute inset-0 z-30 bg-background overflow-y-auto select-none", className)}>
        <MindtripAvailableRoomsView
          hotel={currentHotelForBooking}
          onBack={() => setIsAvailableRoomsViewOpen(false)}
          checkInDate={activeCheckIn}
          checkOutDate={activeCheckOut}
          guestCount={activeGuests}
          quantity={quantity}
        />
      </div>
    );
  }

  // Right column booking / contact card
  const overviewAside = (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
      {isDirectBookable && effectivePrice ? (
        <>
          {/* Price Display */}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-foreground">
                {new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(effectivePrice)}{" "}
                {effectiveCurrency || "US$"}
              </span>
              <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                {locale === "vi" ? "mỗi đêm" : "per night"}
              </span>
            </div>
          </div>

          {/* 3-Segment Date & Guest Picker Box */}
          <div className="grid grid-cols-2 gap-px rounded-2xl border border-border bg-muted/30 overflow-hidden text-xs">
            <div className="bg-card p-3 space-y-0.5">
              <span className="text-[11px] text-muted-foreground block font-medium">Check in</span>
              <span className="font-semibold text-foreground block text-sm">{activeCheckIn}</span>
            </div>
            <div className="bg-card p-3 space-y-0.5">
              <span className="text-[11px] text-muted-foreground block font-medium">Check out</span>
              <span className="font-semibold text-foreground block text-sm">{activeCheckOut}</span>
            </div>
            <div className="col-span-2 bg-card p-3 space-y-0.5 border-t border-border">
              <span className="text-[11px] text-muted-foreground block font-medium">Guests</span>
              <span className="font-semibold text-foreground block text-sm">
                {activeGuests} {activeGuests === 1 ? (locale === "vi" ? "khách" : "adult") : locale === "vi" ? "khách" : "adults"}
              </span>
            </div>
          </div>

          {/* Primary Button: Check availability */}
          <button
            type="button"
            onClick={() => setIsBookModalOpen(true)}
            className="w-full py-3.5 px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide transition-all shadow-xs active:scale-[0.98] cursor-pointer text-center"
          >
            {locale === "vi" ? "Kiểm tra phòng trống" : "Check availability"}
          </button>

          {/* Secondary Button: Set price alert */}
          <button
            type="button"
            onClick={() => setPriceAlertActive((prev) => !prev)}
            className={cn(
              "w-full py-3 px-6 rounded-full border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer",
              priceAlertActive
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                : "border-border bg-card hover:bg-muted text-foreground"
            )}
          >
            {priceAlertActive ? (
              <>
                <BellRing className="h-3.5 w-3.5" />
                <span>{locale === "vi" ? "Đã bật thông báo giá" : "Price alert enabled"}</span>
              </>
            ) : (
              <>
                <Bell className="h-3.5 w-3.5" />
                <span>{locale === "vi" ? "Đặt thông báo giá" : "Set price alert"}</span>
              </>
            )}
          </button>
        </>
      ) : (
        /* Truthful Online Booking Not Yet Enabled State */
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-sm">
            <Info className="h-4 w-4 shrink-0" />
            <span>{locale === "vi" ? "Chưa kích hoạt đặt phòng online" : "Online booking not yet enabled"}</span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {locale === "vi"
              ? "Khách sạn này chưa tích hợp giỏ phòng trực tuyến với TripSense. Quý khách vui lòng liên hệ trực tiếp số điện thoại để kiểm tra giá và đặt phòng."
              : "This property has not yet linked online inventory with TripSense. Please contact the front desk directly for rates and reservations."}
          </p>

          {hotel.phone && (
            <a
              href={`tel:${hotel.phone}`}
              className="w-full py-3 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <Phone className="h-4 w-4" />
              <span>{locale === "vi" ? `Gọi đặt phòng: ${hotel.phone}` : `Call to reserve: ${hotel.phone}`}</span>
            </a>
          )}

          <div className="pt-2 border-t border-border space-y-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.address || ""}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-full border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>{locale === "vi" ? "Xem chỉ đường Google Maps" : "Get directions on Google Maps"}</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );

  // Amenities section (rendered when hotel has amenities)
  const hasAmenities = Boolean(
    (hotel.amenities?.popular && hotel.amenities.popular.length > 0) ||
      (hotel.amenities?.room && hotel.amenities.room.length > 0) ||
      (hotel.amenities?.services && hotel.amenities.services.length > 0)
  );

  const amenitiesSection = hasAmenities ? (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">
        {locale === "vi" ? "Tiện nghi & Dịch vụ" : "Amenities"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {hotel.amenities?.popular && (
          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Popular amenities
            </span>
            <ul className="space-y-2 text-xs text-foreground/90">
              {hotel.amenities.popular.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hotel.amenities?.room && (
          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Room features
            </span>
            <ul className="space-y-2 text-xs text-foreground/90">
              {hotel.amenities.room.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hotel.amenities?.services && (
          <div className="space-y-3 p-4 rounded-2xl bg-muted/30 border border-border">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Services
            </span>
            <ul className="space-y-2 text-xs text-foreground/90">
              {hotel.amenities.services.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <PlaceDetailContent
        place={place}
        isFavorite={isFavorite}
        isAddedToTrip={isAddedToTrip}
        onClose={onClose}
        onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(hotel.id, !isFavorite) : undefined}
        onAddToTrip={onAddToTrip ? () => onAddToTrip(hotel) : undefined}
        isPanelCollapsed={isPanelCollapsed}
        onTogglePanel={onTogglePanel}
        className={className}
        overviewAside={overviewAside}
        amenitiesSection={amenitiesSection}
        categoryLabel={hotel.category || "Hotel"}
      />

      {/* Book Your Stay Popover Modal */}
      <MindtripBookStayModal
        hotel={currentHotelForBooking}
        isOpen={isBookModalOpen}
        onClose={() => setIsBookModalOpen(false)}
        onChooseRoom={() => {
          setIsBookModalOpen(false);
          setIsAvailableRoomsViewOpen(true);
        }}
        checkInDate={activeCheckIn}
        checkOutDate={activeCheckOut}
        guestCount={activeGuests}
      />
    </>
  );
}
