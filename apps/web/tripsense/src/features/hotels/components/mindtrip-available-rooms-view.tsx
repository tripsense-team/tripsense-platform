"use client";

import * as React from "react";
import Image from "next/image";
import {
  ChevronLeft,
  Star,
  Maximize2,
  Users,
  BedDouble,
  X as XIcon,
  Check as CheckIcon,
  Bell,
  BellRing,
  Sparkles,
  Phone,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { executeDirectBooking } from "../services/hotel-service-adapter";
import type { MindtripHotel, HotelRoomData, HotelBooking } from "../types";

export interface MindtripAvailableRoomsViewProps {
  hotel: MindtripHotel;
  onBack: () => void;
  checkInDate?: string;
  checkOutDate?: string;
  guestCount?: number;
  onBookRoom?: (room: HotelRoomData) => void;
}

export function MindtripAvailableRoomsView({
  hotel,
  onBack,
  checkInDate: propCheckIn,
  checkOutDate: propCheckOut,
  guestCount: propGuests,
  onBookRoom,
}: MindtripAvailableRoomsViewProps) {
  const { t, locale } = useTranslation();

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

  const checkInDate = propCheckIn || dynamicCheckIn;
  const checkOutDate = propCheckOut || dynamicCheckOut;
  const guestCount = propGuests ?? 1;
  const [showTotalPriceWithTax, setShowTotalPriceWithTax] = React.useState(false);
  const [selectedRoomForDetails, setSelectedRoomForDetails] = React.useState<HotelRoomData | null>(null);
  const [confirmedBooking, setConfirmedBooking] = React.useState<{
    booking: HotelBooking;
    room: HotelRoomData;
  } | null>(null);
  const [isBooking, setIsBooking] = React.useState(false);
  const [bookingError, setBookingError] = React.useState<string | null>(null);
  const [priceAlerts, setPriceAlerts] = React.useState<Set<string>>(new Set());

  const thumbnail = hotel.photos?.[0] || "/placeholder-hotel.jpg";
  const displayLocation = [hotel.district, hotel.city].filter(Boolean).join(", ") || hotel.address;

  const togglePriceAlert = (roomId: string) => {
    setPriceAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const handleBook = async (room: HotelRoomData) => {
    if (isBooking) return;
    setIsBooking(true);
    setBookingError(null);
    try {
      if (onBookRoom) {
        onBookRoom(room);
      }
      const booking = await executeDirectBooking({
        roomTypeId: room.id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        guests: guestCount,
        quantity: 1,
      });
      setConfirmedBooking({ booking, room });
    } catch (err: unknown) {
      const safeMsg = getSafeErrorMessage(
        err,
        locale === "vi"
          ? "Không thể hoàn tất đặt phòng. Vui lòng kiểm tra lại phòng trống hoặc liên hệ khách sạn."
          : "Unable to complete booking. Please verify room availability or contact the hotel directly."
      );
      setBookingError(safeMsg);
    } finally {
      setIsBooking(false);
    }
  };

  const hasRooms = Array.isArray(hotel.rooms) && hotel.rooms.length > 0;

  return (
    <div className="min-h-full w-full bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 animate-in fade-in-0 duration-200">
      {/* 1. Header Bar: Back Arrow, Hotel Mini Card, Date Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        {/* Left: Back button + Hotel Info */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            aria-label={locale === "vi" ? "Quay lại" : "Back"}
            className="h-10 w-10 rounded-full border border-border bg-card hover:bg-muted text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="relative h-14 w-14 rounded-2xl overflow-hidden shrink-0 border border-border bg-muted">
            <Image
              src={thumbnail}
              alt={hotel.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>

          <div className="min-w-0 space-y-0.5">
            <h1 className="text-lg sm:text-xl font-bold text-foreground truncate leading-tight">
              {hotel.name}
            </h1>
            <p className="text-xs text-muted-foreground truncate">{displayLocation}</p>
            {typeof hotel.rating === "number" && hotel.rating > 0 && (
              <div className="flex items-center gap-1 text-xs text-foreground font-semibold">
                <Star className="h-3 w-3 fill-foreground text-foreground shrink-0" />
                <span>
                  {locale === "vi" ? hotel.rating.toFixed(1).replace(".", ",") : hotel.rating.toFixed(1)}
                </span>
                {typeof hotel.reviewCount === "number" && (
                  <span className="text-muted-foreground font-normal">
                    ({locale === "vi"
                      ? `${(hotel.reviewCount / 1000).toFixed(1).replace(".", ",")} n`
                      : `${(hotel.reviewCount / 1000).toFixed(1)}k`})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Date & Guest Info Card */}
        <div className="flex items-center divide-x divide-border rounded-2xl border border-border bg-muted/30 px-4 py-2.5 text-xs self-start sm:self-auto">
          <div className="pr-4 space-y-0.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Check in</span>
            <span className="font-semibold text-foreground block text-sm">{checkInDate}</span>
          </div>
          <div className="px-4 space-y-0.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Check out</span>
            <span className="font-semibold text-foreground block text-sm">{checkOutDate}</span>
          </div>
          <div className="pl-4 space-y-0.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Guests</span>
            <span className="font-semibold text-foreground block text-sm">
              {guestCount} {guestCount === 1 ? (locale === "vi" ? "khách" : "adult") : (locale === "vi" ? "khách" : "adults")}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Subheader Bar: "Available rooms" Heading + Tax & Fees Toggle Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {locale === "vi" ? "Phòng còn trống" : "Available rooms"}
        </h2>

        {/* Total Price Toggle Switch */}
        {hasRooms && (
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground font-medium select-none">
              {locale === "vi"
                ? "Hiển thị tổng giá (bao gồm thuế và phí)"
                : "Show total price (including taxes & fees)"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showTotalPriceWithTax}
              onClick={() => setShowTotalPriceWithTax((prev) => !prev)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden",
                showTotalPriceWithTax ? "bg-primary" : "bg-muted border border-border"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out",
                  showTotalPriceWithTax ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )}
      </div>

      {bookingError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs sm:text-sm text-destructive flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{bookingError}</span>
        </div>
      )}

      {/* 3. Rooms Display (Truthful state when no rooms vs Grid of rooms) */}
      {!hasRooms ? (
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-4 shadow-xs">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Info className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-foreground">
              {locale === "vi"
                ? "Chưa có dữ liệu phòng trực tuyến"
                : "Online rooms not currently available"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {locale === "vi"
                ? "Khách sạn này chưa tích hợp kho phòng trực tuyến trên hệ thống TripSense. Quý khách vui lòng liên hệ trực tiếp khách sạn để kiểm tra phòng trống và đặt phòng."
                : "This property does not currently have online inventory linked with TripSense. Please contact the front desk directly to check real-time availability."}
            </p>
          </div>

          {hotel.phone && (
            <div className="pt-2">
              <a
                href={`tel:${hotel.phone}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{locale === "vi" ? `Gọi trực tiếp: ${hotel.phone}` : `Call directly: ${hotel.phone}`}</span>
              </a>
            </div>
          )}
        </div>
      ) : (
        /* Room Cards Responsive Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {hotel.rooms!.map((room) => {
            const isAlertActive = priceAlerts.has(room.id);
            const priceToShow = showTotalPriceWithTax ? room.totalWithTax : room.pricePerNight;
            const currentPhoto = room.photos[0] || thumbnail;

            return (
              <article
                key={room.id}
                className="group flex flex-col rounded-3xl bg-card border border-border hover:border-foreground/30 overflow-hidden transition-all duration-200 shadow-xs hover:shadow-md"
              >
                {/* Photo Frame with "X rooms left" badge */}
                <div className="relative aspect-[16/11] w-full overflow-hidden bg-muted">
                  <Image
                    src={currentPhoto}
                    alt={room.name}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Rooms left badge */}
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold border border-white/10">
                    {room.roomsLeft} {locale === "vi" ? "phòng còn lại" : "rooms left"}
                  </div>

                  {/* Photo Pagination Dots */}
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
                    <span className="h-1.5 w-3 rounded-full bg-white" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                  </div>
                </div>

                {/* Room Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* Room Name */}
                    <h3 className="font-bold text-base text-foreground leading-snug line-clamp-2">
                      {room.name}
                    </h3>

                    {/* Room Specs */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {room.sqFt && (
                          <span className="flex items-center gap-1">
                            <Maximize2 className="h-3.5 w-3.5" />
                            {room.sqFt} sq ft ({room.sqM || Math.round(room.sqFt * 0.093)} m²)
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {locale === "vi" ? `Tối đa ${room.sleeps} khách` : `Sleeps ${room.sleeps}`}
                        </span>
                      </div>

                      {room.bedType && (
                        <div className="flex items-center gap-1.5">
                          <BedDouble className="h-3.5 w-3.5" />
                          <span className="capitalize">{room.bedType}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 pt-0.5">
                        {room.refundable ? (
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-500 stroke-[2.5]" />
                        ) : (
                          <XIcon className="h-3.5 w-3.5 text-muted-foreground stroke-[2]" />
                        )}
                        <span className={room.refundable ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                          {room.refundable
                            ? (locale === "vi" ? "Miễn phí hủy phòng" : "Free cancellation")
                            : (locale === "vi" ? "Không hoàn tiền" : "Non-refundable")}
                        </span>
                      </div>
                    </div>

                    {/* More details link */}
                    <button
                      type="button"
                      onClick={() => setSelectedRoomForDetails(room)}
                      className="text-xs text-foreground font-semibold underline underline-offset-4 hover:text-muted-foreground transition-colors cursor-pointer pt-1 block"
                    >
                      {locale === "vi" ? "Chi tiết phòng" : "More details"}
                    </button>
                  </div>

                  {/* Price & Action Section */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-foreground leading-none">
                        {priceToShow} {room.currency}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {showTotalPriceWithTax
                          ? (locale === "vi" ? "Tổng cộng gồm thuế, phí" : "Total including taxes & fees")
                          : (locale === "vi" ? `${room.pricePerNight} ${room.currency} cho 1 đêm` : `${room.pricePerNight} ${room.currency} for 1 night`)}
                      </div>
                      <div className="text-[11px] text-muted-foreground pt-0.5">
                        {room.refundable
                          ? (locale === "vi" ? "Miễn phí hủy" : "Free cancellation")
                          : (locale === "vi" ? "Không hoàn tiền" : "Non-refundable")}
                      </div>
                    </div>

                    {/* CTA Buttons: Book + Price Alert Bell */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isBooking}
                        onClick={() => handleBook(room)}
                        className="flex-1 py-2.5 px-4 rounded-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-sm tracking-wide transition-all shadow-xs active:scale-[0.98] cursor-pointer text-center flex items-center justify-center gap-2"
                      >
                        {isBooking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{locale === "vi" ? "Đang xử lý..." : "Booking..."}</span>
                          </>
                        ) : (
                          <span>{locale === "vi" ? "Đặt ngay" : "Book"}</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePriceAlert(room.id)}
                        title={isAlertActive ? "Price alert set" : "Set price alert"}
                        aria-label="Set price alert"
                        className={cn(
                          "h-10 w-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0",
                          isAlertActive
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                            : "border-border bg-card hover:bg-muted text-foreground"
                        )}
                      >
                        {isAlertActive ? (
                          <BellRing className="h-4 w-4" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Room Details Modal */}
      {selectedRoomForDetails && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
          onClick={() => setSelectedRoomForDetails(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[540px] rounded-3xl bg-card text-card-foreground border border-border shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-foreground">{selectedRoomForDetails.name}</h3>
              <button
                type="button"
                onClick={() => setSelectedRoomForDetails(null)}
                className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center transition-colors cursor-pointer"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-muted">
              <Image
                src={selectedRoomForDetails.photos[0] || thumbnail}
                alt={selectedRoomForDetails.name}
                fill
                unoptimized
                className="object-cover"
              />
            </div>

            {selectedRoomForDetails.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedRoomForDetails.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground py-2 border-y border-border">
              {selectedRoomForDetails.sqFt && (
                <div>
                  <span className="font-semibold text-foreground block">Size:</span>
                  <span>{selectedRoomForDetails.sqFt} sq ft ({selectedRoomForDetails.sqM} m²)</span>
                </div>
              )}
              {selectedRoomForDetails.bedType && (
                <div>
                  <span className="font-semibold text-foreground block">Bedding:</span>
                  <span className="capitalize">{selectedRoomForDetails.bedType}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-foreground block">Capacity:</span>
                <span>Up to {selectedRoomForDetails.sleeps} guests</span>
              </div>
              <div>
                <span className="font-semibold text-foreground block">Policy:</span>
                <span>{selectedRoomForDetails.refundPolicyText}</span>
              </div>
            </div>

            {selectedRoomForDetails.amenities && selectedRoomForDetails.amenities.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Room Amenities
                </span>
                <div className="flex flex-wrap gap-2">
                  {selectedRoomForDetails.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="px-3 py-1 rounded-full bg-muted border border-border text-xs text-foreground"
                    >
                      ✓ {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const room = selectedRoomForDetails;
                setSelectedRoomForDetails(null);
                handleBook(room);
              }}
              className="w-full py-3 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-colors cursor-pointer"
            >
              Book this room for {selectedRoomForDetails.pricePerNight} {selectedRoomForDetails.currency}
            </button>
          </div>
        </div>
      )}

      {/* Booking Instant Confirmation Modal */}
      {confirmedBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
          onClick={() => setConfirmedBooking(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[460px] rounded-3xl bg-card text-card-foreground border border-border shadow-2xl p-6 sm:p-7 text-center space-y-5 animate-in zoom-in-95 duration-200"
          >
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
              <Sparkles className="h-7 w-7" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-foreground">
                {locale === "vi" ? "Đặt phòng thành công!" : "Booking Confirmed!"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {locale === "vi"
                  ? "Kỳ nghỉ của bạn đã được xác nhận trực tiếp qua hệ thống TripSense."
                  : "Your reservation has been confirmed directly with TripSense."}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mã đặt phòng:</span>
                <span className="font-mono font-semibold text-foreground text-[11px]">
                  {confirmedBooking.booking.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hotel:</span>
                <span className="font-semibold text-foreground">{hotel.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Room:</span>
                <span className="font-semibold text-foreground">{confirmedBooking.room.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dates:</span>
                <span className="font-semibold text-foreground">{checkInDate} → {checkOutDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {confirmedBooking.booking.total || confirmedBooking.room.totalForStay} {confirmedBooking.booking.currency || confirmedBooking.room.currency}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmedBooking(null)}
              className="w-full py-3 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-colors cursor-pointer"
            >
              {locale === "vi" ? "Hoàn tất" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
