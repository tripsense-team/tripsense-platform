"use client";

import * as React from "react";
import {
  Bell,
  BellRing,
  Info,
  Phone,
  Navigation,
  MessageSquare,
  CheckCircle2,
  Sparkles,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { PlaceDetailContent } from "@/features/places/components/place-detail-content";
import type { Place } from "@/features/places/types";
import type { PublicHotelListingDto } from "@/features/partner";
import type { MindtripHotel } from "../types";
import { MindtripBookStayModal } from "./mindtrip-book-stay-modal";
import { MindtripAvailableRoomsView } from "./mindtrip-available-rooms-view";
import { fetchDirectOffersForPlace } from "../services/hotel-service-adapter";
import { getExistingHotelPhotos, loadHotelPhotoGallery } from "../services/hotel-photo-enrichment";

export interface MindtripHotelDetailOverlayProps {
  hotel: MindtripHotel;
  hotelPartner?: PublicHotelListingDto | null;
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
  hotelPartner,
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
  const [loadedPhotos, setLoadedPhotos] = React.useState(hotel.photoGallery ?? []);

  React.useEffect(() => {
    if (getExistingHotelPhotos(hotel).length > 0) return;
    let active = true;
    void loadHotelPhotoGallery(hotel).then((photos) => {
      if (active && photos.length > 0) setLoadedPhotos(photos);
    });
    return () => { active = false; };
  }, [hotel]);

  const [directBooking, setDirectBooking] = React.useState<{
    hasDirectBooking: true;
    propertyId: string;
    businessId?: string;
    ownerUserId?: string;
    rooms: MindtripHotel["rooms"];
    pricePerNight: number;
    currency: string;
  } | null>(() => {
    if (hotel.hasDirectBooking && hotel.pricePerNight) {
      return {
        hasDirectBooking: true,
        propertyId: hotel.propertyId || hotel.id,
        businessId: hotel.businessId,
        ownerUserId: hotel.ownerUserId,
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
        businessId: hotel.businessId,
        ownerUserId: hotel.ownerUserId,
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
    hotel.businessId,
    hotel.ownerUserId,
    activeCheckIn,
    activeCheckOut,
    activeGuests,
    quantity,
  ]);

  const isDirectBookable = Boolean(directBooking || (hotel.hasDirectBooking && hotel.pricePerNight));
  const effectivePrice = directBooking?.pricePerNight ?? hotel.pricePerNight;
  const effectiveCurrency = directBooking?.currency ?? hotel.currency ?? "VND";

  const currentHotelForBooking: MindtripHotel = React.useMemo(() => {
    if (!directBooking) {
      return {
        ...hotel,
        businessId: hotel.businessId || hotelPartner?.id,
        ownerUserId: hotel.ownerUserId || hotelPartner?.ownerUserId,
        propertyId: hotel.propertyId || hotelPartner?.propertyId,
      };
    }
    return {
      ...hotel,
      hasDirectBooking: true,
      propertyId: directBooking.propertyId,
      businessId: directBooking.businessId || hotel.businessId || hotelPartner?.id,
      ownerUserId: directBooking.ownerUserId || hotel.ownerUserId || hotelPartner?.ownerUserId,
      pricePerNight: directBooking.pricePerNight,
      currency: directBooking.currency,
      rooms: directBooking.rooms,
    };
  }, [hotel, directBooking, hotelPartner]);

  const currentUserId = useAuthStore((state) => state.user?.id);
  const resolvedOwnerUserId = currentHotelForBooking.ownerUserId || hotelPartner?.ownerUserId;
  const resolvedBusinessId = currentHotelForBooking.businessId || hotelPartner?.id;
  const isOwner = Boolean(
    currentUserId && resolvedOwnerUserId && currentUserId === resolvedOwnerUserId
  );
  const isPartner = Boolean(hotelPartner || resolvedOwnerUserId);

  const inquiryMessage = encodeURIComponent(
    `Chào khách sạn ${hotel.name}, mình muốn hỏi về việc đặt phòng từ ngày ${activeCheckIn} đến ${activeCheckOut} cho ${activeGuests} khách. Bạn có thể tư vấn và gửi phiếu giữ phòng qua chat giúp mình được không?`
  );
  const chatHref = resolvedOwnerUserId
    ? `/chat?userId=${resolvedOwnerUserId}&message=${inquiryMessage}`
    : `/chat?message=${inquiryMessage}`;

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
      reviews: hotel.reviews?.map((r) => ({
        authorName: r.authorName,
        profilePhotoUrl: r.avatarUrl,
        rating: r.rating,
        text: r.text,
        relativeTimeDescription: r.stayDuration || r.date,
      })),
    };
  }, [hotel, loadedPhotos]);

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
      {/* Case 0: Owner Management Banner */}
      {isOwner && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-3 w-3" />
              <span>{locale === "vi" ? "Cơ sở lưu trú của bạn" : "Your Property"}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {effectivePrice
              ? (locale === "vi"
                  ? `Khách sạn của bạn đang mở bán giỏ phòng trực tuyến (giá từ ${new Intl.NumberFormat("vi-VN").format(effectivePrice)} ${effectiveCurrency}/đêm) và đón tiếp khách.`
                  : `Your property is published with online inventory (from ${new Intl.NumberFormat("en-US").format(effectivePrice)} ${effectiveCurrency}/night) and receiving guests.`)
              : (locale === "vi"
                  ? "Cơ sở của bạn đã được duyệt và đang mở đón khách qua tin nhắn. Hãy thiết lập các hạng phòng để mở giỏ phòng trực tuyến tức thì."
                  : "Your property is approved and receiving guests via chat. Configure room types to enable instant online booking.")}
          </p>
          <Link
            href={resolvedBusinessId ? `/partner/businesses/${resolvedBusinessId}/hotel` : "/partner"}
            className="w-full py-2.5 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs text-center cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{locale === "vi" ? "Quản lý cơ sở & Giỏ phòng" : "Manage Hotel & Rooms"}</span>
          </Link>
        </div>
      )}

      {isDirectBookable && effectivePrice ? (
        <>
          {/* Partner Status Badge */}
          {isPartner && (
            <div className="flex items-center justify-between pb-1 border-b border-border/50">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                <span>{locale === "vi" ? "Đối tác chính thức" : "Verified Partner"}</span>
              </span>
              {hotelPartner?.acceptingNew !== false && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{locale === "vi" ? "Đang mở đón khách" : "Open for guests"}</span>
                </span>
              )}
            </div>
          )}

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

          {/* Primary Action Button: Book stay / Choose room */}
          <button
            type="button"
            onClick={() => setIsBookModalOpen(true)}
            className="w-full py-3.5 px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide transition-all shadow-xs active:scale-[0.98] cursor-pointer text-center"
          >
            {locale === "vi" ? "Chọn phòng & Đặt ngay" : "Check availability"}
          </button>

          {/* Secondary Action: In-chat Booking */}
          <Link
            href={chatHref}
            className="w-full py-2.5 px-5 rounded-full border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs text-center"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span>{locale === "vi" ? "Tư vấn & Đặt phòng qua Chat" : "Consult & Book via Chat"}</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsAvailableRoomsViewOpen(true)}
            className="w-full py-2.5 px-5 rounded-full border border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{locale === "vi" ? "Xem danh sách hạng phòng & giá" : "Browse room types & rates"}</span>
          </button>

          {/* Price Alert */}
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
      ) : isPartner ? (
        /* Case B: Verified Partner without Direct Room Inventory (or Dates Sold Out) */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" />
              <span>{locale === "vi" ? "Đối tác chính thức trên TripSense" : "TripSense Verified Partner"}</span>
            </span>
            {hotelPartner?.acceptingNew !== false && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{locale === "vi" ? "Đang mở đón khách" : "Open for guests"}</span>
              </span>
            )}
          </div>

          <div>
            <h4 className="font-bold text-sm text-foreground">
              {locale === "vi" ? "Đặt phòng qua Chat & Lễ tân" : "Book via Chat & Reception"}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {locale === "vi"
                ? "Khách sạn đón tiếp và nhận yêu cầu đặt phòng trực tiếp qua Tin nhắn Chat (0% phụ phí). Quý khách có thể nhắn tin trực tiếp để kiểm tra phòng trống và nhận giá ưu đãi tốt nhất."
                : "This property accepts direct booking inquiries via Chat with 0% extra fees. Message the hotel directly to check availability and receive personalized offers."}
            </p>
          </div>

          <Link
            href={chatHref}
            className="w-full py-3 px-4 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs text-center cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{locale === "vi" ? "Nhắn tin & Đặt phòng qua Chat" : "Message & Book via Chat"}</span>
          </Link>

          {(hotel.phone || hotelPartner?.publicPhone) && (
            <a
              href={`tel:${hotel.phone || hotelPartner?.publicPhone}`}
              className="w-full py-2.5 px-4 rounded-full border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span>{locale === "vi" ? `Gọi đặt phòng: ${hotel.phone || hotelPartner?.publicPhone}` : `Call to reserve: ${hotel.phone || hotelPartner?.publicPhone}`}</span>
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
      ) : (
        /* Case C: Truthful Online Booking Not Yet Enabled State for 3rd-Party Places */
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

          <Link
            href={chatHref}
            className="w-full py-2.5 px-4 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs text-center"
          >
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span>{locale === "vi" ? "Nhắn tin & Đặt phòng qua Chat" : "Message & Book via Chat"}</span>
          </Link>

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
