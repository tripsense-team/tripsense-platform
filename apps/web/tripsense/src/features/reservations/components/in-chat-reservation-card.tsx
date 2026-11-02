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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReservationOfferPreview } from "@/features/chat/types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

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

  React.useEffect(() => {
    if (isTarget && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isTarget]);

  const isHotel = offer.businessType === "HOTEL";
  const isRestaurant = offer.businessType === "RESTAURANT";

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

        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full shrink-0">
          <CheckCheck className="h-3.5 w-3.5" />
          <span>{t("reservations.statusConfirmed", { defaultValue: "Đã xác nhận" })}</span>
        </span>
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
          <span className="text-[10px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1 mb-0.5">
            <Calendar className="h-3 w-3 text-primary" />
            {isRestaurant ? t("chat.offer.time") : t("chat.offer.checkIn")}
          </span>
          <p className="font-semibold text-foreground">
            {formatOfferDate(offer.checkInDate)}
            {offer.checkOutDate ? ` → ${formatOfferDate(offer.checkOutDate)}` : ""}
            {offer.reservationTime ? ` (${offer.reservationTime})` : ""}
          </p>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground/80 flex items-center gap-1 mb-0.5">
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
          <span className="truncate">{offer.inclusions}</span>
        </div>
      )}

      {/* Price & Action */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            {t("chat.offer.totalPrice")}
          </span>
          <span className="text-base font-black text-primary">
            {formatCurrency(offer.totalPrice, offer.currency)}
          </span>
        </div>

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
  );
}