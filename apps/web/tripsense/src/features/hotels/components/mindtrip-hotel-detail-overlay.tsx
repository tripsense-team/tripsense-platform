"use client";

import * as React from "react";
import Image from "next/image";
import {
  X,
  Maximize2,
  Heart,
  Plus,
  Check,
  Share2,
  Headphones,
  MoreHorizontal,
  Star,
  MapPin,
  ChevronRight,
  Phone,
  Bell,
  BellRing,
  Navigation,
  ExternalLink,
  Compass,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import type { MindtripHotel, HotelRoomData } from "../types";
import { MindtripBookStayModal } from "./mindtrip-book-stay-modal";
import { MindtripAvailableRoomsView } from "./mindtrip-available-rooms-view";

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
}: MindtripHotelDetailOverlayProps) {
  const { t, locale } = useTranslation();

  const [activeTab, setActiveTab] = React.useState<"overview" | "amenities" | "reviews" | "location">("overview");
  const [isBookModalOpen, setIsBookModalOpen] = React.useState(false);
  const [isAvailableRoomsViewOpen, setIsAvailableRoomsViewOpen] = React.useState(false);
  const [priceAlertActive, setPriceAlertActive] = React.useState(false);
  const [favState, setFavState] = React.useState(isFavorite);
  const [addedState, setAddedState] = React.useState(isAddedToTrip);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const overviewRef = React.useRef<HTMLDivElement | null>(null);
  const amenitiesRef = React.useRef<HTMLDivElement | null>(null);
  const reviewsRef = React.useRef<HTMLDivElement | null>(null);
  const locationRef = React.useRef<HTMLDivElement | null>(null);

  // Dynamic default dates (tomorrow and day-after)
  const { dynamicCheckIn, dynamicCheckOut } = React.useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const formatter = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
      day: "numeric",
      month: "short",
    });
    return {
      dynamicCheckIn: formatter.format(tomorrow),
      dynamicCheckOut: formatter.format(dayAfter),
    };
  }, [locale]);

  const activeCheckIn = propCheckIn || dynamicCheckIn;
  const activeCheckOut = propCheckOut || dynamicCheckOut;
  const activeGuests = propGuestCount ?? 1;

  const displayLocation = [hotel.district, hotel.city].filter(Boolean).join(", ") || hotel.address;

  const photos = hotel.photos.length >= 5 ? hotel.photos : [
    hotel.photos[0] || "https://images.unsplash.com/photo-1540555700478-4be289fbecef",
    hotel.photos[1] || "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
    hotel.photos[2] || "https://images.unsplash.com/photo-1571896349842-33c89424de2d",
    hotel.photos[3] || "https://images.unsplash.com/photo-1582719508461-905c673771fd",
    hotel.photos[4] || "https://images.unsplash.com/photo-1566073771259-6a8506099945",
  ];

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: hotel.name,
        text: `${hotel.name} - ${displayLocation}`,
        url: window.location.href,
      }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleAudioGuide = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const textToSpeak = hotel.description || `${hotel.name} located at ${displayLocation}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = locale === "vi" ? "vi-VN" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };


  const handleTabClick = (tab: "overview" | "amenities" | "reviews" | "location") => {
    setActiveTab(tab);
    const container = scrollRef.current;
    if (!container) return;

    const el =
      tab === "overview"
        ? overviewRef.current
        : tab === "amenities"
        ? amenitiesRef.current
        : tab === "reviews"
        ? reviewsRef.current
        : locationRef.current;

    if (el) {
      container.scrollTo({
        top: Math.max(0, el.offsetTop - 120),
        behavior: "smooth",
      });
    }
  };

  // If user chose to see Available Rooms
  if (isAvailableRoomsViewOpen) {
    return (
      <div className={cn("absolute inset-0 z-30 bg-background overflow-y-auto select-none", className)}>
        <MindtripAvailableRoomsView
          hotel={hotel}
          onBack={() => setIsAvailableRoomsViewOpen(false)}
          checkInDate={activeCheckIn}
          checkOutDate={activeCheckOut}
          guestCount={activeGuests}
        />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "absolute inset-0 z-30 bg-background text-foreground overflow-y-auto scrollbar-thin flex flex-col transition-all duration-200 select-none animate-in fade-in-0 duration-150 scroll-smooth",
        isPanelCollapsed
          ? "rounded-none"
          : "rounded-l-2xl lg:rounded-l-3xl rounded-r-none border-l border-border shadow-2xl",
        className
      )}
    >
      {/* 1. Top Action Bar (Screenshot 3 header) */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border shrink-0">
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between px-5 sm:px-6 py-3">
          {/* Left: Close (X) & Expand/Collapse */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={locale === "vi" ? "Đóng" : "Close"}
              className="h-8.5 w-8.5 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {onTogglePanel && (
              <button
                type="button"
                onClick={onTogglePanel}
                aria-label={isPanelCollapsed ? "Expand panel" : "Collapse panel"}
                className="hidden lg:flex h-8.5 w-8.5 rounded-full border border-border bg-card hover:bg-muted items-center justify-center text-foreground transition-colors cursor-pointer"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Right: Save, Add to trip, Audio, Share, More */}
          <div className="flex items-center gap-2">
            {/* Save pill button */}
            <button
              type="button"
              onClick={() => {
                const next = !favState;
                setFavState(next);
                onToggleFavorite?.(hotel.id, next);
              }}
              className="px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5",
                  favState ? "fill-rose-500 text-rose-500" : "text-foreground"
                )}
              />
              <span>{favState ? (locale === "vi" ? "Đã lưu" : "Saved") : (locale === "vi" ? "Lưu" : "Save")}</span>
            </button>

            {/* Add to trip pill button */}
            <button
              type="button"
              onClick={() => {
                const next = !addedState;
                setAddedState(next);
                onAddToTrip?.(hotel);
              }}
              className="px-3.5 py-1.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {addedState ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[2.5]" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-foreground stroke-[2]" />
              )}
              <span>{addedState ? (locale === "vi" ? "Đã thêm" : "Added") : (locale === "vi" ? "Thêm vào chuyến" : "Add to trip")}</span>
            </button>

            {/* Share button */}
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share"
              className="h-8.5 w-8.5 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              <Share2 className="h-4 w-4" />
            </button>

            {/* Audio guide */}
            <button
              type="button"
              onClick={handleAudioGuide}
              aria-label="Audio guide"
              className="h-8.5 w-8.5 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              <Headphones className="h-4 w-4" />
            </button>

            {/* More options */}
            <button
              type="button"
              aria-label="More"
              className="h-8.5 w-8.5 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground transition-colors cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="px-5 sm:px-6 py-5 flex-1 pb-12 space-y-6">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          {/* Hotel Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
              {hotel.name}
            </h1>
          </div>

          {/* Bento 5-Photo Collage Grid (Mindtrip 1:1 format) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 h-[280px] sm:h-[340px] md:h-[400px] w-full rounded-3xl overflow-hidden bg-muted border border-border select-none shadow-xs">
            {/* Left Large Photo */}
            <div className="group relative h-full w-full overflow-hidden bg-muted">
              <Image
                src={photos[0]}
                alt={hotel.name}
                fill
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Right 2x2 Grid of 4 Smaller Photos */}
            <div className="grid grid-cols-2 grid-rows-2 gap-2.5 h-full w-full">
              {photos.slice(1, 5).map((photo, idx) => (
                <div key={photo + idx} className="group relative h-full w-full overflow-hidden bg-muted">
                  <Image
                    src={photo}
                    alt={`${hotel.name} - ${idx + 2}`}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sticky Tabs Navigation: Overview, Amenities, Reviews, Location */}
          <div className="sticky top-[58px] z-10 bg-background/95 backdrop-blur-md -mx-6 px-6 py-3 border-b border-border flex items-center gap-8 text-sm font-semibold">
            {(["overview", "amenities", "reviews", "location"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "pb-1 transition-colors cursor-pointer capitalize relative",
                  activeTab === tab
                    ? "text-foreground font-bold border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "overview" && (locale === "vi" ? "Tổng quan" : "Overview")}
                {tab === "amenities" && (locale === "vi" ? "Tiện nghi" : "Amenities")}
                {tab === "reviews" && (locale === "vi" ? "Đánh giá" : "Reviews")}
                {tab === "location" && (locale === "vi" ? "Vị trí" : "Location")}
              </button>
            ))}
          </div>

          {/* Section 1: Overview with Split Layout (Left: Details, Right: Sticky Booking/Contact Card) */}
          <div ref={overviewRef} className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
            {/* Left Content Column (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Hotel Description */}
              <div className="space-y-3">
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {hotel.description}
                </p>
              </div>

              {/* Quick Amenities Highlight Row */}
              {hotel.amenities?.popular && hotel.amenities.popular.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {hotel.amenities.popular.slice(0, 4).map((amenity) => (
                    <span
                      key={amenity}
                      className="px-3 py-1 rounded-full bg-muted border border-border text-xs text-foreground/90"
                    >
                      ✓ {amenity}
                    </span>
                  ))}
                </div>
              )}

              {/* Structured Address & Phone */}
              <div className="space-y-4 pt-4 border-t border-border text-sm">
                {/* Address */}
                {hotel.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                        Address
                      </span>
                      <p className="text-foreground text-sm leading-snug">{hotel.address}</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.address}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline pt-0.5"
                      >
                        <span>Get directions</span>
                        <ChevronRight className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {hotel.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                        Phone
                      </span>
                      <a
                        href={`tel:${hotel.phone}`}
                        className="text-foreground hover:underline text-sm font-medium block"
                      >
                        {hotel.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Sticky Card (Direct Booking OR Truthful Direct Contact) */}
            <div className="lg:col-span-5">
              <div className="sticky top-28 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
                {hotel.hasDirectBooking && hotel.pricePerNight ? (
                  <>
                    {/* Price Display */}
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-bold text-foreground">
                          {hotel.pricePerNight} {hotel.currency || "US$"}
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
                          {activeGuests} {activeGuests === 1 ? (locale === "vi" ? "khách" : "adult") : (locale === "vi" ? "khách" : "adults")}
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
            </div>
          </div>

          {/* Section 2: Amenities Tab Content */}
          <div ref={amenitiesRef} className="space-y-6 pt-8 border-t border-border">
            <h3 className="text-xl font-bold text-foreground">
              {locale === "vi" ? "Tiện nghi & Dịch vụ" : "Amenities"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Popular */}
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

              {/* Room features */}
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

              {/* Services */}
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

          {/* Section 3: Reviews Tab Content */}
          <div ref={reviewsRef} className="space-y-6 pt-8 border-t border-border">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-foreground">
                  {locale === "vi" ? "Đánh giá từ khách hàng" : "Reviews"}
                </h3>
                {typeof hotel.rating === "number" && hotel.rating > 0 && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      {hotel.rating.toFixed(1).replace(".", ",")}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {hotel.rating >= 4.5 ? "Excellent" : "Very Good"}
                    </span>
                    {typeof hotel.reviewCount === "number" && (
                      <span className="text-xs text-muted-foreground">
                        · {(hotel.reviewCount / 1000).toFixed(1).replace(".", ",")}k verified reviews
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Review Cards */}
            {hotel.reviews && hotel.reviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hotel.reviews.map((rev, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          {rev.authorName ? rev.authorName.slice(0, 2).toUpperCase() : "TS"}
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-foreground block">{rev.authorName}</span>
                          <span className="text-[11px] text-muted-foreground block">
                            {rev.stayDuration || rev.date || (locale === "vi" ? "Khách đã lưu trú" : "Verified guest")}
                          </span>
                        </div>
                      </div>
                      {typeof rev.rating === "number" && (
                        <div className="flex items-center gap-1 text-xs font-bold text-foreground bg-card border border-border px-2 py-0.5 rounded-md">
                          <Star className="h-3 w-3 fill-foreground text-foreground" />
                          <span>{rev.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {rev.text && (
                      <p className="text-xs text-foreground/85 leading-relaxed">
                        "{rev.text}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-muted/20 border border-border text-center space-y-1">
                <p className="text-sm text-muted-foreground">
                  {locale === "vi"
                    ? "Chưa có bài đánh giá chi tiết cho cơ sở này."
                    : "No detailed reviews available for this property yet."}
                </p>
              </div>
            )}
          </div>

          {/* Section 4: Location Tab Content */}
          <div ref={locationRef} className="space-y-4 pt-8 border-t border-border">
            <h3 className="text-xl font-bold text-foreground">Location</h3>
            {hotel.address && (
              <div className="flex items-start gap-2 text-sm text-foreground/90">
                <MapPin className="h-4.5 w-4.5 text-muted-foreground mt-0.5 shrink-0" />
                <span>{hotel.address}</span>
              </div>
            )}

            {/* Embedded Map Card */}
            <div className="relative h-[280px] w-full rounded-3xl overflow-hidden border border-border bg-muted/40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg animate-bounce">
                  <Compass className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold text-foreground">{hotel.name}</span>
                <span className="text-xs text-muted-foreground">{displayLocation}</span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${hotel.address || ""}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 px-4 py-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Get directions on Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Book Your Stay Popover Modal */}
      <MindtripBookStayModal
        hotel={hotel}
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
    </div>
  );
}
