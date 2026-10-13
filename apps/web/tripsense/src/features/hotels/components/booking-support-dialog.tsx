"use client";

import * as React from "react";
import {
  HelpCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/services/api-client";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import { useTranslation } from "@/i18n";
import type { HotelBooking } from "../types";

export function BookingSupportDialog({
  booking,
  open,
  onOpenChange,
}: {
  booking: HotelBooking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = React.useState("PAYMENT_OR_REFUND");
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ticketId, setTicketId] = React.useState<string | null>(null);

  const categories = [
    { value: "PAYMENT_OR_REFUND", label: "Vấn đề thanh toán / Yêu cầu hoàn tiền" },
    { value: "DATES_OR_GUESTS", label: "Thay đổi ngày lưu trú hoặc số khách" },
    { value: "CHECK_IN_ISSUE", label: "Sự cố khi nhận phòng tại khách sạn" },
    { value: "OTHER", label: "Hỗ trợ khác" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim() || submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await apiClient<{ success: boolean; data: { id: string } }>(
        "/api/partner-support-cases",
        {
          method: "POST",
          body: JSON.stringify({
            resourceType: "HOTEL_BOOKING",
            resourceId: booking.id,
            category,
            details: `[Đơn #${booking.id} - ${booking.property_name}]: ${details.trim()}`,
          }),
        },
      );

      setTicketId(res.data?.id || "TC-" + Date.now().toString().slice(-6));
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (ticketId) {
      setTimeout(() => {
        setTicketId(null);
        setDetails("");
      }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base font-bold">
              {t("trip.supportTitle", { defaultValue: "Yêu cầu Hỗ trợ Đơn đặt phòng" })}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {booking.property_name} · Mã đơn: {booking.id.slice(0, 8)}...
          </DialogDescription>
        </DialogHeader>

        {ticketId ? (
          <div className="py-4 space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h4 className="font-bold text-sm text-foreground">
              {t("trip.supportSubmittedTitle", { defaultValue: "Đã gửi yêu cầu hỗ trợ!" })}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mã yêu cầu của bạn: <span className="font-mono font-bold text-foreground">{ticketId}</span>. Đội ngũ hỗ trợ và bộ phận đối soát TripSense sẽ phản hồi sớm nhất qua email hoặc tin nhắn.
            </p>
            <Button size="sm" onClick={handleClose} className="mt-2">
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="font-semibold block mb-1">
                {t("trip.supportCategory", { defaultValue: "Vấn đề bạn đang gặp phải" })}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">
                {t("trip.supportDetails", { defaultValue: "Mô tả chi tiết sự cố hoặc yêu cầu *" })}
              </label>
              <Textarea
                required
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Ví dụ: Tôi cần hoàn lại tiền do kế hoạch thay đổi, số tiền bị khấu trừ chưa chính xác..."
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !details.trim()}>
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                {t("common.submit", { defaultValue: "Gửi yêu cầu" })}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
