"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Compass,
  ExternalLink,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Utensils,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { MindtripHotelDetailOverlay } from "@/features/hotels/components/mindtrip-hotel-detail-overlay";
import type { MindtripHotel } from "@/features/hotels/types";
import { useBookingActivitySummary } from "@/features/reservations/hooks/use-booking-activity-summary";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { searchPublicHotels, searchPublicRestaurants } from "../services/partner-api";
import { searchPublicRentals } from "../services/rental-api";
import type {
  PublicHotelListingDto,
  PublicRentalListingDto,
  PublicRestaurantListingDto,
  RentalItemDto,
} from "../types";
import {
  foldVietnameseText,
  getRentalCategoryMeta,
  isRentalItemActive,
  supportsRentalDelivery,
  toSafeDisplayImageUrl,
} from "../utils/rental-display";
import { RentalReservationDialog } from "./rental-reservation-dialog";
import { RestaurantReservationDialog } from "./restaurant-reservation-dialog";

export type ServiceDiscoveryCategory = "all" | "rentals" | "hotels" | "restaurants";

export interface ServiceDiscoveryWorkspaceProps {
  defaultCategory?: ServiceDiscoveryCategory;
}

const DESTINATIONS = [
  "Tất cả",
  "Đà Nẵng",
  "Hội An",
  "Huế",
  "Nha Trang",
  "Phú Quốc",
  "Hà Nội",
  "Hồ Chí Minh",
  "Quy Nhơn",
];

const RENTAL_SUBCATEGORIES: Array<{ id: string; label: string }> = [
  { id: "ALL", label: "Tất cả" },
  { id: "MOTORBIKE_SCOOTER", label: "Xe tay ga" },
  { id: "MOTORBIKE_MANUAL", label: "Xe số / Côn" },
  { id: "CAR_4_SEATS", label: "Ô tô 4 chỗ" },
  { id: "CAR_7_SEATS", label: "Ô tô 7 chỗ" },
  { id: "BICYCLE", label: "Xe đạp" },
  { id: "CAMPING_GEAR", label: "Cắm trại" },
  { id: "WATER_SPORTS", label: "SUP & Nước" },
  { id: "OTHER", label: "Khác" },
];

interface FlattenedRentalCard {
  key: string;
  business: PublicRentalListingDto;
  item: RentalItemDto;
}

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

function toMindtripHotel(h: PublicHotelListingDto): MindtripHotel {
  return {
    id: h.propertyId || h.id,
    propertyId: h.propertyId || h.id,
    businessId: h.id,
    ownerUserId: h.ownerUserId,
    name: h.displayName,
    category: "Hotel",
    destination: h.destination || "",
    address: h.address || "",
    phone: h.publicPhone || undefined,
    photos: [],
    hasDirectBooking: Boolean(h.hasDirectInventory && h.acceptingNew),
    pricePerNight: h.minPricePerNight ?? undefined,
    minPrice: h.minPricePerNight ?? undefined,
    currency: "VND",
    checkInTime: h.checkInTime || "14:00",
    checkOutTime: h.checkOutTime || "11:00",
  };
}

