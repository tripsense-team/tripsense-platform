"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarCheck,
  Building2,
  Utensils,
  Compass,
  Ticket,
  Car,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserBookingsView } from "@/features/hotels";
import { CustomerReservationsView } from "@/features/partner";
import {
  getMyRentalBookings,
  cancelMyRentalBooking,
} from "@/features/partner/services/rental-api";
import type { RentalBookingOrderDto } from "@/features/partner/types";
import { chatApi } from "@/features/chat/services/chat-api";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";
import { InChatReservationCard } from "./in-chat-reservation-card";
import { useTranslation } from "@/i18n";

interface UnifiedReservationsHubProps {
  defaultTab?: "hotels" | "restaurants" | "rentals";
}

export function UnifiedReservationsHub({
  defaultTab = "hotels",
}: UnifiedReservationsHubProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam === "restaurants" || tabParam === "hotels" || tabParam === "rentals"
      ? tabParam
      : defaultTab;

  const [activeTab, setActiveTab] = React.useState<string>(initialTab);
  const [chatOffers, setChatOffers] = React.useState<ReservationOfferPreview[]>([]);
  const [rentalOrders, setRentalOrders] = React.useState<RentalBookingOrderDto[]>([]);
  const [loadingRentals, setLoadingRentals] = React.useState(false);
  const [cancellingRentalId, setCancellingRentalId] = React.useState<string | null>(null);
  const targetBookingId = searchParams.get("bookingId");

  React.useEffect(() => {
    let canceled = false;
    chatApi
      .myOffers("ACCEPTED")
      .then((offers) => {
        if (!canceled && Array.isArray(offers)) {
          setChatOffers(offers);
        }
      })
      .catch(() => {
        // Silently fail if unauthenticated or network error
      });
    return () => {
      canceled = true;
    };
  }, []);

  const hotelOffers = React.useMemo(
    () => chatOffers.filter((o) => o.businessType === "HOTEL" || o.businessType === "GUIDE"),
    [chatOffers]
  );
  const restaurantOffers = React.useMemo(
    () => chatOffers.filter((o) => o.businessType === "RESTAURANT"),
    [chatOffers]
  );
  const rentalOffers = React.useMemo(
    () => chatOffers.filter((o) => o.businessType === "RENTAL"),
    [chatOffers]
  );

  const loadRentalOrders = React.useCallback(async () => {
    setLoadingRentals(true);
    try {
      const orders = await getMyRentalBookings();
      setRentalOrders(Array.isArray(orders) ? orders : []);
    } catch {
      // unauthenticated or network error
    } finally {
      setLoadingRentals(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === "rentals") {
      void loadRentalOrders();
    }
  }, [activeTab, loadRentalOrders]);

  const handleCancelRental = async (orderId: string) => {
    if (!confirm("Bạn có chắc muốn hủy đơn đặt thuê này?")) return;
    setCancellingRentalId(orderId);
    try {
      await cancelMyRentalBooking(orderId);
      await loadRentalOrders();
    } catch {
      // handled
    } finally {
      setCancellingRentalId(null);
    }
  };

  React.useEffect(() => {
    if (tabParam === "restaurants" || tabParam === "hotels" || tabParam === "rentals") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    router.replace(`/reservations?tab=${val}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Page Header */}
      <div className="border-b border-border/70 bg-card/60 backdrop-blur-md px-4 sm:px-6 py-6 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-xs shrink-0">
                <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
                  {t("nav.myReservations", { defaultValue: "Đơn đặt của tôi" })}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {t("reservations.hubSubtitle", {
                    defaultValue: "Quản lý tập trung các đặt phòng khách sạn và yêu cầu đặt bàn ăn uống của bạn.",
                  })}
                </p>
              </div>
            </div>

            {/* Quick Explore Link */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => router.push(activeTab === "hotels" ? "/hotels" : "/explore")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors"
              >
                <Compass className="h-3.5 w-3.5 text-primary" />
                <span>
                  {activeTab === "hotels"
                    ? t("trip.hotels.staysDiscovery", { defaultValue: "Tìm thêm phòng" })
                    : t("places.exploreThisArea", { defaultValue: "Khám phá quán ăn" })}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="pt-2">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="h-11 p-1 bg-muted/70 border border-border/60 rounded-xl">
                <TabsTrigger
                  value="hotels"
                  className="gap-2 px-4 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
                >
                  <Building2 className="h-4 w-4" />
                  <span>{t("reservations.tabHotels", { defaultValue: "Khách sạn & Lưu trú" })}</span>
                </TabsTrigger>

                <TabsTrigger
                  value="restaurants"
                  className="gap-2 px-4 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
                >
                  <Utensils className="h-4 w-4" />
                  <span>{t("reservations.tabRestaurants", { defaultValue: "Nhà hàng & Quán ăn" })}</span>
                </TabsTrigger>

                <TabsTrigger
                  value="rentals"
                  className="gap-2 px-4 text-xs sm:text-sm font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs"
                >
                  <Car className="h-4 w-4" />
                  <span>{t("reservations.tabRentals", { defaultValue: "Thuê xe & Dịch vụ" })}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 py-6">
        {activeTab === "hotels" ? (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
            {hotelOffers.length > 0 && (
              <section className="space-y-3" aria-label={t("reservations.inChatTickets", { defaultValue: "Đơn đặt xác nhận qua Chat" })}>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {t("reservations.inChatTickets", { defaultValue: "Đơn đặt xác nhận qua Chat" })} ({hotelOffers.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotelOffers.map((offer) => (
                    <InChatReservationCard
                      key={offer.id}
                      offer={offer}
                      isTarget={targetBookingId === offer.bookingId || targetBookingId === offer.id}
                    />
                  ))}
                </div>
              </section>
            )}
            <UserBookingsView hideHeader onExploreStays={() => router.push("/hotels")} />
          </div>
        ) : activeTab === "restaurants" ? (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
            <CustomerReservationsView
              hideHeader
              chatOffers={restaurantOffers}
              targetBookingId={targetBookingId}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
            {rentalOffers.length > 0 && (
              <section className="space-y-3" aria-label="Đơn thuê chốt qua Chat">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Đơn thuê chốt qua Chat ({rentalOffers.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rentalOffers.map((offer) => (
                    <InChatReservationCard
                      key={offer.id}
                      offer={offer}
                      isTarget={targetBookingId === offer.bookingId || targetBookingId === offer.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Direct Rental Orders List */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-teal-600" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Đơn đặt thuê phương tiện & dịch vụ ({rentalOrders.length})
                  </h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadRentalOrders}
                  disabled={loadingRentals}
                  className="h-7 text-xs gap-1"
                >
                  <Clock className={`h-3 w-3 ${loadingRentals ? "animate-spin" : ""}`} />
                  Làm mới
                </Button>
              </div>

              {loadingRentals ? (
                <div className="flex min-h-[30vh] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : rentalOrders.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                    <Car className="h-8 w-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">Bạn chưa có đơn đặt thuê nào</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Khám phá các dịch vụ cho thuê xe máy, ô tô tự lái, đồ cắm trại từ các đối tác tin cậy của TripSense.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rentalOrders.map((order) => {
                    const isPending = order.status === "PENDING";
                    const isConfirmed = order.status === "CONFIRMED";
                    const isInUse = order.status === "IN_USE";
                    const isReturned = order.status === "RETURNED";
                    const isCancelled = order.status === "CANCELLED" || order.status === "REJECTED";

                    return (
                      <Card key={order.id} className="overflow-hidden border-border/80 shadow-2xs">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-micro font-mono border-teal-500/30 bg-teal-500/10 text-teal-700">
                                {order.bookingCode}
                              </Badge>
                              <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                                {order.businessName || "Cơ sở đối tác"}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-micro font-semibold uppercase ${
                                isPending
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                                  : isConfirmed || isInUse
                                  ? "border-emerald-600/30 bg-emerald-600/15 text-emerald-700"
                                  : isReturned
                                  ? "border-blue-500/30 bg-blue-500/10 text-blue-600"
                                  : "border-destructive/30 bg-destructive/10 text-destructive"
                              }`}
                            >
                              {isPending
                                ? "Chờ xác nhận"
                                : isConfirmed
                                ? "Đã xác nhận"
                                : isInUse
                                ? "Đang thuê"
                                : isReturned
                                ? "Đã trả đồ"
                                : order.status === "REJECTED"
                                ? "Bị từ chối"
                                : "Đã hủy"}
                            </Badge>
                          </div>

                          <div className="space-y-1.5 text-xs">
                            <div className="font-bold text-sm text-foreground">
                              {order.rentalItemName} <span className="text-muted-foreground font-normal">(x{order.quantity})</span>
                            </div>
                            <div className="text-muted-foreground">
                              Nhận: {new Date(order.pickupAt).toLocaleDateString("vi-VN")} → Trả: {new Date(order.returnAt).toLocaleDateString("vi-VN")}
                            </div>
                            <div className="flex justify-between font-medium">
                              <span className="text-muted-foreground">Tổng tiền thuê:</span>
                              <span className="font-bold text-emerald-600">
                                {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(order.totalAmount)}
                              </span>
                            </div>
                            {order.deliveryAddress && (
                              <div className="text-muted-foreground truncate">
                                Giao tận nơi: {order.deliveryAddress}
                              </div>
                            )}
                          </div>

                          {isPending && (
                            <div className="pt-2 border-t border-border/40 flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={cancellingRentalId === order.id}
                                onClick={() => handleCancelRental(order.id)}
                                className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                              >
                                {cancellingRentalId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Hủy đơn đặt"}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
