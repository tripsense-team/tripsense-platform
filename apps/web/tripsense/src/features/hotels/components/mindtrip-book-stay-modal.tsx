"use client";

import * as React from "react";
import Image from "next/image";
import { X, Sparkles, Check, ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import type { MindtripHotel } from "../types";

export interface MindtripBookStayModalProps {
  hotel: MindtripHotel;
  isOpen: boolean;
  onClose: () => void;
  onChooseRoom: () => void;
  checkInDate?: string;
  checkOutDate?: string;
  guestCount?: number;
}

export function MindtripBookStayModal({
  hotel,
  isOpen,
  onClose,
  onChooseRoom,
  checkInDate = "14 thg 10",
  checkOutDate = "15 thg 10",
  guestCount = 1,
}: MindtripBookStayModalProps) {
  const { t, locale } = useTranslation();

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const thumbnail = hotel.photos?.[0] || "/placeholder-hotel.jpg";
  const displayLocation = [hotel.district, hotel.city].filter(Boolean).join(", ") || hotel.address;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-stay-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] rounded-3xl bg-card text-card-foreground border border-border shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-200"
      >
        {/* Close Button (Top Left - matching Mindtrip screenshot) */}
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "vi" ? "Đóng" : "Close"}
          className="h-8.5 w-8.5 rounded-full bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="h-4.5 w-4.5" />
        </button>

        {/* Hotel Header Mini Card */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-2xl overflow-hidden shrink-0 border border-border bg-muted">
            <Image
              src={thumbnail}
              alt={hotel.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 id="book-stay-title" className="text-lg font-bold text-foreground truncate leading-tight">
              {hotel.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
              {typeof hotel.rating === "number" && hotel.rating > 0 && (
                <>
                  <span className="flex items-center gap-0.5 font-semibold text-foreground">
                    <Star className="h-3 w-3 fill-foreground text-foreground" />
                    {locale === "vi" ? hotel.rating.toFixed(1).replace(".", ",") : hotel.rating.toFixed(1)}
                  </span>
                  {typeof hotel.reviewCount === "number" && (
                    <span>
                      ({locale === "vi"
                        ? `${(hotel.reviewCount / 1000).toFixed(1).replace(".", ",")} n`
                        : `${(hotel.reviewCount / 1000).toFixed(1)}k`})
                    </span>
                  )}
                  <span>·</span>
                </>
              )}
              <span className="truncate">{displayLocation}</span>
            </div>
          </div>
        </div>

        {/* 3-Segment Date & Guests Box */}
        <div className="grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-muted/40 text-xs">
          <div className="p-3 text-center space-y-0.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Check in</span>
            <span className="font-semibold text-foreground block text-sm">{checkInDate}</span>
          </div>
          <div className="p-3 text-center space-y-0.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Check out</span>
            <span className="font-semibold text-foreground block text-sm">{checkOutDate}</span>
          </div>
          <div className="p-3 text-center space-y-0.5">
            <span className="text-[11px] text-muted-foreground block font-medium">Guests</span>
            <span className="font-semibold text-foreground block text-sm">
              {guestCount} {guestCount === 1 ? (locale === "vi" ? "khách" : "adult") : (locale === "vi" ? "khách" : "adults")}
            </span>
          </div>
        </div>

        {/* Feature "Book your stay" Card */}
        <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-4 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-foreground text-base">
                {locale === "vi" ? "Đặt kỳ nghỉ của bạn" : "Book your stay"}
              </h3>
            </div>
            <div className="text-right">
              {hotel.pricePerNight ? (
                <>
                  <span className="text-xl font-bold text-foreground block leading-tight">
                    {hotel.pricePerNight} {hotel.currency || "US$"}
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === "vi" ? "mỗi đêm" : "per night"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground block">
                  {locale === "vi" ? "Giá trực tiếp" : "Direct rates"}
                </span>
              )}
            </div>
          </div>

          {/* 3 Value Propositions */}
          <ul className="space-y-2 text-xs text-foreground/90 pt-1">
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 stroke-[2.5]" />
              <span>
                {locale === "vi"
                  ? "Khớp với giá tốt nhất mà chúng tôi tìm thấy"
                  : "Matches the best price we found"}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 stroke-[2.5]" />
              <span>
                {locale === "vi"
                  ? "Chuyến bay, chỗ ở và kế hoạch — tất cả trong một nơi"
                  : "Flights, stays and plans — all in one place"}
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check className="h-4 w-4 text-emerald-500 shrink-0 stroke-[2.5]" />
              <span>
                {locale === "vi"
                  ? "Trợ lý du lịch cá nhân đồng hành suốt chuyến đi"
                  : "Your personal travel assistant, throughout your trip"}
              </span>
            </li>
          </ul>

          {/* Primary Action Button: "Choose a room" */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onChooseRoom();
            }}
            className="w-full py-3.5 px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide transition-all shadow-sm active:scale-[0.99] cursor-pointer mt-2"
          >
            {locale === "vi" ? "Chọn phòng" : "Choose a room"}
          </button>
        </div>

        {/* Other Booking Options (OTA Price Comparison) */}
        {hotel.otaOptions && hotel.otaOptions.length > 0 && (
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "vi" ? "Lựa chọn đặt phòng khác" : "Other booking options"}
            </h4>
            <div className="space-y-2">
              {hotel.otaOptions.map((ota) => (
                <div
                  key={ota.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border hover:border-foreground/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* OTA Brand Logo Badge */}
                    <div
                      className={cn(
                        "h-9 w-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0",
                        ota.logoType === "booking" && "bg-[#003580]",
                        ota.logoType === "priceline" && "bg-[#0071c2]",
                        ota.logoType === "agoda" && "bg-gradient-to-tr from-[#3355a6] to-[#00b0ff]"
                      )}
                    >
                      {ota.logoType === "booking" && "B."}
                      {ota.logoType === "priceline" && "P"}
                      {ota.logoType === "agoda" && "a"}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-foreground text-sm block leading-tight truncate">
                        {ota.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {locale === "vi" ? `Đặt tại ${ota.name.toLowerCase()}` : `Book at ${ota.name.toLowerCase()}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {ota.pricePerNight && (
                      <span className="font-bold text-foreground text-sm">
                        {ota.pricePerNight} {ota.currency || hotel.currency || "US$"}
                      </span>
                    )}
                    <a
                      href={ota.bookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-full border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>{locale === "vi" ? "Xem ưu đãi" : "View deal"}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-[11px] text-muted-foreground italic text-center pt-1">
          {locale === "vi"
            ? "Giá tính theo đêm và chưa bao gồm thuế, phí."
            : "Prices are per night and exclude taxes and fees."}
        </p>
      </div>
    </div>
  );
}