export function ServiceDiscoveryWorkspace({
  defaultCategory = "all",
}: ServiceDiscoveryWorkspaceProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = useAuthStore((s) => s.user?.id);

  const paramCat = searchParams?.get("category");
  const initialCat: ServiceDiscoveryCategory =
    paramCat === "rentals" || paramCat === "hotels" || paramCat === "restaurants" || paramCat === "all"
      ? paramCat
      : defaultCategory;

  const [activeCategory, setActiveCategory] = React.useState<ServiceDiscoveryCategory>(initialCat);
  const [selectedDestination, setSelectedDestination] = React.useState("Tất cả");
  const [rentalSubcategory, setRentalSubcategory] = React.useState<string>("ALL");
  const [onlyReadyToBook, setOnlyReadyToBook] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState(searchParams?.get("q") || "");

  const [rentals, setRentals] = React.useState<PublicRentalListingDto[]>([]);
  const [hotels, setHotels] = React.useState<PublicHotelListingDto[]>([]);
  const [restaurants, setRestaurants] = React.useState<PublicRestaurantListingDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Hotel check-in / check-out criteria for MindtripHotelDetailOverlay
  const [hotelCriteria, setHotelCriteria] = React.useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const toIso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      checkIn: toIso(tomorrow),
      checkOut: toIso(dayAfter),
      guests: 2,
      quantity: 1,
    };
  });

  // Quick-booking modals
  const [bookingRental, setBookingRental] = React.useState<{
    item: RentalItemDto;
    business: PublicRentalListingDto;
  } | null>(null);
  const [bookingRestaurant, setBookingRestaurant] =
    React.useState<PublicRestaurantListingDto | null>(null);
  const [selectedHotelPartner, setSelectedHotelPartner] =
    React.useState<PublicHotelListingDto | null>(null);

  const { userBadgeCount } = useBookingActivitySummary({
    includePartner: false,
    includePendingOffers: Boolean(userId),
  });

  // Preserve legacy /hotels?tab=... redirects cleanly
  React.useEffect(() => {
    const qTab = searchParams?.get("tab");
    if (!qTab) return;
    if (qTab === "partner") router.replace("/partner");
    else if (qTab === "admin") router.replace("/admin/hotels");
    else if (qTab === "bookings") router.replace("/reservations?tab=hotels");
    else if (qTab === "notifications") router.replace("/notifications");
  }, [router, searchParams]);

  React.useEffect(() => {
    if (
      paramCat === "rentals" ||
      paramCat === "hotels" ||
      paramCat === "restaurants" ||
      paramCat === "all"
    ) {
      setActiveCategory(paramCat);
    }
  }, [paramCat]);

  const loadServices = React.useCallback(async (queryText: string) => {
    setLoading(true);
    setError(null);
    const q = queryText.trim() || undefined;
    try {
      const [rentalRes, hotelRes, restRes] = await Promise.allSettled([
        searchPublicRentals(q),
        searchPublicHotels(q),
        searchPublicRestaurants(q),
      ]);

      setRentals(rentalRes.status === "fulfilled" ? rentalRes.value : []);
      setHotels(hotelRes.status === "fulfilled" ? hotelRes.value : []);
      setRestaurants(restRes.status === "fulfilled" ? restRes.value : []);

      if (
        rentalRes.status === "rejected" &&
        hotelRes.status === "rejected" &&
        restRes.status === "rejected"
      ) {
        setError(getSafeErrorMessage(rentalRes.reason, "Không thể tải danh sách dịch vụ."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      void loadServices("");
      return;
    }
    const timer = window.setTimeout(() => {
      void loadServices(trimmed);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadServices, searchQuery]);

  const matchesDestination = React.useCallback(
    (destination?: string | null, address?: string | null) => {
      if (selectedDestination === "Tất cả") return true;
      const target = foldVietnameseText(selectedDestination);
      return (
        foldVietnameseText(destination).includes(target) ||
        foldVietnameseText(address).includes(target)
      );
    },
    [selectedDestination],
  );

  // Flattened rental items so user can see and book each vehicle/item immediately
  const rentalCards = React.useMemo<FlattenedRentalCard[]>(() => {
    const qFolded = foldVietnameseText(searchQuery);
    const cards: FlattenedRentalCard[] = [];

    for (const biz of rentals) {
      if (!matchesDestination(biz.destination, biz.address)) continue;
      if (onlyReadyToBook && !biz.acceptingNew) continue;

      const items = (biz.items || []).filter((it) => isRentalItemActive(it));
      for (const item of items) {
        if (rentalSubcategory !== "ALL" && String(item.category) !== rentalSubcategory) {
          // Allow legacy VEHICLE category under motorbike/car search if user filters broadly
          const isVehicleMatch =
            String(item.category) === "VEHICLE" &&
            (rentalSubcategory === "CAR_4_SEATS" || rentalSubcategory === "MOTORBIKE_SCOOTER");
          if (!isVehicleMatch) continue;
        }
        if (qFolded) {
          const itemMatch =
            foldVietnameseText(item.name).includes(qFolded) ||
            foldVietnameseText(item.description).includes(qFolded) ||
            foldVietnameseText(biz.displayName).includes(qFolded) ||
            foldVietnameseText(biz.destination).includes(qFolded) ||
            foldVietnameseText(biz.address).includes(qFolded);
          if (!itemMatch) continue;
        }
        cards.push({ key: `${biz.id}:${item.id}`, business: biz, item });
      }
    }
    return cards;
  }, [matchesDestination, onlyReadyToBook, rentalSubcategory, rentals, searchQuery]);

  const filteredHotels = React.useMemo(() => {
    const qFolded = foldVietnameseText(searchQuery);
    return hotels.filter((h) => {
      if (!matchesDestination(h.destination, h.address)) return false;
      if (onlyReadyToBook && (!h.acceptingNew || !h.hasDirectInventory)) return false;
      if (qFolded) {
        const hit =
          foldVietnameseText(h.displayName).includes(qFolded) ||
          foldVietnameseText(h.destination).includes(qFolded) ||
          foldVietnameseText(h.address).includes(qFolded);
        if (!hit) return false;
      }
      return true;
    });
  }, [hotels, matchesDestination, onlyReadyToBook, searchQuery]);

  const filteredRestaurants = React.useMemo(() => {
    const qFolded = foldVietnameseText(searchQuery);
    return restaurants.filter((r) => {
      if (!matchesDestination(r.destination, r.address)) return false;
      if (onlyReadyToBook && r.acceptingNew === false) return false;
      if (qFolded) {
        const inMenu = (r.menu || []).some((m) => foldVietnameseText(m.name).includes(qFolded));
        const inTags = (r.cuisineTags || []).some((tag) => foldVietnameseText(tag).includes(qFolded));
        const hit =
          foldVietnameseText(r.displayName).includes(qFolded) ||
          foldVietnameseText(r.destination).includes(qFolded) ||
          foldVietnameseText(r.address).includes(qFolded) ||
          inMenu ||
          inTags;
        if (!hit) return false;
      }
      return true;
    });
  }, [matchesDestination, onlyReadyToBook, restaurants, searchQuery]);

  const totalCount = rentalCards.length + filteredHotels.length + filteredRestaurants.length;

  const showRentalsSection = activeCategory === "all" || activeCategory === "rentals";
  const showHotelsSection = activeCategory === "all" || activeCategory === "hotels";
  const showRestaurantsSection = activeCategory === "all" || activeCategory === "restaurants";

  const handleCategoryChange = (cat: ServiceDiscoveryCategory) => {
    setActiveCategory(cat);
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("category", cat);
    router.replace(`/services?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">
                {t("servicesDiscovery.title", { defaultValue: "Dịch vụ & Đặt chỗ" })}
              </h1>
              <p className="text-micro text-muted-foreground hidden sm:block">
                {t("servicesDiscovery.subtitle", {
                  defaultValue: "Tìm nhanh dịch vụ cho thuê, phòng nghỉ & nhà hàng đang mở đặt",
                })}
              </p>
            </div>
          </div>

          <nav
            aria-label="Service marketplace navigation"
            className="flex items-center rounded-full bg-muted/80 p-1 border border-border/80"
          >
            <span className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold bg-background text-foreground shadow-xs">
              <Store className="h-3.5 w-3.5 text-teal-600" />
              <span>{t("servicesDiscovery.navExplore", { defaultValue: "Tìm dịch vụ" })}</span>
            </span>

            <Link
              href="/reservations"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>{t("nav.myReservations", { defaultValue: "Đơn đặt của tôi" })}</span>
              {userBadgeCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-rose-500 text-white text-micro font-bold leading-none">
                  {userBadgeCount > 99 ? "99+" : userBadgeCount}
                </span>
              )}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative h-8 w-8 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              {userBadgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Search & Filter Panel */}
        <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("servicesDiscovery.searchPlaceholder", {
                  defaultValue: "Tìm thuê xe máy, ô tô VF3, lều cắm trại, SUP, khách sạn, nhà hàng...",
                })}
                className="h-11 pl-10 pr-9 rounded-xl bg-muted/30 border-border text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setOnlyReadyToBook((prev) => !prev)}
                className={cn(
                  "h-11 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer",
                  onlyReadyToBook
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{t("servicesDiscovery.readyOnly", { defaultValue: "Sẵn sàng đặt ngay" })}</span>
              </button>

              <Button
                type="button"
                variant="outline"
                onClick={() => void loadServices(searchQuery)}
                disabled={loading}
                className="h-11 rounded-xl text-xs gap-1.5"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                <span className="hidden sm:inline">{t("common.refresh", { defaultValue: "Làm mới" })}</span>
              </Button>
            </div>
          </div>

          {/* City Chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-teal-600" />
              <span>{t("servicesDiscovery.area", { defaultValue: "Khu vực:" })}</span>
            </span>
            {DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                onClick={() => setSelectedDestination(dest)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0",
                  selectedDestination === dest
                    ? "bg-foreground text-background shadow-xs"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {dest}
              </button>
            ))}
          </div>

          {/* Primary Service Kind Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pt-1 border-t border-border/50">
            {(
              [
                {
                  id: "all",
                  label: t("servicesDiscovery.catAll", { defaultValue: "Tất cả có sẵn" }),
                  count: totalCount,
                  icon: Sparkles,
                },
                {
                  id: "rentals",
                  label: t("servicesDiscovery.catRentals", { defaultValue: "Thuê xe & Thiết bị" }),
                  count: rentalCards.length,
                  icon: Car,
                },
                {
                  id: "hotels",
                  label: t("servicesDiscovery.catHotels", { defaultValue: "Khách sạn có phòng" }),
                  count: filteredHotels.length,
                  icon: Building2,
                },
                {
                  id: "restaurants",
                  label: t("servicesDiscovery.catRestaurants", { defaultValue: "Nhà hàng & Quán ăn" }),
                  count: filteredRestaurants.length,
                  icon: Utensils,
                },
              ] as const
            ).map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0",
                    isSelected
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground border border-border/70 hover:bg-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-micro font-bold leading-none",
                      isSelected
                        ? "bg-background/20 text-background"
                        : "bg-background text-foreground/80 border border-border/60",
                    )}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Subcategory filter for Rental items */}
          {showRentalsSection && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
              {RENTAL_SUBCATEGORIES.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setRentalSubcategory(sub.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0",
                    rentalSubcategory === sub.id
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20",
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* Stay dates filter when focusing on Hotels */}
          {activeCategory === "hotels" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/50">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Ngày nhận phòng
                </label>
                <Input
                  type="date"
                  value={hotelCriteria.checkIn}
                  onChange={(e) =>
                    setHotelCriteria((prev) => ({ ...prev, checkIn: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Ngày trả phòng
                </label>
                <Input
                  type="date"
                  value={hotelCriteria.checkOut}
                  onChange={(e) =>
                    setHotelCriteria((prev) => ({ ...prev, checkOut: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Số khách
                </label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={hotelCriteria.guests}
                  onChange={(e) =>
                    setHotelCriteria((prev) => ({
                      ...prev,
                      guests: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                  Số phòng
                </label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={hotelCriteria.quantity}
                  onChange={(e) =>
                    setHotelCriteria((prev) => ({
                      ...prev,
                      quantity: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}
        </section>

        {error && (
          <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Results Feed */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted/40 border border-border animate-pulse" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Compass className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-foreground">
                Không tìm thấy dịch vụ phù hợp
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Hãy thử xóa từ khóa tìm kiếm, chọn khu vực &ldquo;Tất cả&rdquo;, hoặc tắt bộ lọc &ldquo;Sẵn sàng đặt ngay&rdquo;.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {searchQuery && (
                  <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
                    Xóa từ khóa
                  </Button>
                )}
                {selectedDestination !== "Tất cả" && (
                  <Button size="sm" variant="outline" onClick={() => setSelectedDestination("Tất cả")}>
                    Xem tất cả khu vực
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* 1. Rental Items Section */}
            {showRentalsSection && rentalCards.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-teal-600" />
                    <h2 className="text-base font-bold text-foreground">
                      Thuê xe & Thiết bị sẵn sàng đặt ({rentalCards.length})
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rentalCards.map(({ key, business, item }) => {
                    const cat = getRentalCategoryMeta(item.category);
                    const imgUrl = toSafeDisplayImageUrl(item.thumbnailUrl || item.images?.[0]);
                    const hasDelivery = supportsRentalDelivery(item);
                    const canBook = business.acceptingNew && isRentalItemActive(item);

                    return (
                      <Card
                        key={key}
                        className="overflow-hidden border-border/80 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          {imgUrl ? (
                            <div className="aspect-[16/9] bg-muted overflow-hidden border-b border-border/40 relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[16/9] bg-teal-500/5 border-b border-border/40 flex flex-col items-center justify-center gap-1 text-teal-700/70">
                              <span className="text-3xl">{cat.icon}</span>
                              <span className="text-[11px] font-medium">{cat.label}</span>
                            </div>
                          )}

                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 text-micro gap-1"
                              >
                                <span>{cat.icon}</span> {cat.shortLabel}
                              </Badge>
                              <div className="flex items-center gap-1">
                                {business.verifiedPartner && (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-micro gap-0.5"
                                  >
                                    <ShieldCheck className="h-3 w-3" /> Verified
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={
                                    canBook
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-micro"
                                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 text-micro"
                                  }
                                >
                                  {canBook ? `Sẵn ${item.totalInventory} xe/bộ` : "Tạm ngưng"}
                                </Badge>
                              </div>
                            </div>

                            <h3 className="text-sm font-bold text-foreground line-clamp-1">
                              {item.name}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                              <Store className="h-3 w-3 shrink-0" />
                              <span className="truncate">{business.displayName}</span>
                            </p>
                            {(business.destination || business.address) && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {business.address || business.destination}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="rounded-xl bg-muted/40 p-2.5 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Giá thuê:</span>
                              <span className="font-bold text-sm text-foreground">
                                {formatVnd(item.pricePerDay)}
                                <span className="text-[11px] font-normal text-muted-foreground"> / ngày</span>
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 dark:text-teal-300">
                              <Truck className="h-3.5 w-3.5" />
                              {hasDelivery ? "Giao tận nơi" : "Tại cửa hàng"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              disabled={!canBook}
                              onClick={() => setBookingRental({ item, business })}
                              className="flex-1 h-9 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 cursor-pointer"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Đặt thuê ngay</span>
                            </Button>

                            <Button asChild variant="outline" size="sm" className="h-9 text-xs px-2.5">
                              <Link href={`/rentals/${business.id}`} title="Xem trang cơ sở">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>

                            {business.ownerUserId && (
                              <Button asChild variant="outline" size="sm" className="h-9 text-xs px-2.5">
                                <Link href={`/chat?userId=${business.ownerUserId}`} title="Nhắn tin với chủ xe">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. Partner Hotels Section */}
            {showHotelsSection && filteredHotels.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-bold text-foreground">
                      Khách sạn đối tác sẵn phòng ({filteredHotels.length})
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredHotels.map((hotel) => {
                    const canBook = Boolean(hotel.acceptingNew && hotel.hasDirectInventory);
                    return (
                      <Card
                        key={hotel.id}
                        className="overflow-hidden border-border/80 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
                      >
                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-micro border-primary/30 bg-primary/10 text-primary">
                              Khách sạn / Lưu trú
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                canBook
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 text-micro"
                                  : "border-muted text-muted-foreground text-micro"
                              }
                            >
                              {canBook ? "Đặt phòng ngay" : "Liên hệ trực tiếp"}
                            </Badge>
                          </div>

                          <h3 className="text-sm font-bold text-foreground line-clamp-1">
                            {hotel.displayName}
                          </h3>
                          {(hotel.address || hotel.destination) && (
                            <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{hotel.address || hotel.destination}</span>
                            </p>
                          )}
                        </div>

                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="rounded-xl bg-muted/40 p-2.5 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Giá từ:</span>
                              <span className="font-bold text-sm text-foreground">
                                {hotel.minPricePerNight
                                  ? `${formatVnd(hotel.minPricePerNight)} / đêm`
                                  : "Xem phòng trống"}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              Nhận {hotel.checkInTime || "14:00"} · Trả {hotel.checkOutTime || "11:00"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => setSelectedHotelPartner(hotel)}
                              className="flex-1 h-9 text-xs font-semibold gap-1.5 cursor-pointer"
                            >
                              <Building2 className="h-3.5 w-3.5" />
                              <span>Chọn phòng & Đặt ngay</span>
                            </Button>
                            {hotel.ownerUserId && (
                              <Button asChild variant="outline" size="sm" className="h-9 text-xs px-2.5">
                                <Link href={`/chat?userId=${hotel.ownerUserId}`} title="Nhắn tin">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 3. Partner Restaurants Section */}
            {showRestaurantsSection && filteredRestaurants.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-amber-600" />
                    <h2 className="text-base font-bold text-foreground">
                      Nhà hàng & Quán ăn mở đặt bàn ({filteredRestaurants.length})
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRestaurants.map((rest) => {
                    const firstMenuPhoto = (rest.menu || [])
                      .map((m) => toSafeDisplayImageUrl(m.imageUrl))
                      .find(Boolean);

                    return (
                      <Card
                        key={rest.id}
                        className="overflow-hidden border-border/80 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          {firstMenuPhoto ? (
                            <div className="aspect-[16/9] bg-muted overflow-hidden border-b border-border/40">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={firstMenuPhoto}
                                alt={rest.displayName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null}

                          <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-micro border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                Ẩm thực / Đặt bàn
                              </Badge>
                              {rest.verifiedPartner && (
                                <Badge variant="outline" className="text-micro border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                                  Verified
                                </Badge>
                              )}
                            </div>

                            <h3 className="text-sm font-bold text-foreground line-clamp-1">
                              {rest.displayName}
                            </h3>
                            {(rest.address || rest.destination) && (
                              <p className="text-xs text-muted-foreground line-clamp-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{rest.address || rest.destination}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <CardContent className="p-4 pt-0 space-y-3">
                          <div className="rounded-xl bg-muted/40 p-2.5 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {rest.menu?.length ? `${rest.menu.length} món thực đơn` : "Đặt bàn giữ chỗ miễn phí"}
                            </span>
                            {rest.openingHours && (
                              <span className="text-[11px] font-medium text-foreground">
                                {rest.openingHours}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => setBookingRestaurant(rest)}
                              className="flex-1 h-9 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 cursor-pointer"
                            >
                              <Utensils className="h-3.5 w-3.5" />
                              <span>Đặt bàn ngay</span>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-9 text-xs px-2.5">
                              <Link href={`/restaurants/${rest.id}`} title="Xem thực đơn chi tiết">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            {rest.ownerUserId && (
                              <Button asChild variant="outline" size="sm" className="h-9 text-xs px-2.5">
                                <Link href={`/chat?userId=${rest.ownerUserId}`} title="Nhắn tin với quán">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Quick Rental Booking Modal */}
      {bookingRental && (
        <RentalReservationDialog
          rentalItem={bookingRental.item}
          ownerUserId={bookingRental.business.ownerUserId}
          businessName={bookingRental.business.displayName}
          open={Boolean(bookingRental)}
          onOpenChange={(open) => {
            if (!open) setBookingRental(null);
          }}
        />
      )}

      {/* Quick Restaurant Booking Modal */}
      {bookingRestaurant && (
        <RestaurantReservationDialog
          businessId={bookingRestaurant.id}
          restaurantName={bookingRestaurant.displayName}
          ownerUserId={bookingRestaurant.ownerUserId}
          open={Boolean(bookingRestaurant)}
          onOpenChange={(open) => {
            if (!open) setBookingRestaurant(null);
          }}
        />
      )}

      {/* Hotel Room Detail Overlay Drawer */}
      {selectedHotelPartner && (
        <div className="fixed inset-0 z-50 bg-background/75 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl h-full bg-background border-l border-border shadow-2xl overflow-hidden">
            <MindtripHotelDetailOverlay
              key={`${selectedHotelPartner.id}:${hotelCriteria.checkIn}:${hotelCriteria.checkOut}:${hotelCriteria.guests}:${hotelCriteria.quantity}`}
              hotel={toMindtripHotel(selectedHotelPartner)}
              hotelPartner={selectedHotelPartner}
              checkInDate={hotelCriteria.checkIn}
              checkOutDate={hotelCriteria.checkOut}
              guestCount={hotelCriteria.guests}
              quantity={hotelCriteria.quantity}
              onClose={() => setSelectedHotelPartner(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
