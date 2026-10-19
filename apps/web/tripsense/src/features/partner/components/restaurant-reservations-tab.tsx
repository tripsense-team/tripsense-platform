"use client";

import * as React from "react";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  User,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getBusinessRestaurantReservations,
  decideRestaurantReservation,
} from "../services/partner-api";
import type { RestaurantReservationDto } from "../types";

interface RestaurantReservationsTabProps {
  businessId: string;
}

export function RestaurantReservationsTab({ businessId }: RestaurantReservationsTabProps) {
  const { t } = useTranslation();
  const [reservations, setReservations] = React.useState<RestaurantReservationDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterState, setFilterState] = React.useState<string>("ALL");
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Decision state
  const [decidingId, setDecidingId] = React.useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = React.useState(false);
  const [targetReservation, setTargetReservation] = React.useState<RestaurantReservationDto | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");

  const loadReservations = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const stateParam = filterState === "ALL" ? undefined : filterState;
      const res = await getBusinessRestaurantReservations(businessId, stateParam, 0, 50);
      setReservations(res.content || []);
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể tải danh sách đặt bàn" })));
    } finally {
      setLoading(false);
    }
  }, [businessId, filterState, t]);

  React.useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const handleConfirm = async (item: RestaurantReservationDto) => {
    try {
      setDecidingId(item.id);
      setError(null);
      setActionSuccess(null);
      const updated = await decideRestaurantReservation(businessId, item.id, {
        expectedVersion: item.version,
        decision: "CONFIRM",
      });
      setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActionSuccess(t("partner.restaurant.confirmSuccess", { defaultValue: "Đã xác nhận đặt bàn thành công!" }));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
        window.dispatchEvent(
          new CustomEvent("app:notification-toast", {
            detail: {
              title: "Đã xác nhận đặt bàn thành công!",
              body: `Đã xác nhận đặt bàn cho ${item.customerName || "khách hàng"} (${item.adults + item.children} khách).`,
              clickActionUrl: `/partner/businesses/${businessId}/restaurant-menu`,
            },
          }),
        );
      }
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể xác nhận đặt bàn" })));
    } finally {
      setDecidingId(null);
    }
  };

  const handleOpenReject = (item: RestaurantReservationDto) => {
    setTargetReservation(item);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    if (!targetReservation) return;
    try {
      setDecidingId(targetReservation.id);
      setError(null);
      setActionSuccess(null);
      const updated = await decideRestaurantReservation(businessId, targetReservation.id, {
        expectedVersion: targetReservation.version,
        decision: "REJECT",
        reason: rejectReason.trim() || undefined,
      });
      setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setRejectModalOpen(false);
      setActionSuccess(t("partner.restaurant.rejectSuccess", { defaultValue: "Đã từ chối yêu cầu đặt bàn." }));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:notifications-refresh"));
        window.dispatchEvent(
          new CustomEvent("app:notification-toast", {
            detail: {
              title: "Đã từ chối yêu cầu đặt bàn",
              body: `Đã từ chối yêu cầu đặt bàn của ${targetReservation.customerName || "khách hàng"}.`,
              clickActionUrl: `/partner/businesses/${businessId}/restaurant-menu`,
            },
          }),
        );
      }
    } catch (err: unknown) {
      setError(getSafeErrorMessage(err, t("common.unexpectedError", { defaultValue: "Không thể từ chối đặt bàn" })));
    } finally {
      setDecidingId(null);
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

  const renderStateBadge = (state: string) => {
    switch (state) {
      case "REQUESTED":
        return (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
            <Clock className="mr-1 h-3 w-3" />
            {t("partner.restaurant.statusRequested", { defaultValue: "Chờ xác nhận" })}
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
            {t("partner.restaurant.statusRejected", { defaultValue: "Đã từ chối" })}
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

  const filters = [
    { key: "ALL", label: t("common.all", { defaultValue: "Tất cả" }) },
    { key: "REQUESTED", label: t("partner.restaurant.filterRequested", { defaultValue: "Chờ xác nhận" }) },
    { key: "CONFIRMED", label: t("partner.restaurant.filterConfirmed", { defaultValue: "Đã xác nhận" }) },
    { key: "REJECTED", label: t("partner.restaurant.filterRejected", { defaultValue: "Đã từ chối" }) },
    { key: "CANCELLED", label: t("partner.restaurant.filterCancelled", { defaultValue: "Đã hủy" }) },
  ];

  return (
    <div className="space-y-6">
      {/* Header controls & filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

        <Button
          variant="outline"
          size="sm"
          onClick={loadReservations}
          disabled={loading}
          className="h-8 text-xs self-start sm:self-auto"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh", { defaultValue: "Làm mới" })}
        </Button>
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

      {/* Reservations List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : reservations.length === 0 ? (
        <Card className="border-dashed border-border/70 p-8 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50 mb-2" />
          <h3 className="text-sm font-semibold text-foreground">
            {t("partner.restaurant.noReservations", { defaultValue: "Chưa có yêu cầu đặt bàn nào" })}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {t("partner.restaurant.noReservationsDesc", {
              defaultValue: "Khi thực khách gửi yêu cầu đặt chỗ trên trang công khai, yêu cầu sẽ xuất hiện tại đây để bạn duyệt.",
            })}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reservations.map((item) => (
            <Card key={item.id} className="border-border/70 shadow-xs hover:border-border transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            {item.customerName || t("partner.restaurant.anonymousCustomer", { defaultValue: "Khách hàng" })}
                          </h4>
                          {renderStateBadge(item.state)}
                        </div>
                        {item.customerEmail && (
                          <p className="text-xs text-muted-foreground">{item.customerEmail}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium text-foreground">{formatDateTime(item.startAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          {item.adults} {t("partner.restaurant.adults", { defaultValue: "người lớn" })}
                          {item.children > 0 && `, ${item.children} ${t("partner.restaurant.childrenLabel", { defaultValue: "trẻ em" })}`}
                        </span>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/40 mt-1">
                        <span className="font-medium text-foreground mr-1.5">
                          {t("partner.restaurant.specialNotes", { defaultValue: "Ghi chú:" })}
                        </span>
                        {item.notes}
                      </div>
                    )}

                    {item.decisionReason && (
                      <div className="text-xs text-muted-foreground pt-0.5">
                        <span className="font-medium">{t("partner.restaurant.decisionReason", { defaultValue: "Phản hồi quán:" })}</span>{" "}
                        {item.decisionReason}
                      </div>
                    )}

                    {item.cancellationReason && (
                      <div className="text-xs text-muted-foreground pt-0.5">
                        <span className="font-medium">{t("partner.restaurant.cancelReason", { defaultValue: "Lý do hủy:" })}</span>{" "}
                        {item.cancellationReason}
                      </div>
                    )}
                  </div>

                  {/* Actions for REQUESTED */}
                  {item.state === "REQUESTED" && (
                    <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-2 sm:pt-0">
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(item)}
                        disabled={decidingId === item.id}
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 shadow-xs"
                      >
                        {decidingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        {t("partner.restaurant.confirmButton", { defaultValue: "Xác nhận đặt bàn" })}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenReject(item)}
                        disabled={decidingId === item.id}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t("partner.restaurant.rejectButton", { defaultValue: "Từ chối" })}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("partner.restaurant.rejectTitle", { defaultValue: "Từ chối yêu cầu đặt bàn" })}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("partner.restaurant.rejectDesc", {
                defaultValue: "Vui lòng cung cấp lý do từ chối để thực khách nắm được thông tin (ví dụ: hết bàn vào khung giờ này, quán kín chỗ...).",
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Textarea
              placeholder={t("partner.restaurant.rejectReasonPlaceholder", {
                defaultValue: "Nhập lý do từ chối (tùy chọn)...",
              })}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
            >
              {t("common.cancel", { defaultValue: "Hủy bỏ" })}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRejectSubmit}
              disabled={decidingId !== null}
            >
              {decidingId !== null ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {t("partner.restaurant.confirmReject", { defaultValue: "Xác nhận từ chối" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
