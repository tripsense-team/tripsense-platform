"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Utensils,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createRestaurantReservation } from "../services/partner-api";
import type { RestaurantReservationDto } from "../types";

export function RestaurantReservationDialog({
  businessId,
  restaurantName,
  open,
  onOpenChange,
}: {
  businessId: string;
  restaurantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [dateTime, setDateTime] = React.useState("");
  const [adults, setAdults] = React.useState("2");
  const [children, setChildren] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdReservation, setCreatedReservation] =
    React.useState<RestaurantReservationDto | null>(null);

  // Set default datetime to tomorrow at 19:00
  React.useEffect(() => {
    if (!dateTime) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(19, 0, 0, 0);
      const isoLocal = new Date(
        tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
      setDateTime(isoLocal);
    }
  }, [dateTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateTime || submitting) return;

    const numAdults = parseInt(adults, 10);
    const numChildren = parseInt(children, 10) || 0;

    if (isNaN(numAdults) || numAdults < 1 || numAdults > 20) {
      setError(t("partner.restaurant.invalidAdults", { defaultValue: "Số người lớn phải từ 1 đến 20." }));
      return;
    }

    if (numAdults + numChildren > 20) {
      setError(t("partner.restaurant.maxGuestsExceeded", { defaultValue: "Tổng số khách tối đa là 20 người." }));
      return;
    }

    const startInstant = new Date(dateTime).toISOString();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh";

    try {
      setSubmitting(true);
      setError(null);
      const requestKey = `res-${businessId}-${Date.now()}`;
      const res = await createRestaurantReservation(
        businessId,
        {
          startAt: startInstant,
          timeZone,
          adults: numAdults,
          children: numChildren,
          notes: notes.trim() || undefined,
        },
        requestKey,
      );
      setCreatedReservation(res);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (createdReservation) {
      setTimeout(() => {
        setCreatedReservation(null);
        setNotes("");
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">
              {t("partner.restaurant.reservationTitle", { defaultValue: "Yêu cầu Đặt bàn & Giữ chỗ" })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {restaurantName}
          </DialogDescription>
        </DialogHeader>

        {createdReservation ? (
          <div className="py-4 space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h4 className="font-bold text-sm text-foreground">
              {t("partner.restaurant.reservationSentTitle", { defaultValue: "Đã gửi yêu cầu đặt bàn!" })}
            </h4>
            <div className="rounded-xl bg-muted/40 p-3.5 text-xs text-left space-y-1.5 border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("partner.restaurant.requestId", { defaultValue: "Mã yêu cầu" })}:</span>
                <span className="font-mono font-bold">{createdReservation.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("partner.restaurant.time", { defaultValue: "Thời gian" })}:</span>
                <span className="font-semibold">
                  {new Date(createdReservation.startAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("partner.restaurant.guests", { defaultValue: "Số khách" })}:</span>
                <span>
                  {createdReservation.adults} {t("partner.restaurant.adults", { defaultValue: "người lớn" })}
                  {createdReservation.children > 0 && `, ${createdReservation.children} trẻ em`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("common.status", { defaultValue: "Trạng thái" })}:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {t("partner.restaurant.statusRequested", { defaultValue: "Chờ nhà hàng xác nhận" })}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("partner.restaurant.reservationSentHelp", {
                defaultValue: "Nhà hàng sẽ kiểm tra sức chứa và phản hồi xác nhận sớm. Bạn có thể theo dõi tiến độ trong danh sách yêu cầu của mình.",
              })}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
                <Link href="/restaurants/reservations" onClick={handleClose}>
                  {t("partner.restaurant.viewMyReservations", { defaultValue: "Đơn đặt bàn của tôi" })}
                </Link>
              </Button>
              <Button size="sm" onClick={handleClose} className="flex-1 text-xs">
                {t("common.close")}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-xl bg-primary/5 p-3 text-muted-foreground text-[11px] leading-relaxed flex items-start gap-2 border border-primary/10">
              <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
              <span>
                {t("partner.restaurant.reservationDisclaimer", {
                  defaultValue: "Yêu cầu đặt bàn của bạn sẽ được gửi tới nhà hàng để xác nhận. Chưa trừ tiền và chưa tính là giữ bàn tự động.",
                })}
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold block">
                  {t("partner.restaurant.dateAndTime", { defaultValue: "Thời gian đến dùng bữa *" })}
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {t("partner.restaurant.timeZoneLabel", { defaultValue: "Múi giờ" })}: Asia/Ho_Chi_Minh (UTC+7)
                </span>
              </div>
              <Input
                type="datetime-local"
                required
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">
                  {t("partner.restaurant.adultsLabel", { defaultValue: "Người lớn (13+) *" })}
                </label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={adults}
                  onChange={(e) => setAdults(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {t("partner.restaurant.childrenLabel", { defaultValue: "Trẻ em (<12)" })}
                </label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  value={children}
                  onChange={(e) => setChildren(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">
                {t("partner.restaurant.specialNotes", { defaultValue: "Ghi chú hoặc yêu cầu đặc biệt" })}
              </label>
              <Textarea
                rows={3}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("partner.restaurant.specialNotesPlaceholder", {
                  defaultValue: "Ví dụ: Cần bàn cạnh cửa sổ, có ghế trẻ em, ăn chay, trang trí kỷ niệm...",
                })}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !dateTime}>
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                {t("partner.restaurant.sendRequest", { defaultValue: "Gửi yêu cầu đặt bàn" })}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
