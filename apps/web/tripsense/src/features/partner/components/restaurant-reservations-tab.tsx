"use client";

import * as React from "react";
import Link from "next/link";
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
  Phone,
  Check,
  X,
  Plus,
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
import { chatApi } from "@/features/chat/services/chat-api";
import {
  getBusinessRestaurantReservations,
  decideRestaurantReservation,
} from "../services/partner-api";
import { CreateDirectBookingModal } from "./create-direct-booking-modal";
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
  const [directBookingOpen, setDirectBookingOpen] = React.useState(false);

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

      if (item.customerId) {
        const timeStr = new Date(item.startAt).toLocaleString("vi-VN");
        const confirmMsg = `✅ [Xác nhận đặt bàn] Chào bạn, quán đã xác nhận yêu cầu đặt bàn của bạn vào lúc ${timeStr} (${item.adults + item.children} khách). Mã đặt bàn: #${item.id.slice(0, 8)}... Quán rất hân hạnh được đón tiếp bạn!`;
        void chatApi.sendDirectMessage(item.customerId, confirmMsg).catch(() => undefined);
      }

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

      if (targetReservation.customerId) {
        const reasonPart = rejectReason.trim() ? ` Lý do: ${rejectReason.trim()}` : "";
        const rejectMsg = `❌ [Thông báo đặt bàn] Rất tiếc, quán hiện không thể tiếp nhận yêu cầu đặt bàn #${targetReservation.id.slice(0, 8)}... của bạn.${reasonPart} Rất mong có dịp được đón tiếp bạn vào thời gian khác.`;
        void chatApi.sendDirectMessage(targetReservation.customerId, rejectMsg).catch(() => undefined);
      }

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
            {t("partner.restaurant.statusRequested", { defaultValue: "Chờ xác nhận" })}
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className="border-emerald-600/30 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 font-semibold gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t("partner.restaurant.statusConfirmed", { defaultValue: "Đã xác nhận" })}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="destructive" className="gap-1 font-medium">
            <XCircle className="h-3 w-3" />
            {t("partner.restaurant.statusRejected", { defaultValue: "Đã từ chối" })}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="text-muted-foreground font-medium">
            {t("partner.restaurant.statusCancelled", { defaultValue: "Đã hủy" })}
          </Badge>
        );
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Link to central bookings hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground">
        <div className="flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <span>
            TripSense đã có <strong>Trung tâm Quản lý Booking Đối tác</strong> tập trung — xem toàn bộ đơn đặt bàn & đặt phòng từ khách trực tiếp lẫn qua Chat tại một nơi duy nhất.
          </span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-8 text-xs shrink-0 border-primary/30 text-primary hover:bg-primary/10">
          <Link href="/partner/bookings">
            Mở Trung tâm Booking &rarr;
          </Link>
        </Button>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "ALL", label: t("common.all", { defaultValue: "Tất cả" }) },
            { id: "REQUESTED", label: t("partner.restaurant.filterRequested", { defaultValue: "Chờ xác nhận" }) },
            { id: "CONFIRMED", label: t("partner.restaurant.filterConfirmed", { defaultValue: "Đã xác nhận" }) },
            { id: "REJECTED", label: t("partner.restaurant.filterRejected", { defaultValue: "Đã từ chối" }) },
            { id: "CANCELLED", label: t("partner.restaurant.filterCancelled", { defaultValue: "Đã hủy" }) },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={filterState === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterState(tab.id)}
              className="h-8 text-xs font-medium"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => setDirectBookingOpen(true)}
            className="h-8 text-xs gap-1.5 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tạo đặt bàn trực tiếp</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadReservations}
            disabled={loading}
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh", { defaultValue: "Làm mới" })}
          </Button>
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
          {reservations.map((item) => {
            const contactMatch = item.notes?.match(/\[Khách đặt:\s*([^|]+)\|\s*SĐT:\s*([^\]]+)\]/);
            const guestName = contactMatch ? contactMatch[1].trim() : item.customerName;
            const guestPhone = contactMatch ? contactMatch[2].trim() : null;
            const displayNotes = contactMatch
              ? item.notes?.replace(contactMatch[0], "").replace(/^\s*-\s*(Ghi chú:\s*)?/, "").trim()
              : item.notes;

            return (
              <Card key={item.id} className="border-border/70 shadow-xs hover:border-border transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-foreground">
                              {guestName || t("partner.restaurant.anonymousCustomer", { defaultValue: "Khách hàng" })}
                            </h4>
                            {renderStateBadge(item.state)}
                            {guestPhone && (
                              <a
                                href={`tel:${guestPhone}`}
                                title={t("partner.restaurant.callCustomer", { defaultValue: "Gọi xác nhận" })}
                                className="inline-flex items-center gap-1 text-micro font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-full transition-colors"
                              >
                                <Phone className="h-3 w-3" />
                                <span>{guestPhone}</span>
                              </a>
                            )}
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

                      {displayNotes && (
                        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/40 mt-1">
                          <span className="font-medium text-foreground mr-1.5">
                            {t("partner.restaurant.specialNotes", { defaultValue: "Ghi chú:" })}
                          </span>
                          {displayNotes}
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
            );
          })}
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

      <CreateDirectBookingModal
        open={directBookingOpen}
        onOpenChange={setDirectBookingOpen}
        initialBusinessId={businessId}
        initialType="RESTAURANT"
        onSuccess={loadReservations}
      />
    </div>
  );
}
