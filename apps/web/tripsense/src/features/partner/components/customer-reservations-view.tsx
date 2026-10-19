"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Users,
  Utensils,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  X,
  ExternalLink,
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
  getMyRestaurantReservations,
  cancelRestaurantReservation,
} from "../services/partner-api";
import type { RestaurantReservationDto } from "../types";

interface CustomerReservationsViewProps {
  hideHeader?: boolean;
}

export function CustomerReservationsView({ hideHeader = false }: CustomerReservationsViewProps) {
  const { t } = useTranslation();
  const [reservations, setReservations] = React.useState<RestaurantReservationDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filterState, setFilterState] = React.useState<string>("ALL");
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Cancellation state
  const [cancellingItem, setCancellingItem] = React.useState<RestaurantReservationDto | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyRestaurantReservations(0, 50);
      setReservations(res.content || []);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể tải danh sách đặt bàn." })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

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
      setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setCancellingItem(null);
      const cancelSuccessMsg = t("partner.restaurant.cancelSuccess", { defaultValue: "Đã hủy yêu cầu đặt bàn thành công." });
      setActionSuccess(cancelSuccessMsg);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
        window.dispatchEvent(
          new CustomEvent("app:notification-toast", {
            detail: {
              title: "Đã hủy yêu cầu đặt bàn",
              body: "Yêu cầu đặt bàn của bạn đã được hủy thành công.",
              clickActionUrl: "/reservations?tab=restaurants",
            },
          }),
        );
      }
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể hủy yêu cầu đặt bàn." })));
    } finally {
      setCancelling(false);
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const renderBadge = (state: string) => {
    switch (state) {
      case "REQUESTED":
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
            <Clock className="mr-1 h-3 w-3" />
            {t("partner.restaurant.statusRequested", { defaultValue: "Chờ nhà hàng xác nhận" })}
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-600 text-white font-medium hover:bg-emerald-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t("partner.restaurant.statusConfirmed", { defaultValue: "Đã xác nhận" })}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive font-medium">
            <XCircle className="mr-1 h-3 w-3" />
            {t("partner.restaurant.statusRejected", { defaultValue: "Đã bị từ chối" })}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="text-muted-foreground font-medium">
            <X className="mr-1 h-3 w-3" />
            {t("partner.restaurant.statusCancelled", { defaultValue: "Đã hủy" })}
          </Badge>
        );
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const filtered = reservations.filter((r) => {
    if (filterState === "ALL") return true;
    return r.state === filterState;
  });

  const filters = [
    { key: "ALL", label: t("common.all", { defaultValue: "Tất cả" }) },
    { key: "REQUESTED", label: t("partner.restaurant.filterRequested", { defaultValue: "Chờ xác nhận" }) },
    { key: "CONFIRMED", label: t("partner.restaurant.filterConfirmed", { defaultValue: "Đã xác nhận" }) },
    { key: "REJECTED", label: t("partner.restaurant.filterRejected", { defaultValue: "Bị từ chối" }) },
    { key: "CANCELLED", label: t("partner.restaurant.filterCancelled", { defaultValue: "Đã hủy" }) },
  ];

  return (
    <div className={hideHeader ? "space-y-6" : "container mx-auto max-w-4xl px-4 py-8 space-y-6"}>
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

            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-8 text-xs self-start sm:self-auto">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh", { defaultValue: "Làm mới" })}
            </Button>
          </div>
        </div>
      )}

      {/* Filter Tabs & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filterState === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterState(f.key)}
              className="h-8 text-xs font-medium rounded-lg"
            >
              {f.label}
            </Button>
          ))}
        </div>

        {hideHeader && (
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-8 text-xs self-start sm:self-auto">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh", { defaultValue: "Làm mới" })}
          </Button>
        )}
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

      {/* List */}
      {loading ? (
        <div className="flex h-56 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/70 p-10 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("partner.restaurant.noReservationsCustomer", { defaultValue: "Chưa có lượt đặt bàn nào" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto mb-4">
            {t("partner.restaurant.noReservationsCustomerHelp", {
              defaultValue: "Khám phá các nhà hàng đối tác trên bản đồ và đặt trước chỗ ngồi cho chuyến đi của bạn.",
            })}
          </p>
          <Button asChild size="sm">
            <Link href="/explore">
              {t("places.exploreThisArea", { defaultValue: "Khám phá nhà hàng" })}
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((item) => (
            <Card key={item.id} className="border-border/70 shadow-xs hover:border-border transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between sm:justify-start gap-2.5">
                      <h3 className="text-base font-bold text-foreground">
                        {item.businessName || item.businessNameSnapshot}
                      </h3>
                      {renderBadge(item.state)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-foreground">{formatDateTime(item.startAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          {item.adults} {t("partner.restaurant.adults", { defaultValue: "người lớn" })}
                          {item.children > 0 && `, ${item.children} trẻ em`}
                        </span>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="rounded-lg bg-muted/30 p-2.5 text-xs text-muted-foreground border border-border/40 mt-1">
                        <span className="font-medium text-foreground mr-1.5">
                          {t("partner.restaurant.specialNotes", { defaultValue: "Ghi chú của bạn:" })}
                        </span>
                        {item.notes}
                      </div>
                    )}

                    {item.decisionReason && (
                      <div className="text-xs text-muted-foreground rounded-lg bg-amber-500/10 dark:bg-amber-500/5 p-2.5 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                        <span className="font-semibold">{t("partner.restaurant.decisionReason", { defaultValue: "Phản hồi từ quán:" })}</span>{" "}
                        {item.decisionReason}
                      </div>
                    )}

                    {item.cancellationReason && (
                      <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-2 border border-border/40">
                        <span className="font-semibold">{t("partner.restaurant.cancelReason", { defaultValue: "Lý do hủy:" })}</span>{" "}
                        {item.cancellationReason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0">
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                      <Link href={`/restaurants/${item.businessId}`} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t("partner.restaurant.viewPublic", { defaultValue: "Xem quán" })}
                      </Link>
                    </Button>

                    {item.state === "REQUESTED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenCancel(item)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10"
                      >
                        {t("partner.restaurant.cancelRequestButton", { defaultValue: "Hủy yêu cầu" })}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
