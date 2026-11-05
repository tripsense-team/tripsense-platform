"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  UtensilsCrossed,
  Compass,
  Calendar,
  Users,
  Clock,
  CheckCheck,
  XCircle,
  AlertCircle,
  Ban,
  ArrowRight,
  Loader2,
  Sparkles,
  Ticket,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ReservationOfferPreview } from "../types/chat.types";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

export interface ReservationOfferCardProps {
  offer: ReservationOfferPreview;
  isMe: boolean;
  onAccept?: (offerId: string) => Promise<void> | void;
  onDecline?: (offerId: string, reason?: string) => Promise<void> | void;
  onCancel?: (offerId: string) => Promise<void> | void;
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

export function ReservationOfferCard({
  offer,
  isMe,
  onAccept,
  onDecline,
  onCancel,
  className,
}: ReservationOfferCardProps) {
  const { t } = useTranslation();
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isDeclining, setIsDeclining] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = React.useState(false);
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [declineReason, setDeclineReason] = React.useState("");

  // Countdown timer for pending offers
  const [remainingTime, setRemainingTime] = React.useState<string>("");
  const [isExpiredLocal, setIsExpiredLocal] = React.useState(false);

  React.useEffect(() => {
    if (offer.status !== "PENDING" || !offer.expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const expires = Date.parse(offer.expiresAt);
      const diff = expires - now;

      if (diff <= 0) {
        setRemainingTime(t("chat.offer.expiredAt"));
        setIsExpiredLocal(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setRemainingTime(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setRemainingTime(`${hours}h ${minutes}m`);
      } else {
        setRemainingTime(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [offer.expiresAt, offer.status, t]);

  const handleAccept = async () => {
    if (!onAccept || isAccepting) return;
    setIsAccepting(true);
    try {
      await onAccept(offer.id);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleConfirmDecline = async () => {
    if (!onDecline || isDeclining) return;
    setIsDeclining(true);
    try {
      await onDecline(offer.id, declineReason.trim() || undefined);
      setShowDeclineDialog(false);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!onCancel || isCancelling) return;
    setIsCancelling(true);
    try {
      await onCancel(offer.id);
      setShowCancelDialog(false);
    } finally {
      setIsCancelling(false);
    }
  };

  const isHotel = offer.businessType === "HOTEL";
  const isRestaurant = offer.businessType === "RESTAURANT";
  const isRental = offer.businessType === "RENTAL";
  const isPending = offer.status === "PENDING" && !isExpiredLocal;
  const isAccepted = offer.status === "ACCEPTED";
  const isDeclined = offer.status === "DECLINED";
  const isCancelled = offer.status === "CANCELLED";
  const isExpired = offer.status === "EXPIRED" || (offer.status === "PENDING" && isExpiredLocal);

  const reservationHubUrl = `/reservations?tab=${
    isRestaurant ? "restaurants" : isRental ? "rentals" : "hotels"
  }${offer.bookingId ? `&bookingId=${offer.bookingId}` : ""}`;

  return (
    <>
      <div
        className={cn(
          "w-full max-w-[390px] sm:max-w-[420px] rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all text-left",
          isAccepted && "border-emerald-500/40 bg-emerald-50/15 dark:bg-emerald-950/10",
          (isDeclined || isCancelled || isExpired) && "opacity-85 border-border/80 bg-muted/20",
          className
        )}
      >
        {/* Header Ribbon / Status Bar */}
        <div className="px-4 py-2.5 bg-muted/50 border-b border-border/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            {isHotel ? (
              <Building2 className="h-4 w-4" />
            ) : isRestaurant ? (
              <UtensilsCrossed className="h-4 w-4" />
            ) : isRental ? (
              <Car className="h-4 w-4 text-teal-600" />
            ) : (
              <Compass className="h-4 w-4" />
            )}
            <span className="truncate max-w-[170px]">{offer.businessName}</span>
          </div>

          {/* Status Badge */}
          {isPending && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
              <Clock className="h-3 w-3 animate-pulse" />
              <span>{remainingTime ? t("chat.offer.expiresIn", { time: remainingTime }) : t("chat.offer.statusPending")}</span>
            </span>
          )}

          {isAccepted && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full shrink-0">
              <CheckCheck className="h-3.5 w-3.5" />
              <span>{t("chat.offer.statusAccepted")}</span>
            </span>
          )}

          {isDeclined && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full shrink-0">
              <XCircle className="h-3 w-3" />
              <span>{t("chat.offer.statusDeclined")}</span>
            </span>
          )}

          {isCancelled && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
              <Ban className="h-3 w-3" />
              <span>{t("chat.offer.statusCancelled")}</span>
            </span>
          )}

          {isExpired && !isCancelled && !isDeclined && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
              <AlertCircle className="h-3 w-3" />
              <span>{t("chat.offer.statusExpired")}</span>
            </span>
          )}
        </div>

        {/* Offer Body */}
        <div className="p-4 space-y-3">
          {/* Tag & Item Title */}
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {isRestaurant ? (
                <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
              ) : isRental ? (
                <Car className="h-3.5 w-3.5 text-teal-600" />
              ) : (
                <Ticket className="h-3.5 w-3.5 text-primary" />
              )}
              <span>
                {isRestaurant
                  ? t("chat.offer.restaurantTag", { defaultValue: "Phiếu đặt bàn nhà hàng" })
                  : isRental
                  ? "Thuê phương tiện & dịch vụ"
                  : t("chat.offer.tag")}
              </span>
            </div>
            <h4 className="text-base font-bold text-foreground leading-snug line-clamp-2">
              {offer.itemTitle}
            </h4>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/40">
            {/* Dates / Time */}
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" />
                {isRestaurant
                  ? t("chat.offer.restaurantMealDate", { defaultValue: "Thời gian đến" })
                  : t("chat.offer.checkIn")}
              </span>
              <p className="font-medium text-foreground">
                {isRestaurant ? (
                  <>
                    {offer.reservationTime ? (
                      <span className="font-bold text-primary mr-1">{offer.reservationTime}</span>
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

            {/* Guests */}
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80 flex items-center gap-1">
                <Users className="h-3 w-3 text-primary" />
                {t("chat.offer.guests")}
              </span>
              <p className="font-medium text-foreground">
                {offer.adultsCount} {t("chat.offer.adults")}
                {offer.childrenCount > 0 ? `, ${offer.childrenCount} ${t("chat.offer.children")}` : ""}
              </p>
            </div>
          </div>

          {/* Inclusions */}
          {offer.inclusions && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg border border-primary/10">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span className="line-clamp-2 leading-relaxed">
                <span className="font-semibold text-foreground mr-1">
                  {isRestaurant
                    ? `${t("chat.offer.restaurantNotes", { defaultValue: "Ghi chú xếp bàn" })}:`
                    : ""}
                </span>
                {offer.inclusions}
              </span>
            </div>
          )}

          {/* Price & Booking Code Block */}
          <div className="pt-2 border-t border-dashed border-border flex items-baseline justify-between gap-2">
            <div>
              <span className="text-[11px] uppercase font-semibold text-muted-foreground block mb-0.5">
                {isRestaurant
                  ? t("chat.offer.restaurantPriceLabel", { defaultValue: "Chi phí đặt bàn" })
                  : t("chat.offer.totalPrice")}
              </span>
              {isRestaurant && (!offer.totalPrice || offer.totalPrice <= 0) ? (
                <div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {t("chat.offer.freeTableReservation", { defaultValue: "Miễn phí đặt bàn (0 ₫)" })}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {t("chat.offer.payAtRestaurantNote", {
                      defaultValue: "Thanh toán món ăn trực tiếp tại quán sau khi dùng bữa",
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-lg font-bold text-primary">
                    {formatCurrency(offer.totalPrice, offer.currency)}
                  </div>
                  {isRestaurant && (
                    <div className="text-[11px] text-muted-foreground">
                      {t("chat.offer.depositNote", { defaultValue: "(Tiền cọc giữ chỗ)" })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isAccepted && offer.bookingCode && (
              <div className="text-right">
                <span className="text-xs uppercase font-semibold text-muted-foreground">
                  {t("chat.offer.bookingCodeLabel")}
                </span>
                <div className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                  {`#${offer.bookingCode}`}
                </div>
              </div>
            )}
          </div>

          {/* Decline Reason if present */}
          {isDeclined && offer.declineReason && (
            <div className="text-xs text-muted-foreground bg-destructive/5 p-2 rounded-lg border border-destructive/10">
              <span className="font-semibold">{t("chat.offer.declineReasonLabel")}:</span> {offer.declineReason}
            </div>
          )}

          {/* Actions Section */}
          <div className="pt-2">
            {/* When Pending */}
            {isPending && (
              <div className="flex items-center gap-2">
                {!isMe ? (
                  <>
                    <Button
                      size="sm"
                      onClick={handleAccept}
                      disabled={isAccepting || isDeclining}
                      className="flex-1 h-9 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs gap-1.5"
                    >
                      {isAccepting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCheck className="h-4 w-4" />
                      )}
                      <span>
                        {isRestaurant
                          ? t("chat.offer.acceptRestaurantAction")
                          : t("chat.offer.acceptAction")}
                      </span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowDeclineDialog(true)}
                      disabled={isAccepting || isDeclining}
                      className="h-9 px-3 rounded-xl text-muted-foreground hover:text-destructive hover:border-destructive/40"
                    >
                      <span>{t("chat.offer.declineAction")}</span>
                    </Button>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground italic">
                      {t("chat.offer.statusPending")}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowCancelDialog(true)}
                      disabled={isCancelling}
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive rounded-lg"
                    >
                      {t("chat.offer.cancelAction")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* When Accepted */}
            {isAccepted && (
              <Button
                asChild
                size="sm"
                className="w-full h-9 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
              >
                <Link href={reservationHubUrl}>
                  <span>{t("chat.offer.viewReservations")}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Decline Reason Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.offer.declineDialogTitle")}</DialogTitle>
            <DialogDescription>{t("chat.offer.declineDialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              {t("chat.offer.declineReasonLabel")}
            </label>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t("chat.offer.declineReasonPlaceholder")}
              rows={3}
              maxLength={200}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowDeclineDialog(false)}
              disabled={isDeclining}
            >
              {t("chat.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDecline}
              disabled={isDeclining}
              className="gap-1.5"
            >
              {isDeclining && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{t("chat.offer.confirmDecline")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Offer Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.offer.cancelConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("chat.offer.cancelConfirmDesc")}</DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowCancelDialog(false)}
              disabled={isCancelling}
            >
              {t("chat.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
              className="gap-1.5"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{t("chat.offer.cancelAction")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}