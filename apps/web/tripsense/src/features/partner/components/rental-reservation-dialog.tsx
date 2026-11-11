"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  Car,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ShieldCheck,
  MessageSquare,
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
import { useAuthStore } from "@/features/auth/store/use-auth-store";
import { chatApi } from "@/features/chat/services/chat-api";
import { notifyBookingActivityChanged } from "@/features/reservations/services/reservations-activity-api";
import { getSafeErrorMessage } from "@/services/error-sanitizer";
import {
  createRentalBooking,
  checkRentalAvailability,
} from "../services/rental-api";
import type {
  RentalItemDto,
  RentalBookingOrderDto,
  PickupOption,
  CreateRentalBookingRequest,
} from "../types";

export interface RentalReservationDialogProps {
  rentalItem: RentalItemDto;
  ownerUserId?: string;
  businessName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (order: RentalBookingOrderDto) => void;
}

export function RentalReservationDialog({
  rentalItem,
  ownerUserId,
  businessName,
  open,
  onOpenChange,
  onSuccess,
}: RentalReservationDialogProps) {
  const user = useAuthStore((state) => state.user);

  const supportsDelivery = Boolean(
    rentalItem.deliveryAvailable ||
      rentalItem.pickupOption === "BOTH" ||
      rentalItem.pickupOption === "DOOR_DELIVERY" ||
      rentalItem.pickupOption === "DELIVERY_TO_LOCATION",
  );

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [pickupAt, setPickupAt] = React.useState("");
  const [returnAt, setReturnAt] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [pickupOption, setPickupOption] = React.useState<PickupOption>("STORE_PICKUP");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [specialRequests, setSpecialRequests] = React.useState("");

  const [isCheckingAvailability, setIsCheckingAvailability] = React.useState(false);
  const [isAvailable, setIsAvailable] = React.useState<boolean | null>(null);
  const [availableCount, setAvailableCount] = React.useState<number | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = React.useState<RentalBookingOrderDto | null>(null);

  React.useEffect(() => {
    if (open) {
      setCreatedOrder(null);
      setError(null);
      setQuantity(1);
      setPickupOption("STORE_PICKUP");
    }
  }, [open, rentalItem.id]);

  // Auto pre-fill user credentials
  React.useEffect(() => {
    if (open && user) {
      if (!customerName) {
        setCustomerName(user.name || (user.email ? user.email.split("@")[0] : ""));
      }
      if (!customerEmail && user.email) {
        setCustomerEmail(user.email);
      }
    }
  }, [open, user, customerName, customerEmail]);

  // Set default dates: pickup tomorrow 08:00, return day after tomorrow 18:00
  React.useEffect(() => {
    if (open && !pickupAt) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      const isoPickup = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setPickupAt(isoPickup);

      const afterTomorrow = new Date(tomorrow);
      afterTomorrow.setDate(afterTomorrow.getDate() + 1);
      afterTomorrow.setHours(18, 0, 0, 0);
      const isoReturn = new Date(afterTomorrow.getTime() - afterTomorrow.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setReturnAt(isoReturn);
    }
  }, [open, pickupAt]);

  // Check availability when pickupAt, returnAt, or quantity changes
  React.useEffect(() => {
    if (!pickupAt || !returnAt || !open) return;
    const pDate = new Date(pickupAt);
    const rDate = new Date(returnAt);
    if (rDate <= pDate) {
      setIsAvailable(false);
      return;
    }

    let canceled = false;
    setIsCheckingAvailability(true);
    checkRentalAvailability(
      rentalItem.id,
      pDate.toISOString(),
      rDate.toISOString(),
      quantity
    )
      .then((res) => {
        if (!canceled) {
          setIsAvailable(res.available);
          setAvailableCount(res.availableCount);
        }
      })
      .catch(() => {
        if (!canceled) {
          setIsAvailable(true); // fallback optimistic
        }
      })
      .finally(() => {
        if (!canceled) setIsCheckingAvailability(false);
      });

    return () => {
      canceled = true;
    };
  }, [pickupAt, returnAt, quantity, rentalItem.id, open]);

  // Calculate pricing
  const { totalDays, totalAmount, depositTotal } = React.useMemo(() => {
    if (!pickupAt || !returnAt) return { totalDays: 1, totalAmount: 0, depositTotal: 0 };
    const p = new Date(pickupAt).getTime();
    const r = new Date(returnAt).getTime();
    const diffHours = Math.max(1, (r - p) / (1000 * 60 * 60));
    const days = Math.max(1, Math.ceil(diffHours / 24));
    const deliveryFee = pickupOption === "DOOR_DELIVERY" ? (rentalItem.deliveryFee || 0) : 0;
    const total = days * rentalItem.pricePerDay * quantity + deliveryFee;
    const deposit = (rentalItem.depositAmount || 0) * quantity;
    return { totalDays: days, totalAmount: total, depositTotal: deposit };
  }, [pickupAt, returnAt, quantity, pickupOption, rentalItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError("Vui lòng nhập tên người liên hệ.");
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 8) {
      setError("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }
    if (pickupOption === "DOOR_DELIVERY" && !deliveryAddress.trim()) {
      setError("Vui lòng nhập địa chỉ nhận xe/thiết bị.");
      return;
    }
    if (new Date(returnAt) <= new Date(pickupAt)) {
      setError("Thời điểm trả phải sau thời điểm nhận.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const normalizedPickupOption: PickupOption =
      pickupOption === "DOOR_DELIVERY" ? "DELIVERY_TO_LOCATION" : "PICKUP_AT_STORE";

    const payload: CreateRentalBookingRequest = {
      businessId: rentalItem.businessId,
      rentalItemId: rentalItem.id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim() || undefined,
      pickupOption: normalizedPickupOption,
      deliveryAddress: pickupOption === "DOOR_DELIVERY" ? deliveryAddress.trim() : undefined,
      pickupAt: new Date(pickupAt).toISOString(),
      returnAt: new Date(returnAt).toISOString(),
      quantity,
      customerNote: specialRequests.trim() || undefined,
      specialRequests: specialRequests.trim() || undefined,
    };

    try {
      const order = await createRentalBooking(payload);
      setCreatedOrder(order);

      const targetName = businessName || order.businessName || rentalItem.name;
      if (ownerUserId && user?.id && ownerUserId !== user.id) {
        const pickupStr = new Date(order.pickupAt).toLocaleString("vi-VN");
        const returnStr = new Date(order.returnAt).toLocaleString("vi-VN");
        const deliveryLine =
          pickupOption === "DOOR_DELIVERY"
            ? `\n- Giao tận nơi: ${deliveryAddress.trim()}`
            : "\n- Hình thức nhận: Lấy tại cửa hàng đối tác";
        const noteLine = specialRequests.trim() ? `\n- Ghi chú: ${specialRequests.trim()}` : "";
        const bookingSummaryMsg =
          `[Yêu cầu đặt thuê mới] Chào ${targetName}, mình đã gửi đơn đặt thuê ${rentalItem.name} (x${quantity}):\n` +
          `- Mã đơn: ${order.bookingCode}\n` +
          `- Thời gian: ${pickupStr} → ${returnStr}${deliveryLine}\n` +
          `- Người đặt: ${customerName.trim()} (SĐT: ${customerPhone.trim()})${noteLine}\n` +
          `Nhờ shop kiểm tra và xác nhận giúp mình nhé!`;
        void chatApi.sendDirectMessage(ownerUserId, bookingSummaryMsg).catch(() => undefined);
      }

      if (typeof window !== "undefined") {
        notifyBookingActivityChanged();
        window.dispatchEvent(
          new CustomEvent("app:notification-toast", {
            detail: {
              title: "Gửi yêu cầu thuê thành công!",
              body: `Đơn ${order.bookingCode} (${rentalItem.name}) tại ${targetName} đã được gửi tới đối tác.`,
              clickActionUrl: "/reservations?tab=rentals",
            },
          }),
        );
      }

      if (onSuccess) onSuccess(order);
    } catch (err) {
      setError(getSafeErrorMessage(err, "Không thể hoàn tất đơn đặt thuê."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setCreatedOrder(null);
    setError(null);
    onOpenChange(false);
  };

  const formatVnd = (val: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val);

  return (
    <Dialog open={open} onOpenChange={handleResetAndClose}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-teal-600" />
            Đặt thuê {rentalItem.name}
          </DialogTitle>
          <DialogDescription>
            Đơn giá {formatVnd(rentalItem.pricePerDay)}/ngày · Cam kết giao xe/thiết bị đúng hẹn & khử trùng sạch sẽ.
          </DialogDescription>
        </DialogHeader>

        {createdOrder ? (
          <div className="space-y-4 py-3 text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Gửi yêu cầu thuê thành công!</h3>
              <p className="text-xs text-muted-foreground">
                Mã đơn thuê của bạn là:{" "}
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {createdOrder.bookingCode}
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phương tiện/Dịch vụ:</span>
                <span className="font-semibold text-foreground">{createdOrder.rentalItemName} (x{createdOrder.quantity})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thời gian thuê:</span>
                <span className="font-medium text-foreground">
                  {new Date(createdOrder.pickupAt).toLocaleDateString("vi-VN")} → {new Date(createdOrder.returnAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tổng phí thuê:</span>
                <span className="font-bold text-emerald-600">{formatVnd(createdOrder.totalAmount)}</span>
              </div>
              {createdOrder.depositAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tiền đặt cọc xe/đồ:</span>
                  <span className="font-semibold text-foreground">{formatVnd(createdOrder.depositAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hình thức nhận:</span>
                <span className="font-medium text-foreground">
                  {createdOrder.pickupOption === "DOOR_DELIVERY" || createdOrder.pickupOption === "DELIVERY_TO_LOCATION"
                    ? `Giao tận nơi: ${createdOrder.deliveryAddress || "Theo địa chỉ đã đăng ký"}`
                    : "Nhận tại cửa hàng đối tác"}
                </span>
              </div>
            </div>

            <p className="text-micro text-muted-foreground italic">
              Cơ sở đối tác sẽ liên hệ xác nhận qua điện thoại hoặc bạn có thể theo dõi trong mục Đơn đặt của tôi.
            </p>

            <DialogFooter className="pt-2 sm:justify-center flex-wrap gap-2">
              <Button asChild variant="outline" className="text-xs">
                <Link href="/reservations?tab=rentals">Xem đơn đặt của tôi</Link>
              </Button>
              {ownerUserId && user?.id !== ownerUserId && (
                <Button asChild variant="outline" className="text-xs gap-1.5 border-teal-500/40 text-teal-700 dark:text-teal-300">
                  <Link href={`/chat?userId=${ownerUserId}`}>
                    <MessageSquare className="h-3.5 w-3.5" /> Mở Chat
                  </Link>
                </Button>
              )}
              <Button onClick={handleResetAndClose} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold">
                Đã hiểu
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Availability Badge */}
            <div className="flex items-center justify-between rounded-xl bg-teal-500/10 border border-teal-500/20 p-3 text-xs">
              <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-medium">
                <ShieldCheck className="h-4 w-4 text-teal-600" />
                <span>Tình trạng xe/đồ:</span>
              </div>
              {isCheckingAvailability ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Đang kiểm tra...
                </span>
              ) : isAvailable ? (
                <span className="font-bold text-emerald-600">
                  Còn sẵn xe ({availableCount ?? rentalItem.totalInventory} khả dụng)
                </span>
              ) : (
                <span className="font-bold text-destructive">
                  Đã kín lịch trong khung giờ này
                </span>
              )}
            </div>

            {/* Time selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Thời điểm nhận (*)
                </label>
                <Input
                  type="datetime-local"
                  value={pickupAt}
                  onChange={(e) => setPickupAt(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Thời điểm trả (*)
                </label>
                <Input
                  type="datetime-local"
                  value={returnAt}
                  onChange={(e) => setReturnAt(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            {/* Quantity and Pickup Option */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Số lượng xe / bộ (*)</label>
                <Input
                  type="number"
                  min="1"
                  max={rentalItem.totalInventory}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Hình thức nhận (*)</label>
                <select
                  value={pickupOption}
                  onChange={(e) => setPickupOption(e.target.value as PickupOption)}
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-medium"
                >
                  <option value="STORE_PICKUP">Lấy tại cửa hàng đối tác</option>
                  {supportsDelivery && (
                    <option value="DOOR_DELIVERY">
                      Giao tận nơi (Khách sạn/Sân bay)
                      {rentalItem.deliveryFee && rentalItem.deliveryFee > 0
                        ? ` (+${formatVnd(rentalItem.deliveryFee)})`
                        : " (Miễn phí)"}
                    </option>
                  )}
                </select>
              </div>
            </div>

            {pickupOption === "DOOR_DELIVERY" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> Địa chỉ giao xe / đồ (*)
                </label>
                <Input
                  placeholder="Ví dụ: Khách sạn Mường Thanh, 60 Trần Phú, Nha Trang"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            )}

            {/* Customer Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Họ và tên (*)</label>
                <Input
                  placeholder="Nguyễn Văn A"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Số điện thoại (*)</label>
                <Input
                  placeholder="0912 345 678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Ghi chú hoặc yêu cầu đặc biệt</label>
              <Textarea
                rows={2}
                placeholder="Ví dụ: Cần 2 mũ bảo hiểm size lớn, chuẩn bị thêm giá kẹp điện thoại..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Price Preview Banner */}
            <div className="rounded-xl bg-muted/40 p-3 space-y-1.5 text-xs border border-border/60">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thời gian thuê tạm tính:</span>
                <span className="font-medium text-foreground">{totalDays} ngày ({quantity} xe/bộ)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tiền thuê dịch vụ:</span>
                <span className="font-bold text-foreground text-sm">{formatVnd(totalAmount)}</span>
              </div>
              {depositTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tiền cọc thiết bị/xe (Hoàn trả khi trả xe):</span>
                  <span>{formatVnd(depositTotal)}</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleResetAndClose}>
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={submitting || isAvailable === false}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Xác nhận đặt thuê"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
