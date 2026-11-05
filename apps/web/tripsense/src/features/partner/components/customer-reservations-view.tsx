"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Utensils,
  CheckCircle2,
  CheckCheck,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  X,
  ExternalLink,
  Star,
  User,
  Phone,
  RotateCcw,
  Search,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  ReservationReviewModal,
  getStoredReview,
  type ReservationReview,
} from "@/features/reservations";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";
import {
  getMyRestaurantReservations,
  cancelRestaurantReservation,
} from "../services/partner-api";
import type { RestaurantReservationDto } from "../types";

export interface CustomerReservationsViewProps {
  hideHeader?: boolean;
  chatOffers?: ReservationOfferPreview[];
  targetBookingId?: string | null;
}

export type DiningStatus = "UPCOMING" | "COMPLETED" | "REQUESTED" | "EXPIRED" | "REJECTED" | "CANCELLED";

export interface UnifiedDiningReservation {
  id: string;
  source: "CHAT" | "DIRECT";
  bookingCode: string;
  businessId: string;
  businessName: string;
  itemTitle?: string;
  startAt: string;
  formattedDate: string;
  formattedTime: string;
  adults: number;
  children: number;
  totalPrice?: number;
  currency?: string;
  status: DiningStatus;
  specialRequest?: string | null;
  guestName?: string | null;
  phone?: string | null;
  conversationId?: string;
  decisionReason?: string | null;
  cancellationReason?: string | null;
  rawOffer?: ReservationOfferPreview;
  rawDirect?: RestaurantReservationDto;
}

interface ParsedNotes {
  guestName: string | null;
  phone: string | null;
  specialRequest: string | null;
}

function parseReservationNotes(rawNotes?: string | null): ParsedNotes {
  if (!rawNotes) return { guestName: null, phone: null, specialRequest: null };
  const match = rawNotes.match(/^\[Khách đặt:\s*([^|]+)\s*\|\s*SĐT:\s*([^\]]+)\]\s*(.*)$/i);
  if (match) {
    return {
      guestName: match[1]?.trim() || null,
      phone: match[2]?.trim() || null,
      specialRequest: match[3]?.trim() || null,
    };
  }
  return {
    guestName: null,
    phone: null,
    specialRequest: rawNotes.trim(),
  };
}

