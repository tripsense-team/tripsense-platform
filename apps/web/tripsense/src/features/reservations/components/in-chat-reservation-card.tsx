"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ticket,
  MessageSquare,
  Calendar,
  Users,
  CheckCheck,
  Building2,
  UtensilsCrossed,
  ArrowRight,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  ReservationReviewModal,
  getStoredReview,
  type ReservationReview,
} from "./reservation-review-modal";

export interface InChatReservationCardProps {
  offer: ReservationOfferPreview;
  isTarget?: boolean;
  className?: string;
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

function formatOfferDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function InChatReservationCard({
  offer,
  isTarget = false,
  className,
}: InChatReservationCardProps) {
  const { t } = useTranslation();
  const cardRef = React.useRef<HTMLDivElement>(null);

  const isHotel = offer.businessType === "HOTEL";
  const isRestaurant = offer.businessType === "RESTAURANT";
  const reservationKey = offer.bookingId || offer.id;

  const [review, setReview] = React.useState<ReservationReview | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = React.useState(false);

  React.useEffect(() => {
    if (isTarget && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isTarget]);

  React.useEffect(() => {
    setReview(getStoredReview(reservationKey));
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ reservationId: string; review: ReservationReview }>;
      if (customEvent.detail?.reservationId === reservationKey) {
        setReview(customEvent.detail.review);
      }
    };
    window.addEventListener("tripsense:review-updated", handleUpdate);
    return () => window.removeEventListener("tripsense:review-updated", handleUpdate);
  }, [reservationKey]);

  const isCompleted = React.useMemo(() => {
    if (offer.status !== "ACCEPTED") return false;
    try {
      if (isRestaurant && offer.checkInDate) {
        const time = offer.reservationTime || "23:59:59";
        const [h = "0", m = "0", s = "0"] = time.split(":");
        const [year, month, day] = offer.checkInDate.split("-").map(Number);
        const dt = new Date(year, month - 1, day, Number(h), Number(m), Number(s));
        return dt.getTime() < Date.now();
      }
      if (offer.checkInDate) {
        const [year, month, day] = offer.checkInDate.split("-").map(Number);
        const dt = new Date(year, month - 1, day, 23, 59, 59);
        return dt.getTime() < Date.now();
      }
    } catch {
      return false;
    }
    return false;
  }, [offer, isRestaurant]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5 text-card-foreground shadow-xs transition-all relative overflow-hidden flex flex-col justify-between gap-3",
        isTarget
          ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-md"
          : "border-border/70 hover:border-border hover:shadow-sm",
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
            <Ticket className="h-3 w-3" />
            <span>{t("reservations.inChatTag", { defaultValue: "Đặt qua Chat" })}</span>
          </span>
          {offer.bookingCode && (
            <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
              {`#${offer.bookingCode}`}
            </span>
          )}
        </div>

        {isCompleted ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 border border-purple-500/20 px-2.5 py-0.5 rounded-full shrink-0 shadow-xs">
            <CheckCheck className="h-3.5 w-3.5" />
            <span>{t("reservations.statusCompleted", { defaultValue: "Đã hoàn thành" })}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full shrink-0">
            <CheckCheck className="h-3.5 w-3.5" />
            <span>{t("reservations.statusConfirmed", { defaultValue: "Đã xác nhận" })}</span>
          </span>
        )}
      </div>

      {/* Property & Item Title */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {isHotel ? (
            <Building2 className="h-3.5 w-3.5 text-primary" />
          ) : (
            <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="truncate">{offer.businessName}</span>
        </div>
        <h3 className="text-base font-bold text-foreground leading-snug line-clamp-1">
          {offer.itemTitle}
        </h3>
      </div>

      {/* Details Box */}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/40">
        <div>
          <span className="text-xs uppercase font-bold text-muted-foreground/80 flex items-center gap-1 mb-0.5">
            <Calendar className="h-3 w-3 text-primary" />
            {isRestaurant
              ? t("chat.offer.restaurantMealDate", { defaultValue: "Thời gian đến" })
              : t("chat.offer.checkIn")}
          </span>
          <p className="font-semibold text-foreground">
            {isRestaurant ? (
              <>
                {offer.reservationTime ? (
                  <span className="font-bold text-primary mr-1">
                    {offer.reservationTime.slice(0, 5)}
                  </span>
                ) : null}
                {formatOfferDate(offer.checkInDate)}
              </>
            ) : (
              <>
                {formatOfferDate(offer.checkInDate)}
                {offer.checkOutDate ? ` → ${formatOfferDate(offer.checkOutDate)}` : ""}
              </>
            )}
          </p>
        </div>

        <div>
          <span className="text-xs uppercase font-bold text-muted-foreground/80 flex items-center gap-1 mb-0.5">
            <Users className="h-3 w-3 text-primary" />
            {t("chat.offer.guests")}
          </span>
          <p className="font-semibold text-foreground">
            {offer.adultsCount} {t("chat.offer.adults")}
            {offer.childrenCount > 0 ? `, ${offer.childrenCount} ${t("chat.offer.children")}` : ""}
          </p>
        </div>
      </div>

      {offer.inclusions && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">
            <span className="font-semibold text-foreground mr-1">
              {isRestaurant
                ? `${t("chat.offer.restaurantNotes", { defaultValue: "Ghi chú xếp bàn" })}:`
                : ""}
            </span>
            {offer.inclusions}
          </span>
        </div>
      )}

      {/* Price & Action */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
        <div>
          <span className="text-xs uppercase font-bold text-muted-foreground block mb-0.5">
            {isRestaurant
              ? t("chat.offer.restaurantPriceLabel", { defaultValue: "Chi phí đặt bàn" })
              : t("chat.offer.totalPrice")}
          </span>
          {isRestaurant && (!offer.totalPrice || offer.totalPrice <= 0) ? (
            <div>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block">
                {t("chat.offer.freeTableReservation", { defaultValue: "Miễn phí đặt bàn (0 ₫)" })}
              </span>
              <span className="text-micro text-muted-foreground">
                {t("chat.offer.payAtRestaurantShort", { defaultValue: "Thanh toán sau tại quán" })}
              </span>
            </div>
          ) : (
            <span className="text-base font-bold text-primary">
              {formatCurrency(offer.totalPrice, offer.currency)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCompleted && (
            review ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewModalOpen(true)}
                className="h-8 px-2.5 rounded-xl font-bold text-xs gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{review.rating}/5 sao</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setReviewModalOpen(true)}
                className="h-8 px-3 rounded-xl font-bold text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-colors"
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>{t("reservations.rateExperience", { defaultValue: "⭐ Đánh giá trải nghiệm" })}</span>
              </Button>
            )
          )}

          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 px-3 rounded-xl font-bold text-xs gap-1.5 hover:bg-primary/10 hover:text-primary transition-colors border-border/80"
          >
            <Link href={`/chat?t=${offer.conversationId}`}>
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{t("reservations.openChat", { defaultValue: "Mở đoạn chat" })}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      <ReservationReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        reservationId={reservationKey}
        businessName={offer.businessName || offer.itemTitle}
      />
    </div>
  );
}