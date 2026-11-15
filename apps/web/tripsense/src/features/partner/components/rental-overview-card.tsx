"use client";

import * as React from "react";
import Link from "next/link";
import {
  Car,
  Calendar,
  ExternalLink,
  Clock,
  Phone,
  MapPin,
  Info,
  ChevronRight,
  Store,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { RentalReservationDialog } from "./rental-reservation-dialog";
import type { PublicRentalListingDto, RentalItemDto } from "../types";

export interface RentalOverviewCardProps {
  rental: PublicRentalListingDto | null;
  loading?: boolean;
  placeName: string;
  placeAddress?: string;
  placePhone?: string;
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

const CATEGORY_EMOJI: Record<string, string> = {
  CAR_4_SEATS: "🚗",
  CAR_7_SEATS: "🚙",
  MOTORBIKE_SCOOTER: "🛵",
  MOTORBIKE_MANUAL: "🏍️",
  BICYCLE: "🚲",
  CAMPING_GEAR: "⛺",
  WATER_SPORTS: "🏄",
  OTHER: "📦",
};

export function RentalOverviewCard({
  rental,
  loading = false,
  placeName,
  placeAddress,
  placePhone,
}: RentalOverviewCardProps) {
  const { t } = useTranslation();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [selectedItem, setSelectedItem] = React.useState<RentalItemDto | null>(null);
  const [bookingOpen, setBookingOpen] = React.useState(false);

  if (loading) {
    return (
      <Card className="border-border/70 shadow-xs p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-8 bg-muted rounded w-full" />
        <div className="h-16 bg-muted rounded w-full" />
      </Card>
    );
  }

  const openBookingFor = (item: RentalItemDto) => {
    setSelectedItem(item);
    setBookingOpen(true);
  };

  if (rental) {
    const isOwner = Boolean(currentUserId && rental.ownerUserId && currentUserId === rental.ownerUserId);
    const activeItems = rental.items || [];
    const canBookOnline = rental.acceptingNew && activeItems.length > 0;
    const inquiryMessage = encodeURIComponent(
      `Xin chào ${rental.displayName}, tôi muốn hỏi thuê xe/thiết bị. Bạn có thể tư vấn lịch trống và gửi phiếu thuê qua chat giúp tôi được không?`,
    );
    const chatHref = rental.ownerUserId
      ? `/chat?userId=${rental.ownerUserId}&message=${inquiryMessage}`
      : null;
    const displayPhone = rental.publicPhone || placePhone;

    return (
      <div className="space-y-3">
        {/* Section 1: Thông tin cơ sở */}
        <Card className="border-teal-500/25 bg-card shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground leading-tight">
                  {rental.displayName}
                </h3>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {rental.verifiedPartner && (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro font-medium gap-0.5 whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {t("partner.rental.verifiedPartnerDesc", { defaultValue: "Đối tác xác thực trên TripSense" })}
                    </Badge>
                  )}
                  {canBookOnline ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro font-medium whitespace-nowrap shrink-0"
                    >
                      {t("partner.rental.directBookingAvailable", { defaultValue: "Sẵn sàng đặt thuê" })}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-micro font-medium whitespace-nowrap shrink-0"
                    >
                      {t("partner.rental.temporarilyPaused", { defaultValue: "Chưa mở đặt online" })}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {(rental.openingHours || displayPhone) && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {rental.openingHours && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <span className="truncate">{rental.openingHours}</span>
                  </div>
                )}
                {displayPhone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                    <a href={`tel:${displayPhone}`} className="hover:underline text-foreground font-medium">
                      {displayPhone}
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1">
              {isOwner ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full h-9 gap-2 font-semibold text-xs border-teal-500/40 text-teal-700 dark:text-teal-400 hover:bg-teal-500/5"
                >
                  <Link href={`/partner/businesses/${rental.id}/rentals`}>
                    <Store className="h-4 w-4" />
                    <span>{t("partner.rental.manageMyRental", { defaultValue: "Quản lý danh mục & Mở đón khách" })}</span>
                  </Link>
                </Button>
              ) : chatHref ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full h-9 gap-2 font-semibold text-xs border-border/80 text-foreground hover:bg-muted/60"
                >
                  <Link href={chatHref}>
                    <MessageSquare className="h-4 w-4 text-teal-600" />
                    <span>{t("partner.rental.reserveViaChat", { defaultValue: "Nhắn tin & Đặt thuê qua Chat" })}</span>
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Danh mục dịch vụ & đặt thuê */}
        <Card className="border-border/60 bg-card shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Car className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-bold text-foreground truncate">
                    {t("partner.rental.catalogHighlights", { defaultValue: "Danh mục xe & dịch vụ" })}
                  </CardTitle>
                  <CardDescription className="text-micro text-muted-foreground">
                    {activeItems.length} phương tiện / thiết bị
                  </CardDescription>
                </div>
              </div>
              {activeItems.length > 0 && (
                <Link
                  href={`/rentals/${rental.id}`}
                  target="_blank"
                  className="text-[11px] font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-0.5 shrink-0"
                >
                  {t("partner.rental.viewFullCatalog", { defaultValue: "Xem tất cả" })}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 space-y-2.5">
            {canBookOnline ? (
              <Button
                type="button"
                onClick={() => openBookingFor(activeItems[0])}
                className="w-full h-10 gap-2 font-bold shadow-xs text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Calendar className="h-4 w-4" />
                <span>
                  {rental.minPricePerDay
                    ? t("partner.rental.bookFromPrice", {
                        price: formatVnd(rental.minPricePerDay),
                        defaultValue: `Đặt thuê ngay · Từ ${formatVnd(rental.minPricePerDay)}/ngày`,
                      })
                    : t("partner.rental.bookDirect", { defaultValue: "Đặt thuê xe / thiết bị trực tuyến" })}
                </span>
              </Button>
            ) : (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <p className="font-semibold">
                  {activeItems.length === 0
                    ? t("partner.rental.noItemsConfiguredTitle", { defaultValue: "Đối tác chưa đăng tải danh mục xe/thiết bị" })
                    : t("partner.rental.intakePausedTitle", { defaultValue: "Cơ sở đang tạm dừng nhận đặt trực tuyến" })}
                </p>
                <p className="text-[11px] opacity-90">
                  {t("partner.rental.chatFallbackHint", {
                    defaultValue: "Bạn có thể nhắn tin trực tiếp với chủ cơ sở qua Chat để kiểm tra xe trống và nhận phiếu đặt nhanh.",
                  })}
                </p>
              </div>
            )}

            {activeItems.length > 0 && (
              <>
                <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                  {activeItems.slice(0, 4).map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm leading-none shrink-0" aria-hidden>
                            {CATEGORY_EMOJI[item.category] || "📦"}
                          </span>
                          <p className="font-semibold text-foreground truncate">{item.name}</p>
                        </div>
                        <p className="text-micro text-muted-foreground mt-0.5 tabular-nums">
                          {formatVnd(item.pricePerDay)}/ngày
                          {item.depositAmount > 0 ? ` · Cọc ${formatVnd(item.depositAmount)}` : ""}
                        </p>
                      </div>
                      {rental.acceptingNew ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => openBookingFor(item)}
                          className="h-7 px-2.5 text-[11px] font-semibold bg-teal-600/10 text-teal-700 dark:text-teal-300 hover:bg-teal-600/20 shrink-0"
                        >
                          {t("partner.rental.bookShort", { defaultValue: "Đặt thuê" })}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground text-center pt-0.5">
                  {t("partner.rental.bookingHelp", {
                    defaultValue: "Kiểm tra lịch trống theo giờ/ngày · Hỗ trợ nhận tại điểm hoặc giao tận nơi",
                  })}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {selectedItem && (
          <RentalReservationDialog
            rentalItem={selectedItem}
            ownerUserId={rental.ownerUserId}
            businessName={rental.displayName}
            open={bookingOpen}
            onOpenChange={setBookingOpen}
          />
        )}
      </div>
    );
  }

  // Case 2: Non-partner rental location (fallback with phone/map)
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${placeName} ${placeAddress || ""}`,
  )}`;

  return (
    <Card className="border-border/70 bg-card shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <Car className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-foreground">
              {t("partner.rental.reserveCardTitle", { defaultValue: "Thuê xe & Dịch vụ" })}
            </CardTitle>
            <CardDescription className="text-micro text-muted-foreground">
              {placeName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-3.5">
        <div className="rounded-xl bg-muted/40 p-3.5 border border-border/50 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>
              {t("partner.rental.notLinkedNoticeTitle", {
                defaultValue: "Chưa kích hoạt đặt thuê trực tuyến",
              })}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {t("partner.rental.notLinkedNoticeDesc", {
              defaultValue:
                "Cơ sở cho thuê này chưa mở danh mục đặt trực tuyến hoặc chưa kích hoạt nhận khách trên TripSense. Quý khách vui lòng liên hệ trực tiếp qua số điện thoại để kiểm tra xe và giá.",
            })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          {placePhone ? (
            <Button
              asChild
              variant="default"
              size="sm"
              className="w-full sm:flex-1 h-9 gap-1.5 text-xs font-semibold rounded-xl"
            >
              <a href={`tel:${placePhone}`}>
                <Phone className="h-3.5 w-3.5" />
                <span>
                  {t("partner.rental.callAction", { phone: placePhone, defaultValue: `Gọi ngay: ${placePhone}` })}
                </span>
              </a>
            </Button>
          ) : null}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full sm:flex-1 h-9 gap-1.5 text-xs font-medium rounded-xl"
          >
            <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>{t("partner.rental.viewOnMaps", { defaultValue: "Xem chỉ đường" })}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