function formatCurrency(amount: number, currency: string = "VND"): string {
  try {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: currency || "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

type FilterTabKey = "ALL" | "UPCOMING" | "COMPLETED" | "REQUESTED" | "HISTORY";

export function CustomerReservationsView({
  hideHeader = false,
  chatOffers = [],
  targetBookingId,
}: CustomerReservationsViewProps) {
  const { t, locale } = useTranslation();
  const currentLocale = locale === "en" ? "en-US" : "vi-VN";

  const [directReservations, setDirectReservations] = React.useState<RestaurantReservationDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<FilterTabKey>("ALL");
  const [channelFilter, setChannelFilter] = React.useState<"ALL" | "CHAT" | "DIRECT">("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Cancellation state
  const [cancellingItem, setCancellingItem] = React.useState<RestaurantReservationDto | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);

  // Review modal state
  const [reviewModalTarget, setReviewModalTarget] = React.useState<{ id: string; name: string } | null>(null);
  const [storedReviews, setStoredReviews] = React.useState<Record<string, ReservationReview>>({});

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyRestaurantReservations(0, 100);
      setDirectReservations(res.content || []);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể tải danh sách đặt bàn." })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Combine chat offers and direct reservations into a single unified list
  const unifiedList = React.useMemo<UnifiedDiningReservation[]>(() => {
    const list: UnifiedDiningReservation[] = [];

    // 1. In-Chat Offers
    if (Array.isArray(chatOffers)) {
      chatOffers.forEach((offer) => {
        let isPast = false;
        let isoTime = new Date().toISOString();

        try {
          if (offer.checkInDate) {
            const time = offer.reservationTime || "19:00:00";
            const [h = "19", m = "00", s = "00"] = time.split(":");
            const [y, mon, d] = offer.checkInDate.split("-").map(Number);
            const dt = new Date(y, mon - 1, d, Number(h), Number(m), Number(s));
            isoTime = dt.toISOString();
            isPast = dt.getTime() < Date.now();
          }
        } catch {
          // ignore date parse errors
        }

        let status: DiningStatus = "REQUESTED";
        if (offer.status === "ACCEPTED") {
          status = isPast ? "COMPLETED" : "UPCOMING";
        } else if (offer.status === "PENDING") {
          status = isPast ? "EXPIRED" : "REQUESTED";
        } else if (offer.status === "DECLINED") {
          status = "REJECTED";
        } else if (offer.status === "CANCELLED") {
          status = "CANCELLED";
        } else if (offer.status === "EXPIRED") {
          status = "EXPIRED";
        }

        const dateObj = new Date(isoTime);
        const formattedDate = dateObj.toLocaleDateString(currentLocale, {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const formattedTime = offer.reservationTime ? offer.reservationTime.slice(0, 5) : "";

        list.push({
          id: offer.bookingId || offer.id,
          source: "CHAT",
          bookingCode: offer.bookingCode || `TS-RES-${offer.id.slice(-8).toUpperCase()}`,
          businessId: offer.businessId,
          businessName: offer.businessName,
          itemTitle: offer.itemTitle,
          startAt: isoTime,
          formattedDate,
          formattedTime,
          adults: offer.adultsCount,
          children: offer.childrenCount,
          totalPrice: offer.totalPrice,
          currency: offer.currency,
          status,
          specialRequest: offer.inclusions,
          conversationId: offer.conversationId,
          rawOffer: offer,
        });
      });
    }

    // 2. Direct Reservations
    if (Array.isArray(directReservations)) {
      directReservations.forEach((r) => {
        let isPast = false;
        try {
          isPast = new Date(r.startAt).getTime() < Date.now();
        } catch {
          // ignore
        }

        let status: DiningStatus = "REQUESTED";
        if (r.state === "CONFIRMED") {
          status = isPast ? "COMPLETED" : "UPCOMING";
        } else if (r.state === "REQUESTED") {
          status = isPast ? "EXPIRED" : "REQUESTED";
        } else if (r.state === "REJECTED") {
          status = "REJECTED";
        } else if (r.state === "CANCELLED") {
          status = "CANCELLED";
        }

        const parsedNotes = parseReservationNotes(r.notes);
        const dateObj = new Date(r.startAt);
        const formattedDate = dateObj.toLocaleDateString(currentLocale, {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const formattedTime = dateObj.toLocaleTimeString(currentLocale, {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        list.push({
          id: r.id,
          source: "DIRECT",
          bookingCode: `TS-RES-${r.id.slice(-8).toUpperCase()}`,
          businessId: r.businessId,
          businessName: r.businessName || r.businessNameSnapshot || "Nhà hàng đối tác",
          itemTitle: r.businessNameSnapshot || undefined,
          startAt: r.startAt,
          formattedDate,
          formattedTime,
          adults: r.adults,
          children: r.children,
          totalPrice: 0,
          currency: "VND",
          status,
          guestName: parsedNotes.guestName,
          phone: parsedNotes.phone,
          specialRequest: parsedNotes.specialRequest,
          decisionReason: r.decisionReason,
          cancellationReason: r.cancellationReason,
          rawDirect: r,
        });
      });
    }

    // Sort by meal datetime descending (upcoming/recent first)
    return list.sort((a, b) => {
      const timeA = new Date(a.startAt).getTime();
      const timeB = new Date(b.startAt).getTime();
      return timeB - timeA;
    });
  }, [chatOffers, directReservations, currentLocale]);

  // Sync reviews from localStorage
  React.useEffect(() => {
    const map: Record<string, ReservationReview> = {};
    unifiedList.forEach((item) => {
      const rev = getStoredReview(item.id);
      if (rev) map[item.id] = rev;
    });
    setStoredReviews(map);

    const handleReviewUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ reservationId: string; review: ReservationReview }>;
      if (customEvent.detail?.reservationId && customEvent.detail?.review) {
        setStoredReviews((prev) => ({
          ...prev,
          [customEvent.detail.reservationId]: customEvent.detail.review,
        }));
      }
    };
    window.addEventListener("tripsense:review-updated", handleReviewUpdate);
    return () => window.removeEventListener("tripsense:review-updated", handleReviewUpdate);
  }, [unifiedList]);

  // Filter tab counts
  const counts = React.useMemo(() => {
    return {
      all: unifiedList.length,
      upcoming: unifiedList.filter((item) => item.status === "UPCOMING").length,
      completed: unifiedList.filter((item) => item.status === "COMPLETED").length,
      requested: unifiedList.filter((item) => item.status === "REQUESTED").length,
      history: unifiedList.filter((item) => ["EXPIRED", "REJECTED", "CANCELLED"].includes(item.status)).length,
    };
  }, [unifiedList]);

  // Filtered list
  const filtered = React.useMemo(() => {
    return unifiedList.filter((item) => {
      // Channel filter
      if (channelFilter !== "ALL" && item.source !== channelFilter) {
        return false;
      }

      // Tab filter
      if (activeFilter === "UPCOMING" && item.status !== "UPCOMING") return false;
      if (activeFilter === "COMPLETED" && item.status !== "COMPLETED") return false;
      if (activeFilter === "REQUESTED" && item.status !== "REQUESTED") return false;
      if (activeFilter === "HISTORY" && !["EXPIRED", "REJECTED", "CANCELLED"].includes(item.status)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.businessName.toLowerCase().includes(q);
        const matchCode = item.bookingCode.toLowerCase().includes(q);
        const matchItem = item.itemTitle?.toLowerCase().includes(q);
        const matchGuest = item.guestName?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchItem && !matchGuest) return false;
      }

      return true;
    });
  }, [unifiedList, channelFilter, activeFilter, searchQuery]);

  const handleOpenCancel = (item: RestaurantReservationDto) => {
    setCancellingItem(item);
    setCancelReason("");
  };

  const handleConfirmCancel = async () => {
    if (!cancellingItem) return;
    try {
      setCancelling(true);
      setError(null);
      setActionSuccess(null);
      const updated = await cancelRestaurantReservation(cancellingItem.id, {
        expectedVersion: cancellingItem.version,
        reason: cancelReason.trim() || undefined,
      });
      setDirectReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setCancellingItem(null);
      setActionSuccess(t("partner.restaurant.cancelSuccess", { defaultValue: "Đã hủy yêu cầu đặt bàn thành công." }));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
      }
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể hủy yêu cầu đặt bàn." })));
    } finally {
      setCancelling(false);
    }
  };

  const filterTabs: Array<{ key: FilterTabKey; label: string; count: number }> = [
    { key: "ALL", label: t("common.all", { defaultValue: "Tất cả" }), count: counts.all },
    { key: "UPCOMING", label: t("reservations.filterUpcoming", { defaultValue: "Sắp tới" }), count: counts.upcoming },
    { key: "COMPLETED", label: t("reservations.filterCompleted", { defaultValue: "Đã hoàn thành" }), count: counts.completed },
    { key: "REQUESTED", label: t("partner.restaurant.filterRequested", { defaultValue: "Chờ xác nhận" }), count: counts.requested },
    { key: "HISTORY", label: t("reservations.filterHistory", { defaultValue: "Đã hủy / Hết hạn" }), count: counts.history },
  ];

  const renderBadge = (status: DiningStatus) => {
    switch (status) {
      case "UPCOMING":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-medium shadow-2xs gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t("reservations.statusConfirmed", { defaultValue: "Đã xác nhận" })}</span>
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-purple-600 hover:bg-purple-600 text-white font-medium border border-purple-700/20 shadow-2xs gap-1">
            <CheckCheck className="h-3.5 w-3.5" />
            <span>{t("reservations.statusCompleted", { defaultValue: "Đã hoàn thành" })}</span>
          </Badge>
        );
      case "REQUESTED":
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("partner.restaurant.statusRequested", { defaultValue: "Chờ xác nhận" })}</span>
          </Badge>
        );
      case "EXPIRED":
        return (
          <Badge variant="outline" className="border-muted-foreground/30 bg-muted/60 text-muted-foreground font-medium gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("partner.restaurant.statusExpired", { defaultValue: "Hết hạn" })}</span>
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive font-medium gap-1">
            <XCircle className="h-3.5 w-3.5" />
            <span>{t("partner.restaurant.statusRejected", { defaultValue: "Bị từ chối" })}</span>
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="text-muted-foreground font-medium gap-1">
            <X className="h-3.5 w-3.5" />
            <span>{t("partner.restaurant.statusCancelled", { defaultValue: "Đã hủy" })}</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className={hideHeader ? "space-y-5" : "container mx-auto max-w-4xl px-4 py-8 space-y-6"}>
      {/* Top Header */}
      {!hideHeader && (
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 text-muted-foreground text-xs">
            <Link href="/explore">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              {t("common.back", { defaultValue: "Khám phá" })}
            </Link>
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {t("partner.restaurant.myReservationsTitle", { defaultValue: "Lịch sử Đặt bàn của tôi" })}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {t("partner.restaurant.myReservationsSubtitle", {
                    defaultValue: "Theo dõi tình trạng và quản lý các yêu cầu đặt chỗ ăn uống của bạn.",
                  })}
                </p>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-8 text-xs self-start sm:self-auto gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{t("common.refresh", { defaultValue: "Làm mới" })}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Control Bar: Filter Tabs & Search & Refresh */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Status Tabs with Counts */}
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-foreground text-background shadow-xs font-bold"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-micro px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? "bg-background/25 text-background" : "bg-background text-muted-foreground border border-border/50"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box + Refresh */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("reservations.searchDiningPlaceholder", {
                  defaultValue: "Tìm theo tên quán, món ăn hoặc mã đặt bàn...",
                })}
                className="h-8.5 w-full rounded-full border border-border/80 bg-card pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {hideHeader && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="h-8.5 text-xs self-start md:self-auto gap-1.5 shrink-0 rounded-full px-3"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{t("common.refresh", { defaultValue: "Làm mới" })}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Secondary Channel Pills: All / In-Chat / Direct */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
          <span className="text-micro uppercase font-bold text-muted-foreground mr-1">
            {t("reservations.channelAll", { defaultValue: "Kênh đặt:" })}
          </span>
          {[
            { key: "ALL", label: t("common.all", { defaultValue: "Tất cả" }) },
            { key: "CHAT", label: `💬 ${t("reservations.channelChat", { defaultValue: "Qua Chat" })}` },
            { key: "DIRECT", label: `🌐 ${t("reservations.channelDirect", { defaultValue: "Trực tuyến" })}` },
          ].map((ch) => (
            <button
              key={ch.key}
              type="button"
              onClick={() => setChannelFilter(ch.key as "ALL" | "CHAT" | "DIRECT")}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                channelFilter === ch.key
                  ? "bg-primary/10 text-primary border border-primary/25"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Unified Dining Cards List */}
      {loading && directReservations.length === 0 && chatOffers.length === 0 ? (
        <div className="flex h-56 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/70 p-10 text-center rounded-2xl">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("partner.restaurant.noReservationsCustomer", { defaultValue: "Chưa có lượt đặt bàn nào" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
            {searchQuery
              ? "Không tìm thấy lượt đặt bàn nào phù hợp với từ khóa tìm kiếm của bạn."
              : t("partner.restaurant.noReservationsCustomerHelp", {
                  defaultValue: "Khám phá các nhà hàng đối tác trên bản đồ và đặt trước chỗ ngồi cho chuyến đi của bạn.",
                })}
          </p>
          <Button asChild size="sm" className="rounded-xl">
            <Link href="/explore">
              {t("places.exploreThisArea", { defaultValue: "Khám phá nhà hàng" })}
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => {
            const isTarget = targetBookingId === item.bookingCode || targetBookingId === item.id;
            const review = storedReviews[item.id];

            return (
              <Card
                key={`${item.source}-${item.id}`}
                className={`overflow-hidden border transition-all rounded-2xl bg-card shadow-2xs ${
                  isTarget
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md"
                    : "border-border/70 hover:border-border hover:shadow-xs"
                }`}
              >
                {/* Header Bar */}
                <div className="bg-muted/30 px-4 sm:px-5 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Source Tag */}
                    {item.source === "CHAT" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                        <MessageSquare className="h-3 w-3" />
                        <span>{t("reservations.inChatTag", { defaultValue: "Đặt qua Chat" })}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted border border-border/70 px-2.5 py-0.5 rounded-full">
                        <Utensils className="h-3 w-3 text-primary" />
                        <span>{t("reservations.directTag", { defaultValue: "Đặt trực tuyến" })}</span>
                      </span>
                    )}

                    {/* Booking Code Monospace */}
                    {item.bookingCode && (
                      <span className="font-mono text-xs font-bold text-muted-foreground bg-background px-2 py-0.5 rounded border border-border/60">
                        {`#${item.bookingCode}`}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>{renderBadge(item.status)}</div>
                </div>

                {/* Card Content */}
                <CardContent className="p-4 sm:p-5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Restaurant Info & Title */}
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Utensils className="h-4 w-4 text-primary shrink-0" />
                        <Link
                          href={`/restaurants/${item.businessId}`}
                          className="text-base sm:text-lg font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group truncate"
                        >
                          <span className="truncate group-hover:underline">{item.businessName}</span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 group-hover:text-primary shrink-0" />
                        </Link>
                      </div>

                      {item.itemTitle && item.itemTitle !== item.businessName && (
                        <p className="text-xs font-semibold text-muted-foreground line-clamp-1">
                          {item.itemTitle}
                        </p>
                      )}
                    </div>

                    {/* Price Snapshot */}
                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-micro uppercase font-bold text-muted-foreground block mb-0.5">
                        {t("reservations.priceLabel", { defaultValue: "Chi phí đặt bàn" })}
                      </span>
                      {!item.totalPrice || item.totalPrice <= 0 ? (
                        <div>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block">
                            {t("reservations.freeTable", { defaultValue: "Miễn phí đặt bàn (0 ₫)" })}
                          </span>
                          <span className="text-micro text-muted-foreground">
                            {t("reservations.payAtPlace", { defaultValue: "Thanh toán sau tại quán" })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-base font-bold text-primary">
                          {formatCurrency(item.totalPrice, item.currency)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Key Info Pills Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs bg-muted/40 p-3 rounded-xl border border-border/40">
                    {/* Meal Time */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-micro uppercase font-bold text-muted-foreground block">
                          {t("reservations.mealTime", { defaultValue: "Thời gian đến" })}
                        </span>
                        <span className="font-semibold text-foreground truncate block">
                          {item.formattedTime ? `${item.formattedTime} - ` : ""}
                          {item.formattedDate}
                        </span>
                      </div>
                    </div>

                    {/* Guests Count */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-micro uppercase font-bold text-muted-foreground block">
                          {t("reservations.guests", { defaultValue: "Số lượng khách" })}
                        </span>
                        <span className="font-semibold text-foreground truncate block">
                          {item.adults} {t("chat.offer.adults", { defaultValue: "Người lớn" })}
                          {item.children > 0 && `, ${item.children} ${t("chat.offer.children", { defaultValue: "Trẻ em" })}`}
                        </span>
                      </div>
                    </div>

                    {/* Contact (if direct or available) */}
                    {(item.guestName || item.phone) ? (
                      <div className="flex items-center gap-2.5 sm:col-span-2 md:col-span-1">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-micro uppercase font-bold text-muted-foreground block">
                            {t("reservations.guestContact", { defaultValue: "Người đặt bàn" })}
                          </span>
                          <span className="font-semibold text-foreground truncate block font-mono text-xs">
                            {item.guestName || ""}{item.phone ? ` • ${item.phone}` : ""}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Special Request or Seating Notes */}
                  {item.specialRequest && (
                    <div className="flex items-start gap-2 text-xs bg-muted/20 px-3 py-2 rounded-xl border border-border/40">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-muted-foreground">
                        <span className="font-semibold text-foreground mr-1.5">
                          {t("partner.restaurant.specialNotes", { defaultValue: "Ghi chú:" })}
                        </span>
                        {item.specialRequest}
                      </p>
                    </div>
                  )}

                  {/* Partner Feedback / Rejection Notice */}
                  {item.decisionReason && (
                    <div className="text-xs text-amber-900 dark:text-amber-200 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                      <span className="font-semibold">{t("partner.restaurant.decisionReason", { defaultValue: "Phản hồi từ quán:" })}</span>{" "}
                      {item.decisionReason}
                    </div>
                  )}

                  {item.cancellationReason && (
                    <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-xl border border-border/40">
                      <span className="font-semibold">{t("partner.restaurant.cancelReason", { defaultValue: "Lý do hủy:" })}</span>{" "}
                      {item.cancellationReason}
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                    {/* Left Channel Navigation */}
                    <div className="flex items-center gap-2">
                      {item.conversationId ? (
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-xl">
                          <Link href={`/chat?t=${item.conversationId}`}>
                            <MessageSquare className="h-3.5 w-3.5 text-primary" />
                            <span>{t("reservations.openChat", { defaultValue: "Mở đoạn chat" })}</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-xl">
                          <Link href={`/restaurants/${item.businessId}`} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5 text-primary" />
                            <span>{t("partner.restaurant.viewPublic", { defaultValue: "Xem quán" })}</span>
                          </Link>
                        </Button>
                      )}
                    </div>

                    {/* Right Primary / State Actions */}
                    <div className="flex items-center gap-2">
                      {item.status === "COMPLETED" && (
                        <>
                          {review ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReviewModalTarget({ id: item.id, name: item.businessName })}
                              className="h-8 text-xs font-semibold gap-1.5 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                            >
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                              <span>{review.rating}/5 {t("reservations.starShort", { defaultValue: "sao" })}</span>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => setReviewModalTarget({ id: item.id, name: item.businessName })}
                              className="h-8 text-xs font-bold gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                            >
                              <Star className="h-3.5 w-3.5 fill-current" />
                              <span>{t("reservations.rateExperience", { defaultValue: "⭐ Đánh giá trải nghiệm" })}</span>
                            </Button>
                          )}

                          <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5 rounded-xl hover:bg-primary/10 hover:text-primary">
                            <Link href={`/restaurants/${item.businessId}`}>
                              <RotateCcw className="h-3.5 w-3.5 text-primary" />
                              <span>{t("reservations.bookAgain", { defaultValue: "Đặt lại bàn" })}</span>
                            </Link>
                          </Button>
                        </>
                      )}

                      {/* Cancel direct booking if requested/pending */}
                      {item.status === "REQUESTED" && item.source === "DIRECT" && item.rawDirect && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenCancel(item.rawDirect!)}
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
                        >
                          {t("partner.restaurant.cancelRequestButton", { defaultValue: "Hủy yêu cầu" })}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Experience Modal */}
      {reviewModalTarget && (
        <ReservationReviewModal
          open={true}
          onOpenChange={(open) => {
            if (!open) setReviewModalTarget(null);
          }}
          reservationId={reviewModalTarget.id}
          businessName={reviewModalTarget.name}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancellingItem !== null} onOpenChange={(open) => !open && setCancellingItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("partner.restaurant.cancelModalTitle", { defaultValue: "Hủy yêu cầu đặt bàn" })}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("partner.restaurant.cancelModalDesc", {
                defaultValue: "Bạn có chắc chắn muốn hủy yêu cầu đặt bàn này không?",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={t("partner.restaurant.cancelReasonPlaceholder", {
                defaultValue: "Lý do hủy (thay đổi lịch trình, tìm được quán khác...)",
              })}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancellingItem(null)}
            >
              {t("common.back", { defaultValue: "Quay lại" })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t("partner.restaurant.confirmCancel", { defaultValue: "Xác nhận hủy" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
