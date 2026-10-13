"use client";

import * as React from "react";
import Link from "next/link";
import {
  Utensils,
  Calendar,
  ExternalLink,
  Clock,
  Phone,
  MapPin,
  Sparkles,
  Info,
  ChevronRight,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import type { PublicRestaurantListingDto } from "../types";

interface RestaurantOverviewCardProps {
  restaurant: PublicRestaurantListingDto | null;
  loading?: boolean;
  placeName: string;
  placeAddress?: string;
  placePhone?: string;
  onOpenReservation: () => void;
}

export function RestaurantOverviewCard({
  restaurant,
  loading = false,
  placeName,
  placeAddress,
  placePhone,
  onOpenReservation,
}: RestaurantOverviewCardProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Card className="border-border/70 shadow-xs p-5 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-2/3"></div>
        <div className="h-8 bg-muted rounded w-full"></div>
        <div className="h-16 bg-muted rounded w-full"></div>
      </Card>
    );
  }

  // Case 1: Restaurant partner found (Has Menu & Table Reservation support)
  if (restaurant) {
    const menuItems = restaurant.menu || [];
    const topDishes = menuItems.slice(0, 4);

    return (
      <Card className="border-primary/25 bg-card shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 p-4 sm:p-5 pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Utensils className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                  {t("partner.restaurant.reserveCardTitle", { defaultValue: "Đặt bàn & Thực đơn" })}
                </CardTitle>
                <CardDescription className="text-micro text-muted-foreground mt-0.5">
                  {t("partner.restaurant.reserveCardDesc", { defaultValue: "Đối tác chính thức trên TripSense" })}
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-micro font-medium shrink-0">
              {t("partner.restaurant.directBookingAvailable", { defaultValue: "Có thể đặt bàn" })}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Reservation CTA Button */}
          <div className="space-y-1.5">
            <Button
              type="button"
              onClick={onOpenReservation}
              className="w-full h-10 gap-2 font-semibold shadow-xs text-xs sm:text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Calendar className="h-4 w-4" />
              {t("restaurant.reserveTable", { defaultValue: "Đặt bàn & Giữ chỗ ngay" })}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              {t("partner.restaurant.freeReservationHelp", { defaultValue: "Giữ bàn miễn phí · Xác nhận trực tiếp từ quán" })}
            </p>
          </div>

          {/* Menu Highlights (if any) */}
          {menuItems.length > 0 ? (
            <div className="space-y-2.5 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {t("partner.restaurant.menuHighlights", { defaultValue: "Món ăn nổi bật" })} ({menuItems.length})
                </span>
                <Link
                  href={`/restaurants/${restaurant.id}`}
                  target="_blank"
                  className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  {t("partner.restaurant.viewFullMenu", { defaultValue: "Xem tất cả" })}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
                {topDishes.map((dish, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{dish.name}</p>
                      {dish.category && (
                        <p className="text-micro text-muted-foreground">{dish.category}</p>
                      )}
                    </div>
                    <span className="font-semibold text-foreground text-xs whitespace-nowrap">
                      {dish.price.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border border-border/50">
              <p className="text-[11px]">
                {t("partner.restaurant.publicMenuEmpty", {
                  defaultValue: "Nhà hàng hiện chưa cập nhật thực đơn chi tiết trực tuyến.",
                })}
              </p>
            </div>
          )}

          {/* Quick contact/hours info */}
          <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border/40">
            {restaurant.openingHours && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{restaurant.openingHours}</span>
              </div>
            )}
            {restaurant.publicPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{restaurant.publicPhone}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Case 2: No partner restaurant on TripSense (Show informative fallback card)
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${placeName} ${placeAddress || ""}`
  )}`;

  return (
    <Card className="border-border/70 bg-card shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="p-4 sm:p-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base font-bold text-foreground">
              {t("partner.restaurant.menuAndReservationTitle", { defaultValue: "Thực đơn & Đặt bàn" })}
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
            <span>{t("partner.restaurant.notLinkedNoticeTitle", { defaultValue: "Chưa hỗ trợ đặt bàn trực tuyến" })}</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {t("partner.restaurant.notLinkedNoticeDesc", {
              defaultValue:
                "Quán ăn này hiện chưa cập nhật thực đơn hoặc chưa hỗ trợ đặt bàn trực tuyến qua TripSense. Quý khách vui lòng ghé trực tiếp hoặc liên hệ qua thông tin quán.",
            })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          {placePhone ? (
            <Button asChild size="sm" variant="outline" className="w-full text-xs gap-1.5 h-8.5">
              <a href={`tel:${placePhone}`}>
                <Phone className="h-3.5 w-3.5 text-primary" />
                {placePhone}
              </a>
            </Button>
          ) : null}

          <Button asChild size="sm" variant="outline" className="w-full text-xs gap-1.5 h-8.5">
            <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {t("places.getDirections", { defaultValue: "Chỉ đường đến quán" })}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
